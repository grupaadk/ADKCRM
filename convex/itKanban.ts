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
    sprintId: v.optional(v.id("itKanbanSprints")),
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
      sprintId: args.sprintId,
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
    sprintId: v.optional(v.union(v.id("itKanbanSprints"), v.null())),
    isCompleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const { id, sprintId, ...updates } = args;
    const filtered: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined) filtered[key] = val;
    }
    if (sprintId !== undefined) {
      filtered.sprintId = sprintId === null ? undefined : sprintId;
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

// --- SPRINTS ---

export const getSprints = query({
  args: {},
  handler: async (ctx) => {
    const sprints = await ctx.db.query("itKanbanSprints").collect();
    return sprints;
  },
});

export const createSprint = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    await ctx.db.insert("itKanbanSprints", {
      name: args.name,
      status: "planned",
    });
  },
});

export const updateSprintStatus = mutation({
  args: {
    id: v.id("itKanbanSprints"),
    status: v.union(v.literal("planned"), v.literal("active"), v.literal("completed")),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    
    // Jeśli ustawiamy ten sprint jako aktywny, musimy upewnić się, że nie ma innych aktywnych sprintów.
    if (args.status === "active") {
      const activeSprints = await ctx.db.query("itKanbanSprints").filter((q) => q.eq(q.field("status"), "active")).collect();
      for (const sprint of activeSprints) {
        if (sprint._id !== args.id) {
          await ctx.db.patch(sprint._id, { status: "completed", endDate: Date.now() });
        }
      }
      await ctx.db.patch(args.id, { status: args.status, startDate: Date.now(), endDate: undefined });
    } else if (args.status === "completed") {
      // Roll-over uncompleted tasks to the backlog
      const sprintTasks = await ctx.db.query("itKanbanTasks").withIndex("by_sprint", (q) => q.eq("sprintId", args.id)).collect();
      for (const task of sprintTasks) {
        if (!task.isCompleted) {
          await ctx.db.patch(task._id, { sprintId: undefined });
        }
      }
      await ctx.db.patch(args.id, { status: args.status, endDate: Date.now() });
    } else {
      await ctx.db.patch(args.id, { status: args.status });
    }
  },
});

export const deleteSprint = mutation({
  args: {
    id: v.id("itKanbanSprints"),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    // Usuwamy przypisanie do tego sprintu ze wszystkich zadań
    const tasks = await ctx.db.query("itKanbanTasks").withIndex("by_sprint", (q) => q.eq("sprintId", args.id)).collect();
    for (const task of tasks) {
      await ctx.db.patch(task._id, { sprintId: undefined });
    }
    await ctx.db.delete(args.id);
  },
});
