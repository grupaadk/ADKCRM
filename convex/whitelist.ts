import { v } from "convex/values";
import { action } from "./_generated/server";

export function parsePolishAddress(raw: string): {
  street: string;
  buildingNumber: string;
  apartmentNumber?: string;
  postalCode: string;
  city: string;
} {
  if (!raw || typeof raw !== "string") {
    return { street: "", buildingNumber: "", postalCode: "", city: "" };
  }
  let text = raw.trim();

  // Strip trailing country e.g. ", Polska", ", POLAND"
  text = text.replace(/[,\s]+(?:POLSKA|POLAND)$/i, "").trim();

  // Find postal code: XX-XXX
  const postalMatch = text.match(/\b(\d{2}-\d{3})\b/);
  if (!postalMatch || postalMatch.index === undefined) {
    return {
      street: text,
      buildingNumber: "",
      apartmentNumber: undefined,
      postalCode: "",
      city: "",
    };
  }

  const postalCode = postalMatch[1];
  const postalIndex = postalMatch.index;

  const beforePostal = text.slice(0, postalIndex).trim().replace(/,+$/, "").trim();
  const cityPart = text.slice(postalIndex + postalCode.length).trim().replace(/^[,\s]+|[,\s]+$/g, "").trim();
  const city = cityPart;

  // Strip common street prefixes
  let streetPart = beforePostal.replace(/^(?:ul\.|ulica|al\.|aleja|aleje|pl\.|plac|os\.|osiedle|skwer|bulwar)\s+/i, "").trim();

  let buildingNumber = "";
  let apartmentNumber: string | undefined = undefined;

  // 1. Check for explicit apartment with "lok." / "m." / "lokal" / "nr"
  const aptMatch = streetPart.match(/[,/\s]+(?:lok\.|lokal|m\.|mieszkania|mieszkanie|nr\s*lokalu|nr\s*lok\.|nr)\s*([0-9a-zA-Z\-]+)\s*$/i);
  if (aptMatch && aptMatch.index !== undefined) {
    apartmentNumber = aptMatch[1].trim();
    streetPart = streetPart.slice(0, aptMatch.index).trim().replace(/,+$/, "").trim();
  }

  // 2. If apartment not found yet, check for slash format e.g. "44 / 33" or "44/33" or "10/2A"
  if (!apartmentNumber) {
    const slashMatch = streetPart.match(/(\d+[a-zA-Z]?)\s*\/\s*([0-9a-zA-Z\-]+)\s*$/);
    if (slashMatch && slashMatch.index !== undefined) {
      buildingNumber = slashMatch[1].trim();
      apartmentNumber = slashMatch[2].trim();
      streetPart = streetPart.slice(0, slashMatch.index).trim().replace(/,+$/, "").trim();
    }
  }

  // 3. If buildingNumber not found yet, match building number (handles "12/14", "12-14", "142B", "10")
  if (!buildingNumber) {
    const bldgMatch = streetPart.match(/(\d+[a-zA-Z]?(?:[\/\-]\d+[a-zA-Z]?)?)\s*$/);
    if (bldgMatch && bldgMatch.index !== undefined) {
      buildingNumber = bldgMatch[1].trim();
      streetPart = streetPart.slice(0, bldgMatch.index).trim().replace(/,+$/, "").trim();
    }
  }

  let street = streetPart;

  // If street equals city (small village with house numbers only), clear street so it is not duplicated
  if (street.toUpperCase() === city.toUpperCase()) {
    street = "";
  }

  return {
    street,
    buildingNumber,
    apartmentNumber: apartmentNumber || undefined,
    postalCode,
    city,
  };
}

export const lookupNip = action({
  args: { nip: v.string() },
  handler: async (_ctx, { nip }): Promise<{
    companyName: string;
    street: string;
    buildingNumber: string;
    apartmentNumber?: string;
    postalCode: string;
    city: string;
    isActive: boolean;
    rawAddress?: string;
  }> => {
    const cleanNip = nip.replace(/[\s\-]/g, "");
    if (!/^\d{10}$/.test(cleanNip)) {
      throw new Error("NIP musi zawierać dokładnie 10 cyfr");
    }

    const date = new Date().toISOString().split("T")[0];
    const url = `https://wl-api.mf.gov.pl/api/search/nip/${cleanNip}?date=${date}`;

    let res: Response;
    try {
      res = await fetch(url, { headers: { Accept: "application/json" } });
    } catch {
      throw new Error("Błąd połączenia z Białą Listą MF — sprawdź połączenie internetowe");
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      throw new Error(`Biała Lista zwróciła niepoprawną odpowiedź (HTTP ${res.status})`);
    }

    if (typeof data !== "object" || data === null) {
      throw new Error("Nie znaleziono podmiotu dla podanego NIP-u");
    }

    // Error response from API
    if ("code" in data) {
      const errData = data as { code: string; message?: string };
      if (errData.code === "WL-112" || errData.code === "WL-113") {
        throw new Error("Nie znaleziono firmy dla podanego NIP-u w Białej Liście MF");
      }
      throw new Error(errData.message ?? `Błąd API Białej Listy (${errData.code})`);
    }

    const resultData = data as { result?: { subject?: Record<string, unknown> } };
    const subject = resultData.result?.subject;

    if (!subject) {
      throw new Error("Nie znaleziono podmiotu dla podanego NIP-u");
    }

    const companyName = typeof subject.name === "string" ? subject.name.trim() : "";
    if (!companyName) {
      throw new Error("Brak nazwy firmy w odpowiedzi API");
    }

    const statusVat = typeof subject.statusVat === "string" ? subject.statusVat : "";
    const isActive = statusVat === "Czynny";

    const residenceAddr =
      typeof subject.residenceAddress === "string" ? subject.residenceAddress.trim() : "";
    const workingAddr =
      typeof subject.workingAddress === "string" ? subject.workingAddress.trim() : "";

    // Prefer residenceAddress as it represents the registered seat ("Adres siedziby podmiotu"),
    // but fall back to workingAddress if residenceAddress is empty.
    const rawAddress = residenceAddr || workingAddr;

    const parsed = rawAddress ? parsePolishAddress(rawAddress) : null;

    return {
      companyName,
      street: parsed?.street ?? "",
      buildingNumber: parsed?.buildingNumber ?? "",
      apartmentNumber: parsed?.apartmentNumber,
      postalCode: parsed?.postalCode ?? "",
      city: parsed?.city ?? "",
      isActive,
      rawAddress: rawAddress || undefined,
    };
  },
});
