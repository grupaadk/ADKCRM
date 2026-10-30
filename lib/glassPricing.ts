/**
 * Moduł kalkulacji cen i kosztów systemów szklanych na podstawie arkusza Excel
 * (Arkusz: "OFERTOWANIE ŚCIANKI" / "WYLICZENIE SZKŁO")
 */

export const STANDARD_MODULE_WIDTHS_CM = [
  94, 194, 241, 290, 337, 386, 433, 482, 529, 578,
] as const;

export type StandardModuleWidthCm = (typeof STANDARD_MODULE_WIDTHS_CM)[number];

export interface GlassModuleCatalogEntry {
  widthCm: StandardModuleWidthCm;
  panes: number;
  label: string;
  /** Koszt samego systemu/profili (zł netto) */
  systemCostNet: number;
  /** Koszt kompletu szczotek (zł netto) */
  brushesCostNet: number;
  /** Koszt kompletu uchwytów (zł netto) */
  handlesCostNet: number;
  /** Koszt zestawu standardowego ze szkłem (zł netto) */
  standardCostNet: number;
  /** Koszt profili i akcesoriów bez szkła (zł netto) */
  nonStandardProfilesCostNet: number;
}

export const GLASS_MODULE_CATALOG: Record<
  StandardModuleWidthCm,
  GlassModuleCatalogEntry
> = {
  94: {
    widthCm: 94,
    panes: 1,
    label: "1-torowy (94 cm)",
    systemCostNet: 1667,
    brushesCostNet: 65,
    handlesCostNet: 57,
    standardCostNet: 1789,
    nonStandardProfilesCostNet: 1155,
  },
  194: {
    widthCm: 194,
    panes: 2,
    label: "2-torowy (194 cm)",
    systemCostNet: 1667,
    brushesCostNet: 65,
    handlesCostNet: 57,
    standardCostNet: 1789,
    nonStandardProfilesCostNet: 1155,
  },
  241: {
    widthCm: 241,
    panes: 3,
    label: "3-torowy połówkowy (241 cm)",
    systemCostNet: 2431,
    brushesCostNet: 89,
    handlesCostNet: 81,
    standardCostNet: 2601,
    nonStandardProfilesCostNet: 1650,
  },
  290: {
    widthCm: 290,
    panes: 3,
    label: "3-torowy (290 cm)",
    systemCostNet: 2431,
    brushesCostNet: 89,
    handlesCostNet: 81,
    standardCostNet: 2601,
    nonStandardProfilesCostNet: 1650,
  },
  337: {
    widthCm: 337,
    panes: 4,
    label: "4-torowy połówkowy (337 cm)",
    systemCostNet: 3317,
    brushesCostNet: 122,
    handlesCostNet: 114,
    standardCostNet: 3553,
    nonStandardProfilesCostNet: 2285,
  },
  386: {
    widthCm: 386,
    panes: 4,
    label: "4-torowy (386 cm)",
    systemCostNet: 3317,
    brushesCostNet: 122,
    handlesCostNet: 114,
    standardCostNet: 3553,
    nonStandardProfilesCostNet: 2285,
  },
  433: {
    widthCm: 433,
    panes: 5,
    label: "5-torowy połówkowy (433 cm)",
    systemCostNet: 4244,
    brushesCostNet: 154,
    handlesCostNet: 138,
    standardCostNet: 4536,
    nonStandardProfilesCostNet: 3072,
  },
  482: {
    widthCm: 482,
    panes: 5,
    label: "5-torowy (482 cm)",
    systemCostNet: 4244,
    brushesCostNet: 154,
    handlesCostNet: 138,
    standardCostNet: 4536,
    nonStandardProfilesCostNet: 3072,
  },
  529: {
    widthCm: 529,
    panes: 6,
    label: "6-torowy połówkowy (529 cm)",
    systemCostNet: 5325,
    brushesCostNet: 187,
    handlesCostNet: 163,
    standardCostNet: 5675,
    nonStandardProfilesCostNet: 4017,
  },
  578: {
    widthCm: 578,
    panes: 6,
    label: "6-torowy (578 cm)",
    systemCostNet: 5325,
    brushesCostNet: 187,
    handlesCostNet: 163,
    standardCostNet: 5675,
    nonStandardProfilesCostNet: 4017,
  },
};

export const GLASS_PRICING_CONFIG = {
  /** Cena zakupu szkła hartowanego 10 mm (zł/m²) wg komórki H25 */
  glassPurchasePricePerM2: 225,
  /** Narzut na materiał (52% -> mnożnik 1.52) wg komórki H24 */
  materialMarkupMultiplier: 1.52,
  /** Stawka kosztu montażu ścianki (zł/mb) wg komórki I26 */
  installationCostPerMb: 250,
  /** Stawka montażu dla klienta (zł/mb) wg komórki H26 */
  installationPricePerMb: 300,
};

/**
 * Zwraca najbliższy wyższy moduł standardowy dla podanej szerokości w cm
 */
export function getStandardWidthCm(widthCm: number): StandardModuleWidthCm {
  for (const w of STANDARD_MODULE_WIDTHS_CM) {
    if (widthCm <= w) return w;
  }
  return 578;
}

/**
 * Sprawdza czy konstrukcja spełnia kryteria wymiaru STANDARDOWEGO wg formuły:
 * =IF(AND(OR(C4=94,194,241,290,337,386,433,482,529,578),MOD(D4,5)=0,D4>=200,D4<=250),"STANDARD","NIESTANDARD")
 */
export function checkIsStandard(
  widthCm: number,
  heightCm: number
): {
  isStandard: boolean;
  pricingTier: "STANDARD" | "NIESTANDARD";
  standardWidthCm: StandardModuleWidthCm;
  reason?: string;
} {
  const isWidthExactStandard = STANDARD_MODULE_WIDTHS_CM.includes(
    widthCm as StandardModuleWidthCm
  );
  const isHeightInRange = heightCm >= 200 && heightCm <= 250;
  const isHeightDivisibleBy5 = heightCm % 5 === 0;

  const standardWidthCm = getStandardWidthCm(widthCm);
  const isStandard = isWidthExactStandard && isHeightInRange && isHeightDivisibleBy5;

  let reason: string | undefined;
  if (!isStandard) {
    if (!isWidthExactStandard && !isHeightDivisibleBy5) {
      reason = `Szerokość ${widthCm} cm poza siatką modułów oraz wysokość ${heightCm} cm bez skoku co 5 cm`;
    } else if (!isWidthExactStandard) {
      reason = `Szerokość ${widthCm} cm poza siatką modułów (najbliższy moduł: ${standardWidthCm} cm)`;
    } else if (!isHeightInRange) {
      reason = `Wysokość ${heightCm} cm poza zakresem standardowym 200–250 cm`;
    } else if (!isHeightDivisibleBy5) {
      reason = `Wysokość ${heightCm} cm nie posiada skoku co 5 cm (wymaga docięcia szkła)`;
    }
  }

  return {
    isStandard,
    pricingTier: isStandard ? "STANDARD" : "NIESTANDARD",
    standardWidthCm,
    reason,
  };
}

/**
 * Sprawdza czy dana konstrukcja kwalifikuje się jako system szklany
 */
export function isGlassSystemConstruction(item: {
  name?: string;
  shortName?: string;
  systemName?: string;
  fillType?: string;
}): boolean {
  const text = `${item.name || ""} ${item.shortName || ""} ${item.systemName || ""} ${item.fillType || ""}`.toLowerCase();
  // Trójkąty tarasowe pod krokwie mają osobną wycenę (wg cennika schodkowego / torów) i nie są ścianami przesuwnymi
  if (text.includes("trójką") || text.includes("trojkat")) {
    return false;
  }
  return (
    text.includes("szkł") ||
    text.includes("szklo") ||
    text.includes("hart") ||
    text.includes("torow") ||
    text.includes("procural")
  );
}

/**
 * Oblicza pełną kalkulację kosztów i cen dla systemu szklanego
 * w 100% zgodnie z logiką arkusza Excel
 */
export function calculateGlassSystemPricing(
  widthMm: number,
  heightMm: number
) {
  const widthCm = Math.round(widthMm / 10);
  const heightCm = Math.round(heightMm / 10);

  const { isStandard, pricingTier, standardWidthCm, reason } = checkIsStandard(
    widthCm,
    heightCm
  );

  const moduleInfo =
    GLASS_MODULE_CATALOG[standardWidthCm] || GLASS_MODULE_CATALOG[578];

  // Powierzchnia szkła w m²
  const glassAreaM2 =
    Math.round(((widthMm * heightMm) / 1000000) * 10000) / 10000;

  let materialCostNet = 0;
  if (isStandard) {
    // STANDARD ze szkłem
    materialCostNet = moduleInfo.standardCostNet;
  } else {
    // NIESTANDARD: Szkło (m² * 225 zł) + Profile modułu bez szkła
    const glassCost =
      glassAreaM2 * GLASS_PRICING_CONFIG.glassPurchasePricePerM2;
    materialCostNet =
      Math.round((glassCost + moduleInfo.nonStandardProfilesCostNet) * 100) / 100;
  }

  // Cena materiału z narzutem 52%
  const rawMaterialPrice =
    materialCostNet * GLASS_PRICING_CONFIG.materialMarkupMultiplier;
  const materialPriceNet = Math.round(rawMaterialPrice);

  // Montaż rozliczany z metrów bieżących modułu standardowego (standardWidthCm / 100)
  const standardWidthMeters = standardWidthCm / 100;
  const rawInstallationCost =
    standardWidthMeters * GLASS_PRICING_CONFIG.installationCostPerMb;
  const rawInstallationPrice =
    standardWidthMeters * GLASS_PRICING_CONFIG.installationPricePerMb;

  const installationCostNet = Math.round(rawInstallationCost);
  const installationPriceNet = Math.round(rawInstallationPrice);

  // W Excelu sumy RAZEM K4 i L4 sumują wartości przed zaokrągleniem komórek:
  // K4 = G4 + I4 (2853.795 + 602.5 = 3456.295 -> 3456 zł)
  // L4 = H4 + J4 (4337.7684 + 723 = 5060.7684 -> 5061 zł)
  const costNet = Math.round(materialCostNet + rawInstallationCost);
  const priceNet = Math.round(rawMaterialPrice + rawInstallationPrice);

  return {
    isStandard,
    pricingTier,
    standardWidthCm,
    glassAreaM2,
    panesCount: moduleInfo.panes,
    systemCostNet: moduleInfo.systemCostNet,
    brushesCostNet: moduleInfo.brushesCostNet,
    handlesCostNet: moduleInfo.handlesCostNet,
    materialCostNet: Math.round(materialCostNet),
    materialPriceNet,
    installationCostNet,
    installationPriceNet,
    priceNet,
    costNet,
    reason,
  };
}
