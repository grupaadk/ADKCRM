import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

type ClientStatus =
  | "lead"
  | "inquiry"
  | "measurement"
  | "offer"
  | "contract"
  | "production"
  | "installation"
  | "completed"
  | "complaint";

const STATUS_PATH: Record<ClientStatus, ClientStatus[]> = {
  lead: [],
  inquiry: ["inquiry"],
  measurement: ["inquiry", "measurement"],
  offer: ["inquiry", "measurement", "offer"],
  contract: ["inquiry", "measurement", "offer", "contract"],
  production: ["inquiry", "measurement", "offer", "contract", "production"],
  installation: ["inquiry", "measurement", "offer", "contract", "production", "installation"],
  completed: ["inquiry", "measurement", "offer", "contract", "production", "installation", "completed"],
  complaint: ["inquiry", "measurement", "offer", "contract", "production", "installation", "completed", "complaint"],
};

async function createOrderAtStatus(
  t: ReturnType<typeof convexTest>,
  targetStatus: ClientStatus,
) {
  const clientId = await t.mutation(api.clients.create, {
    firstName: "Test",
    lastName: "User",
  });

  const orderId = await t.mutation(api.orders.create, { clientId });

  const steps = STATUS_PATH[targetStatus];
  if (!steps) throw new Error(`Unknown status: ${targetStatus}`);

  for (const status of steps) {
    await t.mutation(api.orders.changeStatus, { orderId, newStatus: status });
  }

  return { clientId, orderId };
}

// ---------- US-2.1 -- Status changes ----------

describe("US-2.1 -- Status transitions", () => {
  test("1. lead -> inquiry is allowed", async () => {
    const t = convexTest(schema);
    const { orderId } = await createOrderAtStatus(t, "lead");
    await t.mutation(api.orders.changeStatus, { orderId, newStatus: "inquiry" });
    const order = await t.query(api.orders.getById, { orderId });
    expect(order?.status).toBe("inquiry");
  });

  test("2. lead -> measurement is allowed", async () => {
    const t = convexTest(schema);
    const { orderId } = await createOrderAtStatus(t, "lead");
    await t.mutation(api.orders.changeStatus, { orderId, newStatus: "measurement" });
    const order = await t.query(api.orders.getById, { orderId });
    expect(order?.status).toBe("measurement");
  });

  test("3. lead -> contract is NOT allowed", async () => {
    const t = convexTest(schema);
    const { orderId } = await createOrderAtStatus(t, "lead");
    await expect(
      t.mutation(api.orders.changeStatus, { orderId, newStatus: "contract" }),
    ).rejects.toThrow();
  });

  test("4. lead -> completed is NOT allowed", async () => {
    const t = convexTest(schema);
    const { orderId } = await createOrderAtStatus(t, "lead");
    await expect(
      t.mutation(api.orders.changeStatus, { orderId, newStatus: "completed" }),
    ).rejects.toThrow();
  });

  test("5. inquiry -> measurement is allowed", async () => {
    const t = convexTest(schema);
    const { orderId } = await createOrderAtStatus(t, "inquiry");
    await t.mutation(api.orders.changeStatus, { orderId, newStatus: "measurement" });
    const order = await t.query(api.orders.getById, { orderId });
    expect(order?.status).toBe("measurement");
  });

  test("6. inquiry -> offer is allowed", async () => {
    const t = convexTest(schema);
    const { orderId } = await createOrderAtStatus(t, "inquiry");
    await t.mutation(api.orders.changeStatus, { orderId, newStatus: "offer" });
    const order = await t.query(api.orders.getById, { orderId });
    expect(order?.status).toBe("offer");
  });

  test("7. measurement -> offer is allowed", async () => {
    const t = convexTest(schema);
    const { orderId } = await createOrderAtStatus(t, "measurement");
    await t.mutation(api.orders.changeStatus, { orderId, newStatus: "offer" });
    const order = await t.query(api.orders.getById, { orderId });
    expect(order?.status).toBe("offer");
  });

  test("8. measurement -> contract is allowed", async () => {
    const t = convexTest(schema);
    const { orderId } = await createOrderAtStatus(t, "measurement");
    await t.mutation(api.orders.changeStatus, { orderId, newStatus: "contract" });
    const order = await t.query(api.orders.getById, { orderId });
    expect(order?.status).toBe("contract");
  });

  test("9. offer -> contract is allowed", async () => {
    const t = convexTest(schema);
    const { orderId } = await createOrderAtStatus(t, "offer");
    await t.mutation(api.orders.changeStatus, { orderId, newStatus: "contract" });
    const order = await t.query(api.orders.getById, { orderId });
    expect(order?.status).toBe("contract");
  });

  test("10. offer -> lead is allowed (back to lead)", async () => {
    const t = convexTest(schema);
    const { orderId } = await createOrderAtStatus(t, "offer");
    await t.mutation(api.orders.changeStatus, { orderId, newStatus: "lead" });
    const order = await t.query(api.orders.getById, { orderId });
    expect(order?.status).toBe("lead");
  });

  test("11. contract -> production is allowed", async () => {
    const t = convexTest(schema);
    const { orderId } = await createOrderAtStatus(t, "contract");
    await t.mutation(api.orders.changeStatus, { orderId, newStatus: "production" });
    const order = await t.query(api.orders.getById, { orderId });
    expect(order?.status).toBe("production");
  });

  test("12. production -> installation is allowed", async () => {
    const t = convexTest(schema);
    const { orderId } = await createOrderAtStatus(t, "production");
    await t.mutation(api.orders.changeStatus, { orderId, newStatus: "installation" });
    const order = await t.query(api.orders.getById, { orderId });
    expect(order?.status).toBe("installation");
  });

  test("13. installation -> completed is allowed", async () => {
    const t = convexTest(schema);
    const { orderId } = await createOrderAtStatus(t, "installation");
    await t.mutation(api.orders.changeStatus, { orderId, newStatus: "completed" });
    const order = await t.query(api.orders.getById, { orderId });
    expect(order?.status).toBe("completed");
  });

  test("14. completed -> warranty is allowed", async () => {
    const t = convexTest(schema);
    const { orderId } = await createOrderAtStatus(t, "completed");
    await t.mutation(api.orders.changeStatus, { orderId, newStatus: "complaint" });
    const order = await t.query(api.orders.getById, { orderId });
    expect(order?.status).toBe("complaint");
  });

  test("15. warranty -> any is NOT allowed (terminal state)", async () => {
    const t = convexTest(schema);
    const { orderId } = await createOrderAtStatus(t, "complaint");

    const allStatuses = [
      "lead", "inquiry", "measurement", "offer", "contract",
      "production", "installation", "completed", "complaint",
    ] as const;

    for (const status of allStatuses) {
      await expect(
        t.mutation(api.orders.changeStatus, { orderId, newStatus: status }),
      ).rejects.toThrow();
    }
  });

  test("16. status change creates a 'status_changed' event with from/to details", async () => {
    const t = convexTest(schema);
    const { orderId } = await createOrderAtStatus(t, "lead");

    await t.mutation(api.orders.changeStatus, { orderId, newStatus: "inquiry" });

    const events = await t.query(api.events.listByOrder, { orderId });
    const statusEvent = events.find((e: { type: string }) => e.type === "status_changed");

    expect(statusEvent).toBeDefined();
    expect(statusEvent!.details).toEqual({ from: "lead", to: "inquiry" });
  });
});

// ---------- US-2.2 -- Order data update ----------

describe("US-2.2 -- Order data update", () => {
  test("17. order stores data (services, colors) correctly", async () => {
    const t = convexTest(schema);
    const clientId = await t.mutation(api.clients.create, { firstName: "Test", lastName: "User" });
    const orderId = await t.mutation(api.orders.create, {
      clientId,
      services: ["Okna", "Drzwi"],
      comment: "Pilne zamowienie",
    });

    const order = await t.query(api.orders.getById, { orderId });
    expect(order?.status).toBe("lead");
    expect(order?.services).toEqual(["Okna", "Drzwi"]);
    expect(order?.comment).toBe("Pilne zamowienie");
  });

  test("18. after changing to 'measurement', order data is still accessible", async () => {
    const t = convexTest(schema);
    const clientId = await t.mutation(api.clients.create, { firstName: "Test", lastName: "User" });
    const orderId = await t.mutation(api.orders.create, {
      clientId,
      services: ["Okna", "Drzwi"],
      comment: "Pilne zamowienie",
    });

    await t.mutation(api.orders.changeStatus, { orderId, newStatus: "inquiry" });
    await t.mutation(api.orders.changeStatus, { orderId, newStatus: "measurement" });

    const order = await t.query(api.orders.getById, { orderId });
    expect(order?.status).toBe("measurement");
    expect(order?.services).toEqual(["Okna", "Drzwi"]);
    expect(order?.comment).toBe("Pilne zamowienie");
  });
});
