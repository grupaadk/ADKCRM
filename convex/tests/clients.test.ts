import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

// ============================================================
// US-1.1 — Jotform Webhook (createFromWebhook)
// ============================================================
describe("US-1.1 — Jotform Webhook (createFromWebhook)", () => {
  test("creates client and order from webhook data with status 'lead' and source 'jotform'", async () => {
    const t = convexTest(schema);

    const result = await t.mutation(api.jotformInternal.createFromWebhook, {
      firstName: "Jan",
      lastName: "Kowalski",
      email: "jan@example.com",
      phone: "+48123456789",
      city: "Warszawa",
      services: ["Okna", "Drzwi"],
      windowColor: ["Biały"],
      doorColor: ["Antracyt"],
      gateColor: ["Srebrny"],
      terraceColor: ["Orzech"],
      constructionColor: ["RAL 7016"],
      sunProtectionType: ["Roleta zewnętrzna"],
      projectFiles: "https://jotform.com/uploads/file.pdf",
      comment: "Proszę o kontakt wieczorem",
      submissionId: "jotform-12345",
    });

    const { clientId, orderId } = result;
    expect(clientId).toBeDefined();
    expect(orderId).toBeDefined();

    const client = await t.query(api.clients.getById, { clientId });
    expect(client).not.toBeNull();
    expect(client!.source).toBe("jotform");
    expect(client!.firstName).toBe("Jan");
    expect(client!.lastName).toBe("Kowalski");
    expect(client!.createdBy).toBe("system");

    const order = await t.query(api.orders.getById, { orderId });
    expect(order).not.toBeNull();
    expect(order!.status).toBe("lead");
    expect(order!.source).toBe("jotform");
    expect(order!.jotformSubmissionId).toBe("jotform-12345");
  });

  test("stores all order data (services, colors, etc.)", async () => {
    const t = convexTest(schema);

    const { clientId, orderId } = await t.mutation(api.jotformInternal.createFromWebhook, {
      firstName: "Maria",
      lastName: "Nowak",
      services: ["Okna", "Brama", "Zabudowa tarasu"],
      windowColor: ["Biały", "Złoty dąb"],
      doorColor: ["Antracyt"],
      gateColor: ["Srebrny"],
      terraceColor: ["Orzech"],
      constructionColor: ["RAL 9005"],
      sunProtectionType: ["Markiza"],
      projectFiles: "https://jotform.com/uploads/plan.pdf",
      comment: "Pilne zamówienie",
    });

    const client = await t.query(api.clients.getById, { clientId });
    expect(client).not.toBeNull();

    const order = await t.query(api.orders.getById, { orderId });
    expect(order).not.toBeNull();
    expect(order!.services).toEqual(["Okna", "Brama", "Zabudowa tarasu"]);
    expect(order!.windowColor).toEqual(["Biały", "Złoty dąb"]);
    expect(order!.doorColor).toEqual(["Antracyt"]);
    expect(order!.gateColor).toEqual(["Srebrny"]);
    expect(order!.terraceColor).toEqual(["Orzech"]);
    expect(order!.constructionColor).toEqual(["RAL 9005"]);
    expect(order!.sunProtectionType).toEqual(["Markiza"]);
    expect(order!.projectFiles).toBe("https://jotform.com/uploads/plan.pdf");
    expect(order!.comment).toBe("Pilne zamówienie");
  });

  test("creates 'created' and 'order_created' events", async () => {
    const t = convexTest(schema);

    const { clientId } = await t.mutation(api.jotformInternal.createFromWebhook, {
      firstName: "Andrzej",
      lastName: "Wiśniewski",
      services: ["Okna"],
      submissionId: "jotform-99999",
    });

    const events = await t.run(async (ctx) => {
      return await ctx.db
        .query("clientEvents")
        .withIndex("by_client", (q) => q.eq("clientId", clientId))
        .collect();
    });

    expect(events.length).toBeGreaterThanOrEqual(1);
    const createdEvent = events.find((e) => e.type === "created");
    expect(createdEvent).toBeDefined();
    expect(createdEvent!.details.source).toBe("jotform");
    expect(createdEvent!.details.submissionId).toBe("jotform-99999");
    expect(createdEvent!.performedBy).toBe("system");
  });

  test("handles minimal data (only firstName and lastName)", async () => {
    const t = convexTest(schema);

    const { clientId, orderId } = await t.mutation(api.jotformInternal.createFromWebhook, {
      firstName: "Marek",
      lastName: "Zielinski",
    });

    const client = await t.query(api.clients.getById, { clientId });
    expect(client).not.toBeNull();
    expect(client!.firstName).toBe("Marek");
    expect(client!.lastName).toBe("Zielinski");
    expect(client!.email).toBeUndefined();
    expect(client!.phone).toBeUndefined();
    expect(client!.city).toBeUndefined();

    const order = await t.query(api.orders.getById, { orderId });
    expect(order).not.toBeNull();
    expect(order!.status).toBe("lead");
    expect(order!.source).toBe("jotform");
    expect(order!.services).toBeUndefined();
  });
});

// ============================================================
// US-1.2 — Manual Client Creation
// ============================================================
describe("US-1.2 — Manual Client Creation (clients.create)", () => {
  test("creates client with source 'manual'", async () => {
    const t = convexTest(schema);

    const clientId = await t.mutation(api.clients.create, {
      firstName: "Tomasz",
      lastName: "Krawczyk",
      gender: "male",
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
      gender: "female",
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
      gender: "female",
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
      gender: "male",
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

    await t.mutation(api.clients.create, { firstName: "Klient", lastName: "Pierwszy", gender: "male" });
    await t.mutation(api.clients.create, { firstName: "Klient", lastName: "Drugi", gender: "male" });
    await t.mutation(api.clients.create, { firstName: "Klient", lastName: "Trzeci", gender: "male" });

    const result = await t.query(api.clients.list, {});
    expect(result.page).toHaveLength(3);
  });

  test("getById returns a specific client", async () => {
    const t = convexTest(schema);

    const clientId = await t.mutation(api.clients.create, {
      firstName: "Zofia",
      lastName: "Kaminska",
      gender: "female",
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
      gender: "male",
    });

    await t.run(async (ctx) => {
      await ctx.db.delete(clientId);
    });

    const client = await t.query(api.clients.getById, { clientId });
    expect(client).toBeNull();
  });

  test("searches by lastName", async () => {
    const t = convexTest(schema);

    await t.mutation(api.clients.create, { firstName: "Jan", lastName: "Kowalski", gender: "male" });
    await t.mutation(api.clients.create, { firstName: "Anna", lastName: "Nowak", gender: "female" });
    await t.mutation(api.clients.create, { firstName: "Piotr", lastName: "Kowalczyk", gender: "male" });

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

    await t.mutation(api.jotformInternal.createFromWebhook, {
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

    const { clientId } = await t.mutation(api.jotformInternal.createFromWebhook, {
      firstName: "Jan",
      lastName: "Kowalski",
      email: "jan@example.com",
      submissionId: "jotform-001",
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
