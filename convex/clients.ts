import { v } from "convex/values";
import { query, mutation, action, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { requireUser, userIdentifier } from "./lib/auth";
import { normalizePhoneForDb } from "./lib/phone";

// Lista wszystkich klientów
export const list = query({
  args: {},
  handler: async (ctx) => {
    const clients = await ctx.db.query("clients").order("desc").collect();
    return { page: clients, isDone: true };
  },
});

// Wyszukiwanie klientów po nazwisku, imieniu, nazwie firmy, NIP lub telefonie
export const search = query({
  args: {
    searchTerm: v.string(),
  },
  handler: async (ctx, args) => {
    const rawTerm = args.searchTerm.trim();
    const term = rawTerm.toLowerCase();
    const cleanTerm = rawTerm.replace(/[\s-]/g, "");
    const clients = await ctx.db.query("clients").collect();
    return clients
      .filter(
        (c) =>
          (c.lastName ?? "").toLowerCase().includes(term) ||
          (c.firstName ?? "").toLowerCase().includes(term) ||
          (c.companyName ?? "").toLowerCase().includes(term) ||
          (cleanTerm.length >= 3 && (c.nip ? c.nip.replace(/[\s-]/g, "").includes(cleanTerm) : false)) ||
          (cleanTerm.length >= 3 && (c.phone ? c.phone.replace(/[\s-]/g, "").includes(cleanTerm) : false)),
      )
      .slice(0, 20);
  },
});

// Najczęściej wybierani / aktywni klienci w systemie (do szybkiego wyboru)
export const getPopularClients = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 5;

    // Pobierz ostatnie zlecenia i szanse aby zliczyć popularność
    const orders = await ctx.db.query("orders").order("desc").take(300);
    const opps = await ctx.db.query("pendingJotformSubmissions").order("desc").take(300);

    const clientCounts = new Map<string, number>();

    for (const o of orders) {
      if (o.clientId) {
        clientCounts.set(o.clientId, (clientCounts.get(o.clientId) ?? 0) + 1);
      }
    }

    for (const op of opps) {
      if (op.clientId) {
        clientCounts.set(op.clientId, (clientCounts.get(op.clientId) ?? 0) + 1);
      }
    }

    // Posortuj ID klientów malejąco wg liczby powiązań
    const sortedClientIds = Array.from(clientCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id as Id<"clients">);

    const results = [];
    for (const cId of sortedClientIds) {
      if (results.length >= limit) break;
      const client = await ctx.db.get(cId);
      if (client) {
        results.push({
          ...client,
          usageCount: clientCounts.get(cId) ?? 0,
        });
      }
    }

    // Jeśli w historii powiązań jest mniej niż limit, dopełnij najnowszymi klientami z bazy
    if (results.length < limit) {
      const recentClients = await ctx.db.query("clients").order("desc").take(limit * 2);
      for (const rc of recentClients) {
        if (results.length >= limit) break;
        if (!results.some((r) => r._id === rc._id)) {
          results.push({
            ...rc,
            usageCount: clientCounts.get(rc._id) ?? 0,
          });
        }
      }
    }

    return results;
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
    clientType: v.optional(v.union(v.literal("individual"), v.literal("business"))),
    firstName: v.string(),
    lastName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    nip: v.optional(v.string()),
    companyName: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    city: v.optional(v.string()),
    street: v.optional(v.string()),
    buildingNumber: v.optional(v.string()),
    apartmentNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const userId = userIdentifier(user);

    const phone = normalizePhoneForDb(args.phone);

    const clientId = await ctx.db.insert("clients", {
      ...args,
      phone,
      source: "manual",
      createdBy: userId,
    });

    await ctx.db.insert("clientEvents", {
      clientId,
      type: "created",
      details: { source: "manual" },
      performedBy: userId,
    });

    console.info("[clients.create] scheduling createClientFolder", { clientId, userId });
    await ctx.scheduler.runAfter(0, api.googleDrive.createClientFolder, { clientId });
    console.info("[clients.create] createClientFolder scheduled OK", { clientId });

    return clientId;
  },
});

// Aktualizacja danych kontaktowych klienta
export const update = mutation({
  args: {
    clientId: v.id("clients"),
    clientType: v.optional(v.union(v.literal("individual"), v.literal("business"))),
    firstName: v.optional(v.union(v.string(), v.null())),
    lastName: v.optional(v.union(v.string(), v.null())),
    email: v.optional(v.union(v.string(), v.null())),
    phone: v.optional(v.union(v.string(), v.null())),
    nip: v.optional(v.union(v.string(), v.null())),
    companyName: v.optional(v.union(v.string(), v.null())),
    postalCode: v.optional(v.union(v.string(), v.null())),
    city: v.optional(v.union(v.string(), v.null())),
    street: v.optional(v.union(v.string(), v.null())),
    buildingNumber: v.optional(v.union(v.string(), v.null())),
    apartmentNumber: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const userId = userIdentifier(user);

    const { clientId, ...updates } = args;
    
    if (updates.phone !== undefined && updates.phone !== null) {
      updates.phone = normalizePhoneForDb(updates.phone);
    }

    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) {
        filtered[key] = undefined;
      } else if (value !== undefined) {
        filtered[key] = value;
      }
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

    // Jeśli zmieniono dane identyfikujące i klient ma folder w Drive — zaplanuj rename
    if (oldClient?.clientFolderId) {
      const isBusinessClient = (args.clientType ?? oldClient.clientType) === "business";
      const newFirstName = args.firstName ?? oldClient.firstName;
      const newLastName = args.lastName ?? oldClient.lastName;

      if (isBusinessClient) {
        // Dla firmy: rename gdy zmienia się companyName
        const newCompanyName = args.companyName ?? oldClient.companyName;
        const companyNameChanged = newCompanyName && newCompanyName !== oldClient.companyName;
        if (companyNameChanged) {
          await ctx.scheduler.runAfter(0, internal.googleDrive.renameClientAssets, {
            clientId,
            oldFirstName: oldClient.firstName,
            oldLastName: oldClient.lastName,
            newFirstName,
            newLastName,
            clientFolderId: oldClient.clientFolderId,
            newFolderName: newCompanyName,
          });
        }
      } else {
        // Dla klienta indywidualnego: rename gdy zmienia się imię lub nazwisko
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

// Migracja do ujednolicenia formatu numerów telefonów w bazie
export const normalizeAllPhonesMigration = mutation({
  args: {},
  handler: async (ctx) => {
    // 1. Klienci
    const clients = await ctx.db.query("clients").collect();
    let updatedClients = 0;
    for (const client of clients) {
      if (client.phone) {
        const normalized = normalizePhoneForDb(client.phone);
        if (normalized !== client.phone) {
          await ctx.db.patch(client._id, { phone: normalized });
          updatedClients++;
        }
      }
    }

    // 2. Szanse sprzedaży
    const submissions = await ctx.db.query("pendingJotformSubmissions").collect();
    let updatedSubmissions = 0;
    for (const sub of submissions) {
      if (sub.phone) {
        const normalized = normalizePhoneForDb(sub.phone);
        if (normalized !== sub.phone) {
          await ctx.db.patch(sub._id, { phone: normalized });
          updatedSubmissions++;
        }
      }
    }

    return { updatedClients, updatedSubmissions };
  },
});
