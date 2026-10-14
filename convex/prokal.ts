import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

export const componentCategoryValidator = v.union(
  v.literal("profile_upper"),
  v.literal("profile_lower"),
  v.literal("profile_side"),
  v.literal("profile_sash"),
  v.literal("glass"),
  v.literal("hardware"),
  v.literal("gasket"),
  v.literal("accessory")
);

export const componentUnitValidator = v.union(
  v.literal("mb"),
  v.literal("m2"),
  v.literal("szt"),
  v.literal("kpl")
);

export const systemRoleValidator = v.union(
  v.literal("top_rail"),
  v.literal("bottom_rail"),
  v.literal("side_frame"),
  v.literal("sash_bottom_profile"),
  v.literal("glass"),
  v.literal("rollers"),
  v.literal("brush_gasket"),
  v.literal("interlock_gasket"),
  v.literal("lock_handle"),
  v.literal("accessory")
);

// ──────────────────────────────────────────
// Komponenty PROKAL
// ──────────────────────────────────────────

export const listComponents = query({
  args: {
    category: v.optional(componentCategoryValidator),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const list = args.category
      ? await ctx.db
          .query("prokalComponents")
          .withIndex("by_category", (b) => b.eq("category", args.category!))
          .collect()
      : await ctx.db.query("prokalComponents").collect();

    if (args.activeOnly) {
      return list.filter((c) => c.isActive);
    }
    return list;
  },
});

export const getComponent = query({
  args: { id: v.id("prokalComponents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const saveComponent = mutation({
  args: {
    id: v.optional(v.id("prokalComponents")),
    code: v.string(),
    name: v.string(),
    category: componentCategoryValidator,
    unit: componentUnitValidator,
    priceCostNet: v.number(),
    priceClientNet: v.number(),
    weightPerUnit: v.number(),
    tracksCount: v.optional(v.number()),
    color: v.optional(v.string()),
    producer: v.optional(v.string()),
    description: v.optional(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const { id, ...data } = args;

    if (id) {
      await ctx.db.patch(id, {
        ...data,
        updatedAt: now,
      });
      return id;
    }

    return await ctx.db.insert("prokalComponents", {
      ...data,
      updatedAt: now,
    });
  },
});

export const deleteComponent = mutation({
  args: { id: v.id("prokalComponents") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// ──────────────────────────────────────────
// Systemy przesuwne PROKAL
// ──────────────────────────────────────────

export const listSystems = query({
  args: {
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const list = await ctx.db.query("prokalSystems").collect();
    if (args.activeOnly) {
      return list.filter((s) => s.isActive);
    }
    return list;
  },
});

export const getSystem = query({
  args: { id: v.id("prokalSystems") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const saveSystem = mutation({
  args: {
    id: v.optional(v.id("prokalSystems")),
    key: v.string(),
    name: v.string(),
    tracksCount: v.number(),
    defaultSashesCount: v.number(),
    producer: v.string(),
    description: v.optional(v.string()),
    glassOverlapMm: v.number(),
    heightDeductionMm: v.number(),
    minWidthMm: v.number(),
    maxWidthMm: v.number(),
    minHeightMm: v.number(),
    maxHeightMm: v.number(),
    maxSashWeightKg: v.number(),
    componentAssignments: v.array(
      v.object({
        role: systemRoleValidator,
        componentId: v.optional(v.id("prokalComponents")),
        defaultCode: v.string(),
        multiplier: v.number(),
      })
    ),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const { id, ...data } = args;

    if (id) {
      await ctx.db.patch(id, {
        ...data,
        updatedAt: now,
      });
      return id;
    }

    return await ctx.db.insert("prokalSystems", {
      ...data,
      updatedAt: now,
    });
  },
});

export const deleteSystem = mutation({
  args: { id: v.id("prokalSystems") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// ──────────────────────────────────────────
// Inicjalizacja domyślnych danych PROKAL
// ──────────────────────────────────────────

export const seedDefaultProkalData = mutation({
  args: {},
  handler: async (ctx) => {
    const existingComponents = await ctx.db.query("prokalComponents").take(1);
    const existingSystems = await ctx.db.query("prokalSystems").take(1);

    if (existingComponents.length > 0 && existingSystems.length > 0) {
      return { status: "already_seeded" };
    }

    const now = Date.now();

    // 1. Domyślne komponenty (wg PROKAL ze screenów)
    const defaultComponentsData = [
      {
        code: "5448 7016MAT",
        name: "Profil ramy górny toru jezdnego",
        category: "profile_upper" as const,
        unit: "mb" as const,
        priceCostNet: 165,
        priceClientNet: 245,
        weightPerUnit: 2.2,
        color: "RAL 7016MAT",
        producer: "PROCURAL",
        description: "Górny profil torowy z prowadnicami szczotkowymi",
        isActive: true,
        updatedAt: now,
      },
      {
        code: "5450 7016MAT",
        name: "Profil toru dolnego jezdnego z odprowadzeniem wody",
        category: "profile_lower" as const,
        unit: "mb" as const,
        priceCostNet: 180,
        priceClientNet: 260,
        weightPerUnit: 2.8,
        color: "RAL 7016MAT",
        producer: "PROCURAL",
        description: "Dolna szyna jezdna z bieżniami pod wózki",
        isActive: true,
        updatedAt: now,
      },
      {
        code: "5450 7016MAT (Bok)",
        name: "Profil boczny ramy / ościeżnicy ściennej",
        category: "profile_side" as const,
        unit: "mb" as const,
        priceCostNet: 95,
        priceClientNet: 145,
        weightPerUnit: 1.4,
        color: "RAL 7016MAT",
        producer: "PROCURAL",
        description: "Pionowy profil domykający do ściany",
        isActive: true,
        updatedAt: now,
      },
      {
        code: "5452 7016MAT",
        name: "Profil dolny skrzydła (uchwyt tafli szklanej)",
        category: "profile_sash" as const,
        unit: "mb" as const,
        priceCostNet: 65,
        priceClientNet: 95,
        weightPerUnit: 1.1,
        color: "RAL 7016MAT",
        producer: "PROCURAL",
        description: "Listwa zaciskowa pod taflę szkła mocowana do wózków",
        isActive: true,
        updatedAt: now,
      },
      {
        code: "HART 10",
        name: "Szkło hartowane ESG 10mm (HART 10)",
        category: "glass" as const,
        unit: "m2" as const,
        priceCostNet: 180,
        priceClientNet: 260, // Dokładnie 260 zł/m2 jak na screenie 2 z PROKAL!
        weightPerUnit: 25.0, // 25 kg/m2 dla szkła 10mm
        color: "Bezbarwne (Float)",
        producer: "ADK Glass",
        description: "Szkło bezpieczne hartowane szlifowane trapezowo",
        isActive: true,
        updatedAt: now,
      },
      {
        code: "HART 8",
        name: "Szkło hartowane ESG 8mm (HART 8)",
        category: "glass" as const,
        unit: "m2" as const,
        priceCostNet: 145,
        priceClientNet: 215,
        weightPerUnit: 20.0,
        color: "Bezbarwne (Float)",
        producer: "ADK Glass",
        description: "Szkło bezpieczne hartowane 8mm",
        isActive: true,
        updatedAt: now,
      },
      {
        code: "HART 10 MLECZNE",
        name: "Szkło hartowane ESG 10mm Mleczne/Matowe",
        category: "glass" as const,
        unit: "m2" as const,
        priceCostNet: 240,
        priceClientNet: 345,
        weightPerUnit: 25.0,
        color: "Mleczne / Satin",
        producer: "ADK Glass",
        description: "Szkło bezpieczne matowe trawione kwasem",
        isActive: true,
        updatedAt: now,
      },
      {
        code: "WOZ-PROCURAL",
        name: "Wózek jezdny łożyskowany z regulacją wysokości",
        category: "hardware" as const,
        unit: "szt" as const,
        priceCostNet: 45,
        priceClientNet: 75,
        weightPerUnit: 0.35,
        producer: "PROCURAL-OKUCIA",
        description: "Wózek ze stali nierdzewnej z łożyskami kulkowymi cichobieżnymi",
        isActive: true,
        updatedAt: now,
      },
      {
        code: "USZ-SZCZ-6.7",
        name: "Uszczelka szczotkowa przeciwkurzowa 6.7x8",
        category: "gasket" as const,
        unit: "mb" as const,
        priceCostNet: 4.5,
        priceClientNet: 8.5,
        weightPerUnit: 0.05,
        producer: "PROCURAL",
        description: "Szczotka uszczelniająca tory jezdne i profile pionowe",
        isActive: true,
        updatedAt: now,
      },
      {
        code: "USZ-H-CLEAR",
        name: "Uszczelka międzyszybowa bezbarwna transparentna typ h",
        category: "gasket" as const,
        unit: "mb" as const,
        priceCostNet: 18,
        priceClientNet: 32,
        weightPerUnit: 0.1,
        producer: "ADK",
        description: "Elastyczna uszczelka PVC nasuwana na krawędzie szkła",
        isActive: true,
        updatedAt: now,
      },
      {
        code: "ZAM-RYGL-01",
        name: "Zamek boczny z ryglem do profilu lub szkła",
        category: "hardware" as const,
        unit: "szt" as const,
        priceCostNet: 95,
        priceClientNet: 160,
        weightPerUnit: 0.45,
        producer: "PROCURAL-OKUCIA",
        description: "Zamek ryglowy z kluczem do blokowania skrzydła",
        isActive: true,
        updatedAt: now,
      },
      {
        code: "UCHW-KLEJ-01",
        name: "Pochwyt punktowy do szkła przesuwny płaski",
        category: "accessory" as const,
        unit: "szt" as const,
        priceCostNet: 35,
        priceClientNet: 60,
        weightPerUnit: 0.2,
        producer: "PROCURAL-OKUCIA",
        description: "Okrągły uchwyt płaski ze stali nierdzewnej",
        isActive: true,
        updatedAt: now,
      },
    ];

    const insertedComponentIds: Record<string, Id<"prokalComponents">> = {};
    for (const comp of defaultComponentsData) {
      const id = await ctx.db.insert("prokalComponents", comp);
      insertedComponentIds[comp.code] = id;
    }

    // 2. Domyślne systemy (2-torowy, 3-torowy, 4-torowy, 5-torowy)
    const systemsToInsert = [
      {
        key: "SLIDING_2_TRACK",
        name: "System przesuwny 2-torowy (2 skrzydła)",
        tracksCount: 2,
        defaultSashesCount: 2,
        producer: "PROCURAL",
        description: "System całoszklany 2-torowy na 2 skrzydła przesuwne",
        glassOverlapMm: 25,
        heightDeductionMm: 103,
        minWidthMm: 1200,
        maxWidthMm: 3200,
        minHeightMm: 1500,
        maxHeightMm: 2600,
        maxSashWeightKg: 70,
        componentAssignments: [
          { role: "top_rail" as const, defaultCode: "5448 7016MAT", multiplier: 1, componentId: insertedComponentIds["5448 7016MAT"] },
          { role: "bottom_rail" as const, defaultCode: "5450 7016MAT", multiplier: 1, componentId: insertedComponentIds["5450 7016MAT"] },
          { role: "side_frame" as const, defaultCode: "5450 7016MAT (Bok)", multiplier: 2, componentId: insertedComponentIds["5450 7016MAT (Bok)"] },
          { role: "sash_bottom_profile" as const, defaultCode: "5452 7016MAT", multiplier: 1, componentId: insertedComponentIds["5452 7016MAT"] },
          { role: "glass" as const, defaultCode: "HART 10", multiplier: 1, componentId: insertedComponentIds["HART 10"] },
          { role: "rollers" as const, defaultCode: "WOZ-PROCURAL", multiplier: 2, componentId: insertedComponentIds["WOZ-PROCURAL"] }, // 2 na skrzydło
          { role: "brush_gasket" as const, defaultCode: "USZ-SZCZ-6.7", multiplier: 2, componentId: insertedComponentIds["USZ-SZCZ-6.7"] },
        ],
        isActive: true,
        updatedAt: now,
      },
      {
        key: "SLIDING_3_TRACK",
        name: "System przesuwny 3-torowy (3 skrzydła)",
        tracksCount: 3,
        defaultSashesCount: 3,
        producer: "PROCURAL",
        description: "System całoszklany 3-torowy (B=2880, H=2300, 3 skrzydła)",
        glassOverlapMm: 25,
        heightDeductionMm: 103, // luz 103mm dokładnie jak w PROKAL
        minWidthMm: 1800,
        maxWidthMm: 4500,
        minHeightMm: 1500,
        maxHeightMm: 2600,
        maxSashWeightKg: 70,
        componentAssignments: [
          { role: "top_rail" as const, defaultCode: "5448 7016MAT", multiplier: 1, componentId: insertedComponentIds["5448 7016MAT"] },
          { role: "bottom_rail" as const, defaultCode: "5450 7016MAT", multiplier: 1, componentId: insertedComponentIds["5450 7016MAT"] },
          { role: "side_frame" as const, defaultCode: "5450 7016MAT (Bok)", multiplier: 2, componentId: insertedComponentIds["5450 7016MAT (Bok)"] },
          { role: "sash_bottom_profile" as const, defaultCode: "5452 7016MAT", multiplier: 1, componentId: insertedComponentIds["5452 7016MAT"] },
          { role: "glass" as const, defaultCode: "HART 10", multiplier: 1, componentId: insertedComponentIds["HART 10"] },
          { role: "rollers" as const, defaultCode: "WOZ-PROCURAL", multiplier: 2, componentId: insertedComponentIds["WOZ-PROCURAL"] },
          { role: "brush_gasket" as const, defaultCode: "USZ-SZCZ-6.7", multiplier: 3, componentId: insertedComponentIds["USZ-SZCZ-6.7"] },
        ],
        isActive: true,
        updatedAt: now,
      },
      {
        key: "SLIDING_4_TRACK",
        name: "System przesuwny 4-torowy (4 skrzydła)",
        tracksCount: 4,
        defaultSashesCount: 4,
        producer: "PROCURAL",
        description: "System całoszklany 4-torowy na 4 skrzydła przesuwne",
        glassOverlapMm: 25,
        heightDeductionMm: 103,
        minWidthMm: 2400,
        maxWidthMm: 6000,
        minHeightMm: 1500,
        maxHeightMm: 2600,
        maxSashWeightKg: 70,
        componentAssignments: [
          { role: "top_rail" as const, defaultCode: "5448 7016MAT", multiplier: 1, componentId: insertedComponentIds["5448 7016MAT"] },
          { role: "bottom_rail" as const, defaultCode: "5450 7016MAT", multiplier: 1, componentId: insertedComponentIds["5450 7016MAT"] },
          { role: "side_frame" as const, defaultCode: "5450 7016MAT (Bok)", multiplier: 2, componentId: insertedComponentIds["5450 7016MAT (Bok)"] },
          { role: "sash_bottom_profile" as const, defaultCode: "5452 7016MAT", multiplier: 1, componentId: insertedComponentIds["5452 7016MAT"] },
          { role: "glass" as const, defaultCode: "HART 10", multiplier: 1, componentId: insertedComponentIds["HART 10"] },
          { role: "rollers" as const, defaultCode: "WOZ-PROCURAL", multiplier: 2, componentId: insertedComponentIds["WOZ-PROCURAL"] },
          { role: "brush_gasket" as const, defaultCode: "USZ-SZCZ-6.7", multiplier: 4, componentId: insertedComponentIds["USZ-SZCZ-6.7"] },
        ],
        isActive: true,
        updatedAt: now,
      },
      {
        key: "SLIDING_5_TRACK",
        name: "System przesuwny 5-torowy (5 skrzydeł)",
        tracksCount: 5,
        defaultSashesCount: 5,
        producer: "PROCURAL",
        description: "System całoszklany 5-torowy dla dużych rozpiętości",
        glassOverlapMm: 25,
        heightDeductionMm: 103,
        minWidthMm: 3000,
        maxWidthMm: 7500,
        minHeightMm: 1500,
        maxHeightMm: 2600,
        maxSashWeightKg: 70,
        componentAssignments: [
          { role: "top_rail" as const, defaultCode: "5448 7016MAT", multiplier: 1, componentId: insertedComponentIds["5448 7016MAT"] },
          { role: "bottom_rail" as const, defaultCode: "5450 7016MAT", multiplier: 1, componentId: insertedComponentIds["5450 7016MAT"] },
          { role: "side_frame" as const, defaultCode: "5450 7016MAT (Bok)", multiplier: 2, componentId: insertedComponentIds["5450 7016MAT (Bok)"] },
          { role: "sash_bottom_profile" as const, defaultCode: "5452 7016MAT", multiplier: 1, componentId: insertedComponentIds["5452 7016MAT"] },
          { role: "glass" as const, defaultCode: "HART 10", multiplier: 1, componentId: insertedComponentIds["HART 10"] },
          { role: "rollers" as const, defaultCode: "WOZ-PROCURAL", multiplier: 2, componentId: insertedComponentIds["WOZ-PROCURAL"] },
          { role: "brush_gasket" as const, defaultCode: "USZ-SZCZ-6.7", multiplier: 5, componentId: insertedComponentIds["USZ-SZCZ-6.7"] },
        ],
        isActive: true,
        updatedAt: now,
      },
    ];

    for (const sys of systemsToInsert) {
      await ctx.db.insert("prokalSystems", sys);
    }

    return { status: "seeded", countComponents: defaultComponentsData.length, countSystems: systemsToInsert.length };
  },
});

// ──────────────────────────────────────────
// Wyceny i integracja z cennikiem Excel (Google Sheets)
// ──────────────────────────────────────────

export const getProkalPricingOverview = query({
  args: {},
  handler: async (ctx) => {
    const terraceWallsPriceList = await ctx.db
      .query("priceLists")
      .withIndex("by_key", (q) => q.eq("key", "terrace_walls"))
      .first();

    const components = await ctx.db.query("prokalComponents").collect();
    const systems = await ctx.db.query("prokalSystems").collect();

    const syncLogs = await ctx.db
      .query("priceListSyncLogs")
      .withIndex("by_key", (q) => q.eq("priceListKey", "terrace_walls"))
      .take(10);

    const latestSyncLog =
      syncLogs.length > 0
        ? syncLogs.reduce((latest, current) => (current.syncedAt > latest.syncedAt ? current : latest), syncLogs[0])
        : null;

    return {
      priceList: terraceWallsPriceList,
      components,
      systems,
      lastSyncLog: latestSyncLog,
      syncedAt: terraceWallsPriceList?.syncedAt ?? null,
      syncedBy: terraceWallsPriceList?.syncedBy ?? null,
      itemCount: terraceWallsPriceList?.itemCount ?? 0,
      items: terraceWallsPriceList?.items ?? [],
    };
  },
});

export const syncProkalFromSheets = action({
  args: {
    customUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.runAction(api.terracePricing.syncWalls, {
      customUrl: args.customUrl,
    });
  },
});

