/**
 * Moduł kalkulacji cen i kosztów zadaszeń aluminiowych na podstawie arkusza Excel
 * ("OFERTOWANIE ZADASZENIA" — serie STANDARD oraz PRO+, pokrycie Poliwęglan oraz Szkło).
 */

export const ROOF_STANDARD_WIDTHS_CM = [
  306, 406, 506, 606, 706, 806, 906, 1006, 1106, 1206,
] as const;

export const ROOF_STANDARD_DEPTHS_CM = [
  300, 350, 400, 450, 500, 550, 600,
] as const;

export type RoofStandardWidthCm = (typeof ROOF_STANDARD_WIDTHS_CM)[number];
export type RoofStandardDepthCm = (typeof ROOF_STANDARD_DEPTHS_CM)[number];
export type RoofCoverType = "polycarbonate" | "glass";
export type RoofSeries = "STANDARD" | "PRO+";

/**
 * Tabela bazowych kosztów materiału netto (Poliwęglan) wg klucza `SERIA_DxB` (w cm)
 * bezpośrednio z arkusza Excela "OFERTOWANIE ZADASZENIA".
 */
export const ROOF_BASE_CATALOG: Record<string, number> = {
  // STANDARD (głębokość 300, 350, 400 cm)
  STANDARD_300x306: 3358,
  STANDARD_300x406: 4285,
  STANDARD_300x506: 5350,
  STANDARD_300x606: 6114,
  STANDARD_300x706: 7106,
  STANDARD_300x806: 8577,
  STANDARD_300x906: 9634,
  STANDARD_300x1006: 10691,
  STANDARD_300x1106: 11463,
  STANDARD_300x1206: 12236,

  STANDARD_350x306: 3528,
  STANDARD_350x406: 4634,
  STANDARD_350x506: 5772,
  STANDARD_350x606: 6610,
  STANDARD_350x706: 7675,
  STANDARD_350x806: 9268,
  STANDARD_350x906: 10407,
  STANDARD_350x1006: 11545,
  STANDARD_350x1106: 12382,
  STANDARD_350x1206: 13220,

  STANDARD_400x306: 4073,
  STANDARD_400x406: 4984,
  STANDARD_400x506: 6195,
  STANDARD_400x606: 6789,
  STANDARD_400x706: 8260,
  STANDARD_400x806: 9959,
  STANDARD_400x906: 11179,
  STANDARD_400x1006: 12398,
  STANDARD_400x1106: 12984,
  STANDARD_400x1206: 13577,

  // PRO+ (głębokość 450, 500, 550, 600 cm)
  "PRO+_450x306": 5870,
  "PRO+_450x406": 7382,
  "PRO+_450x506": 9163,
  "PRO+_450x606": 10683,
  "PRO+_450x706": 13138,
  "PRO+_450x806": 14659,
  "PRO+_450x906": 16577,
  "PRO+_450x1006": 18098,
  "PRO+_450x1106": 20325,
  "PRO+_450x1206": 21846,

  "PRO+_500x306": 6244,
  "PRO+_500x406": 7878,
  "PRO+_500x506": 9772,
  "PRO+_500x606": 11398,
  "PRO+_500x706": 14016,
  "PRO+_500x806": 15642,
  "PRO+_500x906": 17675,
  "PRO+_500x1006": 19309,
  "PRO+_500x1106": 21699,
  "PRO+_500x1206": 23325,

  "PRO+_550x306": 8098,
  "PRO+_550x406": 10610,
  "PRO+_550x506": 13528,
  "PRO+_550x606": 15902,
  "PRO+_550x706": 18520,
  "PRO+_550x806": 21057,
  "PRO+_550x906": 23943,
  "PRO+_550x1006": 26398,
  "PRO+_550x1106": 28927,
  "PRO+_550x1206": 31358,

  "PRO+_600x306": 8691,
  "PRO+_600x406": 11407,
  "PRO+_600x506": 14333,
  "PRO+_600x606": 16976,
  "PRO+_600x706": 19772,
  "PRO+_600x806": 22504,
  "PRO+_600x906": 25561,
  "PRO+_600x1006": 28211,
  "PRO+_600x1106": 30911,
  "PRO+_600x1206": 33545,
};

export const ROOF_PRICING_CONFIG = {
  /** Narzut na materiał (52% -> mnożnik 1.52) wg arkusza */
  materialMarkupMultiplier: 1.52,
  /** Współczynnik szkła względem ceny bazowej poliwęglanu (12398 * 1.68 = 20828.64) */
  glassMaterialMultiplier: 1.68,
};

export function getRoofSeries(depthCm: number): RoofSeries {
  return depthCm > 400 ? "PRO+" : "STANDARD";
}

export function getRoofStandardWidthCm(widthCm: number): RoofStandardWidthCm {
  for (const w of ROOF_STANDARD_WIDTHS_CM) {
    if (widthCm <= w) return w;
  }
  return 1206;
}

export function getRoofStandardDepthCm(depthCm: number): RoofStandardDepthCm {
  for (const d of ROOF_STANDARD_DEPTHS_CM) {
    if (depthCm <= d) return d;
  }
  return 600;
}

/**
 * Zwraca stawkę montażu netto za 1 m² (cena dla klienta oraz koszt bazowy ekipy).
 */
export function getRoofInstallationRates(
  areaM2: number,
  coverType: RoofCoverType
): { pricePerM2: number; costPerM2: number } {
  if (areaM2 <= 10) {
    return {
      pricePerM2: coverType === "glass" ? 450 : 400,
      costPerM2: 350,
    };
  }
  if (areaM2 <= 15) {
    return {
      pricePerM2: coverType === "glass" ? 400 : 350,
      costPerM2: 300,
    };
  }
  if (areaM2 <= 20) {
    return {
      pricePerM2: coverType === "glass" ? 350 : 300,
      costPerM2: 250,
    };
  }
  if (areaM2 <= 25) {
    return {
      pricePerM2: coverType === "glass" ? 300 : 250,
      costPerM2: 200,
    };
  }
  // Powyżej 25 m² — wg sekcji KOSZTA w arkuszu (150 zł/m² koszt dla poliwęglanu, 200 zł/m² dla szkła)
  return {
    pricePerM2: coverType === "glass" ? 250 : 200,
    costPerM2: coverType === "glass" ? 200 : 150,
  };
}

export function checkIsRoofStandard(
  widthCm: number,
  depthCm: number
): {
  isStandard: boolean;
  pricingTier: "STANDARD" | "NIESTANDARD";
  series: RoofSeries;
  standardWidthCm: RoofStandardWidthCm;
  standardDepthCm: RoofStandardDepthCm;
  catalogKey: string;
} {
  const stdW = getRoofStandardWidthCm(widthCm);
  const stdD = getRoofStandardDepthCm(depthCm);
  const series = getRoofSeries(stdD);
  const exactW = ROOF_STANDARD_WIDTHS_CM.includes(widthCm as RoofStandardWidthCm);
  const exactD = ROOF_STANDARD_DEPTHS_CM.includes(depthCm as RoofStandardDepthCm);
  const isStandard = exactW && exactD;

  return {
    isStandard,
    pricingTier: isStandard ? "STANDARD" : "NIESTANDARD",
    series,
    standardWidthCm: stdW,
    standardDepthCm: stdD,
    catalogKey: `${series}_${stdD}x${stdW}`,
  };
}

/**
 * Rozpoznaje konstrukcję typu "Zadaszenie" (wykluczając trójkąty i pergole lamelowe).
 */
export function isRoofConstruction(item: {
  name?: string;
  shortName?: string;
  systemName?: string;
  fillType?: string;
  code?: string;
}): boolean {
  const text = `${item.name || ""} ${item.shortName || ""} ${item.systemName || ""} ${item.fillType || ""} ${item.code || ""}`.toLowerCase();
  if (text.includes("trójką") || text.includes("trojkat") || text.includes("pergol") || text.includes("lamel")) {
    return false;
  }
  return text.includes("zadaszen") || text.includes("zad-");
}

/**
 * Rozpoznaje czy zadaszenie ma pokrycie ze szkła (vs poliwęglan).
 */
export function getRoofCoverType(item: {
  name?: string;
  shortName?: string;
  fillType?: string;
  code?: string;
}): RoofCoverType {
  const text = `${item.name || ""} ${item.shortName || ""} ${item.fillType || ""} ${item.code || ""}`.toLowerCase();
  if (text.includes("szk") || text.includes("vsg")) {
    return "glass";
  }
  return "polycarbonate";
}

/**
 * Liczba pól między krokwiami (co ~100 cm szerokości) oraz liczba słupów frontowych.
 */
export function getRoofStructureCounts(widthMm: number): {
  fieldsCount: number;
  postsCount: number;
} {
  const widthCm = Math.round(widthMm / 10);
  const fieldsCount = Math.max(2, Math.min(14, Math.round((widthCm - 6) / 100) || 3));
  // Wg arkusza: 2 słupy do B=6060 mm, 3 słupy powyżej B=6060 mm (4 słupy od B>=10060 mm)
  const postsCount = widthMm > 10060 ? 4 : widthMm > 6060 ? 3 : 2;
  return { fieldsCount, postsCount };
}

/**
 * Pełna kalkulacja kosztów i cen zadaszenia na podstawie arkusza "OFERTOWANIE ZADASZENIA".
 */
export function calculateRoofPricing(
  widthMm: number,
  depthMm: number,
  coverType: RoofCoverType
) {
  const widthCm = Math.round(widthMm / 10);
  const depthCm = Math.round(depthMm / 10);

  const check = checkIsRoofStandard(widthCm, depthCm);
  const basePolyCost = ROOF_BASE_CATALOG[check.catalogKey] ?? 12398;

  const rawMaterialCost =
    coverType === "glass"
      ? basePolyCost * ROOF_PRICING_CONFIG.glassMaterialMultiplier
      : basePolyCost;
  const rawMaterialPrice =
    rawMaterialCost * ROOF_PRICING_CONFIG.materialMarkupMultiplier;

  const areaM2 = Math.round(((widthMm * depthMm) / 1_000_000) * 100) / 100;
  const { pricePerM2, costPerM2 } = getRoofInstallationRates(areaM2, coverType);

  const installationCostNet = Math.round(areaM2 * costPerM2);
  const installationPriceNet = Math.round(areaM2 * pricePerM2);

  const materialCostNet = Math.round(rawMaterialCost);
  const materialPriceNet = Math.round(rawMaterialPrice);
  const costNet = Math.round(rawMaterialCost + areaM2 * costPerM2);
  const priceNet = Math.round(rawMaterialPrice + areaM2 * pricePerM2);

  const { fieldsCount, postsCount } = getRoofStructureCounts(widthMm);

  return {
    isStandard: check.isStandard,
    pricingTier: `${check.series} · ${check.pricingTier}`,
    series: check.series,
    catalogKey: check.catalogKey,
    standardWidthCm: check.standardWidthCm,
    standardDepthCm: check.standardDepthCm,
    areaM2,
    fieldsCount,
    postsCount,
    materialCostNet,
    materialPriceNet,
    installationCostNet,
    installationPriceNet,
    costNet,
    priceNet,
  };
}
