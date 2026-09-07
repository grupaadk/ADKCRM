import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

/**
 * Odczytuje publiczne metadane konfiguracji AI (czy podano API key, jaki model jest wybrany)
 */
export const getAiConfig = query({
  args: {},
  handler: async (ctx) => {
    const config = await ctx.db.query("aiAssistantConfig").first();
    if (!config) {
      return {
        hasApiKey: false,
        selectedModel: "claude-3-5-sonnet-20241022" as const,
        systemPromptExtra: "",
        apiKeyMasked: "",
      };
    }

    const apiKey = config.apiKey || "";
    const apiKeyMasked = apiKey.length > 8
      ? `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}`
      : apiKey ? "****" : "";

    return {
      hasApiKey: !!apiKey.trim(),
      selectedModel: config.selectedModel,
      systemPromptExtra: config.systemPromptExtra || "",
      apiKeyMasked,
    };
  },
});

/**
 * Zapisuje konfigurację API Anthropic Claude oraz wybrany model
 */
export const saveAiConfig = mutation({
  args: {
    apiKey: v.optional(v.string()),
    selectedModel: v.union(
      v.literal("claude-3-5-sonnet-20241022"),
      v.literal("claude-3-5-haiku-20241022")
    ),
    systemPromptExtra: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("aiAssistantConfig").first();
    const now = Date.now();

    if (existing) {
      // Jeśli przekazano nowy klucz (lub zamierzony brak)
      const newApiKey = args.apiKey !== undefined ? args.apiKey : existing.apiKey;
      await ctx.db.patch(existing._id, {
        apiKey: newApiKey,
        selectedModel: args.selectedModel,
        systemPromptExtra: args.systemPromptExtra,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("aiAssistantConfig", {
        apiKey: args.apiKey,
        selectedModel: args.selectedModel,
        systemPromptExtra: args.systemPromptExtra,
        updatedAt: now,
      });
    }
  },
});

/**
 * Akcja bezpośrednio wywołująca Anthropic API i generująca odpowiedź + kartę wyceny
 */
export const generateEstimateWithClaude = action({
  args: {
    userMessage: v.string(),
    history: v.array(
      v.object({
        sender: v.union(v.literal("user"), v.literal("assistant")),
        text: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // 1. Pobierz konfigurację z bazy
    const config = await ctx.runQuery(api.aiAssistant.getAiConfigInternal);
    if (!config || !config.apiKey || !config.apiKey.trim()) {
      throw new Error("Brak skonfigurowanego klucza Anthropic API Key w Ustawieniach Asystenta.");
    }

    // 2. Pobierz aktualne cenniki zadaszeń z bazy Convex
    const terracePrices = await ctx.runQuery(api.terracePricing.listTerracePrices, {});

    // Sformatuj cennik w czytelną tabelkę dla Claude
    const polyPrices = terracePrices.filter((p) => p.material === "polycarbonate");
    const glassPrices = terracePrices.filter((p) => p.material === "glass");

    const formatPriceTable = (items: typeof terracePrices) =>
      items
        .map(
          (i) =>
            `- ${i.widthCm} x ${i.lengthCm} cm: Brutto ${i.priceGross} zł | Netto ${i.priceNet} zł`
        )
        .join("\n");

    const systemPrompt = `Jesteś profesjonalnym Asystentem Wycen dla firmy ADK Okna. Twoim zadaniem jest pomoc doradcom w kalkulacji kosztów stolarki budowlanej oraz Zabudów Tarasów (Zadaszenia, Ściany, Trójkąty).

AKTUALNY CENNIK ZADASZEŃ STANARDOWYCH ADK OKNA (Dystrybutor):

### ZADASZENIE DACH Z POLIWĘGLANU (Wymiary: Szerokość od ściany x Długość wzdłuż ściany):
${formatPriceTable(polyPrices)}

### ZADASZENIE SZKŁO (Wymiary: Szerokość od ściany x Długość wzdłuż ściany):
${formatPriceTable(glassPrices)}

ZASADY KALKULACJI I ODPOWIEDZI:
1. Jeśli klient/użytkownik pyta o zadaszenie w wymiarach standardowych dokładnie odpowiadających tabeli (np. 300x406 cm), weź dokładne ceny brutto i netto z tabeli.
2. Jeśli wymiar jest pośredni / niestandardowy (np. 320x450 cm), w tekście odpowiedzi koniecznie poinformuj: "Uwaga: Wymiar [Wymiar] jest wymiarem niestandardowym. Zaproponowano estymację niestandardową." i przelicz kwotę na bazie powierzchni/najbliższych wymiarów.
3. Gdy przygotowujesz wycenę, zidentyfikuj dane klienta jeśli zostały podane (Imię, Nazwisko, Telefon, Email, Miasto).
4. OTRZYMANĄ ODPOWIEDŹ ZWRÓĆ W STRICT FORMACIE JSON (bez dodatkowego formatowania markdown z potrójnymi backtickami na zewnątrz, lub upewnij się, że JSON jest poprawnym obiektem):

Przykładowa struktura odpowiedzi JSON:
{
  "replyText": "Opis i podsumowanie dla użytkownika w kulturalnym, fachowym tonie...",
  "estimateCard": {
    "title": "Wycena #WYC-[RROK/MM/NUMER]",
    "client": {
      "firstName": "Jan",
      "lastName": "Kowalski",
      "phone": "600123456",
      "email": "jan@example.pl",
      "clientType": "individual",
      "city": "Wrocław"
    },
    "items": [
      {
        "id": "item-1",
        "category": "service",
        "name": "Zadaszenie tarasu - dach z poliwęglanu (300 x 406 cm)",
        "specs": "Wymiary: 300x406 cm | Poliwęglan | Kolor standardowy",
        "qty": 1,
        "priceNet": 3358,
        "vat": 8
      },
      {
        "id": "item-2",
        "category": "installation",
        "name": "Montaż zadaszenia tarasowego",
        "specs": "Montaż konstrukcji wraz z obróbką",
        "qty": 1,
        "priceNet": 1500,
        "vat": 8
      }
    ],
    "discountPercent": 0
  }
}

Jeśli zapytanie nie dotyczy bezpośrednio przygotowania nowej wyceny, możesz pozostawić pole "estimateCard" jako null.
${config.systemPromptExtra ? `\nDODATKOWE INSTRUKCJE FIRMOWE:\n${config.systemPromptExtra}` : ""}`;

    // Przygotuj wiadomości
    const messages = [
      ...args.history.map((h) => ({
        role: h.sender === "user" ? ("user" as const) : ("assistant" as const),
        content: h.text,
      })),
      { role: "user" as const, content: args.userMessage },
    ];

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey.trim(),
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: config.selectedModel,
          max_tokens: 2500,
          system: systemPrompt,
          messages,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(
          `Błąd API Anthropic (${response.status}): ${errJson?.error?.message || response.statusText}`
        );
      }

      const data = await response.json();
      const rawText = data.content?.[0]?.text || "";

      // Spróbuj sparsować odpowiedź JSON
      let parsedJson: any = null;
      try {
        const cleanJsonText = rawText
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim();
        parsedJson = JSON.parse(cleanJsonText);
      } catch {
        // Jeśli nie jest czystym JSON-em
        parsedJson = { replyText: rawText, estimateCard: null };
      }

      return {
        replyText: parsedJson.replyText || rawText,
        estimateCard: parsedJson.estimateCard || null,
      };
    } catch (err) {
      throw new Error(`Wystąpił błąd podczas generowania wyceny z Claude: ${err instanceof Error ? err.message : "Nieznany błąd"}`);
    }
  },
});

/**
 * Wewnętrzne zapytanie do pobrania pełnego klucza API dla celów Action (private query)
 */
export const getAiConfigInternal = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("aiAssistantConfig").first();
  },
});
