import { v, ConvexError } from "convex/values";
import { query, mutation, action, internalMutation, MutationCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { requireUser, requireRole, userIdentifier } from "./lib/auth";
import { resolveStatuses, type StatusDef } from "../lib/statuses";

export async function nextOrderNumber(ctx: MutationCtx): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const mm = String(month).padStart(2, "0");
  const suffix = `/${mm}/${year}`;

  const monthStart = new Date(year, month - 1, 1).getTime();
  const monthEnd = new Date(year, month, 1).getTime();

  const ordersThisMonth = await ctx.db
    .query("orders")
    .withIndex("by_creation_time", (q) =>
      q.gte("_creationTime", monthStart).lt("_creationTime", monthEnd),
    )
    .collect();

  let maxN = 0;
  for (const o of ordersThisMonth) {
    if (!o.name?.endsWith(suffix)) continue;
    const n = parseInt(o.name.split("/")[0], 10);
    if (Number.isFinite(n) && n > maxN) maxN = n;
  }

  const number = maxN + 1;
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
        let totalNet = 0;
        let totalGross = 0;
        for (const item of lineItems) {
          const discount = item.discountPercent ?? 0;
          const net = item.quantity * item.unitPrice * (1 - discount / 100);
          totalNet += net;
          totalGross += net * (1 + item.vatRate / 100);
        }
        let assignedUserColor: string | undefined;
        if (order.assignedUserId) {
          const assignedUser = await ctx.db.get(order.assignedUserId);
          assignedUserColor = assignedUser?.color ?? undefined;
        }

        const assigneesArray = Array.from(new Set([
          ...(order.assignedUserId ? [order.assignedUserId] : []),
          ...(order.assignedUserIds || [])
        ]));
        
        const resolvedAssignees = await Promise.all(assigneesArray.map(async (uid) => {
          const u = await ctx.db.get(uid);
          if (!u) return null;
          return {
            id: u._id,
            name: u.displayName ?? u.email ?? null,
            color: u.color ?? undefined,
          };
        }));
        
        const assignees = resolvedAssignees.filter((u): u is NonNullable<typeof u> => u !== null);
        return {
          ...order,
          client: client
            ? {
                firstName: client.firstName,
                lastName: client.lastName,
                city: client.city,
                clientType: client.clientType,
                companyName: client.companyName,
              }
            : null,
          totalNet: lineItems.length > 0 ? Math.round(totalNet * 100) / 100 : null,
          totalGross: lineItems.length > 0 ? Math.round(totalGross * 100) / 100 : null,
          assignedUserColor,
          assignees,
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

/**
 * Lekka lista zleceń do wyszukiwarki/pickera (np. dodawanie zadania, kalendarz).
 * Pomija zarchiwizowane i zakończone. Zwraca tylko pola potrzebne do wyświetlenia.
 */
export const listForPicker = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const orders = await ctx.db.query("orders").order("desc").take(500);
    const active = orders.filter((o) => o.status !== "archived" && o.status !== "completed");
    return Promise.all(
      active.map(async (order) => {
        const client = await ctx.db.get(order.clientId);
        const clientName = client
          ? client.clientType === "business" && client.companyName
            ? client.companyName
            : `${client.lastName} ${client.firstName}`.trim()
          : "—";
        return {
          _id: order._id,
          clientId: order.clientId,
          name: order.name ?? null,
          customText: order.customText ?? null,
          status: order.status,
          clientName,
          projectEndDate: order.projectEndDate,
          installationStartDate: order.installationStartDate,
          installationTeamId: order.installationTeamId,
          installationDates: order.installationDates,
        };
      }),
    );
  },
});

export const listAllForFinanse = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const orders = await ctx.db.query("orders").order("desc").take(1000);
    const nonArchived = orders.filter((o) => o.status !== "archived");
    return Promise.all(
      nonArchived.map(async (order) => {
        const client = await ctx.db.get(order.clientId);
        const clientName = client
          ? client.clientType === "business" && client.companyName
            ? client.companyName
            : `${client.lastName} ${client.firstName}`.trim()
          : "—";
        return {
          _id: order._id,
          _creationTime: order._creationTime,
          clientId: order.clientId,
          name: order.name ?? null,
          customText: order.customText ?? null,
          status: order.status,
          clientName,
          projectEndDate: order.projectEndDate,
          installationStartDate: order.installationStartDate,
          installationTeamId: order.installationTeamId,
          installationDates: order.installationDates,
        };
      }),
    );
  },
});

export const assignOrder = mutation({
  args: {
    orderId: v.id("orders"),
    assignedUserId: v.optional(v.id("users")), // legacy single assign
    assignedUserIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new ConvexError("Zlecenie nie istnieje.");
    await ctx.db.patch(args.orderId, {
      assignedUserId: args.assignedUserId,
      assignedUserIds: args.assignedUserIds,
    });
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
    projectFiles: v.optional(v.string()),
    comment: v.optional(v.string()),
    customText: v.optional(v.string()),
    name: v.optional(v.string()),
    investmentStreet: v.optional(v.string()),
    investmentBuildingNumber: v.optional(v.string()),
    investmentApartmentNumber: v.optional(v.string()),
    investmentPostalCode: v.optional(v.string()),
    investmentCity: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const userId = userIdentifier(user);

    const { clientId, ...orderData } = args;
    const name = args.name ?? await nextOrderNumber(ctx);

    const orderId = await ctx.db.insert("orders", {
      clientId,
      ...orderData,
      name,
      status: "measurement",
      statusChangedAt: Date.now(),
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
      // Triggeruj tworzenie folderu klienta (idempotentne — pomija jeśli istnieje)
      await ctx.scheduler.runAfter(
        0,
        api.googleDrive.createClientFolder,
        { clientId },
      );
      // Triggeruj tworzenie folderu zlecenia (wewnętrznie sprawdza/tworzy folder klienta)
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

    if (args.services && args.services.length > 0) {
      const allServices = await ctx.db.query("services").collect();
      let pos = 0;
      for (const sName of args.services) {
        const svc = allServices.find((s) => s.name === sName);
        if (svc?.defaultTasks) {
          for (const t of svc.defaultTasks) {
            let dueDate = undefined;
            if (t.daysToComplete !== undefined) {
              const d = new Date();
              d.setDate(d.getDate() + t.daysToComplete);
              d.setHours(23, 59, 59, 999);
              dueDate = d.getTime();
            }
            await ctx.db.insert("orderTasks", {
              orderId,
              title: t.title,
              dueDate,
              status: "todo",
              priority: "normal",
              createdBy: userId,
              position: pos++,
            });
          }
        }
      }
    }

    return orderId;
  },
});

export const update = mutation({
  args: {
    orderId: v.id("orders"),
    services: v.optional(v.array(v.string())),
    projectFiles: v.optional(v.string()),
    comment: v.optional(v.string()),
    customText: v.optional(v.string()),
    name: v.optional(v.string()),
    investmentStreet: v.optional(v.string()),
    investmentBuildingNumber: v.optional(v.string()),
    investmentApartmentNumber: v.optional(v.string()),
    investmentPostalCode: v.optional(v.string()),
    investmentCity: v.optional(v.string()),
    projectStartDate: v.optional(v.number()),
    projectEndDate: v.optional(v.number()),
    installationStartDate: v.optional(v.number()),
    installationTeamId: v.optional(v.id("installationTeams")),
    installationDates: v.optional(v.array(v.object({
      date: v.number(),
      startMins: v.optional(v.number()),
      endMins: v.optional(v.number()),
      installationTeamId: v.optional(v.id("installationTeams")),
      note: v.optional(v.string()),
    }))),
    serviceDeliveries: v.optional(v.array(v.object({
      serviceName: v.string(),
      supplierId: v.id("suppliers"),
      orderDate: v.optional(v.number()),
      confirmedDate: v.optional(v.number()),
      deliveryDate: v.optional(v.number()),
      receivedDate: v.optional(v.number()),
      netAmount: v.optional(v.number()),
      notes: v.optional(v.string()),
      externalOrderId: v.optional(v.string()),
      externalOrderNumber: v.optional(v.string()),
    }))),
    serviceFinances: v.optional(v.array(v.object({
      serviceName: v.string(),
      earningsAmount: v.optional(v.number()),
      workDays: v.optional(v.number()),
    }))),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const userId = userIdentifier(user);

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
    if (args.services !== undefined) {
      const oldServices = order.services ?? [];
      const newServices = args.services;
      const addedServices = newServices.filter((s) => !oldServices.includes(s));
      
      if (addedServices.length > 0) {
        const allServices = await ctx.db.query("services").collect();
        
        const existingTasks = await ctx.db
          .query("orderTasks")
          .withIndex("by_order", (q) => q.eq("orderId", orderId))
          .collect();
        let pos = existingTasks.length > 0 ? Math.max(...existingTasks.map(t => t.position ?? 0)) + 1 : 0;

        for (const sName of addedServices) {
          const svc = allServices.find((s) => s.name === sName);
          if (svc?.defaultTasks) {
            for (const t of svc.defaultTasks) {
              let dueDate = undefined;
              if (t.daysToComplete !== undefined) {
                const d = new Date();
                d.setDate(d.getDate() + t.daysToComplete);
                d.setHours(23, 59, 59, 999);
                dueDate = d.getTime();
              }
              await ctx.db.insert("orderTasks", {
                orderId,
                title: t.title,
                dueDate,
                status: "todo",
                priority: "normal",
                createdBy: userId,
                position: pos++,
              });
            }
          }
        }
      }
    }
  },
});

export const setCustomText = mutation({
  args: {
    orderId: v.id("orders"),
    customText: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const userId = userIdentifier(user);

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Zlecenie nie znalezione");

    await ctx.db.patch(args.orderId, {
      customText: args.customText ?? undefined,
    });

    await ctx.db.insert("clientEvents", {
      clientId: order.clientId,
      orderId: args.orderId,
      type: "data_updated",
      details: { fields: ["customText"] },
      performedBy: userId,
    });
  },
});

export const clearInstallationDate = mutation({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const userId = userIdentifier(user);

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Zlecenie nie znalezione");

    if (!order.projectEndDate && !order.installationStartDate) {
      return;
    }

    await ctx.db.patch(args.orderId, {
      projectEndDate: undefined,
      installationStartDate: undefined,
      installationDates: undefined,
    });

    await ctx.db.insert("clientEvents", {
      clientId: order.clientId,
      orderId: args.orderId,
      type: "data_updated",
      details: { fields: ["projectEndDate", "installationStartDate"], action: "clear" },
      performedBy: userId,
    });
  },
});

export const changeStatus = mutation({
  args: {
    orderId: v.id("orders"),
    newStatus: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const userId = userIdentifier(user);

    // Walidacja celu wobec dynamicznego rejestru statusów.
    const config = await ctx.db.query("crmConfig").first();
    const registry = resolveStatuses(
      config?.statuses as StatusDef[] | undefined,
      config?.statusLabels,
    );
    const target = registry.find((s) => s.key === args.newStatus);
    if (!target) {
      throw new ConvexError("Nieznany status");
    }
    if (target.kind !== "order") {
      throw new ConvexError("Nie można ustawić zlecenia na status szansy sprzedaży");
    }

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Zlecenie nie znalezione");

    if (args.newStatus === "archived") {
      const orderTasks = await ctx.db
        .query("orderTasks")
        .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
        .collect();
      const unfinished = orderTasks.filter(
        (t) => t.status !== "done" && t.archived !== true,
      );
      if (unfinished.length > 0) {
        throw new ConvexError(
          "Nie możemy jeszcze zarchiwizować tego zlecenia, ponieważ na liście wciąż znajdują się niezrealizowane zadania. Ukończ je lub zarchiwizuj, aby zamknąć projekt."
        );
      }
    }

    if (order.status === args.newStatus) {
      throw new Error("Status jest już ustawiony na tę wartość");
    }

    const statusPatch: Record<string, unknown> = {
      status: args.newStatus,
      statusChangedAt: Date.now(),
    };

    // Automatyczne przypisywanie dat zlecenia
    // Status 'installation' w tym systemie oznacza "Realizowane" (Start projektu)
    if (args.newStatus === "installation") {
      if (!order.projectStartDate) {
        statusPatch.projectStartDate = Date.now();
      }
    }
    


    if (args.newStatus === "completed") {
      statusPatch.projectEndDate = Date.now();
    } else if (order.status === "completed" && args.newStatus !== "archived") {
      // Jeśli cofamy status ze Zakończone (i nie archiwizujemy), czyścimy datę końca
      statusPatch.projectEndDate = undefined;
    }

    await ctx.db.patch(args.orderId, statusPatch);

    if (args.newStatus === "measurement") {
      const driveConnection = await ctx.db.query("driveConnection").first();
      if (
        driveConnection &&
        (driveConnection.connectionStatus === "connected" ||
          driveConnection.connectionStatus === "token_expiring")
      ) {
        // Triggeruj tworzenie folderu klienta (idempotentne — pomija jeśli istnieje)
        await ctx.scheduler.runAfter(
          0,
          api.googleDrive.createClientFolder,
          { clientId: order.clientId },
        );
        // Triggeruj tworzenie folderu zlecenia
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
    const user = await requireUser(ctx);
    const userId = userIdentifier(user);

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

    await ctx.db.patch(args.orderId, { documents });

    if (args.enabled) {
      await ctx.scheduler.runAfter(0, api.googleDrive.copyTemplate, {
        orderId: args.orderId,
        templateKey: args.documentType,
        templateId: args.templateId,
      });
    } else {
      const fileId = existingUrl ? extractDriveFileId(existingUrl) : null;
      if (fileId) {
        await ctx.scheduler.runAfter(0, api.googleDrive.deleteFile, { fileId });
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
    const user = await requireUser(ctx);
    const userId = userIdentifier(user);

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
    const user = await requireUser(ctx);
    const userId = userIdentifier(user);

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
    type: v.union(v.literal("vat"), v.literal("advance_final"), v.literal("advance_2_final"), v.literal("none")),
    advancePct: v.number(),
    advance2Pct: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    if (args.type === "none") {
      await ctx.db.patch(args.orderId, { invoicePlan: undefined });
      return;
    }
    if (args.advancePct < 0 || args.advancePct > 100) {
      throw new Error("Procent musi być między 0 a 100");
    }
    if (args.advance2Pct !== undefined && (args.advance2Pct < 0 || args.advancePct + args.advance2Pct > 100)) {
      throw new Error("Suma zaliczek nie może przekroczyć 100%");
    }
    await ctx.db.patch(args.orderId, {
      invoicePlan: { type: args.type, advancePct: args.advancePct, advance2Pct: args.advance2Pct },
    });
  },
});

export const refreshOrderNumber = mutation({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const userId = userIdentifier(user);

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Zlecenie nie znalezione");

    const oldName = order.name ?? "";
    const newName = await nextOrderNumber(ctx);

    await ctx.db.patch(args.orderId, { name: newName });

    await ctx.db.insert("clientEvents", {
      clientId: order.clientId,
      orderId: args.orderId,
      type: "order_number_changed",
      details: { from: oldName, to: newName },
      performedBy: userId,
    });

    return { oldName, newName };
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
    const user = await requireUser(ctx);
    const userId = userIdentifier(user);

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

export const setDocumentSignatureStatus = mutation({
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
    signatureStatus: v.union(v.literal("signed"), v.literal("not_applicable")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const userId = userIdentifier(user);

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Zlecenie nie znalezione");

    const documents = { ...order.documents };
    const existing = documents[args.documentType];
    if (!existing?.url) throw new Error("Dokument nie ma jeszcze URL — najpierw wygeneruj lub wgraj dokument.");

    documents[args.documentType] = {
      ...existing,
      signatureStatus: args.signatureStatus,
    };

    await ctx.db.patch(args.orderId, { documents });

    await ctx.db.insert("clientEvents", {
      clientId: order.clientId,
      orderId: args.orderId,
      type: "document_signed",
      details: { documentType: args.documentType, signatureStatus: args.signatureStatus },
      performedBy: userId,
    });
  },
});

export const listByCompletionDateRange = query({
  args: { startDate: v.number(), endDate: v.number() },
  handler: async (ctx, args) => {
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_project_end", (q) =>
        q.gte("projectEndDate", args.startDate).lte("projectEndDate", args.endDate),
      )
      .collect();

    const activeOrders = orders.filter((o) => o.status !== "archived");

    return await Promise.all(
      activeOrders.map(async (order) => {
        let clientName = "";
        if (order.clientId) {
          const client = await ctx.db.get(order.clientId);
          if (client) {
            clientName =
              client.clientType === "business" && client.companyName
                ? client.companyName
                : `${client.firstName} ${client.lastName}`.trim();
          }
        }
        let assignedUserColor: string | undefined;
        let assignedUserName: string | undefined;
        if (order.assignedUserId) {
          const assignedUser = await ctx.db.get(order.assignedUserId);
          assignedUserColor = assignedUser?.color ?? undefined;
          assignedUserName = assignedUser?.displayName ?? assignedUser?.email ?? undefined;
        }

        const assigneesArray = Array.from(new Set([
          ...(order.assignedUserId ? [order.assignedUserId] : []),
          ...(order.assignedUserIds || [])
        ]));
        
        const resolvedAssignees = await Promise.all(assigneesArray.map(async (uid) => {
          const u = await ctx.db.get(uid);
          if (!u) return null;
          return {
            id: u._id,
            name: u.displayName ?? u.email ?? null,
            color: u.color ?? undefined,
          };
        }));
        
        const assignees = resolvedAssignees.filter((u): u is NonNullable<typeof u> => u !== null);
        return {
          _id: order._id,
          projectEndDate: order.projectEndDate!,
          status: order.status,
          clientId: order.clientId,
          clientName,
          services: order.services ?? [],
          name: order.name,
          installationStartDate: order.installationStartDate,
          customText: order.customText,
          assignedUserId: order.assignedUserId,
          assignedUserColor,
          assignedUserName,
          investmentCity: order.investmentCity,
          assignees,
        };
      }),
    );
  },
});

export const listSupplierOrders = query({
  args: {},
  handler: async (ctx) => {
    const orders = await ctx.db
      .query("orders")
      .filter((q) => q.and(
        q.neq(q.field("serviceDeliveries"), undefined),
        q.neq(q.field("status"), "archived")
      ))
      .order("desc")
      .collect();

    const supplierCache = new Map<string, string>();

    return await Promise.all(
      orders
        .filter((o) => o.serviceDeliveries && o.serviceDeliveries.length > 0)
        .map(async (order) => {
          let clientName = "";
          if (order.clientId) {
            const client = await ctx.db.get(order.clientId);
            if (client) {
              clientName =
                client.clientType === "business" && client.companyName
                  ? client.companyName
                  : `${client.firstName} ${client.lastName}`.trim();
            }
          }

          const deliveries = await Promise.all(
            (order.serviceDeliveries ?? []).map(async (d, index) => {
              let supplierName = supplierCache.get(d.supplierId as string);
              if (!supplierName) {
                const supplier = await ctx.db.get(d.supplierId);
                supplierName = supplier?.name ?? "Nieznany";
                supplierCache.set(d.supplierId as string, supplierName);
              }
              return {
                index, // pozycja w order.serviceDeliveries — identyfikator do edycji inline
                serviceName: d.serviceName,
                supplierName,
                orderDate: d.orderDate,
                confirmedDate: d.confirmedDate,
                deliveryDate: d.deliveryDate,
                receivedDate: d.receivedDate,
              };
            }),
          );

          return {
            _id: order._id,
            clientId: order.clientId,
            name: order.name,
            customText: order.customText,
            clientName,
            status: order.status,
            deliveries,
          };
        }),
    );
  },
});

// Edycja inline pojedynczej daty (zamówienia/dostawy) w linii serviceDeliveries.
// Read-modify-write po stronie serwera — bezpieczniejsze niż przesyłanie całej tablicy.
export const updateServiceDeliveryDate = mutation({
  args: {
    orderId: v.id("orders"),
    deliveryIndex: v.number(),
    field: v.union(v.literal("orderDate"), v.literal("confirmedDate"), v.literal("deliveryDate"), v.literal("receivedDate")),
    value: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const userId = userIdentifier(user);

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new ConvexError("Zlecenie nie istnieje.");

    const deliveries = order.serviceDeliveries ?? [];
    if (args.deliveryIndex < 0 || args.deliveryIndex >= deliveries.length) {
      throw new ConvexError("Nieprawidłowa pozycja dostawy.");
    }

    const next = deliveries.map((d, i) => {
      if (i !== args.deliveryIndex) return d;
      const updated = { ...d };
      if (args.value === null) {
        delete updated[args.field];
      } else {
        updated[args.field] = args.value;
      }
      return updated;
    });

    await ctx.db.patch(args.orderId, { serviceDeliveries: next });

    await ctx.db.insert("clientEvents", {
      clientId: order.clientId,
      orderId: args.orderId,
      type: "data_updated",
      details: { fields: [`serviceDeliveries.${args.deliveryIndex}.${args.field}`] },
      performedBy: userId,
    });
  },
});

export const updateExternalOrderInfo = mutation({
  args: {
    orderId: v.id("orders"),
    deliveryIndex: v.number(),
    externalOrderId: v.optional(v.string()),
    externalOrderNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const userId = userIdentifier(user);

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new ConvexError("Zlecenie nie istnieje.");

    const deliveries = order.serviceDeliveries ?? [];
    if (args.deliveryIndex < 0 || args.deliveryIndex >= deliveries.length) {
      throw new ConvexError("Nieprawidłowa pozycja dostawy.");
    }

    const next = deliveries.map((d, i) => {
      if (i !== args.deliveryIndex) return d;
      return {
        ...d,
        externalOrderId: args.externalOrderId,
        externalOrderNumber: args.externalOrderNumber,
      };
    });

    await ctx.db.patch(args.orderId, { serviceDeliveries: next });

    await ctx.db.insert("clientEvents", {
      clientId: order.clientId,
      orderId: args.orderId,
      type: "data_updated",
      details: { fields: [`serviceDeliveries.${args.deliveryIndex}.externalOrderNumber`] },
      performedBy: userId,
    });
  },
});
