import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

type TestRuntime = ReturnType<typeof convexTest>;

async function createTestOrder(t: TestRuntime) {
  const clientId = await t.mutation(api.clients.create, {
    firstName: "Test",
    lastName: "Klient",
    email: "test@example.pl",
  });
  const orderId = await t.mutation(api.orders.create, { clientId });
  return { clientId, orderId };
}

describe("US-3.4 — Document toggle", () => {
  test("toggle document ON sets enabled=true and generatedAt", async () => {
    const t = convexTest(schema);
    const { orderId } = await createTestOrder(t);

    await t.mutation(api.orders.toggleDocument, {
      orderId,
      documentType: "pomiar",
      enabled: true,
    });

    const order = await t.query(api.orders.getById, { orderId });
    expect(order!.documents.pomiar.enabled).toBe(true);
    expect(order!.documents.pomiar.generatedAt).toBeTypeOf("number");
  });

  test("toggle document OFF sets enabled=false", async () => {
    const t = convexTest(schema);
    const { orderId } = await createTestOrder(t);

    await t.mutation(api.orders.toggleDocument, { orderId, documentType: "umowa", enabled: true });
    await t.mutation(api.orders.toggleDocument, { orderId, documentType: "umowa", enabled: false });

    const order = await t.query(api.orders.getById, { orderId });
    expect(order!.documents.umowa.enabled).toBe(false);
  });

  test("toggle document with URL saves the URL", async () => {
    const t = convexTest(schema);
    const { orderId } = await createTestOrder(t);

    await t.mutation(api.orders.toggleDocument, {
      orderId,
      documentType: "pomiar",
      enabled: true,
      url: "https://drive.google.com/file/pomiar-123",
    });

    const order = await t.query(api.orders.getById, { orderId });
    expect(order!.documents.pomiar.url).toBe("https://drive.google.com/file/pomiar-123");
    expect(order!.documents.pomiar.enabled).toBe(true);
  });

  test("re-toggling preserves existing URL", async () => {
    const t = convexTest(schema);
    const { orderId } = await createTestOrder(t);

    await t.mutation(api.orders.toggleDocument, {
      orderId,
      documentType: "faktura",
      enabled: true,
      url: "https://drive.google.com/file/faktura-1",
    });

    await t.mutation(api.orders.toggleDocument, {
      orderId,
      documentType: "faktura",
      enabled: false,
    });

    const order = await t.query(api.orders.getById, { orderId });
    expect(order!.documents.faktura.enabled).toBe(false);
    expect(order!.documents.faktura.url).toBe("https://drive.google.com/file/faktura-1");
  });
});

describe("US-3.5 — Gwarancja = 2 files", () => {
  test("toggling gwarancja_alco ON also toggles rekojmia_adk ON", async () => {
    const t = convexTest(schema);
    const { orderId } = await createTestOrder(t);

    await t.mutation(api.orders.toggleDocument, {
      orderId,
      documentType: "gwarancja_alco",
      enabled: true,
    });

    const order = await t.query(api.orders.getById, { orderId });
    expect(order!.documents.gwarancja_alco.enabled).toBe(true);
    expect(order!.documents.rekojmia_adk.enabled).toBe(true);
    expect(order!.documents.rekojmia_adk.generatedAt).toBeTypeOf("number");
  });

  test("toggling gwarancja_alco OFF also toggles rekojmia_adk OFF", async () => {
    const t = convexTest(schema);
    const { orderId } = await createTestOrder(t);

    await t.mutation(api.orders.toggleDocument, { orderId, documentType: "gwarancja_alco", enabled: true });
    await t.mutation(api.orders.toggleDocument, { orderId, documentType: "gwarancja_alco", enabled: false });

    const order = await t.query(api.orders.getById, { orderId });
    expect(order!.documents.gwarancja_alco.enabled).toBe(false);
    expect(order!.documents.rekojmia_adk.enabled).toBe(false);
  });
});

describe("US-3.6 — Warranty cards", () => {
  test("addWarrantyCard adds a card to empty warrantyCards array", async () => {
    const t = convexTest(schema);
    const { orderId } = await createTestOrder(t);

    await t.mutation(api.orders.addWarrantyCard, {
      orderId,
      manufacturer: "Aluplast",
      type: "okna_PVC",
      fileUrl: "https://drive.google.com/file/warranty-1",
    });

    const order = await t.query(api.orders.getById, { orderId });
    expect(order!.warrantyCards).toHaveLength(1);
    expect(order!.warrantyCards![0].manufacturer).toBe("Aluplast");
    expect(order!.warrantyCards![0].type).toBe("okna_PVC");
    expect(order!.warrantyCards![0].fileUrl).toBe("https://drive.google.com/file/warranty-1");
    expect(order!.warrantyCards![0].uploadedAt).toBeTypeOf("number");
  });

  test("addWarrantyCard appends to existing cards", async () => {
    const t = convexTest(schema);
    const { orderId } = await createTestOrder(t);

    await t.mutation(api.orders.addWarrantyCard, {
      orderId,
      manufacturer: "Aluplast",
      type: "okna_PVC",
      fileUrl: "https://drive.google.com/file/warranty-1",
    });
    await t.mutation(api.orders.addWarrantyCard, {
      orderId,
      manufacturer: "Yawal",
      type: "aluminium",
      fileUrl: "https://drive.google.com/file/warranty-2",
    });

    const order = await t.query(api.orders.getById, { orderId });
    expect(order!.warrantyCards).toHaveLength(2);
    expect(order!.warrantyCards![0].manufacturer).toBe("Aluplast");
    expect(order!.warrantyCards![1].manufacturer).toBe("Yawal");
  });

  test("addWarrantyCard creates an event", async () => {
    const t = convexTest(schema);
    const { orderId } = await createTestOrder(t);

    await t.mutation(api.orders.addWarrantyCard, {
      orderId,
      manufacturer: "Aluplast",
      type: "okna_PVC",
      fileUrl: "https://drive.google.com/file/warranty-1",
    });

    const events = await t.query(api.events.listByOrder, { orderId });
    const warrantyEvent = events.find((e: { type: string }) => e.type === "warranty_card_added");
    expect(warrantyEvent).toBeDefined();
    expect(warrantyEvent!.details.manufacturer).toBe("Aluplast");
    expect(warrantyEvent!.details.type).toBe("okna_PVC");
  });
});
