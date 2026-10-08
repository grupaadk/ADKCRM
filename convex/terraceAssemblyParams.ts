import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { requireUser } from "./lib/auth";

export const DEFAULT_ASSEMBLY_PARAMS = {
  key: "default",
  defaultMarkupPercent: 52,
  assemblyRatesStandard: [
    { maxAreaSqM: 10, rateNetPerSqM: 400, costNetPerSqM: 350 },
    { maxAreaSqM: 15, rateNetPerSqM: 350, costNetPerSqM: 300 },
    { maxAreaSqM: 20, rateNetPerSqM: 300, costNetPerSqM: 250 },
    { maxAreaSqM: 25, rateNetPerSqM: 250, costNetPerSqM: 200 },
    { maxAreaSqM: 9999, rateNetPerSqM: 200, costNetPerSqM: 180 },
  ],
  assemblyRatesNonStandard: [
    { maxAreaSqM: 10, rateNetPerSqM: 450, costNetPerSqM: 400 },
    { maxAreaSqM: 15, rateNetPerSqM: 400, costNetPerSqM: 350 },
    { maxAreaSqM: 20, rateNetPerSqM: 350, costNetPerSqM: 300 },
    { maxAreaSqM: 25, rateNetPerSqM: 300, costNetPerSqM: 250 },
    { maxAreaSqM: 9999, rateNetPerSqM: 250, costNetPerSqM: 200 },
  ],
  glassAddonsStandard: [
    { maxDepthCm: 300, addonNetPerSqM: 230 },
    { maxDepthCm: 350, addonNetPerSqM: 280 },
    { maxDepthCm: 400, addonNetPerSqM: 310 },
  ],
  glassAddonsNonStandard: [
    { maxDepthCm: 300, addonNetPerSqM: 430 },
    { maxDepthCm: 350, addonNetPerSqM: 490 },
    { maxDepthCm: 400, addonNetPerSqM: 580 },
  ],
};

/**
 * Pobiera parametry montażu i narzutu. Jeśli brak w bazie, zwraca wartości domyślne.
 */
export const getParams = query({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("terraceAssemblyParams")
      .withIndex("by_key", (q) => q.eq("key", "default"))
      .first();

    if (existing) {
      return existing;
    }

    return {
      _id: "default_params" as any,
      ...DEFAULT_ASSEMBLY_PARAMS,
      updatedAt: Date.now(),
      updatedBy: "system",
    };
  },
});

/**
 * Zapisuje parametry montażu (dostępne dla administratorów i kierowników).
 */
export const updateParams = mutation({
  args: {
    defaultMarkupPercent: v.number(),
    assemblyRatesStandard: v.array(
      v.object({
        maxAreaSqM: v.number(),
        rateNetPerSqM: v.number(),
        costNetPerSqM: v.number(),
      })
    ),
    assemblyRatesNonStandard: v.array(
      v.object({
        maxAreaSqM: v.number(),
        rateNetPerSqM: v.number(),
        costNetPerSqM: v.number(),
      })
    ),
    glassAddonsStandard: v.optional(
      v.array(
        v.object({
          maxDepthCm: v.number(),
          addonNetPerSqM: v.number(),
        })
      )
    ),
    glassAddonsNonStandard: v.optional(
      v.array(
        v.object({
          maxDepthCm: v.number(),
          addonNetPerSqM: v.number(),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (user.role !== "admin") {
      throw new Error("Tylko administratorzy mogą zmieniać parametry wycen.");
    }

    const existing = await ctx.db
      .query("terraceAssemblyParams")
      .withIndex("by_key", (q) => q.eq("key", "default"))
      .first();

    const payload = {
      key: "default",
      ...args,
      updatedAt: Date.now(),
      updatedBy: user.displayName ?? user.email ?? "Admin",
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    } else {
      return await ctx.db.insert("terraceAssemblyParams", payload);
    }
  },
});
