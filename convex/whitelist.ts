import { v } from "convex/values";
import { action } from "./_generated/server";

function parsePolishAddress(raw: string): {
  street: string;
  buildingNumber: string;
  apartmentNumber?: string;
  postalCode: string;
  city: string;
} | null {
  const trimmed = raw.trim();
  // Match: [optional prefix] street name, building[/apartment], postal code, city
  const match = trimmed.match(
    /^(.+?)\s+(\d+[a-zA-Z]?(?:[/\-]\d+[a-zA-Z]?)?)[,\s]+(\d{2}-\d{3})\s+(.+)$/,
  );
  if (!match) return null;

  let street = match[1].trim();
  // Strip common Polish street prefixes: ul., al., os., pl., gen., ks., dr., etc.
  street = street.replace(/^(?:ul\.|al\.|os\.|pl\.|gen\.|ks\.|dr\.|prof\.|mgr\.)\s+/i, "");

  const fullNumber = match[2].trim();
  const postalCode = match[3].trim();
  const city = match[4].trim();

  // Split "12/3" into buildingNumber "12" and apartmentNumber "3"
  const slashIdx = fullNumber.indexOf("/");
  let buildingNumber: string;
  let apartmentNumber: string | undefined;
  if (slashIdx !== -1) {
    buildingNumber = fullNumber.slice(0, slashIdx);
    apartmentNumber = fullNumber.slice(slashIdx + 1);
  } else {
    buildingNumber = fullNumber;
  }

  return { street, buildingNumber, apartmentNumber, postalCode, city };
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

    const rawAddress =
      typeof subject.workingAddress === "string" && subject.workingAddress.trim()
        ? subject.workingAddress.trim()
        : typeof subject.residenceAddress === "string" && subject.residenceAddress.trim()
          ? subject.residenceAddress.trim()
          : "";

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
