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

describe("Supplier Products & Order Multi-Select", () => {
  test("creates and updates supplier products with normalization and duplicate validation", async () => {
    const t = convexTest(schema);
    const asUser = await setupAuthContext(t);

    const supplierId = await asUser.mutation(api.suppliers.create, {
      name: "ALCO",
      products: [
        { id: "p1", name: "  Pergola Tarasowa  ", isActive: true },
        { id: "p2", name: "Markiza", isActive: false },
      ],
    });

    let suppliers = await asUser.query(api.suppliers.list, { includeInactive: true });
    const alco = suppliers.find((s) => s._id === supplierId);
    expect(alco?.products).toEqual([
      { id: "p1", name: "Pergola Tarasowa", isActive: true },
      { id: "p2", name: "Markiza", isActive: false },
    ]);

    await expect(
      asUser.mutation(api.suppliers.update, {
        id: supplierId,
        products: [
          { id: "p1", name: "Pergola", isActive: true },
          { id: "p3", name: "  pergola ", isActive: true },
        ],
      })
    ).rejects.toThrow(/już przypisany/);

    await expect(
      asUser.mutation(api.suppliers.update, {
        id: supplierId,
        products: [{ id: "p1", name: "   ", isActive: true }],
      })
    ).rejects.toThrow(/pusta/);

    await asUser.mutation(api.suppliers.update, {
      id: supplierId,
      products: [
        { id: "p1", name: "Pergola Tarasowa", isActive: true },
        { id: "p2", name: "Markiza", isActive: true },
        { id: "p3", name: "Zadaszenie szklane", isActive: true },
      ],
    });

    suppliers = await asUser.query(api.suppliers.list, { includeInactive: true });
    expect(suppliers.find((s) => s._id === supplierId)?.products).toHaveLength(3);
  });

  test("saves multiple selectedProducts in order serviceDeliveries and preserves snapshot after deactivation", async () => {
    const t = convexTest(schema);
    const asUser = await setupAuthContext(t);

    const supplierId = await asUser.mutation(api.suppliers.create, {
      name: "ALCO",
      products: [
        { id: "p1", name: "Pergola Tarasowa", isActive: true },
        { id: "p2", name: "Zadaszenie szklane", isActive: true },
        { id: "p3", name: "Roleta Screen", isActive: true },
      ],
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
          serviceName: "Pergole",
          supplierId,
          netAmount: 15000,
          selectedProducts: [
            { id: "p1", name: "Pergola Tarasowa" },
            { id: "p3", name: "Roleta Screen" },
          ],
        },
      ],
    });

    let order = await asUser.query(api.orders.getById, { orderId });
    expect(order?.serviceDeliveries?.[0]?.selectedProducts).toEqual([
      { id: "p1", name: "Pergola Tarasowa" },
      { id: "p3", name: "Roleta Screen" },
    ]);

    // Dezaktywacja/usunięcie produktu u dostawcy nie usuwa zapisanego wyboru ze zlecenia
    await asUser.mutation(api.suppliers.update, {
      id: supplierId,
      products: [
        { id: "p1", name: "Pergola Tarasowa", isActive: false },
        { id: "p2", name: "Zadaszenie szklane", isActive: true },
      ],
    });

    order = await asUser.query(api.orders.getById, { orderId });
    expect(order?.serviceDeliveries?.[0]?.selectedProducts).toEqual([
      { id: "p1", name: "Pergola Tarasowa" },
      { id: "p3", name: "Roleta Screen" },
    ]);
  });
});
