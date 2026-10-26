/**
 * Silnik kalkulacyjny dla kategorii "Systemy szklane" i "Trójkąt"
 * Oparty na arkuszu Excel "OFERTOWANIE ŚCIANKI" (Kalkulator Zabudowy Szklanej).
 */

export interface GlassWallThreshold {
  /** Próg szerokości w cm (94, 194, 241, 290, 337, 386, 433, 482, 529, 578) */
  widthCm: number;
  /** Liczba torów (1 do 6) */
  tracks: number;
  /** Czy podział ze skrzydłami połówkowymi (dla progów 241, 337, 433, 529) */
  isHalfPanes: boolean;
  /** Opis układu torów (np. "3-torowy", "4 połowa") */
  tracksLabel: string;

  // ── Wariant STANDARD (ze szkłem w cenie bazowej) ──
  systemWithGlassCost: number;
  brushesCost: number;
  handlesCost: number;
  triangleCost: number;
  foundationCost: number;
  standardFrontTotalCost: number;
  standardSideTotalCost: number;

  // ── Wariant NIESTANDARD (profile bez szkła) ──
  systemNoGlassCost: number;
  nonStandardFrontProfilesCost: number;
  nonStandardSideProfilesCost: number;
}

/**
 * Tabela progowa wymiarów standardowych i kosztów komponentów z Excela
 */
export const GLASS_WALL_THRESHOLDS: GlassWallThreshold[] = [
  {
    widthCm: 94,
    tracks: 1,
    isHalfPanes: false,
    tracksLabel: "1-torowy",
    systemWithGlassCost: 1667,
    systemNoGlassCost: 1033,
    brushesCost: 65,
    handlesCost: 57,
    triangleCost: 854,
    foundationCost: 106,
    standardFrontTotalCost: 1789, // 1667 + 65 + 57
    standardSideTotalCost: 2749,  // 1789 + 854 + 106
    nonStandardFrontProfilesCost: 1155, // 1033 + 65 + 57
    nonStandardSideProfilesCost: 2115,  // 1155 + 854 + 106
  },
  {
    widthCm: 194,
    tracks: 2,
    isHalfPanes: false,
    tracksLabel: "2-torowy",
    systemWithGlassCost: 1667,
    systemNoGlassCost: 1033,
    brushesCost: 65,
    handlesCost: 57,
    triangleCost: 854,
    foundationCost: 106,
    standardFrontTotalCost: 1789,
    standardSideTotalCost: 2749,
    nonStandardFrontProfilesCost: 1155,
    nonStandardSideProfilesCost: 2115,
  },
  {
    widthCm: 241,
    tracks: 3,
    isHalfPanes: true,
    tracksLabel: "3 połowa",
    systemWithGlassCost: 2431,
    systemNoGlassCost: 1480,
    brushesCost: 89,
    handlesCost: 81,
    triangleCost: 854,
    foundationCost: 179,
    standardFrontTotalCost: 2601, // 2431 + 89 + 81
    standardSideTotalCost: 3634,  // 2601 + 854 + 179
    nonStandardFrontProfilesCost: 1650, // 1480 + 89 + 81
    nonStandardSideProfilesCost: 2683,  // 1650 + 854 + 179
  },
  {
    widthCm: 290,
    tracks: 3,
    isHalfPanes: false,
    tracksLabel: "3-torowy",
    systemWithGlassCost: 2431,
    systemNoGlassCost: 1480,
    brushesCost: 89,
    handlesCost: 81,
    triangleCost: 854,
    foundationCost: 179,
    standardFrontTotalCost: 2601,
    standardSideTotalCost: 3634,
    nonStandardFrontProfilesCost: 1650,
    nonStandardSideProfilesCost: 2683,
  },
  {
    widthCm: 337,
    tracks: 4,
    isHalfPanes: true,
    tracksLabel: "4 połowa",
    systemWithGlassCost: 3317,
    systemNoGlassCost: 2049,
    brushesCost: 122,
    handlesCost: 114,
    triangleCost: 1016,
    foundationCost: 272,
    standardFrontTotalCost: 3553, // 3317 + 122 + 114
    standardSideTotalCost: 4841,  // 3553 + 1016 + 272
    nonStandardFrontProfilesCost: 2285, // 2049 + 122 + 114
    nonStandardSideProfilesCost: 3573,  // 2285 + 1016 + 272
  },
  {
    widthCm: 386,
    tracks: 4,
    isHalfPanes: false,
    tracksLabel: "4-torowy",
    systemWithGlassCost: 3317,
    systemNoGlassCost: 2049,
    brushesCost: 122,
    handlesCost: 114,
    triangleCost: 1179,
    foundationCost: 272,
    standardFrontTotalCost: 3553,
    standardSideTotalCost: 5004,  // 3553 + 1179 + 272
    nonStandardFrontProfilesCost: 2285,
    nonStandardSideProfilesCost: 3736,  // 2285 + 1179 + 272
  },
  {
    widthCm: 433,
    tracks: 5,
    isHalfPanes: true,
    tracksLabel: "5 połowa",
    systemWithGlassCost: 4244,
    systemNoGlassCost: 2780,
    brushesCost: 154,
    handlesCost: 138,
    triangleCost: 1463,
    foundationCost: 382,
    standardFrontTotalCost: 4536, // 4244 + 154 + 138
    standardSideTotalCost: 6381,  // 4536 + 1463 + 382
    nonStandardFrontProfilesCost: 3072, // 2780 + 154 + 138
    nonStandardSideProfilesCost: 4917,  // 3072 + 1463 + 382
  },
  {
    widthCm: 482,
    tracks: 5,
    isHalfPanes: false,
    tracksLabel: "5-torowy",
    systemWithGlassCost: 4244,
    systemNoGlassCost: 2780,
    brushesCost: 154,
    handlesCost: 138,
    triangleCost: 1707,
    foundationCost: 382,
    standardFrontTotalCost: 4536,
    standardSideTotalCost: 6625,  // 4536 + 1707 + 382
    nonStandardFrontProfilesCost: 3072,
    nonStandardSideProfilesCost: 5161,  // 3072 + 1707 + 382
  },
  {
    widthCm: 529,
    tracks: 6,
    isHalfPanes: true,
    tracksLabel: "6 połowa",
    systemWithGlassCost: 5325,
    systemNoGlassCost: 3667,
    brushesCost: 187,
    handlesCost: 163,
    triangleCost: 2439,
    foundationCost: 618,
    standardFrontTotalCost: 5675, // 5325 + 187 + 163
    standardSideTotalCost: 8732,  // 5675 + 2439 + 618
    nonStandardFrontProfilesCost: 4017, // 3667 + 187 + 163
    nonStandardSideProfilesCost: 7074,  // 4017 + 2439 + 618
  },
  {
    widthCm: 578,
    tracks: 6,
    isHalfPanes: false,
    tracksLabel: "6-torowy",
    systemWithGlassCost: 5325,
    systemNoGlassCost: 3667,
    brushesCost: 187,
    handlesCost: 163,
    triangleCost: 2683,
    foundationCost: 618,
    standardFrontTotalCost: 5675,
    standardSideTotalCost: 8976,  // 5675 + 2683 + 618
    nonStandardFrontProfilesCost: 4017,
    nonStandardSideProfilesCost: 7318,  // 4017 + 2683 + 618
  },
];

/**
 * Domyślne stawki i parametry kalkulatora
 */
export const DEFAULT_GLASS_WALL_RATES = {
  /** Narzut na materiał (0.52 = 52%) */
  materialMarkupPercent: 0.52,
  /** Koszt zakupu 1 m² szkła hartowanego (zł netto) */
  glassCostPerM2: 225,

  // ── Montaż (zł netto za metr bieżący) ──
  wallAssemblyCostPerMb: 250,     // Koszt montażu ścianki
  wallAssemblyClientPerMb: 300,   // Cena montażu ścianki dla klienta

  triangleAssemblyCostPerMb: 200,    // Koszt montażu trójkąta
  triangleAssemblyClientPerMb: 250,  // Cena montażu trójkąta dla klienta

  foundationAssemblyCostPerMb: 50,   // Koszt montażu fundamentu
  foundationAssemblyClientPerMb: 100,// Cena montażu fundamentu dla klienta

  // ── Montaż boczna kpl. (ryczałt) ──
  sideWallAssemblyCostFixed: 500,
  sideWallAssemblyClientFixed: 650,

  // ── Ceny zakupu dodatków (zł netto) ──
  lamellaNetCost: 850,
  postNetCost: 480,
  profileNetCost: 500,

  // ── Wymiarowanie CAD ──
  glassHeightDeductionMm: 100, // Wysokość szkła = wysokość otworu - 100mm
  defaultGlassOverlapMm: 30,   // Optymalne zachodzenie szyb na siebie Z = 30mm
};

export type GlassWallType = "front" | "side" | "triangle" | "foundation" | "lamella";
export type GlassWallVariant = "standard" | "nonstandard";

/** Standardowe szerokości systemowe w mm (klucze z tabeli STANDARD w Excelu: 94, 194, 241, 290, 337, 386, 433, 482, 529, 578 cm) */
export const STANDARD_GLASS_WALL_WIDTHS_MM = [
  940, 1940, 2410, 2900, 3370, 3860, 4330, 4820, 5290, 5780,
];

/** Standardowe wysokości systemowe w mm (w arkuszu: "standard co 50mm - 2200, 2250, 2300") */
export const STANDARD_GLASS_WALL_HEIGHTS_MM = [2200, 2250, 2300];

/** Maksymalna wysokość mieszcząca się w typoszeregu standardowym */
export const STANDARD_GLASS_WALL_MAX_HEIGHT_MM = 2300;

/**
 * Określa typ "STANDARD" lub "NIESTANDARD" na podstawie logiki z arkusza Excel "OFERTOWANIE ŚCIANKI":
 * - Szerokość musi odpowiadać jednemu z 10 kluczy standardowych (z tolerancją do 5 mm)
 * - Wysokość nie może przekraczać 2300 mm i odpowiadać standardowemu typoszeregowi (2200, 2250, 2300 mm)
 */
export function determineGlassWallType(
  widthMm: number,
  heightMm: number
): "STANDARD" | "NIESTANDARD" {
  const isStdWidth = STANDARD_GLASS_WALL_WIDTHS_MM.some(
    (stdW) => Math.abs(stdW - widthMm) <= 5
  );
  if (!isStdWidth) return "NIESTANDARD";

  if (heightMm > STANDARD_GLASS_WALL_MAX_HEIGHT_MM) {
    return "NIESTANDARD";
  }

  const isStdHeight = STANDARD_GLASS_WALL_HEIGHTS_MM.some(
    (stdH) => Math.abs(stdH - heightMm) <= 5
  );
  if (!isStdHeight) {
    return "NIESTANDARD";
  }

  return "STANDARD";
}

export interface GlassWallCalculationInput {
  wallType: GlassWallType;
  /** Szerokość w mm */
  widthMm: number;
  /** Wysokość w mm */
  heightMm: number;
  /** Liczba sztuk (domyślnie 1) */
  quantity?: number;
  /** Wariant (jeśli pominięty, dobierany automatycznie: exact standard = standard, inaczej nonstandard) */
  variant?: GlassWallVariant;
  /** Czy doliczać montaż (domyślnie true) */
  includeAssembly?: boolean;
  /** Opcjonalna własna stawka narzutu materiałowego (np. 0.52) */
  customMarkup?: number;
  /** Opcjonalna własna cena zakupu szkła za m² (np. 225) */
  customGlassCostPerM2?: number;
}

export interface GlassWallCalculationResult {
  wallType: GlassWallType;
  variant: GlassWallVariant;
  widthMm: number;
  heightMm: number;
  quantity: number;
  matchedThresholdCm: number;
  tracks: number;
  tracksLabel: string;
  areaM2: number;

  // ── Pozycje kosztowe (zakup netto) ──
  profilesCost: number;
  glassCost: number;
  accessoriesCost: number;
  triangleCost: number;
  foundationCost: number;
  constructionCostNet: number;

  // ── Cena sprzedaży konstrukcji (z narzutem) ──
  markupPercent: number;
  constructionPriceNet: number;

  // ── Montaż ──
  assemblyCostNet: number;
  assemblyPriceNet: number;

  // ── Jednostkowo (1 szt.) ──
  unitTotalCostNet: number;
  unitTotalPriceNet: number;

  // ── Łącznie (dla zadanej ilości) ──
  totalCostNet: number;
  totalPriceNet: number;
  totalProfitNet: number;
  marginPercent: number;
}

/**
 * Dobiera najmniejszy próg standardowy mieszczący zadaną szerokość w cm
 */
export function findMatchingThreshold(widthCm: number): GlassWallThreshold {
  const match = GLASS_WALL_THRESHOLDS.find((t) => t.widthCm >= widthCm);
  if (match) return match;
  return GLASS_WALL_THRESHOLDS[GLASS_WALL_THRESHOLDS.length - 1];
}

/**
 * Główna funkcja wyliczająca ściankę szklaną / trójkąt / fundament
 */
export function calculateGlassWallItem(
  input: GlassWallCalculationInput
): GlassWallCalculationResult {
  const quantity = Math.max(1, input.quantity ?? 1);
  const widthMm = Math.max(100, input.widthMm);
  const heightMm = Math.max(100, input.heightMm);
  const widthCm = widthMm / 10;
  const widthMb = widthMm / 1000;
  const areaM2 = (widthMm * heightMm) / 1_000_000;

  const markup = input.customMarkup ?? DEFAULT_GLASS_WALL_RATES.materialMarkupPercent;
  const glassRate = input.customGlassCostPerM2 ?? DEFAULT_GLASS_WALL_RATES.glassCostPerM2;
  const includeAssembly = input.includeAssembly ?? true;

  const threshold = findMatchingThreshold(widthCm);

  // Automatyczny wybór wariantu z uwzględnieniem szerokości i wysokości wg Excela
  const variant: GlassWallVariant =
    input.variant ??
    (determineGlassWallType(widthMm, heightMm) === "STANDARD" ? "standard" : "nonstandard");

  let profilesCost = 0;
  let glassCost = 0;
  let accessoriesCost = 0;
  let triangleCost = 0;
  let foundationCost = 0;
  let assemblyCostNet = 0;
  let assemblyPriceNet = 0;

  if (input.wallType === "front") {
    accessoriesCost = threshold.brushesCost + threshold.handlesCost;

    if (variant === "standard") {
      profilesCost = threshold.systemWithGlassCost; // bazowy zestaw ze szkłem
      glassCost = 0; // szkło jest już w cenie zestawu standardowego
    } else {
      profilesCost = threshold.systemNoGlassCost;
      glassCost = areaM2 * glassRate;
    }

    if (includeAssembly) {
      assemblyCostNet = widthMb * DEFAULT_GLASS_WALL_RATES.wallAssemblyCostPerMb;
      assemblyPriceNet = widthMb * DEFAULT_GLASS_WALL_RATES.wallAssemblyClientPerMb;
    }
  } else if (input.wallType === "side") {
    // Ścianka boczna kpl. zawiera: ściankę szklaną + trójkąt + fundament
    accessoriesCost = threshold.brushesCost + threshold.handlesCost;
    triangleCost = threshold.triangleCost;
    foundationCost = threshold.foundationCost;

    if (variant === "standard") {
      profilesCost = threshold.systemWithGlassCost;
      glassCost = 0;
    } else {
      profilesCost = threshold.systemNoGlassCost;
      glassCost = areaM2 * glassRate;
    }

    if (includeAssembly) {
      assemblyCostNet = widthMb * DEFAULT_GLASS_WALL_RATES.wallAssemblyCostPerMb;
      assemblyPriceNet = widthMb * DEFAULT_GLASS_WALL_RATES.wallAssemblyClientPerMb;
    }
  } else if (input.wallType === "triangle") {
    triangleCost = threshold.triangleCost;
    if (includeAssembly) {
      assemblyCostNet = widthMb * DEFAULT_GLASS_WALL_RATES.triangleAssemblyCostPerMb;
      assemblyPriceNet = widthMb * DEFAULT_GLASS_WALL_RATES.triangleAssemblyClientPerMb;
    }
  } else if (input.wallType === "foundation") {
    foundationCost = threshold.foundationCost;
    if (includeAssembly) {
      assemblyCostNet = widthMb * DEFAULT_GLASS_WALL_RATES.foundationAssemblyCostPerMb;
      assemblyPriceNet = widthMb * DEFAULT_GLASS_WALL_RATES.foundationAssemblyClientPerMb;
    }
  } else if (input.wallType === "lamella") {
    profilesCost = DEFAULT_GLASS_WALL_RATES.lamellaNetCost;
  }

  const constructionCostNet =
    profilesCost + glassCost + accessoriesCost + triangleCost + foundationCost;
  const constructionPriceNet = constructionCostNet * (1 + markup);

  const unitTotalCostNet = constructionCostNet + assemblyCostNet;
  const unitTotalPriceNet = constructionPriceNet + assemblyPriceNet;

  const totalCostNet = unitTotalCostNet * quantity;
  const totalPriceNet = unitTotalPriceNet * quantity;
  const totalProfitNet = totalPriceNet - totalCostNet;
  const marginPercent = totalPriceNet > 0 ? (totalProfitNet / totalPriceNet) * 100 : 0;

  return {
    wallType: input.wallType,
    variant,
    widthMm,
    heightMm,
    quantity,
    matchedThresholdCm: threshold.widthCm,
    tracks: threshold.tracks,
    tracksLabel: threshold.tracksLabel,
    areaM2: Math.round(areaM2 * 10000) / 10000,
    profilesCost: Math.round(profilesCost * 100) / 100,
    glassCost: Math.round(glassCost * 100) / 100,
    accessoriesCost: Math.round(accessoriesCost * 100) / 100,
    triangleCost: Math.round(triangleCost * 100) / 100,
    foundationCost: Math.round(foundationCost * 100) / 100,
    constructionCostNet: Math.round(constructionCostNet * 100) / 100,
    markupPercent: markup * 100,
    constructionPriceNet: Math.round(constructionPriceNet * 100) / 100,
    assemblyCostNet: Math.round(assemblyCostNet * 100) / 100,
    assemblyPriceNet: Math.round(assemblyPriceNet * 100) / 100,
    unitTotalCostNet: Math.round(unitTotalCostNet * 100) / 100,
    unitTotalPriceNet: Math.round(unitTotalPriceNet * 100) / 100,
    totalCostNet: Math.round(totalCostNet * 100) / 100,
    totalPriceNet: Math.round(totalPriceNet * 100) / 100,
    totalProfitNet: Math.round(totalProfitNet * 100) / 100,
    marginPercent: Math.round(marginPercent * 100) / 100,
  };
}

/**
 * Wynik wyliczenia wymiarów szyb dla CAD
 */
export interface GlassSegmentCalculation {
  widthMm: number;
  heightMm: number;
  panesCount: number;
  glassWidthMm: number;
  glassHeightMm: number;
  overlapMm: number;
  segments: Array<{ widthMm: number; heightMm: number }>;
  totalGlassAreaM2: number;
}

/**
 * Wylicza wymiary i podział szyb z zachodzeniem Z (domyślnie Z = 30 mm)
 * Wzór z arkusza:
 *   Szerokość szyby = (B + (N - 1) * Z) / N
 *   Wysokość szyby = H - 100 mm
 */
export function calculateGlassSegments(
  widthMm: number,
  heightMm: number,
  panesCount?: number,
  overlapMm: number = DEFAULT_GLASS_WALL_RATES.defaultGlassOverlapMm
): GlassSegmentCalculation {
  const widthCm = widthMm / 10;
  const threshold = findMatchingThreshold(widthCm);
  const n = Math.max(1, panesCount ?? threshold.tracks);

  const glassHeightMm = Math.max(50, heightMm - DEFAULT_GLASS_WALL_RATES.glassHeightDeductionMm);
  const glassWidthMm = Math.round((widthMm + (n - 1) * overlapMm) / n);

  const segments = Array.from({ length: n }).map(() => ({
    widthMm: glassWidthMm,
    heightMm: glassHeightMm,
  }));

  const totalGlassAreaM2 =
    Math.round(((n * glassWidthMm * glassHeightMm) / 1_000_000) * 10000) / 10000;

  return {
    widthMm,
    heightMm,
    panesCount: n,
    glassWidthMm,
    glassHeightMm,
    overlapMm,
    segments,
    totalGlassAreaM2,
  };
}
