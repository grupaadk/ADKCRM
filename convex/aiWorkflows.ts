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
          v.literal("question_step")
        ),
        position: v.object({ x: v.number(), y: v.number() }),
        data: v.object({
          label: v.string(),
          componentId: v.optional(v.id("aiPromptComponents")),
          priceTables: v.optional(v.array(v.string())),
          customText: v.optional(v.string()),
          conditionExpr: v.optional(v.string()),
          notificationTarget: v.optional(v.string()),

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
