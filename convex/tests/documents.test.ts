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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createTestOrder(asUser: any) {
  const clientId = await asUser.mutation(api.clients.create, {
    firstName: "Test",
    lastName: "Klient",
    email: "test@example.pl",
  });
  const orderId = await asUser.mutation(api.orders.create, {
    clientId,
    investmentStreet: "Ul. Prosta 1",
    investmentCity: "Warszawa",
  });
  return { clientId, orderId };
}

describe("US-3.4 — Document toggle", () => {
  test("toggle document ON sets enabled=true and generatedAt", async () => {
    const t = convexTest(schema);
    const asUser = await setupAuthContext(t);
    const { orderId } = await createTestOrder(asUser);

    await asUser.mutation(api.orders.toggleDocument, {
      orderId,
      documentType: "pomiar",
      enabled: true,
    });

    const order = await asUser.query(api.orders.getById, { orderId });
    expect(order!.documents.pomiar.enabled).toBe(true);
    expect(order!.documents.pomiar.generatedAt).toBeTypeOf("number");
  });

  test("toggle document OFF sets enabled=false", async () => {
    const t = convexTest(schema);
    const asUser = await setupAuthContext(t);
    const { orderId } = await createTestOrder(asUser);

    await asUser.mutation(api.orders.toggleDocument, { orderId, documentType: "umowa", enabled: true });
    await asUser.mutation(api.orders.toggleDocument, { orderId, documentType: "umowa", enabled: false });

    const order = await asUser.query(api.orders.getById, { orderId });
    expect(order!.documents.umowa.enabled).toBe(false);
  });

  test("toggle document with URL saves the URL", async () => {
    const t = convexTest(schema);
    const asUser = await setupAuthContext(t);
    const { orderId } = await createTestOrder(asUser);

    await asUser.mutation(api.orders.toggleDocument, {
      orderId,
      documentType: "pomiar",
      enabled: true,
      url: "https://drive.google.com/file/pomiar-123",
    });

    const order = await asUser.query(api.orders.getById, { orderId });
    expect(order!.documents.pomiar.url).toBe("https://drive.google.com/file/pomiar-123");
    expect(order!.documents.pomiar.enabled).toBe(true);
  });

  test("re-toggling OFF clears URL", async () => {
    const t = convexTest(schema);
    const asUser = await setupAuthContext(t);
    const { orderId } = await createTestOrder(asUser);

    await asUser.mutation(api.orders.toggleDocument, {
      orderId,
      documentType: "faktura",
      enabled: true,
      url: "https://drive.google.com/file/faktura-1",
    });

    await asUser.mutation(api.orders.toggleDocument, {
      orderId,
      documentType: "faktura",
      enabled: false,
    });

    const order = await asUser.query(api.orders.getById, { orderId });
    expect(order!.documents.faktura.enabled).toBe(false);
    expect(order!.documents.faktura.url).toBeUndefined();
  });
});

describe("US-3.5 — Gwarancja document toggle", () => {
  test("toggling gwarancja_alco ON enables gwarancja_alco", async () => {
    const t = convexTest(schema);
    const asUser = await setupAuthContext(t);
    const { orderId } = await createTestOrder(asUser);

    await asUser.mutation(api.orders.toggleDocument, {
      orderId,
      documentType: "gwarancja_alco",
      enabled: true,
    });

    const order = await asUser.query(api.orders.getById, { orderId });
    expect(order!.documents.gwarancja_alco.enabled).toBe(true);
    expect(order!.documents.gwarancja_alco.generatedAt).toBeTypeOf("number");
  });

  test("toggling gwarancja_alco OFF disables gwarancja_alco", async () => {
    const t = convexTest(schema);
    const asUser = await setupAuthContext(t);
    const { orderId } = await createTestOrder(asUser);

    await asUser.mutation(api.orders.toggleDocument, { orderId, documentType: "gwarancja_alco", enabled: true });
    await asUser.mutation(api.orders.toggleDocument, { orderId, documentType: "gwarancja_alco", enabled: false });

    const order = await asUser.query(api.orders.getById, { orderId });
    expect(order!.documents.gwarancja_alco.enabled).toBe(false);
  });
});

describe("US-3.6 — Warranty cards", () => {
  test("addWarrantyCard adds a card to empty warrantyCards array", async () => {
    const t = convexTest(schema);
    const asUser = await setupAuthContext(t);
    const { orderId } = await createTestOrder(asUser);

    await asUser.mutation(api.orders.addWarrantyCard, {
      orderId,
      manufacturer: "Yawal",
      type: "aluminium",
      fileUrl: "https://drive.google.com/file/w1",
    });

    const order = await asUser.query(api.orders.getById, { orderId });
    expect(order!.warrantyCards).toHaveLength(1);
    expect(order!.warrantyCards?.[0]?.manufacturer).toBe("Yawal");
  });
});
