import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { DEFAULT_DOCUMENTS, nextOrderNumber } from "./orders";
import { requireUser } from "./lib/auth";
import { normalizePhoneForDb } from "./lib/phone";

// Zapis nowej szansy sprzedaży (z webhooka Jotform lub ręcznie z panelu).
// Klient NIE jest tworzony — powstaje dopiero przy konwersji do zlecenia.
// Folder Google Drive (FirstName_LastName) tworzy się automatycznie.
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
    projectFiles: v.optional(v.string()),
    comment: v.optional(v.string()),
    submissionId: v.optional(v.string()),
    leadSource: v.optional(v.string()),
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

    const phone = normalizePhoneForDb(args.phone);

    const opportunityId = await ctx.db.insert("pendingJotformSubmissions", {
      ...args,
      phone,
      stage: "lead",
      stageChangedAt: Date.now(),
      processed: false,
      archived: false,
    });

    // Zaplanuj asynchroniczne tworzenie folderu klienta
    await ctx.scheduler.runAfter(
      0,
      api.googleDrive.createClientFolderForOpportunity,
      { opportunityId },
    );

    return opportunityId;
  },
});

// Ręczne utworzenie szansy sprzedaży z panelu administratora.
// Folder Google Drive (FirstName_LastName) tworzy się automatycznie.
export const createManualOpportunity = mutation({
  args: {
    clientId: v.optional(v.id("clients")),
    firstName: v.string(),
    lastName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    street: v.optional(v.string()),
    buildingNumber: v.optional(v.string()),
    apartmentNumber: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    city: v.optional(v.string()),
    investmentStreet: v.optional(v.string()),
    investmentBuildingNumber: v.optional(v.string()),
    investmentApartmentNumber: v.optional(v.string()),
    investmentPostalCode: v.optional(v.string()),
    investmentCity: v.optional(v.string()),
    services: v.optional(v.array(v.string())),
    comment: v.optional(v.string()),
    customText: v.optional(v.string()),
    uploadedFileIds: v.optional(v.array(v.id("_storage"))),
    cost: v.optional(v.number()),
    price: v.optional(v.number()),
    profit: v.optional(v.number()),
    leadSource: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.firstName.trim() && !args.lastName.trim()) {
      throw new Error("Imię i nazwisko są wymagane");
    }
    const { uploadedFileIds, ...rest } = args;
    const phone = normalizePhoneForDb(rest.phone);
    const opportunityId = await ctx.db.insert("pendingJotformSubmissions", {
      ...rest,
      phone,
      stage: "lead",
      stageChangedAt: Date.now(),
      processed: false,
      archived: false,
    });

    // Zaplanuj asynchroniczne tworzenie folderu klienta + upload plików po jego gotowości
    await ctx.scheduler.runAfter(
      0,
      api.googleDrive.createClientFolderForOpportunity,
      { opportunityId, uploadedFileIds: uploadedFileIds ?? [] },
    );

    return opportunityId;
  },
});

export const getSalesOpportunity = query({
  args: { opportunityId: v.id("pendingJotformSubmissions") },
  handler: async (ctx, args) => {
    const opp = await ctx.db.get(args.opportunityId);
    if (!opp) return null;

    let clientFolderUrl = opp.clientFolderUrl;
    if (!clientFolderUrl && opp.clientId) {
      const client = await ctx.db.get(opp.clientId);
      clientFolderUrl = client?.clientFolderUrl;
    }

    let convertedOrder: { _id: Id<"orders">; name?: string; clientId: Id<"clients"> } | null = null;
    if (opp.processed && opp.clientId) {
      let order = null;
      if (opp.submissionId) {
        order = await ctx.db
          .query("orders")
          .withIndex("by_jotform_submission", (q) => q.eq("jotformSubmissionId", opp.submissionId!))
          .first();
      }
      if (!order) {
        order = await ctx.db
          .query("orders")
          .withIndex("by_client", (q) => q.eq("clientId", opp.clientId!))
          .order("desc")
          .first();
      }
      if (order) {
        convertedOrder = {
          _id: order._id,
          name: order.name,
          clientId: order.clientId,
        };
      }
    }

    return {
      ...opp,
      clientFolderUrl,
      convertedOrder,
    };
  },
});

export const listOpportunities = query({
  args: { includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("pendingJotformSubmissions")
      .order("desc")
      .collect();
    const filtered = all.filter((o) => {
      if (o.processed) return false;
      if (!args.includeArchived && o.archived === true) return false;
      return true;
    });
    return Promise.all(
      filtered.map(async (opp) => {
        let assignedUserColor: string | undefined;
        if (opp.assignedUserId) {
          const user = await ctx.db.get(opp.assignedUserId);
          assignedUserColor = user?.color ?? undefined;
        }

        const assigneesArray = Array.from(new Set([
          ...(opp.assignedUserId ? [opp.assignedUserId] : []),
          ...(opp.assignedUserIds || [])
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

        return { ...opp, assignedUserColor, assignees };
      }),
    );
  },
});

// Lekka lista aktywnych szans do pickera (np. dodawanie zadania z Dashboardu).
export const listForPicker = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db
      .query("pendingJotformSubmissions")
      .order("desc")
      .take(500);
    return all
      .filter((o) => !o.processed && o.archived !== true)
      .map((o) => ({
        _id: o._id,
        clientName: `${o.firstName} ${o.lastName}`.trim() || "—",
        customText: o.customText ?? null,
        stage: o.stage ?? "lead",
      }));
  },
});

// Szanse powiązane z danym klientem (lub szanse z identycznymi danymi)
export const listByClient = query({
  args: {
    clientId: v.id("clients"),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const client = await ctx.db.get(args.clientId);
    if (!client) return [];
    
    // Szukamy po clientId lub po zgodności imienia i nazwiska
    const byClient = await ctx.db
      .query("pendingJotformSubmissions")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();

    const all = await ctx.db.query("pendingJotformSubmissions").collect();
    const byName = all.filter(
      (o) =>
        o.firstName.toLowerCase() === client.firstName.toLowerCase() &&
        o.lastName.toLowerCase() === client.lastName.toLowerCase()
    );

    const merged = [...byClient, ...byName];
    const uniqueMap = new Map();
    const showArchived = args.includeArchived ?? true;
    for (const item of merged) {
      if (!item.processed) {
        if (showArchived || item.archived !== true) {
          uniqueMap.set(item._id, item);
        }
      }
    }
    return Array.from(uniqueMap.values());
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

// Najnowsza aktywna szansa w kolumnie "Oferty" (stage: "lead").
// Używane przez animację "deszczu dolarów" — porównanie createdAt z localStorage.
export const latestLeadOpportunity = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db
      .query("pendingJotformSubmissions")
      .order("desc")
      .take(50);
    const latest = all.find(
      (o) => o.stage === "lead" && !o.processed && o.archived !== true,
    );
    if (!latest) return null;
    return { id: latest._id, createdAt: latest._creationTime };
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

// Przypisanie usera do szansy sprzedaży.
export const assignOpportunity = mutation({
  args: {
    opportunityId: v.id("pendingJotformSubmissions"),
    assignedUserId: v.optional(v.id("users")), // legacy
    assignedUserIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const opp = await ctx.db.get(args.opportunityId);
    if (!opp) throw new Error("Szansa sprzedaży nie znaleziona");
    if (opp.processed) throw new Error("Szansa została już przekonwertowana");
    await ctx.db.patch(args.opportunityId, {
      assignedUserId: args.assignedUserId,
      assignedUserIds: args.assignedUserIds,
    });
  },
});

function formatFinancialsNote(cost?: number, price?: number, profit?: number, isUpdate = false): string | null {
  if (cost === undefined && price === undefined && profit === undefined) return null;
  const parts: string[] = [];
  if (cost !== undefined) parts.push(`Koszt: ${cost.toLocaleString("pl-PL")} zł`);
  if (price !== undefined) parts.push(`Cena: ${price.toLocaleString("pl-PL")} zł`);
  if (profit !== undefined) parts.push(`Zarobek: ${profit.toLocaleString("pl-PL")} zł`);
  if (parts.length === 0) return null;

  const prefix = isUpdate ? "[Aktualizacja finansów z szansy]" : "[Finanse z szansy]";
  return `${prefix} ${parts.join(", ")}`;
}

// Edycja pól szansy sprzedaży z widoku szczegółowego.
export const updateOpportunity = mutation({
  args: {
    opportunityId: v.id("pendingJotformSubmissions"),
    firstName: v.optional(v.union(v.string(), v.null())),
    lastName: v.optional(v.union(v.string(), v.null())),
    email: v.optional(v.union(v.string(), v.null())),
    phone: v.optional(v.union(v.string(), v.null())),
    street: v.optional(v.union(v.string(), v.null())),
    buildingNumber: v.optional(v.union(v.string(), v.null())),
    apartmentNumber: v.optional(v.union(v.string(), v.null())),
    postalCode: v.optional(v.union(v.string(), v.null())),
    city: v.optional(v.union(v.string(), v.null())),
    investmentStreet: v.optional(v.union(v.string(), v.null())),
    investmentBuildingNumber: v.optional(v.union(v.string(), v.null())),
    investmentApartmentNumber: v.optional(v.union(v.string(), v.null())),
    investmentPostalCode: v.optional(v.union(v.string(), v.null())),
    investmentCity: v.optional(v.union(v.string(), v.null())),
    services: v.optional(v.array(v.string())),
    comment: v.optional(v.union(v.string(), v.null())),
    customText: v.optional(v.union(v.string(), v.null())),
    cost: v.optional(v.union(v.number(), v.null())),
    price: v.optional(v.union(v.number(), v.null())),
    profit: v.optional(v.union(v.number(), v.null())),
    workDays: v.optional(v.union(v.number(), v.null())),
    leadSource: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const { opportunityId, ...rest } = args;
    const opp = await ctx.db.get(opportunityId);
    if (!opp) throw new Error("Szansa sprzedaży nie znaleziona");

    const isFinancialUpdate = rest.cost !== undefined || rest.price !== undefined || rest.profit !== undefined;
    if (opp.processed && !isFinancialUpdate) {
      throw new Error("Szansa została już przekonwertowana");
    }

    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rest)) {
      if (value === null) {
        patch[key] = undefined;
      } else if (value !== undefined) {
        patch[key] = value;
      }
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(opportunityId, patch);
    }

    // Jeśli zmiana dotyczy finansów na przekonwertowanej szansie, dodaj notatkę do zlecenia
    if (opp.processed && isFinancialUpdate && opp.clientId) {
      const updatedCost = (rest.cost !== undefined ? rest.cost : opp.cost) ?? undefined;
      const updatedPrice = (rest.price !== undefined ? rest.price : opp.price) ?? undefined;
      const updatedProfit = (rest.profit !== undefined ? rest.profit : opp.profit) ?? undefined;
      const updateNote = formatFinancialsNote(updatedCost, updatedPrice, updatedProfit, true);

      if (updateNote) {
        const existingOrder = await ctx.db
          .query("orders")
          .withIndex("by_client", (q) => q.eq("clientId", opp.clientId!))
          .filter((q) =>
            opp.submissionId ? q.eq(q.field("jotformSubmissionId"), opp.submissionId) : q.eq(true, true)
          )
          .first();

        if (existingOrder) {
          const existingComment = existingOrder.comment ?? "";
          const newComment = existingComment ? `${updateNote}\n---\n${existingComment}` : updateNote;
          await ctx.db.patch(existingOrder._id, { comment: newComment });

          await ctx.db.insert("clientEvents", {
            clientId: opp.clientId,
            orderId: existingOrder._id,
            type: "data_updated",
            details: {
              field: "finanse_szansy",
              cost: updatedCost,
              price: updatedPrice,
              profit: updatedProfit,
            },
            performedBy: "system",
          });
        }
      }
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
    let clientFolderId = opp.clientFolderId;
    let clientFolderUrl = opp.clientFolderUrl;

    if (opp.clientId) {
      clientId = opp.clientId;
    } else {
      let existingClient = null;
      if (opp.email) {
        const byEmail = await ctx.db
          .query("clients")
          .withIndex("by_email", (q) => q.eq("email", opp.email!))
          .collect();
        const normalizedPhone = normalizePhoneForDb(opp.phone);
        existingClient =
          byEmail.find(
            (c) =>
              c.firstName === opp.firstName &&
              c.lastName === opp.lastName &&
              (!normalizedPhone || !c.phone || c.phone === normalizedPhone),
          ) ?? null;
      }

      if (existingClient) {
        clientId = existingClient._id;
        // Jeśli klient istniał, spróbuj pobrać jego folder (jeśli brak, będzie undefined)
        if (!clientFolderId && existingClient.clientFolderId) {
          clientFolderId = existingClient.clientFolderId;
          clientFolderUrl = existingClient.clientFolderUrl;
        }
      } else {
        clientId = await ctx.db.insert("clients", {
          firstName: opp.firstName,
          lastName: opp.lastName,
          email: opp.email,
          phone: normalizePhoneForDb(opp.phone),
          street: opp.street,
          buildingNumber: opp.buildingNumber,
          apartmentNumber: opp.apartmentNumber,
          postalCode: opp.postalCode,
          city: opp.city,
          source: opp.submissionId ? "jotform" : "manual",
          createdBy: "system",
          // Jeśli szansa ma folder, powiąż go z nowym klientem
          clientFolderId,
          clientFolderUrl,
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

    // Skopiuj pliki Drive z szansy do zlecenia (wyciągamy fileId z URL)
    const driveProjectFiles = (opp.driveProjectFiles ?? [])
      .map((file) => {
        const match = file.url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        const fileId = match?.[1] ?? null;
        return fileId ? { fileId, name: file.name, url: file.url } : null;
      })
      .filter((f): f is { fileId: string; name: string; url: string } => f !== null);

    const finNote = formatFinancialsNote(opp.cost, opp.price, opp.profit, false);
    let initialComment = opp.comment ?? "";
    if (finNote) {
      initialComment = initialComment ? `${finNote}\n---\n${initialComment}` : finNote;
    }

    const orderName = await nextOrderNumber(ctx);
    const orderId = await ctx.db.insert("orders", {
      clientId,
      name: orderName,
      services: opp.services,
      cost: opp.cost,
      price: opp.price,
      profit: opp.profit,
      workDays: opp.workDays,
      projectFiles: opp.projectFiles,
      driveProjectFiles: driveProjectFiles.length > 0 ? driveProjectFiles : undefined,
      comment: initialComment || undefined,
      customText: opp.customText,
      investmentStreet: opp.investmentStreet,
      investmentBuildingNumber: opp.investmentBuildingNumber,
      investmentApartmentNumber: opp.investmentApartmentNumber,
      investmentPostalCode: opp.investmentPostalCode,
      investmentCity: opp.investmentCity,
      status: "measurement",
      statusChangedAt: Date.now(),
      documents: DEFAULT_DOCUMENTS,
      source: opp.submissionId ? "jotform" : "manual",
      jotformSubmissionId: opp.submissionId,
      createdBy: "system",
      assignedUserId: opp.assignedUserId,
    });

    // Przepisz notatki ze Szansy do nowego Zlecenia
    const oppNotes = await ctx.db
      .query("clientNotes")
      .withIndex("by_opportunity", (q) => q.eq("opportunityId", args.opportunityId))
      .collect();
    for (const note of oppNotes) {
      await ctx.db.patch(note._id, {
        orderId,
        clientId,
      });
    }

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
        { orderId, opportunityId: args.opportunityId },
      );
    }

    return { clientId, orderId };
  },
});

export const updateClientFolder = internalMutation({
  args: {
    opportunityId: v.id("pendingJotformSubmissions"),
    clientFolderId: v.string(),
    clientFolderUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.opportunityId, {
      clientFolderId: args.clientFolderId,
      clientFolderUrl: args.clientFolderUrl,
      clientFolderCreatedAt: Date.now(),
    });
  },
});

export const addDriveProjectFile = internalMutation({
  args: {
    opportunityId: v.id("pendingJotformSubmissions"),
    name: v.string(),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const opp = await ctx.db.get(args.opportunityId);
    if (!opp) throw new Error("Szansa sprzedaży nie znaleziona");

    const existing = opp.driveProjectFiles ?? [];
    const alreadyExists = existing.some((f) => f.url === args.url);

    if (!alreadyExists) {
      await ctx.db.patch(args.opportunityId, {
        driveProjectFiles: [...existing, { name: args.name, url: args.url }],
      });
    }
  },
});

export const updateOpportunityFolders = internalMutation({
  args: {
    opportunityId: v.id("pendingJotformSubmissions"),
    opportunityFolderId: v.string(),
    opportunityFolderUrl: v.string(),
    valuationFilesFolderId: v.string(),
    offersReceivedFolderId: v.string(),
    offersSentFolderId: v.string(),
    ponzioFilesFolderId: v.string(),
    otherFilesFolderId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.opportunityId, {
      opportunityFolderId: args.opportunityFolderId,
      opportunityFolderUrl: args.opportunityFolderUrl,
      valuationFilesFolderId: args.valuationFilesFolderId,
      offersReceivedFolderId: args.offersReceivedFolderId,
      offersSentFolderId: args.offersSentFolderId,
      ponzioFilesFolderId: args.ponzioFilesFolderId,
      otherFilesFolderId: args.otherFilesFolderId,
    });
  },
});

// Retroaktywnie tworzy folder i wgrywa pliki dla istniejącej szansy sprzedaży
export const retryCreateFolderAndUploadFiles = mutation({
  args: { opportunityId: v.id("pendingJotformSubmissions") },
  handler: async (ctx, args) => {
    const opp = await ctx.db.get(args.opportunityId);
    if (!opp) throw new Error("Szansa sprzedaży nie znaleziona");

    // Zaplanuj asynchroniczne tworzenie folderu (jeśli nie istnieje)
    await ctx.scheduler.runAfter(
      0,
      api.googleDrive.createClientFolderForOpportunity,
      { opportunityId: args.opportunityId },
    );


    return { opportunityId: args.opportunityId, scheduled: true };
  },
});

// Raport konwersji szans sprzedaży → zlecenia.
// Liczy szanse z offerSentAt w przedziale [fromTs, toTs] (etap inquiry)
// i sprawdza ile z nich trafiło do zlecenia (processed=true).
// Zwraca też dane poprzedniego okresu tej samej długości do trendu.
export const getConversionReport = query({
  args: {
    fromTs: v.number(),
    toTs: v.number(),
  },
  handler: async (ctx, args) => {
    const { fromTs, toTs } = args;
    const periodLen = toTs - fromTs;

    // Pobierz wszystkie szanse (globalny widok, bez filtrów użytkownika)
    const all = await ctx.db
      .query("pendingJotformSubmissions")
      .order("desc")
      .take(5000);

    // Szanse z offerSentAt w wybranym przedziale (dotarły do etapu inquiry)
    const current = all.filter(
      (o) =>
        o.offerSentAt !== undefined &&
        o.offerSentAt >= fromTs &&
        o.offerSentAt <= toTs,
    );
    const currentConverted = current.filter((o) => o.processed === true);

    // Poprzedni okres tej samej długości
    const prevFrom = fromTs - periodLen;
    const prevTo = fromTs - 1;
    const prev = all.filter(
      (o) =>
        o.offerSentAt !== undefined &&
        o.offerSentAt >= prevFrom &&
        o.offerSentAt <= prevTo,
    );
    const prevConverted = prev.filter((o) => o.processed === true);

    const rate =
      current.length > 0
        ? Math.round((currentConverted.length / current.length) * 100)
        : null;
    const prevRate =
      prev.length > 0
        ? Math.round((prevConverted.length / prev.length) * 100)
        : null;
    const delta =
      rate !== null && prevRate !== null ? rate - prevRate : null;

    return {
      base: current.length,
      converted: currentConverted.length,
      rate,
      prevBase: prev.length,
      prevConverted: prevConverted.length,
      prevRate,
      delta,
    };
  },
});
