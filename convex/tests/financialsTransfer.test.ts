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
    expect(order?.comment).toContain("[Finanse z szansy]");
    expect(order?.comment).toContain("Koszt:");
    expect(order?.comment).toContain("Cena:");
    expect(order?.comment).toContain("Zarobek:");
    expect(order?.comment).toContain("Komentarz klienta w szansie");
  });

  test("appends updated financials note to order comment when financials change after conversion", async () => {
    const t = convexTest(schema);
    const asUser = await setupAuthContext(t);

    const opportunityId = await t.run(async (ctx) => {
      return await ctx.db.insert("pendingJotformSubmissions", {
        firstName: "Anna",
        lastName: "Nowak",
        email: "anna@example.com",
        phone: "987654321",
        stage: "inquiry",
        processed: false,
        cost: 20000,
        price: 30000,
        profit: 10000,
      });
    });

    const { orderId } = await asUser.mutation(api.salesOpportunities.convertToOrder, {
      opportunityId,
    });

    // Update financials on converted opportunity
    await asUser.mutation(api.salesOpportunities.updateOpportunity, {
      opportunityId,
      cost: 22000,
      price: 35000,
      profit: 13000,
    });

    const order = await t.run(async (ctx) => ctx.db.get(orderId));
    expect(order?.comment).toContain("[Aktualizacja finansów z szansy]");
    expect(order?.comment).toContain("Koszt:");
    expect(order?.comment).toContain("Cena:");
    expect(order?.comment).toContain("Zarobek:");
  });
});
