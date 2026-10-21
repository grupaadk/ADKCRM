import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

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

    return {
      offer,
      items,
      opportunity,
      client,
    };
  },
});

/**
 * Pobiera ofertę powiązaną z daną szansą sprzedaży lub tworzy nowy szkic
 */
export const getOrCreateForOpportunity = mutation({
  args: {
    opportunityId: v.id("pendingJotformSubmissions"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("offers")
      .withIndex("by_opportunity", (q) => q.eq("opportunityId", args.opportunityId))
      .first();

    if (existing) {
      return existing._id;
    }

    const opp = await ctx.db.get(args.opportunityId);
    if (!opp) throw new Error("Szansa sprzedaży nie znaleziona");

    const allOffers = await ctx.db.query("offers").collect();
    const count = allOffers.length + 1;
    const year = new Date().getFullYear();
    const offerNumber = `OF-${year}/${String(count).padStart(3, "0")}`;
    const now = Date.now();

    const clientName = [opp.firstName, opp.lastName].filter(Boolean).join(" ") || "Klient";
    const title = `Oferta dla: ${clientName}`;

    const offerId = await ctx.db.insert("offers", {
      opportunityId: args.opportunityId,
      offerNumber,
      title,
      status: "draft",
      totalPriceNet: 0,
      totalPriceGross: 0,
      totalCostNet: 0,
      discountPercent: 0,
      notes: opp.comment || undefined,
      createdAt: now,
      updatedAt: now,
    });

    return offerId;
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

      const clientName =
        (client ? [client.firstName, client.lastName].filter(Boolean).join(" ") || client.companyName : null) ||
        [opp?.firstName, opp?.lastName].filter(Boolean).join(" ") ||
        "—";

      if (args.search) {
        const queryStr = args.search.toLowerCase();
        const matches =
          offer.offerNumber.toLowerCase().includes(queryStr) ||
          offer.title.toLowerCase().includes(queryStr) ||
          clientName.toLowerCase().includes(queryStr);
        if (!matches) continue;
      }

      results.push({
        ...offer,
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
  },
  handler: async (ctx, args) => {
    const { itemId, ...fields } = args;
    const item = await ctx.db.get(itemId);
    if (!item) throw new Error("Pozycja nie znaleziona");

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined) patch[key] = val;
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

    if (fields.discountPercent !== undefined) {
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
  const finalNet = Math.round(subtotalNet * (1 - discount / 100));
  const finalGross = Math.round(finalNet * 1.23);

  await ctx.db.patch(offerId, {
    totalPriceNet: finalNet,
    totalPriceGross: finalGross,
    totalCostNet: totalCost,
    updatedAt: Date.now(),
  });

  // Synchronizuj wyliczoną kwotę z szansą sprzedaży
  if (offer.opportunityId) {
    const profit = finalNet - totalCost;
    await ctx.db.patch(offer.opportunityId, {
      price: finalNet,
      cost: totalCost,
      profit,
    });
  }
}
