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

  test("allows updating order when serviceDeliveries contains sentApiFiles", async () => {
    const t = convexTest(schema);
    const asUser = await setupAuthContext(t);

    const supplierId = await t.run(async (ctx) => {
      return await ctx.db.insert("suppliers", {
        name: "GrupaExpert",
        isActive: true,
        createdBy: "test-user",
      });
    });

    const clientId = await asUser.mutation(api.clients.create, {
      firstName: "Anna",
      lastName: "Nowak",
    });

    const orderId = await asUser.mutation(api.orders.create, { clientId });

    await asUser.mutation(api.orders.update, {
      orderId,
      serviceDeliveries: [
        {
          serviceName: "Okna ALU",
          supplierId,
          orderDate: Date.now(),
          sentApiFiles: [
            {
              fileId: "RW 08.09.pdf",
              fileName: "RW 08.09.pdf",
              fileType: "RW",
              sentAt: Date.now(),
            },
          ],
        },
      ],
    });

    const updatedOrder = await t.run(async (ctx) => {
      return await ctx.db.get(orderId);
    });

    expect(updatedOrder!.serviceDeliveries![0].sentApiFiles).toHaveLength(1);
    expect(updatedOrder!.serviceDeliveries![0].sentApiFiles![0].fileName).toBe("RW 08.09.pdf");
  });

  test("allows updating order with notesFeed and records notes in recordCrmNoteSent", async () => {
    const t = convexTest(schema);
    const asUser = await setupAuthContext(t);

    const supplierId = await t.run(async (ctx) => {
      return await ctx.db.insert("suppliers", {
        name: "Exalco",
        isActive: true,
        createdBy: "test-user",
      });
    });

    const clientId = await asUser.mutation(api.clients.create, {
      firstName: "Piotr",
      lastName: "Zieliński",
    });

    const orderId = await asUser.mutation(api.orders.create, { clientId });

    await asUser.mutation(api.orders.update, {
      orderId,
      serviceDeliveries: [
        {
          serviceName: "Montaż szyb",
          supplierId,
          notesFeed: [
            {
              id: "n1",
              note: "Specjalne szkło hartowane",
              createdAt: Date.now(),
              createdByName: "Admin User",
            },
          ],
        },
      ],
    });

    let updatedOrder = await t.run(async (ctx) => {
      return await ctx.db.get(orderId);
    });

    expect(updatedOrder!.serviceDeliveries![0].notesFeed).toHaveLength(1);
    expect(updatedOrder!.serviceDeliveries![0].notesFeed![0].note).toBe("Specjalne szkło hartowane");

    // Call recordCrmNoteSent
    await asUser.mutation(api.orders.recordCrmNoteSent, {
      orderId,
      deliveryIndex: 0,
      noteText: "Specjalne szkło hartowane",
    });

    updatedOrder = await t.run(async (ctx) => {
      return await ctx.db.get(orderId);
    });

    expect(updatedOrder!.serviceDeliveries![0].notesFeed![0].sentToCrm).toBe(true);
  });
});

