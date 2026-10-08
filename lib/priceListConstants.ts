export const POLYCARBONATE_CONFIG = {
  key: "polycarbonate_roofs",
  category: "Zadaszenia Poliwęglan",
  title: "Cennik Zadaszeń Poliwęglan",
  spreadsheetId: "1vGqKWFYi6ck38seMFWBXXDu_QSkURZjFsNn-jFR9OhE",
  sheetGid: "637216141",
  sheetName: "Zadaszenia Poliwęglan",
  sourceUrl: "https://docs.google.com/spreadsheets/d/1vGqKWFYi6ck38seMFWBXXDu_QSkURZjFsNn-jFR9OhE/edit?gid=637216141#gid=637216141",
  csvExportUrl: "https://docs.google.com/spreadsheets/d/1vGqKWFYi6ck38seMFWBXXDu_QSkURZjFsNn-jFR9OhE/export?format=csv&gid=637216141",
};

export const WALLS_CONFIG = {
  key: "terrace_walls",
  category: "Ściany przesuwne, stałe, trójkąt",
  title: "Cennik ścian",
  spreadsheetId: "1vGqKWFYi6ck38seMFWBXXDu_QSkURZjFsNn-jFR9OhE",
  sheetGid: "0",
  sheetName: "Ściany przesuwne,stałe,trójkąt",
  sourceUrl: "https://docs.google.com/spreadsheets/d/1vGqKWFYi6ck38seMFWBXXDu_QSkURZjFsNn-jFR9OhE/edit",
  csvExportUrl: "https://docs.google.com/spreadsheets/d/1vGqKWFYi6ck38seMFWBXXDu_QSkURZjFsNn-jFR9OhE/export?format=csv",
};

export const STANDARD_WIDTHS = [306, 406, 506, 606, 706, 806, 906, 1006, 1106, 1206];
export const STANDARD_DEPTHS = [
  { depth: 300, series: "STANDARD" as const },
  { depth: 350, series: "STANDARD" as const },
  { depth: 400, series: "STANDARD" as const },
  { depth: 450, series: "PRO+" as const },
  { depth: 500, series: "PRO+" as const },
  { depth: 550, series: "PRO+" as const },
  { depth: 600, series: "PRO+" as const },
];

export interface PriceListRow {
  key: string;
  dimension: string;
  dimensionMeters: string;
  depthCm: number;
  widthCm: number;
  series: "STANDARD" | "PRO+";
  areaSqM: number;
  priceNet: number;
  priceGross: number;
  priceNetPerSqM: number;
}

export interface PriceItemDimensions {
  widthCm: number; // Szerokość otworu (cm)
  heightCm: number; // Wysokość otworu (cm)
}

export interface GenericPriceItem {
  id: string;
  name: string; // Kolumna A: Produkt / wymiary
  dimensions?: PriceItemDimensions; // Obiekt wymiarów otworu: { widthCm, heightCm }
  widthCm?: number; // Szerokość otworu (cm)
  heightCm?: number; // Wysokość otworu (cm)
  trackCount?: number; // Liczba torów (np. 2, 3, 4, 5, 6)
  priceNet: number; // Kolumna C: Cena netto
  priceGross?: number; // Cena brutto
  category?: string;
}

/**
 * Wyodrębnia szerokość i wysokość otworu oraz liczbę torów z tekstu nazwy produktu
 * Format: "System 2-torowy 194 cm / wys. 230cm" -> { widthCm: 194, heightCm: 230, trackCount: 2 }
 */
export function extractDimensionsFromName(name: string): {
  dimensions?: PriceItemDimensions;
  widthCm?: number;
  heightCm?: number;
  trackCount?: number;
} {
  let trackCount: number | undefined;
  const trackMatch = name.match(/(\d+)[-\s]*torow/i);
  if (trackMatch) {
    trackCount = parseInt(trackMatch[1], 10);
  }

  // 1. Format: "194 cm / wys. 230cm" lub "194 / wys 230" lub "194 cm / 230 cm"
  const slashMatch = name.match(/(\d+(?:[.,]\d+)?)\s*cm?\s*\/\s*(?:wys\.?|wysokość|h)?\s*(\d+(?:[.,]\d+)?)\s*cm?/i);
  if (slashMatch) {
    const widthCm = Math.round(parseFloat(slashMatch[1].replace(",", ".")));
    const heightCm = Math.round(parseFloat(slashMatch[2].replace(",", ".")));
    return {
      dimensions: { widthCm, heightCm },
      widthCm,
      heightCm,
      trackCount,
    };
  }

  // 2. Format: "194 x 230 cm" lub "194×230"
  const crossMatch = name.match(/(\d+(?:[.,]\d+)?)\s*cm?\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*cm?/i);
  if (crossMatch) {
    const widthCm = Math.round(parseFloat(crossMatch[1].replace(",", ".")));
    const heightCm = Math.round(parseFloat(crossMatch[2].replace(",", ".")));
    return {
      dimensions: { widthCm, heightCm },
      widthCm,
      heightCm,
      trackCount,
    };
  }

  // 3. Format: "szer. 194 ... wys. 230"
  const explicitMatch = name.match(/szer(?:\.|okość)?\s*(\d+).*?wys(?:\.|okość)?\s*(\d+)/i);
  if (explicitMatch) {
    const widthCm = parseInt(explicitMatch[1], 10);
    const heightCm = parseInt(explicitMatch[2], 10);
    return {
      dimensions: { widthCm, heightCm },
      widthCm,
      heightCm,
      trackCount,
    };
  }

  return { trackCount };
}

export const DEFAULT_WALL_ITEMS: GenericPriceItem[] = [
  {
    id: "sliding_2_194",
    name: "System 2-torowy 194 cm / wys. 230cm",
    dimensions: { widthCm: 194, heightCm: 230 },
    widthCm: 194,
    heightCm: 230,
    trackCount: 2,
    priceNet: 1667,
    priceGross: 2050,
  },
  {
    id: "sliding_3_241",
    name: "System 3-torowy 241 cm / wys. 230 cm",
    dimensions: { widthCm: 241, heightCm: 230 },
    widthCm: 241,
    heightCm: 230,
    trackCount: 3,
    priceNet: 2431,
    priceGross: 2990,
  },
  {
    id: "sliding_3_290",
    name: "System 3-torowy 290 cm / wys. 230 cm",
    dimensions: { widthCm: 290, heightCm: 230 },
    widthCm: 290,
    heightCm: 230,
    trackCount: 3,
    priceNet: 2431,
    priceGross: 2990,
  },
  {
    id: "sliding_4_337",
    name: "System 4-torowy 337 cm / wys. 230 cm",
    dimensions: { widthCm: 337, heightCm: 230 },
    widthCm: 337,
    heightCm: 230,
    trackCount: 4,
    priceNet: 3317,
    priceGross: 4080,
  },
  {
    id: "sliding_4_386",
    name: "System 4-torowy 386 cm / wys. 230 cm",
    dimensions: { widthCm: 386, heightCm: 230 },
    widthCm: 386,
    heightCm: 230,
    trackCount: 4,
    priceNet: 3317,
    priceGross: 4080,
  },
  {
    id: "sliding_5_433",
    name: "System 5-torowy 433 cm / wys. 230 cm",
    dimensions: { widthCm: 433, heightCm: 230 },
    widthCm: 433,
    heightCm: 230,
    trackCount: 5,
    priceNet: 4244,
    priceGross: 5220,
  },
  {
    id: "sliding_5_482",
    name: "System 5-torowy 482 cm / wys. 230 cm",
    dimensions: { widthCm: 482, heightCm: 230 },
    widthCm: 482,
    heightCm: 230,
    trackCount: 5,
    priceNet: 4244,
    priceGross: 5220,
  },
  {
    id: "sliding_6_529",
    name: "System 6-torowy 529 cm / wys. 230 cm",
    dimensions: { widthCm: 529, heightCm: 230 },
    widthCm: 529,
    heightCm: 230,
    trackCount: 6,
    priceNet: 5325,
    priceGross: 6550,
  },
  {
    id: "sliding_6_578",
    name: "System 6-torowy 578 cm / wys. 230 cm",
    dimensions: { widthCm: 578, heightCm: 230 },
    widthCm: 578,
    heightCm: 230,
    trackCount: 6,
    priceNet: 5325,
    priceGross: 6550,
  },
];
