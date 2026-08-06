import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireUser, userIdentifier } from "./lib/auth";

export const list = query({
  args: { includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    if (args.includeInactive) {
      return ctx.db.query("suppliers").order("asc").collect();
    }
    return ctx.db
      .query("suppliers")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .order("asc")
      .collect();
  },
});

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("suppliers")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .order("asc")
      .collect();
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const existing = await ctx.db
      .query("suppliers")
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();
    if (existing) throw new Error("Dostawca o tej nazwie już istnieje");

    const supplierId = await ctx.db.insert("suppliers", {
      name: args.name,
      isActive: true,
      createdBy: userIdentifier(user),
    });

    await ctx.db.insert("calendarEventTypes", {
      name: `${args.name} - Potwierdzenie`,
      color: "#10b981",
      isPrivate: false,
      linkedOrderField: "serviceDeliveries.confirmedDate",
      linkedSupplierId: supplierId,
      defaultTimeMode: "timed",
      createdAt: Date.now(),
    });

    await ctx.db.insert("calendarEventTypes", {
      name: `${args.name} - Dostawa`,
      color: "#f59e0b",
      isPrivate: false,
      linkedOrderField: "serviceDeliveries.deliveryDate",
      linkedSupplierId: supplierId,
      defaultTimeMode: "timed",
      createdAt: Date.now(),
    });

    await ctx.db.insert("calendarEventTypes", {
      name: `${args.name} - Odbiór`,
      color: "#3b82f6",
      isPrivate: false,
      linkedOrderField: "serviceDeliveries.receivedDate",
      linkedSupplierId: supplierId,
      defaultTimeMode: "timed",
      createdAt: Date.now(),
    });

    return supplierId;
  },
});

export const update = mutation({
  args: {
    id: v.id("suppliers"),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Nie znaleziono dostawcy");

    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) updates[key] = value;
    }
    await ctx.db.patch(id, updates);
  },
});

export const toggleActive = mutation({
  args: { id: v.id("suppliers") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Nie znaleziono dostawcy");
    await ctx.db.patch(args.id, { isActive: !existing.isActive });
  },
});

export const remove = mutation({
  args: { id: v.id("suppliers") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Nie znaleziono dostawcy");

    // Sprawdź czy używana w usługach
    const allServices = await ctx.db.query("services").collect();
    const usage = allServices.find((s) => s.supplierIds?.includes(args.id));
    if (usage) {
      throw new Error(
        "Nie można usunąć — dostawca jest przypisany do usług. Dezaktywuj zamiast usuwać.",
      );
    }

    await ctx.db.delete(args.id);
  },
});
