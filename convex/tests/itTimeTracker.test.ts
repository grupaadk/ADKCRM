/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

describe("itTimeTracker", () => {
  test("creates task, manages timers, auto-stops previous timer, and generates report", async () => {
    const t = convexTest(schema, modules);

    // 1. Create first task without starting
    const taskId1 = await t.mutation(api.itTimeTracker.createTask, {
      title: "Naprawa integracji API",
    });
    expect(taskId1).toBeDefined();

    let tasks = await t.query(api.itTimeTracker.getTasks, {});
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("Naprawa integracji API");
    expect(tasks[0].status).toBe("stopped");

    // 2. Start timer for task 1
    await t.mutation(api.itTimeTracker.startTimer, { id: taskId1 });
    tasks = await t.query(api.itTimeTracker.getTasks, {});
    expect(tasks[0].status).toBe("running");

    // 3. Create second task with startImmediately = true
    const taskId2 = await t.mutation(api.itTimeTracker.createTask, {
      title: "Konfiguracja serwera Staging",
      startImmediately: true,
    });
    expect(taskId2).toBeDefined();

    tasks = await t.query(api.itTimeTracker.getTasks, {});
    const task1After = tasks.find((t) => t._id === taskId1);
    const task2After = tasks.find((t) => t._id === taskId2);

    // Task 1 should now be stopped, task 2 should be running
    expect(task1After?.status).toBe("stopped");
    expect(task2After?.status).toBe("running");

    // 4. Stop timer for task 2
    await t.mutation(api.itTimeTracker.stopTimer, { id: taskId2 });
    tasks = await t.query(api.itTimeTracker.getTasks, {});
    expect(tasks.find((t) => t._id === taskId2)?.status).toBe("stopped");

    // 5. Add manual time to task 1 (e.g. 60 minutes)
    await t.mutation(api.itTimeTracker.addManualTime, {
      id: taskId1,
      minutesToAdd: 60,
    });

    tasks = await t.query(api.itTimeTracker.getTasks, {});
    const updatedTask1 = tasks.find((t) => t._id === taskId1);
    expect(updatedTask1?.totalDurationMs).toBeGreaterThanOrEqual(60 * 60 * 1000);

    // 6. Test report query
    const report = await t.query(api.itTimeTracker.getTimeReports, {});
    expect(report.taskSummaries.length).toBeGreaterThanOrEqual(1);
    expect(report.totalTimeMs).toBeGreaterThanOrEqual(60 * 60 * 1000);

    // 7. Toggle completed status
    await t.mutation(api.itTimeTracker.toggleCompleted, { id: taskId1 });
    const completedTasks = await t.query(api.itTimeTracker.getTasks, { includeCompleted: true });
    expect(completedTasks.find((t) => t._id === taskId1)?.status).toBe("completed");

    // 8. Delete task
    await t.mutation(api.itTimeTracker.deleteTask, { id: taskId1 });
    const afterDelete = await t.query(api.itTimeTracker.getTasks, { includeCompleted: true });
    expect(afterDelete.find((t) => t._id === taskId1)).toBeUndefined();
  });
});
