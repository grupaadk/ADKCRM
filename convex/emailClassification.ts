import { v } from "convex/values";
import { query, mutation, action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// ─── Query ────────────────────────────────────────────────────────────────────

/** Zwraca mapę threadId → status dla podanych wątków. */
export const getByThreadIds = query({
  args: { threadIds: v.array(v.string()) },
  handler: async (ctx, { threadIds }) => {
    const result: Record<string, "LEAD" | "OTHER"> = {};
    await Promise.all(
      threadIds.map(async (threadId) => {
        const existing = await ctx.db
          .query("emailClassifications")
          .withIndex("by_thread_id", (q) => q.eq("gmailThreadId", threadId))
          .first();
        if (existing) result[threadId] = existing.classificationStatus;
      }),
    );
    return result;
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Wewnętrzny upsert — wywoływany przez akcję klasyfikacji. */
export const upsert = internalMutation({
  args: {
    gmailThreadId: v.string(),
    classificationStatus: v.union(v.literal("LEAD"), v.literal("OTHER")),
  },
  handler: async (ctx, { gmailThreadId, classificationStatus }) => {
    const existing = await ctx.db
      .query("emailClassifications")
      .withIndex("by_thread_id", (q) => q.eq("gmailThreadId", gmailThreadId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        classificationStatus,
        classifiedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("emailClassifications", {
        gmailThreadId,
        classificationStatus,
        classifiedAt: Date.now(),
      });
    }
  },
});

/** Ręczna zmiana klasyfikacji przez handlowca. */
export const reclassify = mutation({
  args: {
    gmailThreadId: v.string(),
    classificationStatus: v.union(v.literal("LEAD"), v.literal("OTHER")),
  },
  handler: async (ctx, { gmailThreadId, classificationStatus }) => {
    const existing = await ctx.db
      .query("emailClassifications")
      .withIndex("by_thread_id", (q) => q.eq("gmailThreadId", gmailThreadId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        classificationStatus,
        classifiedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("emailClassifications", {
        gmailThreadId,
        classificationStatus,
        classifiedAt: Date.now(),
      });
    }
  },
});

// ─── Action ───────────────────────────────────────────────────────────────────

/**
 * Klasyfikuje wątek e-mail używając Claude AI.
 * Domyślnie LEAD jeśli klasyfikacja zawiedzie (żeby nie zgubić klienta).
 */
export const classifyThread = action({
  args: {
    threadId: v.string(),
    subject: v.string(),
    from: v.string(),
    snippet: v.string(),
  },
  handler: async (ctx, { threadId, subject, from, snippet }) => {
    let status: "LEAD" | "OTHER" = "LEAD";

    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("Brak ANTHROPIC_API_KEY");

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 10,
          messages: [
            {
              role: "user",
              content: `Jesteś asystentem firmy Grupa ADK (sprzedaż i montaż okien, drzwi, rolet, bram, żaluzji i zabudów tarasowych).

Twoje zadanie: zdecyduj, czy poniższa wiadomość jest zapytaniem o ofertę lub wycenę od potencjalnego klienta.

LEAD — odpowiedz tak, jeśli wiadomość zawiera:
- prośbę o wycenę, kosztorys lub ofertę handlową
- pytanie o cenę, dostępność lub montaż produktów ADK
- zapytanie o okna, drzwi, rolety, bramy, żaluzje, zabudowę tarasową, ogrodzenia
- prośbę o pomiar lub wizytę handlowca
- kontakt w sprawie zakupu lub wymiany stolarki

OTHER — odpowiedz tak, jeśli wiadomość to:
- spam, oferta od innej firmy, newsletter, reklama
- powiadomienie systemowe (Trello, Google, Atlassian)
- faktura, potwierdzenie płatności od dostawcy
- wiadomość wewnętrzna lub automatyczna
- reklamacja już zrealizowanego zlecenia (klient który już jest w bazie)

Odpowiedz TYLKO jednym słowem: LEAD lub OTHER.

Nadawca: ${from}
Temat: ${subject}
Treść: ${snippet.slice(0, 500)}`,
            },
          ],
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          content?: Array<{ text?: string }>;
        };
        const text = data.content?.[0]?.text?.trim().toUpperCase();
        if (text === "LEAD" || text === "OTHER") status = text;
      }
    } catch {
      // Domyślnie LEAD — nie gubimy potencjalnych klientów
    }

    await ctx.runMutation(internal.emailClassification.upsert, {
      gmailThreadId: threadId,
      classificationStatus: status,
    });

    return status;
  },
});
