import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Domyślne zestawienie cennikowe zadaszeń
const POLYCARBONATE_PRICES = [
  { widthCm: 300, lengthCm: 306, priceGross: 4130, priceNet: 3358 },
  { widthCm: 300, lengthCm: 406, priceGross: 5270, priceNet: 4285 },
  { widthCm: 300, lengthCm: 506, priceGross: 6580, priceNet: 5350 },
  { widthCm: 300, lengthCm: 606, priceGross: 7520, priceNet: 6114 },
  { widthCm: 300, lengthCm: 706, priceGross: 8740, priceNet: 7106 },
  { widthCm: 300, lengthCm: 806, priceGross: 10550, priceNet: 8577 },
  { widthCm: 300, lengthCm: 906, priceGross: 11850, priceNet: 9634 },
  { widthCm: 300, lengthCm: 1006, priceGross: 13150, priceNet: 10691 },
  { widthCm: 300, lengthCm: 1106, priceGross: 14100, priceNet: 11463 },
  { widthCm: 300, lengthCm: 1206, priceGross: 15050, priceNet: 12236 },
  { widthCm: 350, lengthCm: 306, priceGross: 4340, priceNet: 3528 },
  { widthCm: 350, lengthCm: 406, priceGross: 5700, priceNet: 4634 },
  { widthCm: 350, lengthCm: 506, priceGross: 7100, priceNet: 5772 },
  { widthCm: 350, lengthCm: 606, priceGross: 8130, priceNet: 6610 },
  { widthCm: 350, lengthCm: 706, priceGross: 9440, priceNet: 7675 },
  { widthCm: 350, lengthCm: 806, priceGross: 11400, priceNet: 9268 },
  { widthCm: 350, lengthCm: 906, priceGross: 12800, priceNet: 10407 },
  { widthCm: 350, lengthCm: 1006, priceGross: 14200, priceNet: 11545 },
  { widthCm: 350, lengthCm: 1106, priceGross: 15230, priceNet: 12382 },
  { widthCm: 350, lengthCm: 1206, priceGross: 16260, priceNet: 13220 },
  { widthCm: 400, lengthCm: 306, priceGross: 5010, priceNet: 4073 },
  { widthCm: 400, lengthCm: 406, priceGross: 6130, priceNet: 4984 },
  { widthCm: 400, lengthCm: 506, priceGross: 7620, priceNet: 6195 },
  { widthCm: 400, lengthCm: 606, priceGross: 8350, priceNet: 6789 },
  { widthCm: 400, lengthCm: 706, priceGross: 10160, priceNet: 8260 },
  { widthCm: 400, lengthCm: 806, priceGross: 12250, priceNet: 9959 },
  { widthCm: 400, lengthCm: 906, priceGross: 13750, priceNet: 11179 },
  { widthCm: 400, lengthCm: 1006, priceGross: 15250, priceNet: 12398 },
  { widthCm: 400, lengthCm: 1106, priceGross: 15970, priceNet: 12984 },
  { widthCm: 400, lengthCm: 1206, priceGross: 16700, priceNet: 13577 },
];

const GLASS_PRICES = [
  { widthCm: 300, lengthCm: 306, priceGross: 5780, priceNet: 4699 },
  { widthCm: 300, lengthCm: 406, priceGross: 7520, priceNet: 6114 },
  { widthCm: 300, lengthCm: 506, priceGross: 9360, priceNet: 7610 },
  { widthCm: 300, lengthCm: 606, priceGross: 10910, priceNet: 8870 },
  { widthCm: 300, lengthCm: 706, priceGross: 12670, priceNet: 10301 },
  { widthCm: 300, lengthCm: 806, priceGross: 15230, priceNet: 12382 },
  { widthCm: 300, lengthCm: 906, priceGross: 17080, priceNet: 13886 },
  { widthCm: 300, lengthCm: 1006, priceGross: 18930, priceNet: 15390 },
  { widthCm: 300, lengthCm: 1106, priceGross: 20460, priceNet: 16634 },
  { widthCm: 300, lengthCm: 1206, priceGross: 22010, priceNet: 17894 },
  { widthCm: 350, lengthCm: 306, priceGross: 6620, priceNet: 5382 },
  { widthCm: 350, lengthCm: 406, priceGross: 8750, priceNet: 7114 },
  { widthCm: 350, lengthCm: 506, priceGross: 11010, priceNet: 8951 },
  { widthCm: 350, lengthCm: 606, priceGross: 12820, priceNet: 10423 },
  { widthCm: 350, lengthCm: 706, priceGross: 14820, priceNet: 12049 },
  { widthCm: 350, lengthCm: 806, priceGross: 17840, priceNet: 14504 },
  { widthCm: 350, lengthCm: 906, priceGross: 20110, priceNet: 16350 },
  { widthCm: 350, lengthCm: 1006, priceGross: 22340, priceNet: 18163 },
  { widthCm: 350, lengthCm: 1106, priceGross: 24170, priceNet: 19650 },
  { widthCm: 350, lengthCm: 1206, priceGross: 25960, priceNet: 21106 },
  { widthCm: 400, lengthCm: 306, priceGross: 8120, priceNet: 6602 },
  { widthCm: 400, lengthCm: 406, priceGross: 10240, priceNet: 8325 },
  { widthCm: 400, lengthCm: 506, priceGross: 12670, priceNet: 10301 },
  { widthCm: 400, lengthCm: 606, priceGross: 14340, priceNet: 11659 },
  { widthCm: 400, lengthCm: 706, priceGross: 16990, priceNet: 13813 },
  { widthCm: 400, lengthCm: 806, priceGross: 20470, priceNet: 16642 },
  { widthCm: 400, lengthCm: 906, priceGross: 22910, priceNet: 18626 },
  { widthCm: 400, lengthCm: 1006, priceGross: 25350, priceNet: 20610 },
  { widthCm: 400, lengthCm: 1106, priceGross: 27000, priceNet: 21951 },
  { widthCm: 400, lengthCm: 1206, priceGross: 28660, priceNet: 23301 },
];

/**
 * Pobiera listę cen zadaszeń z podziałem lub filtracją wg materiału
 */
export const listTerracePrices = query({
  args: {
    material: v.optional(v.union(v.literal("polycarbonate"), v.literal("glass"))),
  },
  handler: async (ctx, args) => {
    if (args.material) {
      return await ctx.db
        .query("terraceRoofPricing")
        .withIndex("by_material", (q) => q.eq("material", args.material!))
        .collect();
    }
    return await ctx.db.query("terraceRoofPricing").collect();
  },
});

/**
 * Wyszukuje dokładny wariant zadaszenia
 */
export const getTerracePrice = query({
  args: {
    material: v.union(v.literal("polycarbonate"), v.literal("glass")),
    widthCm: v.number(),
    lengthCm: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("terraceRoofPricing")
      .withIndex("by_material_dimensions", (q) =>
        q.eq("material", args.material).eq("widthCm", args.widthCm).eq("lengthCm", args.lengthCm)
      )
      .first();
  },
});

/**
 * Aktualizuje lub dodaje wpis cennikowy dla zadaszenia
 */
export const upsertTerracePrice = mutation({
  args: {
    material: v.union(v.literal("polycarbonate"), v.literal("glass")),
    widthCm: v.number(),
    lengthCm: v.number(),
    priceGross: v.number(),
    priceNet: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("terraceRoofPricing")
      .withIndex("by_material_dimensions", (q) =>
        q.eq("material", args.material).eq("widthCm", args.widthCm).eq("lengthCm", args.lengthCm)
      )
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        priceGross: args.priceGross,
        priceNet: args.priceNet,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("terraceRoofPricing", {
        material: args.material,
        widthCm: args.widthCm,
        lengthCm: args.lengthCm,
        priceGross: args.priceGross,
        priceNet: args.priceNet,
        updatedAt: now,
      });
    }
  },
});

/**
 * Inicjalizuje cennik zadaszeń domyślnym zestawieniem danych od dystrybutora
 */
export const seedDefaultTerracePrices = mutation({
  args: {
    overwrite: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existingCount = (await ctx.db.query("terraceRoofPricing").take(1)).length;

    if (existingCount > 0 && !args.overwrite) {
      return { seeded: 0, message: "Cennik został już wcześniej zainicjalizowany." };
    }

    if (args.overwrite && existingCount > 0) {
      const all = await ctx.db.query("terraceRoofPricing").collect();
      for (const doc of all) {
        await ctx.db.delete(doc._id);
      }
    }

    let count = 0;
    for (const item of POLYCARBONATE_PRICES) {
      await ctx.db.insert("terraceRoofPricing", {
        material: "polycarbonate",
        ...item,
        updatedAt: now,
      });
      count++;
    }

    for (const item of GLASS_PRICES) {
      await ctx.db.insert("terraceRoofPricing", {
        material: "glass",
        ...item,
        updatedAt: now,
      });
      count++;
    }

    return { seeded: count, message: `Pomyślnie dodano ${count} pozycji cennikowych zadaszeń.` };
  },
});
