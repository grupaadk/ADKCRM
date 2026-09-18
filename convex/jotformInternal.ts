import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { DEFAULT_DOCUMENTS, nextOrderNumber } from "./orders";
import { normalizePhoneForDb } from "./lib/phone";

// Znajdź istniejącego klienta lub utwórz nowego na podstawie danych z Jotform.
// Wywoływane od razu przy przychodzącej odpowiedzi z formularza.
export const createOrFindClient = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    street: v.optional(v.string()),
    buildingNumber: v.optional(v.string()),
    apartmentNumber: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    city: v.optional(v.string()),
    submissionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normalizedPhone = normalizePhoneForDb(args.phone);

    // Dopasowanie po emailu + imieniu + nazwisku
    let existingClient = null;
    if (args.email) {
      const byEmail = await ctx.db
        .query("clients")
        .withIndex("by_email", (q) => q.eq("email", args.email!))
        .collect();
      existingClient =
        byEmail.find(
          (c) =>
            c.firstName === args.firstName &&
            c.lastName === args.lastName &&
            (!normalizedPhone || !c.phone || c.phone === normalizedPhone),
        ) ?? null;
    }

    if (existingClient) {
      return existingClient._id;
    }

    const clientId = await ctx.db.insert("clients", {
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      phone: normalizedPhone,
      street: args.street,
      buildingNumber: args.buildingNumber,
      apartmentNumber: args.apartmentNumber,
      postalCode: args.postalCode,
      city: args.city,
      source: "jotform",
      createdBy: "system",
    });

    await ctx.db.insert("clientEvents", {
      clientId,
      type: "created",
      details: { source: "jotform", submissionId: args.submissionId },
      performedBy: "system",
    });

    return clientId;
  },
});

// Zapis oczekującego zgłoszenia z JotForm.
// Klient jest już utworzony, zlecenie tworzone jest dopiero po przesunięciu karty do "Do pomiarów".
export const savePendingSubmission = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    street: v.optional(v.string()),
    buildingNumber: v.optional(v.string()),
    apartmentNumber: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    city: v.optional(v.string()),
    services: v.optional(v.array(v.string())),
    projectFiles: v.optional(v.string()),
    comment: v.optional(v.string()),
    submissionId: v.optional(v.string()),
    clientId: v.optional(v.id("clients")),
    leadSource: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Idempotencja: jeśli zgłoszenie z tym submissionId już istnieje, zwróć je
    if (args.submissionId) {
      const existing = await ctx.db
        .query("pendingJotformSubmissions")
        .withIndex("by_submission", (q) =>
          q.eq("submissionId", args.submissionId),
        )
        .first();
      if (existing) {
        return existing._id;
      }
    }

    const phone = normalizePhoneForDb(args.phone);

    const pendingId = await ctx.db.insert("pendingJotformSubmissions", {
      ...args,
      phone,
      stage: "lead",
      stageChangedAt: Date.now(),
      processed: false,
    });

    // Automatycznie triggeruj tworzenie folderów szansy na Google Drive
    const driveConnection = await ctx.db.query("driveConnection").first();
    if (
      driveConnection &&
      (driveConnection.connectionStatus === "connected" ||
        driveConnection.connectionStatus === "token_expiring")
    ) {
      await ctx.scheduler.runAfter(
        0,
        api.googleDrive.createClientFolderForOpportunity,
        { opportunityId: pendingId },
      );
    }

    // Automatycznie wyślij SMS potwierdzający przyjęcie prośby o wycenę
    if (args.phone) {
      await ctx.scheduler.runAfter(0, internal.sms.sendQuoteConfirmation, {
        phone: args.phone,
        firstName: args.firstName,
      });
    }

    return pendingId;
  },
});

// Pobranie oczekującego zgłoszenia po ID
export const getPendingById = query({
  args: { pendingId: v.id("pendingJotformSubmissions") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.pendingId);
  },
});

// Aktualizacja etapu oczekującego zgłoszenia (np. lead → inquiry w Kanbanie)
export const updatePendingStage = mutation({
  args: {
    pendingId: v.id("pendingJotformSubmissions"),
    stage: v.union(v.literal("lead"), v.literal("inquiry")),
  },
  handler: async (ctx, args) => {
    const pending = await ctx.db.get(args.pendingId);
    if (!pending) throw new Error("Pending submission not found");
    if (pending.processed) throw new Error("Submission already processed");
    await ctx.db.patch(args.pendingId, {
      stage: args.stage,
      stageChangedAt: Date.now(),
    });
  },
});

// Tworzenie zlecenia z oczekującego zgłoszenia.
// Wywoływane gdy admin przesunie kartę na Kanbanie do kolumny "Do pomiarów".
export const promoteToMeasurement = mutation({
  args: {
    pendingId: v.id("pendingJotformSubmissions"),
  },
  handler: async (ctx, args) => {
    const pending = await ctx.db.get(args.pendingId);
    if (!pending) throw new Error("Pending submission not found");
    if (pending.processed) {
      // Już przetworzone — znajdź istniejące zlecenie
      const existingOrder = pending.clientId
        ? await ctx.db
            .query("orders")
            .withIndex("by_client", (q) => q.eq("clientId", pending.clientId!))
            .filter((q) => q.eq(q.field("jotformSubmissionId"), pending.submissionId))
            .first()
        : null;
      if (existingOrder) {
        return { clientId: existingOrder.clientId, orderId: existingOrder._id };
      }
    }

    // Klient powinien być już utworzony przy webhookunie Jotform
    let clientId: Id<"clients">;
    if (pending.clientId) {
      clientId = pending.clientId;
    } else {
      // Fallback: utwórz klienta jeśli z jakiegoś powodu nie istnieje
      let existingClient = null;
      if (pending.email) {
        const byEmail = await ctx.db
          .query("clients")
          .withIndex("by_email", (q) => q.eq("email", pending.email!))
          .collect();
        existingClient =
          byEmail.find(
            (c) =>
              c.firstName === pending.firstName &&
              c.lastName === pending.lastName,
          ) ?? null;
      }
      if (existingClient) {
        clientId = existingClient._id;
        await ctx.db.patch(args.pendingId, { clientId });
      } else {
        clientId = await ctx.db.insert("clients", {
          firstName: pending.firstName,
          lastName: pending.lastName,
          email: pending.email,
          phone: normalizePhoneForDb(pending.phone),
          street: pending.street,
          buildingNumber: pending.buildingNumber,
          apartmentNumber: pending.apartmentNumber,
          postalCode: pending.postalCode,
          city: pending.city,
          source: "jotform",
          createdBy: "system",
        });
        await ctx.db.insert("clientEvents", {
          clientId,
          type: "created",
          details: { source: "jotform", submissionId: pending.submissionId },
          performedBy: "system",
        });
      }
    }

    // Utwórz zlecenie ze statusem "measurement"
    const orderName = await nextOrderNumber(ctx);
    const orderId = await ctx.db.insert("orders", {
      clientId,
      name: orderName,
      services: pending.services,
      projectFiles: pending.projectFiles,
      comment: pending.comment,
      status: "measurement",
      statusChangedAt: Date.now(),
      documents: DEFAULT_DOCUMENTS,
      source: "jotform",
      jotformSubmissionId: pending.submissionId,
      createdBy: "system",
    });

    await ctx.db.insert("clientEvents", {
      clientId,
      orderId,
      type: "order_created",
      details: { source: "jotform", submissionId: pending.submissionId, services: pending.services },
      performedBy: "system",
    });

    await ctx.db.insert("clientEvents", {
      clientId,
      orderId,
      type: "status_changed",
      details: { from: "lead", to: "measurement" },
      performedBy: "system",
    });

    await ctx.db.patch(args.pendingId, { processed: true });

    // Zaplanuj tworzenie folderu Drive
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
      // Triggeruj tworzenie folderu zlecenia
      await ctx.scheduler.runAfter(
        0,
        api.googleDrive.createOrderFolder,
        { orderId, opportunityId: args.pendingId },
      );
    }

    return { clientId, orderId };
  },
});

// Ręczna naprawa oczekującego zgłoszenia (wywołaj z Convex Dashboard).
// Alias do promoteToMeasurement — zachowane dla wstecznej kompatybilności.
export const repairPendingSubmission = mutation({
  args: {
    pendingId: v.id("pendingJotformSubmissions"),
  },
  handler: async (ctx, args): Promise<{ clientId: Id<"clients">; orderId: Id<"orders"> } | { alreadyProcessed: true; clientId: Id<"clients"> | null; orderId: null }> => {
    const pending = await ctx.db.get(args.pendingId);
    if (!pending) throw new Error("Pending submission not found");
    if (pending.processed) {
      return { alreadyProcessed: true, clientId: pending.clientId ?? null, orderId: null };
    }
    // Inline core promotion logic (nie możemy wywołać ctx.runMutation z mutacji)
    let clientId: Id<"clients">;
    if (pending.clientId) {
      clientId = pending.clientId;
    } else {
      clientId = await ctx.db.insert("clients", {
        firstName: pending.firstName,
        lastName: pending.lastName,
        email: pending.email,
        phone: normalizePhoneForDb(pending.phone),
        street: pending.street,
        buildingNumber: pending.buildingNumber,
        apartmentNumber: pending.apartmentNumber,
        postalCode: pending.postalCode,
        city: pending.city,
        source: "jotform",
        createdBy: "system",
      });
    }
    const orderName = await nextOrderNumber(ctx);
    const orderId = await ctx.db.insert("orders", {
      clientId,
      name: orderName,
      services: pending.services,
      projectFiles: pending.projectFiles,
      comment: pending.comment,
      status: "measurement",
      statusChangedAt: Date.now(),
      documents: DEFAULT_DOCUMENTS,
      source: "jotform",
      jotformSubmissionId: pending.submissionId,
      createdBy: "system",
    });
    await ctx.db.patch(args.pendingId, { processed: true });

    // Zaplanuj tworzenie folderu Drive
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
      // Triggeruj tworzenie folderu zlecenia
      await ctx.scheduler.runAfter(
        0,
        api.googleDrive.createOrderFolder,
        { orderId, opportunityId: args.pendingId },
      );
    }

    return { clientId, orderId };
  },
});

// Dodanie eventu dla duplikatu (zachowane dla kompatybilności)
export const addSubmissionEvent = mutation({
  args: {
    clientId: v.id("clients"),
    submissionId: v.optional(v.string()),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("clientEvents", {
      clientId: args.clientId,
      type: "jotform_duplicate_submission",
      details: { submissionId: args.submissionId, payload: args.payload },
      performedBy: "system",
    });
  },
});

export const deletePending = mutation({
  args: { pendingId: v.id("pendingJotformSubmissions") },
  handler: async (ctx, args) => {
    const pending = await ctx.db.get(args.pendingId);
    if (!pending) throw new Error("Zgłoszenie nie znalezione");
    await ctx.db.delete(args.pendingId);
  },
});
