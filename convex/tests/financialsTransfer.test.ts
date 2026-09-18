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

describe("Sales Opportunity Financials Transfer to Order", () => {
  test("transfers financials from opportunity to order comment upon conversion", async () => {
    const t = convexTest(schema);
    const asUser = await setupAuthContext(t);

    const opportunityId = await t.run(async (ctx) => {
      return await ctx.db.insert("pendingJotformSubmissions", {
        firstName: "Jan",
        lastName: "Kowalski",
        email: "jan@example.com",
        phone: "123456789",
        stage: "inquiry",
        processed: false,
        cost: 10000,
        price: 15000,
        profit: 5000,
        comment: "Komentarz klienta w szansie",
      });
    });

    const { orderId } = await asUser.mutation(api.salesOpportunities.convertToOrder, {
      opportunityId,
    });

    const order = await t.run(async (ctx) => ctx.db.get(orderId));
    expect(order).not.toBeNull();
    expect(order?.cost).toBe(10000);
    expect(order?.price).toBe(15000);
    expect(order?.profit).toBe(5000);
    expect(order?.comment).toContain("[Finanse z szansy]");
  });

  test("allows setting and updating leadSource on sales opportunity", async () => {
    const t = convexTest(schema);
    const asUser = await setupAuthContext(t);

    const opportunityId = await asUser.mutation(api.salesOpportunities.createManualOpportunity, {
      firstName: "Marek",
      lastName: "Nowak",
      leadSource: "Polecenie - Pan Tomasz",
    });

    let opp = await t.run(async (ctx) => ctx.db.get(opportunityId));
    expect(opp?.leadSource).toBe("Polecenie - Pan Tomasz");

    await asUser.mutation(api.salesOpportunities.updateOpportunity, {
      opportunityId,
      leadSource: "Targi Budowlane 2026",
    });

    opp = await t.run(async (ctx) => ctx.db.get(opportunityId));
    expect(opp?.leadSource).toBe("Targi Budowlane 2026");
  });

  test("allows updating cost, price, profit directly on an order", async () => {
    const t = convexTest(schema);
    const asUser = await setupAuthContext(t);

    const clientId = await t.run(async (ctx) => {
      return await ctx.db.insert("clients", {
        firstName: "Piotr",
        lastName: "Zieliński",
        source: "manual",
        createdBy: "system",
      });
    });

    const orderId = await asUser.mutation(api.orders.create, {
      clientId,
    });

    await asUser.mutation(api.orders.update, {
      orderId,
      cost: 12000,
      price: 18000,
      profit: 6000,
      workDays: 3,
    });

    const order = await t.run(async (ctx) => ctx.db.get(orderId));
    expect(order?.cost).toBe(12000);
    expect(order?.price).toBe(18000);
    expect(order?.profit).toBe(6000);
    expect(order?.workDays).toBe(3);
  });

  test("allows clearing cost, price, profit, workDays by sending null", async () => {
    const t = convexTest(schema);
    const asUser = await setupAuthContext(t);

    const clientId = await t.run(async (ctx) => {
      return await ctx.db.insert("clients", {
        firstName: "Adam",
        lastName: "Nowak",
        source: "manual",
        createdBy: "system",
      });
    });

    const orderId = await asUser.mutation(api.orders.create, {
      clientId,
    });

    await asUser.mutation(api.orders.update, {
      orderId,
      cost: 5000,
      price: 8000,
      profit: 3000,
      workDays: 2,
    });

    await asUser.mutation(api.orders.update, {
      orderId,
      cost: null,
      price: null,
      profit: null,
      workDays: null,
    });

    const orderCleared = await t.run(async (ctx) => ctx.db.get(orderId));
    expect(orderCleared?.cost).toBeUndefined();
    expect(orderCleared?.price).toBeUndefined();
    expect(orderCleared?.profit).toBeUndefined();
    expect(orderCleared?.workDays).toBeUndefined();
  });

  test("allows assigning and clearing installationTeamId on order", async () => {
    const t = convexTest(schema);
    const asUser = await setupAuthContext(t);

    const teamId = await t.run(async (ctx) => {
      return await ctx.db.insert("installationTeams", {
        name: "Ekipa Alpha",
        color: "#10b981",
        isActive: true,
        createdAt: Date.now(),
      });
    });

    const clientId = await t.run(async (ctx) => {
      return await ctx.db.insert("clients", {
        firstName: "Jan",
        lastName: "Kowalski",
        source: "manual",
        createdBy: "system",
      });
    });

    const orderId = await asUser.mutation(api.orders.create, {
      clientId,
    });

    await asUser.mutation(api.orders.update, {
      orderId,
      installationTeamId: teamId,
    });

    let order = await t.run(async (ctx) => ctx.db.get(orderId));
    expect(order?.installationTeamId).toBe(teamId);

    await asUser.mutation(api.orders.update, {
      orderId,
      installationTeamId: null,
    });

    order = await t.run(async (ctx) => ctx.db.get(orderId));
    expect(order?.installationTeamId).toBeUndefined();
  });
});
