export interface TerraceInput {
  depthCm: number; // Głębokość w cm (np. 550)
  widthCm: number; // Szerokość w cm (np. 1106)
  materialMarkupPercent?: number; // Domyślnie 52 (%)
  customAssemblyRateNetPerSqM?: number | null; // Opcjonalna własna stawka montażu za m²
  vatRatePercent?: number; // 8 lub 23 (%)
}

export interface OptionResult {
  title: string;
  roofType: "polycarbonate" | "glass_standard" | "glass_nonstandard";
  materialCostNet: number; // Materiał netto z narzutem
  assemblyCostNet: number; // Łączny montaż netto
  totalNet: number; // Razem netto (Materiał + Montaż)
  totalGross: number; // Razem brutto (Z wybranym VAT)
  pricePerSqMNet: number; // Cena netto za m²
  pricePerSqMGross: number; // Cena brutto za m²
  costBasisKc: number; // Koszt własny (Kc)
  profitZ: number; // Zysk (Z)
  marginPercent: number; // Marża %
  extraGlassGrossDelta?: number; // Szacowana dopłata brutto względem poliwęglanu
}

export interface TerraceCalculationResult {
  input: {
    depthCm: number;
    widthCm: number;
    matchedDepthCm: number;
    matchedWidthCm: number;
    series: "STANDARD" | "PRO+";
    isStandardDimension: boolean;
    isOutOfRange: boolean;
    areaSqM: number;
    suggestedAssemblyRateNetPerSqM: number;
    effectiveAssemblyRateNetPerSqM: number;
    materialMarkupPercent: number;
    vatRatePercent: number;
    lookupKey: string;
    basePriceNet: number;
  };
  options: {
    polycarbonate: OptionResult;
    glassStandard: OptionResult;
    glassNonStandard: OptionResult;
  };
  warning?: string;
}

export const BASE_PRICE_MATRIX: Record<
  string,
  { area: number; basePriceNet: number; basePriceGross?: number }
> = {
  STANDARD_300x306: { area: 9.18, basePriceNet: 3358.0, basePriceGross: 4130.0 },
  STANDARD_300x406: { area: 12.18, basePriceNet: 4285.0, basePriceGross: 5270.0 },
  STANDARD_300x506: { area: 15.18, basePriceNet: 5350.0, basePriceGross: 6580.0 },
  STANDARD_300x606: { area: 18.18, basePriceNet: 6114.0, basePriceGross: 7520.0 },
  STANDARD_300x706: { area: 21.18, basePriceNet: 7106.0, basePriceGross: 8740.0 },
  STANDARD_300x806: { area: 24.18, basePriceNet: 8577.0, basePriceGross: 10550.0 },
  STANDARD_300x906: { area: 27.18, basePriceNet: 9634.0, basePriceGross: 11850.0 },
  STANDARD_300x1006: { area: 30.18, basePriceNet: 10691.0, basePriceGross: 13150.0 },
  STANDARD_300x1106: { area: 33.18, basePriceNet: 11463.0, basePriceGross: 14100.0 },
  STANDARD_300x1206: { area: 36.18, basePriceNet: 12236.0, basePriceGross: 15050.0 },
  STANDARD_350x306: { area: 10.71, basePriceNet: 3528.0, basePriceGross: 4340.0 },
  STANDARD_350x406: { area: 14.21, basePriceNet: 4634.0, basePriceGross: 5700.0 },
  STANDARD_350x506: { area: 17.71, basePriceNet: 5772.0, basePriceGross: 7100.0 },
  STANDARD_350x606: { area: 21.21, basePriceNet: 6610.0, basePriceGross: 8130.0 },
  STANDARD_350x706: { area: 24.71, basePriceNet: 7675.0, basePriceGross: 9440.0 },
  STANDARD_350x806: { area: 28.21, basePriceNet: 9268.0, basePriceGross: 11400.0 },
  STANDARD_350x906: { area: 31.71, basePriceNet: 10407.0, basePriceGross: 12800.0 },
  STANDARD_350x1006: { area: 35.21, basePriceNet: 11545.0, basePriceGross: 14200.0 },
  STANDARD_350x1106: { area: 38.71, basePriceNet: 12382.0, basePriceGross: 15230.0 },
  STANDARD_350x1206: { area: 42.21, basePriceNet: 13220.0, basePriceGross: 16260.0 },
  STANDARD_400x306: { area: 12.24, basePriceNet: 4073.0, basePriceGross: 5010.0 },
  STANDARD_400x406: { area: 16.24, basePriceNet: 4984.0, basePriceGross: 6130.0 },
  STANDARD_400x506: { area: 20.24, basePriceNet: 6195.0, basePriceGross: 7620.0 },
  STANDARD_400x606: { area: 24.24, basePriceNet: 6789.0, basePriceGross: 8350.0 },
  STANDARD_400x706: { area: 28.24, basePriceNet: 8260.0, basePriceGross: 10160.0 },
  STANDARD_400x806: { area: 32.24, basePriceNet: 9959.0, basePriceGross: 12250.0 },
  STANDARD_400x906: { area: 36.24, basePriceNet: 11179.0, basePriceGross: 13750.0 },
  STANDARD_400x1006: { area: 40.24, basePriceNet: 12398.0, basePriceGross: 15250.0 },
  STANDARD_400x1106: { area: 44.24, basePriceNet: 12984.0, basePriceGross: 15970.0 },
  STANDARD_400x1206: { area: 48.24, basePriceNet: 13577.0, basePriceGross: 16700.0 },
  "PRO+_450x306": { area: 13.77, basePriceNet: 5870.0, basePriceGross: 7220.0 },
  "PRO+_450x406": { area: 18.27, basePriceNet: 7382.0, basePriceGross: 9080.0 },
  "PRO+_450x506": { area: 22.77, basePriceNet: 9163.0, basePriceGross: 11270.0 },
  "PRO+_450x606": { area: 27.27, basePriceNet: 10683.0, basePriceGross: 13140.0 },
  "PRO+_450x706": { area: 31.77, basePriceNet: 13138.0, basePriceGross: 16160.0 },
  "PRO+_450x806": { area: 36.27, basePriceNet: 14659.0, basePriceGross: 18030.0 },
  "PRO+_450x906": { area: 40.77, basePriceNet: 16577.0, basePriceGross: 20390.0 },
  "PRO+_450x1006": { area: 45.27, basePriceNet: 18098.0, basePriceGross: 22260.0 },
  "PRO+_450x1106": { area: 49.77, basePriceNet: 20325.0, basePriceGross: 25000.0 },
  "PRO+_450x1206": { area: 54.27, basePriceNet: 21846.0, basePriceGross: 26870.0 },
  "PRO+_500x306": { area: 15.3, basePriceNet: 6244.0, basePriceGross: 7680.0 },
  "PRO+_500x406": { area: 20.3, basePriceNet: 7878.0, basePriceGross: 9690.0 },
  "PRO+_500x506": { area: 25.3, basePriceNet: 9772.0, basePriceGross: 12020.0 },
  "PRO+_500x606": { area: 30.3, basePriceNet: 11398.0, basePriceGross: 14020.0 },
  "PRO+_500x706": { area: 35.3, basePriceNet: 14016.0, basePriceGross: 17240.0 },
  "PRO+_500x806": { area: 40.3, basePriceNet: 15642.0, basePriceGross: 19240.0 },
  "PRO+_500x906": { area: 45.3, basePriceNet: 17675.0, basePriceGross: 21740.0 },
  "PRO+_500x1006": { area: 50.3, basePriceNet: 19309.0, basePriceGross: 23750.0 },
  "PRO+_500x1106": { area: 55.3, basePriceNet: 21699.0, basePriceGross: 26690.0 },
  "PRO+_500x1206": { area: 60.3, basePriceNet: 23325.0, basePriceGross: 28690.0 },
  "PRO+_550x306": { area: 16.83, basePriceNet: 8098.0, basePriceGross: 9960.0 },
  "PRO+_550x406": { area: 22.33, basePriceNet: 10610.0, basePriceGross: 13050.0 },
  "PRO+_550x506": { area: 27.83, basePriceNet: 13528.0, basePriceGross: 16640.0 },
  "PRO+_550x606": { area: 33.33, basePriceNet: 15902.0, basePriceGross: 19560.0 },
  "PRO+_550x706": { area: 38.83, basePriceNet: 18520.0, basePriceGross: 22780.0 },
  "PRO+_550x806": { area: 44.33, basePriceNet: 21057.0, basePriceGross: 25900.0 },
  "PRO+_550x906": { area: 49.83, basePriceNet: 23943.0, basePriceGross: 29450.0 },
  "PRO+_550x1006": { area: 55.33, basePriceNet: 26398.0, basePriceGross: 32470.0 },
  "PRO+_550x1106": { area: 60.83, basePriceNet: 28927.0, basePriceGross: 35580.0 },
  "PRO+_550x1206": { area: 66.33, basePriceNet: 31358.0, basePriceGross: 38570.0 },
  "PRO+_600x306": { area: 18.36, basePriceNet: 8691.0, basePriceGross: 10690.0 },
  "PRO+_600x406": { area: 24.36, basePriceNet: 11407.0, basePriceGross: 14030.0 },
  "PRO+_600x506": { area: 30.36, basePriceNet: 14333.0, basePriceGross: 17630.0 },
  "PRO+_600x606": { area: 36.36, basePriceNet: 16976.0, basePriceGross: 20880.0 },
  "PRO+_600x706": { area: 42.36, basePriceNet: 19772.0, basePriceGross: 24320.0 },
  "PRO+_600x806": { area: 48.36, basePriceNet: 22504.0, basePriceGross: 27680.0 },
  "PRO+_600x906": { area: 54.36, basePriceNet: 25561.0, basePriceGross: 31440.0 },
  "PRO+_600x1006": { area: 60.36, basePriceNet: 28211.0, basePriceGross: 34700.0 },
  "PRO+_600x1106": { area: 66.36, basePriceNet: 30911.0, basePriceGross: 38020.0 },
  "PRO+_600x1206": { area: 72.36, basePriceNet: 33545.0, basePriceGross: 41260.0 },
};

export const STANDARD_DEPTHS = [300, 350, 400, 450, 500, 550, 600];
export const STANDARD_WIDTHS = [
  206, 306, 406, 506, 606, 706, 806, 906, 1006, 1106, 1206,
];

export function findMatchedDepth(depthCm: number): number {
  for (const d of STANDARD_DEPTHS) {
    if (depthCm <= d) return d;
  }
  return 600;
}

export function findMatchedWidth(widthCm: number): number {
  for (const w of STANDARD_WIDTHS) {
    if (widthCm <= w) return w;
  }
  return 1206;
}

export function isStandardDimension(depthCm: number, widthCm: number): boolean {
  // Wg Excela: IF(AND(C5=C5, AND(C5>=300, C5<=400, MOD(C5,50)=0), MOD(C6-6,100)=0), "STANDARD", "NIESTANDARD")
  const isDepthStd = depthCm >= 300 && depthCm <= 400 && depthCm % 50 === 0;
  const isWidthStd = (widthCm - 6) % 100 === 0;
  return isDepthStd && isWidthStd;
}

export function isOutOfRange(depthCm: number, widthCm: number): boolean {
  return depthCm > 600 || widthCm > 1206 || depthCm < 200 || widthCm < 200;
}

export function getSuggestedAssemblyRate(
  areaSqM: number,
  isStandard: boolean
): number {
  if (isStandard) {
    if (areaSqM <= 10) return 400;
    if (areaSqM <= 15) return 350;
    if (areaSqM <= 20) return 300;
    if (areaSqM <= 25) return 250;
    return 200;
  } else {
    if (areaSqM <= 10) return 450;
    if (areaSqM <= 15) return 400;
    if (areaSqM <= 20) return 350;
    if (areaSqM <= 25) return 300;
    return 250;
  }
}

export function calculateTerraceEstimate(
  input: TerraceInput
): TerraceCalculationResult {
  const depth = input.depthCm;
  const width = input.widthCm;
  const markupPercent =
    input.materialMarkupPercent !== undefined ? input.materialMarkupPercent / 100 : 0.52;
  const vatRate = (input.vatRatePercent ?? 8) / 100;

  const outOfRange = isOutOfRange(depth, width);
  const matchedDepth = findMatchedDepth(depth);
  const matchedWidth = findMatchedWidth(width);

  const series: "STANDARD" | "PRO+" = matchedDepth <= 400 ? "STANDARD" : "PRO+";
  const isStdDim = isStandardDimension(matchedDepth, matchedWidth);

  const lookupKey = `${series}_${matchedDepth}x${matchedWidth}`;
  const basePriceData = BASE_PRICE_MATRIX[lookupKey] || {
    area: (matchedDepth * matchedWidth) / 10000,
    basePriceNet: 0,
  };

  const areaSqM = (depth * width) / 10000;
  const basePriceNet = basePriceData.basePriceNet;

  const suggestedAssemblyRate = getSuggestedAssemblyRate(areaSqM, isStdDim);
  const effectiveAssemblyRate =
    input.customAssemblyRateNetPerSqM ?? suggestedAssemblyRate;
  const totalAssemblyCostNet = areaSqM * effectiveAssemblyRate;

  // 1. Poliwęglan (Polycarbonate)
  const polyMaterialCostNet = basePriceNet * (1 + markupPercent);
  const polyTotalNet = polyMaterialCostNet + totalAssemblyCostNet;
  const polyTotalGross = polyTotalNet * (1 + vatRate);
  const polyAssemblyCostKc = areaSqM * (effectiveAssemblyRate - 50); // H18 = B11 - 50
  const polyTotalCostKc = basePriceNet + polyAssemblyCostKc; // F18 = B12 + H19
  const polyProfitZ = polyTotalNet - polyTotalCostKc; // F20 = F19 - F18
  const polyMarginPercent = polyTotalCostKc > 0 ? polyProfitZ / polyTotalCostKc : 0;

  const polycarbonateResult: OptionResult = {
    title: "Poliwęglan",
    roofType: "polycarbonate",
    materialCostNet: polyMaterialCostNet,
    assemblyCostNet: totalAssemblyCostNet,
    totalNet: polyTotalNet,
    totalGross: polyTotalGross,
    pricePerSqMNet: areaSqM > 0 ? polyTotalNet / areaSqM : 0,
    pricePerSqMGross: areaSqM > 0 ? polyTotalGross / areaSqM : 0,
    costBasisKc: polyTotalCostKc,
    profitZ: polyProfitZ,
    marginPercent: polyMarginPercent * 100,
  };

  // 2. Szkło Standard (Glass Standard)
  // Formuła z Excela C12: =IF(C7="STANDARD", IF(B5<=300, B12*(1+0.44), IF(B5<=350, B12*(1+0.57), B12*(1+0.68))), IF(B5<=300, B12*(1+0.806), IF(B5<=350, B12*(1+0.996), B12*(1+1.271))))
  let glassStdMaterialBaseNet = 0;
  if (isStdDim) {
    if (matchedDepth <= 300) glassStdMaterialBaseNet = basePriceNet * (1 + 0.44);
    else if (matchedDepth <= 350) glassStdMaterialBaseNet = basePriceNet * (1 + 0.57);
    else glassStdMaterialBaseNet = basePriceNet * (1 + 0.68);
  } else {
    if (matchedDepth <= 300) glassStdMaterialBaseNet = basePriceNet * (1 + 0.806);
    else if (matchedDepth <= 350) glassStdMaterialBaseNet = basePriceNet * (1 + 0.996);
    else glassStdMaterialBaseNet = basePriceNet * (1 + 1.271);
  }

  const glassStdMaterialCostNet = glassStdMaterialBaseNet * (1 + markupPercent);
  const glassStdTotalNet = glassStdMaterialCostNet + totalAssemblyCostNet;
  const glassStdTotalGross = glassStdTotalNet * (1 + vatRate);
  const glassStdTotalCostKc = glassStdMaterialBaseNet + polyAssemblyCostKc;
  const glassStdProfitZ = glassStdTotalNet - glassStdTotalCostKc;
  const glassStdMarginPercent =
    glassStdTotalCostKc > 0 ? glassStdProfitZ / glassStdTotalCostKc : 0;

  const glassStandardResult: OptionResult = {
    title: "Szkło Standard",
    roofType: "glass_standard",
    materialCostNet: glassStdMaterialCostNet,
    assemblyCostNet: totalAssemblyCostNet,
    totalNet: glassStdTotalNet,
    totalGross: glassStdTotalGross,
    pricePerSqMNet: areaSqM > 0 ? glassStdTotalNet / areaSqM : 0,
    pricePerSqMGross: areaSqM > 0 ? glassStdTotalGross / areaSqM : 0,
    costBasisKc: glassStdTotalCostKc,
    profitZ: glassStdProfitZ,
    marginPercent: glassStdMarginPercent * 100,
    extraGlassGrossDelta: glassStdTotalGross - polyTotalGross,
  };

  // 3. Szkło Niestandard (Glass Non-Standard / Niestandardowe dopłata)
  let glassNonStdMaterialBaseNet = 0;
  if (matchedDepth <= 300) glassNonStdMaterialBaseNet = basePriceNet * (1 + 0.806);
  else if (matchedDepth <= 350) glassNonStdMaterialBaseNet = basePriceNet * (1 + 0.996);
  else glassNonStdMaterialBaseNet = basePriceNet * (1 + 1.271);

  const glassNonStdMaterialCostNet = glassNonStdMaterialBaseNet * (1 + markupPercent);
  const glassNonStdTotalNet = glassNonStdMaterialCostNet + totalAssemblyCostNet;
  const glassNonStdTotalGross = glassNonStdTotalNet * (1 + vatRate);
  const glassNonStdTotalCostKc = glassNonStdMaterialBaseNet + polyAssemblyCostKc;
  const glassNonStdProfitZ = glassNonStdTotalNet - glassNonStdTotalCostKc;
  const glassNonStdMarginPercent =
    glassNonStdTotalCostKc > 0 ? glassNonStdProfitZ / glassNonStdTotalCostKc : 0;

  const glassNonStandardResult: OptionResult = {
    title: "Szkło Niestandard",
    roofType: "glass_nonstandard",
    materialCostNet: glassNonStdMaterialCostNet,
    assemblyCostNet: totalAssemblyCostNet,
    totalNet: glassNonStdTotalNet,
    totalGross: glassNonStdTotalGross,
    pricePerSqMNet: areaSqM > 0 ? glassNonStdTotalNet / areaSqM : 0,
    pricePerSqMGross: areaSqM > 0 ? glassNonStdTotalGross / areaSqM : 0,
    costBasisKc: glassNonStdTotalCostKc,
    profitZ: glassNonStdProfitZ,
    marginPercent: glassNonStdMarginPercent * 100,
    extraGlassGrossDelta: glassNonStdTotalGross - polyTotalGross,
  };

  return {
    input: {
      depthCm: depth,
      widthCm: width,
      matchedDepthCm: matchedDepth,
      matchedWidthCm: matchedWidth,
      series,
      isStandardDimension: isStdDim,
      isOutOfRange: outOfRange,
      areaSqM,
      suggestedAssemblyRateNetPerSqM: suggestedAssemblyRate,
      effectiveAssemblyRateNetPerSqM: effectiveAssemblyRate,
      materialMarkupPercent: markupPercent * 100,
      vatRatePercent: vatRate * 100,
      lookupKey,
      basePriceNet,
    },
    options: {
      polycarbonate: polycarbonateResult,
      glassStandard: glassStandardResult,
      glassNonStandard: glassNonStandardResult,
    },
    warning: outOfRange
      ? "Uwaga: Wprowadzone wymiary przekraczają standardową matrycę cennikową (maksymalnie 600x1206 cm). Wymagana wycena indywidualna."
      : undefined,
  };
}

export function formatPLN(amount: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

export function generateOfferText(res: TerraceCalculationResult): string {
  const { input, options } = res;
  return `WSTĘPNA WYCENA ZADASZENIA ALUMINIOWEGO (GRUPA ADK)
--------------------------------------------------
Parametry zamówienia:
- Wymiary: ${input.widthCm} cm (szerokość) x ${input.depthCm} cm (głębokość)
- Powierzchnia: ${input.areaSqM.toFixed(2)} m²
- Seria konstrukcji: ${input.series} (${input.isStandardDimension ? "Wymiar Standardowy" : "Wymiar Niestandardowy"})
- Stawka montażu: ${input.effectiveAssemblyRateNetPerSqM} zł/m² netto
- Stawka VAT: ${input.vatRatePercent}%

OPCJE POKRYCIA DACHU:

1. POLIWĘGLAN (Cena z montażem):
   - Netto: ${formatPLN(options.polycarbonate.totalNet)} (${formatPLN(options.polycarbonate.pricePerSqMNet)}/m²)
   - Brutto (VAT ${input.vatRatePercent}%): ${formatPLN(options.polycarbonate.totalGross)} (${formatPLN(options.polycarbonate.pricePerSqMGross)}/m²)

2. SZKŁO HARTO STANDARD (Cena z montażem):
   - Netto: ${formatPLN(options.glassStandard.totalNet)} (${formatPLN(options.glassStandard.pricePerSqMNet)}/m²)
   - Brutto (VAT ${input.vatRatePercent}%): ${formatPLN(options.glassStandard.totalGross)} (${formatPLN(options.glassStandard.pricePerSqMGross)}/m²)
   - Dopłata względem poliwęglanu: +${formatPLN(options.glassStandard.extraGlassGrossDelta || 0)} brutto

3. SZKŁO HARTO NIESTANDARDOWE (Cena z montażem):
   - Netto: ${formatPLN(options.glassNonStandard.totalNet)} (${formatPLN(options.glassNonStandard.pricePerSqMNet)}/m²)
   - Brutto (VAT ${input.vatRatePercent}%): ${formatPLN(options.glassNonStandard.totalGross)} (${formatPLN(options.glassNonStandard.pricePerSqMGross)}/m²)

--------------------------------------------------
Podane kwoty mają charakter wstępnej wyceny i mogą ulec zmianie po dokładnym pomiarze na budowie.`;
}
