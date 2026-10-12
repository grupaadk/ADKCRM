import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const serviceValidator = {
  name: v.string(),
  provider: v.optional(v.string()),
  description: v.optional(v.string()),
  category: v.optional(v.string()),
  cost: v.number(),
  currency: v.string(),
  billingCycle: v.union(
    v.literal("monthly"),
    v.literal("yearly"),
    v.literal("quarterly"),
    v.literal("usage_based")
  ),
  status: v.optional(
    v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("trial"),
      v.literal("cancelled")
    )
  ),
  renewalDay: v.optional(v.number()),
  renewalDate: v.optional(v.string()),
  paymentMethod: v.optional(v.string()),
  websiteUrl: v.optional(v.string()),
  adminEmail: v.optional(v.string()),
  password: v.optional(v.string()),
  invoiceRecipient: v.optional(v.string()),
  notes: v.optional(v.string()),
};

/**
 * Pobiera listę wszystkich usług i subskrypcji IT.
 */
export const getServices = query({
  args: {},
  handler: async (ctx) => {
    const services = await ctx.db.query("itServices").take(200);
    return services.sort((a, b) => a.name.localeCompare(b.name, "pl"));
  },
});

/**
 * Dodaje nową usługę IT / subskrypcję.
 */
export const createService = mutation({
  args: serviceValidator,
  handler: async (ctx, args) => {
    const trimmedName = args.name.trim();
    if (!trimmedName) {
      throw new Error("Nazwa usługi nie może być pusta.");
    }

    const now = Date.now();
    const serviceId = await ctx.db.insert("itServices", {
      ...args,
      name: trimmedName,
      provider: args.provider?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });

    return serviceId;
  },
});

/**
 * Aktualizuje istniejącą usługę IT.
 */
export const updateService = mutation({
  args: {
    id: v.id("itServices"),
    ...serviceValidator,
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const existing = await ctx.db.get("itServices", id);
    if (!existing) {
      throw new Error("Usługa IT nie istnieje.");
    }

    const trimmedName = fields.name.trim();
    if (!trimmedName) {
      throw new Error("Nazwa usługi nie może być pusta.");
    }

    await ctx.db.patch(id, {
      ...fields,
      name: trimmedName,
      provider: fields.provider?.trim() || undefined,
      updatedAt: Date.now(),
    });

    return id;
  },
});

/**
 * Usuwa usługę IT.
 */
export const deleteService = mutation({
  args: {
    id: v.id("itServices"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get("itServices", args.id);
    if (!existing) {
      throw new Error("Usługa IT nie istnieje.");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});
