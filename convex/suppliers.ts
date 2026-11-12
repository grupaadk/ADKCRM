import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireUser, userIdentifier } from "./lib/auth";

export const list = query({
  args: { includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    if (args.includeInactive) {
      return ctx.db.query("suppliers").order("asc").collect();
    }
    return ctx.db
      .query("suppliers")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .order("asc")
      .collect();
  },
});

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("suppliers")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .order("asc")
      .collect();
  },
});

const supplierProductValidator = v.object({
  id: v.string(),
  name: v.string(),
  isActive: v.boolean(),
  questions: v.optional(
    v.array(
      v.object({
        id: v.string(),
        question: v.string(),
      })
    )
  ),
});

type SupplierProductInput = {
  id: string;
  name: string;
  isActive: boolean;
  questions?: Array<{
    id: string;
    question: string;
  }>;
};

function normalizeSupplierProducts(products: SupplierProductInput[]): SupplierProductInput[] {
  const seenNames = new Set<string>();
  return products.map((product) => {
    const trimmedName = product.name.trim();
    if (!trimmedName) {
      throw new Error("Nazwa produktu nie może być pusta");
    }
    const lowerKey = trimmedName.toLowerCase();
    if (seenNames.has(lowerKey)) {
      throw new Error(`Produkt "${trimmedName}" jest już przypisany do tego dostawcy`);
    }
    seenNames.add(lowerKey);
    const normalizedQuestions = (product.questions ?? [])
      .map((q) => ({
        id: q.id?.trim() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        question: q.question.trim(),
      }))
      .filter((q) => q.question.length > 0);
    return {
      id: product.id.trim() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: trimmedName,
      isActive: product.isActive,
      ...(normalizedQuestions.length > 0 ? { questions: normalizedQuestions } : {}),
    };
  });
}

export const create = mutation({
  args: {
    name: v.string(),
    estimatedLeadTime: v.optional(v.string()),
    products: v.optional(v.array(supplierProductValidator)),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const existing = await ctx.db
      .query("suppliers")
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();
    if (existing) throw new Error("Dostawca o tej nazwie już istnieje");

    const normalizedProducts = args.products ? normalizeSupplierProducts(args.products) : undefined;

    const supplierId = await ctx.db.insert("suppliers", {
      name: args.name,
      isActive: true,
      createdBy: userIdentifier(user),
      estimatedLeadTime: args.estimatedLeadTime?.trim() || undefined,
      products: normalizedProducts,
    });

    await ctx.db.insert("calendarEventTypes", {
      name: `${args.name} - Potwierdzenie`,
      color: "#10b981",
      isPrivate: false,
      linkedOrderField: "serviceDeliveries.confirmedDate",
      linkedSupplierId: supplierId,
      defaultTimeMode: "timed",
      createdAt: Date.now(),
    });

    await ctx.db.insert("calendarEventTypes", {
      name: `${args.name} - Dostawa`,
      color: "#f59e0b",
      isPrivate: false,
      linkedOrderField: "serviceDeliveries.deliveryDate",
      linkedSupplierId: supplierId,
      defaultTimeMode: "timed",
      createdAt: Date.now(),
    });

    await ctx.db.insert("calendarEventTypes", {
      name: `${args.name} - Odbiór`,
      color: "#3b82f6",
      isPrivate: false,
      linkedOrderField: "serviceDeliveries.receivedDate",
      linkedSupplierId: supplierId,
      defaultTimeMode: "timed",
      createdAt: Date.now(),
    });

    return supplierId;
  },
});

export const update = mutation({
  args: {
    id: v.id("suppliers"),
    name: v.optional(v.string()),
    apiEndpoint: v.optional(v.string()),
    apiKey: v.optional(v.string()),
    isApiEnabled: v.optional(v.boolean()),
    estimatedLeadTime: v.optional(v.string()),
    products: v.optional(v.array(supplierProductValidator)),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const { id, products, ...fields } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Nie znaleziono dostawcy");

    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) updates[key] = value;
    }
    if (products !== undefined) {
      updates.products = normalizeSupplierProducts(products);
    }
    await ctx.db.patch(id, updates);
  },
});

export const toggleActive = mutation({
  args: { id: v.id("suppliers") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Nie znaleziono dostawcy");
    await ctx.db.patch(args.id, { isActive: !existing.isActive });
  },
});

export const remove = mutation({
  args: { id: v.id("suppliers") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Nie znaleziono dostawcy");

    // Sprawdź czy używana w usługach
    const allServices = await ctx.db.query("services").collect();
    const usage = allServices.find((s) => s.supplierIds?.includes(args.id));
    if (usage) {
      throw new Error(
        "Nie można usunąć — dostawca jest przypisany do usług. Dezaktywuj zamiast usuwać.",
      );
    }

    await ctx.db.delete(args.id);
  },
});

export const getByIdInternal = query({
  args: { supplierId: v.id("suppliers") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.supplierId);
  },
});
