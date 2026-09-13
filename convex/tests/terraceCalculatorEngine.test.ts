/// <reference types="vite/client" />
import { expect, test, describe } from "vitest";
import {
  calculateTerraceEstimate,
  findMatchedDepth,
  findMatchedWidth,
  isStandardDimension,
} from "../../lib/terraceCalculatorEngine";

describe("terraceCalculatorEngine", () => {
  test("calculates exact values for 550x1106 from Excel", () => {
    const res = calculateTerraceEstimate({
      depthCm: 550,
      widthCm: 1106,
      materialMarkupPercent: 52,
      vatRatePercent: 8,
    });

    expect(res.input.matchedDepthCm).toBe(550);
    expect(res.input.matchedWidthCm).toBe(1106);
    expect(res.input.series).toBe("PRO+");
    expect(res.input.isStandardDimension).toBe(false);
    expect(res.input.areaSqM).toBeCloseTo(60.83, 2);
    expect(res.input.basePriceNet).toBe(28927);
    expect(res.input.suggestedAssemblyRateNetPerSqM).toBe(250);

    // Poliwęglan
    expect(res.options.polycarbonate.materialCostNet).toBeCloseTo(43969.04, 1);
    expect(res.options.polycarbonate.assemblyCostNet).toBeCloseTo(15207.5, 1);
    expect(res.options.polycarbonate.totalNet).toBeCloseTo(59176.54, 1);
    expect(res.options.polycarbonate.totalGross).toBeCloseTo(63910.66, 1);

    // Szkło Standard (Niestandardowy wymiar)
    expect(res.options.glassStandard.totalNet).toBeCloseTo(115061.19, 1);
  });

  test("calculates exact Glass Standard net value (25 729 zł) for 350x706 from Excel", () => {
    const res = calculateTerraceEstimate({
      depthCm: 350,
      widthCm: 706,
      materialMarkupPercent: 52,
      vatRatePercent: 8,
    });

    expect(res.input.matchedDepthCm).toBe(350);
    expect(res.input.matchedWidthCm).toBe(706);
    expect(res.input.isStandardDimension).toBe(true);
    expect(res.input.areaSqM).toBeCloseTo(24.71, 2);
    expect(res.input.basePriceNet).toBe(7675);
    expect(res.options.polycarbonate.assemblyRateNetPerSqM).toBe(250);
    expect(res.options.glassStandard.assemblyRateNetPerSqM).toBe(300);

    // Glass Standard Total Net: 18,315.63 (material) + 7,413.00 (assembly @ 300/m2) = 25,728.63 zł (~25 729 zł)
    expect(Math.round(res.options.glassStandard.totalNet)).toBe(25729);
  });

  test("correctly identifies standard dimension thresholds", () => {
    expect(isStandardDimension(300, 306)).toBe(true);
    expect(isStandardDimension(350, 406)).toBe(true);
    expect(isStandardDimension(400, 506)).toBe(true);
    expect(isStandardDimension(450, 506)).toBe(false); // PRO+ series (>400)
    expect(isStandardDimension(300, 310)).toBe(false); // Width not xx06
  });

  test("handles depth and width matching", () => {
    expect(findMatchedDepth(320)).toBe(350);
    expect(findMatchedDepth(510)).toBe(550);
    expect(findMatchedWidth(400)).toBe(406);
    expect(findMatchedWidth(1050)).toBe(1106);
  });
});
