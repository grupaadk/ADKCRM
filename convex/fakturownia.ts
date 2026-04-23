import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { api, internal } from "./_generated/api";
import { encrypt, decrypt } from "./lib/crypto";

function getEnvApiToken(): string | null {
  const t = process.env.FAKTUROWNIA_API_TOKEN?.trim();
  return t || null;
}

function getEnvSubdomain(): string | null {
  const s = process.env.FAKTUROWNIA_SUBDOMAIN?.trim().toLowerCase();
  return s || null;
}

function apiBase(subdomain: string): string {
  const s = subdomain.trim().toLowerCase().replace(/\.fakturownia\.pl$/i, "");
  return `https://${s}.fakturownia.pl`;
}

const fakturowniaInvoiceEntry = v.object({
  kind: v.union(v.literal("advance"), v.literal("final"), v.literal("vat")),
  remoteId: v.string(),
  number: v.optional(v.string()),
  grossAmount: v.optional(v.number()),
  advancePercent: v.optional(v.number()),
  createdAt: v.number(),
});

// ─── Config ─────────────────────────────────────────────────────────────────

export const getConfig = query({
  args: {},
  handler: async (ctx) => {
    const envToken = getEnvApiToken();
    const envSub = getEnvSubdomain();
    const row = await ctx.db.query("fakturowniaConfig").first();
    if (!row && !envToken) return null;
    return {
      subdomain: row?.subdomain ?? envSub ?? "",
      departmentId: row?.departmentId,
      hasApiToken: !!row?.apiToken || !!envToken,
      usingEnvToken: !!envToken,
    };
  },
});

export const getConfigInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("fakturowniaConfig").first();
  },
});

export const saveConfig = mutation({
  args: {
    subdomain: v.string(),
    departmentId: v.optional(v.string()),
    encryptedApiToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? "anonymous";
    const envToken = getEnvApiToken();
    const existing = await ctx.db.query("fakturowniaConfig").first();

    const sub = args.subdomain.trim().toLowerCase().replace(/\.fakturownia\.pl$/i, "");
    if (!sub && !getEnvSubdomain()) {
      throw new Error("Podaj subdomenę Fakturowni (np. moja-firma)");
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        subdomain: sub || existing.subdomain,
        departmentId: args.departmentId,
        ...(args.encryptedApiToken !== undefined
          ? { apiToken: args.encryptedApiToken }
          : {}),
      });
    } else {
      if (!args.encryptedApiToken && !envToken) {
        throw new Error("Brak tokena API — uzupełnij lub ustaw FAKTUROWNIA_API_TOKEN");
      }
      await ctx.db.insert("fakturowniaConfig", {
        apiToken: args.encryptedApiToken ?? "",
        subdomain: sub || (getEnvSubdomain() ?? ""),
        departmentId: args.departmentId,
        connectedBy: userId,
      });
    }
  },
});

export const encryptApiToken = action({
  args: { apiToken: v.string() },
  handler: async (_ctx, args): Promise<string> => {
    return await encrypt(args.apiToken);
  },
});

async function getDecryptedToken(ctx: Pick<ActionCtx, "runQuery">): Promise<string | null> {
  const env = getEnvApiToken();
  if (env) return env;
  const row = await ctx.runQuery(internal.fakturownia.getConfigInternal, {});
  if (!row?.apiToken) return null;
  return await decrypt(row.apiToken);
}

async function resolveSubdomain(ctx: Pick<ActionCtx, "runQuery">): Promise<string | null> {
  const env = getEnvSubdomain();
  if (env) return env;
  const row = await ctx.runQuery(internal.fakturownia.getConfigInternal, {});
  return row?.subdomain?.trim() ? row.subdomain.trim().toLowerCase() : null;
}

function buyerStreet(client: Doc<"clients">): string {
  const base = [client.street, client.buildingNumber].filter(Boolean).join(" ");
  if (client.apartmentNumber) {
    return base ? `${base}/${client.apartmentNumber}` : client.apartmentNumber;
  }
  return base;
}

function lineItemGross(item: {
  quantity: number;
  unitPrice: number;
  vatRate: number;
  discountPercent?: number;
}): number {
  const discount = item.discountPercent ?? 0;
  const net = item.quantity * item.unitPrice * (1 - discount / 100);
  return Math.round(net * (1 + item.vatRate / 100) * 100) / 100;
}

function extractCreatedInvoice(json: Record<string, unknown>): {
  id: string;
  number?: string;
  grossAmount?: number;
} {
  const inv = (json.invoice as Record<string, unknown> | undefined) ?? json;
  const rawId = inv.id;
  const id =
    typeof rawId === "number"
      ? String(rawId)
      : typeof rawId === "string"
        ? rawId
        : "";
  if (!id) throw new Error("Brak ID w odpowiedzi Fakturowni");
  const number = typeof inv.number === "string" ? inv.number : undefined;
  const grossRaw = inv.price_gross ?? inv.total_price_gross;
  let grossAmount: number | undefined;
  if (typeof grossRaw === "number") grossAmount = grossRaw;
  else if (typeof grossRaw === "string") {
    const n = parseFloat(grossRaw.replace(",", "."));
    if (!Number.isNaN(n)) grossAmount = n;
  }
  return { id, number, grossAmount };
}

async function callInvoiceApi(
  method: "POST" | "PUT",
  url: string,
  apiToken: string,
  invoice: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ api_token: apiToken, invoice }),
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Fakturownia: niepoprawna odpowiedź (${res.status}): ${text.slice(0, 500)}`);
  }
  if (!res.ok) {
    let msg: string;
    if (typeof data === "object" && data !== null) {
      if ("message" in data) {
        const m = (data as { message: unknown }).message;
        msg = typeof m === "string" ? m : JSON.stringify(m);
      } else {
        msg = JSON.stringify(data).slice(0, 500);
      }
    } else {
      msg = text.slice(0, 500);
    }
    throw new Error(`Fakturownia API (${res.status}): ${msg}`);
  }
  return data as Record<string, unknown>;
}

async function postInvoice(
  baseUrl: string,
  apiToken: string,
  invoice: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return callInvoiceApi("POST", `${baseUrl}/invoices.json`, apiToken, invoice);
}

async function putInvoice(
  baseUrl: string,
  apiToken: string,
  invoiceId: string,
  invoice: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return callInvoiceApi("PUT", `${baseUrl}/invoices/${invoiceId}.json`, apiToken, invoice);
}

async function checkInvoiceExists(baseUrl: string, apiToken: string, invoiceId: string): Promise<boolean> {
  const res = await fetch(
    `${baseUrl}/invoices/${invoiceId}.json?api_token=${encodeURIComponent(apiToken)}`,
    { headers: { Accept: "application/json" } },
  );
  return res.ok;
}

export const testConnection = action({
  args: { apiToken: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ ok: boolean; error?: string }> => {
    const token = args.apiToken?.trim() || (await getDecryptedToken(ctx));
    const sub = await resolveSubdomain(ctx);
    if (!token) return { ok: false, error: "Brak tokena API" };
    if (!sub) return { ok: false, error: "Brak subdomeny" };
    try {
      const url = `${apiBase(sub)}/invoices.json?api_token=${encodeURIComponent(token)}&per_page=1`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) {
        const t = await res.text();
        return { ok: false, error: `HTTP ${res.status}: ${t.slice(0, 200)}` };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Błąd sieci" };
    }
  },
});

// ─── Internal: persist order state ─────────────────────────────────────────

export const setFakturowniaEstimate = internalMutation({
  args: {
    orderId: v.id("orders"),
    estimateId: v.string(),
    estimateNumber: v.optional(v.string()),
    oid: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Zlecenie nie znalezione");
    await ctx.db.patch(args.orderId, {
      fakturownia: {
        estimateId: args.estimateId,
        estimateNumber: args.estimateNumber,
        oid: args.oid,
        estimateSyncedAt: Date.now(),
        invoices: [],
      },
    });
  },
});

export const updateFakturowniaEstimate = internalMutation({
  args: {
    orderId: v.id("orders"),
    estimateId: v.string(),
    estimateNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Zlecenie nie znalezione");
    await ctx.db.patch(args.orderId, {
      fakturownia: {
        ...(order.fakturownia ?? { invoices: [] }),
        estimateId: args.estimateId,
        estimateNumber: args.estimateNumber,
        estimateSyncedAt: Date.now(),
      },
    });
  },
});

export const appendFakturowniaInvoice = internalMutation({
  args: {
    orderId: v.id("orders"),
    entry: fakturowniaInvoiceEntry,
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Zlecenie nie znalezione");
    const fk = order.fakturownia;
    const prev = fk?.invoices ?? [];
    await ctx.db.patch(args.orderId, {
      fakturownia: fk
        ? { ...fk, invoices: [...prev, args.entry] }
        : { invoices: [args.entry] },
    });
  },
});

// ─── CRM → Fakturownia validation ──────────────────────────────────────────

function validateNip(nip: string): boolean {
  const digits = nip.replace(/[\s-]/g, "");
  if (!/^\d{10}$/.test(digits)) return false;
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = weights.reduce((acc, w, i) => acc + w * parseInt(digits[i], 10), 0);
  return sum % 11 === parseInt(digits[9], 10);
}

function validateClientForFakturownia(client: Doc<"clients">): void {
  const buyerName = `${client.firstName} ${client.lastName}`.trim();
  if (!buyerName) {
    throw new Error("Klient musi mieć imię lub nazwisko — uzupełnij dane w CRM.");
  }

  if (client.email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email)) {
      throw new Error(
        `Adres e-mail klienta jest nieprawidłowy: "${client.email}". Popraw w karcie klienta.`,
      );
    }
  }

  if (client.postalCode) {
    if (!/^\d{2}-\d{3}$/.test(client.postalCode)) {
      throw new Error(
        `Kod pocztowy ma nieprawidłowy format: "${client.postalCode}" (oczekiwany: XX-XXX). Popraw w karcie klienta.`,
      );
    }
  }

  if (client.nip) {
    if (!validateNip(client.nip)) {
      throw new Error(
        `NIP "${client.nip}" jest nieprawidłowy (błędna suma kontrolna lub format). Popraw w karcie klienta.`,
      );
    }
  }
}

// ─── Number conflict check ───────────────────────────────────────────────────

export const checkOrderNumberConflict = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order?.name) return { conflict: false };

    const orderNumber = order.name;
    const currentOid = `adkokna-${args.orderId}`;

    // Check if another order already sent an estimate with the same number
    const allOrders = await ctx.db.query("orders").collect();
    const conflictOrder = allOrders.find(
      (o) => o._id !== args.orderId && o.fakturownia?.estimateNumber === orderNumber,
    );
    if (conflictOrder) return { conflict: true, number: orderNumber };

    // Check invoices cache for documents with same number but different order
    const cacheConflict = await ctx.db
      .query("fakturowniaInvoicesCache")
      .filter((q) =>
        q.and(q.eq(q.field("number"), orderNumber), q.neq(q.field("oid"), currentOid)),
      )
      .first();
    if (cacheConflict) return { conflict: true, number: orderNumber };

    return { conflict: false };
  },
});

// ─── Actions: Fakturownia API ──────────────────────────────────────────────

export const pushOrderEstimate = action({
  args: { orderId: v.id("orders") },
  handler: async (
    ctx,
    args,
  ): Promise<{ estimateId: string; estimateNumber?: string; updated: boolean }> => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? "anonymous";

    const token = await getDecryptedToken(ctx);
    const sub = await resolveSubdomain(ctx);
    if (!token) throw new Error("Fakturownia: skonfiguruj token API w Ustawieniach");
    if (!sub) throw new Error("Fakturownia: skonfiguruj subdomenę");

    const cfg = await ctx.runQuery(internal.fakturownia.getConfigInternal, {});
    const departmentId = cfg?.departmentId?.trim();

    const order = await ctx.runQuery(api.orders.getById, { orderId: args.orderId });
    if (!order) throw new Error("Zlecenie nie znalezione");

    const client = await ctx.runQuery(api.clients.getById, { clientId: order.clientId });
    if (!client) throw new Error("Klient nie znaleziony");
    validateClientForFakturownia(client);

    const { items } = await ctx.runQuery(api.orderLineItems.listByOrder, {
      orderId: args.orderId,
    });
    if (items.length === 0) throw new Error("Dodaj co najmniej jedną pozycję wyceny");

    const today = new Date().toISOString().slice(0, 10);
    const oid = `adkokna-${args.orderId}`;
    const buyerName = `${client.firstName} ${client.lastName}`.trim();
    const street = buyerStreet(client);

    const orderLabel = order.name ?? oid;

    const positions = items.map((item) => {
      const namePart = item.description
        ? `${item.name} — ${item.description}`
        : item.name;
      return {
        name: namePart,
        quantity: item.quantity,
        tax: item.vatRate,
        total_price_gross: lineItemGross(item),
      };
    });

    const invoice: Record<string, unknown> = {
      kind: "estimate",
      issue_date: today,
      sell_date: today,
      payment_to_kind: 14,
      client_id: -1,
      buyer_name: buyerName,
      buyer_first_name: client.firstName,
      buyer_last_name: client.lastName,
      buyer_email: client.email ?? "",
      buyer_phone: client.phone ?? "",
      buyer_street: street,
      buyer_post_code: client.postalCode ?? "",
      buyer_city: client.city ?? "",
      buyer_country: "PL",
      buyer_company: client.nip ? "1" : "0",
      ...(client.nip ? { buyer_tax_no: client.nip } : {}),
      oid,
      ...(order.name ? { number: order.name } : {}),
      description: `Dotyczy: ${orderLabel}`,
      positions,
      lang: "pl",
      currency: "PLN",
    };

    if (departmentId) {
      invoice.department_id = departmentId;
    }

    const existingEstimateId = order.fakturownia?.estimateId;

    if (existingEstimateId) {
      const stillExists = await checkInvoiceExists(apiBase(sub), token, existingEstimateId);

      if (stillExists) {
        // Update existing estimate in Fakturownia
        const data = await putInvoice(apiBase(sub), token, existingEstimateId, invoice);
        const result = extractCreatedInvoice(data);

        await ctx.runMutation(internal.fakturownia.updateFakturowniaEstimate, {
          orderId: args.orderId,
          estimateId: result.id,
          estimateNumber: result.number,
        });

        await ctx.runMutation(internal.orders.addEvent, {
          orderId: args.orderId,
          type: "fakturownia_estimate_updated",
          details: { estimateId: result.id, number: result.number, oid },
          performedBy: userId,
        });

        return { estimateId: result.id, estimateNumber: result.number, updated: true };
      } else {
        // Old estimate was deleted in Fakturownia — create a new one
        const data = await postInvoice(apiBase(sub), token, invoice);
        const created = extractCreatedInvoice(data);

        await ctx.runMutation(internal.fakturownia.setFakturowniaEstimate, {
          orderId: args.orderId,
          estimateId: created.id,
          estimateNumber: created.number,
          oid,
        });

        await ctx.runMutation(internal.orders.addEvent, {
          orderId: args.orderId,
          type: "fakturownia_estimate_created",
          details: { estimateId: created.id, number: created.number, oid, recreated: true },
          performedBy: userId,
        });

        return { estimateId: created.id, estimateNumber: created.number, updated: false };
      }
    }

    // First time — create new estimate
    const data = await postInvoice(apiBase(sub), token, invoice);
    const created = extractCreatedInvoice(data);

    await ctx.runMutation(internal.fakturownia.setFakturowniaEstimate, {
      orderId: args.orderId,
      estimateId: created.id,
      estimateNumber: created.number,
      oid,
    });

    await ctx.runMutation(internal.orders.addEvent, {
      orderId: args.orderId,
      type: "fakturownia_estimate_created",
      details: { estimateId: created.id, number: created.number, oid },
      performedBy: userId,
    });

    return { estimateId: created.id, estimateNumber: created.number, updated: false };
  },
});

// ─── Mutation: record invoice type locally (CRM-only, not sent to Fakturownia) ─

export const recordOrderInvoice = mutation({
  args: {
    orderId: v.id("orders"),
    kind: v.union(v.literal("vat"), v.literal("advance"), v.literal("final")),
    advancePercent: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Brak autoryzacji");

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Zlecenie nie znalezione");
    if (!order.fakturownia?.estimateId) {
      throw new Error("Wyślij najpierw zamówienie do Fakturowni — faktury można zapisać dopiero po wysłaniu zamówienia.");
    }

    const existingInvoices = order.fakturownia.invoices ?? [];

    let effectiveAdvancePercent: number | undefined;

    if (args.kind === "advance") {
      const pct = args.advancePercent;
      if (!pct || pct <= 0 || pct >= 100) {
        throw new Error("Procent zaliczki musi być między 1 a 99");
      }
      const usedPercent = existingInvoices
        .filter((inv) => inv.kind === "advance")
        .reduce((sum, inv) => sum + (inv.advancePercent ?? 0), 0);
      if (usedPercent + pct > 100) {
        throw new Error(`Łączna zaliczka przekracza 100% (już wystawiono ${usedPercent}%)`);
      }
      effectiveAdvancePercent = pct;
    } else if (args.kind === "final") {
      const usedPercent = existingInvoices
        .filter((inv) => inv.kind === "advance")
        .reduce((sum, inv) => sum + (inv.advancePercent ?? 0), 0);
      if (usedPercent <= 0) {
        throw new Error("Brak faktury zaliczkowej — faktura końcowa wymaga wcześniejszej zaliczki");
      }
    }

    const fk = order.fakturownia;
    await ctx.db.patch(args.orderId, {
      fakturownia: {
        ...fk,
        invoices: [
          ...existingInvoices,
          { kind: args.kind, advancePercent: effectiveAdvancePercent, createdAt: Date.now() },
        ],
      },
    });
  },
});

// ─── Invoices cache ──────────────────────────────────────────────────────────

const cachedInvoiceFields = v.object({
  remoteId: v.string(),
  number: v.optional(v.string()),
  kind: v.string(),
  status: v.optional(v.string()),
  buyerName: v.optional(v.string()),
  issueDate: v.optional(v.string()),
  sellDate: v.optional(v.string()),
  paymentTo: v.optional(v.string()),
  grossAmount: v.optional(v.number()),
  netAmount: v.optional(v.number()),
  currency: v.optional(v.string()),
  oid: v.optional(v.string()),
});

function parseInvoiceFromApi(raw: Record<string, unknown>): {
  remoteId: string;
  number?: string;
  kind: string;
  status?: string;
  buyerName?: string;
  issueDate?: string;
  sellDate?: string;
  paymentTo?: string;
  grossAmount?: number;
  netAmount?: number;
  currency?: string;
  oid?: string;
} {
  const id = typeof raw.id === "number" ? String(raw.id) : typeof raw.id === "string" ? raw.id : "";
  const parseAmount = (v: unknown): number | undefined => {
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const n = parseFloat(v.replace(",", "."));
      return isNaN(n) ? undefined : n;
    }
    return undefined;
  };
  return {
    remoteId: id,
    number: typeof raw.number === "string" ? raw.number : undefined,
    kind: typeof raw.kind === "string" ? raw.kind : "vat",
    status: typeof raw.status === "string" ? raw.status : undefined,
    buyerName: typeof raw.buyer_name === "string" ? raw.buyer_name : undefined,
    issueDate: typeof raw.issue_date === "string" ? raw.issue_date : undefined,
    sellDate: typeof raw.sell_date === "string" ? raw.sell_date : undefined,
    paymentTo: typeof raw.payment_to === "string" ? raw.payment_to : undefined,
    grossAmount: parseAmount(raw.price_gross),
    netAmount: parseAmount(raw.price_net),
    currency: typeof raw.currency === "string" ? raw.currency : undefined,
    oid: typeof raw.oid === "string" ? raw.oid : undefined,
  };
}

export const listCachedInvoices = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("fakturowniaInvoicesCache").order("desc").take(1000);
    return all.filter((inv) => inv.kind !== "estimate");
  },
});

export const listCachedInvoicesByOrder = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("fakturowniaInvoicesCache")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();
    return all.filter((inv) => inv.kind !== "estimate");
  },
});

export const upsertManyInvoices = internalMutation({
  args: {
    invoices: v.array(cachedInvoiceFields),
    syncedAt: v.number(),
  },
  handler: async (ctx, args) => {
    for (const inv of args.invoices) {
      const existing = await ctx.db
        .query("fakturowniaInvoicesCache")
        .withIndex("by_remote_id", (q) => q.eq("remoteId", inv.remoteId))
        .first();

      // Auto-detect order from OID (format: adkokna-{convexOrderId})
      let autoOrderId: Id<"orders"> | undefined;
      if (!existing?.orderId && inv.oid?.startsWith("adkokna-")) {
        const maybeId = inv.oid.slice("adkokna-".length);
        try {
          const order = await ctx.db.get(maybeId as Id<"orders">);
          if (order) autoOrderId = order._id;
        } catch { /* invalid ID format */ }
      }

      if (existing) {
        await ctx.db.patch(existing._id, {
          ...inv,
          syncedAt: args.syncedAt,
          ...(autoOrderId && !existing.orderId ? { orderId: autoOrderId } : {}),
        });
      } else {
        await ctx.db.insert("fakturowniaInvoicesCache", {
          ...inv,
          syncedAt: args.syncedAt,
          ...(autoOrderId ? { orderId: autoOrderId } : {}),
        });
      }
    }
  },
});

export const assignInvoiceToOrder = mutation({
  args: {
    invoiceId: v.id("fakturowniaInvoicesCache"),
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const inv = await ctx.db.get(args.invoiceId);
    if (!inv) throw new Error("Faktura nie znaleziona w cache");
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Zlecenie nie znalezione");
    await ctx.db.patch(args.invoiceId, { orderId: args.orderId });
  },
});

export const unassignInvoiceFromOrder = mutation({
  args: { invoiceId: v.id("fakturowniaInvoicesCache") },
  handler: async (ctx, args) => {
    const inv = await ctx.db.get(args.invoiceId);
    if (!inv) throw new Error("Faktura nie znaleziona w cache");
    await ctx.db.patch(args.invoiceId, { orderId: undefined });
  },
});

export const syncInvoicesFromFakturownia = action({
  args: {},
  handler: async (ctx): Promise<{ count: number; pages: number }> => {
    const token = await getDecryptedToken(ctx);
    const sub = await resolveSubdomain(ctx);
    if (!token) throw new Error("Fakturownia: skonfiguruj token API w Ustawieniach");
    if (!sub) throw new Error("Fakturownia: skonfiguruj subdomenę");

    const base = apiBase(sub);
    const syncedAt = Date.now();
    let page = 1;
    let totalCount = 0;
    const perPage = 100;

    while (true) {
      const url = `${base}/invoices.json?api_token=${encodeURIComponent(token)}&per_page=${perPage}&page=${page}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Fakturownia API błąd (${res.status}): ${text.slice(0, 200)}`);
      }
      const data: unknown = await res.json();
      if (!Array.isArray(data) || data.length === 0) break;

      const invoices = (data as Record<string, unknown>[]).map(parseInvoiceFromApi).filter((i) => i.remoteId);
      await ctx.runMutation(internal.fakturownia.upsertManyInvoices, { invoices, syncedAt });

      totalCount += invoices.length;
      if (data.length < perPage) break;
      page++;
    }

    return { count: totalCount, pages: page };
  },
});

// ─── Test action: creates a minimal test estimate in Fakturownia ────────────

export const testCreateEstimate = action({
  args: {},
  handler: async (ctx): Promise<{ ok: boolean; estimateId?: string; estimateNumber?: string; url?: string; error?: string }> => {
    const token = await getDecryptedToken(ctx);
    const sub = await resolveSubdomain(ctx);
    if (!token) return { ok: false, error: "Brak tokena API — skonfiguruj w Ustawieniach" };
    if (!sub) return { ok: false, error: "Brak subdomeny — skonfiguruj w Ustawieniach" };

    const today = new Date().toISOString().slice(0, 10);
    const oid = `adkokna-test-${Date.now()}`;

    try {
      const data = await postInvoice(apiBase(sub), token, {
        kind: "estimate",
        issue_date: today,
        sell_date: today,
        payment_to_kind: 14,
        client_id: -1,
        buyer_name: "Test Klient ADK",
        buyer_first_name: "Test",
        buyer_last_name: "Klient ADK",
        buyer_email: "test@adkokna.pl",
        buyer_phone: "123456789",
        buyer_street: "ul. Testowa 1",
        buyer_post_code: "00-001",
        buyer_city: "Warszawa",
        buyer_country: "PL",
        buyer_company: "0",
        oid,
        description: "TESTOWE zamówienie — automatyczny test integracji ADK Okna (można usunąć)",
        positions: [
          { name: "Okno PVC 120x150 — białe", quantity: 1, tax: 8, total_price_gross: 1080.00 },
          { name: "Montaż okna", quantity: 1, tax: 23, total_price_gross: 246.00 },
        ],
        lang: "pl",
        currency: "PLN",
      });

      const created = extractCreatedInvoice(data);
      return {
        ok: true,
        estimateId: created.id,
        estimateNumber: created.number,
        url: `${apiBase(sub)}/invoices/${created.id}`,
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Błąd nieznany" };
    }
  },
});
