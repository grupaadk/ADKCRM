import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: { includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    if (args.includeInactive) {
      return ctx.db.query("servicePricing").order("asc").collect();
    }
    return ctx.db
      .query("servicePricing")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .order("asc")
      .collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    unit: v.string(),
    unitPrice: v.number(),
    vatRate: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? "anonymous";

    return ctx.db.insert("servicePricing", {
      ...args,
      isActive: true,
      createdBy: userId,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("servicePricing"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    unit: v.optional(v.string()),
    unitPrice: v.optional(v.number()),
    vatRate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Nie znaleziono pozycji cennika");

    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) updates[key] = value;
    }
    await ctx.db.patch(id, updates);
  },
});

export const toggleActive = mutation({
  args: { id: v.id("servicePricing") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Nie znaleziono pozycji cennika");
    await ctx.db.patch(args.id, { isActive: !existing.isActive });
  },
});

export const remove = mutation({
  args: { id: v.id("servicePricing") },
  handler: async (ctx, args) => {
    // Sprawdź czy używana w pozycjach zamówień
    const usage = await ctx.db
      .query("orderLineItems")
      .filter((q) => q.eq(q.field("serviceId"), args.id))
      .first();
    if (usage) {
      throw new Error(
        "Nie można usunąć — usługa jest używana w pozycjach zamówień. Dezaktywuj zamiast usuwać.",
      );
    }
    await ctx.db.delete(args.id);
  },
});
