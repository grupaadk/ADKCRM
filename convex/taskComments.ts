import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireUser } from "./lib/auth";

export const listByTask = query({
  args: { taskId: v.id("orderTasks") },
  handler: async (ctx, { taskId }) => {
    await requireUser(ctx);
    const comments = await ctx.db
      .query("taskComments")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .order("asc")
      .collect();

    return Promise.all(
      comments.map(async (c) => {
        const author = await ctx.db.get(c.authorId);
        return {
          _id: c._id,
          body: c.body,
          createdAt: c._creationTime,
          authorId: c.authorId,
          authorName: author?.displayName ?? author?.email ?? "Użytkownik",
          authorColor: author?.color ?? undefined,
        };
      }),
    );
  },
});

export const add = mutation({
  args: {
    taskId: v.id("orderTasks"),
    body: v.string(),
  },
  handler: async (ctx, { taskId, body }) => {
    const user = await requireUser(ctx);
    const trimmed = body.trim();
    if (!trimmed) throw new ConvexError("Komentarz nie może być pusty.");
    const task = await ctx.db.get(taskId);
    if (!task) throw new ConvexError("Zadanie nie istnieje.");
    return ctx.db.insert("taskComments", {
      taskId,
      body: trimmed,
      authorId: user._id,
    });
  },
});

export const remove = mutation({
  args: { commentId: v.id("taskComments") },
  handler: async (ctx, { commentId }) => {
    const user = await requireUser(ctx);
    const comment = await ctx.db.get(commentId);
    if (!comment) return;
    // Usunąć może autor albo administrator.
    if (comment.authorId !== user._id && user.role !== "admin") {
      throw new ConvexError("Brak uprawnień do usunięcia komentarza.");
    }
    await ctx.db.delete(commentId);
  },
});
