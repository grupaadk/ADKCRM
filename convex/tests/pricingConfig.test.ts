import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { calculateGlassSystemPricing } from "../../lib/glassPricing";
import { calculateRoofPricing } from "../../lib/roofPricing";
import { getTrianglePricingRanges } from "../../lib/pricingRanges";

describe("Configurable material markup (pricingConfig)", () => {
  test("pure helpers respect custom materialMarkupMultiplier and default to 1.52", () => {
    const glassDefault = calculateGlassSystemPricing(2410, 2250);
    const glass60 = calculateGlassSystemPricing(2410, 2250, {
      materialMarkupMultiplier: 1.6,
    });
    expect(glassDefault.materialCostNet).toBe(2601);
    expect(glassDefault.materialPriceNet).toBe(Math.round(2601 * 1.52));
    expect(glass60.materialPriceNet).toBe(Math.round(2601 * 1.6));

    const roofDefault = calculateRoofPricing(4060, 3000, "polycarbonate");
    const roof40 = calculateRoofPricing(4060, 3000, "polycarbonate", {
      materialMarkupMultiplier: 1.4,
    });
    expect(roofDefault.materialCostNet).toBe(4285);
    expect(roofDefault.materialPriceNet).toBe(Math.round(4285 * 1.52));
    expect(roof40.materialPriceNet).toBe(Math.round(4285 * 1.4));

    const triangleRanges40 = getTrianglePricingRanges(1.4);
    expect(triangleRanges40[0].costNet).toBe(854);
    expect(triangleRanges40[0].priceNet).toBe(Math.round(854 * 1.4));
  });

  test("getPricingConfig returns default 52% and savePricingConfig enforces admin + validation", async () => {
    const t = convexTest(schema);

    const defaults = await t.query(api.crmConfig.getPricingConfig, {});
    expect(defaults).toEqual({
      glassMaterialMarkupPercent: 52,
      roofMaterialMarkupPercent: 52,
      glassMaterialMarkupMultiplier: 1.52,
      roofMaterialMarkupMultiplier: 1.52,
    });

    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        email: "user@test.pl",
        role: "sales",
        isActive: true,
      })
    );
    const asOffice = t.withIdentity({ subject: userId });

    await expect(
      asOffice.mutation(api.crmConfig.savePricingConfig, {
        glassMaterialMarkupPercent: 45,
        roofMaterialMarkupPercent: 60,
      })
    ).rejects.toThrow();

    const adminId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        email: "admin@test.pl",
        role: "admin",
        isActive: true,
      })
    );
    const asAdmin = t.withIdentity({ subject: adminId });

    await expect(
      asAdmin.mutation(api.crmConfig.savePricingConfig, {
        glassMaterialMarkupPercent: -5,
        roofMaterialMarkupPercent: 52,
      })
    ).rejects.toThrow();

    // Seed triangle template to verify sync
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("constructions", {
        name: "Trójkąt do zabudowy tarasu LEWY",
        code: "TROJKAT-TARAS-L",
        category: "Trójkąt",
        defaultWidthMm: 3000,
        defaultHeightMm: 600,
        materialCostNet: 854,
        materialMarkupType: "percent",
        materialMarkupValue: 52,
        materialPriceNet: 1298,
        installationUnit: "mb",
        installationUnitRate: 200,
        installationCostNet: 600,
        installationPriceNet: 750,
        pricingRanges: getTrianglePricingRanges(1.52),
        isActive: true,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      });
    });

    const saved = await asAdmin.mutation(api.crmConfig.savePricingConfig, {
      glassMaterialMarkupPercent: 40,
      roofMaterialMarkupPercent: 65,
    });
    expect(saved.glassMaterialMarkupPercent).toBe(40);
    expect(saved.roofMaterialMarkupPercent).toBe(65);
    expect(saved.glassMaterialMarkupMultiplier).toBe(1.4);
    expect(saved.roofMaterialMarkupMultiplier).toBe(1.65);

    const fetched = await t.query(api.crmConfig.getPricingConfig, {});
    expect(fetched.glassMaterialMarkupPercent).toBe(40);
    expect(fetched.roofMaterialMarkupPercent).toBe(65);

    const triangleTpl = await t.run(async (ctx) => {
      const all = await ctx.db.query("constructions").collect();
      return all.find((c) => c.code === "TROJKAT-TARAS-L");
    });
    expect(triangleTpl?.materialMarkupValue).toBe(40);
    expect(triangleTpl?.materialPriceNet).toBe(Math.round(854 * 1.4));
    expect(triangleTpl?.pricingRanges?.[0].priceNet).toBe(Math.round(854 * 1.4));
  });

  test("offers.addConstructionPosition and updateConstructionPosition use saved crmConfig markups", async () => {
    const t = convexTest(schema);
    const adminId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        email: "admin@test.pl",
        role: "admin",
        isActive: true,
      })
    );
    const asAdmin = t.withIdentity({ subject: adminId });

    await asAdmin.mutation(api.crmConfig.savePricingConfig, {
      glassMaterialMarkupPercent: 45,
      roofMaterialMarkupPercent: 60,
    });

    const oppId = await t.run(async (ctx) =>
      ctx.db.insert("pendingJotformSubmissions", {
        submissionId: "SUB-PRICING-1",
        firstName: "Anna",
        lastName: "Nowak",
        email: "anna@example.pl",
        phone: "+48 600 111 222",
        city: "Kraków",
        processed: false,
        stage: "lead",
      })
    );

    const offerId = await t.mutation(api.offers.getOrCreateForOpportunity, {
      opportunityId: oppId,
    });

    // Add a roof position (4060 x 3000 mm polycarbonate -> base cost 4285, markup 60% -> 6856)
    await t.mutation(api.offers.addConstructionPosition, {
      offerId,
      name: "Zadaszenie aluminiowe — Poliwęglan",
      widthMm: 4060,
      heightMm: 3000,
    });

    // Add a glass position and trigger dimension update (2410 x 2250 -> standard cost 2601, markup 45% -> 3771)
    const glassPosId = await t.mutation(api.offers.addConstructionPosition, {
      offerId,
      name: "System całoszklany 3-torowy",
      widthMm: 2880,
      heightMm: 2300,
    });
    await t.mutation(api.offers.updateConstructionPosition, {
      itemId: glassPosId,
      widthMm: 2410,
      heightMm: 2250,
    });

    const details = await t.query(api.offers.getOfferWithItems, { offerId });
    const roofItem = details?.items.find((i) =>
      i.name.toLowerCase().includes("zadaszen")
    );
    const glassItem = details?.items.find((i) => i._id === glassPosId);

    expect(roofItem?.materialCostNet).toBe(4285);
    expect(roofItem?.materialPriceNet).toBe(Math.round(4285 * 1.6));

    expect(glassItem?.materialCostNet).toBe(2601);
    expect(glassItem?.materialPriceNet).toBe(Math.round(2601 * 1.45));
  });
});
