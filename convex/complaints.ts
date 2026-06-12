import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const getByOrderId = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("complaints")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .first();
  },
});

export const create = mutation({
  args: {
    orderId: v.id("orders"),
    clientId: v.id("clients"),
    startDate: v.number(),
    description: v.optional(v.string()),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("complaints")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .first();
    if (existing) return existing._id;
    const complaintId = await ctx.db.insert("complaints", {
      orderId: args.orderId,
      clientId: args.clientId,
      status: "w_toku",
      description: args.description,
      notes: [],
      startDate: args.startDate,
      todos: [],
      createdBy: args.createdBy,
    });
    await ctx.scheduler.runAfter(0, internal.googleDrive.createComplaintFolder, {
      complaintId,
      orderId: args.orderId,
    });
    return complaintId;
  },
});

export const setFolderId = internalMutation({
  args: {
    complaintId: v.id("complaints"),
    folderId: v.string(),
    folderUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.complaintId, {
      complaintFolderId: args.folderId,
      complaintFolderUrl: args.folderUrl,
    });
  },
});

export const updateStatus = mutation({
  args: {
    complaintId: v.id("complaints"),
    status: v.union(v.literal("w_toku"), v.literal("zakonczona")),
  },
  handler: async (ctx, args) => {
    if (args.status === "zakonczona") {
      await ctx.db.patch(args.complaintId, { status: args.status, endDate: Date.now() });
    } else {
      await ctx.db.patch(args.complaintId, { status: args.status, endDate: undefined });
    }
  },
});

export const updateDescription = mutation({
  args: {
    complaintId: v.id("complaints"),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.complaintId, { description: args.description });
  },
});

export const addTodo = mutation({
  args: {
    complaintId: v.id("complaints"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const complaint = await ctx.db.get(args.complaintId);
    if (!complaint) throw new Error("Complaint not found");
    const newTodo = { id: crypto.randomUUID(), text: args.text, completed: false };
    await ctx.db.patch(args.complaintId, { todos: [...complaint.todos, newTodo] });
  },
});

export const toggleTodo = mutation({
  args: {
    complaintId: v.id("complaints"),
    todoId: v.string(),
  },
  handler: async (ctx, args) => {
    const complaint = await ctx.db.get(args.complaintId);
    if (!complaint) throw new Error("Complaint not found");
    await ctx.db.patch(args.complaintId, {
      todos: complaint.todos.map((t) =>
        t.id === args.todoId ? { ...t, completed: !t.completed } : t,
      ),
    });
  },
});

export const deleteTodo = mutation({
  args: {
    complaintId: v.id("complaints"),
    todoId: v.string(),
  },
  handler: async (ctx, args) => {
    const complaint = await ctx.db.get(args.complaintId);
    if (!complaint) throw new Error("Complaint not found");
    await ctx.db.patch(args.complaintId, {
      todos: complaint.todos.filter((t) => t.id !== args.todoId),
    });
  },
});

export const addEntry = mutation({
  args: {
    complaintId: v.id("complaints"),
    text: v.string(),
    createdBy: v.string(),
    type: v.union(v.literal("note"), v.literal("todo")),
  },
  handler: async (ctx, args) => {
    const complaint = await ctx.db.get(args.complaintId);
    if (!complaint) throw new Error("Complaint not found");
    const newEntry = {
      id: crypto.randomUUID(),
      text: args.text.trim(),
      createdAt: Date.now(),
      createdBy: args.createdBy,
      type: args.type,
      completed: args.type === "todo" ? false : undefined,
    };
    await ctx.db.patch(args.complaintId, {
      entries: [...(complaint.entries ?? []), newEntry],
    });
  },
});

export const toggleEntry = mutation({
  args: {
    complaintId: v.id("complaints"),
    entryId: v.string(),
  },
  handler: async (ctx, args) => {
    const complaint = await ctx.db.get(args.complaintId);
    if (!complaint) throw new Error("Complaint not found");
    await ctx.db.patch(args.complaintId, {
      entries: (complaint.entries ?? []).map((e) =>
        e.id === args.entryId ? { ...e, completed: !e.completed } : e,
      ),
    });
  },
});

export const deleteEntry = mutation({
  args: {
    complaintId: v.id("complaints"),
    entryId: v.string(),
  },
  handler: async (ctx, args) => {
    const complaint = await ctx.db.get(args.complaintId);
    if (!complaint) throw new Error("Complaint not found");
    await ctx.db.patch(args.complaintId, {
      entries: (complaint.entries ?? []).filter((e) => e.id !== args.entryId),
    });
  },
});

export const addNote = mutation({
  args: {
    complaintId: v.id("complaints"),
    text: v.string(),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    const complaint = await ctx.db.get(args.complaintId);
    if (!complaint) throw new Error("Complaint not found");
    const newNote = {
      id: crypto.randomUUID(),
      text: args.text.trim(),
      createdAt: Date.now(),
      createdBy: args.createdBy,
    };
    await ctx.db.patch(args.complaintId, {
      notes: [...(complaint.notes ?? []), newNote],
    });
  },
});

export const deleteNote = mutation({
  args: {
    complaintId: v.id("complaints"),
    noteId: v.string(),
  },
  handler: async (ctx, args) => {
    const complaint = await ctx.db.get(args.complaintId);
    if (!complaint) throw new Error("Complaint not found");
    await ctx.db.patch(args.complaintId, {
      notes: (complaint.notes ?? []).filter((n) => n.id !== args.noteId),
    });
  },
});

export const updateTodoText = mutation({
  args: {
    complaintId: v.id("complaints"),
    todoId: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const complaint = await ctx.db.get(args.complaintId);
    if (!complaint) throw new Error("Complaint not found");
    await ctx.db.patch(args.complaintId, {
      todos: complaint.todos.map((t) =>
        t.id === args.todoId ? { ...t, text: args.text } : t,
      ),
    });
  },
});
