import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireUser, userIdentifier } from "./lib/auth";

export const listByOrder = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    await requireUser(ctx);
    const tasks = await ctx.db
      .query("orderTasks")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .order("asc")
      .collect();

    return Promise.all(
      tasks.map(async (task) => {
        const assignedUser = task.assignedUserId
          ? await ctx.db.get(task.assignedUserId)
          : null;
        return {
          ...task,
          assignedUserName:
            assignedUser?.displayName ?? assignedUser?.email ?? null,
        };
      }),
    );
  },
});

export const create = mutation({
  args: {
    orderId: v.id("orders"),
    title: v.string(),
    status: v.optional(
      v.union(v.literal("todo"), v.literal("in_progress"), v.literal("done")),
    ),
    dueDate: v.optional(v.number()),
    assignedUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return ctx.db.insert("orderTasks", {
      orderId: args.orderId,
      title: args.title,
      dueDate: args.dueDate,
      status: args.status ?? "todo",
      assignedUserId: args.assignedUserId,
      createdBy: userIdentifier(user),
    });
  },
});

export const update = mutation({
  args: {
    taskId: v.id("orderTasks"),
    title: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    clearDueDate: v.optional(v.boolean()),
    status: v.optional(
      v.union(v.literal("todo"), v.literal("in_progress"), v.literal("done")),
    ),
    assignedUserId: v.optional(v.id("users")),
    clearAssignee: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const { taskId, clearDueDate, clearAssignee, ...rest } = args;
    const patch: Record<string, unknown> = {};
    if (rest.title !== undefined) patch.title = rest.title;
    if (rest.status !== undefined) patch.status = rest.status;
    if (rest.dueDate !== undefined) patch.dueDate = rest.dueDate;
    if (clearDueDate) patch.dueDate = undefined;
    if (rest.assignedUserId !== undefined) patch.assignedUserId = rest.assignedUserId;
    if (clearAssignee) patch.assignedUserId = undefined;
    await ctx.db.patch(taskId, patch);
  },
});

export const remove = mutation({
  args: { taskId: v.id("orderTasks") },
  handler: async (ctx, { taskId }) => {
    await requireUser(ctx);
    await ctx.db.delete(taskId);
  },
});
