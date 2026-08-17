import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole, requireUser } from "./lib/auth";
import {
  CORE_STATUS_KEYS,
  resolveStatuses,
  type StatusDef,
} from "../lib/statuses";

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
