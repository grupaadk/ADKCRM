import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser, userIdentifier } from "./lib/auth";

const stageKeyValidator = v.union(
  v.literal("kitting"),
  v.literal("production"),
  v.literal("installation"),
);

export const listByOrderStage = query({
  args: {
    orderId: v.id("orders"),
    stageKey: stageKeyValidator,
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const items = await ctx.db
      .query("stageChecklists")
      .withIndex("by_order_stage", (q) =>
        q.eq("orderId", args.orderId).eq("stageKey", args.stageKey),
      )
      .take(200);
    return items.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
  },
});

export const create = mutation({
  args: {
    orderId: v.id("orders"),
    stageKey: stageKeyValidator,
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const title = args.title.trim();
    if (!title) {
      throw new Error("Treść punktu checklisty nie może być pusta.");
    }

    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Nie znaleziono zlecenia.");
    }

    const existing = await ctx.db
      .query("stageChecklists")
      .withIndex("by_order_stage", (q) =>
        q.eq("orderId", args.orderId).eq("stageKey", args.stageKey),
      )
      .take(200);

    const maxSort = existing.reduce((acc, item) => Math.max(acc, item.sortOrder), -1);

    return await ctx.db.insert("stageChecklists", {
      orderId: args.orderId,
      stageKey: args.stageKey,
      title,
      done: false,
      sortOrder: maxSort + 1,
      createdAt: Date.now(),
      createdBy: userIdentifier(user),
    });
  },
});

export const toggle = mutation({
  args: {
    itemId: v.id("stageChecklists"),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const item = await ctx.db.get(args.itemId);
    if (!item) {
      throw new Error("Nie znaleziono punktu checklisty.");
    }
    const nextDone = !item.done;
    await ctx.db.patch(args.itemId, {
      done: nextDone,
      completedAt: nextDone ? Date.now() : undefined,
    });
    return nextDone;
  },
});

export const remove = mutation({
  args: {
    itemId: v.id("stageChecklists"),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const item = await ctx.db.get(args.itemId);
    if (!item) {
      return;
    }
    await ctx.db.delete(args.itemId);
  },
});
