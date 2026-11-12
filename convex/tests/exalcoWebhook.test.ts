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

  test("markAllDeliveryNotesSentToCrm marks all existing notes as sentToCrm without duplicating", async () => {
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
      firstName: "Marek",
      lastName: "Nowak",
    });

    const orderId = await asUser.mutation(api.orders.create, { clientId });

    await asUser.mutation(api.orders.update, {
      orderId,
      serviceDeliveries: [
        {
          serviceName: "Okna ALU",
          supplierId,
          notes: "Uwaga 1\n---\nUwaga 2",
          notesFeed: [
            {
              id: "note-1",
              note: "Uwaga 1",
              createdAt: Date.now() - 1000,
              createdByName: "Wojtek",
              senderType: "adk",
              sentToCrm: false,
              targetRecipient: "exalco",
            },
            {
              id: "note-2",
              note: "Uwaga 2",
              createdAt: Date.now(),
              createdByName: "Wojtek",
              senderType: "adk",
              sentToCrm: false,
              targetRecipient: "exalco",
            },
          ],
        },
      ],
    });

    await asUser.mutation(api.orders.markAllDeliveryNotesSentToCrm, {
      orderId,
      deliveryIndex: 0,
    });

    const updatedOrder = await t.run(async (ctx) => {
      return await ctx.db.get(orderId);
    });

    const delivery = updatedOrder!.serviceDeliveries![0];
    expect(delivery.notesFeed).toHaveLength(2);
    expect(delivery.notesFeed![0].sentToCrm).toBe(true);
    expect(delivery.notesFeed![1].sentToCrm).toBe(true);
    expect(delivery.notesFeed![0].targetRecipient).toBe("exalco");
    expect(delivery.lastCrmNoteSentAt).toBeDefined();
  });

  test("processes incoming notes from Exalco webhook and updates unread count", async () => {
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
      firstName: "Tomasz",
      lastName: "Wiśniewski",
    });

    const orderId = await asUser.mutation(api.orders.create, { clientId });

    await t.run(async (ctx) => {
      await ctx.db.patch(orderId, {
        serviceDeliveries: [
          {
            serviceName: "Okna PVC",
            supplierId,
            externalOrderNumber: "EX-998877",
          },
        ],
      });
    });

    // Simulate incoming note from Exalco webhook
    const res = await t.mutation(api.orders.receiveNoteFromExalcoWebhook, {
      orderIdOrNumber: "EX-998877",
      noteText: "Wiadomość z Exalco: Zamówienie w trakcie produkcji",
      authorName: "Jan z Exalco",
    });

    expect(res.success).toBe(true);

    let updatedOrder = await t.run(async (ctx) => {
      return await ctx.db.get(orderId);
    });

    const delivery = updatedOrder!.serviceDeliveries![0];
    expect(delivery.notesFeed).toHaveLength(1);
    expect(delivery.notesFeed![0].senderType).toBe("exalco");
    expect(delivery.notesFeed![0].createdByName).toBe("Exalco · Jan z Exalco");
    expect(delivery.notesFeed![0].note).toBe("Wiadomość z Exalco: Zamówienie w trakcie produkcji");
    expect(delivery.unreadNotesCount).toBe(1);

    // Mark as read
    await asUser.mutation(api.orders.markSupplierNotesAsRead, {
      orderId,
      deliveryIndex: 0,
    });

    updatedOrder = await t.run(async (ctx) => {
      return await ctx.db.get(orderId);
    });

    expect(updatedOrder!.serviceDeliveries![0].unreadNotesCount).toBe(0);
  });

  test("records flat bidirectional messages between ADK and Exalco without threads", async () => {
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
      firstName: "Tomasz",
      lastName: "Zieliński",
    });

    const orderId = await asUser.mutation(api.orders.create, { clientId });

    await t.run(async (ctx) => {
      await ctx.db.patch(orderId, {
        serviceDeliveries: [
          {
            serviceName: "Okna ALU",
            supplierId,
            externalOrderNumber: "EX-FLAT-001",
          },
        ],
      });
    });

    // 1. ADK sends message
    await asUser.mutation(api.orders.recordCrmNoteSent, {
      orderId,
      deliveryIndex: 0,
      noteText: "Wiadomość początkowa od ADK",
    });

    let order = await t.run(async (ctx) => ctx.db.get(orderId));
    let feed = order!.serviceDeliveries![0].notesFeed!;
    expect(feed).toHaveLength(1);
    expect(feed[0].senderType).toBe("adk");
    expect(feed[0].sentToCrm).toBe(true);
    expect(feed[0].threadId).toBeUndefined();

    // 2. Exalco sends message
    await t.mutation(api.orders.receiveNoteFromExalcoWebhook, {
      orderIdOrNumber: "EX-FLAT-001",
      noteText: "Wiadomość od Exalco",
      authorName: "Konsultant Exalco",
    });

    order = await t.run(async (ctx) => ctx.db.get(orderId));
    feed = order!.serviceDeliveries![0].notesFeed!;
    expect(feed).toHaveLength(2);
    expect(feed[0].senderType).toBe("exalco");
    expect(feed[0].threadId).toBeUndefined();

    // 3. ADK sends follow-up message
    await asUser.mutation(api.orders.recordCrmNoteSent, {
      orderId,
      deliveryIndex: 0,
      noteText: "Kolejna wiadomość od ADK",
    });

    order = await t.run(async (ctx) => ctx.db.get(orderId));
    feed = order!.serviceDeliveries![0].notesFeed!;
    expect(feed).toHaveLength(3);
    expect(feed[0].senderType).toBe("adk");
    expect(feed[0].threadId).toBeUndefined();
    expect(feed[0].sentToCrm).toBe(true);
  });

  test("prevents editing or deleting persisted notesFeed messages via orders.update", async () => {
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
      firstName: "Jan",
      lastName: "Kowalski",
    });

    const orderId = await asUser.mutation(api.orders.create, { clientId });

    await asUser.mutation(api.orders.update, {
      orderId,
      serviceDeliveries: [
        {
          serviceName: "Okna ALU",
          supplierId,
          notesFeed: [
            {
              id: "msg-1",
              note: "Oryginalna wiadomość",
              createdAt: 1000,
              senderType: "adk",
              sentToCrm: true,
            },
          ],
        },
      ],
    });

    // Próba edycji treści msg-1 oraz usunięcia jej (przekazanie pustego notesFeed)
    await asUser.mutation(api.orders.update, {
      orderId,
      serviceDeliveries: [
        {
          serviceName: "Okna ALU",
          supplierId,
          notesFeed: [
            {
              id: "msg-1",
              note: "Zmieniona treść",
              createdAt: 1000,
              senderType: "adk",
              sentToCrm: true,
            },
          ],
        },
      ],
    });

    let updated = await t.run(async (ctx) => ctx.db.get(orderId));
    expect(updated!.serviceDeliveries![0].notesFeed).toHaveLength(1);
    expect(updated!.serviceDeliveries![0].notesFeed![0].note).toBe("Oryginalna wiadomość");

    await asUser.mutation(api.orders.update, {
      orderId,
      serviceDeliveries: [
        {
          serviceName: "Okna ALU",
          supplierId,
          notesFeed: [],
        },
      ],
    });

    updated = await t.run(async (ctx) => ctx.db.get(orderId));
    expect(updated!.serviceDeliveries![0].notesFeed).toHaveLength(1);
    expect(updated!.serviceDeliveries![0].notesFeed![0].note).toBe("Oryginalna wiadomość");
  });

  test("allows editing and deleting internal notes for non-Exalco suppliers via orders.update", async () => {
    const t = convexTest(schema);
    const asUser = await setupAuthContext(t);

    const internalSupplierId = await t.run(async (ctx) => {
      return await ctx.db.insert("suppliers", {
        name: "Dostawca Lokalny",
        isActive: true,
        isApiEnabled: false,
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
          serviceName: "Parapety",
          supplierId: internalSupplierId,
          notesFeed: [
            {
              id: "int-1",
              note: "Notatka wewnętrzna",
              createdAt: 1000,
              senderType: "adk",
              sentToCrm: false,
            },
          ],
        },
      ],
    });

    await asUser.mutation(api.orders.update, {
      orderId,
      serviceDeliveries: [
        {
          serviceName: "Parapety",
          supplierId: internalSupplierId,
          notesFeed: [
            {
              id: "int-1",
              note: "Zmieniona notatka wewnętrzna",
              createdAt: 1000,
              senderType: "adk",
              sentToCrm: false,
            },
          ],
        },
      ],
    });

    let updated = await t.run(async (ctx) => ctx.db.get(orderId));
    expect(updated!.serviceDeliveries![0].notesFeed![0].note).toBe("Zmieniona notatka wewnętrzna");

    await asUser.mutation(api.orders.update, {
      orderId,
      serviceDeliveries: [
        {
          serviceName: "Parapety",
          supplierId: internalSupplierId,
          notesFeed: [],
        },
      ],
    });

    updated = await t.run(async (ctx) => ctx.db.get(orderId));
    expect(updated!.serviceDeliveries![0].notesFeed).toHaveLength(0);
  });

  test("does not copy notesFeed from first sent delivery when adding a second delivery for the same service and supplier", async () => {
    const t = convexTest(schema);
    const asUser = await setupAuthContext(t);

    const supplierId = await t.run(async (ctx) => {
      return await ctx.db.insert("suppliers", {
        name: "ALCO",
        isActive: true,
        isApiEnabled: true,
        createdBy: "test-user",
      });
    });

    const clientId = await asUser.mutation(api.clients.create, {
      firstName: "Piotr",
      lastName: "Zieliński",
    });

    const orderId = await asUser.mutation(api.orders.create, { clientId });

    const firstDelivery = {
      serviceName: "Okna ALU",
      supplierId,
      externalOrderNumber: "ST-261119806",
      netAmount: 1111111,
      notesFeed: [
        {
          id: "sent-msg-1",
          note: "Wiadomość z pierwszego zamówienia",
          createdAt: 1000,
          senderType: "adk" as const,
          sentToCrm: true,
        },
      ],
    };

    await asUser.mutation(api.orders.update, {
      orderId,
      serviceDeliveries: [firstDelivery],
    });

    // Dodanie drugiego zamówienia dla tej samej usługi i dostawcy
    await asUser.mutation(api.orders.update, {
      orderId,
      serviceDeliveries: [
        firstDelivery,
        {
          serviceName: "Okna ALU",
          supplierId,
          notesFeed: [],
        },
      ],
    });

    const updated = await t.run(async (ctx) => ctx.db.get(orderId));
    expect(updated!.serviceDeliveries).toHaveLength(2);
    expect(updated!.serviceDeliveries![0].notesFeed).toHaveLength(1);
    expect(updated!.serviceDeliveries![1].notesFeed).toHaveLength(0);
  });

  test("saves product questions on supplier and creates ADK/CRM message from product answers", async () => {
    const t = convexTest(schema);
    const asUser = await setupAuthContext(t);

    const supplierId = await asUser.mutation(api.suppliers.create, {
      name: "ALCO-QA",
      products: [
        {
          id: "prod-okna",
          name: "Okna",
          isActive: true,
          questions: [
            { id: "q-1", question: "Kolor profilu" },
            { id: "q-2", question: "Pakiet szybowy" },
          ],
        },
      ],
    });

    const supplier = await t.run(async (ctx) => ctx.db.get(supplierId));
    expect(supplier?.products?.[0]?.questions).toHaveLength(2);
    expect(supplier?.products?.[0]?.questions?.[0]?.question).toBe("Kolor profilu");

    const clientId = await asUser.mutation(api.clients.create, {
      firstName: "Marek",
      lastName: "Testowy",
    });

    const orderId = await asUser.mutation(api.orders.create, { clientId });

    await asUser.mutation(api.orders.update, {
      orderId,
      serviceDeliveries: [
        {
          serviceName: "Okna ALU",
          supplierId,
          netAmount: 25000,
          selectedProducts: [
            {
              id: "prod-okna",
              name: "Okna",
              answers: [
                { questionId: "q-1", question: "Kolor profilu", answer: "RAL 7016 Antracyt" },
                { questionId: "q-2", question: "Pakiet szybowy", answer: "3-szybowy ciepły" },
              ],
            },
          ],
        },
      ],
    });

    const orderAfterSave = await asUser.query(api.orders.getById, { orderId });
    const feedAfterSave = orderAfterSave?.serviceDeliveries?.[0]?.notesFeed ?? [];
    expect(feedAfterSave).toHaveLength(1);
    expect(feedAfterSave[0].note).toContain("📋 Specyfikacja produktów:");
    expect(feedAfterSave[0].note).toContain("• Okna:");
    expect(feedAfterSave[0].note).toContain("- Kolor profilu: RAL 7016 Antracyt");
    expect(feedAfterSave[0].note).toContain("- Pakiet szybowy: 3-szybowy ciepły");
    expect(feedAfterSave[0].sentToCrm).toBe(false);

    // Symulacja wysyłki zamówienia do CRM (zapis numeru zamówienia + oznaczenie wiadomości jako wysłanej)
    await asUser.mutation(api.orders.updateExternalOrderInfo, {
      orderId,
      deliveryIndex: 0,
      externalOrderId: "ext-qa-1",
      externalOrderNumber: "ST-261199999",
    });
    await asUser.mutation(api.orders.markAllDeliveryNotesSentToCrm, {
      orderId,
      deliveryIndex: 0,
    });

    const orderAfterSend = await asUser.query(api.orders.getById, { orderId });
    const feedAfterSend = orderAfterSend?.serviceDeliveries?.[0]?.notesFeed ?? [];
    expect(feedAfterSend).toHaveLength(1);
    expect(feedAfterSend[0].sentToCrm).toBe(true);
    expect(orderAfterSend?.serviceDeliveries?.[0]?.crmNotesHistory?.[0]?.note).toContain(
      "- Kolor profilu: RAL 7016 Antracyt",
    );
  });
});

