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

describe("Exalco Webhook Delivery Date Logic", () => {
  test("clears deliveryDate if it matches order placement date when webhook runs", async () => {
    const t = convexTest(schema);
    const asUser = await setupAuthContext(t);

    const supplierId = await t.run(async (ctx) => {
      return await ctx.db.insert("suppliers", {
        name: "Exalco",
        isActive: true,
        createdBy: "test-user",
        isApiEnabled: true,
        apiEndpoint: "https://crm-exalco.vercel.app",
        apiKey: "test-key",
      });
    });

    const clientId = await asUser.mutation(api.clients.create, {
      firstName: "Jan",
      lastName: "Kowalski",
    });

    const orderId = await asUser.mutation(api.orders.create, { clientId });

    const now = Date.now();

    // Add service delivery with orderDate set to now and externalOrderNumber
    await t.run(async (ctx) => {
      await ctx.db.patch(orderId, {
        serviceDeliveries: [
          {
            serviceName: "Okna ALU",
            supplierId,
            externalOrderNumber: "EX-12345",
            orderDate: now,
            deliveryDate: now, // falsely set to creation date in past
          },
        ],
      });
    });

    // Run webhook confirmation without explicit new valid delivery date (or delivery date = now)
    const result = await t.mutation(api.orders.confirmDeliveryByExalcoWebhook, {
      orderIdOrNumber: "EX-12345",
      rawStatus: "Zaakceptowane",
      deliveryDate: now, // webhook sends creation timestamp as deliveryDate
    });

    expect(result.success).toBe(true);

    const updatedOrder = await t.run(async (ctx) => {
      return await ctx.db.get(orderId);
    });

    const updatedDelivery = updatedOrder!.serviceDeliveries![0];
    expect(updatedDelivery.confirmedDate).toBeDefined();
    // deliveryDate should be undefined because 'now' matches order placement date!
    expect(updatedDelivery.deliveryDate).toBeUndefined();
  });

  test("accepts valid future deliveryDate distinct from order placement date", async () => {
    const t = convexTest(schema);
    const asUser = await setupAuthContext(t);

    const supplierId = await t.run(async (ctx) => {
      return await ctx.db.insert("suppliers", {
        name: "Exalco",
        isActive: true,
        createdBy: "test-user",
        isApiEnabled: true,
        apiEndpoint: "https://crm-exalco.vercel.app",
        apiKey: "test-key",
      });
    });

    const clientId = await asUser.mutation(api.clients.create, {
      firstName: "Jan",
      lastName: "Kowalski",
    });

    const orderId = await asUser.mutation(api.orders.create, { clientId });

    const now = Date.now();
    const futureDeliveryDate = now + 30 * 24 * 60 * 60 * 1000; // 30 days later

    await t.run(async (ctx) => {
      await ctx.db.patch(orderId, {
        serviceDeliveries: [
          {
            serviceName: "Okna ALU",
            supplierId,
            externalOrderNumber: "EX-99999",
            orderDate: now,
          },
        ],
      });
    });

    const result = await t.mutation(api.orders.confirmDeliveryByExalcoWebhook, {
      orderIdOrNumber: "EX-99999",
      rawStatus: "W realizacji",
      deliveryDate: futureDeliveryDate,
    });

    expect(result.success).toBe(true);

    const updatedOrder = await t.run(async (ctx) => {
      return await ctx.db.get(orderId);
    });

    const updatedDelivery = updatedOrder!.serviceDeliveries![0];
    expect(updatedDelivery.deliveryDate).toBe(futureDeliveryDate);
  });
});
