import { describe, test, expect } from "vitest";
import { calculateOrderRating, RATING_COLORS, RATING_NO_DATA_COLOR } from "../../lib/rating";

describe("calculateOrderRating", () => {
  test("returns no data state when profit or workDays is missing or zero", () => {
    expect(calculateOrderRating(undefined, undefined)).toEqual({
      dailyProfit: null,
      rating: null,
      color: RATING_NO_DATA_COLOR,
      label: "brak",
      description: "Brak danych (uzupełnij zysk i dni robocze w zleceniu)",
      percentage: 0,
    });

    expect(calculateOrderRating(5000, undefined).rating).toBeNull();
    expect(calculateOrderRating(undefined, 2).rating).toBeNull();
    expect(calculateOrderRating(5000, 0).rating).toBeNull();
    expect(calculateOrderRating(5000, -1).rating).toBeNull();
  });

  test("calculates rating 5 for daily profit >= 5000 zł/d", () => {
    // 10 000 zł / 2 dni = 5000 zł/d
    const res = calculateOrderRating(10000, 2);
    expect(res.dailyProfit).toBe(5000);
    expect(res.rating).toBe(5);
    expect(res.percentage).toBe(100);
    expect(res.color).toBe(RATING_COLORS[5]);
    expect(res.label).toBe("5/5");
    expect(res.description).toContain("Bardzo wysoki");
  });

  test("calculates rating 4 for daily profit 4000-4999 zł/d", () => {
    // 13 000 zł / 3 dni = 4333 zł/d
    const res = calculateOrderRating(13000, 3);
    expect(res.dailyProfit).toBe(4333);
    expect(res.rating).toBe(4);
    expect(res.percentage).toBe(80);
    expect(res.color).toBe(RATING_COLORS[4]);
    expect(res.label).toBe("4/5");
    expect(res.description).toContain("Wysoki");
  });

  test("calculates rating 3 for daily profit 3000-3999 zł/d", () => {
    // 3 500 zł / 1 dzień = 3500 zł/d
    const res = calculateOrderRating(3500, 1);
    expect(res.dailyProfit).toBe(3500);
    expect(res.rating).toBe(3);
    expect(res.percentage).toBe(60);
    expect(res.color).toBe(RATING_COLORS[3]);
    expect(res.label).toBe("3/5");
    expect(res.description).toContain("Dobry");
  });

  test("calculates rating 2 for daily profit 2000-2999 zł/d", () => {
    // 4 400 zł / 2 dni = 2200 zł/d
    const res = calculateOrderRating(4400, 2);
    expect(res.dailyProfit).toBe(2200);
    expect(res.rating).toBe(2);
    expect(res.percentage).toBe(40);
    expect(res.color).toBe(RATING_COLORS[2]);
    expect(res.label).toBe("2/5");
    expect(res.description).toContain("Przeciętny");
  });

  test("calculates rating 1 for daily profit 1-1999 zł/d", () => {
    // 1 500 zł / 1 dzień = 1500 zł/d
    const res1 = calculateOrderRating(1500, 1);
    expect(res1.dailyProfit).toBe(1500);
    expect(res1.rating).toBe(1);
    expect(res1.percentage).toBe(20);
    expect(res1.color).toBe(RATING_COLORS[1]);
    expect(res1.label).toBe("1/5");

    // 500 zł / 1 dzień = 500 zł/d
    const res2 = calculateOrderRating(500, 1);
    expect(res2.dailyProfit).toBe(500);
    expect(res2.rating).toBe(1);
    expect(res2.percentage).toBe(20);
  });

  test("calculates rating 0 for daily profit <= 0", () => {
    const resZero = calculateOrderRating(0, 1);
    expect(resZero.dailyProfit).toBe(0);
    expect(resZero.rating).toBe(0);
    expect(resZero.percentage).toBe(0);
    expect(resZero.color).toBe(RATING_COLORS[0]);
    expect(resZero.label).toBe("0/5");

    const resNeg = calculateOrderRating(-2000, 2);
    expect(resNeg.dailyProfit).toBe(-1000);
    expect(resNeg.rating).toBe(0);
    expect(resNeg.percentage).toBe(0);
  });
});
