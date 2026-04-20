import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { DEFAULT_DOCUMENTS, nextOrderNumber } from "./orders";

// Zapis oczekującego zgłoszenia z JotForm.
// Klient i zamówienie tworzone są dopiero po przeniesieniu karty Trello na listę "Do pomiarów".
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

    return await ctx.db.insert("pendingJotformSubmissions", {
      ...args,
      processed: false,
    });
  },
});

// Zapisanie ID karty Trello do oczekującego zgłoszenia
export const updatePendingWithCardId = mutation({
  args: {
    pendingId: v.id("pendingJotformSubmissions"),
    trelloCardId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.pendingId, { trelloCardId: args.trelloCardId });
  },
});

// Pobranie oczekującego zgłoszenia po ID
export const getPendingById = query({
  args: { pendingId: v.id("pendingJotformSubmissions") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.pendingId);
  },
});

// Wyszukanie oczekującego zgłoszenia po ID karty Trello
export const findPendingByCardId = query({
  args: { trelloCardId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("pendingJotformSubmissions")
      .withIndex("by_trello_card", (q) => q.eq("trelloCardId", args.trelloCardId))
      .filter((q) => q.eq(q.field("processed"), false))
      .first();
  },
});

// Tworzenie klienta + zamówienia z oczekującego zgłoszenia.
// Wywoływane gdy karta Trello trafi na listę "Do pomiarów".
export const createFromPending = mutation({
  args: {
    pendingId: v.id("pendingJotformSubmissions"),
    trelloCardId: v.optional(v.string()),
    trelloCardUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const pending = await ctx.db.get(args.pendingId);
    if (!pending) throw new Error("Pending submission not found");
    if (pending.processed) {
      // Już przetworzone — zwróć istniejące dane
      const existingOrder = pending.trelloCardId
        ? await ctx.db
            .query("orders")
            .withIndex("by_trello_card", (q) =>
              q.eq("trelloCardId", pending.trelloCardId!),
            )
            .first()
        : null;
      if (existingOrder) {
        return { clientId: existingOrder.clientId, orderId: existingOrder._id };
      }
    }

    // Dopasowanie klienta: imię + nazwisko + email + telefon
    let clientId: Id<"clients">;

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
            c.lastName === pending.lastName &&
            (!pending.phone || !c.phone || c.phone === pending.phone),
        ) ?? null;
    }

    if (existingClient) {
      clientId = existingClient._id;
    } else {
      clientId = await ctx.db.insert("clients", {
        firstName: pending.firstName,
        lastName: pending.lastName,
        email: pending.email,
        phone: pending.phone,
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

    // Utwórz zamówienie ze statusem "measurement" (karta trafia od razu na "Do pomiarów")
    const orderName = await nextOrderNumber(ctx);
    const orderId = await ctx.db.insert("orders", {
      clientId,
      name: orderName,
      services: pending.services,
      windowColor: pending.windowColor,
      doorColor: pending.doorColor,
      gateColor: pending.gateColor,
      terraceColor: pending.terraceColor,
      constructionColor: pending.constructionColor,
      sunProtectionType: pending.sunProtectionType,
      projectFiles: pending.projectFiles,
      comment: pending.comment,
      status: "measurement",
      documents: { ...DEFAULT_DOCUMENTS, pomiar: { enabled: true } },
      source: "jotform",
      jotformSubmissionId: pending.submissionId,
      trelloCardId: args.trelloCardId,
      trelloCardUrl: args.trelloCardUrl,
      createdBy: "system",
    });

    await ctx.db.insert("clientEvents", {
      clientId,
      orderId,
      type: "order_created",
      details: {
        source: "jotform",
        submissionId: pending.submissionId,
        services: pending.services,
        triggeredBy: "trello_card_move",
      },
      performedBy: "system",
    });

    await ctx.db.insert("clientEvents", {
      clientId,
      orderId,
      type: "status_changed",
      details: { from: "lead", to: "measurement", triggeredBy: "trello_card_move" },
      performedBy: "system",
    });

    // Oznacz zgłoszenie jako przetworzone
    await ctx.db.patch(args.pendingId, { processed: true });

    // Zaplanuj tworzenie folderu Drive
    const driveConnection = await ctx.db.query("driveConnection").first();
    if (
      driveConnection?.connectionStatus === "connected" &&
      driveConnection.sharedDriveId
    ) {
      await ctx.scheduler.runAfter(
        0,
        internal.googleDrive.initializeMeasurement,
        { orderId },
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
      details: {
        submissionId: args.submissionId,
        payload: args.payload,
      },
      performedBy: "system",
    });
  },
});

// Zachowane dla wstecznej kompatybilności (ręczne tworzenie zamówień przez webhook)
export const createFromWebhook = mutation({
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
    const { submissionId } = args;

    if (submissionId) {
      const existingOrder = await ctx.db
        .query("orders")
        .withIndex("by_jotform_submission", (q) =>
          q.eq("jotformSubmissionId", submissionId),
        )
        .first();
      if (existingOrder) {
        return { clientId: existingOrder.clientId, orderId: existingOrder._id };
      }
    }

    let clientId: Id<"clients">;
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
            (!args.phone || !c.phone || c.phone === args.phone),
        ) ?? null;
    }

    if (existingClient) {
      clientId = existingClient._id;
    } else {
      clientId = await ctx.db.insert("clients", {
        firstName: args.firstName,
        lastName: args.lastName,
        email: args.email,
        phone: args.phone,
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
        details: { source: "jotform", submissionId },
        performedBy: "system",
      });
    }

    const orderId = await ctx.db.insert("orders", {
      clientId,
      services: args.services,
      windowColor: args.windowColor,
      doorColor: args.doorColor,
      gateColor: args.gateColor,
      terraceColor: args.terraceColor,
      constructionColor: args.constructionColor,
      sunProtectionType: args.sunProtectionType,
      projectFiles: args.projectFiles,
      comment: args.comment,
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

    const trelloConfig = await ctx.db.query("trelloConfig").first();
    if (trelloConfig?.syncEnabled) {
      await ctx.scheduler.runAfter(0, api.trello.createCard, { orderId });
    }

    return { clientId, orderId };
  },
});
