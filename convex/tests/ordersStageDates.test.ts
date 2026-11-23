import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { DEFAULT_DOCUMENTS } from "../orders";
import schema from "../schema";

async function seedUserAndOrder(
  t: ReturnType<typeof convexTest>,
  initialStatus = "contract",
) {
  const { userId, orderId } = await t.run(async (ctx) => {
    const uid = await ctx.db.insert("users", {
      email: "admin@test.pl",
      displayName: "Admin",
      role: "admin",
      isActive: true,
    });
    const clientId = await ctx.db.insert("clients", {
      firstName: "Jan",
      lastName: "Kowalski",
      source: "manual",
      createdBy: uid,
    });
    const oid = await ctx.db.insert("orders", {
      clientId,
      name: "1/11/2026",
      status: initialStatus,
      statusChangedAt: Date.now(),
      documents: DEFAULT_DOCUMENTS,
      source: "manual",
      createdBy: uid,
    });
    return { userId: uid, orderId: oid };
  });

  return {
    asUser: t.withIdentity({ subject: userId }),
    orderId,
  };
}

describe("Order stage dates for Kompletacja, Produkcja, Montaż", () => {
  test("automatically sets start and end dates on status transitions through Kompletacja (kitting), Produkcja, and Montaż", async () => {
    const t = convexTest(schema);
    const { asUser, orderId } = await seedUserAndOrder(t, "contract");

    // 1. Wejście w Kompletację (kitting) -> completionStartDate
    await asUser.mutation(api.orders.changeStatus, {
      orderId,
      newStatus: "kitting",
    });
    let order = await t.run((ctx) => ctx.db.get(orderId));
    expect(order?.completionStartDate).toBeTypeOf("number");
    expect(order?.completionEndDate).toBeUndefined();

    // 2. Przejście z Kompletacji do Produkcji -> completionEndDate + productionStartDate
    await asUser.mutation(api.orders.changeStatus, {
      orderId,
      newStatus: "production",
    });
    order = await t.run((ctx) => ctx.db.get(orderId));
    expect(order?.completionEndDate).toBeTypeOf("number");
    expect(order?.productionStartDate).toBeTypeOf("number");
    expect(order?.productionEndDate).toBeUndefined();

    // 3. Przejście z Produkcji do Montażu -> productionEndDate + installationPhaseStartDate + projectStartDate
    await asUser.mutation(api.orders.changeStatus, {
      orderId,
      newStatus: "installation",
    });
    order = await t.run((ctx) => ctx.db.get(orderId));
    expect(order?.productionEndDate).toBeTypeOf("number");
    expect(order?.installationPhaseStartDate).toBeTypeOf("number");
    expect(order?.installationPhaseEndDate).toBeUndefined();
    expect(order?.projectStartDate).toBeTypeOf("number");

    // 4. Przejście z Montażu do Zakończone -> installationPhaseEndDate + projectEndDate
    await asUser.mutation(api.orders.changeStatus, {
      orderId,
      newStatus: "completed",
    });
    order = await t.run((ctx) => ctx.db.get(orderId));
    expect(order?.installationPhaseEndDate).toBeTypeOf("number");
    expect(order?.projectEndDate).toBeTypeOf("number");
  });

  test("allows setting and clearing stage dates via orders.update and validates endDate >= startDate", async () => {
    const t = convexTest(schema);
    const { asUser, orderId } = await seedUserAndOrder(t, "production");

    const day1 = Date.UTC(2026, 10, 20);
    const day5 = Date.UTC(2026, 10, 24);
    const day10 = Date.UTC(2026, 10, 29);

    await asUser.mutation(api.orders.update, {
      orderId,
      completionStartDate: day1,
      completionEndDate: day5,
      productionStartDate: day5,
      productionEndDate: day10,
      installationPhaseStartDate: day10,
      installationPhaseEndDate: day10 + 86400000,
    });

    let order = await t.run((ctx) => ctx.db.get(orderId));
    expect(order?.completionStartDate).toBe(day1);
    expect(order?.completionEndDate).toBe(day5);
    expect(order?.productionStartDate).toBe(day5);
    expect(order?.productionEndDate).toBe(day10);
    expect(order?.installationPhaseStartDate).toBe(day10);
    expect(order?.installationPhaseEndDate).toBe(day10 + 86400000);

    // Błąd gdy data końca < data początku
    await expect(
      asUser.mutation(api.orders.update, {
        orderId,
        productionEndDate: day1,
      }),
    ).rejects.toThrow("Data końca etapu nie może być wcześniejsza niż data początku.");

    // Czyszczenie daty za pomocą null
    await asUser.mutation(api.orders.update, {
      orderId,
      productionEndDate: null,
    });
    order = await t.run((ctx) => ctx.db.get(orderId));
    expect(order?.productionEndDate).toBeUndefined();
  });

  test("listForSchedule returns only orders in Kompletacja (kitting) and Montaż (excluding Produkcja)", async () => {
    const t = convexTest(schema);
    const { asUser } = await seedUserAndOrder(t, "contract");

    await t.run(async (ctx) => {
      const users = await ctx.db.query("users").collect();
      const clients = await ctx.db.query("clients").collect();
      const uid = users[0]._id;
      const cid = clients[0]._id;

      const statusesToSeed = [
        "measurement",
        "offer",
        "kitting",
        "production",
        "installation",
        "completed",
        "archived",
      ];
      for (const st of statusesToSeed) {
        await ctx.db.insert("orders", {
          clientId: cid,
          name: `Zlecenie-${st}`,
          status: st,
          statusChangedAt: Date.now(),
          documents: DEFAULT_DOCUMENTS,
          source: "manual",
          createdBy: uid,
        });
      }
    });

    const scheduleOrders = await asUser.query(api.orders.listForSchedule, {});
    const returnedStatuses = scheduleOrders.map((o) => o.status).sort();
    expect(returnedStatuses).toEqual(["installation", "kitting"]);
  });
});
