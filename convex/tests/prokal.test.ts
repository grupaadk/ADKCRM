import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { calculateProkal } from "../../lib/prokalEngine";

describe("PROKAL CAD & System Configurator", () => {
  test("seeds default PROKAL components and sliding systems into Convex database", async () => {
    const t = convexTest(schema);

    // Initial check: empty tables
    const initialComponents = await t.query(api.prokal.listComponents, {});
    expect(initialComponents).toHaveLength(0);

    // Run seed
    const seedRes = await t.mutation(api.prokal.seedDefaultProkalData, {});
    expect(seedRes.status).toBe("seeded");
    expect(seedRes.countComponents).toBeGreaterThanOrEqual(10);
    expect(seedRes.countSystems).toBe(4);

    // Verify seeded components
    const seededComponents = await t.query(api.prokal.listComponents, {});
    expect(seededComponents.length).toBeGreaterThanOrEqual(10);

    const glass10 = seededComponents.find((c) => c.code === "HART 10");
    expect(glass10).toBeDefined();
    expect(glass10?.priceClientNet).toBe(260); // 260 zł/m2 jak na screenie PROKAL
    expect(glass10?.weightPerUnit).toBe(25); // 25 kg/m2

    const railTop = seededComponents.find((c) => c.code === "5448 7016MAT");
    expect(railTop).toBeDefined();

    // Verify seeded systems
    const systems = await t.query(api.prokal.listSystems, {});
    expect(systems).toHaveLength(4);
    const threeTrack = systems.find((s) => s.tracksCount === 3);
    expect(threeTrack).toBeDefined();
    expect(threeTrack?.key).toBe("SLIDING_3_TRACK");
    expect(threeTrack?.heightDeductionMm).toBe(103);
  });

  test("allows creating, updating and listing custom PROKAL components in settings", async () => {
    const t = convexTest(schema);

    // Create custom profile
    const compId = await t.mutation(api.prokal.saveComponent, {
      code: "PROFIL-CUSTOM-01",
      name: "Profil niestandardowy wzmocniony",
      category: "profile_upper",
      unit: "mb",
      priceCostNet: 120,
      priceClientNet: 190,
      weightPerUnit: 3.1,
      producer: "ADK",
      isActive: true,
    });
    expect(compId).toBeDefined();

    // Query component
    const comp = await t.query(api.prokal.getComponent, { id: compId });
    expect(comp?.code).toBe("PROFIL-CUSTOM-01");
    expect(comp?.priceClientNet).toBe(190);

    // Update component
    await t.mutation(api.prokal.saveComponent, {
      id: compId,
      code: "PROFIL-CUSTOM-01",
      name: "Profil niestandardowy wzmocniony V2",
      category: "profile_upper",
      unit: "mb",
      priceCostNet: 130,
      priceClientNet: 210,
      weightPerUnit: 3.2,
      producer: "ADK",
      isActive: true,
    });

    const updated = await t.query(api.prokal.getComponent, { id: compId });
    expect(updated?.name).toBe("Profil niestandardowy wzmocniony V2");
    expect(updated?.priceClientNet).toBe(210);

    // Delete component
    await t.mutation(api.prokal.deleteComponent, { id: compId });
    const deleted = await t.query(api.prokal.getComponent, { id: compId });
    expect(deleted).toBeNull();
  });

  test("calculates sliding system matching PROKAL physics and exact screenshot dimensions", () => {
    // Wejście dokładnie ze screena PROKAL: B=2880, H=2300, 3-torowy, szkło HART 10
    const calc = calculateProkal({
      widthMm: 2880,
      heightMm: 2300,
      tracksCount: 3,
      sashesCount: 3,
      color: "RAL 7016MAT",
      glassCode: "HART 10",
      includeInterlockGaskets: true,
      includeHandles: true,
    });

    expect(calc.widthMm).toBe(2880);
    expect(calc.heightMm).toBe(2300);
    expect(calc.tracksCount).toBe(3);
    expect(calc.sashes).toHaveLength(3);

    // Wysokość szkła H - 103 mm (2300 - 103 = 2197 mm, dokładnie jak na screenie!)
    expect(calc.sashes[0].heightMm).toBe(2197);
    expect(calc.sashes[1].heightMm).toBe(2197);
    expect(calc.sashes[2].heightMm).toBe(2197);

    // Szerokości skrzydeł (917, 960, 917 jak na screenie)
    expect(calc.sashes[0].widthMm).toBe(917);
    expect(calc.sashes[1].widthMm).toBe(960);
    expect(calc.sashes[2].widthMm).toBe(917);

    // Waga skrzydeł (50.4 kg i 52.7 kg jak na screenie!)
    expect(calc.sashes[0].weightKg).toBe(50.4);
    expect(calc.sashes[1].weightKg).toBe(52.7);
    expect(calc.sashes[2].weightKg).toBe(50.4);

    // Cena szkła za m² (260.00 zł/m² jak na screenie 2!)
    expect(calc.sashes[1].priceNetPerSqM).toBe(260);

    // Zestawienie materiałowe (BOM)
    expect(calc.bom.length).toBeGreaterThanOrEqual(6);
    expect(calc.totalWeightKg).toBeGreaterThan(150);
    expect(calc.totalPriceNet).toBeGreaterThan(calc.totalCostNet);
    expect(calc.profitMarginPercent).toBeGreaterThan(0);
  });

  test("powers PROKAL calculations using Excel price list data and Google Sheets overview", async () => {
    const t = convexTest(schema);

    // Test terracePricing.getPriceList query
    const wallsPriceList = await t.query(api.terracePricing.getPriceList, { key: "terrace_walls" });
    expect(wallsPriceList).toBeDefined();
    expect(wallsPriceList?.items).toBeDefined();

    // Test getProkalPricingOverview query
    const overview = await t.query(api.prokal.getProkalPricingOverview, {});
    expect(overview).toBeDefined();
    expect(overview.components).toBeDefined();

    // Test calculateProkal with Excel matching
    const calc = calculateProkal({
      widthMm: 2880,
      heightMm: 2300,
      tracksCount: 3,
      sashesCount: 3,
      color: "RAL 7016MAT",
      glassCode: "HART 10",
    });

    expect(calc.excelPricing).toBeDefined();
    expect(calc.excelPricing?.isPoweredByExcel).toBe(true);
    expect(calc.excelPricing?.matchedWidthCm).toBe(290);
    expect(calc.excelPricing?.matchedTracksCount).toBe(3);
    expect(calc.excelPricing?.excelBasePriceNet).toBe(2431);
    expect(calc.excelPricing?.excelPriceGross).toBe(2990);
    expect(calc.totalPriceNet).toBe(2431);
    expect(calc.offerSummaryText).toContain("Cennik: Arkusz Excel");
  });
});
