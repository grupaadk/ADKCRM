import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import type { Doc } from "../_generated/dataModel";

type TestRuntime = ReturnType<typeof convexTest>;

type OrderStatus =
  | "measurement"
  | "offer"
  | "contract"
  | "production"
  | "installation"
  | "completed"
  | "complaint";

const STATUS_PATH: Record<OrderStatus, OrderStatus[]> = {
  measurement: [],
  offer: ["offer"],
  contract: ["offer", "contract"],
  production: ["offer", "contract", "production"],
  installation: ["offer", "contract", "production", "installation"],
  completed: ["offer", "contract", "production", "installation", "completed"],
  complaint: ["offer", "contract", "production", "installation", "completed", "complaint"],
};

async function createOrderAtStatus(
  t: TestRuntime,
  targetStatus: OrderStatus,
) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", { email: "admin@test.com", role: "admin", isActive: true });
  });
  const asUser = t.withIdentity({ subject: userId });

  const clientId = await asUser.mutation(api.clients.create, {
    firstName: "Test",
    lastName: "User",
  });

  const orderId = await asUser.mutation(api.orders.create, { clientId });

  const steps = STATUS_PATH[targetStatus];
  if (!steps) throw new Error(`Unknown status: ${targetStatus}`);

  for (const status of steps) {
    await asUser.mutation(api.orders.changeStatus, { orderId, newStatus: status });
  }

  return { clientId, orderId, asUser };
}

// ---------- US-2.1 -- Status changes ----------

describe("US-2.1 -- Status transitions", () => {
  test("1. measurement -> offer is allowed", async () => {
    const t = convexTest(schema);
    const { orderId, asUser } = await createOrderAtStatus(t, "measurement");
    await asUser.mutation(api.orders.changeStatus, { orderId, newStatus: "offer" });
    const order = await asUser.query(api.orders.getById, { orderId });
    expect(order?.status).toBe("offer");
  });

  test("2. measurement -> contract is allowed", async () => {
    const t = convexTest(schema);
    const { orderId, asUser } = await createOrderAtStatus(t, "measurement");
    await asUser.mutation(api.orders.changeStatus, { orderId, newStatus: "contract" });
    const order = await asUser.query(api.orders.getById, { orderId });
    expect(order?.status).toBe("contract");
  });

  test("3. setting same status throws error", async () => {
    const t = convexTest(schema);
    const { orderId, asUser } = await createOrderAtStatus(t, "measurement");
    await expect(
      asUser.mutation(api.orders.changeStatus, { orderId, newStatus: "measurement" }),
    ).rejects.toThrow();
  });

  test("4. offer -> contract is allowed", async () => {
    const t = convexTest(schema);
    const { orderId, asUser } = await createOrderAtStatus(t, "offer");
    await asUser.mutation(api.orders.changeStatus, { orderId, newStatus: "contract" });
    const order = await asUser.query(api.orders.getById, { orderId });
    expect(order?.status).toBe("contract");
  });

  test("5. offer -> measurement is allowed (back to measurement)", async () => {
    const t = convexTest(schema);
    const { orderId, asUser } = await createOrderAtStatus(t, "offer");
    await asUser.mutation(api.orders.changeStatus, { orderId, newStatus: "measurement" });
    const order = await asUser.query(api.orders.getById, { orderId });
    expect(order?.status).toBe("measurement");
  });

  test("6. contract -> production is allowed", async () => {
    const t = convexTest(schema);
    const { orderId, asUser } = await createOrderAtStatus(t, "contract");
    await asUser.mutation(api.orders.changeStatus, { orderId, newStatus: "production" });
    const order = await asUser.query(api.orders.getById, { orderId });
    expect(order?.status).toBe("production");
  });

  test("7. production -> installation is allowed", async () => {
    const t = convexTest(schema);
    const { orderId, asUser } = await createOrderAtStatus(t, "production");
    await asUser.mutation(api.orders.changeStatus, { orderId, newStatus: "installation" });
    const order = await asUser.query(api.orders.getById, { orderId });
    expect(order?.status).toBe("installation");
  });

  test("8. installation -> completed is allowed", async () => {
    const t = convexTest(schema);
    const { orderId, asUser } = await createOrderAtStatus(t, "installation");
    await asUser.mutation(api.orders.changeStatus, { orderId, newStatus: "completed" });
    const order = await asUser.query(api.orders.getById, { orderId });
    expect(order?.status).toBe("completed");
  });

  test("9. completed -> complaint is allowed", async () => {
    const t = convexTest(schema);
    const { orderId, asUser } = await createOrderAtStatus(t, "completed");
    await asUser.mutation(api.orders.changeStatus, { orderId, newStatus: "complaint" });
    const order = await asUser.query(api.orders.getById, { orderId });
    expect(order?.status).toBe("complaint");
  });

  test("10. status change creates a 'status_changed' event with from/to details", async () => {
    const t = convexTest(schema);
    const { orderId, asUser } = await createOrderAtStatus(t, "measurement");

    await asUser.mutation(api.orders.changeStatus, { orderId, newStatus: "offer" });

    const events = await asUser.query(api.events.listByOrder, { orderId });
    const statusEvent = events.find((e: { type: string }) => e.type === "status_changed");

    expect(statusEvent).toBeDefined();
    expect(statusEvent!.details).toEqual({ from: "measurement", to: "offer" });
  });
});

// ---------- US-2.2 -- Order data update ----------

describe("US-2.2 -- Order data update", () => {
  test("11. order stores data (services, colors) correctly", async () => {
    const t = convexTest(schema);
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", { email: "admin@test.com", role: "admin", isActive: true });
    });
    const asUser = t.withIdentity({ subject: userId });

    const clientId = await asUser.mutation(api.clients.create, { firstName: "Test", lastName: "User" });
    const orderId = await asUser.mutation(api.orders.create, {
      clientId,
      services: ["Okna", "Drzwi"],
      comment: "Pilne zamowienie",
    });

    const order = await asUser.query(api.orders.getById, { orderId });
    expect(order?.status).toBe("measurement");
    expect(order?.services).toEqual(["Okna", "Drzwi"]);
    expect(order?.comment).toBe("Pilne zamowienie");
  });

  test("12. after changing status, order data is still accessible", async () => {
    const t = convexTest(schema);
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", { email: "admin@test.com", role: "admin", isActive: true });
    });
    const asUser = t.withIdentity({ subject: userId });

    const clientId = await asUser.mutation(api.clients.create, { firstName: "Test", lastName: "User" });
    const orderId = await asUser.mutation(api.orders.create, {
      clientId,
      services: ["Okna", "Drzwi"],
      comment: "Pilne zamowienie",
    });

    await asUser.mutation(api.orders.changeStatus, { orderId, newStatus: "offer" });
    await asUser.mutation(api.orders.changeStatus, { orderId, newStatus: "contract" });

    const order = await asUser.query(api.orders.getById, { orderId });
    expect(order?.status).toBe("contract");
    expect(order?.services).toEqual(["Okna", "Drzwi"]);
    expect(order?.comment).toBe("Pilne zamowienie");
  });

  test("13. archiving order is blocked if there are unfinished tasks", async () => {
    const t = convexTest(schema);
    const { orderId, asUser } = await createOrderAtStatus(t, "measurement");

    // Create an unfinished task for the order
    await asUser.mutation(api.orderTasks.create, {
      orderId,
      title: "Zadanie testowe",
      status: "todo",
    });

    // Try to archive - should fail
    await expect(
      asUser.mutation(api.orders.changeStatus, { orderId, newStatus: "archived" }),
    ).rejects.toThrow();

    // Now resolve the task (change status to 'done')
    const tasks = await asUser.query(api.orderTasks.listByOrder, { orderId });
    const taskId = tasks[0]._id;
    await asUser.mutation(api.orderTasks.update, { taskId, status: "done" });

    // Try to archive again - should succeed
    await asUser.mutation(api.orders.changeStatus, { orderId, newStatus: "archived" });
    const order = await asUser.query(api.orders.getById, { orderId });
    expect(order?.status).toBe("archived");
  });

  test("14. columnChangedAt is updated when columnId is set or cleared", async () => {
    const t = convexTest(schema);
    const { orderId, asUser } = await createOrderAtStatus(t, "measurement");

    // Create a task
    const taskId = await asUser.mutation(api.orderTasks.create, {
      orderId,
      title: "Zadanie z kolumną",
      status: "todo",
    });

    const taskAfterCreate = (await asUser.run(async (ctx) => {
      return await ctx.db.get(taskId);
    })) as Doc<"orderTasks"> | null;
    expect(taskAfterCreate?.columnChangedAt).toBeUndefined();

    // Create a fake columnId
    const columnId = await asUser.mutation(api.taskColumns.create, {
      title: "Kolumna testowa",
      color: "#ff0000",
    });

    // Update columnId
    const beforeUpdate = Date.now();
    await asUser.mutation(api.orderTasks.update, {
      taskId,
      columnId,
    });
    const afterUpdate = Date.now();

    const taskAfterUpdate = (await asUser.run(async (ctx) => {
      return await ctx.db.get(taskId);
    })) as Doc<"orderTasks"> | null;
    expect(taskAfterUpdate?.columnId).toBe(columnId);
    expect(taskAfterUpdate?.columnChangedAt).toBeTypeOf("number");
    expect(taskAfterUpdate?.columnChangedAt).toBeGreaterThanOrEqual(beforeUpdate);
    expect(taskAfterUpdate?.columnChangedAt).toBeLessThanOrEqual(afterUpdate);

    // Clear columnId
    await asUser.mutation(api.orderTasks.update, {
      taskId,
      clearColumnId: true,
    });

    const taskAfterClear = (await asUser.run(async (ctx) => {
      return await ctx.db.get(taskId);
    })) as Doc<"orderTasks"> | null;
    expect(taskAfterClear?.columnId).toBeUndefined();
    expect(taskAfterClear?.columnChangedAt).toBeUndefined();
  });

  test("15. expense categories CRUD and category assignment on custom expense", async () => {
    const t = convexTest(schema);
    const { orderId, asUser } = await createOrderAtStatus(t, "measurement");

    // Create expense category
    const categoryId = await asUser.mutation(api.expenseCategories.create, {
      name: "Robocizna",
    });

    // List categories
    const categories = await asUser.query(api.expenseCategories.list, {});
    expect(categories.length).toBe(1);
    expect(categories[0].name).toBe("Robocizna");

    // Add custom expense with categoryId
    await asUser.mutation(api.fakturownia.addCustomExpense, {
      orderId,
      title: "Test custom expense",
      grossAmount: 123,
      categoryId,
    });

    // Verify it has categoryId
    const expenses = await asUser.query(api.fakturownia.listCachedExpensesByOrder, { orderId });
    expect(expenses.length).toBe(1);
    expect(expenses[0].categoryId).toBe(categoryId);

    // Assign category to undefined
    await asUser.mutation(api.fakturownia.assignCategory, {
      expenseId: expenses[0]._id,
      categoryId: undefined,
    });

    const expensesUpdated = await asUser.query(api.fakturownia.listCachedExpensesByOrder, { orderId });
    expect(expensesUpdated[0].categoryId).toBeUndefined();

    // Assign back to category
    await asUser.mutation(api.fakturownia.assignCategory, {
      expenseId: expenses[0]._id,
      categoryId,
    });

    // Remove category - should clear categoryId on the expense
    await asUser.mutation(api.expenseCategories.remove, { categoryId });

    const expensesAfterRemove = await asUser.run(async (ctx) => {
      return (await ctx.db.get(expenses[0]._id)) as Doc<"fakturowniaExpensesCache"> | null;
    });
    expect(expensesAfterRemove?.categoryId).toBeUndefined();
  });
});
