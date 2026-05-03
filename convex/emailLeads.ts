import { v } from "convex/values";
import { mutation, query, action, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { DEFAULT_DOCUMENTS } from "./orders";

const SERVICES = [
  "Okna",
  "Drzwi",
  "Brama",
  "Zabudowa tarasu",
  "Konstrukcja aluminiowa",
  "Ogrodzenie",
  "System przeciwsłoneczny",
] as const;

// ─── Mutations / Queries ──────────────────────────────────────────────────────

export const savePending = mutation({
  args: {
    from: v.string(),
    subject: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("pendingEmailSubmissions", {
      ...args,
      processed: false,
    });
  },
});

export const updatePendingWithCardId = mutation({
  args: {
    pendingId: v.id("pendingEmailSubmissions"),
    trelloCardId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.pendingId, { trelloCardId: args.trelloCardId });
  },
});

export const findPendingByCardId = query({
  args: { trelloCardId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("pendingEmailSubmissions")
      .withIndex("by_trello_card", (q) => q.eq("trelloCardId", args.trelloCardId))
      .filter((q) => q.eq(q.field("processed"), false))
      .first();
  },
});

// Wewnętrzne pobieranie rekordu po ID — używane w createFromEmail
export const getPendingById = internalQuery({
  args: { pendingId: v.id("pendingEmailSubmissions") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.pendingId);
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Wyciąga czysty adres e-mail z "Imię Nazwisko <email>" lub zwykłego "email". */
function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase().trim();
  return from.toLowerCase().trim();
}

/**
 * Gdy AI nie może ustalić prawdziwego imienia i nazwiska,
 * próbuje wydobyć je z lokalnej części adresu e-mail.
 * np. jan.kowalski@gmail.com → { firstName: "Jan", lastName: "Kowalski" }
 */
function nameFromEmail(email: string): { firstName: string; lastName: string } {
  const local = email.split("@")[0] ?? "";
  const cap = (s: string) =>
    s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  const parts = local.split(/[._\-+]/).filter(Boolean);
  if (parts.length >= 2) {
    return {
      firstName: cap(parts[0]),
      lastName: parts.slice(1).map(cap).join(" "),
    };
  }
  return { firstName: cap(local) || "Nieznany", lastName: "Klient" };
}

// ─── AI extraction + client/order creation ────────────────────────────────────

type ExtractedClient = {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  city?: string;
  address?: string;
  services?: string[];
  comment?: string;
};

async function extractClientWithAI(
  from: string,
  subject: string,
  body: string,
): Promise<ExtractedClient> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Brak ANTHROPIC_API_KEY");

  const prompt = `Przeanalizuj poniższego maila i wyciągnij dane klienta w formacie JSON.

Adres nadawcy: ${from}
Temat: ${subject}
Treść:
${body}

Zwróć TYLKO obiekt JSON (bez markdown, bez komentarzy) z następującymi polami:
- firstName: string (imię, wymagane — jeśli nie znasz wpisz "Nieznany")
- lastName: string (nazwisko, wymagane — jeśli nie znasz wpisz "Klient")
- email: string | null (adres email klienta — weź z pola "Od:" jeśli nie ma w treści)
- phone: string | null (numer telefonu, null jeśli brak)
- city: string | null (miejscowość, null jeśli brak)
- address: string | null (adres, null jeśli brak)
- services: array of strings | null (usługi z listy: ${SERVICES.join(", ")} — dopasuj na podstawie treści, null jeśli brak)
- comment: string | null (inne istotne informacje z maila, np. wymiary, preferencje, terminy)`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${err}`);
  }

  const result = await response.json() as {
    content: Array<{ type: string; text: string }>;
  };

  const text = result.content.find((c) => c.type === "text")?.text ?? "{}";

  let parsed: Partial<ExtractedClient> = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    // Fallback — spróbuj wyciągnąć JSON z tekstu
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { parsed = JSON.parse(match[0]); } catch { /* ignore */ }
    }
  }

  return {
    firstName: typeof parsed.firstName === "string" ? parsed.firstName : "Nieznany",
    lastName: typeof parsed.lastName === "string" ? parsed.lastName : "Klient",
    email: typeof parsed.email === "string" ? parsed.email : undefined,
    phone: typeof parsed.phone === "string" ? parsed.phone : undefined,
    city: typeof parsed.city === "string" ? parsed.city : undefined,
    address: typeof parsed.address === "string" ? parsed.address : undefined,
    services: Array.isArray(parsed.services)
      ? (parsed.services as string[]).filter((s) =>
          (SERVICES as readonly string[]).includes(s),
        )
      : undefined,
    comment: typeof parsed.comment === "string" ? parsed.comment : undefined,
  };
}

export const createFromEmail = action({
  args: {
    pendingId: v.id("pendingEmailSubmissions"),
    trelloCardId: v.optional(v.string()),
    trelloCardUrl: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ clientId: Id<"clients">; orderId: Id<"orders"> }> => {
    // Pobieramy pending bezpośrednio po ID (już zwalidowany przez webhook — nie ma potrzeby re-query)
    const pending = await ctx.runQuery(internal.emailLeads.getPendingById, {
      pendingId: args.pendingId,
    });

    if (!pending) {
      throw new Error(`[createFromEmail] Pending ${args.pendingId} not found`);
    }
    if (pending.processed) {
      throw new Error(`[createFromEmail] Pending ${args.pendingId} already processed`);
    }

    // AI extraction — NIE-fatalna: jeśli zawiedzie, tworzymy klienta z danych adresu e-mail
    let extracted: ExtractedClient = { firstName: "Nieznany", lastName: "Klient" };
    try {
      extracted = await extractClientWithAI(pending.from, pending.subject, pending.body);
    } catch (err) {
      console.error("[createFromEmail] AI extraction failed, using email fallback:", err);
    }

    // Deduplicacja klienta bezpośrednio po adresie e-mail nadawcy (niezawodnie, bez AI)
    const senderEmail = extractEmail(pending.from);
    const existingClient = senderEmail
      ? await ctx.runQuery(api.clients.findByEmail, { email: senderEmail })
      : null;

    let clientId: Id<"clients">;

    if (existingClient) {
      // Znany klient — przypisz zamówienie do niego
      clientId = existingClient._id;
      console.info("[createFromEmail] Matched existing client", { clientId, senderEmail });
    } else {
      // Nieznany klient — fallback na parsowanie adresu e-mail gdy AI nie znalazło nazwiska
      const hasRealName =
        extracted.firstName !== "Nieznany" && extracted.lastName !== "Klient";
      const { firstName, lastName } = hasRealName
        ? { firstName: extracted.firstName, lastName: extracted.lastName }
        : nameFromEmail(senderEmail);

      clientId = await ctx.runMutation(api.emailLeads.insertClient, {
        firstName,
        lastName,
        email: senderEmail || extracted.email,
        phone: extracted.phone,
        city: extracted.city,
        address: extracted.address,
      });
      console.info("[createFromEmail] Created new client", { clientId, firstName, lastName });
    }

    const orderId = await ctx.runMutation(api.emailLeads.insertOrder, {
      clientId,
      services: extracted.services,
      comment: extracted.comment,
      trelloCardId: args.trelloCardId,
      trelloCardUrl: args.trelloCardUrl,
    });

    await ctx.runMutation(api.emailLeads.markProcessed, {
      pendingId: args.pendingId,
    });

    // Zaplanuj tworzenie folderu Drive
    const driveConnection = await ctx.runQuery(api.emailLeads.getDriveConnection);
    if (
      driveConnection?.sharedDriveId &&
      driveConnection.connectionStatus !== "disconnected"
    ) {
      await ctx.scheduler.runAfter(0, internal.googleDrive.initializeMeasurement, { orderId });
    }

    return { clientId, orderId };
  },
});

// ─── Internal mutations ────────────────────────────────────────────────────────

export const insertClient = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    city: v.optional(v.string()),
    address: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const clientId = await ctx.db.insert("clients", {
      ...args,
      source: "manual",
      createdBy: "system",
    });

    await ctx.db.insert("clientEvents", {
      clientId,
      type: "created",
      details: { source: "email" },
      performedBy: "system",
    });

    return clientId;
  },
});

export const insertOrder = mutation({
  args: {
    clientId: v.id("clients"),
    services: v.optional(v.array(v.string())),
    comment: v.optional(v.string()),
    trelloCardId: v.optional(v.string()),
    trelloCardUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const orderId = await ctx.db.insert("orders", {
      clientId: args.clientId,
      services: args.services,
      comment: args.comment,
      status: "measurement",
      documents: { ...DEFAULT_DOCUMENTS, pomiar: { enabled: true } },
      source: "manual",
      trelloCardId: args.trelloCardId,
      trelloCardUrl: args.trelloCardUrl,
      createdBy: "system",
    });

    await ctx.db.insert("clientEvents", {
      clientId: args.clientId,
      orderId,
      type: "order_created",
      details: { source: "email", triggeredBy: "trello_card_move" },
      performedBy: "system",
    });

    await ctx.db.insert("clientEvents", {
      clientId: args.clientId,
      orderId,
      type: "status_changed",
      details: { from: "lead", to: "measurement", triggeredBy: "trello_card_move" },
      performedBy: "system",
    });

    return orderId;
  },
});

export const markProcessed = mutation({
  args: { pendingId: v.id("pendingEmailSubmissions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.pendingId, { processed: true });
  },
});

export const getDriveConnection = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("driveConnection").first();
  },
});
