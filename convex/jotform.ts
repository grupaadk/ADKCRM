import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

type JotformValue = string | Record<string, string> | string[] | undefined;
type JotformPayload = Record<string, JotformValue>;

function isStringRecord(value: JotformValue): value is Record<string, string> {
  return !!value && !Array.isArray(value) && typeof value === "object";
}

function getStringValue(value: JotformValue): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** Jotform czasem wysyła wartości liczbowe w polach tekstowych. */
function asTrimmedString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function parseUrlList(value: JotformValue): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

/** Normalizacja kodu PL (np. "30042" → "30-042"). */
function normalizePostalCode(input: string): string {
  const t = input.trim();
  const digits = t.replace(/\D/g, "");
  if (digits.length === 5) {
    return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  }
  return t;
}

/**
 * Jotform address: `zip` (US) lub `postal` / `postal_code` (EU); webhook bywa płaski `q39_adres[postal]`.
 */
function readPostalCodeFromAddress(
  addressObj: Record<string, unknown> | undefined,
  rawData: JotformPayload,
): string | undefined {
  let fromObj: string | undefined;
  if (addressObj) {
    fromObj = firstNonEmpty(
      asTrimmedString(addressObj.zip),
      asTrimmedString(addressObj.postal),
      asTrimmedString(addressObj.postal_code),
      asTrimmedString(addressObj.postcode),
    );
    if (!fromObj) {
      for (const [k, v] of Object.entries(addressObj)) {
        const s = asTrimmedString(v);
        if (!s) continue;
        if (/(zip|postal|postcode)/i.test(k)) {
          fromObj = s;
          break;
        }
      }
    }
  }

  const fromFlat = firstNonEmpty(
    getStringValue(rawData["q39_adres[zip]"]),
    getStringValue(rawData["q39_adres[postal]"]),
    getStringValue(rawData["q39_adres[postal_code]"]),
    getStringValue(rawData["q39_adres[postcode]"]),
  );

  const raw = firstNonEmpty(fromObj, fromFlat);
  return raw ? normalizePostalCode(raw) : undefined;
}

/**
 * Jeśli w pierwszej linii adresu jest numer domu (np. "ul. Lipowa 12"), rozdziel na ulicę i nr budynku.
 * Druga linia adresu (addr_line2) w Jotform = osobne pole „numer domu” → u nas numer mieszkania.
 */
export function splitStreetAndBuilding(addrLine1: string): {
  street: string;
  buildingNumber?: string;
} {
  const trimmed = addrLine1.trim();
  if (!trimmed) {
    return { street: "" };
  }
  const m = trimmed.match(
    /^(.+?)\s+(\d{1,4}[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]?(?:\/\d{1,4}[a-zA-Z]?)?)$/u,
  );
  if (m && m[1].trim().length > 0) {
    return { street: m[1].trim(), buildingNumber: m[2] };
  }
  return { street: trimmed };
}

// Mapowanie pól Jotform → klient (sekcja 6.1 PRD)
export function mapJotformPayload(rawData: JotformPayload) {
  // Jotform wysyła dane w formacie q8_imieI, q20_podajSwoj itd.
  const getName = (data: JotformPayload) => {
    const fullName = data.q8_imieI;

    // Format: { first: "Jan", last: "Kowalski" } lub flat
    if (typeof fullName === "string" || isStringRecord(fullName)) {
      return {
        firstName: isStringRecord(fullName)
          ? (fullName.first ?? "")
          : (fullName ?? ""),
        lastName: isStringRecord(fullName) ? (fullName.last ?? "") : "",
      };
    }
    // Fallback — szukaj w rawAnswers
    return {
      firstName:
        typeof data.firstName === "string"
          ? data.firstName
          : typeof data["q8_imieI[first]"] === "string"
            ? data["q8_imieI[first]"]
            : typeof data.q2_q2_textbox0 === "string"
              ? data.q2_q2_textbox0
              : "",
      lastName:
        typeof data.lastName === "string"
          ? data.lastName
          : typeof data["q8_imieI[last]"] === "string"
            ? data["q8_imieI[last]"]
            : typeof data.q3_q3_textbox1 === "string"
              ? data.q3_q3_textbox1
              : "",
    };
  };

  const parseArray = (val: JotformValue): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === "string") {
      return val
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  };

  const { firstName, lastName } = getName(rawData);

  // Pole adresowe q39_adres (control_address) — subpola: addr_line1, addr_line2, city, state, zip, country
  // Jotform może wysyłać jako obiekt lub jako płaskie klucze q39_adres[addr_line1]
  const addressField = rawData.q39_adres;
  const addressObj = isStringRecord(addressField)
    ? (addressField as Record<string, unknown>)
    : undefined;

  const addrLine1 =
    asTrimmedString(addressObj?.addr_line1) ??
    getStringValue(rawData["q39_adres[addr_line1]"]) ??
    "";
  const { street, buildingNumber: buildingFromLine1 } =
    splitStreetAndBuilding(addrLine1);

  const apartmentNumber =
    asTrimmedString(addressObj?.addr_line2) ??
    getStringValue(rawData["q39_adres[addr_line2]"]);

  const postalCode = readPostalCodeFromAddress(addressObj, rawData);

  return {
    firstName,
    lastName,
    email:
      getStringValue(rawData.q20_podajSwoj) ??
      getStringValue(rawData.email) ??
      getStringValue(rawData.q4_q4_email2),
    phone:
      (isStringRecord(rawData.q21_podajSwoj21)
        ? rawData.q21_podajSwoj21.full
        : undefined) ??
      getStringValue(rawData["q21_podajSwoj21[full]"]) ??
      getStringValue(rawData.phone) ??
      getStringValue(rawData.q5_q5_phone3),
    street: street || undefined,
    buildingNumber: buildingFromLine1,
    apartmentNumber: apartmentNumber || undefined,
    city:
      asTrimmedString(addressObj?.city) ??
      getStringValue(rawData["q39_adres[city]"]) ??
      getStringValue(rawData.q37_miejscowosc) ?? // fallback legacy
      getStringValue(rawData.city) ??
      getStringValue(rawData.q6_q6_textbox4),
    postalCode,
    services:
      parseArray(rawData.q33_jakaUsluge33).length > 0
        ? parseArray(rawData.q33_jakaUsluge33)
        : parseArray(rawData.q7_q7_checkbox5),
    windowColor:
      parseArray(rawData.q26_wybierzKolor).length > 0
        ? parseArray(rawData.q26_wybierzKolor)
        : parseArray(rawData.q8_q8_dropdown6),
    doorColor:
      parseArray(rawData.q28_wybierzKolor28).length > 0
        ? parseArray(rawData.q28_wybierzKolor28)
        : parseArray(rawData.q9_q9_dropdown7),
    gateColor:
      parseArray(rawData.q29_wybierzKolor29).length > 0
        ? parseArray(rawData.q29_wybierzKolor29)
        : parseArray(rawData.q10_q10_dropdown8),
    terraceColor:
      parseArray(rawData.q30_wybierzKolor30).length > 0
        ? parseArray(rawData.q30_wybierzKolor30)
        : parseArray(rawData.q11_q11_dropdown9),
    constructionColor:
      parseArray(rawData.q31_wybierzKolor31).length > 0
        ? parseArray(rawData.q31_wybierzKolor31)
        : parseArray(rawData.q12_q12_dropdown10),
    sunProtectionType:
      parseArray(rawData.q32_wybierzTyp).length > 0
        ? parseArray(rawData.q32_wybierzTyp)
        : parseArray(rawData.q13_q13_radio11),
    projectFiles:
      parseUrlList(rawData.q27_przeslijPliki).join("\n") ||
      parseUrlList(rawData.przeslijPliki).join("\n") ||
      parseUrlList(rawData.q14_fileupload12).join("\n") ||
      undefined,
    comment:
      getStringValue(rawData.q23_miejsceNa) ??
      getStringValue(rawData.q15_q15_textarea13),
    submissionId:
      getStringValue(rawData.submissionID) ??
      getStringValue(rawData.submission_id),
  };
}

// POST /api/webhooks/jotform
export const webhook = httpAction(async (ctx, request) => {
  // Weryfikacja shared secret
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  const expectedSecret = process.env.JOTFORM_WEBHOOK_SECRET;

  if (expectedSecret) {
    if (!secret || secret !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: invalid webhook secret" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }
  } else {
    console.warn("JOTFORM_WEBHOOK_SECRET not set — webhook validation skipped");
  }

  let rawData: JotformPayload;
  const contentType = request.headers.get("content-type") ?? "";
  console.info("[jotform] webhook received", {
    method: request.method,
    contentType,
    url: request.url,
  });

  if (contentType.includes("application/json")) {
    rawData = await request.json();
  } else if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    rawData = {};
    formData.forEach((value, key) => {
      rawData[key] = typeof value === "string" ? value : value.name;
    });

    if (rawData.rawRequest) {
      try {
        const rawRequest = getStringValue(rawData.rawRequest);
        const parsed = rawRequest ? JSON.parse(rawRequest) : null;
        if (parsed && typeof parsed === "object") {
          rawData = parsed as JotformPayload;
        }
      } catch {
        // keep as-is
      }
    }
  } else {
    // Jotform domyślnie wysyła application/x-www-form-urlencoded
    const text = await request.text();
    const params = new URLSearchParams(text);
    rawData = Object.fromEntries(params.entries());

    // Jotform pakuje dane w rawRequest
    if (rawData.rawRequest) {
      try {
        const rawRequest = getStringValue(rawData.rawRequest);
        const parsed = rawRequest ? JSON.parse(rawRequest) : null;
        if (parsed && typeof parsed === "object") {
          rawData = parsed as JotformPayload;
        }
      } catch {
        // keep as-is
      }
    }
  }

  console.info("[jotform] raw keys", { keys: Object.keys(rawData), rawData });

  const mapped = mapJotformPayload(rawData);
  console.info("[jotform] mapped payload", {
    firstName: mapped.firstName,
    lastName: mapped.lastName,
    email: mapped.email,
    street: mapped.street,
    buildingNumber: mapped.buildingNumber,
    apartmentNumber: mapped.apartmentNumber,
    city: mapped.city,
    postalCode: mapped.postalCode,
    submissionId: mapped.submissionId,
    servicesCount: mapped.services.length,
    projectFiles: mapped.projectFiles,
  });

  if (!mapped.firstName && !mapped.lastName) {
    console.warn("[jotform] rejected payload: missing firstName and lastName", {
      rawKeys: Object.keys(rawData),
      sampleNameField: rawData.q8_imieI,
    });
    return new Response(
      JSON.stringify({ error: "Brak danych: imię i nazwisko wymagane" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Utwórz klienta od razu przy zgłoszeniu (lub znajdź istniejącego)
  const clientId = await ctx.runMutation(
    api.jotformInternal.createOrFindClient,
    {
      firstName: mapped.firstName,
      lastName: mapped.lastName,
      email: mapped.email,
      phone: mapped.phone,
      street: mapped.street,
      buildingNumber: mapped.buildingNumber,
      apartmentNumber: mapped.apartmentNumber,
      postalCode: mapped.postalCode,
      city: mapped.city,
      submissionId: mapped.submissionId,
    },
  );

  // Zapisz zgłoszenie jako oczekujące — zlecenie tworzone jest dopiero
  // gdy admin przesunie kartę na Kanbanie do "Do pomiarów".
  const pendingId = await ctx.runMutation(
    api.jotformInternal.savePendingSubmission,
    { ...mapped, clientId },
  );

  // Wyślij SMS potwierdzający przyjęcie prośby o wycenę
  if (mapped.phone) {
    await ctx.scheduler.runAfter(0, internal.sms.sendQuoteConfirmation, {
      phone: mapped.phone,
      firstName: mapped.firstName,
    });
  }

  console.info("[jotform] client created and pending submission saved", {
    clientId,
    pendingId,
    email: mapped.email,
    submissionId: mapped.submissionId,
  });

  return new Response(
    JSON.stringify({ status: "pending", pendingId }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
});

// GET /api/jotform/file?url=<encoded-jotform-url>
// Redirects to the actual file with Jotform API key appended so the browser
// downloads the file directly instead of landing on the Jotform login page.
export const fileRedirect = httpAction(async (_ctx, request) => {
  const reqUrl = new URL(request.url);
  const fileUrl = reqUrl.searchParams.get("url");

  if (!fileUrl) {
    return new Response("Missing url parameter", { status: 400 });
  }

  const apiKey = process.env.JOTFORM_API_KEY?.trim();
  if (!apiKey) {
    return Response.redirect(fileUrl, 302);
  }

  const target = new URL(fileUrl);
  target.searchParams.set("apiKey", apiKey);
  return Response.redirect(target.toString(), 302);
});
