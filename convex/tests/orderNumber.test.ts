import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import { formatFakturowniaOrderNumber } from "../fakturownia";
import { resolveFieldValue } from "../googleDrive";
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

  test("formatFakturowniaOrderNumber adds ZAM_ prefix to legacy numbers without duplicating it", () => {
    expect(formatFakturowniaOrderNumber("1/11/2026")).toBe("ZAM_1/11/2026");
    expect(formatFakturowniaOrderNumber("ZAM_1/11/2026")).toBe("ZAM_1/11/2026");
    expect(formatFakturowniaOrderNumber("  ")).toBeUndefined();
    expect(formatFakturowniaOrderNumber(undefined)).toBeUndefined();
  });

  test("resolveFieldValue strips ZAM_ prefix from order name when generating documents", () => {
    expect(resolveFieldValue({ name: "ZAM_1/11/2026" }, "name")).toBe("1/11/2026");
    expect(resolveFieldValue({ name: "1/11/2026" }, "name")).toBe("1/11/2026");
    expect(resolveFieldValue({ firstName: "ZAM_Jan" }, "firstName")).toBe("ZAM_Jan");
  });

  test("pushOrderEstimate sends ZAM_-prefixed number to Fakturownia even for legacy order names", async () => {
    const t = convexTest(schema);
    const { userId, orderId } = await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", {
        email: "admin@test.pl",
        displayName: "Admin",
        role: "admin",
        isActive: true,
      });
      await ctx.db.insert("fakturowniaConfig", {
        subdomain: "testfirma",
        apiToken: "",
        connectedBy: uid,
      });
      const cid = await ctx.db.insert("clients", {
        firstName: "Wojtek",
        lastName: "Testprod",
        source: "manual",
        createdBy: uid,
      });
      const oid = await ctx.db.insert("orders", {
        clientId: cid,
        name: "1/11/2026",
        status: "measurement",
        statusChangedAt: Date.now(),
        documents: DEFAULT_DOCUMENTS,
        source: "manual",
        createdBy: uid,
      });
      await ctx.db.insert("orderLineItems", {
        orderId: oid,
        name: "Okno ALU",
        quantity: 1,
        unit: "szt.",
        unitPrice: 1000,
        vatRate: 23,
        sortOrder: 0,
        createdBy: uid,
      });
      return { userId: uid, orderId: oid };
    });

    process.env.FAKTUROWNIA_API_TOKEN = "test-token";
    let sentBody: { invoice?: Record<string, unknown> } | undefined;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      sentBody = JSON.parse(String(init?.body ?? "{}")) as { invoice?: Record<string, unknown> };
      return new Response(
        JSON.stringify({ id: 999, number: sentBody.invoice?.number }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    try {
      const asUser = t.withIdentity({ subject: userId });
      const res = await asUser.action(api.fakturownia.pushOrderEstimate, { orderId });
      expect(sentBody?.invoice?.kind).toBe("estimate");
      expect(sentBody?.invoice?.number).toBe("ZAM_1/11/2026");
      expect(sentBody?.invoice?.description).toBe("Dotyczy: ZAM_1/11/2026");
      expect(res.estimateNumber).toBe("ZAM_1/11/2026");
    } finally {
      fetchSpy.mockRestore();
      delete process.env.FAKTUROWNIA_API_TOKEN;
    }
  });
});
