import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { DEFAULT_DOCUMENTS } from "../orders";
import schema from "../schema";

describe("nextOrderNumber (ZAM_{N}/{MM}/{YYYY})", () => {
  test("generates ZAM_1/{MM}/{YYYY} and increments sequentially within the month", async () => {
    const t = convexTest(schema);
    const { userId, clientId } = await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", {
        email: "admin@test.pl",
        displayName: "Admin",
        role: "admin",
        isActive: true,
      });
      const cid = await ctx.db.insert("clients", {
        firstName: "Jan",
        lastName: "Kowalski",
        source: "manual",
        createdBy: uid,
      });
      return { userId: uid, clientId: cid };
    });

    const asUser = t.withIdentity({ subject: userId });
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();

    const firstId = await asUser.mutation(api.orders.create, { clientId });
    const secondId = await asUser.mutation(api.orders.create, { clientId });

    const first = await t.run((ctx) => ctx.db.get(firstId));
    const second = await t.run((ctx) => ctx.db.get(secondId));

    expect(first?.name).toBe(`ZAM_1/${mm}/${year}`);
    expect(second?.name).toBe(`ZAM_2/${mm}/${year}`);
  });

  test("continues numbering seamlessly after legacy {N}/{MM}/{YYYY} orders in the same month", async () => {
    const t = convexTest(schema);
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();

    const { userId, clientId } = await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", {
        email: "admin@test.pl",
        displayName: "Admin",
        role: "admin",
        isActive: true,
      });
      const cid = await ctx.db.insert("clients", {
        firstName: "Anna",
        lastName: "Nowak",
        source: "manual",
        createdBy: uid,
      });
      await ctx.db.insert("orders", {
        clientId: cid,
        name: `5/${mm}/${year}`,
        status: "measurement",
        statusChangedAt: Date.now(),
        documents: DEFAULT_DOCUMENTS,
        source: "manual",
        createdBy: uid,
      });
      return { userId: uid, clientId: cid };
    });

    const asUser = t.withIdentity({ subject: userId });
    const nextId = await asUser.mutation(api.orders.create, { clientId });
    const nextOrder = await t.run((ctx) => ctx.db.get(nextId));

    expect(nextOrder?.name).toBe(`ZAM_6/${mm}/${year}`);
  });
});
