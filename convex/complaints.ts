import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const COMPLAINT_STATUS_LABELS: Record<string, string> = {
  nowa: "Nowa",
  w_toku: "W toku",
  rozwiazana: "Rozwiązana",
  zamknieta: "Zamknięta",
};

export const getByOrderId = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("complaints")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .first();
  },
});

export const getById = query({
  args: { complaintId: v.id("complaints") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.complaintId);
  },
});

/** Global list — all complaints with client and order info joined */
export const getAll = query({
  args: {
    status: v.optional(v.string()),
    assignedTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let complaints = await ctx.db
      .query("complaints")
      .order("desc")
      .take(500);

    if (args.status) {
      complaints = complaints.filter((c) => c.status === args.status);
    }
    if (args.assignedTo) {
      complaints = complaints.filter((c) => c.assignedTo === args.assignedTo);
    }

    // Join with clients
    const results = await Promise.all(
      complaints.map(async (c) => {
        const client = await ctx.db.get(c.clientId);
        const order = c.orderId ? await ctx.db.get(c.orderId) : null;
        return { ...c, client, order };
      }),
    );

    return results;
  },
});

export const create = mutation({
  args: {
    orderId: v.optional(v.id("orders")),
    clientId: v.id("clients"),
    startDate: v.number(),
    description: v.optional(v.string()),
    clientDescription: v.optional(v.string()),
    assignedTo: v.optional(v.string()),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    // If tied to an order, only one complaint per order
    if (args.orderId) {
      const existing = await ctx.db
        .query("complaints")
        .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
        .first();
      if (existing) return existing._id;
    }
    const complaintId = await ctx.db.insert("complaints", {
      orderId: args.orderId,
      clientId: args.clientId,
      status: "nowa",
      description: args.description,
      clientDescription: args.clientDescription,
      assignedTo: args.assignedTo,
      notes: [],
      startDate: args.startDate,
      todos: [],
      createdBy: args.createdBy,
    });
    if (args.orderId) {
      await ctx.scheduler.runAfter(0, internal.googleDrive.createComplaintFolder, {
        complaintId,
        orderId: args.orderId,
      });
    }
    return complaintId;
  },
});

export const updateDetails = mutation({
  args: {
    complaintId: v.id("complaints"),
    description: v.optional(v.string()),
    clientDescription: v.optional(v.string()),
    assignedTo: v.optional(v.string()),
    startDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { complaintId, ...fields } = args;
    const patch: Record<string, unknown> = {};
    if (fields.description !== undefined) patch.description = fields.description;
    if (fields.clientDescription !== undefined) patch.clientDescription = fields.clientDescription;
    if (fields.assignedTo !== undefined) patch.assignedTo = fields.assignedTo;
    if (fields.startDate !== undefined) patch.startDate = fields.startDate;
    await ctx.db.patch(complaintId, patch);
  },
});

export const requestComplaintFolderCreation = mutation({
  args: {
    complaintId: v.id("complaints"),
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    await ctx.scheduler.runAfter(0, internal.googleDrive.createComplaintFolder, {
      complaintId: args.complaintId,
      orderId: args.orderId,
    });
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
    status: v.union(
      v.literal("nowa"),
      v.literal("w_toku"),
      v.literal("rozwiazana"),
      v.literal("zamknieta"),
    ),
  },
  handler: async (ctx, args) => {
    const finished = args.status === "zamknieta" || args.status === "rozwiazana";
    await ctx.db.patch(args.complaintId, {
      status: args.status,
      endDate: finished ? Date.now() : undefined,
    });
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
