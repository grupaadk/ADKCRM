import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { requireUser } from "./lib/auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.db.query("taskColumns").withIndex("by_order").collect();
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    color: v.string(),
  },
  handler: async (ctx, { title, color }) => {
    await requireUser(ctx);
    const existing = await ctx.db.query("taskColumns").collect();
    const order = existing.length > 0 ? Math.max(...existing.map(c => c.order)) + 1 : 0;
    return await ctx.db.insert("taskColumns", {
      title,
      color,
      order,
    });
  },
});

export const updateOrder = mutation({
  args: {
    columnId: v.id("taskColumns"),
    newOrder: v.number(),
  },
  handler: async (ctx, { columnId, newOrder }) => {
    await requireUser(ctx);
    const columns = await ctx.db.query("taskColumns").withIndex("by_order").collect();
    const colToMove = columns.find((c) => c._id === columnId);
    if (!colToMove) throw new Error("Column not found");

    const oldOrder = colToMove.order;
    if (oldOrder === newOrder) return;

    // Shift other columns
    for (const col of columns) {
      if (col._id === columnId) continue;
      let shiftedOrder = col.order;
      if (oldOrder < newOrder) {
        if (col.order > oldOrder && col.order <= newOrder) shiftedOrder -= 1;
      } else {
        if (col.order >= newOrder && col.order < oldOrder) shiftedOrder += 1;
      }
      if (shiftedOrder !== col.order) {
        await ctx.db.patch(col._id, { order: shiftedOrder });
      }
    }
    await ctx.db.patch(columnId, { order: newOrder });
  },
});

export const rename = mutation({
  args: {
    columnId: v.id("taskColumns"),
    title: v.string(),
  },
  handler: async (ctx, { columnId, title }) => {
    await requireUser(ctx);
    const trimmed = title.trim();
    if (!trimmed) throw new Error("Nazwa listy nie może być pusta.");
    await ctx.db.patch(columnId, { title: trimmed });
  },
});

export const remove = mutation({
  args: {
    columnId: v.id("taskColumns"),
  },
  handler: async (ctx, { columnId }) => {
    await requireUser(ctx);
    const tasks = await ctx.db.query("orderTasks").filter(q => q.eq(q.field("columnId"), columnId)).collect();
    if (tasks.length > 0) {
      throw new Error("Nie można usunąć listy zawierającej zadania.");
    }
    await ctx.db.delete(columnId);
  },
});

export const migrateColumns = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Sprawdź, czy już są kolumny
    const existing = await ctx.db.query("taskColumns").collect();
    if (existing.length > 0) {
      return "Już zmigrowano";
    }

    // Utwórz 3 domyślne
    const colTodo = await ctx.db.insert("taskColumns", { title: "Do zrobienia", color: "#64748b", order: 0 });
    const colProgress = await ctx.db.insert("taskColumns", { title: "W trakcie", color: "#2563eb", order: 1 });
    const colDone = await ctx.db.insert("taskColumns", { title: "Gotowe", color: "#16a34a", order: 2 });

    // Zmigruj zadania
    const tasks = await ctx.db.query("orderTasks").collect();
    for (const task of tasks) {
      if (task.columnId) continue;
      
      let columnId = colTodo;
      if (task.status === "in_progress") columnId = colProgress;
      else if (task.status === "done") columnId = colDone;

      await ctx.db.patch(task._id, { columnId });
    }

    return "Migracja zakończona: " + tasks.length + " zadań.";
  }
});

export const migrateToHybridColumns = internalMutation({
  args: {},
  handler: async (ctx) => {
    // 1. Wyczyść istniejące kolumny (usunęliśmy "Do zrobienia", "W trakcie" itp.)
    const existing = await ctx.db.query("taskColumns").collect();
    for (const col of existing) {
      await ctx.db.delete(col._id);
    }

    // 2. Wyczyść columnId ze wszystkich zadań, żeby powróciły do systemu dueDate
    const tasks = await ctx.db.query("orderTasks").collect();
    for (const task of tasks) {
      if (task.columnId !== undefined) {
        await ctx.db.patch(task._id, { columnId: undefined });
      }
    }

    // 3. Dodaj systemowe kolumny datowe
    const DATE_COLS = [
      { systemType: "monday", title: "Poniedziałek", color: "#3b82f6" },
      { systemType: "tuesday", title: "Wtorek", color: "#8b5cf6" },
      { systemType: "wednesday", title: "Środa", color: "#ec4899" },
      { systemType: "thursday", title: "Czwartek", color: "#f59e0b" },
      { systemType: "friday", title: "Piątek", color: "#10b981" },
      { systemType: "this_week", title: "Ten tydzień", color: "#6366f1" },
      { systemType: "next_week", title: "Przyszły tydzień", color: "#a855f7" },
      { systemType: "todo_list", title: "Todo lista", color: "#64748b" },
    ];

    let order = 0;
    for (const c of DATE_COLS) {
      await ctx.db.insert("taskColumns", {
        title: c.title,
        color: c.color,
        systemType: c.systemType,
        order,
      });
      order++;
    }
    
    return "Hybrydowa migracja kolumn zakończona.";
  },
});
