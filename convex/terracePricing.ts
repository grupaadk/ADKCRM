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

// Domyślne zestawienie cen ścian przesuwnych
const WALL_SLIDING_PRICES = [
  { type: "sliding" as const, tracksCount: 2, widthCm: 194, heightCm: 230, priceGross: 2050, priceNet: 1667 },
  { type: "sliding" as const, tracksCount: 3, widthCm: 241, heightCm: 230, priceGross: 2990, priceNet: 2431 },
  { type: "sliding" as const, tracksCount: 3, widthCm: 290, heightCm: 230, priceGross: 2990, priceNet: 2431 },
  { type: "sliding" as const, tracksCount: 4, widthCm: 337, heightCm: 230, priceGross: 4080, priceNet: 3317 },
  { type: "sliding" as const, tracksCount: 4, widthCm: 386, heightCm: 230, priceGross: 4080, priceNet: 3317 },
  { type: "sliding" as const, tracksCount: 5, widthCm: 433, heightCm: 230, priceGross: 5220, priceNet: 4244 },
  { type: "sliding" as const, tracksCount: 5, widthCm: 482, heightCm: 230, priceGross: 5220, priceNet: 4244 },
  { type: "sliding" as const, tracksCount: 6, widthCm: 529, heightCm: 230, priceGross: 6550, priceNet: 5325 },
  { type: "sliding" as const, tracksCount: 6, widthCm: 578, heightCm: 230, priceGross: 6550, priceNet: 5325 },
];

// Domyślne zestawienie cen stałych ścian z poliwęglanu komorowego 16mm
const WALL_FIXED_POLYCARBONATE_PRICES = [
  { type: "fixed_polycarbonate" as const, widthCm: 290, heightCm: 230, priceGross: 3040, priceNet: 2472 },
  { type: "fixed_polycarbonate" as const, widthCm: 340, heightCm: 230, priceGross: 3720, priceNet: 3024 },
  { type: "fixed_polycarbonate" as const, widthCm: 390, heightCm: 230, priceGross: 4120, priceNet: 3350 },
  { type: "fixed_polycarbonate" as const, widthCm: 440, heightCm: 230, priceGross: 4510, priceNet: 3667 },
  { type: "fixed_polycarbonate" as const, widthCm: 490, heightCm: 230, priceGross: 5020, priceNet: 4081 },
  { type: "fixed_polycarbonate" as const, widthCm: 540, heightCm: 230, priceGross: 5510, priceNet: 4480 },
  { type: "fixed_polycarbonate" as const, widthCm: 590, heightCm: 230, priceGross: 6020, priceNet: 4894 },
];

/**
 * Pobiera cennik ścian tarasowych (z opcją filtracji wg typu)
 */
export const listTerraceWallPrices = query({
  args: {
    type: v.optional(v.union(v.literal("sliding"), v.literal("fixed_polycarbonate"))),
  },
  handler: async (ctx, args) => {
    if (args.type) {
      return await ctx.db
        .query("terraceWallPricing")
        .withIndex("by_type", (q) => q.eq("type", args.type))
        .collect();
    }
    return await ctx.db.query("terraceWallPricing").collect();
  },
});

/**
 * Aktualizuje lub dodaje wpis ścian tarasowych
 */
export const upsertTerraceWallPrice = mutation({
  args: {
    type: v.union(v.literal("sliding"), v.literal("fixed_polycarbonate")),
    tracksCount: v.optional(v.number()),
    widthCm: v.number(),
    heightCm: v.number(),
    priceGross: v.number(),
    priceNet: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("terraceWallPricing")
      .withIndex("by_dimensions", (q) =>
        q.eq("widthCm", args.widthCm).eq("heightCm", args.heightCm)
      )
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        type: args.type,
        tracksCount: args.tracksCount,
        priceGross: args.priceGross,
        priceNet: args.priceNet,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("terraceWallPricing", {
        type: args.type,
        tracksCount: args.tracksCount,
        widthCm: args.widthCm,
        heightCm: args.heightCm,
        priceGross: args.priceGross,
        priceNet: args.priceNet,
        updatedAt: now,
      });
    }
  },
});

/**
 * Inicjalizuje domyślny cennik ścian przesuwnych oraz stałych
 */
export const seedDefaultTerraceWallPrices = mutation({
  args: {
    overwrite: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existingCount = (await ctx.db.query("terraceWallPricing").take(1)).length;

    if (existingCount > 0 && !args.overwrite) {
      return { seeded: 0, message: "Cennik ścian został już wcześniej zainicjalizowany." };
    }

    if (args.overwrite && existingCount > 0) {
      const all = await ctx.db.query("terraceWallPricing").collect();
      for (const doc of all) {
        await ctx.db.delete(doc._id);
      }
    }

    let count = 0;
    for (const item of WALL_SLIDING_PRICES) {
      await ctx.db.insert("terraceWallPricing", {
        ...item,
        updatedAt: now,
      });
      count++;
    }

    for (const item of WALL_FIXED_POLYCARBONATE_PRICES) {
      await ctx.db.insert("terraceWallPricing", {
        ...item,
        updatedAt: now,
      });
      count++;
    }

    return { seeded: count, message: `Pomyślnie dodano ${count} pozycji cennikowych ścian (przesuwne i stałe).` };
  },
});

// Domyślne zestawienie cen trójkątów bocznych i dopłat do szkła / dodatków
const TRIANGLES_AND_EXTRAS_PRICES = [
  { tracksCount: 2, widthCm: 194, heightCm: 230, tintedGlassGross: 240, tintedGlassNet: 195, frostedGlassGross: 200, frostedGlassNet: 163, dustBrushesGross: 80, dustBrushesNet: 65, glassHandlesGross: 70, glassHandlesNet: 57, trianglePolycarbonateGross: 1050, trianglePolycarbonateNet: 854 },
  { tracksCount: 3, widthCm: 241, heightCm: 230, tintedGlassGross: 360, tintedGlassNet: 293, frostedGlassGross: 300, frostedGlassNet: 244, dustBrushesGross: 110, dustBrushesNet: 89, glassHandlesGross: 100, glassHandlesNet: 81, trianglePolycarbonateGross: 1050, trianglePolycarbonateNet: 854 },
  { tracksCount: 3, widthCm: 290, heightCm: 230, tintedGlassGross: 360, tintedGlassNet: 293, frostedGlassGross: 300, frostedGlassNet: 244, dustBrushesGross: 110, dustBrushesNet: 89, glassHandlesGross: 100, glassHandlesNet: 81, trianglePolycarbonateGross: 1050, trianglePolycarbonateNet: 854 },
  { tracksCount: 4, widthCm: 337, heightCm: 230, tintedGlassGross: 480, tintedGlassNet: 390, frostedGlassGross: 400, frostedGlassNet: 325, dustBrushesGross: 150, dustBrushesNet: 122, glassHandlesGross: 140, glassHandlesNet: 114, trianglePolycarbonateGross: 1250, trianglePolycarbonateNet: 1016 },
  { tracksCount: 4, widthCm: 386, heightCm: 230, tintedGlassGross: 480, tintedGlassNet: 390, frostedGlassGross: 400, frostedGlassNet: 325, dustBrushesGross: 150, dustBrushesNet: 122, glassHandlesGross: 140, glassHandlesNet: 114, trianglePolycarbonateGross: 1450, trianglePolycarbonateNet: 1179 },
  { tracksCount: 5, widthCm: 433, heightCm: 230, tintedGlassGross: 600, tintedGlassNet: 488, frostedGlassGross: 500, frostedGlassNet: 407, dustBrushesGross: 190, dustBrushesNet: 154, glassHandlesGross: 170, glassHandlesNet: 138, trianglePolycarbonateGross: 1800, trianglePolycarbonateNet: 1463 },
  { tracksCount: 5, widthCm: 482, heightCm: 230, tintedGlassGross: 600, tintedGlassNet: 488, frostedGlassGross: 500, frostedGlassNet: 407, dustBrushesGross: 190, dustBrushesNet: 154, glassHandlesGross: 170, glassHandlesNet: 138, trianglePolycarbonateGross: 2100, trianglePolycarbonateNet: 1707 },
  { tracksCount: 6, widthCm: 529, heightCm: 230, tintedGlassGross: 720, tintedGlassNet: 585, frostedGlassGross: 600, frostedGlassNet: 488, dustBrushesGross: 230, dustBrushesNet: 187, glassHandlesGross: 200, glassHandlesNet: 163, trianglePolycarbonateGross: 3000, trianglePolycarbonateNet: 2439 },
  { tracksCount: 6, widthCm: 578, heightCm: 230, tintedGlassGross: 720, tintedGlassNet: 585, frostedGlassGross: 600, frostedGlassNet: 488, dustBrushesGross: 230, dustBrushesNet: 187, glassHandlesGross: 200, glassHandlesNet: 163, trianglePolycarbonateGross: 3300, trianglePolycarbonateNet: 2683 },
];

/**
 * Pobiera cennik trójkątów i dodatków
 */
export const listTerraceExtrasPrices = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("terraceExtrasPricing").collect();
  },
});

/**
 * Aktualizuje lub dodaje wpis cennikowy dla trójkątów i dodatków
 */
export const upsertTerraceExtrasPrice = mutation({
  args: {
    tracksCount: v.number(),
    widthCm: v.number(),
    heightCm: v.number(),
    tintedGlassGross: v.number(),
    tintedGlassNet: v.number(),
    frostedGlassGross: v.number(),
    frostedGlassNet: v.number(),
    dustBrushesGross: v.number(),
    dustBrushesNet: v.number(),
    glassHandlesGross: v.number(),
    glassHandlesNet: v.number(),
    trianglePolycarbonateGross: v.number(),
    trianglePolycarbonateNet: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("terraceExtrasPricing")
      .withIndex("by_width", (q) => q.eq("widthCm", args.widthCm))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("terraceExtrasPricing", {
        ...args,
        updatedAt: now,
      });
    }
  },
});

/**
 * Inicjalizuje domyślny cennik trójkątów i dodatków
 */
export const seedDefaultTerraceExtrasPrices = mutation({
  args: {
    overwrite: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existingCount = (await ctx.db.query("terraceExtrasPricing").take(1)).length;

    if (existingCount > 0 && !args.overwrite) {
      return { seeded: 0, message: "Cennik trójkątów i dodatków został już wcześniej zainicjalizowany." };
    }

    if (args.overwrite && existingCount > 0) {
      const all = await ctx.db.query("terraceExtrasPricing").collect();
      for (const doc of all) {
        await ctx.db.delete(doc._id);
      }
    }

    let count = 0;
    for (const item of TRIANGLES_AND_EXTRAS_PRICES) {
      await ctx.db.insert("terraceExtrasPricing", {
        ...item,
        updatedAt: now,
      });
      count++;
    }

    return { seeded: count, message: `Pomyślnie dodano ${count} pozycji cennikowych trójkątów bocznych i dodatków.` };
  },
});

// Domyślne stawki montażu zadaszeń i ścian
const INSTALLATION_PRICES = [
  {
    name: "STIMEO - zadaszenia z poliw. - wymiar standardowy",
    unit: "m2" as const,
    rates: [
      { minM2: 0, maxM2: 10, rateNet: 400 },
      { minM2: 10, maxM2: 15, rateNet: 350 },
      { minM2: 15, maxM2: 20, rateNet: 300 },
      { minM2: 20, maxM2: 25, rateNet: 250 },
      { minM2: 25, maxM2: undefined, rateNet: 200 },
    ],
  },
  {
    name: "STIMEO - zadaszenia z poliw. - wymiar przerabiany (liczony po wykonaniu m2)",
    unit: "m2" as const,
    rates: [
      { minM2: 0, maxM2: 10, rateNet: 450 },
      { minM2: 10, maxM2: 15, rateNet: 400 },
      { minM2: 15, maxM2: 20, rateNet: 350 },
      { minM2: 20, maxM2: 25, rateNet: 300 },
      { minM2: 25, maxM2: undefined, rateNet: 250 },
    ],
  },
  {
    name: "STIMEO - trójkąty pod zadaszenie",
    unit: "mb" as const,
    flatRateNet: 250,
  },
  {
    name: "STIMEO - ścianki - szklane do zadaszeń",
    unit: "mb" as const,
    flatRateNet: 300,
  },
  {
    name: "STIMEO - fundamenty",
    unit: "mb" as const,
    flatRateNet: 100,
  },
  {
    name: "INTERFIT - ścianki całoszklane, drzwi całoszklane",
    unit: "m2" as const,
    flatRateNet: 250,
  },
];

/**
 * Pobiera cennik montażu
 */
export const listTerraceInstallationPrices = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("terraceInstallationPricing").collect();
  },
});

/**
 * Inicjalizuje cennik montażu
 */
export const seedDefaultTerraceInstallationPrices = mutation({
  args: {
    overwrite: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existingCount = (await ctx.db.query("terraceInstallationPricing").take(1)).length;

    if (existingCount > 0 && !args.overwrite) {
      return { seeded: 0, message: "Cennik montażu został już wcześniej zainicjalizowany." };
    }

    if (args.overwrite && existingCount > 0) {
      const all = await ctx.db.query("terraceInstallationPricing").collect();
      for (const doc of all) {
        await ctx.db.delete(doc._id);
      }
    }

    let count = 0;
    for (const item of INSTALLATION_PRICES) {
      await ctx.db.insert("terraceInstallationPricing", {
        ...item,
        updatedAt: now,
      });
      count++;
    }

    return { seeded: count, message: `Pomyślnie dodano ${count} pozycji cennikowych montażu.` };
  },
});
