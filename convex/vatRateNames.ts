import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const DEFAULT_VAT_RATE_NAMES = [
  // 23%
  { vatRate: 23, name: "Stolarka okienna", label: "Stolarka okienna", sortOrder: 1 },
  { vatRate: 23, name: "Stolarka drzwiowa", label: "Stolarka drzwiowa", sortOrder: 2 },
  { vatRate: 23, name: "Brama garażowa", label: "Brama garażowa", sortOrder: 3 },
  { vatRate: 23, name: "Zabudowa tarasu", label: "Zabudowa tarasu", sortOrder: 4 },
  { vatRate: 23, name: "Konstrukcje aluminiowe", label: "Konstrukcje aluminiowe", sortOrder: 5 },
  { vatRate: 23, name: "Ogrodzenie", label: "Ogrodzenie", sortOrder: 6 },
  { vatRate: 23, name: "System przeciwsłoneczny", label: "System przeciwsłoneczny", sortOrder: 7 },

  // 8%
  {
    vatRate: 8,
    name: "Usługa remontowo budowlana w budynku mieszkalnym do 300m2 w XXXXXXX (brama garażowa z montażem) PKWiU 43.32.10.0.",
    label: "brama garażowa z montażem",
    sortOrder: 1,
  },
  {
    vatRate: 8,
    name: "Usługa remontowo budowlana w budynku mieszkalnym do 300m2 w XXXXXXX (drzwi zewnętrzne z montażem) PKWiU 43.32.10.0.",
    label: "drzwi zewnętrzne z montażem",
    sortOrder: 2,
  },
  {
    vatRate: 8,
    name: "Usługa remontowo budowlana w budynku mieszkalnym do 300m2 w XXXXXXX (przygotowanie mebli do montażu) PKWiU 43.32.10.0.",
    label: "przygotowanie mebli do montażu",
    sortOrder: 3,
  },
  {
    vatRate: 8,
    name: "Usługa remontowo budowlana w budynku mieszkalnym do 300m2 w XXXXXXX (zabudowa tarasu z montażem) PKWiU 43.32.10.0.",
    label: "zabudowa tarasu z montażem",
    sortOrder: 4,
  },
  {
    vatRate: 8,
    name: "Usługa remontowo budowlana w budynku mieszkalnym do 300m2 w XXXXXXX (zadaszenie z montażem) PKWiU 43.32.10.0.",
    label: "zadaszenie z montażem",
    sortOrder: 5,
  },
  {
    vatRate: 8,
    name: "Usługa remontowo budowlana w budynku mieszkalnym do 300m2 w XXXXXXX (stolarka budowlana z montażem) PKWiU 43.32.10.0.",
    label: "stolarka budowlana z montażem",
    sortOrder: 6,
  },
  {
    vatRate: 8,
    name: "Usługa remontowo budowlana w budynku mieszkalnym do 300m2 w XXXXXXX (stolarka okienna z montażem) PKWiU 43.32.10.0.",
    label: "stolarka okienna z montażem",
    sortOrder: 7,
  },
];

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("vatRateNames").first();
    if (existing) return { seeded: 0, message: "Już istnieją nazwy VAT w bazie." };

    let count = 0;
    for (const item of DEFAULT_VAT_RATE_NAMES) {
      await ctx.db.insert("vatRateNames", {
        vatRate: item.vatRate,
        name: item.name,
        label: item.label,
        sortOrder: item.sortOrder,
        isActive: true,
      });
      count++;
    }
    return { seeded: count, message: `Dodano ${count} predefiniowanych nazw VAT.` };
  },
});

export const list = query({
  args: {
    vatRate: v.optional(v.number()),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let items;
    if (args.vatRate !== undefined) {
      if (args.includeInactive) {
        items = await ctx.db
          .query("vatRateNames")
          .withIndex("by_vat_rate", (q) => q.eq("vatRate", args.vatRate!))
          .collect();
      } else {
        items = await ctx.db
          .query("vatRateNames")
          .withIndex("by_vat_rate_and_active", (q) =>
            q.eq("vatRate", args.vatRate!).eq("isActive", true)
          )
          .collect();
      }
    } else {
      items = await ctx.db.query("vatRateNames").collect();
      if (!args.includeInactive) {
        items = items.filter((i) => i.isActive);
      }
    }

    return items.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

export const create = mutation({
  args: {
    vatRate: v.number(),
    name: v.string(),
    label: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const nameTrimmed = args.name.trim();
    if (!nameTrimmed) throw new Error("Nazwa nie może być pusta.");

    let sortOrder = args.sortOrder;
    if (sortOrder === undefined) {
      const existing = await ctx.db
        .query("vatRateNames")
        .withIndex("by_vat_rate", (q) => q.eq("vatRate", args.vatRate))
        .collect();
      sortOrder = existing.length + 1;
    }

    return await ctx.db.insert("vatRateNames", {
      vatRate: args.vatRate,
      name: nameTrimmed,
      label: args.label?.trim() || undefined,
      sortOrder,
      isActive: args.isActive ?? true,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("vatRateNames"),
    vatRate: v.optional(v.number()),
    name: v.optional(v.string()),
    label: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Nie znaleziono pozycji.");

    const patch: Record<string, unknown> = {};
    if (args.vatRate !== undefined) patch.vatRate = args.vatRate;
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.label !== undefined) patch.label = args.label.trim() || undefined;
    if (args.sortOrder !== undefined) patch.sortOrder = args.sortOrder;
    if (args.isActive !== undefined) patch.isActive = args.isActive;

    await ctx.db.patch(args.id, patch);
  },
});

export const toggleActive = mutation({
  args: { id: v.id("vatRateNames") },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Nie znaleziono pozycji.");
    await ctx.db.patch(args.id, { isActive: !item.isActive });
  },
});

export const remove = mutation({
  args: { id: v.id("vatRateNames") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const reorder = mutation({
  args: { id: v.id("vatRateNames"), sortOrder: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { sortOrder: args.sortOrder });
  },
});
