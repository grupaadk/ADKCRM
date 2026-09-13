import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

/**
 * Pobiera listę zadań trackera czasu.
 * Najpierw aktywne (running), potem wg daty ostatniego mierzenia czasu.
 */
export const getTasks = query({
  args: {
    includeCompleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const tasks = await ctx.db.query("itTimeTrackerTasks").collect();
    
    // Sortowanie: najpierw biegnące (running), potem nieukończone (stopped), na końcu ukończone (completed)
    // W ramach tej samej grupy sortujemy po lastTrackedAt / createdAt malejąco
    return tasks
      .filter((t) => args.includeCompleted || t.status !== "completed")
      .sort((a, b) => {
        if (a.status === "running" && b.status !== "running") return -1;
        if (a.status !== "running" && b.status === "running") return 1;
        return (b.lastTrackedAt || b.createdAt) - (a.lastTrackedAt || a.createdAt);
      });
  },
});

/**
 * Utworzenie nowego zadania w trackerze czasu.
 */
export const createTask = mutation({
  args: {
    title: v.string(),
    startImmediately: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const title = args.title.trim();
    if (!title) {
      throw new Error("Tytuł zadania nie może być pusty.");
    }

    const now = Date.now();
    let status: "stopped" | "running" = "stopped";
    let lastStartedAt: number | undefined = undefined;

    if (args.startImmediately) {
      // Zatrzymaj jakikolwiek inny stoper działający w tle
      const runningTasks = await ctx.db
        .query("itTimeTrackerTasks")
        .withIndex("by_status", (q) => q.eq("status", "running"))
        .collect();

      for (const runningTask of runningTasks) {
        if (runningTask.lastStartedAt) {
          const delta = Math.max(0, now - runningTask.lastStartedAt);
          await ctx.db.insert("itTimeTrackerLogs", {
            taskId: runningTask._id,
            startTime: runningTask.lastStartedAt,
            endTime: now,
            durationMs: delta,
          });
          await ctx.db.patch(runningTask._id, {
            status: "stopped",
            totalDurationMs: runningTask.totalDurationMs + delta,
            lastStartedAt: undefined,
            lastTrackedAt: now,
          });
        }
      }

      status = "running";
      lastStartedAt = now;
    }

    const taskId = await ctx.db.insert("itTimeTrackerTasks", {
      title,
      status,
      totalDurationMs: 0,
      lastStartedAt,
      createdAt: now,
      lastTrackedAt: now,
    });

    return taskId;
  },
});

/**
 * Uruchomienie stopera dla konkretnego zadania.
 * Automatycznie zatrzymuje działające stopery innych zadań.
 */
export const startTimer = mutation({
  args: {
    id: v.id("itTimeTrackerTasks"),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) throw new Error("Zadanie nie istnieje.");

    if (task.status === "running") return task._id;

    const now = Date.now();

    // Zatrzymaj inne aktywne stopery
    const runningTasks = await ctx.db
      .query("itTimeTrackerTasks")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .collect();

    for (const runningTask of runningTasks) {
      if (runningTask._id !== args.id && runningTask.lastStartedAt) {
        const delta = Math.max(0, now - runningTask.lastStartedAt);
        await ctx.db.insert("itTimeTrackerLogs", {
          taskId: runningTask._id,
          startTime: runningTask.lastStartedAt,
          endTime: now,
          durationMs: delta,
        });
        await ctx.db.patch(runningTask._id, {
          status: "stopped",
          totalDurationMs: runningTask.totalDurationMs + delta,
          lastStartedAt: undefined,
          lastTrackedAt: now,
        });
      }
    }

    // Uruchom ten stoper
    await ctx.db.patch(args.id, {
      status: "running",
      lastStartedAt: now,
      lastTrackedAt: now,
    });

    return task._id;
  },
});

/**
 * Zatrzymanie stopera i dodanie wpisu do logów.
 */
export const stopTimer = mutation({
  args: {
    id: v.id("itTimeTrackerTasks"),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) throw new Error("Zadanie nie istnieje.");

    if (task.status !== "running" || !task.lastStartedAt) {
      return task._id;
    }

    const now = Date.now();
    const delta = Math.max(0, now - task.lastStartedAt);

    if (delta > 0) {
      await ctx.db.insert("itTimeTrackerLogs", {
        taskId: task._id,
        startTime: task.lastStartedAt,
        endTime: now,
        durationMs: delta,
      });
    }

    await ctx.db.patch(task._id, {
      status: "stopped",
      totalDurationMs: task.totalDurationMs + delta,
      lastStartedAt: undefined,
      lastTrackedAt: now,
    });

    return task._id;
  },
});

/**
 * Ręczne dodanie minut do skumulowanego czasu zadania.
 */
export const addManualTime = mutation({
  args: {
    id: v.id("itTimeTrackerTasks"),
    minutesToAdd: v.number(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) throw new Error("Zadanie nie istnieje.");

    const minutes = Math.round(args.minutesToAdd);
    if (minutes <= 0) throw new Error("Liczba minut musi być większa od zera.");

    const now = Date.now();
    const durationMs = minutes * 60 * 1000;

    await ctx.db.insert("itTimeTrackerLogs", {
      taskId: task._id,
      startTime: now - durationMs,
      endTime: now,
      durationMs,
    });

    await ctx.db.patch(task._id, {
      totalDurationMs: task.totalDurationMs + durationMs,
      lastTrackedAt: now,
    });

    return task._id;
  },
});

/**
 * Przełączenie statusu ukończenia zadania.
 */
export const toggleCompleted = mutation({
  args: {
    id: v.id("itTimeTrackerTasks"),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) throw new Error("Zadanie nie istnieje.");

    const now = Date.now();

    if (task.status === "running") {
      // Zatrzymaj timer przed oznaczeniem jako ukończone
      if (task.lastStartedAt) {
        const delta = Math.max(0, now - task.lastStartedAt);
        await ctx.db.insert("itTimeTrackerLogs", {
          taskId: task._id,
          startTime: task.lastStartedAt,
          endTime: now,
          durationMs: delta,
        });
        task.totalDurationMs += delta;
      }
    }

    const newStatus = task.status === "completed" ? "stopped" : "completed";

    await ctx.db.patch(task._id, {
      status: newStatus,
      totalDurationMs: task.totalDurationMs,
      lastStartedAt: undefined,
      lastTrackedAt: now,
    });

    return task._id;
  },
});

/**
 * Usunięcie zadania wraz z wpisami czasu.
 */
export const deleteTask = mutation({
  args: {
    id: v.id("itTimeTrackerTasks"),
  },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("itTimeTrackerLogs")
      .withIndex("by_task", (q) => q.eq("taskId", args.id))
      .collect();

    for (const log of logs) {
      await ctx.db.delete(log._id);
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

/**
 * Pobranie danych do raportu czasowego (filtry: rok, miesiąc, zakres dat).
 */
export const getTimeReports = query({
  args: {
    year: v.optional(v.number()),
    month: v.optional(v.number()), // 1-12
    startDate: v.optional(v.number()), // ms timestamp
    endDate: v.optional(v.number()), // ms timestamp
  },
  handler: async (ctx, args) => {
    let logs = await ctx.db.query("itTimeTrackerLogs").collect();
    const tasks = await ctx.db.query("itTimeTrackerTasks").collect();
    const taskMap = new Map(tasks.map((t) => [t._id, t]));

    // Filtrowanie po dacie
    if (args.startDate !== undefined && args.endDate !== undefined) {
      const s = args.startDate;
      const e = args.endDate;
      logs = logs.filter((l) => l.startTime >= s && l.startTime <= e);
    } else if (args.year !== undefined) {
      logs = logs.filter((l) => {
        const d = new Date(l.startTime);
        if (d.getFullYear() !== args.year) return false;
        if (args.month !== undefined && args.month !== null) {
          return d.getMonth() + 1 === args.month;
        }
        return true;
      });
    }

    // Grupowanie per zadanie
    const taskReportMap = new Map<
      Id<"itTimeTrackerTasks">,
      {
        taskId: Id<"itTimeTrackerTasks">;
        title: string;
        isCompleted: boolean;
        totalTimeMs: number;
        sessionsCount: number;
        firstTrackedAt: number;
        lastTrackedAt: number;
      }
    >();

    let totalMs = 0;

    for (const log of logs) {
      totalMs += log.durationMs;
      const t = taskMap.get(log.taskId);
      const title = t?.title ?? "Usunięte zadanie";
      const isCompleted = t?.status === "completed";

      const existing = taskReportMap.get(log.taskId);
      if (!existing) {
        taskReportMap.set(log.taskId, {
          taskId: log.taskId,
          title,
          isCompleted,
          totalTimeMs: log.durationMs,
          sessionsCount: 1,
          firstTrackedAt: log.startTime,
          lastTrackedAt: log.endTime,
        });
      } else {
        existing.totalTimeMs += log.durationMs;
        existing.sessionsCount += 1;
        if (log.startTime < existing.firstTrackedAt) existing.firstTrackedAt = log.startTime;
        if (log.endTime > existing.lastTrackedAt) existing.lastTrackedAt = log.endTime;
      }
    }

    const taskSummaries = Array.from(taskReportMap.values()).sort(
      (a, b) => b.totalTimeMs - a.totalTimeMs,
    );

    return {
      totalTimeMs: totalMs,
      totalTasksCount: taskSummaries.length,
      taskSummaries,
    };
  },
});
