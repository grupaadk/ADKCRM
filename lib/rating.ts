export const RATING_COLORS: Record<number, string> = {
  5: "#10b981", // Zieleń dla najlepszego ratingu 5 (≥ 5k zł/d)
  4: "#84cc16", // Jasna zieleń / limonka dla 4 (≥ 4k zł/d)
  3: "#3b82f6", // Niebieski dla 3 (≥ 3k zł/d)
  2: "#f97316", // Pomarańczowy dla 2 (≥ 2k zł/d)
  1: "#ef4444", // Czerwony dla 1 (≥ 1k zł/d lub > 0)
  0: "#94a3b8", // Szary dla 0 (<= 0 zł/d)
};

export const RATING_NO_DATA_COLOR = "#cbd5e1";

export interface OrderRatingResult {
  dailyProfit: number | null;
  rating: number | null;
  color: string;
  label: string;
  description: string;
  percentage: number;
}

/**
 * Oblicza dzienny zysk (profit / workDays) oraz przypisuje rating 0-5.
 */
export function calculateOrderRating(profit?: number | null, workDays?: number | null): OrderRatingResult {
  const dailyProfit =
    profit !== undefined && profit !== null && workDays !== undefined && workDays !== null && workDays > 0
      ? Math.round(profit / workDays)
      : null;

  if (dailyProfit === null) {
    return {
      dailyProfit: null,
      rating: null,
      color: RATING_NO_DATA_COLOR,
      label: "brak",
      description: "Brak danych (uzupełnij zysk i dni robocze w zleceniu)",
      percentage: 0,
    };
  }

  let rating = 0;
  let description = "< 1k zł/d (Brak zysku)";

  if (dailyProfit >= 5000) {
    rating = 5;
    description = "≥ 5k zł/d (Bardzo wysoki)";
  } else if (dailyProfit >= 4000) {
    rating = 4;
    description = "≥ 4k zł/d (Wysoki)";
  } else if (dailyProfit >= 3000) {
    rating = 3;
    description = "≥ 3k zł/d (Dobry)";
  } else if (dailyProfit >= 2000) {
    rating = 2;
    description = "≥ 2k zł/d (Przeciętny)";
  } else if (dailyProfit >= 1000) {
    rating = 1;
    description = "≥ 1k zł/d (Niski)";
  } else if (dailyProfit > 0) {
    rating = 1;
    description = "> 0 zł/d (Niski)";
  } else {
    rating = 0;
    description = "≤ 0 zł/d (Brak zysku)";
  }

  const color = RATING_COLORS[rating] ?? RATING_COLORS[0];
  const percentage = Math.min(100, Math.max(0, (rating / 5) * 100));

  return {
    dailyProfit,
    rating,
    color,
    label: `${rating}/5`,
    description: `${dailyProfit.toLocaleString("pl-PL")} zł/d — ${description}`,
    percentage,
  };
}
