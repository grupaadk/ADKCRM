import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

type TestRuntime = ReturnType<typeof convexTest>;

async function setupAuthContext(t: TestRuntime) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email: "admin@example.pl",
      displayName: "Admin User",
      role: "admin",
      isActive: true,
    });
  });
  return t.withIdentity({ subject: userId });
}

describe("dashboard", () => {
  test("getStats returns zeros when no clients", async () => {
    const t = convexTest(schema);

    const stats = await t.query(api.dashboard.getStats, {});
    expect(stats.total).toBe(0);
    expect(stats.documentsEnabledCount).toBe(0);
    expect(stats.newThisWeek).toBe(0);
    for (const status of Object.values(stats.byStatus)) {
      expect(status).toBe(0);
    }
  });

  test("getStats counts orders by status correctly", async () => {
    const t = convexTest(schema);
    const asUser = await setupAuthContext(t);

    const id1 = await asUser.mutation(api.clients.create, { firstName: "Jan", lastName: "Kowalski" });
    const id2 = await asUser.mutation(api.clients.create, { firstName: "Anna", lastName: "Nowak" });
    const id3 = await asUser.mutation(api.clients.create, { firstName: "Piotr", lastName: "Zielinski" });
    const orderId1 = await asUser.mutation(api.orders.create, { clientId: id1 });
    await asUser.mutation(api.orders.create, { clientId: id2 });
    await asUser.mutation(api.orders.create, { clientId: id3 });

    await asUser.mutation(api.orders.changeStatus, { orderId: orderId1, newStatus: "offer" });

    const stats = await asUser.query(api.dashboard.getStats, {});
    expect(stats.byStatus.measurement).toBe(2);
    expect(stats.byStatus.offer).toBe(1);
  });

  test("getStats counts total clients", async () => {
    const t = convexTest(schema);
    const asUser = await setupAuthContext(t);

    await asUser.mutation(api.clients.create, { firstName: "A", lastName: "Jeden" });
    await asUser.mutation(api.clients.create, { firstName: "B", lastName: "Dwa" });
    await asUser.mutation(api.clients.create, { firstName: "C", lastName: "Trzy" });
    await asUser.mutation(api.clients.create, { firstName: "D", lastName: "Cztery" });
    const stats = await asUser.query(api.dashboard.getStats, {});
    expect(stats.total).toBe(4);
  });

  test("getStats counts enabled documents across orders", async () => {
    const t = convexTest(schema);
    const asUser = await setupAuthContext(t);

    const clientId = await asUser.mutation(api.clients.create, { firstName: "Jan", lastName: "Kowalski" });
    const orderId = await asUser.mutation(api.orders.create, { clientId });

    await asUser.mutation(api.orders.toggleDocument, { orderId, documentType: "umowa", enabled: true });
    await asUser.mutation(api.orders.toggleDocument, { orderId, documentType: "faktura", enabled: true });

    const stats = await asUser.query(api.dashboard.getStats, {});
    expect(stats.documentsEnabledCount).toBe(2);
  });

  test("getRecentEvents returns empty when no events", async () => {
    const t = convexTest(schema);

    const events = await t.query(api.dashboard.getRecentEvents, {});
    expect(events).toEqual([]);
  });

  test("getRecentEvents returns events with client names", async () => {
    const t = convexTest(schema);
    const asUser = await setupAuthContext(t);

    await asUser.mutation(api.clients.create, { firstName: "Jan", lastName: "Kowalski" });
    const events = await asUser.query(api.dashboard.getRecentEvents, {});
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].clientName).toBe("Jan Kowalski");
    expect(events[0].type).toBe("created");
  });

  test("getRecentEvents returns events in reverse chronological order", async () => {
    const t = convexTest(schema);
    const asUser = await setupAuthContext(t);

    const id1 = await asUser.mutation(api.clients.create, { firstName: "Jan", lastName: "Kowalski" });
    const orderId1 = await asUser.mutation(api.orders.create, { clientId: id1 });
    await asUser.mutation(api.orders.changeStatus, { orderId: orderId1, newStatus: "offer" });

    const events = await asUser.query(api.dashboard.getRecentEvents, {});
    expect(events.length).toBeGreaterThanOrEqual(3);

    for (let i = 0; i < events.length - 1; i++) {
      expect(events[i]._creationTime).toBeGreaterThanOrEqual(events[i + 1]._creationTime);
    }

    expect(events[0].type).toBe("status_changed");
  });
});
