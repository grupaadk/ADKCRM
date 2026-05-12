import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getConfig = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("crmConfig").first();
  },
});

export const saveStatusLabels = mutation({
  args: {
    statusLabels: v.object({
      lead: v.optional(v.string()),
      inquiry: v.optional(v.string()),
      measurement: v.optional(v.string()),
      offer: v.optional(v.string()),
      contract: v.optional(v.string()),
      production: v.optional(v.string()),
      installation: v.optional(v.string()),
      completed: v.optional(v.string()),
      complaint: v.optional(v.string()),
      archived: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("crmConfig").first();
    if (existing) {
      await ctx.db.patch(existing._id, { statusLabels: args.statusLabels });
    } else {
      await ctx.db.insert("crmConfig", { statusLabels: args.statusLabels });
    }
  },
});
