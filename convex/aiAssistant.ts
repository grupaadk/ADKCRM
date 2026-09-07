import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

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
    serviceType: v.optional(v.string()),
    history: v.array(
      v.object({
        sender: v.union(v.literal("user"), v.literal("assistant")),
        text: v.string(),
      })
    ),
  },
  handler: async (ctx, args): Promise<any> => {
    // 1. Pobierz konfigurację z bazy
    const config: any = await ctx.runQuery(api.aiAssistant.getAiConfigInternal);
    if (!config || !config.apiKey || !config.apiKey.trim()) {
      throw new Error("Brak skonfigurowanego klucza Anthropic API Key w Ustawieniach Asystenta.");
    }

    // Pobierz aktywny workflow dla danej usługi (jeśli wybrano w czacie)
    const activeWfData: any = await ctx.runQuery(internal.aiWorkflows.getActiveWorkflowInternal, {
      serviceType: args.serviceType,
    });

    // 2. Pobierz aktualne cenniki zadaszeń, ścian, trójkątów oraz montażu z bazy Convex
    const terracePrices = (await ctx.runQuery(api.terracePricing.listTerracePrices, {})) as Array<{
      material: "polycarbonate" | "glass";
      widthCm: number;
      lengthCm: number;
      priceGross: number;
      priceNet: number;
    }>;
    const wallPrices = (await ctx.runQuery(api.terracePricing.listTerraceWallPrices, {})) as Array<{
      type: "sliding_2track" | "sliding_3track" | "sliding_4track" | "sliding_5track" | "sliding_6track" | "fixed_polycarbonate";
      tracksCount?: number;
      widthCm: number;
      heightCm: number;
      priceGross: number;
      priceNet: number;
    }>;
    const extrasPrices = (await ctx.runQuery(api.terracePricing.listTerraceExtrasPrices, {})) as Array<{
      widthCm: number;
      tracksCount: number;
      trianglePolycarbonateGross: number;
      trianglePolycarbonateNet: number;
      tintedGlassGross: number;
      tintedGlassNet: number;
      frostedGlassGross: number;
      frostedGlassNet: number;
      dustBrushesGross: number;
      dustBrushesNet: number;
      glassHandlesGross: number;
      glassHandlesNet: number;
    }>;
    const installationPrices = (await ctx.runQuery(api.terracePricing.listTerraceInstallationPrices, {})) as Array<{
      name: string;
      unit: string;
      flatRateNet?: number;
      rates?: Array<{ maxM2?: number; rateNet: number }>;
    }>;

    // Sformatuj cennik w czytelną tabelkę dla Claude
    const polyPrices = (terracePrices ?? []).filter((p) => p.material === "polycarbonate");
    const glassPrices = (terracePrices ?? []).filter((p) => p.material === "glass");
    const slidingWallPrices = (wallPrices ?? []).filter((w) => w.type !== "fixed_polycarbonate");
    const fixedPolyWallPrices = (wallPrices ?? []).filter((w) => w.type === "fixed_polycarbonate");

    const formatPriceTable = (items: typeof polyPrices) =>
      items
        .map(
          (i) =>
            `- ${i.widthCm} x ${i.lengthCm} cm: Brutto ${i.priceGross} zł | Netto ${i.priceNet} zł`
        )
        .join("\n");

    const formatSlidingWallPriceTable = (items: typeof slidingWallPrices) =>
      items
        .map(
          (i) =>
            `- System ${i.tracksCount ?? ""}-torowy ${i.widthCm} cm / wys. ${i.heightCm} cm: Brutto ${i.priceGross} zł | Netto ${i.priceNet} zł`
        )
        .join("\n");

    const formatFixedWallPriceTable = (items: typeof fixedPolyWallPrices) =>
      items
        .map(
          (i) =>
            `- Długość ${i.widthCm} cm / wys. ${i.heightCm} cm: Brutto ${i.priceGross} zł | Netto ${i.priceNet} zł`
        )
        .join("\n");

    const formatExtrasPriceTable = (items: typeof extrasPrices) =>
      items
        .map(
          (i) =>
            `- Szerokość ${i.widthCm} cm (${i.tracksCount}-torowy): Trójkąt poliwęglan lity: ${i.trianglePolycarbonateGross}zł brutto (${i.trianglePolycarbonateNet}zł netto) | Dopłata szkło przyciemniane: ${i.tintedGlassGross}zł brutto (${i.tintedGlassNet}zł netto) | Dopłata szkło mleczne: ${i.frostedGlassGross}zł brutto (${i.frostedGlassNet}zł netto) | Szczotki: ${i.dustBrushesGross}zł brutto (${i.dustBrushesNet}zł netto) | Uchwyty: ${i.glassHandlesGross}zł brutto (${i.glassHandlesNet}zł netto)`
        )
        .join("\n");

    const formatInstallationTable = (items: typeof installationPrices) =>
      items
        .map((i) => {
          if (i.flatRateNet) {
            return `- ${i.name}: ${i.flatRateNet} zł netto / ${i.unit}`;
          }
          const ratesStr = (i.rates || [])
            .map(
              (r) =>
                `do ${r.maxM2 ? `${r.maxM2}m2` : "powyżej 25m2"}: ${r.rateNet} zł netto/m2`
            )
            .join(", ");
          return `- ${i.name}: ${ratesStr}`;
        })
        .join("\n");

    // Zbierz wytyczne ze zdefiniowanego workflowu n8n
    const workflowComponentsText = (activeWfData?.promptComponents || [])
      .map((c: any) => `### KOMPONENT WYTYCZNYCH: ${c.title}\n${c.content}`)
      .join("\n\n");

    const workflowCustomPromptNodes = (activeWfData?.workflow?.nodes || [])
      .filter((n: any) => n.data?.customText)
      .map((n: any) => `### INSTRUKCJA KROKU (${n.data.label}):\n${n.data.customText}`)
      .join("\n\n");

    const systemPrompt: string = `Jesteś profesjonalnym Asystentem Wycen dla firmy ADK Okna. Twoim zadaniem jest pomoc doradcom w kalkulacji kosztów stolarki budowlanej oraz Zabudów Tarasów (Zadaszenia, Ściany Przesuwne i Stałe, Trójkąty Boczne, Montaż).
${activeWfData?.workflow?.title ? `AKTYWNY WORKFLOW PROCESU WYCENY: ${activeWfData.workflow.title} (Usługa: ${activeWfData.workflow.serviceType})\n` : ""}

${workflowComponentsText ? `${workflowComponentsText}\n\n` : ""}${workflowCustomPromptNodes ? `${workflowCustomPromptNodes}\n\n` : ""}AKTUALNY CENNIK ZADASZEŃ, ŚCIAN, TRÓJKĄTÓW I MONTAŻU ADK OKNA (Dystrybutor):

### ZADASZENIE DACH Z POLIWĘGLANU (Wymiary: Szerokość od ściany x Długość wzdłuż ściany):
${formatPriceTable(polyPrices)}

### ZADASZENIE SZKŁO (Wymiary: Szerokość od ściany x Długość wzdłuż ściany):
${formatPriceTable(glassPrices)}

### ŚCIANY PRZESUWNE (System prowadnic + szkło ścienne, Wysokość standardowa 230 cm):
${formatSlidingWallPriceTable(slidingWallPrices)}

### STAŁE ŚCIANY (Poliwęglan komorowy bezbarwny 16mm, Wysokość standardowa 230 cm):
${formatFixedWallPriceTable(fixedPolyWallPrices)}

### TRÓJKĄTY BOCZNE I DOPŁATY DO SZKŁA / AKCESORIA:
${formatExtrasPriceTable(extrasPrices)}

### STAWKI MONTAŻU I PRAC PRZYGOTOWAWCZYCH (Zależne od m2 lub mb):
${formatInstallationTable(installationPrices)}

ZASADY KALKULACJI I ODPOWIEDZI:
1. Podczas kalkulacji zadaszenia oblicz powierzchnię (m2 = szerokość w metrach * długość w metrach) i dobierz właściwą stawkę netto za montaż za m2. Pozycję montażu umieść w sekcji "installation" karty wyceny.
2. Gdy klient zamówi trójkąty, ścianki lub fundamenty, dolicz pozycje montażowe (zł/mb lub zł/m2) z cennika montażu do sekcji "installation".
3. Jeśli klient/użytkownik pyta o zadaszenie lub ściany w wymiarach standardowych dokładnie odpowiadających tabeli, weź dokładne ceny brutto i netto z tabeli.
4. Jeśli wymiar jest pośredni / niestandardowy (np. 320x450 cm zadaszenia lub ściana 300 cm), w tekście odpowiedzi koniecznie poinformuj: "Uwaga: Wymiar [Wymiar] jest wymiarem niestandardowym. Zaproponowano estymację niestandardową." i przelicz kwotę na bazie powierzchni/najbliższych wymiarów.
5. Gdy przygotowujesz wycenę, zidentyfikuj dane klienta jeśli zostały podane (Imię, Nazwisko, Telefon, Email, Miasto).
6. Pozycje zadaszenia i ścian trafiają do klastra "service" w karcie wyceny.
7. OTRZYMANĄ ODPOWIEDŹ ZWRÓĆ W STRICT FORMACIE JSON (bez dodatkowego formatowania markdown z potrójnymi backtickami na zewnątrz, lub upewnij się, że JSON jest poprawnym obiektem):

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
      const response: Response = await fetch("https://api.anthropic.com/v1/messages", {
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
        const errJson: any = await response.json().catch(() => ({}));
        throw new Error(
          `Błąd API Anthropic (${response.status}): ${errJson?.error?.message || response.statusText}`
        );
      }

      const data: any = await response.json();
      const rawText: string = data.content?.[0]?.text || "";

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
