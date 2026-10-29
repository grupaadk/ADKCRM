import { describe, test, expect } from "vitest";
import {
  checkIsStandard,
  calculateGlassSystemPricing,
  getStandardWidthCm,
  isGlassSystemConstruction,
} from "../../lib/glassPricing";

describe("Glass Systems Pricing and Standard Detection (from Excel OFERTOWANIE ŚCIANKI)", () => {
  test("correctly identifies STANDARD vs NIESTANDARD dimensions", () => {
    // Exact user screenshot case: 241 cm x 222 cm
    // 241 is standard module, but 222 cm does not have step of 5 cm (222 % 5 !== 0) -> NIESTANDARD
    const case1 = checkIsStandard(241, 222);
    expect(case1.isStandard).toBe(false);
    expect(case1.pricingTier).toBe("NIESTANDARD");
    expect(case1.standardWidthCm).toBe(241);

    // If height was 225 cm -> STANDARD
    const case2 = checkIsStandard(241, 225);
    expect(case2.isStandard).toBe(true);
    expect(case2.pricingTier).toBe("STANDARD");
    expect(case2.standardWidthCm).toBe(241);

    // Exact standard module 194 x 230 -> STANDARD
    const case3 = checkIsStandard(194, 230);
    expect(case3.isStandard).toBe(true);
    expect(case3.pricingTier).toBe("STANDARD");
    expect(case3.standardWidthCm).toBe(194);

    // Custom width 258 cm -> ceil to next standard module (290)
    const case4 = checkIsStandard(258, 222);
    expect(case4.isStandard).toBe(false);
    expect(case4.pricingTier).toBe("NIESTANDARD");
    expect(case4.standardWidthCm).toBe(290);
  });

  test("calculates exact prices matching user Excel screenshot for 2410 mm x 2220 mm", () => {
    const res = calculateGlassSystemPricing(2410, 2220);

    expect(res.isStandard).toBe(false);
    expect(res.pricingTier).toBe("NIESTANDARD");
    expect(res.standardWidthCm).toBe(241);

    // Excel: CENA koszt netto/szt = 2854 zł (2853.795)
    expect(res.materialCostNet).toBe(2854);

    // Excel: CENA z narzut (52%) = 4338 zł (4337.77)
    expect(res.materialPriceNet).toBe(4338);

    // Excel: CENA montaż koszt (2.41 mb * 250) = 603 zł (602.50)
    expect(res.installationCostNet).toBe(603);

    // Excel: CENA montaż klient (2.41 mb * 300) = 723 zł
    expect(res.installationPriceNet).toBe(723);

    // Excel: RAZEM koszt = 3456 zł
    expect(res.costNet).toBe(3456);

    // Excel: RAZEM z narzut = 5061 zł
    expect(res.priceNet).toBe(5061);
  });

  test("calculates exact prices matching Excel row 5 for 2900 mm x 2220 mm", () => {
    const res = calculateGlassSystemPricing(2900, 2220);

    expect(res.isStandard).toBe(false);
    expect(res.pricingTier).toBe("NIESTANDARD");
    expect(res.standardWidthCm).toBe(290);

    // Excel Row 5: 3098.55 -> rounded 3099 zł
    expect(res.materialCostNet).toBe(3099);

    // Excel Row 5: 4709.80 -> rounded 4710 zł
    expect(res.materialPriceNet).toBe(4710);

    // Excel Row 5: 725 zł
    expect(res.installationCostNet).toBe(725);

    // Excel Row 5: 870 zł
    expect(res.installationPriceNet).toBe(870);

    // Excel Row 5: 3824 zł (3823.55)
    expect(res.costNet).toBe(3824);

    // Excel Row 5: 5580 zł (5579.80)
    expect(res.priceNet).toBe(5580);
  });

  test("calculates catalogue prices for standard dimension 2410 mm x 2250 mm", () => {
    const res = calculateGlassSystemPricing(2410, 2250);

    expect(res.isStandard).toBe(true);
    expect(res.pricingTier).toBe("STANDARD");
    expect(res.standardWidthCm).toBe(241);

    // Standard module 241 catalogue cost = 2601 zł
    expect(res.materialCostNet).toBe(2601);

    // 2601 * 1.52 = 3953.52 -> 3954 zł
    expect(res.materialPriceNet).toBe(3954);

    // 2.41 * 250 = 603 zł
    expect(res.installationCostNet).toBe(603);

    // 2.41 * 300 = 723 zł
    expect(res.installationPriceNet).toBe(723);

    expect(res.costNet).toBe(3204);
    expect(res.priceNet).toBe(4677);
  });

  test("correctly recognizes glass system constructions", () => {
    expect(isGlassSystemConstruction({ name: "System całoszklany 3-torowy" })).toBe(true);
    expect(isGlassSystemConstruction({ shortName: "SZKLO-2T-194" })).toBe(true);
    expect(isGlassSystemConstruction({ fillType: "HART 10" })).toBe(true);
    expect(isGlassSystemConstruction({ name: "Drzwi aluminiowe zewnętrzne" })).toBe(false);
  });
});
