import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireUser } from "./lib/auth";

export const getColumns = query({
  args: {},
  handler: async (ctx) => {
    const columns = await ctx.db.query("itKanbanColumns").withIndex("by_order").collect();
    return columns;
  },
});

export const getTasks = query({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db.query("itKanbanTasks").collect();
    return tasks;
  },
});

export const createColumn = mutation({
  args: {
    title: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const existing = await ctx.db.query("itKanbanColumns").withIndex("by_order").collect();
    const order = existing.length > 0 ? Math.max(...existing.map((c) => c.order)) + 1 : 0;

    await ctx.db.insert("itKanbanColumns", {
      title: args.title,
      color: args.color,
      order,
    });
  },
});

export const updateColumn = mutation({
  args: {
    id: v.id("itKanbanColumns"),
    title: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const { id, ...updates } = args;
    const filtered: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined) filtered[key] = val;
    }
    await ctx.db.patch(id, filtered);
  },
});

export const deleteColumn = mutation({
  args: {
    id: v.id("itKanbanColumns"),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const tasks = await ctx.db.query("itKanbanTasks").withIndex("by_column", (q) => q.eq("columnId", args.id)).collect();
    if (tasks.length > 0) {
      throw new Error("Nie można usunąć kolumny, w której są zadania.");
    }
    await ctx.db.delete(args.id);
  },
});

export const reorderColumns = mutation({
  args: {
    updates: v.array(v.object({ id: v.id("itKanbanColumns"), order: v.number() })),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    for (const update of args.updates) {
      await ctx.db.patch(update.id, { order: update.order });
    }
  },
});

export const createTask = mutation({
  args: {
    columnId: v.id("itKanbanColumns"),
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.union(v.literal("low"), v.literal("normal"), v.literal("high")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    
    const existing = await ctx.db.query("itKanbanTasks").withIndex("by_column", (q) => q.eq("columnId", args.columnId)).collect();
    const position = existing.length > 0 ? Math.max(...existing.map((t) => t.position)) + 1 : 0;

    await ctx.db.insert("itKanbanTasks", {
      columnId: args.columnId,
      title: args.title,
      description: args.description,
      priority: args.priority,
      position,
      createdBy: user._id,
      createdAt: Date.now(),
    });
  },
});

export const updateTask = mutation({
  args: {
    id: v.id("itKanbanTasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    priority: v.optional(v.union(v.literal("low"), v.literal("normal"), v.literal("high"))),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const { id, ...updates } = args;
    const filtered: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined) filtered[key] = val;
    }
    await ctx.db.patch(id, filtered);
  },
});

export const deleteTask = mutation({
  args: { id: v.id("itKanbanTasks") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    await ctx.db.delete(args.id);
  },
});

export const moveTask = mutation({
  args: {
    id: v.id("itKanbanTasks"),
    columnId: v.id("itKanbanColumns"),
    position: v.number(),
    otherUpdates: v.optional(v.array(v.object({ id: v.id("itKanbanTasks"), position: v.number() }))),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    await ctx.db.patch(args.id, { columnId: args.columnId, position: args.position });
    
    if (args.otherUpdates) {
      for (const update of args.otherUpdates) {
        await ctx.db.patch(update.id, { position: update.position });
      }
    }
  },
});
