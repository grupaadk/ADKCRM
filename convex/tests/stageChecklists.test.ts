/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

describe("stageChecklists", () => {
  test("manages independent stage checklist items and aggregates progress in listForSchedule", async () => {
    const t = convexTest(schema, modules);

    const adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "admin@adkokna.pl",
        displayName: "Admin User",
        role: "admin",
        isActive: true,
      });
    });

    const adminCtx = t.withIdentity({
      subject: adminId,
      email: "admin@adkokna.pl",
    });

    const clientId = await adminCtx.mutation(api.clients.create, {
      firstName: "Jan",
      lastName: "Kowalski",
    });

    const orderId = await adminCtx.mutation(api.orders.create, {
      clientId,
      name: "1/11/2026",
    });

    await t.run(async (ctx) => {
      await ctx.db.patch(orderId, { status: "production" });
    });

    // Add checklist items to production and installation stages
    const item1 = await adminCtx.mutation(api.stageChecklists.create, {
      orderId,
      stageKey: "production",
      title: "Sprawdzić profil aluminiowy",
    });
    const item2 = await adminCtx.mutation(api.stageChecklists.create, {
      orderId,
      stageKey: "production",
      title: "Kontrola szyb przed pakowaniem",
    });
    await adminCtx.mutation(api.stageChecklists.create, {
      orderId,
      stageKey: "installation",
      title: "Potwierdzić dojazd ekipy",
    });

    // Verify independent from orderTasks
    const orderTasks = await adminCtx.query(api.orderTasks.listByOrder, { orderId });
    expect(orderTasks).toHaveLength(0);

    // List production checklist items
    const prodItems = await adminCtx.query(api.stageChecklists.listByOrderStage, {
      orderId,
      stageKey: "production",
    });
    expect(prodItems).toHaveLength(2);
    expect(prodItems[0].done).toBe(false);

    // Toggle item1 to done
    const toggled = await adminCtx.mutation(api.stageChecklists.toggle, { itemId: item1 });
    expect(toggled).toBe(true);

    // Verify progress aggregation in listForSchedule
    const scheduleOrders = await adminCtx.query(api.orders.listForSchedule, {});
    const targetOrder = scheduleOrders.find((o) => o._id === orderId);
    expect(targetOrder).toBeDefined();
    expect(targetOrder?.stageProgress).toEqual({
      kitting: { done: 0, total: 0 },
      production: { done: 1, total: 2 },
      installation: { done: 0, total: 1 },
    });

    // Remove item2 and verify updated progress (1/1)
    await adminCtx.mutation(api.stageChecklists.remove, { itemId: item2 });
    const afterRemove = await adminCtx.query(api.orders.listForSchedule, {});
    const updatedOrder = afterRemove.find((o) => o._id === orderId);
    expect(updatedOrder?.stageProgress.production).toEqual({ done: 1, total: 1 });
  });
});
