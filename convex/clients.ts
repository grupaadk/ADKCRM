import { v } from "convex/values";
import { query, mutation, action, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";

// Lista klientów z paginacją
export const list = query({
  args: {
    paginationOpts: v.optional(
      v.object({
        cursor: v.union(v.string(), v.null()),
        numItems: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const numItems = args.paginationOpts?.numItems ?? 50;
    const clients = await ctx.db.query("clients").order("desc").take(numItems);
    return { page: clients, isDone: clients.length < numItems };
  },
});

// Wyszukiwanie klientów po nazwisku
export const search = query({
  args: {
    searchTerm: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("clients")
      .withSearchIndex("search_clients", (s) =>
        s.search("lastName", args.searchTerm),
      )
      .take(20);
  },
});

// Pobranie pojedynczego klienta
export const getById = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.clientId);
  },
});

// Ręczne dodanie klienta
export const create = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    nip: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    city: v.optional(v.string()),
    street: v.optional(v.string()),
    buildingNumber: v.optional(v.string()),
    apartmentNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? "anonymous";

    const clientId = await ctx.db.insert("clients", {
      ...args,
      source: "manual",
      createdBy: userId,
    });

    await ctx.db.insert("clientEvents", {
      clientId,
      type: "created",
      details: { source: "manual" },
      performedBy: userId,
    });

    await ctx.scheduler.runAfter(0, api.googleDrive.createClientFolder, { clientId });

    return clientId;
  },
});

// Aktualizacja danych kontaktowych klienta
export const update = mutation({
  args: {
    clientId: v.id("clients"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    nip: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    city: v.optional(v.string()),
    street: v.optional(v.string()),
    buildingNumber: v.optional(v.string()),
    apartmentNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? "anonymous";

    const { clientId, ...updates } = args;
    const filtered: Record<string, string> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) filtered[key] = value;
    }
    if (Object.keys(filtered).length === 0) return;

    // Pobierz stare dane przed zapisem (potrzebne do rename w Drive)
    const oldClient = await ctx.db.get(clientId);

    await ctx.db.patch(clientId, filtered);

    await ctx.db.insert("clientEvents", {
      clientId,
      type: "data_updated",
      details: { fields: Object.keys(filtered) },
      performedBy: userId,
    });

    // Jeśli zmieniono imię lub nazwisko i klient ma folder w Drive — zaplanuj rename
    if (oldClient?.clientFolderId) {
      const newFirstName = args.firstName ?? oldClient.firstName;
      const newLastName = args.lastName ?? oldClient.lastName;
      const nameChanged =
        newFirstName !== oldClient.firstName || newLastName !== oldClient.lastName;

      if (nameChanged) {
        await ctx.scheduler.runAfter(0, internal.googleDrive.renameClientAssets, {
          clientId,
          oldFirstName: oldClient.firstName,
          oldLastName: oldClient.lastName,
          newFirstName,
          newLastName,
          clientFolderId: oldClient.clientFolderId,
        });
      }
    }
  },
});

// Szukanie wielu klientów po liście emaili (dla oznaczania w skrzynce)
export const findByEmails = query({
  args: { emails: v.array(v.string()) },
  handler: async (ctx, args) => {
    const result: Record<string, { _id: string; firstName: string; lastName: string }> = {};
    for (const email of args.emails) {
      const client = await ctx.db
        .query("clients")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();
      if (client) {
        result[email] = { _id: client._id, firstName: client.firstName, lastName: client.lastName };
      }
    }
    return result;
  },
});

// Szukanie klienta po email (dla deduplikacji webhooka)
export const findByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("clients")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
  },
});

// Szukanie klienta po pełnych danych kontaktowych (imię + nazwisko + email + telefon)
export const findByContactInfo = query({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let candidates;
    if (args.email) {
      candidates = await ctx.db
        .query("clients")
        .withIndex("by_email", (q) => q.eq("email", args.email!))
        .collect();
    } else {
      candidates = await ctx.db.query("clients").collect();
    }
    return (
      candidates.find(
        (c) =>
          c.firstName === args.firstName &&
          c.lastName === args.lastName &&
          (!args.phone || !c.phone || c.phone === args.phone),
      ) ?? null
    );
  },
});

// Aktualizacja folderu klienta w Google Drive
export const updateClientFolder = mutation({
  args: {
    clientId: v.id("clients"),
    clientFolderId: v.string(),
    clientFolderUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.clientId, {
      clientFolderId: args.clientFolderId,
      clientFolderUrl: args.clientFolderUrl,
    });
  },
});

export const addEvent = internalMutation({
  args: {
    clientId: v.id("clients"),
    type: v.string(),
    details: v.any(),
    performedBy: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("clientEvents", {
      clientId: args.clientId,
      type: args.type,
      details: args.details,
      performedBy: args.performedBy,
    });
  },
});

export const deleteClientData = internalMutation({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    // Delete orders
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();
    for (const order of orders) {
      const orderEvents = await ctx.db
        .query("clientEvents")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();
      await Promise.all(orderEvents.map((e) => ctx.db.delete(e._id)));
      await ctx.db.delete(order._id);
    }

    // Delete client-level events
    const events = await ctx.db
      .query("clientEvents")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();
    await Promise.all(events.map((e) => ctx.db.delete(e._id)));

    // Delete notes
    const notes = await ctx.db
      .query("clientNotes")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();
    await Promise.all(notes.map((n) => ctx.db.delete(n._id)));

    await ctx.db.delete(args.clientId);
  },
});

export const deleteClient = action({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const client = await ctx.runQuery(api.clients.getById, {
      clientId: args.clientId,
    });
    if (!client) throw new Error("Klient nie znaleziony");

    // Delete Drive folders for all orders
    const orders = await ctx.runQuery(api.orders.listByClient, {
      clientId: args.clientId,
    });
    for (const order of orders) {
      if (order.folderId) {
        try {
          await ctx.runAction(api.googleDrive.deleteFile, {
            fileId: order.folderId,
          });
        } catch (error) {
          console.error("Nie udało się usunąć folderu Drive zlecenia:", error);
        }
      }
    }

    // Delete client-level folder on shared drive
    const clientFolderId = client.clientFolderId ?? client.folderId;
    if (clientFolderId) {
      try {
        await ctx.runAction(api.googleDrive.deleteFile, {
          fileId: clientFolderId,
        });
      } catch (error) {
        console.error("Nie udało się usunąć folderu Drive klienta:", error);
      }
    }

    await ctx.runMutation(internal.clients.deleteClientData, {
      clientId: args.clientId,
    });
  },
});
