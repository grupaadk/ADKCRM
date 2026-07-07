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
export const removeTestSuffixFromOrders = internalMutation({
  args: {
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    processed: v.number(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("orders")
      .paginate({ numItems: BATCH_SIZE, cursor: args.cursor ?? null });

    let processed = 0;
    for (const order of result.page) {
      if (order.name && order.name.endsWith("_TEST")) {
        await ctx.db.patch(order._id, { name: order.name.slice(0, -5) });
        processed++;
      }
    }

    if (!result.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.removeTestSuffixFromOrders,
        { cursor: result.continueCursor },
      );
    }

    return { processed, hasMore: !result.isDone };
  },
});

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

export const resetOrderCounter = internalMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const all = await ctx.db.query("orderCounters").collect();
    const counter = all.find((c) => c.year === 2026 && c.month === 5);
    if (counter) {
      await ctx.db.patch(counter._id, { lastNumber: 0 });
      return `Zresetowano: był ${counter.lastNumber}, ustawiono na 0`;
    }
    await ctx.db.insert("orderCounters", { year: 2026, month: 5, lastNumber: 0 });
    return "Nie było licznika — utworzono nowy z lastNumber=0";
  },
});

/**
 * Migracja jednorazowa: zmienia nazwę zlecenia k574vyb70wq0ks7ejb14148rys86324v
 * z "6/05/2026" na "1/05/2026" i ustawia licznik na 1 (następne będzie 2/05/2026).
 *
 * Uruchomienie:
 *   npx convex run migrations:fixFirstMayOrder
 */
export const fixFirstMayOrder = internalMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const orders = await ctx.db.query("orders").collect();
    const order = orders.find((o) => o.name === "6/05/2026");
    if (!order) return "BŁĄD: zlecenie z nazwą '6/05/2026' nie znalezione";

    await ctx.db.patch(order._id, { name: "1/05/2026" });

    const counters = await ctx.db.query("orderCounters").collect();
    const counter = counters.find((c) => c.year === 2026 && c.month === 5);
    if (counter) {
      await ctx.db.patch(counter._id, { lastNumber: 1 });
    } else {
      await ctx.db.insert("orderCounters", { year: 2026, month: 5, lastNumber: 1 });
    }

    return `Zmieniono: "6/05/2026" → "1/05/2026". Licznik 05/2026 → 1 (następne zlecenie: 2/05/2026).`;
  },
});

/**
 * Migracja: usuwa pola trelloCardId i trelloCardUrl z istniejących rekordów.
 *
 * Uruchomienie (jednorazowe):
 *   npx convex run migrations:clearTrelloFields
 *
 * Po zakończeniu usuń pola trelloCardId/trelloCardUrl ze schematu
 * (są oznaczone komentarzem "Legacy — do usunięcia po migracji clearTrelloFields").
 */
// Migracja clearTrelloFields została wykonana — dane są czyste (uruchomiona 2026-05-08).
// Pola trelloCardId/trelloCardUrl zostały usunięte z bazy danych i schematu.

export const migrateOrderDates = internalMutation({
  args: {
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    processed: v.number(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("orders")
      .paginate({ numItems: BATCH_SIZE, cursor: args.cursor ?? null });

    let processed = 0;
    for (const order of result.page) {
      const anyOrder = order as any;
      const updates: any = {};
      
      if (anyOrder.productionDate || anyOrder.realizationStartDate) {
        updates.projectStartDate = anyOrder.productionDate ?? anyOrder.realizationStartDate;
      }
      if (anyOrder.completionDate || anyOrder.realizationEndDate) {
        updates.projectEndDate = anyOrder.completionDate ?? anyOrder.realizationEndDate;
      }
      if (anyOrder.installationStart) {
        updates.installationStartDate = anyOrder.installationStart;
      }
      
      updates.productionDate = undefined;
      updates.completionDate = undefined;
      updates.realizationStartDate = undefined;
      updates.realizationEndDate = undefined;
      updates.installationStart = undefined;
      updates.installationEnd = undefined;

      await ctx.db.patch(order._id, updates);
      processed++;
    }

    if (!result.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.migrateOrderDates,
        { cursor: result.continueCursor },
      );
    }

    return { processed, hasMore: !result.isDone };
  },
});
