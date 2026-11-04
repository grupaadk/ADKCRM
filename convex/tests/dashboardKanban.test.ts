import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { formatLocalDateInput, parseLocalDateInput } from "../../lib/dateUtils";

type TestRuntime = ReturnType<typeof convexTest>;

async function setupAuthContext(t: TestRuntime, role: "admin" | "sales" | "montaz" = "admin") {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email: `${role}@example.pl`,
      displayName: `${role.toUpperCase()} User`,
      role,
      isActive: true,
    });
  });
  return { asUser: t.withIdentity({ subject: userId }), userId };
}

describe("Dashboard Kanban & Tasks", () => {
  test("dateUtils correctly formats and parses local dates without timezone shift", () => {
    const timestamp = parseLocalDateInput("2026-11-04");
    const d = new Date(timestamp);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(10); // November is 10 (0-indexed)
    expect(d.getDate()).toBe(4);
    expect(d.getHours()).toBe(0);

    const formatted = formatLocalDateInput(timestamp);
    expect(formatted).toBe("2026-11-04");
  });

  test("createTask and dashboardTasks.list returns created tasks", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupAuthContext(t, "admin");

    const taskId = await asUser.mutation(api.dashboardTasks.adminCreate, {
      title: "Test Task 1",
      status: "todo",
      assignedUserId: userId,
      dueDate: parseLocalDateInput("2026-11-04"),
    });

    const tasks = await asUser.query(api.dashboardTasks.list, { filter: "all" });
    expect(tasks.length).toBe(1);
    expect(tasks[0]._id).toBe(taskId);
    expect(tasks[0].title).toBe("Test Task 1");
    expect(tasks[0].assignedUserId).toBe(userId);
    expect(tasks[0].dueDate).toBe(parseLocalDateInput("2026-11-04"));
  });

  test("reorder mutation atomically updates positions and dates", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupAuthContext(t, "admin");

    const t1 = await asUser.mutation(api.dashboardTasks.adminCreate, {
      title: "Task 1",
      status: "todo",
      assignedUserId: userId,
    });
    const t2 = await asUser.mutation(api.dashboardTasks.adminCreate, {
      title: "Task 2",
      status: "todo",
      assignedUserId: userId,
    });

    const targetDate = parseLocalDateInput("2026-11-05");
    await asUser.mutation(api.orderTasks.reorder, {
      updates: [
        { taskId: t2, position: 0, dueDate: targetDate, clearColumnId: true },
        { taskId: t1, position: 1000 },
      ],
    });

    const tasks = await asUser.query(api.dashboardTasks.list, { filter: "all" });
    const task1 = tasks.find((x) => x._id === t1);
    const task2 = tasks.find((x) => x._id === t2);

    expect(task2?.position).toBe(0);
    expect(task2?.dueDate).toBe(targetDate);
    expect(task2?.columnId).toBeUndefined();

    expect(task1?.position).toBe(1000);
  });

  test("marking task as done sets completedAt and can be archived", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupAuthContext(t, "admin");

    const taskId = await asUser.mutation(api.dashboardTasks.adminCreate, {
      title: "Task to complete",
      status: "todo",
      assignedUserId: userId,
    });

    await asUser.mutation(api.orderTasks.update, {
      taskId,
      status: "done",
    });

    let tasks = await asUser.query(api.dashboardTasks.list, { filter: "all" });
    expect(tasks[0].status).toBe("done");
    expect(tasks[0].completedAt).toBeDefined();

    await asUser.mutation(api.orderTasks.update, {
      taskId,
      archived: true,
    });

    tasks = await asUser.query(api.dashboardTasks.list, { filter: "all" });
    expect(tasks[0].archived).toBe(true);
    expect(tasks[0].archivedAt).toBeDefined();
  });
});
