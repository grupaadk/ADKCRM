import { describe, expect, test } from "vitest";
import {
  classifyTvEventCategory,
  expandEventToDateKeys,
  getMonthGridDays,
  getQuarterMonths,
} from "../../lib/tvCalendar";

describe("TV Quarterly Calendar helpers (lib/tvCalendar)", () => {
  test("getQuarterMonths returns 4 consecutive months including year rollover", () => {
    const months = getQuarterMonths(2026, 10); // Listopad 2026 (0-indexed: 10)
    expect(months).toHaveLength(4);
    expect(months.map((m) => `${m.year}-${m.month}`)).toEqual([
      "2026-10",
      "2026-11",
      "2027-0",
      "2027-1",
    ]);
    expect(months[0].label).toBe("Listopad 2026");
    expect(months[2].label).toBe("Styczeń 2027");
    expect(months[0].startMs).toBeLessThan(months[0].endMs);
  });

  test("getMonthGridDays builds Monday-first grid with 35 or 42 cells", () => {
    const days = getMonthGridDays(2026, 10); // Listopad 2026 (1.11.2026 to niedziela -> offset 6)
    expect(days.length === 35 || days.length === 42).toBe(true);
    expect(days[0].date.getDay()).toBe(1); // Poniedziałek
    expect(days[days.length - 1].date.getDay()).toBe(0); // Niedziela

    const inMonthDays = days.filter((d) => d.inMonth);
    expect(inMonthDays).toHaveLength(30);
    expect(inMonthDays[0].dateKey).toBe("2026-11-01");
    expect(inMonthDays[0].isWeekend).toBe(true);
  });

  test("expandEventToDateKeys expands multi-day events and handles midnight exclusive end", () => {
    const start = new Date(2026, 10, 10, 8, 0).getTime();
    const endTimed = new Date(2026, 10, 12, 16, 0).getTime();
    expect(expandEventToDateKeys(start, endTimed)).toEqual([
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
    ]);

    const allDayStart = new Date(2026, 10, 10, 0, 0, 0, 0).getTime();
    const allDayExclusiveEnd = new Date(2026, 10, 12, 0, 0, 0, 0).getTime();
    expect(expandEventToDateKeys(allDayStart, allDayExclusiveEnd)).toEqual([
      "2026-11-10",
      "2026-11-11",
    ]);
  });

  test("classifyTvEventCategory maps montaz, serwis, dostawa, and inne", () => {
    expect(classifyTvEventCategory({ field: "projectEndDate" })).toBe("montaz");
    expect(classifyTvEventCategory({ installationTeamId: "team1" })).toBe("montaz");
    expect(classifyTvEventCategory({ field: "complaintServiceDate" })).toBe("serwis");
    expect(classifyTvEventCategory({ eventTypeName: "Serwis gwarancyjny" })).toBe("serwis");
    expect(classifyTvEventCategory({ field: "deliveryDate" })).toBe("dostawa");
    expect(classifyTvEventCategory({ supplierId: "sup1" })).toBe("dostawa");
    expect(classifyTvEventCategory({ eventTypeName: "Spotkanie biurowe" })).toBe("inne");
  });
});
