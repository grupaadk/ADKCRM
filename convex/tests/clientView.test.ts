import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

type TestRuntime = ReturnType<typeof convexTest>;

async function createTestClient(t: TestRuntime) {
  return await t.mutation(api.clients.create, {
    firstName: "Test",
    lastName: "Klient",
    email: "test@example.pl",
  });
}

async function createTestOrder(t: TestRuntime) {
  const clientId = await createTestClient(t);
  const orderId = await t.mutation(api.orders.create, { clientId });
  return { clientId, orderId };
}

describe("US-4.2 — Client data update", () => {
  test("update changes firstName", async () => {
    const t = convexTest(schema);
    const clientId = await createTestClient(t);

    await t.mutation(api.clients.update, { clientId, firstName: "Zmieniony" });

    const client = await t.query(api.clients.getById, { clientId });
    expect(client!.firstName).toBe("Zmieniony");
  });

  test("update changes multiple fields at once", async () => {
    const t = convexTest(schema);
    const clientId = await createTestClient(t);

    await t.mutation(api.clients.update, {
      clientId,
      firstName: "Anna",
      lastName: "Nowak",
      phone: "+48 600 100 200",
      city: "Warszawa",
    });

    const client = await t.query(api.clients.getById, { clientId });
    expect(client!.firstName).toBe("Anna");
    expect(client!.lastName).toBe("Nowak");
    expect(client!.phone).toBe("+48 600 100 200");
    expect(client!.city).toBe("Warszawa");
  });

  test('update creates a "data_updated" event with field names', async () => {
    const t = convexTest(schema);
    const clientId = await createTestClient(t);

    await t.mutation(api.clients.update, { clientId, firstName: "Nowe", city: "Krakow" });

    const events = await t.query(api.events.listByClient, { clientId });
    const updateEvent = events.find((e: { type: string }) => e.type === "data_updated");
    expect(updateEvent).toBeDefined();
    expect(updateEvent!.details.fields).toContain("firstName");
    expect(updateEvent!.details.fields).toContain("city");
  });

  test("update with no changes does nothing", async () => {
    const t = convexTest(schema);
    const clientId = await createTestClient(t);

    await t.mutation(api.clients.update, { clientId });

    const events = await t.query(api.events.listByClient, { clientId });
    const updateEvents = events.filter((e: { type: string }) => e.type === "data_updated");
    expect(updateEvents).toHaveLength(0);
  });
});

describe("US-4.3 — Event timeline", () => {
  test("events.listByClient returns events in reverse chronological order", async () => {
    const t = convexTest(schema);
    const clientId = await createTestClient(t);

    await t.mutation(api.clients.update, { clientId, firstName: "Zmiana1" });
    await t.mutation(api.clients.update, { clientId, city: "Krakow" });

    const events = await t.query(api.events.listByClient, { clientId });

    expect(events.length).toBeGreaterThanOrEqual(2);

    for (let i = 0; i < events.length - 1; i++) {
      expect(events[i]._creationTime).toBeGreaterThanOrEqual(events[i + 1]._creationTime);
    }
  });

  test("events.listByClient respects the limit parameter", async () => {
    const t = convexTest(schema);
    const clientId = await createTestClient(t);

    await t.mutation(api.clients.update, { clientId, firstName: "A" });
    await t.mutation(api.clients.update, { clientId, lastName: "B" });
    await t.mutation(api.clients.update, { clientId, city: "C" });

    const limited = await t.query(api.events.listByClient, { clientId, limit: 2 });
    expect(limited).toHaveLength(2);
  });

  test("events.listByOrder returns order-level events", async () => {
    const t = convexTest(schema);
    const { orderId } = await createTestOrder(t);

    await t.mutation(api.orders.changeStatus, { orderId, newStatus: "inquiry" });

    const events = await t.query(api.events.listByOrder, { orderId });
    expect(events.length).toBeGreaterThanOrEqual(1);
    const statusEvent = events.find((e: { type: string }) => e.type === "status_changed");
    expect(statusEvent).toBeDefined();
  });

  test("multiple order actions create corresponding events", async () => {
    const t = convexTest(schema);
    const { orderId } = await createTestOrder(t);

    await t.mutation(api.orders.changeStatus, { orderId, newStatus: "inquiry" });
    await t.mutation(api.orders.toggleDocument, { orderId, documentType: "umowa", enabled: true });
    await t.mutation(api.orders.addWarrantyCard, {
      orderId,
      manufacturer: "Yawal",
      type: "aluminium",
      fileUrl: "https://drive.google.com/file/w1",
    });

    const events = await t.query(api.events.listByOrder, { orderId });
    const eventTypes = events.map((e: { type: string }) => e.type);

    expect(eventTypes).toContain("order_created");
    expect(eventTypes).toContain("status_changed");
    expect(eventTypes).toContain("document_generated");
    expect(eventTypes).toContain("warranty_card_added");
  });
});
