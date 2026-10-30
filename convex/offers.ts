import { mutation, internalMutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import {
  calculateGlassSystemPricing,
  checkIsStandard,
  isGlassSystemConstruction,
} from "../lib/glassPricing";
import { matchPricingRange } from "../lib/pricingRanges";

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

    const rawItems = await ctx.db
      .query("offerConstructions")
      .withIndex("by_offer", (q) => q.eq("offerId", args.offerId))
      .collect();

    rawItems.sort((a, b) => a.positionIndex - b.positionIndex);

    let allConstructionsCache: Doc<"constructions">[] | null = null;

    // Wzbogacamy pozycje o cennik z szablonu, jeśli nie mają jeszcze własnych filarów cenowych
    const items = await Promise.all(
      rawItems.map(async (item) => {
        let tpl: Doc<"constructions"> | null = null;
        if (item.constructionId) {
          tpl = await ctx.db.get(item.constructionId);
        }
        if (!tpl) {
          if (!allConstructionsCache) {
            allConstructionsCache = await ctx.db.query("constructions").collect();
          }
          const short = (item.shortName || "").trim().toLowerCase();
          const name = (item.name || "").trim().toLowerCase();
          tpl =
            allConstructionsCache.find((c) => {
              const code = (c.code || "").trim().toLowerCase();
              const cName = (c.name || "").trim().toLowerCase();
              return (
                (code && (short === code || name.includes(code))) ||
                (cName && (short === cName || name === cName))
              );
            }) || null;
        }

        const isTriangle =
          (item.name || "").toLowerCase().includes("trójką") ||
          (tpl?.name || "").toLowerCase().includes("trójką") ||
          (tpl?.code || "").toLowerCase().includes("trojkat") ||
          Boolean(item.shortName && item.shortName.toLowerCase().includes("trójką"));
        const effectivePanesCount = isTriangle ? 1 : item.panesCount;

        const isGlass =
          isGlassSystemConstruction({
            name: item.name,
            shortName: item.shortName,
            systemName: item.systemName,
            fillType: item.fillType,
          }) ||
          (tpl?.category || "").toLowerCase().includes("szkl");

        const standardCheck = isGlass
          ? checkIsStandard(
              Math.round((item.widthMm || 0) / 10),
              Math.round((item.heightMm || 0) / 10)
            )
          : null;

        const isGlassStale =
          isGlass &&
          typeof item.widthMm === "number" &&
          typeof item.heightMm === "number" &&
          (item.installationPriceNet === 1373 ||
            item.installationPriceNet === 3093 ||
            item.installationPriceNet === Math.round(250 * (item.widthMm / 1000)) + 50 ||
            (!standardCheck?.isStandard && (item.materialPriceNet === 8626 || item.priceNet === 10213)) ||
            (tpl && Boolean(tpl.defaultWidthMm) && tpl.defaultWidthMm !== item.widthMm));

        if (isGlassStale) {
          const calc = calculateGlassSystemPricing(item.widthMm, item.heightMm);
          return {
            ...item,
            panesCount: effectivePanesCount,
            constructionId: item.constructionId ?? tpl?._id,
            isStandard: standardCheck?.isStandard ?? item.isStandard,
            pricingTier: standardCheck?.pricingTier ?? item.pricingTier,
            standardWidthCm: standardCheck?.standardWidthCm ?? item.standardWidthCm,
            materialCostNet: calc.materialCostNet,
            brushesCostNet: calc.brushesCostNet,
            handlesCostNet: calc.handlesCostNet,
            materialPriceNet: calc.materialPriceNet,
            installationCostNet: calc.installationCostNet,
            installationPriceNet: calc.installationPriceNet,
            priceNet: calc.priceNet,
            costNet: calc.costNet,
          };
        }

        if (tpl?.pricingRanges && tpl.pricingRanges.length > 0 && typeof item.widthMm === "number") {
          const matchedRange = matchPricingRange(tpl.pricingRanges, item.widthMm);
          if (matchedRange) {
            const isStaleRange =
              item.materialPriceNet === undefined ||
              item.materialPriceNet === 0 ||
              item.materialPriceNet === 2400 ||
              item.priceNet === 2400 ||
              item.priceNet === 0;

            if (isStaleRange) {
              let instCost = item.installationCostNet ?? tpl.installationCostNet ?? 0;
              let instPrice = item.installationPriceNet ?? tpl.installationPriceNet ?? 0;
              if (tpl.installationUnit === "mb" && (item.installationPriceNet === undefined || item.installationPriceNet === 0)) {
                const rateCost = tpl.installationUnitRate ?? 200;
                const rateClient =
                  tpl.installationMarkupType === "percent"
                    ? Math.round(rateCost * (1 + (tpl.installationMarkupValue || 0) / 100))
                    : rateCost + (tpl.installationMarkupValue || 50);
                instCost = Math.round((item.widthMm / 1000) * rateCost);
                instPrice = Math.round((item.widthMm / 1000) * rateClient);
              }
              const matCost = matchedRange.costNet ?? matchedRange.priceNet;
              const matPrice =
                matchedRange.priceNet && matchedRange.priceNet !== matchedRange.costNet
                  ? matchedRange.priceNet
                  : (tpl.materialMarkupType === "percent"
                      ? Math.round(matCost * (1 + (tpl.materialMarkupValue || 0) / 100))
                      : matCost + (tpl.materialMarkupValue || 0));
              return {
                ...item,
                panesCount: effectivePanesCount,
                constructionId: item.constructionId ?? tpl._id,
                pricingTier: matchedRange.label || `${matchedRange.minWidthMm}-${matchedRange.maxWidthMm} mm`,
                materialCostNet: matCost,
                materialPriceNet: matPrice,
                installationCostNet: instCost,
                installationPriceNet: instPrice,
                priceNet: matPrice + instPrice,
                costNet: matCost + instCost,
              };
            }
          }
        }

        const hasExplicitPillars =
          (item.materialPriceNet !== undefined && item.materialPriceNet !== null) ||
          (item.installationPriceNet !== undefined && item.installationPriceNet !== null);

        if (!hasExplicitPillars && (tpl || isGlass)) {
          let matCost = item.costNet || 0;
          let matPrice = item.priceNet || 0;
          let instCost = 0;
          let instPrice = 0;
          let combinedPrice = item.priceNet;
          let combinedCost = item.costNet;

          if (tpl && (tpl.materialPriceNet !== undefined || tpl.materialCostNet !== undefined)) {
            matCost = tpl.materialCostNet ?? (item.costNet || 0);
            matPrice = tpl.materialPriceNet ?? (item.priceNet || 0);
            instCost = tpl.installationCostNet ?? 0;
            instPrice = tpl.installationPriceNet ?? 0;

            if (isGlass && (instPrice === 1373 || instPrice === 3093)) {
              const calc = calculateGlassSystemPricing(item.widthMm, item.heightMm);
              instCost = calc.installationCostNet;
              instPrice = calc.installationPriceNet;
            }

            combinedPrice =
              (tpl.materialPriceNet || 0) + (tpl.installationPriceNet || 0) > 0
                ? (tpl.materialPriceNet || 0) + (tpl.installationPriceNet || 0)
                : item.priceNet;
            combinedCost =
              (tpl.materialCostNet || 0) + (tpl.installationCostNet || 0) > 0
                ? (tpl.materialCostNet || 0) + (tpl.installationCostNet || 0)
                : item.costNet;
          } else if (isGlass) {
            const calc = calculateGlassSystemPricing(item.widthMm, item.heightMm);
            matCost = calc.materialCostNet;
            matPrice = calc.materialPriceNet;
            instCost = calc.installationCostNet;
            instPrice = calc.installationPriceNet;
            combinedPrice = calc.priceNet;
            combinedCost = calc.costNet;
          } else if (tpl) {
            matCost = tpl.materialCostNet ?? (item.costNet || 0);
            matPrice = tpl.materialPriceNet ?? (item.priceNet || 0);
            instCost = tpl.installationCostNet ?? 0;
            instPrice = tpl.installationPriceNet ?? 0;
            combinedPrice =
              (tpl.materialPriceNet || 0) + (tpl.installationPriceNet || 0) > 0
                ? (tpl.materialPriceNet || 0) + (tpl.installationPriceNet || 0)
                : item.priceNet;
            combinedCost =
              (tpl.materialCostNet || 0) + (tpl.installationCostNet || 0) > 0
                ? (tpl.materialCostNet || 0) + (tpl.installationCostNet || 0)
                : item.costNet;
          }

          return {
            ...item,
            panesCount: effectivePanesCount,
            constructionId: item.constructionId ?? tpl?._id,
            isStandard: standardCheck?.isStandard ?? item.isStandard,
            pricingTier: standardCheck?.pricingTier ?? item.pricingTier,
            standardWidthCm: standardCheck?.standardWidthCm ?? item.standardWidthCm,
            materialCostNet: matCost,
            materialPriceNet: matPrice,
            installationCostNet: instCost,
            installationPriceNet: instPrice,
            installationUnit: tpl?.installationUnit,
            installationUnitRate: tpl?.installationUnitRate,
            priceNet: combinedPrice,
            costNet: combinedCost,
          };
        }

        return {
          ...item,
          panesCount: effectivePanesCount,
          isStandard: standardCheck?.isStandard ?? item.isStandard,
          pricingTier: standardCheck?.pricingTier ?? item.pricingTier,
          standardWidthCm: standardCheck?.standardWidthCm ?? item.standardWidthCm,
        };
      })
    );

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

    const additionsRaw = await ctx.db
      .query("offerAdditions")
      .withIndex("by_offer", (q) => q.eq("offerId", args.offerId))
      .collect();
    const additions = additionsRaw.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

    let computedTotalCost = 0;
    let computedMaterialNet = 0;
    let computedInstallationNet = 0;
    for (const it of items) {
      const q = it.quantity || 1;
      const matPrice = it.materialPriceNet;
      const instPrice = it.installationPriceNet || 0;
      const matCost = it.materialCostNet;
      const instCost = it.installationCostNet || 0;

      computedTotalCost += (matCost !== undefined ? matCost + instCost : (it.costNet || 0)) * q;
      if (matPrice !== undefined && matPrice !== null) {
        computedMaterialNet += matPrice * q;
      } else {
        computedMaterialNet += Math.max(0, (it.priceNet || 0) * q - instPrice * q);
      }
      computedInstallationNet += instPrice * q;
    }

    let computedAdditionsNet = 0;
    for (const add of additions) {
      const q = add.quantity || 1;
      const addPrice = (add.priceNet || 0) * q;
      const addCost = (add.costNet || 0) * q;
      const addInstPrice = (add.installationPriceNet || 0) * q;
      const addInstCost = (add.installationCostNet || 0) * q;

      computedAdditionsNet += addPrice;
      computedInstallationNet += addInstPrice;
      computedTotalCost += addCost + addInstCost;
    }

    const discount = offer.discountPercent || 0;
    const vatRate = offer.vatRate ?? 23;
    const discountedBase = Math.round((computedMaterialNet + computedAdditionsNet) * (1 - discount / 100));
    const dynamicNet = discountedBase + computedInstallationNet;
    const dynamicGross = Math.round(dynamicNet * (1 + vatRate / 100));

    return {
      offer: {
        ...offer,
        title: cleanTitle,
        totalPriceNet: dynamicNet > 0 ? dynamicNet : offer.totalPriceNet,
        totalPriceGross: dynamicGross > 0 ? dynamicGross : offer.totalPriceGross,
        totalCostNet: computedTotalCost > 0 ? computedTotalCost : offer.totalCostNet,
      },
      items,
      additions,
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

    // Skopiuj wszystkie konstrukcje i zachowaj mapowanie starych ID na nowe ID
    const items = await ctx.db
      .query("offerConstructions")
      .withIndex("by_offer", (q) => q.eq("offerId", args.offerId))
      .collect();

    const constructionIdMap = new Map<string, Id<"offerConstructions">>();

    for (const item of items) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, _creationTime, offerId, ...itemData } = item;
      const newItemId = await ctx.db.insert("offerConstructions", {
        ...itemData,
        offerId: newOfferId,
        createdAt: now,
        updatedAt: now,
      });
      constructionIdMap.set(_id, newItemId);
    }

    // Skopiuj wszystkie dodatki do nowej oferty
    const additions = await ctx.db
      .query("offerAdditions")
      .withIndex("by_offer", (q) => q.eq("offerId", args.offerId))
      .collect();

    for (const add of additions) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, _creationTime, offerId, targetConstructionId, ...addData } = add;
      const newTargetId = targetConstructionId ? constructionIdMap.get(targetConstructionId) : undefined;
      await ctx.db.insert("offerAdditions", {
        ...addData,
        offerId: newOfferId,
        targetConstructionId: newTargetId,
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
    materialCostNet: v.optional(v.number()),
    brushesCostNet: v.optional(v.number()),
    handlesCostNet: v.optional(v.number()),
    materialPriceNet: v.optional(v.number()),
    installationCostNet: v.optional(v.number()),
    installationPriceNet: v.optional(v.number()),
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

    const isTriangle =
      (args.name || construction?.name || "").toLowerCase().includes("trójką") ||
      (construction?.code || "").toLowerCase().includes("trojkat");

    const width = args.widthMm || construction?.defaultWidthMm || (isTriangle ? 3000 : 2880);
    const height = args.heightMm || construction?.defaultHeightMm || (isTriangle ? 600 : 2300);
    const panes = args.panesCount || construction?.defaultPanesCount || (isTriangle ? 1 : 3);
    const paneWidth = Math.round(width / panes);
    const system = args.systemName || construction?.defaultSystem || undefined;
    const color = args.color || construction?.defaultColor || "RAL 7016MAT";
    const fill = args.fillType || construction?.defaultFillType || "HART 10";
    const name =
      args.name ||
      construction?.name ||
      (isTriangle
        ? `Trójkąt podkrokwiowy (B=${width.toLocaleString("pl-PL")}, H=${height.toLocaleString("pl-PL")})`
        : `System całoszklany ${panes}-torowy (B=${width.toLocaleString("pl-PL")}, H=${height.toLocaleString("pl-PL")})`);
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

    // Sprawdź czy szablon posiada warunki cenowe wg wymiaru B (np. trójkąty)
    const matchedRange = construction?.pricingRanges
      ? matchPricingRange(construction.pricingRanges, width)
      : null;

    const baseMaterialCost = matchedRange
      ? (matchedRange.costNet ?? matchedRange.priceNet)
      : (args.materialCostNet ?? construction?.materialCostNet ?? args.costNet ?? 0);

    const baseMaterialPrice = matchedRange
      ? (matchedRange.priceNet && matchedRange.priceNet !== matchedRange.costNet
          ? matchedRange.priceNet
          : (construction?.materialMarkupType === "percent"
              ? Math.round(baseMaterialCost * (1 + (construction.materialMarkupValue || 0) / 100))
              : baseMaterialCost + (construction?.materialMarkupValue || 0)))
      : (args.materialPriceNet ?? construction?.materialPriceNet ?? (args.priceNet ?? construction?.defaultPriceNet ?? 0));

    let baseInstPrice = args.installationPriceNet ?? construction?.installationPriceNet ?? 0;
    let baseInstCost = args.installationCostNet ?? construction?.installationCostNet ?? 0;

    if (construction?.installationUnit === "mb" && args.installationPriceNet === undefined) {
      const rateCost = construction.installationUnitRate ?? 200;
      const rateClient =
        construction.installationMarkupType === "percent"
          ? Math.round(rateCost * (1 + (construction.installationMarkupValue || 0) / 100))
          : rateCost + (construction.installationMarkupValue || 50);
      baseInstCost = Math.round((width / 1000) * rateCost);
      baseInstPrice = Math.round((width / 1000) * rateClient);
    }

    const basePriceNet = args.priceNet ?? (matchedRange ? (baseMaterialPrice + baseInstPrice) : (construction?.defaultPriceNet ?? 0));
    const baseCostNet = args.costNet ?? (matchedRange ? (baseMaterialCost + baseInstCost) : (construction ? (construction.materialCostNet || 0) + (construction.installationCostNet || 0) : 0));

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
      priceNet: basePriceNet,
      costNet: baseCostNet,
      materialCostNet: baseMaterialCost,
      brushesCostNet: args.brushesCostNet ?? construction?.brushesCostNet ?? undefined,
      handlesCostNet: args.handlesCostNet ?? construction?.handlesCostNet ?? undefined,
      materialPriceNet: baseMaterialPrice,
      installationCostNet: baseInstCost,
      installationPriceNet: baseInstPrice,
      pricingTier: matchedRange ? (matchedRange.label || `${matchedRange.minWidthMm}-${matchedRange.maxWidthMm} mm`) : undefined,
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
    materialCostNet: v.optional(v.number()),
    brushesCostNet: v.optional(v.number()),
    handlesCostNet: v.optional(v.number()),
    materialPriceNet: v.optional(v.number()),
    installationCostNet: v.optional(v.number()),
    installationPriceNet: v.optional(v.number()),
    isStandard: v.optional(v.boolean()),
    pricingTier: v.optional(v.string()),
    standardWidthCm: v.optional(v.number()),
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
      // Jeśli nazwa nie została jawnie podana, a zawierała w sobie stare wymiary (np. "1940x2300" lub "1940 × 2300"), zaktualizuj wymiary w nazwie
      if (!fields.name && (fields.widthMm !== undefined || fields.heightMm !== undefined)) {
        const oldDimRegex = new RegExp(`\\b${item.widthMm}\\s*[x×]\\s*${item.heightMm}\\b`, "i");
        if (oldDimRegex.test(item.name)) {
          patch.name = item.name.replace(oldDimRegex, `${newWidth}×${newHeight}`);
        }
      }

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

    const isGlass = isGlassSystemConstruction({
      name: (fields.name as string) ?? item.name,
      shortName: (fields.shortName as string) ?? item.shortName,
      systemName: (fields.systemName as string) ?? item.systemName,
      fillType: (fields.fillType as string) ?? item.fillType,
    });

    if (isGlass && (fields.widthMm !== undefined || fields.heightMm !== undefined)) {
      const calc = calculateGlassSystemPricing(newWidth, newHeight);
      patch.isStandard = fields.isStandard ?? calc.isStandard;
      patch.pricingTier = fields.pricingTier ?? calc.pricingTier;
      patch.standardWidthCm = fields.standardWidthCm ?? calc.standardWidthCm;

      // Jeśli wymiary uległy zmianie i nie podano jawnie nowej ceny ręcznej, przelicz dynamicznie koszty i ceny wg Excela
      if (fields.materialPriceNet === undefined && fields.priceNet === undefined) {
        patch.materialCostNet = calc.materialCostNet;
        patch.brushesCostNet = calc.brushesCostNet;
        patch.handlesCostNet = calc.handlesCostNet;
        patch.materialPriceNet = calc.materialPriceNet;
        patch.installationCostNet = calc.installationCostNet;
        patch.installationPriceNet = calc.installationPriceNet;
        patch.priceNet = calc.priceNet;
        patch.costNet = calc.costNet;
      }
    } else if (fields.widthMm !== undefined) {
      // Obsługa szablonów z cennikiem schodkowym (np. trójkąty tarasowe lewe i prawe)
      let tpl = item.constructionId ? await ctx.db.get(item.constructionId) : null;
      if (!tpl) {
        const allConstructions = await ctx.db.query("constructions").collect();
        const short = (item.shortName || "").trim().toLowerCase();
        const name = (item.name || "").trim().toLowerCase();
        tpl =
          allConstructions.find((c) => {
            const code = (c.code || "").trim().toLowerCase();
            const cName = (c.name || "").trim().toLowerCase();
            return (
              (code && (short === code || name.includes(code))) ||
              (cName && (short === cName || name === cName))
            );
          }) || null;
      }

      if (tpl?.pricingRanges && tpl.pricingRanges.length > 0) {
        const matched = matchPricingRange(tpl.pricingRanges, newWidth);
        if (matched && fields.materialPriceNet === undefined && fields.priceNet === undefined) {
          let instPrice = (fields.installationPriceNet as number | undefined) ?? item.installationPriceNet ?? 0;
          let instCost = (fields.installationCostNet as number | undefined) ?? item.installationCostNet ?? 0;
          if (tpl.installationUnit === "mb" && fields.installationPriceNet === undefined) {
            const rateCost = tpl.installationUnitRate ?? 200;
            const rateClient =
              tpl.installationMarkupType === "percent"
                ? Math.round(rateCost * (1 + (tpl.installationMarkupValue || 0) / 100))
                : rateCost + (tpl.installationMarkupValue || 50);
            instCost = Math.round((newWidth / 1000) * rateCost);
            instPrice = Math.round((newWidth / 1000) * rateClient);
            patch.installationPriceNet = instPrice;
            patch.installationCostNet = instCost;
          }
          const matCost = matched.costNet ?? matched.priceNet;
          const matPrice =
            matched.priceNet && matched.priceNet !== matched.costNet
              ? matched.priceNet
              : (tpl.materialMarkupType === "percent"
                  ? Math.round(matCost * (1 + (tpl.materialMarkupValue || 0) / 100))
                  : matCost + (tpl.materialMarkupValue || 0));
          patch.materialPriceNet = matPrice;
          patch.materialCostNet = matCost;
          patch.priceNet = matPrice + instPrice;
          patch.costNet = matCost + instCost;
          patch.pricingTier = matched.label || `${matched.minWidthMm}-${matched.maxWidthMm} mm`;
        }
      }
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
 * Dodaje dodatek / akcesorium do oferty
 */
export const addOfferAddition = mutation({
  args: {
    offerId: v.id("offers"),
    targetConstructionId: v.optional(v.union(v.id("offerConstructions"), v.null())),
    templateId: v.optional(v.id("offerAdditionTemplates")),
    sourceTemplateId: v.optional(v.id("offerAdditionTemplates")),
    name: v.string(),
    quantity: v.number(),
    unit: v.optional(v.string()),
    priceNet: v.number(),
    costNet: v.optional(v.number()),
    installationPriceNet: v.optional(v.number()),
    installationCostNet: v.optional(v.number()),
    notes: v.optional(v.string()),
    description: v.optional(v.string()),
    orderIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const offer = await ctx.db.get(args.offerId);
    if (!offer) throw new Error("Oferta nie znaleziona");

    const existing = await ctx.db
      .query("offerAdditions")
      .withIndex("by_offer", (q) => q.eq("offerId", args.offerId))
      .collect();

    const orderIndex = args.orderIndex ?? (existing.length + 1);
    const resolvedTemplateId = args.templateId ?? args.sourceTemplateId;
    const resolvedNotes = (args.notes ?? args.description)?.trim() || undefined;

    const additionId = await ctx.db.insert("offerAdditions", {
      offerId: args.offerId,
      targetConstructionId: args.targetConstructionId ?? undefined,
      templateId: resolvedTemplateId,
      name: args.name.trim(),
      quantity: args.quantity > 0 ? args.quantity : 1,
      unit: args.unit?.trim() || "szt.",
      priceNet: args.priceNet,
      costNet: args.costNet,
      installationPriceNet: args.installationPriceNet,
      installationCostNet: args.installationCostNet,
      notes: resolvedNotes,
      orderIndex,
      createdAt: Date.now(),
    });

    await recalculateOffer(ctx, args.offerId);
    return additionId;
  },
});

/**
 * Aktualizuje dodatek w ofercie
 */
export const updateOfferAddition = mutation({
  args: {
    id: v.id("offerAdditions"),
    targetConstructionId: v.optional(v.union(v.id("offerConstructions"), v.null())),
    templateId: v.optional(v.id("offerAdditionTemplates")),
    sourceTemplateId: v.optional(v.id("offerAdditionTemplates")),
    name: v.optional(v.string()),
    quantity: v.optional(v.number()),
    unit: v.optional(v.string()),
    priceNet: v.optional(v.number()),
    costNet: v.optional(v.number()),
    installationPriceNet: v.optional(v.number()),
    installationCostNet: v.optional(v.number()),
    notes: v.optional(v.string()),
    description: v.optional(v.string()),
    orderIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const addition = await ctx.db.get(args.id);
    if (!addition) throw new Error("Dodatek nie został znaleziony");

    const patch: Partial<Doc<"offerAdditions">> = {
      updatedAt: Date.now(),
    };

    if (args.targetConstructionId !== undefined) {
      patch.targetConstructionId = args.targetConstructionId ?? undefined;
    }
    if (args.templateId !== undefined || args.sourceTemplateId !== undefined) {
      patch.templateId = (args.templateId ?? args.sourceTemplateId) ?? undefined;
    }
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.quantity !== undefined) patch.quantity = args.quantity > 0 ? args.quantity : 1;
    if (args.unit !== undefined) patch.unit = args.unit.trim();
    if (args.priceNet !== undefined) patch.priceNet = args.priceNet;
    if (args.costNet !== undefined) patch.costNet = args.costNet;
    if (args.installationPriceNet !== undefined) patch.installationPriceNet = args.installationPriceNet;
    if (args.installationCostNet !== undefined) patch.installationCostNet = args.installationCostNet;
    if (args.notes !== undefined || args.description !== undefined) {
      patch.notes = (args.notes ?? args.description)?.trim() || undefined;
    }
    if (args.orderIndex !== undefined) patch.orderIndex = args.orderIndex;

    await ctx.db.patch(args.id, patch);
    await recalculateOffer(ctx, addition.offerId);
    return args.id;
  },
});

/**
 * Usuwa dodatek z oferty
 */
export const removeOfferAddition = mutation({
  args: {
    id: v.id("offerAdditions"),
  },
  handler: async (ctx, args) => {
    const addition = await ctx.db.get(args.id);
    if (!addition) throw new Error("Dodatek nie został znaleziony");

    await ctx.db.delete(args.id);
    await recalculateOffer(ctx, addition.offerId);
    return true;
  },
});

/**
 * Zmienia kolejność dodatków w ofercie
 */
export const reorderOfferAdditions = mutation({
  args: {
    offerId: v.id("offers"),
    additionIds: v.array(v.id("offerAdditions")),
  },
  handler: async (ctx, args) => {
    for (let i = 0; i < args.additionIds.length; i++) {
      await ctx.db.patch(args.additionIds[i], {
        orderIndex: i + 1,
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
 * Synchronizuje pozycje oferty z aktualnymi cenami i kosztami z bazy szablonów konstrukcji
 */
export const syncOfferWithConstructionTemplates = mutation({
  args: {
    offerId: v.id("offers"),
  },
  handler: async (ctx, args) => {
    const rawItems = await ctx.db
      .query("offerConstructions")
      .withIndex("by_offer", (q) => q.eq("offerId", args.offerId))
      .collect();

    const allConstructions = await ctx.db.query("constructions").collect();

    let updatedCount = 0;
    for (const item of rawItems) {
      let tpl: Doc<"constructions"> | null = null;
      if (item.constructionId) {
        tpl = await ctx.db.get(item.constructionId);
      }
      if (!tpl) {
        const short = (item.shortName || "").trim().toLowerCase();
        const name = (item.name || "").trim().toLowerCase();
        tpl =
          allConstructions.find((c) => {
            const code = (c.code || "").trim().toLowerCase();
            const cName = (c.name || "").trim().toLowerCase();
            return (
              (code && (short === code || name.includes(code))) ||
              (cName && (short === cName || name === cName))
            );
          }) || null;
      }

      const isGlass =
        isGlassSystemConstruction({
          name: item.name,
          shortName: item.shortName,
          systemName: item.systemName,
          fillType: item.fillType,
        }) ||
        (tpl?.category || "").toLowerCase().includes("szkl");

      if (tpl?.pricingRanges && tpl.pricingRanges.length > 0 && typeof item.widthMm === "number") {
        const matched = matchPricingRange(tpl.pricingRanges, item.widthMm);
        if (matched) {
          let instPrice = item.installationPriceNet ?? tpl.installationPriceNet ?? 0;
          let instCost = item.installationCostNet ?? tpl.installationCostNet ?? 0;
          if (tpl.installationUnit === "mb") {
            const rateCost = tpl.installationUnitRate ?? 200;
            const rateClient =
              tpl.installationMarkupType === "percent"
                ? Math.round(rateCost * (1 + (tpl.installationMarkupValue || 0) / 100))
                : rateCost + (tpl.installationMarkupValue || 50);
            instCost = Math.round((item.widthMm / 1000) * rateCost);
            instPrice = Math.round((item.widthMm / 1000) * rateClient);
          }
          const matCost = matched.costNet ?? matched.priceNet;
          const matPrice =
            matched.priceNet && matched.priceNet !== matched.costNet
              ? matched.priceNet
              : (tpl.materialMarkupType === "percent"
                  ? Math.round(matCost * (1 + (tpl.materialMarkupValue || 0) / 100))
                  : matCost + (tpl.materialMarkupValue || 0));
          await ctx.db.patch(item._id, {
            constructionId: tpl._id,
            materialCostNet: matCost,
            materialPriceNet: matPrice,
            installationCostNet: instCost,
            installationPriceNet: instPrice,
            priceNet: matPrice + instPrice,
            costNet: matCost + instCost,
            pricingTier: matched.label || `${matched.minWidthMm}-${matched.maxWidthMm} mm`,
            updatedAt: Date.now(),
          });
          updatedCount++;
          continue;
        }
      }

      const useTemplateDirectly =
        Boolean(tpl) &&
        (tpl!.materialPriceNet !== undefined || tpl!.materialCostNet !== undefined) &&
        (!isGlass ||
          (Boolean(tpl!.defaultWidthMm) &&
            tpl!.defaultWidthMm === item.widthMm &&
            checkIsStandard(Math.round(item.widthMm / 10), Math.round(item.heightMm / 10)).isStandard));

      if (useTemplateDirectly && tpl) {
        const matCost = tpl.materialCostNet ?? (item.costNet || 0);
        const matPrice = tpl.materialPriceNet ?? (item.priceNet || 0);
        let instCost = tpl.installationCostNet ?? 0;
        let instPrice = tpl.installationPriceNet ?? 0;

        if (isGlass && (instPrice === 1373 || instPrice === 3093)) {
          const calc = calculateGlassSystemPricing(item.widthMm, item.heightMm);
          instCost = calc.installationCostNet;
          instPrice = calc.installationPriceNet;
        }

        const combinedPrice =
          (matPrice + instPrice) > 0
            ? matPrice + instPrice
            : (tpl.defaultPriceNet ?? item.priceNet);
        const combinedCost =
          (matCost + instCost) > 0
            ? matCost + instCost
            : item.costNet;

        await ctx.db.patch(item._id, {
          constructionId: tpl._id,
          materialCostNet: matCost,
          brushesCostNet: tpl.brushesCostNet,
          handlesCostNet: tpl.handlesCostNet,
          materialPriceNet: matPrice,
          installationCostNet: instCost,
          installationPriceNet: instPrice,
          priceNet: combinedPrice,
          costNet: combinedCost,
          updatedAt: Date.now(),
        });
        updatedCount++;
      } else if (isGlass) {
        const calc = calculateGlassSystemPricing(item.widthMm, item.heightMm);
        await ctx.db.patch(item._id, {
          constructionId: tpl?._id ?? item.constructionId,
          isStandard: calc.isStandard,
          pricingTier: calc.pricingTier,
          standardWidthCm: calc.standardWidthCm,
          materialCostNet: calc.materialCostNet,
          brushesCostNet: calc.brushesCostNet,
          handlesCostNet: calc.handlesCostNet,
          materialPriceNet: calc.materialPriceNet,
          installationCostNet: calc.installationCostNet,
          installationPriceNet: calc.installationPriceNet,
          priceNet: calc.priceNet,
          costNet: calc.costNet,
          updatedAt: Date.now(),
        });
        if (tpl && (tpl.installationPriceNet === 1373 || tpl.installationPriceNet === 3093 || tpl.installationPriceNet === undefined)) {
          await ctx.db.patch(tpl._id, {
            installationPriceNet: calc.installationPriceNet,
            installationCostNet: calc.installationCostNet,
            defaultPriceNet: calc.priceNet,
            materialPriceNet: calc.materialPriceNet,
            materialCostNet: calc.materialCostNet,
            brushesCostNet: calc.brushesCostNet,
            handlesCostNet: calc.handlesCostNet,
            updatedAt: Date.now(),
          });
        }
        updatedCount++;
      }
    }

    await recalculateOffer(ctx, args.offerId);
    return { updatedCount };
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

  let totalCost = 0;
  let materialNet = 0;
  let installationNet = 0;

  for (const it of items) {
    const q = it.quantity || 1;
    const isGlass = isGlassSystemConstruction({
      name: it.name,
      shortName: it.shortName,
      systemName: it.systemName,
      fillType: it.fillType,
    });
    let instPrice = it.installationPriceNet ?? 0;
    let cost = it.costNet || 0;
    let price = it.priceNet || 0;
    let matCost = it.materialCostNet;
    let matPrice = it.materialPriceNet;

    const stdCheck =
      isGlass && typeof it.widthMm === "number" && typeof it.heightMm === "number"
        ? checkIsStandard(Math.round(it.widthMm / 10), Math.round(it.heightMm / 10))
        : null;

    const isGlassNeedsRecalc =
      isGlass &&
      typeof it.widthMm === "number" &&
      typeof it.heightMm === "number" &&
      (instPrice === 1373 ||
        instPrice === 3093 ||
        instPrice === Math.round(250 * (it.widthMm / 1000)) + 50 ||
        (!stdCheck?.isStandard && (matPrice === 8626 || price === 10213)) ||
        matPrice === undefined);

    if (isGlassNeedsRecalc) {
      const calc = calculateGlassSystemPricing(it.widthMm, it.heightMm);
      instPrice = calc.installationPriceNet;
      cost = calc.costNet;
      price = calc.priceNet;
      matCost = calc.materialCostNet;
      matPrice = calc.materialPriceNet;

      await ctx.db.patch(it._id, {
        isStandard: calc.isStandard,
        pricingTier: calc.pricingTier,
        standardWidthCm: calc.standardWidthCm,
        installationPriceNet: calc.installationPriceNet,
        installationCostNet: calc.installationCostNet,
        materialPriceNet: calc.materialPriceNet,
        materialCostNet: calc.materialCostNet,
        brushesCostNet: calc.brushesCostNet,
        handlesCostNet: calc.handlesCostNet,
        priceNet: calc.priceNet,
        costNet: calc.costNet,
        updatedAt: Date.now(),
      });
    }

    totalCost += (matCost !== undefined && it.installationCostNet !== undefined ? matCost + it.installationCostNet : cost) * q;
    if (matPrice !== undefined && matPrice !== null) {
      materialNet += matPrice * q;
    } else {
      const inst = instPrice * q;
      materialNet += Math.max(0, price * q - inst);
    }
    installationNet += instPrice * q;
  }

  const additions = await ctx.db
    .query("offerAdditions")
    .withIndex("by_offer", (q) => q.eq("offerId", offerId))
    .collect();

  let additionsNet = 0;
  for (const add of additions) {
    const q = add.quantity || 1;
    const addPrice = (add.priceNet || 0) * q;
    const addCost = (add.costNet || 0) * q;
    const addInstPrice = (add.installationPriceNet || 0) * q;
    const addInstCost = (add.installationCostNet || 0) * q;

    additionsNet += addPrice;
    installationNet += addInstPrice;
    totalCost += addCost + addInstCost;
  }

  const discount = offer.discountPercent || 0;
  const vatRate = offer.vatRate ?? 23;
  // Rabat naliczany jest od wartości konstrukcji i dodatków (montaż pozostaje bez rabatu)
  const discountedBase = Math.round((materialNet + additionsNet) * (1 - discount / 100));
  const finalNet = discountedBase + installationNet;
  const finalGross = Math.round(finalNet * (1 + vatRate / 100));

  await ctx.db.patch(offerId, {
    totalPriceNet: finalNet,
    totalPriceGross: finalGross,
    totalCostNet: totalCost,
    updatedAt: Date.now(),
  });

  // Synchronizuj wyliczoną kwotę z szansą sprzedaży (jeśli istnieje w bazie)
  if (offer.opportunityId) {
    const opp = await ctx.db.get(offer.opportunityId);
    if (opp) {
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

