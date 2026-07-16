import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth";

// Pobranie wszystkich etykiet
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) return [];
    return await ctx.db.query("taskLabels").collect();
  },
});

// Tworzenie nowej etykiety
export const create = mutation({
  args: {
    title: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const labelId = await ctx.db.insert("taskLabels", {
      title: args.title.trim(),
      color: args.color,
    });
    return labelId;
  },
});

// Edycja etykiety
export const update = mutation({
  args: {
    labelId: v.id("taskLabels"),
    title: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    await ctx.db.patch(args.labelId, {
      title: args.title.trim(),
      color: args.color,
    });
  },
});

// Usuwanie etykiety (i czyszczenie jej przypisań z zadań)
export const remove = mutation({
  args: {
    labelId: v.id("taskLabels"),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    // Usuwamy przypisania etykiety ze wszystkich zadań
    const tasks = await ctx.db.query("orderTasks").collect();
    for (const t of tasks) {
      if (t.labelIds && t.labelIds.includes(args.labelId)) {
        const updatedLabelIds = t.labelIds.filter((id) => id !== args.labelId);
        await ctx.db.patch(t._id, {
          labelIds: updatedLabelIds.length > 0 ? updatedLabelIds : undefined,
        });
      }
    }

    // Usuwamy samą etykietę
    await ctx.db.delete(args.labelId);
  },
});
