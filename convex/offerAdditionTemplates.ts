import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";

/**
 * Zwraca listę szablonów dodatków i akcesoriów.
 */
export const list = query({
  args: {
    includeInactive: v.optional(v.boolean()),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let templates;
    if (args.includeInactive && !args.activeOnly) {
      templates = await ctx.db.query("offerAdditionTemplates").collect();
    } else {
      templates = await ctx.db
        .query("offerAdditionTemplates")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .collect();
    }

    return templates.sort((a, b) => {
      const orderA = a.orderIndex ?? 999;
      const orderB = b.orderIndex ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name, "pl");
    });
  },
});

/**
 * Tworzy nowy szablon dodatku.
 */
export const create = mutation({
  args: {
    name: v.string(),
    unit: v.string(),
    defaultPriceNet: v.number(),
    defaultCostNet: v.optional(v.number()),
    defaultInstallationPriceNet: v.optional(v.number()),
    defaultInstallationCostNet: v.optional(v.number()),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("offerAdditionTemplates").collect();
    const nextOrder = existing.length + 1;

    return await ctx.db.insert("offerAdditionTemplates", {
      name: args.name.trim(),
      unit: args.unit.trim() || "szt.",
      defaultPriceNet: args.defaultPriceNet,
      defaultCostNet: args.defaultCostNet,
      defaultInstallationPriceNet: args.defaultInstallationPriceNet,
      defaultInstallationCostNet: args.defaultInstallationCostNet,
      category: args.category?.trim() || undefined,
      description: args.description?.trim() || undefined,
      isActive: args.isActive ?? true,
      orderIndex: nextOrder,
      createdAt: Date.now(),
    });
  },
});

/**
 * Aktualizuje istniejący szablon dodatku.
 */
export const update = mutation({
  args: {
    id: v.id("offerAdditionTemplates"),
    name: v.optional(v.string()),
    unit: v.optional(v.string()),
    defaultPriceNet: v.optional(v.number()),
    defaultCostNet: v.optional(v.number()),
    defaultInstallationPriceNet: v.optional(v.number()),
    defaultInstallationCostNet: v.optional(v.number()),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    orderIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Szablon dodatku nie został znaleziony");

    const patch: Partial<Doc<"offerAdditionTemplates">> = {
      updatedAt: Date.now(),
    };

    if (updates.name !== undefined) patch.name = updates.name.trim();
    if (updates.unit !== undefined) patch.unit = updates.unit.trim();
    if (updates.defaultPriceNet !== undefined) patch.defaultPriceNet = updates.defaultPriceNet;
    if (updates.defaultCostNet !== undefined) patch.defaultCostNet = updates.defaultCostNet;
    if (updates.defaultInstallationPriceNet !== undefined)
      patch.defaultInstallationPriceNet = updates.defaultInstallationPriceNet;
    if (updates.defaultInstallationCostNet !== undefined)
      patch.defaultInstallationCostNet = updates.defaultInstallationCostNet;
    if (updates.category !== undefined) patch.category = updates.category.trim() || undefined;
    if (updates.description !== undefined) patch.description = updates.description.trim() || undefined;
    if (updates.isActive !== undefined) patch.isActive = updates.isActive;
    if (updates.orderIndex !== undefined) patch.orderIndex = updates.orderIndex;

    await ctx.db.patch(id, patch);
    return id;
  },
});

/**
 * Usuwa szablon dodatku.
 */
export const remove = mutation({
  args: {
    id: v.id("offerAdditionTemplates"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Szablon dodatku nie istnieje");
    await ctx.db.delete(args.id);
    return true;
  },
});

/**
 * Domyślna lista popularnych dodatków dla wstępnej inicjalizacji bazy.
 */
export const DEFAULT_ADDITION_TEMPLATES = [
  {
    name: "Zamek hakowy z kluczem",
    unit: "szt.",
    defaultPriceNet: 180,
    defaultCostNet: 100,
    defaultInstallationPriceNet: 50,
    defaultInstallationCostNet: 30,
    category: "Zamki i pochwyty",
  },
  {
    name: "Pochwyt ze stali nierdzewnej (muszlowy)",
    unit: "szt.",
    defaultPriceNet: 95,
    defaultCostNet: 50,
    defaultInstallationPriceNet: 25,
    defaultInstallationCostNet: 15,
    category: "Zamki i pochwyty",
  },
  {
    name: "Uszczelka szczotkowa dolna / prowadnicy",
    unit: "mb",
    defaultPriceNet: 35,
    defaultCostNet: 18,
    defaultInstallationPriceNet: 10,
    defaultInstallationCostNet: 6,
    category: "Uszczelnienia",
  },
  {
    name: "Uszczelka międzytorowa pionowa",
    unit: "mb",
    defaultPriceNet: 45,
    defaultCostNet: 22,
    defaultInstallationPriceNet: 15,
    defaultInstallationCostNet: 8,
    category: "Uszczelnienia",
  },
  {
    name: "Pilot wielokanałowy",
    unit: "szt.",
    defaultPriceNet: 260,
    defaultCostNet: 160,
    defaultInstallationPriceNet: 0,
    defaultInstallationCostNet: 0,
    category: "Automatyka",
  },
  {
    name: "Chemia montażowa i kotwy systemowe",
    unit: "kpl.",
    defaultPriceNet: 150,
    defaultCostNet: 90,
    defaultInstallationPriceNet: 0,
    defaultInstallationCostNet: 0,
    category: "Montaż",
  },
  {
    name: "Transport i rozładunek",
    unit: "kpl.",
    defaultPriceNet: 350,
    defaultCostNet: 250,
    defaultInstallationPriceNet: 0,
    defaultInstallationCostNet: 0,
    category: "Logistyka",
  },
];

/**
 * Inicjalizuje domyślne szablony, jeśli tabela jest pusta.
 */
export const seedDefaultsIfEmpty = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("offerAdditionTemplates").take(1);
    if (existing.length > 0) return 0;

    let count = 0;
    for (let i = 0; i < DEFAULT_ADDITION_TEMPLATES.length; i++) {
      const item = DEFAULT_ADDITION_TEMPLATES[i];
      await ctx.db.insert("offerAdditionTemplates", {
        name: item.name,
        unit: item.unit,
        defaultPriceNet: item.defaultPriceNet,
        defaultCostNet: item.defaultCostNet,
        defaultInstallationPriceNet: item.defaultInstallationPriceNet,
        defaultInstallationCostNet: item.defaultInstallationCostNet,
        category: item.category,
        isActive: true,
        orderIndex: i + 1,
        createdAt: Date.now(),
      });
      count++;
    }
    return count;
  },
});
