/**
 * Moduł obsługi warunków cenowych wg wymiaru B (zakresy szerokości / tory)
 * dla konstrukcji szablonowych (np. trójkąty pod krokwie tarasu).
 */

export interface PricingRangeItem {
  id?: string;
  label?: string; // np. "System 2-torowy 194 cm"
  minWidthMm: number; // np. 0 lub 1941
  maxWidthMm: number; // np. 1940 lub 2410
  costNet?: number; // koszt materiału netto (np. 854)
  priceNet: number; // cena materiału netto po narzucie (np. 1298 przy 52% narzutu)
}

/**
 * Oblicza cenę materiału na podstawie kosztu i zadanego narzutu
 */
export function computeRangePrice(
  costNet: number,
  markupType?: "percent" | "amount",
  markupValue?: number
): number {
  if (costNet <= 0) return 0;
  if (!markupValue || markupValue <= 0) return costNet;
  if (markupType === "percent") {
    return Math.round(costNet * (1 + markupValue / 100));
  }
  return Math.round(costNet + markupValue);
}

/**
 * 9 domyślnych progów dla trójkątów tarasowych lewych i prawych wg Excela
 * Koszt materiału: kolumna F Excela (wiersze 43-51)
 * Cena z narzutem: koszt * (1 + 52% narzutu)
 */
export const DEFAULT_TRIANGLE_PRICING_RANGES: PricingRangeItem[] = [
  { minWidthMm: 0, maxWidthMm: 1940, costNet: 854, priceNet: 1298, label: "System 2-torowy 194 cm" },
  { minWidthMm: 1941, maxWidthMm: 2410, costNet: 854, priceNet: 1298, label: "System 3-torowy 241 cm" },
  { minWidthMm: 2411, maxWidthMm: 2900, costNet: 854, priceNet: 1298, label: "System 3-torowy 290 cm" },
  { minWidthMm: 2901, maxWidthMm: 3370, costNet: 1016, priceNet: 1544, label: "System 4-torowy 337 cm" },
  { minWidthMm: 3371, maxWidthMm: 3860, costNet: 1179, priceNet: 1792, label: "System 4-torowy 386 cm" },
  { minWidthMm: 3861, maxWidthMm: 4330, costNet: 1463, priceNet: 2224, label: "System 5-torowy 433 cm" },
  { minWidthMm: 4331, maxWidthMm: 4820, costNet: 1707, priceNet: 2595, label: "System 5-torowy 482 cm" },
  { minWidthMm: 4821, maxWidthMm: 5290, costNet: 2439, priceNet: 3707, label: "System 6-torowy 529 cm" },
  { minWidthMm: 5291, maxWidthMm: 5780, costNet: 2683, priceNet: 4078, label: "System 6-torowy 578 cm" },
];

/**
 * Dopasowuje odpowiedni próg cenowy dla podanej szerokości B (w mm).
 * Jeśli szerokość wykracza poza zakresy, zwraca skrajny (najbliższy) próg.
 */
export function matchPricingRange(
  ranges?: PricingRangeItem[] | null,
  widthMm?: number
): PricingRangeItem | null {
  if (!ranges || ranges.length === 0 || typeof widthMm !== "number") return null;

  const sorted = [...ranges].sort((a, b) => a.minWidthMm - b.minWidthMm);
  const matched = sorted.find((r) => widthMm >= r.minWidthMm && widthMm <= r.maxWidthMm);
  if (matched) return matched;

  if (widthMm < sorted[0].minWidthMm) return sorted[0];
  if (widthMm > sorted[sorted.length - 1].maxWidthMm) return sorted[sorted.length - 1];

  return null;
}
