import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Pobiera listę kategorii konstrukcji CAD
 */
export const list = query({
  args: {
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let categories = await ctx.db.query("constructionCategories").collect();
    if (!args.includeInactive) {
      categories = categories.filter((c) => c.isActive);
    }
    return categories.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

/**
 * Pobiera pojedynczą kategorię
 */
export const get = query({
  args: {
    id: v.id("constructionCategories"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Tworzy nową kategorię konstrukcji
 */
export const create = mutation({
  args: {
    name: v.string(),
    code: v.optional(v.string()),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("constructionCategories").collect();
    const nextOrder = existing.length > 0 ? Math.max(...existing.map((c) => c.sortOrder)) + 1 : 0;
    const now = Date.now();

    return await ctx.db.insert("constructionCategories", {
      name: args.name.trim(),
      code: args.code?.trim().toUpperCase() || undefined,
      description: args.description?.trim() || undefined,
      color: args.color?.trim() || "cyan",
      isActive: args.isActive !== undefined ? args.isActive : true,
      sortOrder: nextOrder,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Aktualizuje kategorię konstrukcji
 */
export const update = mutation({
  args: {
    id: v.id("constructionCategories"),
    name: v.optional(v.string()),
    code: v.optional(v.string()),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Kategoria nie znaleziona");

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (fields.name !== undefined) patch.name = fields.name.trim();
    if (fields.code !== undefined) patch.code = fields.code.trim().toUpperCase() || undefined;
    if (fields.description !== undefined) patch.description = fields.description.trim() || undefined;
    if (fields.color !== undefined) patch.color = fields.color.trim() || undefined;
    if (fields.isActive !== undefined) patch.isActive = fields.isActive;
    if (fields.sortOrder !== undefined) patch.sortOrder = fields.sortOrder;

    await ctx.db.patch(id, patch);

    // Jeśli zmieniono nazwę, zaktualizuj tekstową kategorię w połączonych konstrukcjach
    if (fields.name !== undefined && fields.name.trim() !== existing.name) {
      const linkedConstructions = await ctx.db
        .query("constructions")
        .withIndex("by_category", (q) => q.eq("categoryId", id))
        .collect();

      for (const item of linkedConstructions) {
        await ctx.db.patch(item._id, {
          category: fields.name.trim(),
          updatedAt: Date.now(),
        });
      }
    }
  },
});

/**
 * Usuwa kategorię konstrukcji i odłącza ją od konstrukcji
 */
export const remove = mutation({
  args: {
    id: v.id("constructionCategories"),
  },
  handler: async (ctx, args) => {
    // Odłącz powiązane konstrukcje
    const linkedConstructions = await ctx.db
      .query("constructions")
      .withIndex("by_category", (q) => q.eq("categoryId", args.id))
      .collect();

    for (const item of linkedConstructions) {
      await ctx.db.patch(item._id, {
        categoryId: undefined,
        updatedAt: Date.now(),
      });
    }

    await ctx.db.delete(args.id);
  },
});

/**
 * Zmienia kolejność kategorii
 */
export const reorder = mutation({
  args: {
    id: v.id("constructionCategories"),
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
 * Seeduje przykładowe kategorie konstrukcji i wiąże z istniejącymi szablonami
 */
export const seedDefault = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("constructionCategories").collect();
    if (existing.length > 0) return { created: 0 };

    const now = Date.now();
    const defaults = [
      {
        name: "Systemy szklane",
        code: "SZKLO",
        description: "Zabudowy całoszklane przesuwne i stałe, szkło hartowane",
        color: "cyan",
        isActive: true,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Stolarka aluminiowa",
        code: "ALU",
        description: "Ciepłe i zimne profile aluminiowe, okna, drzwi i witryny",
        color: "blue",
        isActive: true,
        sortOrder: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Pergole i zadaszenia",
        code: "PERG",
        description: "Bioklimatyczne pergole lamelowe i zadaszenia tarasowe",
        color: "emerald",
        isActive: true,
        sortOrder: 2,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Balustrady szklane",
        code: "BAL",
        description: "Balustrady samonośne szklane w profilu liniowym",
        color: "indigo",
        isActive: true,
        sortOrder: 3,
        createdAt: now,
        updatedAt: now,
      },
    ];

    const insertedMap = new Map<string, typeof existing[0]["_id"]>();
    for (const d of defaults) {
      const id = await ctx.db.insert("constructionCategories", d);
      insertedMap.set(d.name.toLowerCase(), id);
    }

    // Połącz istniejące konstrukcje wg nazwy kategorii
    const allConstructions = await ctx.db.query("constructions").collect();
    for (const c of allConstructions) {
      if (c.category) {
        const catId = insertedMap.get(c.category.toLowerCase().trim());
        if (catId) {
          await ctx.db.patch(c._id, { categoryId: catId });
        }
      }
    }

    return { created: defaults.length };
  },
});
