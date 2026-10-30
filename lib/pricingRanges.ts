/**
 * Moduł obsługi warunków cenowych wg wymiaru B (zakresy szerokości / tory)
 * dla konstrukcji szablonowych (np. trójkąty pod krokwie tarasu).
 */

export interface PricingRangeItem {
  id?: string;
  label?: string; // np. "System 2-torowy 194 cm"
  minWidthMm: number; // np. 0 lub 1941
  maxWidthMm: number; // np. 1940 lub 2410
  priceNet: number; // cena netto (np. 854)
  costNet?: number; // koszt netto (opcjonalny)
}

/**
 * 9 domyślnych progów dla trójkątów tarasowych lewych i prawych wg Excela
 */
export const DEFAULT_TRIANGLE_PRICING_RANGES: PricingRangeItem[] = [
  { minWidthMm: 0, maxWidthMm: 1940, priceNet: 854, costNet: 854, label: "System 2-torowy 194 cm" },
  { minWidthMm: 1941, maxWidthMm: 2410, priceNet: 854, costNet: 854, label: "System 3-torowy 241 cm" },
  { minWidthMm: 2411, maxWidthMm: 2900, priceNet: 854, costNet: 854, label: "System 3-torowy 290 cm" },
  { minWidthMm: 2901, maxWidthMm: 3370, priceNet: 1016, costNet: 1016, label: "System 4-torowy 337 cm" },
  { minWidthMm: 3371, maxWidthMm: 3860, priceNet: 1179, costNet: 1179, label: "System 4-torowy 386 cm" },
  { minWidthMm: 3861, maxWidthMm: 4330, priceNet: 1463, costNet: 1463, label: "System 5-torowy 433 cm" },
  { minWidthMm: 4331, maxWidthMm: 4820, priceNet: 1707, costNet: 1707, label: "System 5-torowy 482 cm" },
  { minWidthMm: 4821, maxWidthMm: 5290, priceNet: 2439, costNet: 2439, label: "System 6-torowy 529 cm" },
  { minWidthMm: 5291, maxWidthMm: 5780, priceNet: 2683, costNet: 2683, label: "System 6-torowy 578 cm" },
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
