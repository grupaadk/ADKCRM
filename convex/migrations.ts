import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const BATCH_SIZE = 100;

/**
 * Migracja: ustawia viewType na "table" dla wszystkich rekordów viewConfig
 * które mają przestarzałe wartości ("cards", "kanban").
 *
 * Uruchomienie:
 *   npx convex run migrations:fixViewConfigTypes
 *
 * Po zakończeniu zawęź viewTypeValidator w viewConfig.ts i schema.ts
 * z powrotem do v.literal("table").
 */
export const fixViewConfigTypes = internalMutation({
  args: {
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    processed: v.number(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("viewConfig")
      .paginate({ numItems: BATCH_SIZE, cursor: args.cursor ?? null });

    let processed = 0;
    for (const doc of result.page) {
      if (doc.viewType !== "table") {
        await ctx.db.patch(doc._id, { viewType: "table" });
        processed++;
      }
    }

    if (!result.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.fixViewConfigTypes,
        { cursor: result.continueCursor },
      );
    }

    return { processed, hasMore: !result.isDone };
  },
});
