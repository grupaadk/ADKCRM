import { v } from "convex/values";
import { query, mutation, action, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { STATUS_TRANSITIONS, CLIENT_STATUSES } from "./schema";

type OrderStatus = (typeof CLIENT_STATUSES)[number];

const orderStatusValidator = v.union(
  v.literal("lead"),
  v.literal("inquiry"),
  v.literal("measurement"),
  v.literal("offer"),
  v.literal("contract"),
  v.literal("production"),
  v.literal("installation"),
  v.literal("completed"),
  v.literal("warranty"),
);

export const DEFAULT_DOCUMENTS = {
  pomiar: { enabled: false },
  umowa: { enabled: false },
  gwarancja_alco: { enabled: false },
  rekojmia_adk: { enabled: false },
  odbior_inwestor: { enabled: false },
  protokol_montaz: { enabled: false },
  faktura: { enabled: false },
  reklamacja: { enabled: false },
};

function extractDriveFileId(url: string): string | null {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const orders = await ctx.db.query("orders").order("desc").take(500);

    const ordersWithClients = await Promise.all(
      orders.map(async (order) => {
        const client = await ctx.db.get(order.clientId);
        const lineItems = await ctx.db
          .query("orderLineItems")
          .withIndex("by_order_sort", (q) => q.eq("orderId", order._id))
          .collect();
        let totalGross = 0;
        for (const item of lineItems) {
          const discount = item.discountPercent ?? 0;
          const net = item.quantity * item.unitPrice * (1 - discount / 100);
          totalGross += net * (1 + item.vatRate / 100);
        }
        return {
          ...order,
          client: client
            ? { firstName: client.firstName, lastName: client.lastName }
            : null,
          totalGross: lineItems.length > 0 ? Math.round(totalGross * 100) / 100 : null,
        };
      }),
    );

    return ordersWithClients;
  },
});

export const listByClient = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .order("desc")
      .collect();

    return Promise.all(
      orders.map(async (order) => {
        const lineItems = await ctx.db
          .query("orderLineItems")
          .withIndex("by_order_sort", (q) => q.eq("orderId", order._id))
          .collect();

        if (lineItems.length === 0) {
          return { ...order, totals: null };
        }

        let totalNet = 0;
        let totalGross = 0;
        for (const item of lineItems) {
          const discount = item.discountPercent ?? 0;
          const net = item.quantity * item.unitPrice * (1 - discount / 100);
          totalNet += net;
          totalGross += net * (1 + item.vatRate / 100);
        }

        return {
          ...order,
          totals: {
            totalNet: Math.round(totalNet * 100) / 100,
            totalGross: Math.round(totalGross * 100) / 100,
            totalVat: Math.round((totalGross - totalNet) * 100) / 100,
          },
        };
      }),
    );
  },
});

export const getById = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.orderId);
  },
});

export const findByTrelloCardId = query({
  args: { trelloCardId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("orders")
      .withIndex("by_trello_card", (q) => q.eq("trelloCardId", args.trelloCardId))
      .unique();
  },
});

export const findByJotformSubmissionId = query({
  args: { submissionId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("orders")
      .withIndex("by_jotform_submission", (q) =>
        q.eq("jotformSubmissionId", args.submissionId),
      )
      .first();
  },
});

export const create = mutation({
  args: {
    clientId: v.id("clients"),
    services: v.optional(v.array(v.string())),
    windowColor: v.optional(v.array(v.string())),
    doorColor: v.optional(v.array(v.string())),
    gateColor: v.optional(v.array(v.string())),
    terraceColor: v.optional(v.array(v.string())),
    constructionColor: v.optional(v.array(v.string())),
    sunProtectionType: v.optional(v.array(v.string())),
    projectFiles: v.optional(v.string()),
    comment: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? "anonymous";

    const { clientId, ...orderData } = args;

    const orderId = await ctx.db.insert("orders", {
      clientId,
      ...orderData,
      status: "lead",
      documents: DEFAULT_DOCUMENTS,
      source: "manual",
      createdBy: userId,
    });

    await ctx.db.insert("clientEvents", {
      clientId,
      orderId,
      type: "order_created",
      details: { source: "manual", services: args.services },
      performedBy: userId,
    });

    return orderId;
  },
});

export const createFromWebhook = internalMutation({
  args: {
    clientId: v.id("clients"),
    services: v.optional(v.array(v.string())),
    windowColor: v.optional(v.array(v.string())),
    doorColor: v.optional(v.array(v.string())),
    gateColor: v.optional(v.array(v.string())),
    terraceColor: v.optional(v.array(v.string())),
    constructionColor: v.optional(v.array(v.string())),
    sunProtectionType: v.optional(v.array(v.string())),
    projectFiles: v.optional(v.string()),
    comment: v.optional(v.string()),
    submissionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { clientId, submissionId, ...orderData } = args;

    const orderId = await ctx.db.insert("orders", {
      clientId,
      ...orderData,
      status: "lead",
      documents: DEFAULT_DOCUMENTS,
      source: "jotform",
      jotformSubmissionId: submissionId,
      createdBy: "system",
    });

    await ctx.db.insert("clientEvents", {
      clientId,
      orderId,
      type: "order_created",
      details: { source: "jotform", submissionId, services: args.services },
      performedBy: "system",
    });

    return orderId;
  },
});

export const update = mutation({
  args: {
    orderId: v.id("orders"),
    services: v.optional(v.array(v.string())),
    windowColor: v.optional(v.array(v.string())),
    doorColor: v.optional(v.array(v.string())),
    gateColor: v.optional(v.array(v.string())),
    terraceColor: v.optional(v.array(v.string())),
    constructionColor: v.optional(v.array(v.string())),
    sunProtectionType: v.optional(v.array(v.string())),
    projectFiles: v.optional(v.string()),
    comment: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? "anonymous";

    const { orderId, ...updates } = args;
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Zlecenie nie znalezione");

    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) filtered[key] = value;
    }
    if (Object.keys(filtered).length === 0) return;

    await ctx.db.patch(orderId, filtered);

    await ctx.db.insert("clientEvents", {
      clientId: order.clientId,
      orderId,
      type: "data_updated",
      details: { fields: Object.keys(filtered) },
      performedBy: userId,
    });
  },
});

export const changeStatus = mutation({
  args: {
    orderId: v.id("orders"),
    newStatus: orderStatusValidator,
    triggeredBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? "anonymous";

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Zlecenie nie znalezione");

    const allowed = STATUS_TRANSITIONS[order.status];
    if (!allowed?.includes(args.newStatus)) {
      throw new Error(
        `Niedozwolone przejście: ${order.status} → ${args.newStatus}`,
      );
    }

    await ctx.db.patch(args.orderId, { status: args.newStatus });

    if (args.newStatus === "measurement") {
      const driveConnection = await ctx.db.query("driveConnection").first();
      if (
        driveConnection?.connectionStatus === "connected" &&
        driveConnection.sharedDriveId
      ) {
        // Oznacz dokument pomiar jako aktywny (przed asynchronicznym generowaniem)
        if (!order.documents.pomiar.enabled) {
          const documents = { ...order.documents };
          documents.pomiar = { ...documents.pomiar, enabled: true };
          await ctx.db.patch(args.orderId, { documents });
        }
        // Utwórz folder zlecenia i wygeneruj plik pomiaru sekwencyjnie
        await ctx.scheduler.runAfter(
          0,
          internal.googleDrive.initializeMeasurement,
          { orderId: args.orderId },
        );
      }
    }

    if (order.trelloCardId) {
      const trelloConfig = await ctx.db.query("trelloConfig").first();
      if (trelloConfig?.syncEnabled) {
        await ctx.scheduler.runAfter(0, api.trello.syncCardForStatus, {
          orderId: args.orderId,
        });
      }
    }

    await ctx.db.insert("clientEvents", {
      clientId: order.clientId,
      orderId: args.orderId,
      type: "status_changed",
      details: { from: order.status, to: args.newStatus, ...(args.triggeredBy ? { triggeredBy: args.triggeredBy } : {}) },
      performedBy: userId,
    });

    return { previousStatus: order.status, newStatus: args.newStatus };
  },
});

export const toggleDocument = mutation({
  args: {
    orderId: v.id("orders"),
    documentType: v.union(
      v.literal("pomiar"),
      v.literal("umowa"),
      v.literal("gwarancja_alco"),
      v.literal("rekojmia_adk"),
      v.literal("odbior_inwestor"),
      v.literal("protokol_montaz"),
      v.literal("faktura"),
      v.literal("reklamacja"),
    ),
    enabled: v.boolean(),
    url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? "anonymous";

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Zlecenie nie znalezione");

    const documents = { ...order.documents };
    const existingUrl = documents[args.documentType].url;

    documents[args.documentType] = {
      enabled: args.enabled,
      url: args.enabled ? (args.url ?? existingUrl) : undefined,
      generatedAt: args.enabled
        ? Date.now()
        : documents[args.documentType].generatedAt,
    };

    const rekUrlToDelete = !args.enabled ? documents.rekojmia_adk.url : undefined;
    if (args.documentType === "gwarancja_alco") {
      documents.rekojmia_adk = {
        enabled: args.enabled,
        url: args.enabled ? documents.rekojmia_adk.url : undefined,
        generatedAt: args.enabled
          ? Date.now()
          : documents.rekojmia_adk.generatedAt,
      };
    }

    await ctx.db.patch(args.orderId, { documents });

    if (args.enabled) {
      if (args.documentType === "gwarancja_alco") {
        await ctx.scheduler.runAfter(0, api.googleDrive.copyTemplate, {
          orderId: args.orderId,
          templateKey: "gwarancja_alco",
        });
        await ctx.scheduler.runAfter(0, api.googleDrive.copyTemplate, {
          orderId: args.orderId,
          templateKey: "rekojmia_adk",
        });
      } else {
        await ctx.scheduler.runAfter(0, api.googleDrive.copyTemplate, {
          orderId: args.orderId,
          templateKey: args.documentType,
        });
      }
    } else {
      const fileId = existingUrl ? extractDriveFileId(existingUrl) : null;
      if (fileId) {
        await ctx.scheduler.runAfter(0, api.googleDrive.deleteFile, { fileId });
      }
      if (args.documentType === "gwarancja_alco" && rekUrlToDelete) {
        const rekFileId = extractDriveFileId(rekUrlToDelete);
        if (rekFileId) {
          await ctx.scheduler.runAfter(0, api.googleDrive.deleteFile, {
            fileId: rekFileId,
          });
        }
      }
    }

    await ctx.db.insert("clientEvents", {
      clientId: order.clientId,
      orderId: args.orderId,
      type: args.enabled ? "document_generated" : "document_removed",
      details: { documentType: args.documentType },
      performedBy: userId,
    });
  },
});

export const updateDocumentUrl = mutation({
  args: {
    orderId: v.id("orders"),
    documentType: v.string(),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Zlecenie nie znalezione");

    const documents = { ...order.documents };
    const key = args.documentType as keyof typeof documents;
    if (documents[key]) {
      documents[key] = { ...documents[key], url: args.url, generatedAt: Date.now() };
    }
    await ctx.db.patch(args.orderId, { documents });
  },
});

export const updateDriveProjectFiles = mutation({
  args: {
    orderId: v.id("orders"),
    driveProjectFiles: v.array(v.object({
      fileId: v.string(),
      name: v.string(),
      url: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orderId, {
      driveProjectFiles: args.driveProjectFiles,
    });
  },
});

export const updateDriveFolder = mutation({
  args: {
    orderId: v.id("orders"),
    folderId: v.string(),
    folderUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orderId, {
      folderId: args.folderId,
      folderUrl: args.folderUrl,
    });
  },
});

export const updateTrelloCard = mutation({
  args: {
    orderId: v.id("orders"),
    trelloCardId: v.string(),
    trelloCardUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orderId, {
      trelloCardId: args.trelloCardId,
      trelloCardUrl: args.trelloCardUrl,
    });
  },
});

export const addWarrantyCard = mutation({
  args: {
    orderId: v.id("orders"),
    manufacturer: v.string(),
    type: v.string(),
    fileUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? "anonymous";

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Zlecenie nie znalezione");

    const warrantyCards = [
      ...(order.warrantyCards ?? []),
      {
        manufacturer: args.manufacturer,
        type: args.type,
        fileUrl: args.fileUrl,
        uploadedAt: Date.now(),
      },
    ];

    await ctx.db.patch(args.orderId, { warrantyCards });

    await ctx.db.insert("clientEvents", {
      clientId: order.clientId,
      orderId: args.orderId,
      type: "warranty_card_added",
      details: { manufacturer: args.manufacturer, type: args.type },
      performedBy: userId,
    });
  },
});

export const addEvent = internalMutation({
  args: {
    orderId: v.id("orders"),
    type: v.string(),
    details: v.any(),
    performedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");

    await ctx.db.insert("clientEvents", {
      clientId: order.clientId,
      orderId: args.orderId,
      type: args.type,
      details: args.details,
      performedBy: args.performedBy,
    });
  },
});

export const deleteOrderData = internalMutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("clientEvents")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();
    await Promise.all(events.map((e) => ctx.db.delete(e._id)));
    await ctx.db.delete(args.orderId);
  },
});

export const deleteOrder = action({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const order = await ctx.runQuery(api.orders.getById, { orderId: args.orderId });
    if (!order) throw new Error("Zlecenie nie znalezione");

    if (order.folderId) {
      try {
        await ctx.runAction(api.googleDrive.deleteFile, { fileId: order.folderId });
      } catch (error) {
        console.error("Nie udało się usunąć folderu Drive:", error);
      }
    }

    await ctx.runMutation(internal.orders.deleteOrderData, { orderId: args.orderId });
  },
});

// Migracja: tworzy zlecenia z istniejących danych klientów (jednorazowe)
export const migrateClientsToOrders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const clients = await ctx.db.query("clients").collect();
    let created = 0;

    for (const client of clients) {
      if (!client.status) continue;

      const existing = await ctx.db
        .query("orders")
        .withIndex("by_client", (q) => q.eq("clientId", client._id))
        .first();

      if (existing) continue;

      await ctx.db.insert("orders", {
        clientId: client._id,
        status: client.status,
        documents: client.documents ?? DEFAULT_DOCUMENTS,
        services: client.services,
        windowColor: client.windowColor,
        doorColor: client.doorColor,
        gateColor: client.gateColor,
        terraceColor: client.terraceColor,
        constructionColor: client.constructionColor,
        sunProtectionType: client.sunProtectionType,
        projectFiles: client.projectFiles,
        comment: client.comment,
        warrantyCards: client.warrantyCards,
        folderId: client.folderId,
        folderUrl: client.folderUrl,
        trelloCardId: client.trelloCardId,
        trelloCardUrl: client.trelloCardUrl,
        source: client.source,
        jotformSubmissionId: client.jotformSubmissionId,
        createdBy: client.createdBy,
      });
      created++;
    }

    return { created };
  },
});

const documentTypeValidator = v.union(
  v.literal("pomiar"),
  v.literal("umowa"),
  v.literal("gwarancja_alco"),
  v.literal("rekojmia_adk"),
  v.literal("odbior_inwestor"),
  v.literal("protokol_montaz"),
  v.literal("faktura"),
  v.literal("reklamacja"),
);

export const attachUploadedDocument = internalMutation({
  args: {
    orderId: v.id("orders"),
    documentType: documentTypeValidator,
    driveFileUrl: v.string(),
    performedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Zlecenie nie znalezione");

    const documents = { ...order.documents };
    documents[args.documentType] = {
      enabled: true,
      url: args.driveFileUrl,
      generatedAt: Date.now(),
    };

    await ctx.db.patch(args.orderId, { documents });

    await ctx.db.insert("clientEvents", {
      clientId: order.clientId,
      orderId: args.orderId,
      type: "document_uploaded",
      details: { documentType: args.documentType, driveUrl: args.driveFileUrl },
      performedBy: args.performedBy,
    });
  },
});
