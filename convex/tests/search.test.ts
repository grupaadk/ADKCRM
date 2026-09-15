import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { DEFAULT_DOCUMENTS } from "../orders";

type TestRuntime = ReturnType<typeof convexTest>;

async function setupAuthContext(t: TestRuntime) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email: "test@example.pl",
      displayName: "Test User",
      role: "admin",
      isActive: true,
    });
  });
  return { asUser: t.withIdentity({ subject: userId }), userId };
}

describe("Search by ALCO order number", () => {
  test("finds order by ALCO externalOrderNumber (ST-260910108)", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupAuthContext(t);

    // Create supplier
    const supplierId = await t.run(async (ctx) => {
      return await ctx.db.insert("suppliers", {
        name: "ALCO",
        isActive: true,
        createdBy: "admin",
      });
    });

    // Create client
    const clientId = await t.run(async (ctx) => {
      return await ctx.db.insert("clients", {
        firstName: "Jan",
        lastName: "Kowalski",
        status: "lead",
        source: "manual",
        createdBy: "admin",
      });
    });

    // Create order with ALCO delivery line having externalOrderNumber "ST-260910108"
    const orderId = await t.run(async (ctx) => {
      return await ctx.db.insert("orders", {
        clientId,
        name: "Zlecenie Stolarce Aluminium",
        status: "production",
        documents: DEFAULT_DOCUMENTS,
        source: "manual",
        createdBy: "admin",
        serviceDeliveries: [
          {
            serviceName: "Stolarka okienna",
            supplierId,
            externalOrderNumber: "ST-260910108",
            externalOrderId: "alco_ext_12345",
          },
        ],
      });
    });

    // Perform global search for "ST-260910108"
    const results = await asUser.query(api.search.querySearch, {
      query: "ST-260910108",
      types: ["zlecenia"],
    });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(orderId);
    expect(results[0].type).toBe("zlecenia");
    expect(results[0].title).toBe("Zlecenie Stolarce Aluminium");
    expect(results[0].tags).toContain("ALCO: ST-260910108");
  });

  test("finds order by ALCO externalOrderId (alco_ext_999)", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupAuthContext(t);

    const supplierId = await t.run(async (ctx) => {
      return await ctx.db.insert("suppliers", {
        name: "ALCO",
        isActive: true,
        createdBy: "admin",
      });
    });

    const clientId = await t.run(async (ctx) => {
      return await ctx.db.insert("clients", {
        firstName: "Anna",
        lastName: "Nowak",
        status: "lead",
        source: "manual",
        createdBy: "admin",
      });
    });

    const orderId = await t.run(async (ctx) => {
      return await ctx.db.insert("orders", {
        clientId,
        name: "Zlecenie Fasady Glass",
        status: "production",
        documents: DEFAULT_DOCUMENTS,
        source: "manual",
        createdBy: "admin",
        serviceDeliveries: [
          {
            serviceName: "Fasady",
            supplierId,
            externalOrderId: "alco_ext_999",
          },
        ],
      });
    });

    const results = await asUser.query(api.search.querySearch, {
      query: "alco_ext_999",
      types: ["zlecenia"],
    });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(orderId);
  });

  test("does not return orders with similar ALCO numbers via fuzzy matching", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupAuthContext(t);

    const supplierId = await t.run(async (ctx) => {
      return await ctx.db.insert("suppliers", {
        name: "ALCO",
        isActive: true,
        createdBy: "admin",
      });
    });

    const clientId = await t.run(async (ctx) => {
      return await ctx.db.insert("clients", {
        firstName: "Piotr",
        lastName: "Zieliński",
        status: "lead",
        source: "manual",
        createdBy: "admin",
      });
    });

    // Order 1: ST-260910008
    const orderId1 = await t.run(async (ctx) => {
      return await ctx.db.insert("orders", {
        clientId,
        name: "Zlecenie A",
        status: "production",
        documents: DEFAULT_DOCUMENTS,
        source: "manual",
        createdBy: "admin",
        serviceDeliveries: [
          {
            serviceName: "Stolarka",
            supplierId,
            externalOrderNumber: "ST-260910008",
          },
        ],
      });
    });

    // Order 2: ST-260910108 (differs by 1 digit)
    await t.run(async (ctx) => {
      return await ctx.db.insert("orders", {
        clientId,
        name: "Zlecenie B",
        status: "production",
        documents: DEFAULT_DOCUMENTS,
        source: "manual",
        createdBy: "admin",
        serviceDeliveries: [
          {
            serviceName: "Stolarka",
            supplierId,
            externalOrderNumber: "ST-260910108",
          },
        ],
      });
    });

    // Search for ST-260910008
    const results = await asUser.query(api.search.querySearch, {
      query: "ST-260910008",
      types: ["zlecenia"],
    });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(orderId1);
  });
});
