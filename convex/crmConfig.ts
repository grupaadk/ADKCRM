import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireRole, requireUser } from "./lib/auth";
import {
  CORE_STATUS_KEYS,
  resolveStatuses,
  type StatusDef,
} from "../lib/statuses";
import { GLASS_PRICING_CONFIG } from "../lib/glassPricing";
import { ROOF_PRICING_CONFIG } from "../lib/roofPricing";
import { getTrianglePricingRanges } from "../lib/pricingRanges";

// Walidator pojedynczego wpisu rejestru (zgodny ze schema crmConfig.statuses).
const statusDefValidator = v.object({
  key: v.string(),
  label: v.string(),
  color: v.string(),
  sortOrder: v.number(),
  hidden: v.boolean(),
  isCore: v.boolean(),
  kind: v.union(v.literal("opportunity"), v.literal("order")),
});

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const CORE_KEY_SET = new Set(CORE_STATUS_KEYS);

export const getConfig = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("crmConfig").first();
  },
});

/**
 * Kanoniczny odczyt rejestru statusów (dla całej warstwy prezentacji i walidacji).
 * Łączy zapisany rejestr z domyślnymi z kodu + migruje stare statusLabels.
 */
export const listStatuses = query({
  args: {},
  handler: async (ctx): Promise<StatusDef[]> => {
    const config = await ctx.db.query("crmConfig").first();
    return resolveStatuses(
      config?.statuses as StatusDef[] | undefined,
      config?.statusLabels,
    );
  },
});

/** Liczba zleceń w każdym statusie (zasila licznik i blokadę usuwania w UI). */
export const statusUsageCounts = query({
  args: {},
  handler: async (ctx): Promise<Record<string, number>> => {
    await requireUser(ctx);
    const orders = await ctx.db.query("orders").collect();
    const counts: Record<string, number> = {};
    for (const o of orders) {
      counts[o.status] = (counts[o.status] ?? 0) + 1;
    }
    return counts;
  },
});

/**
 * Zapisuje cały rejestr (rename + kolor + kolejność + ukrywanie w jednym zapisie).
 * Tylko admin. Waliduje unikalność, obecność wszystkich kluczy bazowych, kolory.
 */
export const saveStatuses = mutation({
  args: { statuses: v.array(statusDefValidator) },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    const keys = args.statuses.map((s) => s.key);
    if (new Set(keys).size !== keys.length) {
      throw new ConvexError("Klucze statusów muszą być unikalne");
    }
    // Wszystkie statusy bazowe muszą zostać (nie można ich usunąć).
    for (const coreKey of CORE_STATUS_KEYS) {
      if (!keys.includes(coreKey)) {
        throw new ConvexError(`Nie można usunąć statusu bazowego: ${coreKey}`);
      }
    }
    for (const s of args.statuses) {
      if (!s.label.trim()) {
        throw new ConvexError("Nazwa statusu nie może być pusta");
      }
      if (!HEX_RE.test(s.color)) {
        throw new ConvexError(`Nieprawidłowy kolor: ${s.color}`);
      }
    }

    // Re-stempluj isCore wg kodu (klient nie może oznaczyć custom jako core).
    const normalized: StatusDef[] = args.statuses.map((s) => ({
      ...s,
      isCore: CORE_KEY_SET.has(s.key),
    }));

    const existing = await ctx.db.query("crmConfig").first();

    // Guard: nie pozwól usunąć (przez pominięcie w nowej liście) statusu, który
    // jest jeszcze używany przez jakieś zlecenie — inaczej osierocilibyśmy dane.
    const prev = resolveStatuses(
      existing?.statuses as StatusDef[] | undefined,
      existing?.statusLabels,
    );
    const newKeys = new Set(keys);
    for (const p of prev) {
      if (newKeys.has(p.key) || CORE_KEY_SET.has(p.key)) continue;
      const inUse = await ctx.db
        .query("orders")
        .withIndex("by_status", (q) => q.eq("status", p.key))
        .collect();
      if (inUse.length > 0) {
        throw new ConvexError(
          `Status "${p.label}": ${inUse.length} ${inUse.length === 1 ? "zlecenie używa" : "zleceń używa"} go — najpierw przenieś je do innego statusu`,
        );
      }
    }

    if (existing) {
      await ctx.db.patch(existing._id, { statuses: normalized });
    } else {
      await ctx.db.insert("crmConfig", { statuses: normalized });
    }
  },
});

export const setStatusesInternal = internalMutation({
  args: { statuses: v.array(statusDefValidator) },
  handler: async (ctx, args) => {
    const normalized: StatusDef[] = args.statuses.map((s) => ({
      ...s,
      isCore: CORE_KEY_SET.has(s.key),
    }));
    const existing = await ctx.db.query("crmConfig").first();
    if (existing) {
      await ctx.db.patch(existing._id, { statuses: normalized });
    } else {
      await ctx.db.insert("crmConfig", { statuses: normalized });
    }
    return normalized.length;
  },
});

const DESIRED_ORDER: Record<string, number> = {
  lead: 0,
  inquiry: 1,
  measurement: 2,
  offer: 3,
  contract: 4,
  production: 5,
  kitting: 6,
  installation: 7,
  custom_nowy_status: 8,
  complaint: 9,
  acceptance: 10,
  invoicing: 11,
  completed: 12,
  archived: 13,
};

export const syncStatuses = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("crmConfig").first();
    const resolved = resolveStatuses(
      existing?.statuses as StatusDef[] | undefined,
      existing?.statusLabels,
    );
    const sorted = resolved
      .sort((a, b) => {
        const orderA = DESIRED_ORDER[a.key] ?? 99;
        const orderB = DESIRED_ORDER[b.key] ?? 99;
        return orderA - orderB;
      })
      .map((s, index) => ({
        ...s,
        sortOrder: index,
      }));
    if (existing) {
      await ctx.db.patch(existing._id, { statuses: sorted });
    } else {
      await ctx.db.insert("crmConfig", { statuses: sorted });
    }
    return sorted;
  },
});

// ── Legacy (deprecated — do usunięcia po pełnej migracji na `statuses`) ──
export const saveStatusLabels = mutation({
  args: {
    statusLabels: v.object({
      lead: v.optional(v.string()),
      inquiry: v.optional(v.string()),
      measurement: v.optional(v.string()),
      offer: v.optional(v.string()),
      contract: v.optional(v.string()),
      production: v.optional(v.string()),
      installation: v.optional(v.string()),
      completed: v.optional(v.string()),
      complaint: v.optional(v.string()),
      kitting: v.optional(v.string()),
      archived: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");
    const existing = await ctx.db.query("crmConfig").first();
    if (existing) {
      await ctx.db.patch(existing._id, { statusLabels: args.statusLabels });
    } else {
      await ctx.db.insert("crmConfig", { statusLabels: args.statusLabels });
    }
  },
});

export const resetStatusLabels = mutation({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, "admin");
    const existing = await ctx.db.query("crmConfig").first();
    if (existing) {
      await ctx.db.patch(existing._id, { statusLabels: {} });
    }
  },
});

export const saveGoogleDriveFoldersConfig = mutation({
  args: {
    googleDriveFolders: v.object({
      opportunity: v.object({
        valuationFiles: v.string(),
        offersReceived: v.string(),
        offersSent: v.string(),
        ponzioFiles: v.string(),
        customSubfolders: v.array(v.string()),
      }),
      order: v.object({
        invoices: v.string(),
        documents: v.string(),
        measurements: v.string(),
        customSubfolders: v.array(v.string()),
        documentTypeRoutes: v.optional(v.record(v.string(), v.string())),
      }),
    }),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");
    const existing = await ctx.db.query("crmConfig").first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        googleDriveFolders: args.googleDriveFolders,
      });
    } else {
      await ctx.db.insert("crmConfig", {
        googleDriveFolders: args.googleDriveFolders,
      });
    }
  },
});

const DEFAULT_GLASS_MARKUP_PERCENT = Math.round(
  (GLASS_PRICING_CONFIG.materialMarkupMultiplier - 1) * 100
);
const DEFAULT_ROOF_MARKUP_PERCENT = Math.round(
  (ROOF_PRICING_CONFIG.materialMarkupMultiplier - 1) * 100
);

/**
 * Zwraca aktywną konfigurację narzutu na materiał (osobno dla zabudowy szklanej/trójkątów
 * oraz zadaszeń aluminiowych). Gdy nie zapisano w bazie, zwraca domyślne 52% (1.52).
 */
export const getPricingConfig = query({
  args: {},
  handler: async (ctx) => {
    const config = await ctx.db.query("crmConfig").first();
    const glassPercent =
      config?.pricingConfig?.glassMaterialMarkupPercent ??
      DEFAULT_GLASS_MARKUP_PERCENT;
    const roofPercent =
      config?.pricingConfig?.roofMaterialMarkupPercent ??
      DEFAULT_ROOF_MARKUP_PERCENT;

    return {
      glassMaterialMarkupPercent: glassPercent,
      roofMaterialMarkupPercent: roofPercent,
      glassMaterialMarkupMultiplier: 1 + glassPercent / 100,
      roofMaterialMarkupMultiplier: 1 + roofPercent / 100,
    };
  },
});

/**
 * Zapisuje procentowy narzut na materiał dla zabudowy szklanej/trójkątów oraz zadaszeń.
 * Tylko admin. Synchronizuje też progi cenowe szablonów trójkątów w tabeli constructions.
 */
export const savePricingConfig = mutation({
  args: {
    glassMaterialMarkupPercent: v.number(),
    roofMaterialMarkupPercent: v.number(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    if (
      !Number.isFinite(args.glassMaterialMarkupPercent) ||
      args.glassMaterialMarkupPercent < 0 ||
      args.glassMaterialMarkupPercent > 500
    ) {
      throw new ConvexError(
        "Narzut na materiał dla zabudowy musi być liczbą z zakresu 0–500%"
      );
    }
    if (
      !Number.isFinite(args.roofMaterialMarkupPercent) ||
      args.roofMaterialMarkupPercent < 0 ||
      args.roofMaterialMarkupPercent > 500
    ) {
      throw new ConvexError(
        "Narzut na materiał dla zadaszeń musi być liczbą z zakresu 0–500%"
      );
    }

    const glassPercent = Math.round(args.glassMaterialMarkupPercent * 100) / 100;
    const roofPercent = Math.round(args.roofMaterialMarkupPercent * 100) / 100;
    const pricingConfig = {
      glassMaterialMarkupPercent: glassPercent,
      roofMaterialMarkupPercent: roofPercent,
    };

    const existing = await ctx.db.query("crmConfig").first();
    if (existing) {
      await ctx.db.patch(existing._id, { pricingConfig });
    } else {
      await ctx.db.insert("crmConfig", { pricingConfig });
    }

    // Zsynchronizuj szablony trójkątów (LEWY / PRAWY) z nowym narzutem zabudowy
    const glassMultiplier = 1 + glassPercent / 100;
    const updatedTriangleRanges = getTrianglePricingRanges(glassMultiplier);
    const allConstructions = await ctx.db.query("constructions").collect();
    const now = Date.now();
    for (const c of allConstructions) {
      if (c.code === "TROJKAT-TARAS-L" || c.code === "TROJKAT-TARAS-P") {
        const baseMatCost = c.materialCostNet ?? 854;
        const nextMatPrice = Math.round(baseMatCost * glassMultiplier);
        const instPrice =
          c.installationPriceNet ??
          Math.round(((c.defaultWidthMm || 3000) / 1000) * 250);
        await ctx.db.patch(c._id, {
          materialMarkupType: "percent",
          materialMarkupValue: glassPercent,
          materialPriceNet: nextMatPrice,
          defaultPriceNet: nextMatPrice + instPrice,
          pricingRanges: updatedTriangleRanges,
          updatedAt: now,
        });
      }
    }

    return {
      glassMaterialMarkupPercent: glassPercent,
      roofMaterialMarkupPercent: roofPercent,
      glassMaterialMarkupMultiplier: glassMultiplier,
      roofMaterialMarkupMultiplier: 1 + roofPercent / 100,
    };
  },
});
