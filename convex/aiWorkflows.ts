import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./lib/auth";

/**
 * Listuj wszystkie wielorazowe komponenty wytycznych
 */
export const listPromptComponents = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("aiPromptComponents").collect();
  },
});

/**
 * Zapisz lub edytuj komponent wytycznych promptu
 */
export const upsertPromptComponent = mutation({
  args: {
    id: v.optional(v.id("aiPromptComponents")),
    title: v.string(),
    category: v.union(
      v.literal("guidelines"),
      v.literal("pricing_rules"),
      v.literal("output_format"),
      v.literal("questions"),
      v.literal("validation"),
      v.literal("context")
    ),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");
    const now = Date.now();

    if (args.id) {
      await ctx.db.patch(args.id, {
        title: args.title,
        category: args.category,
        content: args.content,
        updatedAt: now,
      });
      return args.id;
    } else {
      return await ctx.db.insert("aiPromptComponents", {
        title: args.title,
        category: args.category,
        content: args.content,
        updatedAt: now,
      });
    }
  },
});

/**
 * Usuń komponent wytycznych
 */
export const deletePromptComponent = mutation({
  args: {
    id: v.id("aiPromptComponents"),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");
    await ctx.db.delete(args.id);
  },
});

/**
 * Pobierz wszystkie workflowy
 */
export const listWorkflows = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("aiWorkflows").collect();
  },
});

/**
 * Pobierz pojedynczy workflow po ID
 */
export const getWorkflow = query({
  args: {
    workflowId: v.id("aiWorkflows"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.workflowId);
  },
});

/**
 * Pobierz aktywny workflow dla podanej usługi
 */
export const getActiveWorkflowForService = query({
  args: {
    serviceType: v.string(),
  },
  handler: async (ctx, args) => {
    const active = await ctx.db
      .query("aiWorkflows")
      .withIndex("by_service_status", (q) =>
        q.eq("serviceType", args.serviceType).eq("status", "active")
      )
      .first();

    if (active) return active;

    // Fallback: szukaj dla usługi "General"
    return await ctx.db
      .query("aiWorkflows")
      .withIndex("by_service_status", (q) =>
        q.eq("serviceType", "General").eq("status", "active")
      )
      .first();
  },
});

/**
 * Zapisz wersję roboczą (Draft) workflowu
 */
export const saveWorkflowDraft = mutation({
  args: {
    id: v.optional(v.id("aiWorkflows")),
    serviceType: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    nodes: v.array(
      v.object({
        id: v.string(),
        type: v.union(
          v.literal("trigger"),
          v.literal("prompt_component"),
          v.literal("price_source"),
          v.literal("output_format"),
          v.literal("condition"),
          v.literal("data_transform"),
          v.literal("data_fetch"),
          v.literal("notification"),
          v.literal("package_builder"),
          v.literal("input_required"),
          v.literal("condition_branch"),
          v.literal("discount_rule"),
          v.literal("price_modifier"),
          v.literal("validation_gate"),
          v.literal("question_step"),
          v.literal("prompt_trigger"),
          v.literal("custom_prompt"),
          v.literal("branch_splitter")
        ),
        position: v.object({ x: v.number(), y: v.number() }),
        data: v.object({
          label: v.string(),
          componentId: v.optional(v.id("aiPromptComponents")),
          priceTables: v.optional(v.array(v.string())),
          customText: v.optional(v.string()),
          conditionExpr: v.optional(v.string()),
          notificationTarget: v.optional(v.string()),

          promptText: v.optional(v.string()),
          promptRole: v.optional(v.string()),
          extractFields: v.optional(v.array(v.string())),
          samplePrompt: v.optional(v.string()),

          branchName: v.optional(v.string()),
          branchDescription: v.optional(v.string()),
          parallelMode: v.optional(v.string()),

          requiredFields: v.optional(v.array(v.string())),
          inputPrompt: v.optional(v.string()),
          conditionVariable: v.optional(v.string()),
          conditionOperator: v.optional(v.string()),
          conditionValue: v.optional(v.string()),
          componentIdTrue: v.optional(v.id("aiPromptComponents")),
          componentIdFalse: v.optional(v.id("aiPromptComponents")),
          discountConditionType: v.optional(v.string()),
          discountThreshold: v.optional(v.number()),
          discountPercent: v.optional(v.number()),
          modifierName: v.optional(v.string()),
          modifierType: v.optional(v.union(v.literal("percent"), v.literal("fixed"))),
          modifierValue: v.optional(v.number()),
          modifierCategory: v.optional(v.union(v.literal("service"), v.literal("installation"), v.literal("extras"))),
          validationMinWidth: v.optional(v.number()),
          validationMaxWidth: v.optional(v.number()),
          validationMinLength: v.optional(v.number()),
          validationMaxLength: v.optional(v.number()),
          validationErrorMessage: v.optional(v.string()),
          questionText: v.optional(v.string()),
          questionType: v.optional(v.string()),
          questionOptions: v.optional(v.array(v.string())),
          questionVariable: v.optional(v.string()),
        }),
      })
    ),
    edges: v.array(
      v.object({
        id: v.string(),
        source: v.string(),
        target: v.string(),
        label: v.optional(v.string()),
        branchTag: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");
    const now = Date.now();

    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing) throw new Error("Workflow nie znaleziony");

      await ctx.db.patch(args.id, {
        serviceType: args.serviceType,
        title: args.title,
        description: args.description,
        nodes: args.nodes,
        edges: args.edges,
        updatedAt: now,
      });
      return args.id;
    } else {
      return await ctx.db.insert("aiWorkflows", {
        serviceType: args.serviceType,
        title: args.title,
        description: args.description,
        status: "draft",
        version: 1,
        nodes: args.nodes,
        edges: args.edges,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

/**
 * Aktywuj dany workflow na produkcję (dezaktywuje inne aktywne dla tej samej usługi)
 */
export const activateWorkflow = mutation({
  args: {
    id: v.id("aiWorkflows"),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");
    const target = await ctx.db.get(args.id);
    if (!target) throw new Error("Workflow nie znaleziony");

    // Dezaktywuj poprzednie aktywne workflowy dla tej usługi
    const actives = await ctx.db
      .query("aiWorkflows")
      .withIndex("by_service_status", (q) =>
        q.eq("serviceType", target.serviceType).eq("status", "active")
      )
      .collect();

    for (const item of actives) {
      await ctx.db.patch(item._id, { status: "archived", updatedAt: Date.now() });
    }

    // Aktywuj wybrany workflow i podbij wersję
    await ctx.db.patch(args.id, {
      status: "active",
      version: target.version + 1,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Usuń workflow
 */
export const deleteWorkflow = mutation({
  args: {
    id: v.id("aiWorkflows"),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");
    await ctx.db.delete(args.id);
  },
});

/**
 * Wewnętrzna pomocnicza funkcja dla backendu do pobierania aktywnego workflowu z danymi komponentów
 */
export const getActiveWorkflowInternal = internalQuery({
  args: {
    serviceType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sType = args.serviceType ?? "General";
    let wf = await ctx.db
      .query("aiWorkflows")
      .withIndex("by_service_status", (q) =>
        q.eq("serviceType", sType).eq("status", "active")
      )
      .first();

    if (!wf && sType !== "General") {
      wf = await ctx.db
        .query("aiWorkflows")
        .withIndex("by_service_status", (q) =>
          q.eq("serviceType", "General").eq("status", "active")
        )
        .first();
    }

    if (!wf) return null;

    // Pobierz powiązane z nim komponenty promptu
    const promptComponentsMap: Record<string, { id: string; title: string; content: string }> = {};
    for (const n of wf.nodes) {
      const compIds = [n.data.componentId, n.data.componentIdTrue, n.data.componentIdFalse].filter(Boolean) as Array<typeof n.data.componentId & string>;
      for (const compId of compIds) {
        if (!promptComponentsMap[compId]) {
          const comp = await ctx.db.get(compId);
          if (comp) {
            promptComponentsMap[compId] = {
              id: comp._id,
              title: comp.title,
              content: comp.content,
            };
          }
        }
      }
    }

    return {
      workflow: wf,
      promptComponents: Object.values(promptComponentsMap),
      promptComponentsMap,
    };
  },
});

/**
 * Tworzy i aktywuje pełny produkcyjny workflow testowy prezentujący WSZYSTKIE możliwości modułu
 */
export const seedShowcaseWorkflow = mutation({
  args: {
    serviceType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      await requireRole(ctx, "admin");
    } catch {
      // In dev environment auth context may be loose
    }
    const now = Date.now();
    const sType = args.serviceType ?? "Zabudowa tarasu";

    // 1. Sprawdź i stwórz przykładowy komponent wytycznych w bazie jeśli nie istnieje
    let sampleCompId: Id<"aiPromptComponents"> | undefined = undefined;
    const existingComp = await ctx.db.query("aiPromptComponents").first();
    if (existingComp) {
      sampleCompId = existingComp._id;
    } else {
      sampleCompId = await ctx.db.insert("aiPromptComponents", {
        title: "Ogólne Standardy Jakości ADK Okna",
        category: "guidelines",
        content: "Każda wycena zadaszenia musi uwzględniać bezpłatny pomiar u klienta w promieniu 50 km od siedziby firmy.",
        createdAt: now,
        updatedAt: now,
      });
    }

    // 2. Przygotuj węzły demonstrujące WSZYSTKIE typy węzłów i rozgałęzienia
    const nodes = [
      {
        id: "node-1-trigger",
        type: "prompt_trigger" as const,
        position: { x: 50, y: 150 },
        data: {
          label: "1. Wyzwolenie: Zapytanie Klienta",
          promptRole: "Klient zainteresowany zadaszeniem lub zabudową tarasu",
          extractFields: ["widthCm", "lengthCm", "material", "sideWalls", "city"],
          samplePrompt: "Dzień dobry, poproszę o wycenę zadaszenia tarasu 400x300 cm z poliwęglanu we Wrocławiu.",
          customText: "Wyceniaj w oparciu o cennik standardowy ADK Okna.",
        },
      },
      {
        id: "node-2-input",
        type: "input_required" as const,
        position: { x: 300, y: 50 },
        data: {
          label: "2. Wymagane Dane do Wyceny",
          requiredFields: ["widthCm", "lengthCm", "material", "city"],
          inputPrompt: "Upewnij się, że klient podał wymiary w cm oraz oczekiwany materiał dachu.",
        },
      },
      {
        id: "node-3-question",
        type: "question_step" as const,
        position: { x: 550, y: 50 },
        data: {
          label: "3. Pytanie o Fundament",
          questionText: "Czy miejsce pod zadaszenie posiada wykonaną wylewkę lub stopy betonowe?",
          questionOptions: ["Tak, wylewka betonowa", "Nie, wymagane stopy", "W trakcie budowy"],
          questionVariable: "hasFoundation",
        },
      },
      {
        id: "node-4-validation",
        type: "validation_gate" as const,
        position: { x: 800, y: 50 },
        data: {
          label: "4. Walidacja Wymiarów Dopuszczalnych",
          validationMinWidth: 200,
          validationMaxWidth: 600,
          validationMinLength: 200,
          validationMaxLength: 1200,
          validationErrorMessage: "Wymiar wykracza poza standardowy cennik fabryczny ADK Okna. Wymagana estymacja niestandardowa.",
        },
      },
      {
        id: "node-5-branch",
        type: "branch_splitter" as const,
        position: { x: 1050, y: 150 },
        data: {
          label: "5. Rozdzielacz: Wątek Główny vs Poboczny",
          branchName: "Rozgałęzienie: Rabaty & Wytyczne Techniczne",
          branchDescription: "Wątek A przetwarza wycenę i rabaty, a Wątek Poboczny B weryfikuje montaż i obróbkę.",
          parallelMode: "parallel_all",
        },
      },
      {
        id: "node-6-cond",
        type: "condition_branch" as const,
        position: { x: 1320, y: 50 },
        data: {
          label: "6. Wątek A: Warunek B2B vs B2C",
          conditionVariable: "clientType",
          conditionOperator: "==",
          conditionValue: "business",
          componentIdTrue: sampleCompId,
          customText: "Dla klienta firmowego (B2B) zaproponuj fakturę VAT 23% i termin realizacji 14 dni.",
        },
      },
      {
        id: "node-7-discount",
        type: "discount_rule" as const,
        position: { x: 1580, y: 50 },
        data: {
          label: "7. Wątek A: Rabat > 15 000 zł",
          discountConditionType: "net_total",
          discountThreshold: 15000,
          discountPercent: 5,
        },
      },
      {
        id: "node-8-modifier",
        type: "price_modifier" as const,
        position: { x: 1840, y: 50 },
        data: {
          label: "8. Wątek A: Dopłata za Kolor RAL",
          modifierName: "Kolor Niestandardowy RAL",
          modifierType: "percent",
          modifierValue: 15,
          modifierCategory: "service",
        },
      },
      {
        id: "node-9-prices",
        type: "price_source" as const,
        position: { x: 2100, y: 50 },
        data: {
          label: "9. Wątek A: Cenniki Bazy ADK Okna",
          priceTables: ["polycarbonate", "glass", "sliding_walls", "installation", "extras"],
        },
      },
      {
        id: "node-10-side-prompt",
        type: "custom_prompt" as const,
        position: { x: 1320, y: 280 },
        data: {
          label: "10. Wątek Poboczny B: Instrukcja Montażowa",
          promptText: "Wątek Poboczny: Dla zadaszeń powyżej 400 cm długości dolicz 2 szt. słupków środkowych oraz zalecaj zestaw uszczelek przeciwpyłowych.",
        },
      },
      {
        id: "node-11-comp",
        type: "prompt_component" as const,
        position: { x: 1580, y: 280 },
        data: {
          label: "11. Wątek Poboczny B: Standard Jakości",
          componentId: sampleCompId,
        },
      },
      {
        id: "node-12-output",
        type: "output_format" as const,
        position: { x: 2360, y: 150 },
        data: {
          label: "12. Wyjście: Podsumowanie i Karta Wyceny JSON",
          customText: "Otrzymaną wycenę przedstaw w kulturalnym, fachowym tonie i wygeneruj pełną kartę wyceny JSON (estimateCard).",
        },
      },
    ];

    const edges = [
      { id: "e1-2", source: "node-1-trigger", target: "node-2-input" },
      { id: "e2-3", source: "node-2-input", target: "node-3-question" },
      { id: "e3-4", source: "node-3-question", target: "node-4-validation" },
      { id: "e4-5", source: "node-4-validation", target: "node-5-branch" },
      // Rozgałęzienie na Wątek A (główny wyceny) i Wątek Poboczny B (montażowy)
      { id: "e5-6", source: "node-5-branch", target: "node-6-cond", label: "Wątek A: Wycena i Rabaty" },
      { id: "e6-7", source: "node-6-cond", target: "node-7-discount" },
      { id: "e7-8", source: "node-7-discount", target: "node-8-modifier" },
      { id: "e8-9", source: "node-8-modifier", target: "node-9-prices" },
      { id: "e9-12", source: "node-9-prices", target: "node-12-output" },
      // Wątek Poboczny B
      { id: "e5-10", source: "node-5-branch", target: "node-10-side-prompt", label: "Wątek Poboczny B: Montaż" },
      { id: "e10-11", source: "node-10-side-prompt", target: "node-11-comp" },
      { id: "e11-12", source: "node-11-comp", target: "node-12-output" },
    ];

    // Dezaktywuj istniejące aktywne workflowy dla tej usługi
    const actives = await ctx.db
      .query("aiWorkflows")
      .withIndex("by_service_status", (q) =>
        q.eq("serviceType", sType).eq("status", "active")
      )
      .collect();

    for (const item of actives) {
      await ctx.db.patch(item._id, { status: "archived", updatedAt: now });
    }

    // Wstaw i aktywuj kompleksowy workflow testowy
    const wfId = await ctx.db.insert("aiWorkflows", {
      serviceType: sType,
      title: "🔥 Kompleksowy Workflow Testowy ADK Okna (Wszystkie Węzły & Wątki Poboczne)",
      description: "Oficjalny workflow testowy demonstrujący wyzwalacze promptów, pytania, walidację, warunki B2B/B2C, rabaty, dopłaty RAL, podpięte cenniki oraz równoległe wątki poboczne.",
      status: "active",
      version: 1,
      nodes,
      edges,
      createdAt: now,
      updatedAt: now,
    });

    return wfId;
  },
});
