import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import {
  buildDefaultPolycarbonateMatrix,
  parsePolycarbonateCsv,
  parseWallsCsv,
  POLYCARBONATE_CONFIG,
} from "../priceLists";

type TestRuntime = ReturnType<typeof convexTest>;

async function setupAuthContext(t: TestRuntime) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email: "admin@adkcrm.pl",
      displayName: "Główny Admin",
      role: "admin",
      isActive: true,
    });
  });
  return t.withIdentity({ subject: userId });
}

describe("Price Lists Module", () => {
  test("generates complete default polycarbonate pricing matrix with correct dimensions", () => {
    const defaults = buildDefaultPolycarbonateMatrix();
    expect(defaults.widths).toEqual([306, 406, 506, 606, 706, 806, 906, 1006, 1106, 1206]);
    expect(defaults.depths).toEqual([300, 350, 400, 450, 500, 550, 600]);
    expect(defaults.matrix.length).toBe(7);

    // Sprawdź przykładowe ceny z arkusza bazowego
    const row300 = defaults.matrix.find((r) => r.depth === 300);
    expect(row300).toBeDefined();
    expect(row300?.series).toBe("STANDARD");
    expect(row300?.prices["306"]).toBe(3358);
    expect(row300?.prices["1206"]).toBe(12236);

    const row550 = defaults.matrix.find((r) => r.depth === 550);
    expect(row550).toBeDefined();
    expect(row550?.series).toBe("PRO+");
    expect(row550?.prices["1106"]).toBe(28927);
  });

  test("parses raw CSV text into price matrix correctly", () => {
    const sampleCsv = `Wysięg \\ Szerokość;306;406;506;606;706;806;906;1006;1106;1206
300;3 358 zł;4 285 zł;5 350 zł;6 114 zł;7 106 zł;8 577 zł;9 634 zł;10 691 zł;11 463 zł;12 236 zł
350;3 528 zł;4 634 zł;5 772 zł;6 610 zł;7 675 zł;9 268 zł;10 407 zł;11 545 zł;12 382 zł;13 220 zł
400;4 073 zł;4 984 zł;6 195 zł;6 789 zł;8 260 zł;9 959 zł;11 179 zł;12 398 zł;12 984 zł;13 577 zł
450;5 870 zł;7 382 zł;9 163 zł;10 683 zł;13 138 zł;14 659 zł;16 577 zł;18 098 zł;20 325 zł;21 846 zł`;

    const parsed = parsePolycarbonateCsv(sampleCsv);
    expect(parsed.widths).toEqual([306, 406, 506, 606, 706, 806, 906, 1006, 1106, 1206]);
    expect(parsed.depths).toContain(300);
    expect(parsed.depths).toContain(350);
    expect(parsed.depths).toContain(400);
    expect(parsed.depths).toContain(450);

    const row350 = parsed.matrix.find((r) => r.depth === 350);
    expect(row350?.prices["706"]).toBe(7675);
    expect(row350?.prices["306"]).toBe(3528);
  });

  test("getPriceList query returns default polycarbonate matrix when database has no entry", async () => {
    const t = convexTest(schema);
    const result = await t.query(api.priceLists.getPriceList, {
      key: POLYCARBONATE_CONFIG.key,
    });

    expect(result).not.toBeNull();
    expect(result?.title).toBe(POLYCARBONATE_CONFIG.title);
    expect(result?.category).toBe(POLYCARBONATE_CONFIG.category);
    expect(result?.widths?.length).toBe(10);
    expect(result?.matrix?.length).toBe(7);
  });

  test("saves and retrieves synced price list and writes sync logs", async () => {
    const t = convexTest(schema);
    const defaults = buildDefaultPolycarbonateMatrix();

    await t.mutation(internal.priceLists.internalSavePriceList, {
      key: POLYCARBONATE_CONFIG.key,
      category: POLYCARBONATE_CONFIG.category,
      title: POLYCARBONATE_CONFIG.title,
      spreadsheetId: POLYCARBONATE_CONFIG.spreadsheetId,
      sheetGid: POLYCARBONATE_CONFIG.sheetGid,
      sheetName: POLYCARBONATE_CONFIG.sheetName,
      sourceUrl: POLYCARBONATE_CONFIG.sourceUrl,
      widths: defaults.widths,
      depths: defaults.depths,
      matrix: defaults.matrix,
      syncedBy: "Admin Test",
      status: "active",
      itemCount: defaults.itemCount,
    });

    await t.mutation(internal.priceLists.internalSaveSyncLog, {
      priceListKey: POLYCARBONATE_CONFIG.key,
      syncedBy: "Admin Test",
      itemCount: defaults.itemCount,
      status: "success",
      sheetUrl: POLYCARBONATE_CONFIG.sourceUrl,
    });

    const priceList = await t.query(api.priceLists.getPriceList, {
      key: POLYCARBONATE_CONFIG.key,
    });
    expect(priceList?.syncedBy).toBe("Admin Test");
    expect(priceList?.itemCount).toBe(defaults.itemCount);

    const logs = await t.query(api.priceLists.listSyncLogs, {
      priceListKey: POLYCARBONATE_CONFIG.key,
    });
    expect(logs.length).toBe(1);
    expect(logs[0].status).toBe("success");
    expect(logs[0].syncedBy).toBe("Admin Test");

    // Test through terracePricing namespace
    const tpPriceList = await t.query(api.terracePricing.getPriceList, {
      key: POLYCARBONATE_CONFIG.key,
    });
    expect(tpPriceList?.syncedBy).toBe("Admin Test");
  });

  test("parses walls CSV text, extracts net prices and structures dimensions objects", () => {
    const sampleWallsCsv = `Produkt / wymiary;Cena brutto;netto
System 2-torowy 194 cm / wys. 230cm;2 050 zł;1 667 zł
System 3-torowy 241 cm / wys. 230 cm;2 990 zł;2 431 zł
System 4-torowy 337 cm / wys. 230 cm;4 080 zł;3 317 zł`;

    const parsed = parseWallsCsv(sampleWallsCsv);
    expect(parsed.length).toBe(3);
    
    // First item
    expect(parsed[0].name).toBe("System 2-torowy 194 cm / wys. 230cm");
    expect(parsed[0].priceNet).toBe(1667);
    expect(parsed[0].priceGross).toBe(2050);
    expect(parsed[0].dimensions).toEqual({ widthCm: 194, heightCm: 230 });
    expect(parsed[0].widthCm).toBe(194);
    expect(parsed[0].heightCm).toBe(230);
    expect(parsed[0].trackCount).toBe(2);

    // Second item
    expect(parsed[1].name).toBe("System 3-torowy 241 cm / wys. 230 cm");
    expect(parsed[1].priceNet).toBe(2431);
    expect(parsed[1].priceGross).toBe(2990);
    expect(parsed[1].dimensions).toEqual({ widthCm: 241, heightCm: 230 });
    expect(parsed[1].widthCm).toBe(241);
    expect(parsed[1].heightCm).toBe(230);
    expect(parsed[1].trackCount).toBe(3);
  });
});
