import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

// ============================================================
// US-1.2 — Manual Client Creation
// ============================================================
describe("US-1.2 — Manual Client Creation (clients.create)", () => {
  test("creates client with source 'manual'", async () => {
    const t = convexTest(schema);

    const clientId = await t.mutation(api.clients.create, {
      firstName: "Tomasz",
      lastName: "Krawczyk",
      email: "tomasz@example.com",
      phone: "+48987654321",
      city: "Kraków",
      street: "Floriańska",
      buildingNumber: "10",
    });

    expect(clientId).toBeDefined();

    const client = await t.query(api.clients.getById, { clientId });
    expect(client).not.toBeNull();
    expect(client!.source).toBe("manual");
    expect(client!.firstName).toBe("Tomasz");
    expect(client!.lastName).toBe("Krawczyk");
    expect(client!.email).toBe("tomasz@example.com");
    expect(client!.city).toBe("Kraków");
  });

  test("requires firstName and lastName (minimal args)", async () => {
    const t = convexTest(schema);

    const clientId = await t.mutation(api.clients.create, {
      firstName: "Ewa",
      lastName: "Maj",
    });

    const client = await t.query(api.clients.getById, { clientId });
    expect(client).not.toBeNull();
    expect(client!.firstName).toBe("Ewa");
    expect(client!.lastName).toBe("Maj");
    expect(client!.source).toBe("manual");
  });

  test("creates 'created' event with source 'manual'", async () => {
    const t = convexTest(schema);

    const clientId = await t.mutation(api.clients.create, {
      firstName: "Anna",
      lastName: "Duda",
    });

    const events = await t.run(async (ctx) => {
      return await ctx.db
        .query("clientEvents")
        .withIndex("by_client", (q) => q.eq("clientId", clientId))
        .collect();
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("created");
    expect(events[0].details.source).toBe("manual");
  });

  test("sets createdBy from auth identity", async () => {
    const t = convexTest(schema);

    const asUser = t.withIdentity({
      subject: "clerk-user-abc123",
      name: "Admin Testowy",
    });

    const clientId = await asUser.mutation(api.clients.create, {
      firstName: "Marek",
      lastName: "Borkowski",
    });

    const client = await t.query(api.clients.getById, { clientId });
    expect(client).not.toBeNull();
    expect(client!.createdBy).toBe("clerk-user-abc123");

    const events = await t.run(async (ctx) => {
      return await ctx.db
        .query("clientEvents")
        .withIndex("by_client", (q) => q.eq("clientId", clientId))
        .collect();
    });

    expect(events[0].performedBy).toBe("clerk-user-abc123");
  });
});

// ============================================================
// US-1.3 — Client Listing & Search
// ============================================================
describe("US-1.3 — Client Listing & Search", () => {
  test("lists all clients", async () => {
    const t = convexTest(schema);


    const result = await t.query(api.clients.list, {});
    expect(result.page).toHaveLength(3);
  });

  test("getById returns a specific client", async () => {
    const t = convexTest(schema);

    const clientId = await t.mutation(api.clients.create, {
      firstName: "Zofia",
      lastName: "Kaminska",
      email: "zofia@test.pl",
    });

    const client = await t.query(api.clients.getById, { clientId });
    expect(client).not.toBeNull();
    expect(client!._id).toBe(clientId);
    expect(client!.firstName).toBe("Zofia");
    expect(client!.lastName).toBe("Kaminska");
  });

  test("getById returns null for non-existent client", async () => {
    const t = convexTest(schema);

    const clientId = await t.mutation(api.clients.create, {
      firstName: "Temp",
      lastName: "Testowy",
    });

    await t.run(async (ctx) => {
      await ctx.db.delete(clientId);
    });

    const client = await t.query(api.clients.getById, { clientId });
    expect(client).toBeNull();
  });

  test("searches by lastName", async () => {
    const t = convexTest(schema);


    const results = await t.query(api.clients.search, { searchTerm: "Kowalski" });

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((c: { lastName: string }) => c.lastName === "Kowalski")).toBe(true);
  });
});

// ============================================================
// Deduplication
// ============================================================
describe("Deduplication", () => {
  test("findByEmail returns existing client", async () => {
    const t = convexTest(schema);

    await t.mutation(api.clients.create, {
      firstName: "Jan",
      lastName: "Kowalski",
      email: "jan@example.com",
    });

    const found = await t.query(api.clients.findByEmail, {
      email: "jan@example.com",
    });

    expect(found).not.toBeNull();
    expect(found!.firstName).toBe("Jan");
    expect(found!.lastName).toBe("Kowalski");
    expect(found!.email).toBe("jan@example.com");
  });

  test("findByEmail returns null for unknown email", async () => {
    const t = convexTest(schema);

    const found = await t.query(api.clients.findByEmail, {
      email: "nieistnieje@example.com",
    });

    expect(found).toBeNull();
  });

  test("addSubmissionEvent logs duplicate event", async () => {
    const t = convexTest(schema);

    const clientId = await t.mutation(api.clients.create, {
      firstName: "Jan",
      lastName: "Kowalski",
      email: "jan@example.com",
    });

    await t.mutation(api.jotformInternal.addSubmissionEvent, {
      clientId,
      submissionId: "jotform-002",
      payload: { firstName: "Jan", lastName: "Kowalski" },
    });

    const events = await t.run(async (ctx) => {
      return await ctx.db
        .query("clientEvents")
        .withIndex("by_client", (q) => q.eq("clientId", clientId))
        .collect();
    });

    const duplicateEvent = events.find((e) => e.type === "jotform_duplicate_submission");
    expect(duplicateEvent).toBeDefined();
    expect(duplicateEvent!.details.submissionId).toBe("jotform-002");
    expect(duplicateEvent!.performedBy).toBe("system");
  });
});
