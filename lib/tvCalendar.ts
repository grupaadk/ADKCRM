export type TvEventCategory = "montaz" | "serwis" | "dostawa" | "inne";

export interface TvMonthDescriptor {
  year: number;
  month: number; // 0-11
  label: string;
  startMs: number;
  endMs: number;
}

export interface TvDayCell {
  date: Date;
  dateKey: string;
  dayNumber: number;
  inMonth: boolean;
  isWeekend: boolean;
}

export const TV_MONTH_NAMES = [
  "Styczeń",
  "Luty",
  "Marzec",
  "Kwiecień",
  "Maj",
  "Czerwiec",
  "Lipiec",
  "Sierpień",
  "Wrzesień",
  "Październik",
  "Listopad",
  "Grudzień",
] as const;

export const TV_WEEKDAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "So"] as const;

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Zwraca 4 kolejne miesiące (siatka 2x2) zaczynając od (baseYear, baseMonth).
 */
export function getQuarterMonths(baseYear: number, baseMonth: number): TvMonthDescriptor[] {
  const months: TvMonthDescriptor[] = [];
  for (let offset = 0; offset < 4; offset++) {
    const d = new Date(baseYear, baseMonth + offset, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const startMs = new Date(y, m, 1, 0, 0, 0, 0).getTime();
    const endMs = new Date(y, m + 1, 0, 23, 59, 59, 999).getTime();
    months.push({
      year: y,
      month: m,
      label: `${TV_MONTH_NAMES[m]} ${y}`,
      startMs,
      endMs,
    });
  }
  return months;
}

/**
 * Zwraca siatkę dni miesiąca od poniedziałku do soboty (bez niedziel, po 6 dni w wierszu).
 */
export function getMonthGridDays(year: number, month: number): TvDayCell[] {
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);

  // Jeśli 1. dzień miesiąca to niedziela (ukryta), pierwszy widoczny dzień to 2. (poniedziałek)
  const firstVisibleDayNum = firstOfMonth.getDay() === 0 ? 2 : 1;
  const firstVisibleDate = new Date(year, month, firstVisibleDayNum);

  const lastVisibleDayNum =
    lastOfMonth.getDay() === 0 ? lastOfMonth.getDate() - 1 : lastOfMonth.getDate();

  // Przesunięcie od poniedziałku (0 = Pn ... 5 = So)
  const startOffset = (firstVisibleDate.getDay() + 6) % 7;
  const firstMondayDayNum = firstVisibleDayNum - startOffset;
  const calendarSpanDays = startOffset + (lastVisibleDayNum - firstVisibleDayNum + 1);
  const weeksCount = Math.ceil(calendarSpanDays / 7);

  const cells: TvDayCell[] = [];
  for (let week = 0; week < weeksCount; week++) {
    for (let dayOfWeek = 0; dayOfWeek < 6; dayOfWeek++) {
      const date = new Date(year, month, firstMondayDayNum + week * 7 + dayOfWeek);
      const weekday = date.getDay();
      cells.push({
        date,
        dateKey: formatDateKey(date),
        dayNumber: date.getDate(),
        inMonth: date.getMonth() === month,
        isWeekend: weekday === 6,
      });
    }
  }
  return cells;
}

/**
 * Rozwija zakres dat wydarzenia na poszczególne klucze YYYY-MM-DD (lokalny czas).
 */
export function expandEventToDateKeys(
  startMs: number,
  endMs?: number,
  clampStartMs?: number,
  clampEndMs?: number,
): string[] {
  const effectiveStart = clampStartMs !== undefined ? Math.max(startMs, clampStartMs) : startMs;
  const rawEnd = endMs && endMs >= startMs ? endMs : startMs;
  const effectiveEnd = clampEndMs !== undefined ? Math.min(rawEnd, clampEndMs) : rawEnd;

  if (effectiveEnd < effectiveStart) return [];

  const startDate = new Date(effectiveStart);
  const endDate = new Date(effectiveEnd);

  // Jeśli koniec przypada dokładnie o 00:00:00 kolejnego dnia i trwa > 0ms (typowe allDay exclusive end),
  // traktujemy ostatni dzień jako dzień poprzedni, o ile to nie jest ten sam dzień.
  const endAdjusted = new Date(endDate);
  if (
    endMs &&
    endMs > startMs &&
    endAdjusted.getHours() === 0 &&
    endAdjusted.getMinutes() === 0 &&
    endAdjusted.getSeconds() === 0 &&
    endAdjusted.getMilliseconds() === 0 &&
    formatDateKey(endAdjusted) !== formatDateKey(startDate)
  ) {
    endAdjusted.setDate(endAdjusted.getDate() - 1);
  }

  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const limit = new Date(endAdjusted.getFullYear(), endAdjusted.getMonth(), endAdjusted.getDate());

  const keys: string[] = [];
  let guard = 0;
  while (cursor <= limit && guard < 180) {
    keys.push(formatDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
    guard++;
  }
  return keys;
}

export function classifyTvEventCategory(params: {
  field?: string;
  eventTypeName?: string;
  supplierId?: string;
  installationTeamId?: string;
}): TvEventCategory {
  const field = params.field ?? "";
  const name = (params.eventTypeName ?? "").toLowerCase();

  if (
    field === "complaintServiceDate" ||
    name.includes("serwis") ||
    name.includes("reklamacj")
  ) {
    return "serwis";
  }
  if (
    field === "deliveryDate" ||
    Boolean(params.supplierId) ||
    name.includes("dostaw")
  ) {
    return "dostawa";
  }
  if (
    field === "projectEndDate" ||
    Boolean(params.installationTeamId) ||
    name.includes("monta") ||
    name.includes("ekip")
  ) {
    return "montaz";
  }
  return "inne";
}

/**
 * Przesuwa wydarzenie na nowy dzień (targetDateKey: YYYY-MM-DD),
 * zachowując oryginalną godzinę startu oraz całkowity czas trwania.
 */
export function shiftEventDatesToDay(
  startMs: number,
  endMs: number | undefined,
  targetDateKey: string,
): { newStart: number; newEnd?: number } {
  const [yStr, mStr, dStr] = targetDateKey.split("-");
  const targetYear = Number(yStr);
  const targetMonth = Number(mStr) - 1;
  const targetDay = Number(dStr);

  const origStart = new Date(startMs);
  const shiftedStart = new Date(
    targetYear,
    targetMonth,
    targetDay,
    origStart.getHours(),
    origStart.getMinutes(),
    origStart.getSeconds(),
    origStart.getMilliseconds(),
  );
  const newStart = shiftedStart.getTime();

  if (endMs === undefined) {
    return { newStart };
  }

  const duration = endMs - startMs;
  return {
    newStart,
    newEnd: newStart + duration,
  };
}
