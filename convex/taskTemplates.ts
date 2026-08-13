import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireUser, requireRole, userIdentifier } from "./lib/auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return ctx.db.query("taskTemplates").order("desc").collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    items: v.array(v.object({ title: v.string() })),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "admin");
    if (!args.name.trim()) {
      throw new ConvexError("Nazwa szablonu nie może być pusta.");
    }
    if (args.items.length === 0) {
      throw new ConvexError("Szablon musi mieć co najmniej jedno zadanie.");
    }
    return ctx.db.insert("taskTemplates", {
      name: args.name.trim(),
      items: args.items.filter((i) => i.title.trim()),
      createdBy: userIdentifier(user),
    });
  },
});

export const update = mutation({
  args: {
    templateId: v.id("taskTemplates"),
    name: v.optional(v.string()),
    items: v.optional(v.array(v.object({ title: v.string() }))),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");
    const existing = await ctx.db.get(args.templateId);
    if (!existing) throw new ConvexError("Szablon nie znaleziony.");

    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) {
      if (!args.name.trim()) throw new ConvexError("Nazwa szablonu nie może być pusta.");
      patch.name = args.name.trim();
    }
    if (args.items !== undefined) {
      const filtered = args.items.filter((i) => i.title.trim());
      if (filtered.length === 0) {
        throw new ConvexError("Szablon musi mieć co najmniej jedno zadanie.");
      }
      patch.items = filtered;
    }
    await ctx.db.patch(args.templateId, patch);
  },
});

export const remove = mutation({
  args: { templateId: v.id("taskTemplates") },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");
    const existing = await ctx.db.get(args.templateId);
    if (!existing) throw new ConvexError("Szablon nie znaleziony.");
    await ctx.db.delete(args.templateId);
  },
});

export const applyToOrder = mutation({
  args: {
    templateId: v.id("taskTemplates"),
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new ConvexError("Szablon nie znaleziony.");
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new ConvexError("Zlecenie nie znalezione.");

    const createdBy = userIdentifier(user);
    for (const item of template.items) {
      await ctx.db.insert("orderTasks", {
        orderId: args.orderId,
        title: item.title,
        status: "todo",
        createdBy,
      });
    }
  },
});
