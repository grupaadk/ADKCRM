import { mutation, internalMutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

/**
 * Usuwa słowo "Przedstawiciel" z tytułów ofert i nazw klientów w całym systemie
 */
export function cleanOfferTitle(title?: string | null): string | undefined {
  if (!title) return undefined;
  const cleaned = title
    .replace(/Oferta dla:\s*Przedstawiciel(?:\s+|$)/gi, "Oferta dla: ")
    .replace(/\bPrzedstawiciel\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned || undefined;
}

export function resolveCleanClientName(opp?: {
  customText?: string | null;
  firstName?: string | null;
  lastName?: string | null;
} | null, client?: {
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
} | null): string {
  if (client?.companyName?.trim()) return client.companyName.trim();
  if (client) {
    const rawClient = [client.firstName, client.lastName]
      .filter(Boolean)
      .join(" ")
      .replace(/\bPrzedstawiciel\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (rawClient) return rawClient;
  }

  if (opp?.customText?.trim()) return opp.customText.trim();

  const parts = [opp?.firstName, opp?.lastName]
    .filter(Boolean)
    .join(" ")
    .replace(/\bPrzedstawiciel\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return parts || "Klient";
}

/**
 * Pobiera ofertę po jej ID wraz z pełną listą pozycji konstrukcji
 */
export const getOfferWithItems = query({
  args: {
    offerId: v.id("offers"),
  },
  handler: async (ctx, args) => {
    const offer = await ctx.db.get(args.offerId);
    if (!offer) return null;

    const items = await ctx.db
      .query("offerConstructions")
      .withIndex("by_offer", (q) => q.eq("offerId", args.offerId))
      .collect();

    items.sort((a, b) => a.positionIndex - b.positionIndex);

    const opportunity = await ctx.db.get(offer.opportunityId);
    let client = null;
    if (opportunity?.clientId) {
      client = await ctx.db.get(opportunity.clientId);
    }

    let service = null;
    if (offer.serviceId) {
      service = await ctx.db.get(offer.serviceId);
    } else if (offer.serviceName) {
      const allServices = await ctx.db.query("services").collect();
      service =
        allServices.find(
          (s) => s.name.toLowerCase() === offer.serviceName?.toLowerCase()
        ) || null;
    } else if (opportunity?.services && opportunity.services.length > 0) {
      const allServices = await ctx.db.query("services").collect();
      const oppServiceNames = opportunity.services.map((s) => s.trim().toLowerCase());
      service =
        allServices.find(
          (s) =>
            oppServiceNames.includes(s.name.trim().toLowerCase()) &&
            Boolean(s.offerTemplateGoogleDriveId)
        ) ||
        allServices.find((s) =>
          oppServiceNames.includes(s.name.trim().toLowerCase())
        ) ||
        null;
    }

    const cleanTitle = cleanOfferTitle(offer.title) ?? offer.title;

    return {
      offer: {
        ...offer,
        title: cleanTitle,
      },
      items,
      opportunity,
      client,
      service,
    };
  },
});

/**
 * Pobiera ofertę powiązaną z daną szansą sprzedaży lub tworzy nowy szkic
 */
export const getOrCreateForOpportunity = mutation({
  args: {
    opportunityId: v.id("pendingJotformSubmissions"),
    forceNew: v.optional(v.boolean()),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const opp = await ctx.db.get(args.opportunityId);
    if (!opp) throw new Error("Szansa sprzedaży nie znaleziona");

    const existingOffers = await ctx.db
      .query("offers")
      .withIndex("by_opportunity", (q) => q.eq("opportunityId", args.opportunityId))
      .collect();

    if (!args.forceNew && existingOffers.length > 0) {
      return existingOffers[0]._id;
    }

    const allOffers = await ctx.db.query("offers").collect();
    const count = allOffers.length + 1;
    const year = new Date().getFullYear();
    const offerNumber = `OF-${year}/${String(count).padStart(3, "0")}`;
    const now = Date.now();

    const clientName = resolveCleanClientName(opp);
    const variantSuffix = existingOffers.length > 0 ? ` (Wariant ${existingOffers.length + 1})` : "";
    const title = cleanOfferTitle(args.title) || (clientName ? `Oferta dla: ${clientName}${variantSuffix}` : `Oferta${variantSuffix}`);

    let initialServiceId: Id<"services"> | undefined;
    let initialServiceName: string | undefined;
    if (opp.services && opp.services.length > 0) {
      const allServices = await ctx.db.query("services").collect();
      const oppServiceNames = opp.services.map((s) => s.trim().toLowerCase());
      const matched =
        allServices.find(
          (s) =>
            oppServiceNames.includes(s.name.trim().toLowerCase()) &&
            Boolean(s.offerTemplateGoogleDriveId)
        ) ||
        allServices.find((s) =>
          oppServiceNames.includes(s.name.trim().toLowerCase())
        );
      if (matched) {
        initialServiceId = matched._id;
        initialServiceName = matched.name;
      }
    }

    const offerId = await ctx.db.insert("offers", {
      opportunityId: args.opportunityId,
      offerNumber,
      title,
      status: "draft",
      totalPriceNet: 0,
      totalPriceGross: 0,
      totalCostNet: 0,
      discountPercent: 0,
      vatRate: 23,
      serviceId: initialServiceId,
      serviceName: initialServiceName,
      notes: opp.comment || undefined,
      createdAt: now,
      updatedAt: now,
    });

    return offerId;
  },
});

/**
 * Tworzy nową (kolejną) ofertę przypisaną do szansy sprzedaży
 */
export const createOfferForOpportunity = mutation({
  args: {
    opportunityId: v.id("pendingJotformSubmissions"),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const opp = await ctx.db.get(args.opportunityId);
    if (!opp) throw new Error("Szansa sprzedaży nie znaleziona");

    const existingOffers = await ctx.db
      .query("offers")
      .withIndex("by_opportunity", (q) => q.eq("opportunityId", args.opportunityId))
      .collect();

    const allOffers = await ctx.db.query("offers").collect();
    const count = allOffers.length + 1;
    const year = new Date().getFullYear();
    const offerNumber = `OF-${year}/${String(count).padStart(3, "0")}`;
    const now = Date.now();

    const clientName = resolveCleanClientName(opp);
    const variantSuffix = existingOffers.length > 0 ? ` (Wariant ${existingOffers.length + 1})` : "";
    const title = cleanOfferTitle(args.title) || (clientName ? `Oferta dla: ${clientName}${variantSuffix}` : `Oferta${variantSuffix}`);

    let initialServiceId: Id<"services"> | undefined;
    let initialServiceName: string | undefined;
    if (opp.services && opp.services.length > 0) {
      const allServices = await ctx.db.query("services").collect();
      const oppServiceNames = opp.services.map((s) => s.trim().toLowerCase());
      const matched =
        allServices.find(
          (s) =>
            oppServiceNames.includes(s.name.trim().toLowerCase()) &&
            Boolean(s.offerTemplateGoogleDriveId)
        ) ||
        allServices.find((s) =>
          oppServiceNames.includes(s.name.trim().toLowerCase())
        );
      if (matched) {
        initialServiceId = matched._id;
        initialServiceName = matched.name;
      }
    }

    const offerId = await ctx.db.insert("offers", {
      opportunityId: args.opportunityId,
      offerNumber,
      title,
      status: "draft",
      totalPriceNet: 0,
      totalPriceGross: 0,
      totalCostNet: 0,
      discountPercent: 0,
      vatRate: 23,
      serviceId: initialServiceId,
      serviceName: initialServiceName,
      notes: opp.comment || undefined,
      createdAt: now,
      updatedAt: now,
    });

    return offerId;
  },
});

/**
 * Duplikuje całą ofertę wraz z jej pozycjami jako nowy wariant dla tej samej szansy
 */
export const duplicateOffer = mutation({
  args: {
    offerId: v.id("offers"),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sourceOffer = await ctx.db.get(args.offerId);
    if (!sourceOffer) throw new Error("Oferta źródłowa nie znaleziona");

    const allOffers = await ctx.db.query("offers").collect();
    const count = allOffers.length + 1;
    const year = new Date().getFullYear();
    const offerNumber = `OF-${year}/${String(count).padStart(3, "0")}`;
    const now = Date.now();

    const existingInOpp = sourceOffer.opportunityId
      ? await ctx.db
          .query("offers")
          .withIndex("by_opportunity", (q) => q.eq("opportunityId", sourceOffer.opportunityId!))
          .collect()
      : [];

    const defaultTitle = `${sourceOffer.title} (Wariant ${existingInOpp.length + 1})`;
    const title = args.title || defaultTitle;

    const newOfferId = await ctx.db.insert("offers", {
      opportunityId: sourceOffer.opportunityId,
      offerNumber,
      title,
      status: "draft",
      totalPriceNet: sourceOffer.totalPriceNet,
      totalPriceGross: sourceOffer.totalPriceGross,
      totalCostNet: sourceOffer.totalCostNet,
      discountPercent: sourceOffer.discountPercent,
      vatRate: sourceOffer.vatRate ?? 23,
      serviceId: sourceOffer.serviceId,
      serviceName: sourceOffer.serviceName,
      templateFileId: sourceOffer.templateFileId,
      notes: sourceOffer.notes,
      terms: sourceOffer.terms,
      createdAt: now,
      updatedAt: now,
    });

    // Skopiuj wszystkie konstrukcje
    const items = await ctx.db
      .query("offerConstructions")
      .withIndex("by_offer", (q) => q.eq("offerId", args.offerId))
      .collect();

    for (const item of items) {
      const { _id, _creationTime, offerId, ...itemData } = item;
      await ctx.db.insert("offerConstructions", {
        ...itemData,
        offerId: newOfferId,
        createdAt: now,
        updatedAt: now,
      });
    }

    return newOfferId;
  },
});

/**
 * Pobiera wszystkie oferty powiązane z daną szansą sprzedaży
 */
export const listByOpportunity = query({
  args: {
    opportunityId: v.id("pendingJotformSubmissions"),
  },
  handler: async (ctx, args) => {
    const offers = await ctx.db
      .query("offers")
      .withIndex("by_opportunity", (q) => q.eq("opportunityId", args.opportunityId))
      .collect();

    offers.sort((a, b) => b.createdAt - a.createdAt);

    const results = [];
    for (const offer of offers) {
      const items = await ctx.db
        .query("offerConstructions")
        .withIndex("by_offer", (q) => q.eq("offerId", offer._id))
        .collect();

      results.push({
        ...offer,
        title: cleanOfferTitle(offer.title) ?? offer.title,
        itemsCount: items.length,
      });
    }

    return results;
  },
});

/**
 * Listuje oferty z powiązanymi informacjami o szansie i kliencie
 */
export const list = query({
  args: {
    search: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let offers = await ctx.db.query("offers").collect();

    if (args.status && args.status !== "all") {
      offers = offers.filter((o) => o.status === args.status);
    }

    offers.sort((a, b) => b.createdAt - a.createdAt);

    const results = [];
    for (const offer of offers) {
      const opp = await ctx.db.get(offer.opportunityId);
      let client = null;
      if (opp?.clientId) {
        client = await ctx.db.get(opp.clientId);
      }

      const items = await ctx.db
        .query("offerConstructions")
        .withIndex("by_offer", (q) => q.eq("offerId", offer._id))
        .collect();

      const clientName = resolveCleanClientName(opp, client) || "—";
      const cleanTitle = cleanOfferTitle(offer.title) ?? offer.title;

      if (args.search) {
        const queryStr = args.search.toLowerCase();
        const matches =
          offer.offerNumber.toLowerCase().includes(queryStr) ||
          cleanTitle.toLowerCase().includes(queryStr) ||
          clientName.toLowerCase().includes(queryStr);
        if (!matches) continue;
      }

      results.push({
        ...offer,
        title: cleanTitle,
        clientName,
        itemsCount: items.length,
        city: opp?.city || client?.city || "—",
        oppStatus: opp?.stage || "lead",
      });
    }

    return results;
  },
});

/**
 * Dodaje nową konstrukcję do oferty (tworzy nową zakładkę CAD)
 */
export const addConstructionPosition = mutation({
  args: {
    offerId: v.id("offers"),
    constructionId: v.optional(v.id("constructions")),
    name: v.optional(v.string()),
    widthMm: v.optional(v.number()),
    heightMm: v.optional(v.number()),
    panesCount: v.optional(v.number()),
    systemName: v.optional(v.string()),
    color: v.optional(v.string()),
    fillType: v.optional(v.string()),
    priceNet: v.optional(v.number()),
    costNet: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const offer = await ctx.db.get(args.offerId);
    if (!offer) throw new Error("Oferta nie znaleziona");

    // Sprawdź ile pozycji jest już w ofercie
    const existingItems = await ctx.db
      .query("offerConstructions")
      .withIndex("by_offer", (q) => q.eq("offerId", args.offerId))
      .collect();

    const positionIndex = existingItems.length + 1;

    let construction = null;
    if (args.constructionId) {
      construction = await ctx.db.get(args.constructionId);
    }

    const width = args.widthMm || construction?.defaultWidthMm || 2880;
    const height = args.heightMm || construction?.defaultHeightMm || 2300;
    const panes = args.panesCount || construction?.defaultPanesCount || 3;
    const paneWidth = Math.round(width / panes);
    const system = args.systemName || construction?.defaultSystem || undefined;
    const color = args.color || construction?.defaultColor || "RAL 7016MAT";
    const fill = args.fillType || construction?.defaultFillType || "HART 10";
    const name = args.name || construction?.name || `System całoszklany ${panes}-torowy (B=${width.toLocaleString("pl-PL")}, H=${height.toLocaleString("pl-PL")})`;
    const shortName = construction?.name || `Konstrukcja ${positionIndex}`;

    // Przykładowe segmenty dla wizualizacji CAD
    const segments = Array.from({ length: panes }).map((_, i) => ({
      widthMm: i === panes - 1 ? width - paneWidth * (panes - 1) : paneWidth,
      heightMm: height - 103, // odejmując ramę profilową
      fill,
      weightKg: Math.round(((width / panes) * height * 0.000001 * 25) * 10) / 10,
      profileTop: `5448 ${color}`,
      profileBottom: `5450 ${color}`,
      profileLeft: `5450 ${color}`,
      profileRight: `5450 ${color}`,
    }));

    const now = Date.now();
    const itemId = await ctx.db.insert("offerConstructions", {
      offerId: args.offerId,
      positionIndex,
      constructionId: args.constructionId,
      name,
      shortName,
      description: `Kolor profili: ${color} Kolor okuć: Wypełnienia: ${fill}`,
      notes: args.notes || undefined,
      warning: undefined,
      color,
      systemName: system,
      hardware: system ? `${system}-OKUCIA` : "STANDARD-OKUCIA",
      quantity: 1,
      widthMm: width,
      heightMm: height,
      panesCount: panes,
      fillType: fill,
      priceNet: args.priceNet ?? construction?.defaultPriceNet ?? 4500,
      costNet: args.costNet || 2800,
      segments,
      createdAt: now,
      updatedAt: now,
    });

    // Przelicz sumy oferty
    await recalculateOffer(ctx, args.offerId);

    return itemId;
  },
});

/**
 * Aktualizuje parametry danej pozycji konstrukcji
 */
export const updateConstructionPosition = mutation({
  args: {
    itemId: v.id("offerConstructions"),
    positionIndex: v.optional(v.number()),
    name: v.optional(v.string()),
    shortName: v.optional(v.string()),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    warning: v.optional(v.string()),
    color: v.optional(v.string()),
    systemName: v.optional(v.string()),
    hardware: v.optional(v.string()),
    quantity: v.optional(v.number()),
    widthMm: v.optional(v.number()),
    heightMm: v.optional(v.number()),
    panesCount: v.optional(v.number()),
    fillType: v.optional(v.string()),
    priceNet: v.optional(v.number()),
    costNet: v.optional(v.number()),
    placedAboveItemId: v.optional(v.union(v.string(), v.null())),
    placedBelowItemId: v.optional(v.union(v.string(), v.null())),
    rowIndex: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const { itemId, ...fields } = args;
    const item = await ctx.db.get(itemId);
    if (!item) throw new Error("Pozycja nie znaleziona");

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, val] of Object.entries(fields)) {
      if (val === null) {
        patch[key] = undefined;
      } else if (val !== undefined) {
        patch[key] = val;
      }
    }

    // Jeśli zmieniły się wymiary lub ilość skrzydeł, przelicz segmenty CAD
    const newWidth = fields.widthMm ?? item.widthMm;
    const newHeight = fields.heightMm ?? item.heightMm;
    const newPanes = fields.panesCount ?? item.panesCount;
    const newFill = fields.fillType ?? item.fillType ?? "HART 10";
    const newColor = fields.color ?? item.color ?? "RAL 7016MAT";

    if (fields.widthMm !== undefined || fields.heightMm !== undefined || fields.panesCount !== undefined || fields.fillType !== undefined || fields.color !== undefined) {
      const paneWidth = Math.round(newWidth / newPanes);
      patch.segments = Array.from({ length: newPanes }).map((_, i) => ({
        widthMm: i === newPanes - 1 ? newWidth - paneWidth * (newPanes - 1) : paneWidth,
        heightMm: newHeight - 103,
        fill: newFill,
        weightKg: Math.round(((newWidth / newPanes) * newHeight * 0.000001 * 25) * 10) / 10,
        profileTop: `5448 ${newColor}`,
        profileBottom: `5450 ${newColor}`,
        profileLeft: `5450 ${newColor}`,
        profileRight: `5450 ${newColor}`,
      }));
    }

    await ctx.db.patch(itemId, patch);
    await recalculateOffer(ctx, item.offerId);
  },
});

/**
 * Usuwa pozycję konstrukcji z oferty
 */
export const removeConstructionPosition = mutation({
  args: {
    itemId: v.id("offerConstructions"),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item) return;

    const offerId = item.offerId;
    await ctx.db.delete(args.itemId);

    // Przenumeruj pozostałe pozycje
    const remaining = await ctx.db
      .query("offerConstructions")
      .withIndex("by_offer", (q) => q.eq("offerId", offerId))
      .collect();

    remaining.sort((a, b) => a.positionIndex - b.positionIndex);
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].positionIndex !== i + 1) {
        await ctx.db.patch(remaining[i]._id, { positionIndex: i + 1 });
      }
    }

    await recalculateOffer(ctx, offerId);
  },
});

/**
 * Zmienia kolejność pozycji konstrukcji w ofercie (reorder)
 */
export const reorderConstructionPositions = mutation({
  args: {
    offerId: v.id("offers"),
    itemIds: v.array(v.id("offerConstructions")),
  },
  handler: async (ctx, args) => {
    for (let i = 0; i < args.itemIds.length; i++) {
      await ctx.db.patch(args.itemIds[i], {
        positionIndex: i + 1,
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Duplikuje pozycję konstrukcji
 */
export const duplicateConstructionPosition = mutation({
  args: {
    itemId: v.id("offerConstructions"),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("Pozycja nie znaleziona");

    const existing = await ctx.db
      .query("offerConstructions")
      .withIndex("by_offer", (q) => q.eq("offerId", item.offerId))
      .collect();

    const nextIndex = existing.length + 1;
    const now = Date.now();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, _creationTime, ...copyFields } = item;
    const newItemId = await ctx.db.insert("offerConstructions", {
      ...copyFields,
      positionIndex: nextIndex,
      shortName: `${item.shortName || "Konstrukcja"} (kopia)`,
      createdAt: now,
      updatedAt: now,
    });

    await recalculateOffer(ctx, item.offerId);
    return newItemId;
  },
});

/**
 * Aktualizuje dane ogólne oferty (status, tytuł, notatki, rabat)
 */
export const updateOffer = mutation({
  args: {
    offerId: v.id("offers"),
    title: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("sent"),
        v.literal("accepted"),
        v.literal("rejected")
      )
    ),
    discountPercent: v.optional(v.number()),
    vatRate: v.optional(v.number()),
    serviceId: v.optional(v.id("services")),
    serviceName: v.optional(v.string()),
    templateFileId: v.optional(v.string()),
    notes: v.optional(v.string()),
    terms: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { offerId, ...fields } = args;
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined) patch[key] = val;
    }
    await ctx.db.patch(offerId, patch);

    if (fields.discountPercent !== undefined || fields.vatRate !== undefined) {
      await recalculateOffer(ctx, offerId);
    }
  },
});

/**
 * Pomocnicze przeliczanie sum oferty i synchronizacja z szansą sprzedaży
 */
async function recalculateOffer(ctx: MutationCtx, offerId: Id<"offers">) {
  const offer = await ctx.db.get(offerId);
  if (!offer) return;

  const items = await ctx.db
    .query("offerConstructions")
    .withIndex("by_offer", (q) => q.eq("offerId", offerId))
    .collect();

  let subtotalNet = 0;
  let totalCost = 0;

  for (const it of items) {
    const q = it.quantity || 1;
    subtotalNet += (it.priceNet || 0) * q;
    totalCost += (it.costNet || 0) * q;
  }

  const discount = offer.discountPercent || 0;
  const vatRate = offer.vatRate ?? 23;
  const finalNet = Math.round(subtotalNet * (1 - discount / 100));
  const finalGross = Math.round(finalNet * (1 + vatRate / 100));

  await ctx.db.patch(offerId, {
    totalPriceNet: finalNet,
    totalPriceGross: finalGross,
    totalCostNet: totalCost,
    updatedAt: Date.now(),
  });

  // Synchronizuj wyliczoną kwotę z szansą sprzedaży
  if (offer.opportunityId) {
    const oppOffers = await ctx.db
      .query("offers")
      .withIndex("by_opportunity", (q) => q.eq("opportunityId", offer.opportunityId!))
      .collect();

    // Jeśli inna oferta jest oznaczona jako "accepted", nie nadpisuj kwoty szansy inną ofertą
    const hasOtherAccepted = oppOffers.some(
      (o) => o._id !== offerId && o.status === "accepted"
    );

    if (!hasOtherAccepted || offer.status === "accepted") {
      const profit = finalNet - totalCost;
      await ctx.db.patch(offer.opportunityId, {
        price: finalNet,
        cost: totalCost,
        profit,
      });
    }
  }
}

/**
 * Zapisuje URL ostatnio wygenerowanego PDF-u bezpośrednio na dokumencie oferty.
 * Wywoływana wewnętrznie przez akcję generateOfferPdf.
 */
export const setOfferLastPdfUrl = internalMutation({
  args: {
    offerId: v.id("offers"),
    pdfUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.offerId, { lastPdfUrl: args.pdfUrl });
  },
});

/**
 * Jednorazowe / porządkujące czyszczenie bazy ze słowa "Przedstawiciel"
 * zarówno w istniejących ofertach jak i szansach sprzedaży.
 */
export const cleanupPrzedstawicielData = mutation({
  args: {},
  handler: async (ctx) => {
    // 1. Oczyść istniejące oferty
    const allOffers = await ctx.db.query("offers").collect();
    let updatedOffersCount = 0;
    for (const offer of allOffers) {
      if (offer.title && /przedstawiciel/i.test(offer.title)) {
        const newTitle = cleanOfferTitle(offer.title) || "Oferta";
        if (newTitle !== offer.title) {
          await ctx.db.patch(offer._id, { title: newTitle });
          updatedOffersCount++;
        }
      }
    }

    // 2. Oczyść szanse sprzedaży gdzie firstName to "Przedstawiciel" lub zawiera "Przedstawiciel"
    const allOpps = await ctx.db.query("pendingJotformSubmissions").collect();
    let updatedOppsCount = 0;
    for (const opp of allOpps) {
      const first = (opp.firstName ?? "").trim();
      const last = (opp.lastName ?? "").trim();
      const hasPrzedstawicielInFirst = /przedstawiciel/i.test(first);
      const hasPrzedstawicielInLast = /przedstawiciel/i.test(last);

      if (hasPrzedstawicielInFirst || hasPrzedstawicielInLast) {
        let newFirst = first.replace(/\bPrzedstawiciel\b/gi, "").replace(/\s{2,}/g, " ").trim();
        let newLast = last.replace(/\bPrzedstawiciel\b/gi, "").replace(/\s{2,}/g, " ").trim();

        // Jeśli firstName było "Przedstawiciel", a lastName zawierało pełne imię i nazwisko (np. "Jan Kowalski")
        if (!newFirst && newLast) {
          const parts = newLast.split(/\s+/);
          // Jeśli to nie spółka/firma z wieloma członami, podziel na imię i nazwisko
          const isCompany = /sp\.?\s*z\s*o\.?o\.?|s\.?a\.?|spółka|spolka/i.test(newLast);
          if (!isCompany && parts.length === 2) {
            newFirst = parts[0];
            newLast = parts[1];
          } else if (isCompany) {
            newFirst = opp.customText?.trim() || "";
          }
        }

        await ctx.db.patch(opp._id, {
          firstName: newFirst,
          lastName: newLast,
        });
        updatedOppsCount++;
      }
    }

    return { updatedOffersCount, updatedOppsCount };
  },
});

