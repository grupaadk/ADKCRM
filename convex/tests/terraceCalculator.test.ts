import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { calculateTerraceEstimate } from "../../lib/terraceCalculatorEngine";

type TestRuntime = ReturnType<typeof convexTest>;

async function setupAuthContext(t: TestRuntime, role: "admin" | "manager" | "sales" = "admin") {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email: `${role}@example.pl`,
      displayName: `${role} User`,
      role: role === "manager" ? "admin" : role,
      isActive: true,
    });
  });
  return { asUser: t.withIdentity({ subject: userId }), userId };
}

describe("Terrace Roof Calculator Engine (Excel 1:1 Verification)", () => {
  test("calculates exact Polycarbonate estimate for STANDARD 350x506 cm", () => {
    const res = calculateTerraceEstimate({
      depthCm: 350,
      widthCm: 506,
      materialMarkupPercent: 52,
      vatRatePercent: 8,
      clientType: "individual",
    });

    expect(res.input.series).toBe("STANDARD");
    expect(res.input.isStandardDimension).toBe(true);
    expect(res.input.matchedDepthCm).toBe(350);
    expect(res.input.matchedWidthCm).toBe(506);
    expect(res.input.basePriceNet).toBe(5772);
    expect(res.input.areaSqM).toBe(17.71);

    // Assembly rate for 17.71 m² standard (<=20 m²): 300 zł/m²
    expect(res.input.effectiveAssemblyRateNetPerSqM).toBe(300);
    expect(res.options.polycarbonate.assemblyCostNet).toBe(5313); // 17.71 * 300

    // Material Net: 5772 * 1.52 = 8773.44 zł
    expect(res.options.polycarbonate.materialCostNet).toBeCloseTo(8773.44, 1);

    // Total Net: 8773.44 + 5313 = 14086.44
    expect(res.options.polycarbonate.totalNet).toBeCloseTo(14086.44, 1);

    // Kc: 5772 + 17.71 * (300 - 50) = 5772 + 4427.5 = 10199.5
    expect(res.options.polycarbonate.costBasisKc).toBeCloseTo(10199.5, 1);

    // Profit Z: 14086.44 - 10199.5 = 3886.94
    expect(res.options.polycarbonate.profitZ).toBeCloseTo(3886.94, 1);

    // Margin %: ~38.11%
    expect(res.options.polycarbonate.marginPercent).toBeCloseTo(38.11, 1);
  });

  test("classifies PRO+ depths (e.g. 450cm) as NIESTANDARD and uses higher assembly rate", () => {
    const res = calculateTerraceEstimate({
      depthCm: 450,
      widthCm: 506,
      materialMarkupPercent: 52,
      vatRatePercent: 8,
    });

    expect(res.input.series).toBe("PRO+");
    expect(res.input.isStandardDimension).toBe(false);
    expect(res.input.areaSqM).toBe(22.77);

    // Assembly rate for 22.77 m² NIESTANDARD: 300 zł/m²
    expect(res.input.effectiveAssemblyRateNetPerSqM).toBe(300);
  });
});

describe("Backend Assembly Params & Opportunity Integration", () => {
  test("getParams returns defaults and updateParams updates default markup", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupAuthContext(t, "admin");

    const params = await asUser.query(api.terraceAssemblyParams.getParams, {});
    expect(params.defaultMarkupPercent).toBe(52);
    expect(params.assemblyRatesStandard).toHaveLength(5);

    await asUser.mutation(api.terraceAssemblyParams.updateParams, {
      defaultMarkupPercent: 55,
      assemblyRatesStandard: params.assemblyRatesStandard,
      assemblyRatesNonStandard: params.assemblyRatesNonStandard,
    });

    const updated = await asUser.query(api.terraceAssemblyParams.getParams, {});
    expect(updated.defaultMarkupPercent).toBe(55);
  });

  test("rejects updateParams for non-admin/non-manager roles", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupAuthContext(t, "sales");

    const params = await asUser.query(api.terraceAssemblyParams.getParams, {});

    await expect(
      asUser.mutation(api.terraceAssemblyParams.updateParams, {
        defaultMarkupPercent: 60,
        assemblyRatesStandard: params.assemblyRatesStandard,
        assemblyRatesNonStandard: params.assemblyRatesNonStandard,
      })
    ).rejects.toThrow("Tylko administratorzy mogą");
  });

  test("createManualOpportunity saves serviceConfigurations and computes financial totals", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupAuthContext(t, "admin");

    const mockConfig = {
      serviceName: "Zadaszenie tarasu",
      calculatorType: "polycarbonate",
      input: { depthCm: 350, widthCm: 506, materialMarkupPercent: 52, vatRatePercent: 8 },
      result: { finalPriceNet: 13498, costKc: 9710, profitZ: 3789 },
      updatedAt: Date.now(),
    };

    const oppId = await asUser.mutation(api.salesOpportunities.createManualOpportunity, {
      firstName: "Jan",
      lastName: "Kowalski",
      services: ["Zadaszenie tarasu"],
      serviceConfigurations: [mockConfig],
      price: 13498,
      cost: 9710,
      profit: 3789,
    });

    const opp = await asUser.query(api.salesOpportunities.getSalesOpportunity, { opportunityId: oppId });
    expect(opp).not.toBeNull();
    expect(opp!.price).toBe(13498);
    expect(opp!.cost).toBe(9710);
    expect(opp!.profit).toBe(3789);
    expect(opp!.serviceConfigurations).toHaveLength(1);
    expect(opp!.serviceConfigurations![0].serviceName).toBe("Zadaszenie tarasu");
  });

  test("convertToOrder carries serviceConfigurations over to the created order", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupAuthContext(t, "admin");

    const mockConfig = {
      serviceName: "Zadaszenie tarasu",
      calculatorType: "polycarbonate",
      input: { depthCm: 350, widthCm: 506, materialMarkupPercent: 52, vatRatePercent: 8 },
      result: { finalPriceNet: 13498, costKc: 9710, profitZ: 3789 },
      updatedAt: Date.now(),
    };

    const oppId = await asUser.mutation(api.salesOpportunities.createManualOpportunity, {
      firstName: "Piotr",
      lastName: "Nowak",
      services: ["Zadaszenie tarasu"],
      serviceConfigurations: [mockConfig],
      price: 13498,
      cost: 9710,
      profit: 3789,
    });

    // Advance opportunity stage to inquiry ("Oferta wysłana")
    await asUser.mutation(api.salesOpportunities.updateOpportunityStage, {
      opportunityId: oppId,
      stage: "inquiry",
    });

    const { orderId } = await asUser.mutation(api.salesOpportunities.convertToOrder, {
      opportunityId: oppId,
    });

    const order = await t.run(async (ctx) => ctx.db.get(orderId));
    expect(order).not.toBeNull();
    expect(order!.serviceConfigurations).toHaveLength(1);
    expect(order!.serviceConfigurations![0].serviceName).toBe("Zadaszenie tarasu");
    expect(order!.price).toBe(13498);
    expect(order!.cost).toBe(9710);
  });
});
