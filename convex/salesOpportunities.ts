import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { DEFAULT_DOCUMENTS, nextOrderNumber } from "./orders";

// Zapis nowej szansy sprzedaży (z webhooka Jotform lub ręcznie z panelu).
// Klient NIE jest tworzony — powstaje dopiero przy konwersji do zlecenia.
export const createSalesOpportunity = mutation({
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
    if (args.submissionId) {
      const existing = await ctx.db
        .query("pendingJotformSubmissions")
        .withIndex("by_submission", (q) =>
          q.eq("submissionId", args.submissionId),
        )
        .first();
      if (existing) return existing._id;
    }

    return await ctx.db.insert("pendingJotformSubmissions", {
      ...args,
      stage: "lead",
      processed: false,
      archived: false,
    });
  },
});

// Ręczne utworzenie szansy sprzedaży z panelu administratora.
export const createManualOpportunity = mutation({
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
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.firstName.trim() || !args.lastName.trim()) {
      throw new Error("Imię i nazwisko są wymagane");
    }
    return await ctx.db.insert("pendingJotformSubmissions", {
      ...args,
      stage: "lead",
      processed: false,
      archived: false,
    });
  },
});

export const getSalesOpportunity = query({
  args: { opportunityId: v.id("pendingJotformSubmissions") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.opportunityId);
  },
});

export const listOpportunities = query({
  args: { includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("pendingJotformSubmissions")
      .order("desc")
      .collect();
    return all.filter((o) => {
      if (o.processed) return false;
      if (!args.includeArchived && o.archived === true) return false;
      return true;
    });
  },
});

export const listArchivedOpportunities = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db
      .query("pendingJotformSubmissions")
      .order("desc")
      .collect();
    return all.filter((o) => o.archived === true && !o.processed);
  },
});

// Zmiana etapu (lead ↔ inquiry). Konwersja do zlecenia osobnym triggerem.
export const updateOpportunityStage = mutation({
  args: {
    opportunityId: v.id("pendingJotformSubmissions"),
    stage: v.union(v.literal("lead"), v.literal("inquiry")),
  },
  handler: async (ctx, args) => {
    const opp = await ctx.db.get(args.opportunityId);
    if (!opp) throw new Error("Szansa sprzedaży nie znaleziona");
    if (opp.processed) throw new Error("Szansa została już przekonwertowana");

    const patch: {
      stage: "lead" | "inquiry";
      offerSentAt?: number;
    } = { stage: args.stage };

    if (args.stage === "inquiry" && !opp.offerSentAt) {
      patch.offerSentAt = Date.now();
    }

    await ctx.db.patch(args.opportunityId, patch);
  },
});

// Edycja pól szansy sprzedaży z widoku szczegółowego.
export const updateOpportunity = mutation({
  args: {
    opportunityId: v.id("pendingJotformSubmissions"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
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
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { opportunityId, ...rest } = args;
    const opp = await ctx.db.get(opportunityId);
    if (!opp) throw new Error("Szansa sprzedaży nie znaleziona");
    if (opp.processed) throw new Error("Szansa została już przekonwertowana");

    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rest)) {
      if (value === undefined) continue;
      patch[key] = value;
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(opportunityId, patch);
    }
  },
});

export const archiveOpportunity = mutation({
  args: { opportunityId: v.id("pendingJotformSubmissions") },
  handler: async (ctx, args) => {
    const opp = await ctx.db.get(args.opportunityId);
    if (!opp) throw new Error("Szansa sprzedaży nie znaleziona");
    if (opp.processed) throw new Error("Szansa została już przekonwertowana");
    await ctx.db.patch(args.opportunityId, { archived: true });
  },
});

export const unarchiveOpportunity = mutation({
  args: { opportunityId: v.id("pendingJotformSubmissions") },
  handler: async (ctx, args) => {
    const opp = await ctx.db.get(args.opportunityId);
    if (!opp) throw new Error("Szansa sprzedaży nie znaleziona");
    await ctx.db.patch(args.opportunityId, { archived: false });
  },
});

export const deleteSalesOpportunity = mutation({
  args: { opportunityId: v.id("pendingJotformSubmissions") },
  handler: async (ctx, args) => {
    const opp = await ctx.db.get(args.opportunityId);
    if (!opp) throw new Error("Szansa sprzedaży nie znaleziona");
    await ctx.db.delete(args.opportunityId);
  },
});

// Konwersja szansy sprzedaży do zlecenia: tworzy klienta (lub podpina istniejącego),
// tworzy zlecenie ze statusem "measurement" i (jeśli skonfigurowany) folder Google Drive.
export const convertToOrder = mutation({
  args: { opportunityId: v.id("pendingJotformSubmissions") },
  handler: async (
    ctx,
    args,
  ): Promise<{ clientId: Id<"clients">; orderId: Id<"orders"> }> => {
    const opp = await ctx.db.get(args.opportunityId);
    if (!opp) throw new Error("Szansa sprzedaży nie znaleziona");

    if (opp.processed) {
      // Idempotencja: zwróć istniejące zlecenie powiązane z tym submissionId
      if (opp.clientId) {
        const existingOrder = await ctx.db
          .query("orders")
          .withIndex("by_client", (q) => q.eq("clientId", opp.clientId!))
          .filter((q) =>
            q.eq(q.field("jotformSubmissionId"), opp.submissionId),
          )
          .first();
        if (existingOrder) {
          return { clientId: existingOrder.clientId, orderId: existingOrder._id };
        }
      }
      throw new Error("Szansa została już przekonwertowana, ale nie znaleziono zlecenia");
    }

    if (opp.stage !== "inquiry") {
      throw new Error(
        'Szansa musi mieć status "Oferta wysłana", aby utworzyć z niej zlecenie',
      );
    }

    // Dedupe klienta po email + firstName + lastName
    let clientId: Id<"clients">;
    if (opp.clientId) {
      clientId = opp.clientId;
    } else {
      let existingClient = null;
      if (opp.email) {
        const byEmail = await ctx.db
          .query("clients")
          .withIndex("by_email", (q) => q.eq("email", opp.email!))
          .collect();
        existingClient =
          byEmail.find(
            (c) =>
              c.firstName === opp.firstName &&
              c.lastName === opp.lastName &&
              (!opp.phone || !c.phone || c.phone === opp.phone),
          ) ?? null;
      }

      if (existingClient) {
        clientId = existingClient._id;
      } else {
        clientId = await ctx.db.insert("clients", {
          firstName: opp.firstName,
          lastName: opp.lastName,
          email: opp.email,
          phone: opp.phone,
          street: opp.street,
          buildingNumber: opp.buildingNumber,
          apartmentNumber: opp.apartmentNumber,
          postalCode: opp.postalCode,
          city: opp.city,
          source: opp.submissionId ? "jotform" : "manual",
          createdBy: "system",
        });
        await ctx.db.insert("clientEvents", {
          clientId,
          type: "created",
          details: {
            source: opp.submissionId ? "jotform" : "manual",
            submissionId: opp.submissionId,
          },
          performedBy: "system",
        });
      }
    }

    const orderName = await nextOrderNumber(ctx);
    const orderId = await ctx.db.insert("orders", {
      clientId,
      name: orderName,
      services: opp.services,
      windowColor: opp.windowColor,
      doorColor: opp.doorColor,
      gateColor: opp.gateColor,
      terraceColor: opp.terraceColor,
      constructionColor: opp.constructionColor,
      sunProtectionType: opp.sunProtectionType,
      projectFiles: opp.projectFiles,
      comment: opp.comment,
      status: "measurement",
      documents: DEFAULT_DOCUMENTS,
      source: opp.submissionId ? "jotform" : "manual",
      jotformSubmissionId: opp.submissionId,
      createdBy: "system",
    });

    await ctx.db.insert("clientEvents", {
      clientId,
      orderId,
      type: "order_created",
      details: {
        source: opp.submissionId ? "jotform" : "manual",
        submissionId: opp.submissionId,
        services: opp.services,
      },
      performedBy: "system",
    });

    await ctx.db.insert("clientEvents", {
      clientId,
      orderId,
      type: "status_changed",
      details: { from: opp.stage ?? "inquiry", to: "measurement" },
      performedBy: "system",
    });

    await ctx.db.patch(args.opportunityId, { processed: true, clientId });

    // Folder Drive
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

    return { clientId, orderId };
  },
});
