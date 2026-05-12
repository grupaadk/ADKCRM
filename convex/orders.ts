import { v } from "convex/values";
import { query, mutation, action, internalMutation, MutationCtx } from "./_generated/server";
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
  v.literal("complaint"),
  v.literal("archived"),
);

export async function nextOrderNumber(ctx: MutationCtx): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const counter = await ctx.db
    .query("orderCounters")
    .withIndex("by_year_month", (q) => q.eq("year", year).eq("month", month))
    .first();

  let number: number;
  if (counter) {
    number = counter.lastNumber + 1;
    await ctx.db.patch(counter._id, { lastNumber: number });
  } else {
    number = 1;
    await ctx.db.insert("orderCounters", { year, month, lastNumber: 1 });
  }

  const mm = String(month).padStart(2, "0");
  return `${number}/${mm}/${year}`;
}

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
            ? { firstName: client.firstName, lastName: client.lastName, city: client.city }
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
    investmentStreet: v.optional(v.string()),
    investmentBuildingNumber: v.optional(v.string()),
    investmentApartmentNumber: v.optional(v.string()),
    investmentPostalCode: v.optional(v.string()),
    investmentCity: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? "anonymous";

    const { clientId, ...orderData } = args;
    const name = args.name ?? await nextOrderNumber(ctx);

    const orderId = await ctx.db.insert("orders", {
      clientId,
      ...orderData,
      name,
      status: "measurement",
      documents: DEFAULT_DOCUMENTS,
      source: "manual",
      createdBy: userId,
    });

    const driveConnection = await ctx.db.query("driveConnection").first();
    if (
      driveConnection &&
      (driveConnection.connectionStatus === "connected" ||
        driveConnection.connectionStatus === "token_expiring")
    ) {
      await ctx.scheduler.runAfter(
        0,
        api.googleDrive.createOrderFolder,
        { orderId },
      );
    }

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
    investmentStreet: v.optional(v.string()),
    investmentBuildingNumber: v.optional(v.string()),
    investmentApartmentNumber: v.optional(v.string()),
    investmentPostalCode: v.optional(v.string()),
    investmentCity: v.optional(v.string()),
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
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? "anonymous";

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Zlecenie nie znalezione");

    if (order.status === args.newStatus) {
      throw new Error("Status jest już ustawiony na tę wartość");
    }

    await ctx.db.patch(args.orderId, { status: args.newStatus });

    if (args.newStatus === "measurement") {
      const driveConnection = await ctx.db.query("driveConnection").first();
      if (
        driveConnection &&
        (driveConnection.connectionStatus === "connected" ||
          driveConnection.connectionStatus === "token_expiring")
      ) {
        await ctx.scheduler.runAfter(
          0,
          api.googleDrive.createOrderFolder,
          { orderId: args.orderId },
        );
      }
    }

    await ctx.db.insert("clientEvents", {
      clientId: order.clientId,
      orderId: args.orderId,
      type: "status_changed",
      details: { from: order.status, to: args.newStatus },
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
    templateId: v.optional(v.id("documentTemplates")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? "anonymous";

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Zlecenie nie znalezione");

    if (args.enabled && args.documentType === "pomiar") {
      if (!order.investmentStreet?.trim() || !order.investmentCity?.trim()) {
        throw new Error("Uzupełnij adres inwestycji w zleceniu (ulica i miejscowość) przed wygenerowaniem dokumentu Pomiar.");
      }
    }

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
          templateId: args.templateId,
        });
        await ctx.scheduler.runAfter(0, api.googleDrive.copyTemplate, {
          orderId: args.orderId,
          templateKey: "rekojmia_adk",
        });
      } else {
        await ctx.scheduler.runAfter(0, api.googleDrive.copyTemplate, {
          orderId: args.orderId,
          templateKey: args.documentType,
          templateId: args.templateId,
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

export const setDocumentError = internalMutation({
  args: {
    orderId: v.id("orders"),
    documentType: v.string(),
    error: v.string(),
    errorAt: v.number(),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) return;
    const documents = { ...order.documents };
    const key = args.documentType as keyof typeof documents;
    if (documents[key]) {
      documents[key] = { ...documents[key], error: args.error, errorAt: args.errorAt };
    }
    await ctx.db.patch(args.orderId, { documents });
  },
});

export const updateWarrantyDocUrl = mutation({
  args: {
    orderId: v.id("orders"),
    key: v.string(),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Zlecenie nie znalezione");
    const warrantyDocs = { ...(order.warrantyDocs ?? {}) };
    warrantyDocs[args.key] = {
      ...(warrantyDocs[args.key] ?? { enabled: true }),
      url: args.url,
      generatedAt: Date.now(),
      error: undefined,
      errorAt: undefined,
    };
    await ctx.db.patch(args.orderId, { warrantyDocs });
  },
});

export const setWarrantyDocError = internalMutation({
  args: {
    orderId: v.id("orders"),
    key: v.string(),
    error: v.string(),
    errorAt: v.number(),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) return;
    const warrantyDocs = { ...(order.warrantyDocs ?? {}) };
    warrantyDocs[args.key] = {
      ...(warrantyDocs[args.key] ?? { enabled: true }),
      error: args.error,
      errorAt: args.errorAt,
    };
    await ctx.db.patch(args.orderId, { warrantyDocs });
  },
});

export const generateWarrantyDoc = mutation({
  args: {
    orderId: v.id("orders"),
    key: v.string(),
    templateId: v.id("documentTemplates"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? "anonymous";

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Zlecenie nie znalezione");

    const warrantyDocs = { ...(order.warrantyDocs ?? {}) };
    warrantyDocs[args.key] = { ...(warrantyDocs[args.key] ?? {}), enabled: true };
    await ctx.db.patch(args.orderId, { warrantyDocs });

    await ctx.scheduler.runAfter(0, api.googleDrive.copyWarrantyTemplate, {
      orderId: args.orderId,
      key: args.key,
      templateId: args.templateId,
    });

    await ctx.db.insert("clientEvents", {
      clientId: order.clientId,
      orderId: args.orderId,
      type: "document_generated",
      details: { documentType: args.key },
      performedBy: userId,
    });
  },
});

export const removeWarrantyDoc = mutation({
  args: {
    orderId: v.id("orders"),
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? "anonymous";

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Zlecenie nie znalezione");

    const warrantyDocs = { ...(order.warrantyDocs ?? {}) };
    const existingUrl = warrantyDocs[args.key]?.url;
    delete warrantyDocs[args.key];
    await ctx.db.patch(args.orderId, { warrantyDocs });

    if (existingUrl) {
      const match = existingUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      const fileId = match?.[1];
      if (fileId) {
        await ctx.scheduler.runAfter(0, api.googleDrive.deleteFile, { fileId });
      }
    }

    await ctx.db.insert("clientEvents", {
      clientId: order.clientId,
      orderId: args.orderId,
      type: "document_removed",
      details: { documentType: args.key },
      performedBy: userId,
    });
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

export const saveInvoicePlan = mutation({
  args: {
    orderId: v.id("orders"),
    type: v.union(v.literal("vat"), v.literal("advance_final"), v.literal("none")),
    advancePct: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Brak autoryzacji");
    if (args.type === "none") {
      await ctx.db.patch(args.orderId, { invoicePlan: undefined });
      return;
    }
    if (args.advancePct < 0 || args.advancePct > 100) {
      throw new Error("Procent musi być między 0 a 100");
    }
    await ctx.db.patch(args.orderId, {
      invoicePlan: { type: args.type, advancePct: args.advancePct },
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
    signatureStatus: v.union(v.literal("signed"), v.literal("not_applicable")),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Zlecenie nie znalezione");

    const documents = { ...order.documents };
    documents[args.documentType] = {
      enabled: true,
      url: args.driveFileUrl,
      generatedAt: Date.now(),
      signatureStatus: args.signatureStatus,
    };

    await ctx.db.patch(args.orderId, { documents });

    await ctx.db.insert("clientEvents", {
      clientId: order.clientId,
      orderId: args.orderId,
      type: "document_uploaded",
      details: { documentType: args.documentType, driveUrl: args.driveFileUrl, signatureStatus: args.signatureStatus },
      performedBy: args.performedBy,
    });
  },
});
