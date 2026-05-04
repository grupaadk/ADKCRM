import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";

export const insert = internalMutation({
  args: {
    level: v.union(v.literal("info"), v.literal("warn"), v.literal("error")),
    source: v.string(),
    message: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("systemLogs", args);
  },
});

export const list = query({
  args: {
    source: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    let logs;
    if (args.source) {
      logs = await ctx.db
        .query("systemLogs")
        .withIndex("by_source", (q) => q.eq("source", args.source!))
        .order("desc")
        .take(limit);
    } else {
      logs = await ctx.db
        .query("systemLogs")
        .order("desc")
        .take(limit);
    }
    return logs;
  },
});
