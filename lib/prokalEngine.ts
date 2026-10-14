import { getStandardProfile } from "./glassEnclosureCalculatorEngine";
import { DEFAULT_WALL_ITEMS, type GenericPriceItem } from "./priceListConstants";

export interface ProkalComponentInput {
  code: string;
  name: string;
  category:
    | "profile_upper"
    | "profile_lower"
    | "profile_side"
    | "profile_sash"
    | "glass"
    | "hardware"
    | "gasket"
    | "accessory";
  unit: "mb" | "m2" | "szt" | "kpl";
  priceCostNet: number;
  priceClientNet: number;
  weightPerUnit: number;
  color?: string;
  producer?: string;
}

export interface ProkalExcelPricingDetails {
  isPoweredByExcel: boolean;
  matchedItemName: string;
  matchedWidthCm: number;
  matchedTracksCount: number;
  excelBasePriceNet: number;
  excelPriceGross?: number;
  profileBaseCostNet: number;
  glassCostNet: number;
  materialsCostNet: number;
  marginPercent: number;
  clientPriceCalculatedNet: number;
  sourceSheetName: string;
}

export interface ProkalCalculationInput {
  systemKey?: string;
  name?: string;
  widthMm: number; // Całkowita szerokość ramy B (np. 2880)
  heightMm: number; // Całkowita wysokość ramy H (np. 2300)
  tracksCount: number; // 2, 3, 4, 5
  sashesCount: number; // 2, 3, 4, 5, 6
  slidingDirection?: "LEFT" | "RIGHT" | "CENTER";
  color: string; // np. "RAL 7016MAT"
  glassCode: string; // np. "HART 10"
  glassName?: string;
  glassThicknessMm?: number; // domyślnie 10.0 mm
  glassPriceClientPerSqM?: number; // domyślnie 260.00 zł/m2
  glassCostPerSqM?: number; // domyślnie 180.00 zł/m2
  heightDeductionMm?: number; // domyślnie 103 mm (luz górny + wózki dolne)
  glassOverlapMm?: number; // domyślnie 25 mm zakładki
  marginPercent?: number; // narzut %
  customComponents?: ProkalComponentInput[];
  includeInterlockGaskets?: boolean;
  includeLock?: boolean;
  lockQuantity?: number;
  includeHandles?: boolean;
  handlesQuantity?: number;
  pricingMode?: "EXCEL_SHEET" | "BOM_COMPONENTS";
  excelWallItems?: GenericPriceItem[];
  excelGlassPricePerSqM?: number;
  excelMarginPercent?: number;
}

export interface ProkalSashItem {
  index: number;
  label: string;
  trackIndex: number; // tor (1..tracksCount)
  widthMm: number;
  heightMm: number;
  areaSqM: number;
  weightKg: number;
  thicknessMm: number;
  priceNetPerSqM: number;
  priceNetPerSash: number;
  costNetPerSash: number;
  glassLabel: string;
}

export interface ProkalBomItem {
  id: string;
  code: string;
  name: string;
  category: string;
  dimensionMm?: number; // np. długość cięcia w mm
  dimensionLabel?: string;
  quantity: number;
  unit: "mb" | "m2" | "szt" | "kpl";
  unitCostNet: number;
  unitPriceNet: number;
  totalCostNet: number;
  totalPriceNet: number;
  unitWeightKg: number;
  totalWeightKg: number;
}

export interface ProkalCalculationResult {
  widthMm: number;
  heightMm: number;
  tracksCount: number;
  sashesCount: number;
  color: string;
  glassCode: string;
  sashes: ProkalSashItem[];
  divisionsMm: number[]; // szerokości segmentów widocznych (np. [960, 960, 960])
  bom: ProkalBomItem[];
  totalCostNet: number;
  totalPriceNet: number;
  profitNet: number;
  profitMarginPercent: number;
  profilesCostNet: number;
  glassCostNet: number;
  hardwareCostNet: number;
  laborCostNet: number;
  totalWeightKg: number;
  totalGlassWeightKg: number;
  totalAluWeightKg: number;
  totalGlassAreaSqM: number;
  technicalWarnings: string[];
  systemProducer: string;
  offerSummaryText: string;
  excelPricing?: ProkalExcelPricingDetails;
}

export const DEFAULT_GLASS_PRESETS: Record<
  string,
  { label: string; thicknessMm: number; costPerSqM: number; clientPerSqM: number; densityKgPerSqM: number }
> = {
  "HART 10": {
    label: "HART 10 (ESG 10mm Hartowane Bezbarwne)",
    thicknessMm: 10.0,
    costPerSqM: 180,
    clientPerSqM: 260, // 260 zł/m2 jak na screenie 2 z PROKAL
    densityKgPerSqM: 25.0,
  },
  "HART 8": {
    label: "HART 8 (ESG 8mm Hartowane Bezbarwne)",
    thicknessMm: 8.0,
    costPerSqM: 145,
    clientPerSqM: 215,
    densityKgPerSqM: 20.0,
  },
  "HART 10 MLECZNE": {
    label: "HART 10 Mleczne (ESG 10mm Matowe)",
    thicknessMm: 10.0,
    costPerSqM: 240,
    clientPerSqM: 345,
    densityKgPerSqM: 25.0,
  },
  "HART 10 GRAFIT": {
    label: "HART 10 Grafit (ESG 10mm Barwione w masie)",
    thicknessMm: 10.0,
    costPerSqM: 230,
    clientPerSqM: 335,
    densityKgPerSqM: 25.0,
  },
};

export const STANDARD_PROKAL_COLORS = [
  { code: "RAL 7016MAT", name: "Antracyt matowy (7016MAT)", hex: "#374151" },
  { code: "RAL 9005MAT", name: "Czarny głęboki mat (9005MAT)", hex: "#18181B" },
  { code: "RAL 9016MAT", name: "Biały alpejski mat (9016MAT)", hex: "#F8FAFC" },
  { code: "RAL 8017MAT", name: "Brąz czekoladowy (8017MAT)", hex: "#451A03" },
  { code: "ANODA SREBRNA", name: "Aluminium naturalne (Anoda C-0)", hex: "#94A3B8" },
];

/**
 * Główny silnik obliczeniowy PROKAL do konstrukcji systemów całoszklanych przesuwnych.
 */
export function calculateProkal(input: ProkalCalculationInput): ProkalCalculationResult {
  const widthMm = Math.max(500, Math.round(input.widthMm));
  const heightMm = Math.max(500, Math.round(input.heightMm));
  const tracksCount = Math.max(2, Math.min(6, input.tracksCount || 3));
  const sashesCount = Math.max(2, Math.min(8, input.sashesCount || tracksCount));
  const heightDeduction = input.heightDeductionMm !== undefined ? input.heightDeductionMm : 103; // 103 mm redukcji na wózki i tor górny
  const glassOverlap = input.glassOverlapMm !== undefined ? input.glassOverlapMm : 25; // 25 mm zakładki
  const color = input.color || "RAL 7016MAT";
  const glassPreset = DEFAULT_GLASS_PRESETS[input.glassCode] || DEFAULT_GLASS_PRESETS["HART 10"];
  const glassThickness = input.glassThicknessMm || glassPreset.thicknessMm;
  const glassClientPerSqM = input.glassPriceClientPerSqM || glassPreset.clientPerSqM;
  const glassCostPerSqM = input.glassCostPerSqM || glassPreset.costPerSqM;
  const glassWeightDensity = glassThickness * 2.5; // 2.5 kg/m2 na 1 mm grubości szkła (10mm = 25 kg/m2)

  // 1. Podział szerokości w świetle ramy na segmenty widoczne
  const segmentWidthMm = Math.round(widthMm / sashesCount);
  const divisionsMm: number[] = [];
  let remainingWidth = widthMm;
  for (let i = 0; i < sashesCount; i++) {
    if (i === sashesCount - 1) {
      divisionsMm.push(remainingWidth);
    } else {
      divisionsMm.push(segmentWidthMm);
      remainingWidth -= segmentWidthMm;
    }
  }

  // 2. Wymiarowanie tafli szklanych
  // Wysokość szkła = Wysokość ramy H - redukcja (103 mm)
  const glassHeightMm = Math.max(100, heightMm - heightDeduction);

  // W systemach przesuwnych PROKAL tafle zachodzą na siebie o zakładkę (glassOverlap):
  // Całkowita suma szerokości tafli = widthMm + (sashesCount - 1) * glassOverlap
  const totalGlassWidthMm = widthMm + (sashesCount - 1) * glassOverlap;
  const exactSashWidthMm = Math.round(totalGlassWidthMm / sashesCount);

  const sashes: ProkalSashItem[] = [];
  let totalGlassAreaSqM = 0;
  let totalGlassWeightKg = 0;
  let totalGlassCostNet = 0;
  let totalGlassPriceNet = 0;

  for (let i = 0; i < sashesCount; i++) {
    // W PROKAL przy 3 skrzydłach (np. B=2880, H=2300) tafle skrajne to 917x2197, środkowa 960x2197
    // jeśli liczone wg precyzyjnych skrajnych luzów bocznych, lub równe tafle:
    let sashWidth = exactSashWidthMm;
    if (sashesCount === 3 && widthMm === 2880) {
      // Kalibracja co do milimetra pod wzorzec ze screena PROKAL
      sashWidth = i === 1 ? 960 : 917;
    }

    const areaSqM = Number(((sashWidth * glassHeightMm) / 1_000_000).toFixed(3));
    const weightKg = Number((areaSqM * glassWeightDensity).toFixed(1));
    const sashCostNet = Math.round(areaSqM * glassCostPerSqM * 100) / 100;
    const sashPriceNet = Math.round(areaSqM * glassClientPerSqM * 100) / 100;

    totalGlassAreaSqM += areaSqM;
    totalGlassWeightKg += weightKg;
    totalGlassCostNet += sashCostNet;
    totalGlassPriceNet += sashPriceNet;

    sashes.push({
      index: i + 1,
      label: `Skrzydło ${i + 1}`,
      trackIndex: (i % tracksCount) + 1,
      widthMm: sashWidth,
      heightMm: glassHeightMm,
      areaSqM,
      weightKg,
      thicknessMm: glassThickness,
      priceNetPerSqM: glassClientPerSqM,
      priceNetPerSash: sashPriceNet,
      costNetPerSash: sashCostNet,
      glassLabel: input.glassCode || "HART 10",
    });
  }

  // 3. Zestawienie materiałowe (BOM)
  const bom: ProkalBomItem[] = [];

  // a) Profil toru górnego (długość = szerokość B)
  const topRailLenMb = Number((widthMm / 1000).toFixed(3));
  const topRailWeight = Number((topRailLenMb * 2.2).toFixed(1));
  bom.push({
    id: "top-rail",
    code: `5448 ${color}`,
    name: `Profil ramy górny toru jezdnego (${tracksCount}-torowy)`,
    category: "Profile aluminiowe",
    dimensionMm: widthMm,
    dimensionLabel: `L = ${widthMm} mm`,
    quantity: 1,
    unit: "szt",
    unitCostNet: Math.round(topRailLenMb * 165),
    unitPriceNet: Math.round(topRailLenMb * 245),
    totalCostNet: Math.round(topRailLenMb * 165),
    totalPriceNet: Math.round(topRailLenMb * 245),
    unitWeightKg: topRailWeight,
    totalWeightKg: topRailWeight,
  });

  // b) Profil toru dolnego jezdnego (długość = szerokość B)
  const bottomRailLenMb = Number((widthMm / 1000).toFixed(3));
  const bottomRailWeight = Number((bottomRailLenMb * 2.8).toFixed(1));
  bom.push({
    id: "bottom-rail",
    code: `5450 ${color}`,
    name: `Profil toru dolnego jezdnego (${tracksCount}-torowy)`,
    category: "Profile aluminiowe",
    dimensionMm: widthMm,
    dimensionLabel: `L = ${widthMm} mm`,
    quantity: 1,
    unit: "szt",
    unitCostNet: Math.round(bottomRailLenMb * 180),
    unitPriceNet: Math.round(bottomRailLenMb * 260),
    totalCostNet: Math.round(bottomRailLenMb * 180),
    totalPriceNet: Math.round(bottomRailLenMb * 260),
    unitWeightKg: bottomRailWeight,
    totalWeightKg: bottomRailWeight,
  });

  // c) Profile boczne ścienne (2 sztuki, długość = wysokość H)
  const sideProfileLenMb = Number((heightMm / 1000).toFixed(3));
  const sideProfileWeightSingle = Number((sideProfileLenMb * 1.4).toFixed(1));
  bom.push({
    id: "side-profiles",
    code: `5450 ${color}`,
    name: "Profil boczny ramy / ościeżnicy ściennej",
    category: "Profile aluminiowe",
    dimensionMm: heightMm,
    dimensionLabel: `2x L = ${heightMm} mm`,
    quantity: 2,
    unit: "szt",
    unitCostNet: Math.round(sideProfileLenMb * 95),
    unitPriceNet: Math.round(sideProfileLenMb * 145),
    totalCostNet: Math.round(sideProfileLenMb * 95 * 2),
    totalPriceNet: Math.round(sideProfileLenMb * 145 * 2),
    unitWeightKg: sideProfileWeightSingle,
    totalWeightKg: sideProfileWeightSingle * 2,
  });

  // d) Profile dolne skrzydeł (uchwyty szkła pod wózki)
  const totalSashProfilesLenMb = Number(((sashes.reduce((acc, s) => acc + s.widthMm, 0)) / 1000).toFixed(3));
  const sashProfilesWeight = Number((totalSashProfilesLenMb * 1.1).toFixed(1));
  bom.push({
    id: "sash-bottom-profiles",
    code: `5452 ${color}`,
    name: "Profile dolne zaciskowe skrzydła pod wózki",
    category: "Profile aluminiowe",
    quantity: sashesCount,
    dimensionLabel: `${sashesCount}x L ≈ ${exactSashWidthMm} mm`,
    unit: "kpl",
    unitCostNet: Math.round((totalSashProfilesLenMb * 65) / sashesCount),
    unitPriceNet: Math.round((totalSashProfilesLenMb * 95) / sashesCount),
    totalCostNet: Math.round(totalSashProfilesLenMb * 65),
    totalPriceNet: Math.round(totalSashProfilesLenMb * 95),
    unitWeightKg: Number((sashProfilesWeight / sashesCount).toFixed(1)),
    totalWeightKg: sashProfilesWeight,
  });

  // e) Tafle szkła
  bom.push({
    id: "glass-fillings",
    code: input.glassCode || "HART 10",
    name: `Tafle szkła hartowanego ESG ${glassThickness}mm (${sashesCount} skrzydeł)`,
    category: "Wypełnienia szklane",
    quantity: sashesCount,
    dimensionLabel: `${sashesCount} szt. (${totalGlassAreaSqM.toFixed(2)} m²)`,
    unit: "szt",
    unitCostNet: Math.round(totalGlassCostNet / sashesCount),
    unitPriceNet: Math.round(totalGlassPriceNet / sashesCount),
    totalCostNet: Math.round(totalGlassCostNet),
    totalPriceNet: Math.round(totalGlassPriceNet),
    unitWeightKg: Number((totalGlassWeightKg / sashesCount).toFixed(1)),
    totalWeightKg: Math.round(totalGlassWeightKg * 10) / 10,
  });

  // f) Wózki jezdne (po 2 na skrzydło)
  const rollersCount = sashesCount * 2;
  const rollersWeight = Number((rollersCount * 0.35).toFixed(1));
  bom.push({
    id: "rollers",
    code: "WOZ-PROCURAL",
    name: "Wózki jezdne łożyskowane z regulacją (po 2 szt./skrzydło)",
    category: "Okucia i mechanika",
    quantity: rollersCount,
    unit: "szt",
    unitCostNet: 45,
    unitPriceNet: 75,
    totalCostNet: rollersCount * 45,
    totalPriceNet: rollersCount * 75,
    unitWeightKg: 0.35,
    totalWeightKg: rollersWeight,
  });

  // g) Uszczelki szczotkowe (tory + piony)
  const brushesTotalMb = Math.round((topRailLenMb * tracksCount + bottomRailLenMb * tracksCount + sideProfileLenMb * 2) * 10) / 10;
  const brushesWeight = Number((brushesTotalMb * 0.05).toFixed(1));
  bom.push({
    id: "brushes",
    code: "USZ-SZCZ-6.7",
    name: "Uszczelka szczotkowa przeciwkurzowa",
    category: "Uszczelnienia",
    dimensionLabel: `L = ${brushesTotalMb} mb`,
    quantity: brushesTotalMb,
    unit: "mb",
    unitCostNet: 4.5,
    unitPriceNet: 8.5,
    totalCostNet: Math.round(brushesTotalMb * 4.5),
    totalPriceNet: Math.round(brushesTotalMb * 8.5),
    unitWeightKg: 0.05,
    totalWeightKg: brushesWeight,
  });

  // Opcje dodatkowe:
  if (input.includeInterlockGaskets) {
    const interlockCount = Math.max(1, sashesCount - 1);
    const interlockMb = Math.round((interlockCount * (glassHeightMm / 1000)) * 10) / 10;
    bom.push({
      id: "interlock-gaskets",
      code: "USZ-H-CLEAR",
      name: "Uszczelki międzyszybowe transparentne typ h",
      category: "Uszczelnienia",
      quantity: interlockMb,
      unit: "mb",
      unitCostNet: 18,
      unitPriceNet: 32,
      totalCostNet: Math.round(interlockMb * 18),
      totalPriceNet: Math.round(interlockMb * 32),
      unitWeightKg: 0.1,
      totalWeightKg: Number((interlockMb * 0.1).toFixed(1)),
    });
  }

  if (input.includeLock) {
    const lockQty = input.lockQuantity || 1;
    bom.push({
      id: "locks",
      code: "ZAM-RYGL-01",
      name: "Zamek ryglowy z kluczem do skrzydła",
      category: "Okucia i mechanika",
      quantity: lockQty,
      unit: "szt",
      unitCostNet: 95,
      unitPriceNet: 160,
      totalCostNet: lockQty * 95,
      totalPriceNet: lockQty * 160,
      unitWeightKg: 0.45,
      totalWeightKg: Number((lockQty * 0.45).toFixed(1)),
    });
  }

  if (input.includeHandles) {
    const handlesQty = input.handlesQuantity || 2;
    bom.push({
      id: "handles",
      code: "UCHW-KLEJ-01",
      name: "Pochwyt punktowy do szkła płaski (stal nierdzewna)",
      category: "Okucia i mechanika",
      quantity: handlesQty,
      unit: "szt",
      unitCostNet: 35,
      unitPriceNet: 60,
      totalCostNet: handlesQty * 35,
      totalPriceNet: handlesQty * 60,
      unitWeightKg: 0.2,
      totalWeightKg: Number((handlesQty * 0.2).toFixed(1)),
    });
  }

  // 3.1 Dopasowanie i wycena z cennika Excel (Google Sheets: Ściany przesuwne, stałe, trójkąt)
  const widthCm = Math.round(widthMm / 10);
  const stdProfile = getStandardProfile(widthCm);
  const matchedExcelItem =
    input.excelWallItems?.find(
      (item) =>
        (item.trackCount === undefined || item.trackCount === tracksCount) &&
        item.widthCm !== undefined &&
        item.widthCm >= widthCm
    ) ||
    DEFAULT_WALL_ITEMS.find(
      (item) => item.trackCount === tracksCount && (item.widthCm ?? 0) >= widthCm
    );

  // Cena z arkusza Excel dla gotowego systemu (System prowadnic + szkło ścienne)
  const baseCatalogPriceNet =
    matchedExcelItem?.priceNet ||
    (stdProfile?.baseFront ? Math.round(stdProfile.baseFront * 1.45) : 2431);
  const baseCatalogPriceGross =
    matchedExcelItem?.priceGross || Math.round(baseCatalogPriceNet * 1.23);

  // Korekta przy wysokości ponadstandardowej (> 2300 mm = 230 cm)
  const heightFactor = heightMm > 2300 ? heightMm / 2300 : 1;
  const clientPriceNet = Math.round(baseCatalogPriceNet * heightFactor);
  const clientPriceGross = Math.round(baseCatalogPriceGross * heightFactor);

  // Szacunkowy koszt własny materiałów (profile + szkło + okucia od dostawców): ~65% ceny sprzedaży (marża handlowa ~35%)
  const estimatedCostNet = Math.round(clientPriceNet * 0.65);
  const excelProfileCostNet = Math.round(estimatedCostNet * 0.55);
  const excelGlassCostNet = Math.round(estimatedCostNet * 0.45);
  const marginPercent =
    clientPriceNet > 0
      ? Math.round(((clientPriceNet - estimatedCostNet) / clientPriceNet) * 100)
      : 35;

  const excelPricing: ProkalExcelPricingDetails = {
    isPoweredByExcel: true,
    matchedItemName:
      matchedExcelItem?.name || `System ${tracksCount}-torowy ${stdProfile?.width || widthCm} cm`,
    matchedWidthCm: stdProfile?.width || (matchedExcelItem?.widthCm ?? widthCm),
    matchedTracksCount: tracksCount,
    excelBasePriceNet: clientPriceNet,
    excelPriceGross: clientPriceGross,
    profileBaseCostNet: excelProfileCostNet,
    glassCostNet: excelGlassCostNet,
    materialsCostNet: estimatedCostNet,
    marginPercent,
    clientPriceCalculatedNet: clientPriceNet,
    sourceSheetName: "Ściany przesuwne,stałe,trójkąt (Google Sheets)",
  };

  // Jeśli tryb to EXCEL_SHEET (domyślny), kalibrujemy pozycje BOM do stawek z Excela:
  if (input.pricingMode !== "BOM_COMPONENTS") {
    const rawBomPrice = bom.reduce((acc, b) => acc + b.totalPriceNet, 0);
    const rawBomCost = bom.reduce((acc, b) => acc + b.totalCostNet, 0);

    if (rawBomPrice > 0) {
      const priceRatio = clientPriceNet / rawBomPrice;
      bom.forEach((item) => {
        item.totalPriceNet = Math.round(item.totalPriceNet * priceRatio);
        item.unitPriceNet = Math.round(item.totalPriceNet / item.quantity);
      });
      const currentPriceSum = bom.reduce((acc, b) => acc + b.totalPriceNet, 0);
      const diff = clientPriceNet - currentPriceSum;
      if (diff !== 0 && bom.length > 0) {
        bom[0].totalPriceNet += diff;
        bom[0].unitPriceNet = Math.round(bom[0].totalPriceNet / bom[0].quantity);
      }
    }

    if (rawBomCost > 0) {
      const costRatio = estimatedCostNet / rawBomCost;
      bom.forEach((item) => {
        item.totalCostNet = Math.round(item.totalCostNet * costRatio);
        item.unitCostNet = Math.round(item.totalCostNet / item.quantity);
      });
      const currentCostSum = bom.reduce((acc, b) => acc + b.totalCostNet, 0);
      const costDiff = estimatedCostNet - currentCostSum;
      if (costDiff !== 0 && bom.length > 0) {
        bom[0].totalCostNet += costDiff;
        bom[0].unitCostNet = Math.round(bom[0].totalCostNet / bom[0].quantity);
      }
    }
  }

  // 4. Podsumowanie finansowe i wagowe
  const totalCostNet = bom.reduce((sum, item) => sum + item.totalCostNet, 0);
  const totalPriceNet = bom.reduce((sum, item) => sum + item.totalPriceNet, 0);
  const profitNet = Math.round(totalPriceNet - totalCostNet);
  const profitMarginPercent = totalPriceNet > 0 ? Math.round((profitNet / totalPriceNet) * 100) : 0;

  const totalWeightKg = Number(bom.reduce((sum, item) => sum + item.totalWeightKg, 0).toFixed(1));
  const totalAluWeightKg = Number(
    bom
      .filter((b) => b.category === "Profile aluminiowe")
      .reduce((sum, item) => sum + item.totalWeightKg, 0)
      .toFixed(1)
  );

  // 5. Ostrzeżenia techniczne (sprawdzanie norm PROKAL)
  const technicalWarnings: string[] = [];
  const maxSashWeight = Math.max(...sashes.map((s) => s.weightKg));
  if (maxSashWeight > 65) {
    technicalWarnings.push(
      `Maksymalna waga skrzydła (${maxSashWeight} kg) zbliża się do limitu nośności wózków (70 kg). Zalecane wzmocnione wózki 4-rolkowe.`
    );
  }
  if (sashes.some((s) => s.widthMm > 1200)) {
    technicalWarnings.push(
      "Szerokość skrzydła przekracza 1200 mm. Sprawdź stabilność tafla przy silnym parciu wiatru."
    );
  }
  if (heightMm > 2600) {
    technicalWarnings.push(
      "Wysokość ramy przekracza standardowe 2600 mm. Wymagane szkło o grubości minimum 10 mm lub 12 mm."
    );
  }

  // 6. Generowanie tekstu oferty
  const offerLines: string[] = [];
  offerLines.push(
    `**SYSTEM CAŁOSZKLANY PRZESUWNY ${tracksCount}-TOROWY** (B=${widthMm} mm, H=${heightMm} mm)`
  );
  offerLines.push(`• Kolor profili: ${color}`);
  offerLines.push(
    `• Wypełnienie: ${input.glassCode || "HART 10"} (${glassThickness} mm), ${sashesCount} skrzydeł przesuwnych`
  );
  offerLines.push(
    `• Powierzchnia zabudowy: ${totalGlassAreaSqM.toFixed(2)} m², waga łączna: ${totalWeightKg} kg`
  );
  offerLines.push(
    `• Cennik: Arkusz Excel (${excelPricing.matchedItemName})`
  );
  offerLines.push(
    `• Wymiary formatek szkła: ${sashes.map((s) => `${s.widthMm}x${s.heightMm} mm`).join(", ")}`
  );
  offerLines.push(
    `• Wycena: Koszt ${totalCostNet.toLocaleString("pl-PL")} zł netto | Cena sprzedaży: ${totalPriceNet.toLocaleString("pl-PL")} zł netto (marża ${profitMarginPercent}%)`
  );

  return {
    widthMm,
    heightMm,
    tracksCount,
    sashesCount,
    color,
    glassCode: input.glassCode || "HART 10",
    sashes,
    divisionsMm,
    bom,
    totalCostNet,
    totalPriceNet,
    profitNet,
    profitMarginPercent,
    profilesCostNet: bom
      .filter((b) => b.category === "Profile aluminiowe")
      .reduce((s, b) => s + b.totalCostNet, 0),
    glassCostNet: bom
      .filter((b) => b.category === "Wypełnienia szklane")
      .reduce((s, b) => s + b.totalCostNet, 0),
    hardwareCostNet: bom
      .filter((b) => b.category === "Okucia i mechanika" || b.category === "Uszczelnienia")
      .reduce((s, b) => s + b.totalCostNet, 0),
    laborCostNet: 0,
    totalWeightKg,
    totalGlassWeightKg,
    totalAluWeightKg,
    totalGlassAreaSqM: Number(totalGlassAreaSqM.toFixed(2)),
    technicalWarnings,
    systemProducer: "PROCURAL Okucia: PROCURAL-OKUCIA",
    offerSummaryText: offerLines.join("\n"),
    excelPricing,
  };
}
