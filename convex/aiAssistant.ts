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

interface PromptComponentInfo {
  id: string;
  title: string;
  content: string;
}

interface WorkflowNodeData {
  label: string;
  componentId?: string;
  priceTables?: string[];
  customText?: string;
  conditionExpr?: string;
  notificationTarget?: string;
  promptText?: string;
  promptRole?: string;
  extractFields?: string[];
  samplePrompt?: string;
  requiredFields?: string[];
  inputPrompt?: string;
  conditionVariable?: string;
  conditionOperator?: string;
  conditionValue?: string;
  componentIdTrue?: string;
  componentIdFalse?: string;
  discountConditionType?: string;
  discountThreshold?: number;
  discountPercent?: number;
  modifierName?: string;
  modifierType?: "percent" | "fixed";
  modifierValue?: number;
  modifierCategory?: "service" | "installation" | "extras";
  validationMinWidth?: number;
  validationMaxWidth?: number;
  validationMinLength?: number;
  validationMaxLength?: number;
  validationErrorMessage?: string;
  questionText?: string;
  questionType?: string;
  questionOptions?: string[];
  questionVariable?: string;
}

interface WorkflowNodeInfo {
  id: string;
  type: string;
  data: WorkflowNodeData;
}

interface WorkflowData {
  title: string;
  serviceType: string;
  nodes: WorkflowNodeInfo[];
}

interface ActiveWfData {
  workflow?: WorkflowData | null;
  promptComponents?: PromptComponentInfo[];
  promptComponentsMap?: Record<string, PromptComponentInfo>;
}

/**
 * Pomocnicza funkcja budująca ustrukturyzowaną sekcję instrukcji systemowych z grafu workflowu
 */
function buildWorkflowInstructions(activeWfData: ActiveWfData | null): string {
  if (!activeWfData || !activeWfData.workflow) return "";

  const wf = activeWfData.workflow;
  const compMap = activeWfData.promptComponentsMap || {};
  const nodes = wf.nodes || [];

  const parts: string[] = [];

  parts.push(`=== AKTYWNY PROCES WORKFLOW WYCENY: ${wf.title} (Usługa: ${wf.serviceType}) ===`);

  // 0. Prompt Triggers (Wyzwolenie procesu i rozpoznawanie wejścia)
  const promptTriggers = nodes.filter((n) => n.type === "prompt_trigger" || n.type === "trigger");
  if (promptTriggers.length > 0) {
    parts.push("--- WYZWOLENIE PROCESU I ROZPOZNAWANIE WEJŚCIA (PROMPT TRIGGER) ---");
    promptTriggers.forEach((n, idx: number) => {
      let triggerText = `${idx + 1}. [Trigger: ${n.data.label}]`;
      if (n.data.promptRole) {
        triggerText += ` Rola/Kontekst zapytania: ${n.data.promptRole}.`;
      }
      if (n.data.extractFields && n.data.extractFields.length > 0) {
        triggerText += ` Kluczowe dane do rozpoznania i wyciągnięcia z wiadomości klienta: [${n.data.extractFields.join(", ")}].`;
      }
      if (n.data.samplePrompt) {
        triggerText += ` Przykład typowego zapytania klienta: "${n.data.samplePrompt}".`;
      }
      if (n.data.customText) {
        triggerText += ` Dodatkowe wytyczne parsowania: ${n.data.customText}`;
      }
      parts.push(triggerText);
    });
  }

  // 1. Input Required
  const inputNodes = nodes.filter((n) => n.type === "input_required");
  if (inputNodes.length > 0) {
    parts.push("--- WYMAGANE DANE WEJŚCIOWE DO WYCENY ---");
    inputNodes.forEach((n, idx: number) => {
      const fields = (n.data.requiredFields || []).join(", ");
      parts.push(
        `${idx + 1}. [Wymóg: ${n.data.label}] Wymagane pola: ${fields || "brak określonych"}.` +
          (n.data.inputPrompt ? ` Pytanie/Instrukcja: "${n.data.inputPrompt}"` : "") +
          " PRZED podaniem ostatecznej wyceny upewnij się, że posiadasz wszystkie powyższe dane od klienta. Jeśli ich brakuje, zapytywaj po kolei!"
      );
    });
  }

  // 2. Question Steps
  const questionNodes = nodes.filter((n) => n.type === "question_step");
  if (questionNodes.length > 0) {
    parts.push("--- STRUKTURALNE PYTANIA DLA KLIENTA ---");
    questionNodes.forEach((n, idx: number) => {
      const opts = (n.data.questionOptions || []).join(" | ");
      parts.push(
        `${idx + 1}. Pytanie: "${n.data.questionText || n.data.label}"` +
          (opts ? ` [Dostępne opcje: ${opts}]` : "") +
          (n.data.questionVariable ? ` -> Zapisz do zmiennej: ${n.data.questionVariable}` : "")
      );
    });
  }

  // 3. Validation Gates
  const valNodes = nodes.filter((n) => n.type === "validation_gate");
  if (valNodes.length > 0) {
    parts.push("--- BRAMKI WALIDACYJNE WYMIARÓW I SPECYFIKACJI ---");
    valNodes.forEach((n, idx: number) => {
      const wRange = n.data.validationMinWidth || n.data.validationMaxWidth ? `Szerokość: ${n.data.validationMinWidth ?? 0}–${n.data.validationMaxWidth ?? "∞"} cm` : "";
      const lRange = n.data.validationMinLength || n.data.validationMaxLength ? `Długość: ${n.data.validationMinLength ?? 0}–${n.data.validationMaxLength ?? "∞"} cm` : "";
      const ranges = [wRange, lRange].filter(Boolean).join(" | ");
      parts.push(
        `${idx + 1}. [Walidacja: ${n.data.label}] Dopuszczalny zakres cennikowy: ${ranges}.` +
          ` W przypadku przekroczenia zakomunikuj klientowi: "${n.data.validationErrorMessage || "Wymiar niestandardowy - zalecana wycena indywidualna."}"`
      );
    });
  }

  // 4. Logical Conditions
  const condNodes = nodes.filter((n) => n.type === "condition_branch" || n.type === "condition");
  if (condNodes.length > 0) {
    parts.push("--- WARUNKI LOGICZNE (IF / ELSE) ---");
    condNodes.forEach((n, idx: number) => {
      if (n.type === "condition_branch") {
        const varName = n.data.conditionVariable || "zmienna";
        const op = n.data.conditionOperator || "==";
        const val = n.data.conditionValue || "";
        const trueComp = n.data.componentIdTrue ? compMap[n.data.componentIdTrue] : null;
        const falseComp = n.data.componentIdFalse ? compMap[n.data.componentIdFalse] : null;

        let condStr = `${idx + 1}. WARUNEK LOGICZNY: Jeśli (${varName} ${op} "${val}"):\n`;
        if (trueComp) condStr += `   -> WARUNEK SPEŁNIONY (TAK): Zastosuj wytyczne "${trueComp.title}":\n${trueComp.content}\n`;
        if (falseComp) condStr += `   -> WARUNEK NIESPEŁNIONY (NIE): Zastosuj wytyczne "${falseComp.title}":\n${falseComp.content}\n`;
        if (n.data.customText) condStr += `   Instrukcja dodatkowa: ${n.data.customText}\n`;
        parts.push(condStr);
      } else {
        parts.push(`${idx + 1}. [Warunek: ${n.data.label}] Expression: ${n.data.conditionExpr || "N/A"}. ${n.data.customText || ""}`);
      }
    });
  }

  // 5. Discount Rules
  const discountNodes = nodes.filter((n) => n.type === "discount_rule");
  if (discountNodes.length > 0) {
    parts.push("--- REGUŁY RABATOWE ---");
    discountNodes.forEach((n, idx: number) => {
      const typeLabel = n.data.discountConditionType === "net_total" ? "Wartość netto całego zamówienia" : n.data.discountConditionType === "area_m2" ? "Powierzchnia w m²" : "Wartość";
      parts.push(
        `${idx + 1}. [Rabat: ${n.data.label}] Jeśli ${typeLabel} >= ${n.data.discountThreshold ?? 0} -> zastosuj ${n.data.discountPercent ?? 0}% rabatu w polu "discountPercent" karty wyceny.`
      );
    });
  }

  // 6. Price Modifiers
  const modNodes = nodes.filter((n) => n.type === "price_modifier");
  if (modNodes.length > 0) {
    parts.push("--- MODYFIKATORY I DOPŁATY CENOWE ---");
    modNodes.forEach((n, idx: number) => {
      const typeStr = n.data.modifierType === "percent" ? `+${n.data.modifierValue}%` : `+${n.data.modifierValue} zł netto`;
      parts.push(
        `${idx + 1}. [Dopłata: ${n.data.modifierName || n.data.label}] Kwota/Wartość: ${typeStr} (Kategoria w karcie wyceny: ${n.data.modifierCategory || "extras"}). Dodaj tę dopłatę jako osobną pozycję lub uwzględnij w cenie.`
      );
    });
  }

  // 7. General Prompt Components & Custom Steps
  const genCompNodes = nodes.filter((n) => n.type === "prompt_component" || n.type === "custom_prompt");
  if (genCompNodes.length > 0) {
    parts.push("--- SWOBODNE PROMPTY TEKSTOWE I WYTYCZNE AI ---");
    genCompNodes.forEach((n) => {
      const comp = n.data.componentId ? compMap[n.data.componentId] : null;
      if (comp) {
        parts.push(`### ${comp.title}\n${comp.content}`);
      } else if (n.data.promptText) {
        parts.push(`### ${n.data.label}\n${n.data.promptText}`);
      } else if (n.data.customText) {
        parts.push(`### ${n.data.label}\n${n.data.customText}`);
      }
    });
  }

  // 8. Custom Text from remaining nodes
  const otherCustomText = nodes
    .filter((n) => n.data?.customText && !["condition_branch", "prompt_component"].includes(n.type))
    .map((n) => `### INSTRUKCJA: ${n.data.label}\n${n.data.customText}`);
  if (otherCustomText.length > 0) {
    parts.push(otherCustomText.join("\n\n"));
  }

  return parts.join("\n\n") + "\n\n";
}

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
  handler: async (ctx, args): Promise<{ replyText: string; estimateCard: unknown }> => {
    // 1. Pobierz konfigurację z bazy
    const config = await ctx.runQuery(api.aiAssistant.getAiConfigInternal);
    if (!config || !config.apiKey || !config.apiKey.trim()) {
      throw new Error("Brak skonfigurowanego klucza Anthropic API Key w Ustawieniach Asystenta.");
    }

    // Pobierz aktywny workflow dla danej usługi (jeśli wybrano w czacie)
    const activeWfData = (await ctx.runQuery(internal.aiWorkflows.getActiveWorkflowInternal, {
      serviceType: args.serviceType,
    })) as ActiveWfData | null;

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

    // Zbierz ustrukturyzowane wytyczne i logikę z aktywnego workflowu
    const workflowInstructions = buildWorkflowInstructions(activeWfData);

    const systemPrompt: string = `Jesteś profesjonalnym Asystentem Wycen dla firmy ADK Okna. Twoim zadaniem jest pomoc doradcom w kalkulacji kosztów stolarki budowlanej oraz Zabudów Tarasów (Zadaszenia, Ściany Przesuwne i Stałe, Trójkąty Boczne, Montaż).

${workflowInstructions}AKTUALNY CENNIK ZADASZEŃ, ŚCIAN, TRÓJKĄTÓW I MONTAŻU ADK OKNA (Dystrybutor):

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
        const errJson = (await response.json().catch(() => ({}))) as Record<string, { message?: string }>;
        throw new Error(
          `Błąd API Anthropic (${response.status}): ${errJson?.error?.message || response.statusText}`
        );
      }

      const data = (await response.json()) as { content?: Array<{ text?: string }> };
      const rawText: string = data.content?.[0]?.text || "";

      // Spróbuj sparsować odpowiedź JSON
      let parsedJson: { replyText?: string; estimateCard?: unknown } | null = null;
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
        replyText: parsedJson?.replyText || rawText,
        estimateCard: parsedJson?.estimateCard || null,
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
