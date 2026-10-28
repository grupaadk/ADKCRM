import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Pobiera listę konstrukcji z bazy danych
 */
export const list = query({
  args: {
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let constructions = await ctx.db.query("constructions").collect();
    if (!args.includeInactive) {
      constructions = constructions.filter((c) => c.isActive);
    }
    return constructions
      .map((c) => {
        const mat = c.materialPriceNet || 0;
        const inst = c.installationPriceNet || 0;
        const hasSpecific = c.materialPriceNet !== undefined || c.installationPriceNet !== undefined;
        const effectivePrice = hasSpecific
          ? (mat + inst > 0 ? mat + inst : undefined)
          : (c.defaultPriceNet && c.defaultPriceNet > 0 ? c.defaultPriceNet : undefined);
        return {
          ...c,
          defaultPriceNet: effectivePrice,
          defaultWarning: undefined,
        };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

/**
 * Pobiera pojedynczą konstrukcję po ID
 */
export const get = query({
  args: {
    id: v.id("constructions"),
  },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.id);
    if (!c) return null;
    const mat = c.materialPriceNet || 0;
    const inst = c.installationPriceNet || 0;
    const hasSpecific = c.materialPriceNet !== undefined || c.installationPriceNet !== undefined;
    const effectivePrice = hasSpecific
      ? (mat + inst > 0 ? mat + inst : undefined)
      : (c.defaultPriceNet && c.defaultPriceNet > 0 ? c.defaultPriceNet : undefined);
    return {
      ...c,
      defaultPriceNet: effectivePrice,
      defaultWarning: undefined,
    };
  },
});

/**
 * Tworzy nową konstrukcję w katalogu
 */
export const create = mutation({
  args: {
    name: v.string(),
    code: v.string(),
    categoryId: v.optional(v.id("constructionCategories")),
    category: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    defaultSystem: v.optional(v.string()),
    defaultColor: v.optional(v.union(v.string(), v.null())),
    defaultWidthMm: v.optional(v.union(v.number(), v.null())),
    defaultHeightMm: v.optional(v.union(v.number(), v.null())),
    defaultPanesCount: v.optional(v.union(v.number(), v.null())),
    defaultFillType: v.optional(v.union(v.string(), v.null())),
    defaultWarning: v.optional(v.string()),
    defaultPriceNet: v.optional(v.number()),
    materialCostNet: v.optional(v.union(v.number(), v.null())),
    materialMarkupType: v.optional(v.union(v.literal("percent"), v.literal("amount"), v.null())),
    materialMarkupValue: v.optional(v.union(v.number(), v.null())),
    materialPriceNet: v.optional(v.union(v.number(), v.null())),
    installationUnit: v.optional(v.union(v.literal("m2"), v.literal("mb"), v.literal("fixed"), v.null())),
    installationUnitRate: v.optional(v.union(v.number(), v.null())),
    installationCostNet: v.optional(v.union(v.number(), v.null())),
    installationMarkupType: v.optional(v.union(v.literal("percent"), v.literal("amount"), v.null())),
    installationMarkupValue: v.optional(v.union(v.number(), v.null())),
    installationPriceNet: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("constructions").collect();
    const nextOrder = existing.length > 0 ? Math.max(...existing.map((c) => c.sortOrder)) + 1 : 0;
    const now = Date.now();

    let categoryName = args.category?.trim() || undefined;
    if (args.categoryId) {
      const cat = await ctx.db.get(args.categoryId);
      if (cat) categoryName = cat.name;
    }

    return await ctx.db.insert("constructions", {
      name: args.name.trim(),
      code: args.code.trim().toUpperCase(),
      categoryId: args.categoryId,
      category: categoryName,
      description: args.description?.trim() || undefined,
      defaultSystem: args.defaultSystem?.trim() || undefined,
      defaultColor: args.defaultColor?.trim() || undefined,
      defaultWidthMm: args.defaultWidthMm || undefined,
      defaultHeightMm: args.defaultHeightMm || undefined,
      defaultPanesCount: args.defaultPanesCount !== undefined && args.defaultPanesCount !== null ? args.defaultPanesCount : undefined,
      defaultFillType: args.defaultFillType?.trim() || undefined,
      defaultWarning: args.defaultWarning?.trim() || undefined,
      defaultPriceNet:
        args.defaultPriceNet !== undefined
          ? args.defaultPriceNet
          : (args.materialPriceNet || 0) + (args.installationPriceNet || 0) || undefined,
      materialCostNet: args.materialCostNet ?? undefined,
      materialMarkupType: args.materialMarkupType ?? undefined,
      materialMarkupValue: args.materialMarkupValue ?? undefined,
      materialPriceNet: args.materialPriceNet ?? undefined,
      installationUnit: args.installationUnit ?? undefined,
      installationUnitRate: args.installationUnitRate ?? undefined,
      installationCostNet: args.installationCostNet ?? undefined,
      installationMarkupType: args.installationMarkupType ?? undefined,
      installationMarkupValue: args.installationMarkupValue ?? undefined,
      installationPriceNet: args.installationPriceNet ?? undefined,
      isActive: true,
      sortOrder: nextOrder,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Aktualizuje konstrukcję w katalogu
 */
export const update = mutation({
  args: {
    id: v.id("constructions"),
    name: v.optional(v.string()),
    code: v.optional(v.string()),
    categoryId: v.optional(v.id("constructionCategories")),
    category: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    defaultSystem: v.optional(v.string()),
    defaultColor: v.optional(v.union(v.string(), v.null())),
    defaultWidthMm: v.optional(v.union(v.number(), v.null())),
    defaultHeightMm: v.optional(v.union(v.number(), v.null())),
    defaultPanesCount: v.optional(v.union(v.number(), v.null())),
    defaultFillType: v.optional(v.union(v.string(), v.null())),
    defaultWarning: v.optional(v.string()),
    defaultPriceNet: v.optional(v.number()),
    materialCostNet: v.optional(v.union(v.number(), v.null())),
    materialMarkupType: v.optional(v.union(v.literal("percent"), v.literal("amount"), v.null())),
    materialMarkupValue: v.optional(v.union(v.number(), v.null())),
    materialPriceNet: v.optional(v.union(v.number(), v.null())),
    installationUnit: v.optional(v.union(v.literal("m2"), v.literal("mb"), v.literal("fixed"), v.null())),
    installationUnitRate: v.optional(v.union(v.number(), v.null())),
    installationCostNet: v.optional(v.union(v.number(), v.null())),
    installationMarkupType: v.optional(v.union(v.literal("percent"), v.literal("amount"), v.null())),
    installationMarkupValue: v.optional(v.union(v.number(), v.null())),
    installationPriceNet: v.optional(v.union(v.number(), v.null())),
    isActive: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Konstrukcja nie znaleziona");

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (fields.name !== undefined) patch.name = fields.name.trim();
    if (fields.code !== undefined) patch.code = fields.code.trim().toUpperCase();
    if (fields.categoryId !== undefined) {
      patch.categoryId = fields.categoryId || undefined;
      if (fields.categoryId) {
        const cat = await ctx.db.get(fields.categoryId);
        if (cat) patch.category = cat.name;
      }
    } else if (fields.category !== undefined) {
      patch.category = fields.category.trim() || undefined;
    }
    if (fields.description !== undefined) patch.description = fields.description?.trim() || undefined;
    if (fields.defaultSystem !== undefined) patch.defaultSystem = fields.defaultSystem?.trim() || undefined;
    if (fields.defaultColor !== undefined) patch.defaultColor = fields.defaultColor?.trim() || undefined;
    if (fields.defaultWidthMm !== undefined) patch.defaultWidthMm = fields.defaultWidthMm ?? undefined;
    if (fields.defaultHeightMm !== undefined) patch.defaultHeightMm = fields.defaultHeightMm ?? undefined;
    if (fields.defaultPanesCount !== undefined) patch.defaultPanesCount = fields.defaultPanesCount ?? undefined;
    if (fields.defaultFillType !== undefined) patch.defaultFillType = fields.defaultFillType?.trim() || undefined;
    if (fields.defaultWarning !== undefined) patch.defaultWarning = fields.defaultWarning.trim() || undefined;
    if (fields.defaultPriceNet !== undefined) {
      patch.defaultPriceNet = fields.defaultPriceNet;
    } else if (fields.materialPriceNet !== undefined || fields.installationPriceNet !== undefined) {
      const mat = fields.materialPriceNet !== undefined ? (fields.materialPriceNet ?? 0) : (existing.materialPriceNet ?? 0);
      const inst = fields.installationPriceNet !== undefined ? (fields.installationPriceNet ?? 0) : (existing.installationPriceNet ?? 0);
      patch.defaultPriceNet = mat + inst > 0 ? mat + inst : 0;
    }
    if (fields.materialCostNet !== undefined) patch.materialCostNet = fields.materialCostNet ?? undefined;
    if (fields.materialMarkupType !== undefined) patch.materialMarkupType = fields.materialMarkupType ?? undefined;
    if (fields.materialMarkupValue !== undefined) patch.materialMarkupValue = fields.materialMarkupValue ?? undefined;
    if (fields.materialPriceNet !== undefined) patch.materialPriceNet = fields.materialPriceNet ?? undefined;
    if (fields.installationUnit !== undefined) patch.installationUnit = fields.installationUnit ?? undefined;
    if (fields.installationUnitRate !== undefined) patch.installationUnitRate = fields.installationUnitRate ?? undefined;
    if (fields.installationCostNet !== undefined) patch.installationCostNet = fields.installationCostNet ?? undefined;
    if (fields.installationMarkupType !== undefined) patch.installationMarkupType = fields.installationMarkupType ?? undefined;
    if (fields.installationMarkupValue !== undefined) patch.installationMarkupValue = fields.installationMarkupValue ?? undefined;
    if (fields.installationPriceNet !== undefined) patch.installationPriceNet = fields.installationPriceNet ?? undefined;
    if (fields.isActive !== undefined) patch.isActive = fields.isActive;
    if (fields.sortOrder !== undefined) patch.sortOrder = fields.sortOrder;

    await ctx.db.patch(id, patch);
  },
});

/**
 * Usuwa konstrukcję z katalogu
 */
export const remove = mutation({
  args: {
    id: v.id("constructions"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

/**
 * Zmienia kolejność konstrukcji
 */
export const reorder = mutation({
  args: {
    id: v.id("constructions"),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      sortOrder: args.sortOrder,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Seeduje przykładowe konstrukcje, jeśli baza jest pusta
 */
export const seedDefault = mutation({
  args: {},
  handler: async (ctx) => {
    const count = (await ctx.db.query("constructions").collect()).length;
    if (count > 0) return { created: 0 };

    const now = Date.now();
    const defaults = [
      {
        name: "System całoszklany 3-torowy",
        code: "SZKLO-3T",
        category: "Systemy szklane",
        description: "System całoszklany przesuwny 3-torowy ze szkłem hartowanym HART 10",
        defaultSystem: "PROCURAL",
        defaultColor: "RAL 7016MAT",
        defaultWidthMm: 2880,
        defaultHeightMm: 2300,
        defaultPanesCount: 3,
        defaultFillType: "HART 10",
        defaultPriceNet: 4500,
        isActive: true,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "System całoszklany 4-torowy",
        code: "SZKLO-4T",
        category: "Systemy szklane",
        description: "System całoszklany przesuwny 4-torowy 4 skrzydła",
        defaultSystem: "PROCURAL",
        defaultColor: "RAL 7016MAT",
        defaultWidthMm: 3800,
        defaultHeightMm: 2300,
        defaultPanesCount: 4,
        defaultFillType: "HART 10",
        defaultPriceNet: 5800,
        isActive: true,
        sortOrder: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "PE78N - Okna i drzwi",
        code: "PE78N",
        category: "Stolarka aluminiowa",
        description: "Ciepły system profilowy PE78N z przekładką termiczną",
        defaultSystem: "PONZIO PE78N",
        defaultColor: "RAL 7016MAT",
        defaultWidthMm: 1800,
        defaultHeightMm: 2100,
        defaultPanesCount: 2,
        defaultFillType: "4/16/4 U=1.1",
        defaultPriceNet: 3200,
        isActive: true,
        sortOrder: 2,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Trójkąt do zabudowy tarasu LEWY",
        code: "TROJKAT-TARAS-L",
        category: "Trójkąt",
        description: "Konstrukcja trójkąta bocznego pod krokwie tarasu LEWY (Profil H dolny + Krokiew skośna, wypełnienie szklane)",
        defaultSystem: "Profil H + Krokiew",
        defaultColor: "RAL 7016MAT",
        defaultWidthMm: 3000,
        defaultHeightMm: 600,
        defaultPanesCount: 1,
        defaultFillType: "HART 10",
        defaultPriceNet: 2400,
        isActive: true,
        sortOrder: 3,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Trójkąt do zabudowy tarasu PRAWY",
        code: "TROJKAT-TARAS-P",
        category: "Trójkąt",
        description: "Konstrukcja trójkąta bocznego pod krokwie tarasu PRAWY (odbicie lustrzane: Profil H dolny + Krokiew skośna, wypełnienie szklane)",
        defaultSystem: "Profil H + Krokiew",
        defaultColor: "RAL 7016MAT",
        defaultWidthMm: 3000,
        defaultHeightMm: 600,
        defaultPanesCount: 1,
        defaultFillType: "HART 10",
        defaultPriceNet: 2400,
        isActive: true,
        sortOrder: 4,
        createdAt: now,
        updatedAt: now,
      },
    ];

    for (const d of defaults) {
      await ctx.db.insert("constructions", d);
    }

    return { created: defaults.length };
  },
});

/**
 * Zapewnia istnienie kategorii "Trójkąt" oraz szablonów konstrukcji trójkąta (LEWY i PRAWY)
 */
export const ensureTriangleConstruction = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // 1. Sprawdź lub utwórz kategorię "Trójkąt"
    const existingCategories = await ctx.db.query("constructionCategories").collect();
    let triangleCategory = existingCategories.find(
      (cat) =>
        cat.name.toLowerCase().includes("trójką") ||
        (cat.code && cat.code.toUpperCase() === "TROJKAT")
    );

    if (!triangleCategory) {
      const nextCatOrder =
        existingCategories.length > 0
          ? Math.max(...existingCategories.map((c) => c.sortOrder)) + 1
          : 0;
      const catId = await ctx.db.insert("constructionCategories", {
        name: "Trójkąt",
        code: "TROJKAT",
        description: "Trójkąty szczytowe i kliny podkrokwiowe konieczne do zabudowy tarasu",
        color: "amber",
        isActive: true,
        sortOrder: nextCatOrder,
        createdAt: now,
        updatedAt: now,
      });
      triangleCategory = (await ctx.db.get(catId))!;
    }

    // 2. Sprawdź lub utwórz konstrukcje trójkątów: LEWY oraz PRAWY
    const existingConstructions = await ctx.db.query("constructions").collect();

    // LEWY
    let leftConstruction = existingConstructions.find(
      (c) =>
        c.name.toLowerCase().includes("lewy") &&
        (c.name.toLowerCase().includes("trójką") || c.code.includes("TROJKAT"))
    );
    if (!leftConstruction) {
      leftConstruction = existingConstructions.find(
        (c) =>
          !c.name.toLowerCase().includes("prawy") &&
          (c.code === "TROJKAT-TARAS" ||
            c.code === "TROJKAT-TARAS-L" ||
            c.name.toLowerCase().includes("trójkąt"))
      );
      if (leftConstruction) {
        // Jeśli nazywał się po prostu "Trójkąt do zabudowy tarasu", zaktualizuj nazwę na LEWY
        if (!leftConstruction.name.toLowerCase().includes("lewy")) {
          await ctx.db.patch(leftConstruction._id, {
            name: "Trójkąt do zabudowy tarasu LEWY",
            updatedAt: now,
          });
        }
      }
    }

    let createdLeft = false;
    if (!leftConstruction) {
      const nextConstrOrder =
        existingConstructions.length > 0
          ? Math.max(...existingConstructions.map((c) => c.sortOrder)) + 1
          : 0;
      const constrId = await ctx.db.insert("constructions", {
        name: "Trójkąt do zabudowy tarasu LEWY",
        code: "TROJKAT-TARAS-L",
        categoryId: triangleCategory._id,
        category: triangleCategory.name,
        description:
          "Konstrukcja trójkąta bocznego pod krokwie tarasu (Profil H dolny + Krokiew skośna, wypełnienie szklane)",
        defaultSystem: "Profil H + Krokiew",
        defaultColor: "RAL 7016MAT",
        defaultWidthMm: 3000,
        defaultHeightMm: 600,
        defaultPanesCount: 1,
        defaultFillType: "HART 10",
        defaultPriceNet: 2400,
        isActive: true,
        sortOrder: nextConstrOrder,
        createdAt: now,
        updatedAt: now,
      });
      leftConstruction = (await ctx.db.get(constrId))!;
      createdLeft = true;
    } else if (!leftConstruction.categoryId || leftConstruction.category !== triangleCategory.name) {
      await ctx.db.patch(leftConstruction._id, {
        categoryId: triangleCategory._id,
        category: triangleCategory.name,
        updatedAt: now,
      });
    }

    // PRAWY
    let rightConstruction = existingConstructions.find(
      (c) =>
        c.name.toLowerCase().includes("prawy") &&
        (c.name.toLowerCase().includes("trójką") || c.code.includes("TROJKAT"))
    );

    let createdRight = false;
    if (!rightConstruction) {
      const allNow = await ctx.db.query("constructions").collect();
      const nextConstrOrder =
        allNow.length > 0
          ? Math.max(...allNow.map((c) => c.sortOrder)) + 1
          : 0;
      const constrId = await ctx.db.insert("constructions", {
        name: "Trójkąt do zabudowy tarasu PRAWY",
        code: "TROJKAT-TARAS-P",
        categoryId: triangleCategory._id,
        category: triangleCategory.name,
        description:
          "Konstrukcja trójkąta bocznego pod krokwie tarasu PRAWY (odbicie lustrzane: Profil H dolny + Krokiew skośna, wypełnienie szklane)",
        defaultSystem: "Profil H + Krokiew",
        defaultColor: "RAL 7016MAT",
        defaultWidthMm: 3000,
        defaultHeightMm: 600,
        defaultPanesCount: 1,
        defaultFillType: "HART 10",
        defaultPriceNet: 2400,
        isActive: true,
        sortOrder: nextConstrOrder,
        createdAt: now,
        updatedAt: now,
      });
      rightConstruction = (await ctx.db.get(constrId))!;
      createdRight = true;
    } else if (!rightConstruction.categoryId || rightConstruction.category !== triangleCategory.name) {
      await ctx.db.patch(rightConstruction._id, {
        categoryId: triangleCategory._id,
        category: triangleCategory.name,
        updatedAt: now,
      });
    }

    return {
      categoryId: triangleCategory._id,
      createdLeft,
      leftId: leftConstruction._id,
      createdRight,
      rightId: rightConstruction._id,
    };
  },
});
