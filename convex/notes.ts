import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireUser, userIdentifier } from "./lib/auth";

export const listByClient = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("clientNotes")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .order("desc")
      .collect();
  },
});

export const listByOrder = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("clientNotes")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .order("desc")
      .collect();
  },
});

export const add = mutation({
  args: {
    clientId: v.id("clients"),
    orderId: v.optional(v.id("orders")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const userId = userIdentifier(user);

    await ctx.db.insert("clientNotes", {
      clientId: args.clientId,
      orderId: args.orderId,
      content: args.content.trim(),
      createdBy: userId,
      createdByColor: user.color,
    });
  },
});

export const remove = mutation({
  args: { noteId: v.id("clientNotes") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const userId = userIdentifier(user);

    const note = await ctx.db.get(args.noteId);
    if (!note) throw new Error("Note not found");
    if (note.createdBy !== userId && user.role !== "admin") {
      throw new Error("Not authorized to delete this note");
    }

    await ctx.db.delete(args.noteId);
  },
});

export const update = mutation({
  args: {
    noteId: v.id("clientNotes"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const userId = userIdentifier(user);

    const note = await ctx.db.get(args.noteId);
    if (!note) throw new Error("Nie znaleziono notatki");
    if (note.createdBy !== userId && user.role !== "admin") {
      throw new Error("Brak uprawnień do edycji tej notatki");
    }

    await ctx.db.patch(args.noteId, {
      content: args.content.trim(),
    });
  },
});
