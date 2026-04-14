import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
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

const DEFAULT_ADVANCE_PERCENT = 30;

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
  kind: v.union(v.literal("advance"), v.literal("final")),
  remoteId: v.string(),
  number: v.optional(v.string()),
  grossAmount: v.optional(v.number()),
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
      advancePercent: row?.advancePercent ?? DEFAULT_ADVANCE_PERCENT,
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
    advancePercent: v.number(),
    departmentId: v.optional(v.string()),
    encryptedApiToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? "anonymous";
    const envToken = getEnvApiToken();
    const existing = await ctx.db.query("fakturowniaConfig").first();

    if (args.advancePercent < 1 || args.advancePercent > 99) {
      throw new Error("Zaliczka musi być między 1% a 99%");
    }

    const sub = args.subdomain.trim().toLowerCase().replace(/\.fakturownia\.pl$/i, "");
    if (!sub && !getEnvSubdomain()) {
      throw new Error("Podaj subdomenę Fakturowni (np. moja-firma)");
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        subdomain: sub || existing.subdomain,
        advancePercent: args.advancePercent,
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
        advancePercent: args.advancePercent,
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

async function resolveAdvancePercent(ctx: Pick<ActionCtx, "runQuery">): Promise<number> {
  const row = await ctx.runQuery(internal.fakturownia.getConfigInternal, {});
  const p = row?.advancePercent;
  if (typeof p === "number" && p >= 1 && p <= 99) return p;
  return DEFAULT_ADVANCE_PERCENT;
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

async function postInvoice(
  baseUrl: string,
  apiToken: string,
  invoice: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${baseUrl}/invoices.json`, {
    method: "POST",
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
    const msg =
      typeof data === "object" && data !== null && "message" in data
        ? String((data as { message: unknown }).message)
        : text.slice(0, 500);
    throw new Error(`Fakturownia API (${res.status}): ${msg}`);
  }
  return data as Record<string, unknown>;
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

export const appendFakturowniaInvoice = internalMutation({
  args: {
    orderId: v.id("orders"),
    entry: fakturowniaInvoiceEntry,
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order?.fakturownia?.estimateId) {
      throw new Error("Brak zamówienia (estimate) w Fakturowni dla tego zlecenia");
    }
    const prev = order.fakturownia.invoices ?? [];
    await ctx.db.patch(args.orderId, {
      fakturownia: {
        ...order.fakturownia,
        invoices: [...prev, args.entry],
      },
    });
  },
});

// ─── Actions: Fakturownia API ──────────────────────────────────────────────

export const pushOrderEstimate = action({
  args: { orderId: v.id("orders") },
  handler: async (
    ctx,
    args,
  ): Promise<{ estimateId: string; estimateNumber?: string }> => {
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
    if (order.fakturownia?.estimateId) {
      throw new Error("To zlecenie ma już zamówienie w Fakturowni. Usuń je ręcznie w Fakturowni, aby wysłać ponownie.");
    }

    const client = await ctx.runQuery(api.clients.getById, { clientId: order.clientId });
    if (!client) throw new Error("Klient nie znaleziony");

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
      buyer_email: client.email ?? "",
      buyer_phone: client.phone ?? "",
      buyer_street: street,
      buyer_post_code: client.postalCode ?? "",
      buyer_city: client.city ?? "",
      buyer_country: "PL",
      buyer_company: client.nip ? "1" : "0",
      ...(client.nip ? { buyer_tax_no: client.nip } : {}),
      oid,
      description: `Zlecenie: ${orderLabel} (wewn. id: ${args.orderId})`,
      positions,
      lang: "pl",
      currency: "PLN",
    };

    if (departmentId) {
      invoice.department_id = departmentId;
    }

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
      details: {
        estimateId: created.id,
        number: created.number,
        oid,
      },
      performedBy: userId,
    });

    return { estimateId: created.id, estimateNumber: created.number };
  },
});

export const pushAdvanceInvoice = action({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args): Promise<{ invoiceId: string; number?: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? "anonymous";

    const token = await getDecryptedToken(ctx);
    const sub = await resolveSubdomain(ctx);
    if (!token) throw new Error("Fakturownia: skonfiguruj token API");
    if (!sub) throw new Error("Fakturownia: skonfiguruj subdomenę");

    const advancePercent = await resolveAdvancePercent(ctx);

    const order = await ctx.runQuery(api.orders.getById, { orderId: args.orderId });
    if (!order?.fakturownia?.estimateId) {
      throw new Error("Najpierw wyślij zamówienie (wycenę) do Fakturowni");
    }
    const hasAdvance = order.fakturownia.invoices.some((i) => i.kind === "advance");
    if (hasAdvance) {
      throw new Error("Zaliczka dla tego zlecenia została już utworzona w Fakturowni");
    }

    const orderLabel = order.name ?? args.orderId;
    const data = await postInvoice(apiBase(sub), token, {
      copy_invoice_from: order.fakturownia.estimateId,
      kind: "advance",
      advance_creation_mode: "percent",
      advance_value: String(advancePercent),
      position_name: `Zaliczka ${advancePercent}% brutto — ${orderLabel}`,
    });

    const created = extractCreatedInvoice(data);

    await ctx.runMutation(internal.fakturownia.appendFakturowniaInvoice, {
      orderId: args.orderId,
      entry: {
        kind: "advance",
        remoteId: created.id,
        number: created.number,
        grossAmount: created.grossAmount,
        createdAt: Date.now(),
      },
    });

    await ctx.runMutation(internal.orders.addEvent, {
      orderId: args.orderId,
      type: "fakturownia_advance_invoice",
      details: { invoiceId: created.id, number: created.number },
      performedBy: userId,
    });

    return { invoiceId: created.id, number: created.number };
  },
});

export const pushFinalInvoice = action({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args): Promise<{ invoiceId: string; number?: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? "anonymous";

    const token = await getDecryptedToken(ctx);
    const sub = await resolveSubdomain(ctx);
    if (!token) throw new Error("Fakturownia: skonfiguruj token API");
    if (!sub) throw new Error("Fakturownia: skonfiguruj subdomenę");

    const order = await ctx.runQuery(api.orders.getById, { orderId: args.orderId });
    if (!order?.fakturownia?.estimateId) {
      throw new Error("Najpierw wyślij zamówienie do Fakturowni");
    }
    const advances = order.fakturownia.invoices.filter((i) => i.kind === "advance");
    if (advances.length === 0) {
      throw new Error("Wystaw najpierw fakturę zaliczkową");
    }
    const hasFinal = order.fakturownia.invoices.some((i) => i.kind === "final");
    if (hasFinal) {
      throw new Error("Faktura końcowa dla tego zlecenia została już utworzona");
    }

    const invoiceIds = advances.map((a) => parseInt(a.remoteId, 10)).filter((n) => !Number.isNaN(n));
    if (invoiceIds.length === 0) {
      throw new Error("Nieprawidłowe ID faktur zaliczkowych");
    }

    const data = await postInvoice(apiBase(sub), token, {
      copy_invoice_from: order.fakturownia.estimateId,
      kind: "final",
      invoice_ids: invoiceIds,
    });

    const created = extractCreatedInvoice(data);

    await ctx.runMutation(internal.fakturownia.appendFakturowniaInvoice, {
      orderId: args.orderId,
      entry: {
        kind: "final",
        remoteId: created.id,
        number: created.number,
        grossAmount: created.grossAmount,
        createdAt: Date.now(),
      },
    });

    await ctx.runMutation(internal.orders.addEvent, {
      orderId: args.orderId,
      type: "fakturownia_final_invoice",
      details: { invoiceId: created.id, number: created.number },
      performedBy: userId,
    });

    return { invoiceId: created.id, number: created.number };
  },
});
