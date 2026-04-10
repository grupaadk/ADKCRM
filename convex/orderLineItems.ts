import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

function calcTotals(items: Array<{ quantity: number; unitPrice: number; vatRate: number; discountPercent?: number }>) {
  let totalNet = 0;
  let totalGross = 0;
  for (const item of items) {
    const discount = item.discountPercent ?? 0;
    const net = item.quantity * item.unitPrice * (1 - discount / 100);
    totalNet += net;
    totalGross += net * (1 + item.vatRate / 100);
  }
  return {
    totalNet: Math.round(totalNet * 100) / 100,
    totalGross: Math.round(totalGross * 100) / 100,
    totalVat: Math.round((totalGross - totalNet) * 100) / 100,
  };
}

export const listByOrder = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("orderLineItems")
      .withIndex("by_order_sort", (q) => q.eq("orderId", args.orderId))
      .order("asc")
      .collect();

    const totals = calcTotals(items);
    return { items, totals };
  },
});

export const add = mutation({
  args: {
    orderId: v.id("orders"),
    serviceId: v.optional(v.id("servicePricing")),
    name: v.string(),
    description: v.optional(v.string()),
    quantity: v.number(),
    unit: v.string(),
    unitPrice: v.number(),
    vatRate: v.number(),
    discountPercent: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? "anonymous";

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Zlecenie nie znalezione");

    const existing = await ctx.db
      .query("orderLineItems")
      .withIndex("by_order_sort", (q) => q.eq("orderId", args.orderId))
      .order("desc")
      .first();
    const sortOrder = (existing?.sortOrder ?? 0) + 1;

    return ctx.db.insert("orderLineItems", {
      ...args,
      sortOrder,
      createdBy: userId,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("orderLineItems"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    quantity: v.optional(v.number()),
    unit: v.optional(v.string()),
    unitPrice: v.optional(v.number()),
    vatRate: v.optional(v.number()),
    discountPercent: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Nie znaleziono pozycji");

    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) updates[key] = value;
    }
    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("orderLineItems") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Nie znaleziono pozycji");
    await ctx.db.delete(args.id);
  },
});
