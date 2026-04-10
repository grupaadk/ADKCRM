import { v } from "convex/values";
import { query } from "./_generated/server";

// Historia zdarzeń klienta
export const listByClient = query({
  args: {
    clientId: v.id("clients"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("clientEvents")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

// Historia zdarzeń zlecenia
export const listByOrder = query({
  args: {
    orderId: v.id("orders"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("clientEvents")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .order("desc")
      .take(args.limit ?? 50);
  },
});
