import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireUser, userIdentifier } from "./lib/auth";

export const list = query({
  args: { includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    if (args.includeInactive) {
      return ctx.db.query("services").order("asc").collect();
    }
    return ctx.db
      .query("services")
      .withIndex("by_active_sort", (q) => q.eq("isActive", true))
      .order("asc")
      .collect();
  },
});

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("services")
      .withIndex("by_active_sort", (q) => q.eq("isActive", true))
      .order("asc")
      .collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    defaultTasks: v.optional(v.array(v.object({
      title: v.string(),
      daysToComplete: v.optional(v.number()),
    }))),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const existing = await ctx.db
      .query("services")
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();
    if (existing) throw new Error("Usługa o tej nazwie już istnieje");

    const last = await ctx.db
      .query("services")
      .withIndex("by_active_sort")
      .order("desc")
      .first();

    return ctx.db.insert("services", {
      name: args.name,
      isActive: true,
      sortOrder: (last?.sortOrder ?? 0) + 1,
      description: args.description,
      icon: args.icon,
      defaultTasks: args.defaultTasks,
      createdBy: userIdentifier(user),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("services"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    defaultTasks: v.optional(v.array(v.object({
      title: v.string(),
      daysToComplete: v.optional(v.number()),
    }))),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Nie znaleziono usługi");

    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) updates[key] = value;
    }
    await ctx.db.patch(id, updates);
  },
});

export const toggleActive = mutation({
  args: { id: v.id("services") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Nie znaleziono usługi");
    await ctx.db.patch(args.id, { isActive: !existing.isActive });
  },
});

export const remove = mutation({
  args: { id: v.id("services") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Nie znaleziono usługi");

    // Sprawdź czy używana w szansach sprzedaży
    const opportunityUsage = await ctx.db
      .query("pendingJotformSubmissions")
      .filter((q) => q.eq(q.field("services"), [existing.name]))
      .first();
    if (opportunityUsage) {
      throw new Error(
        "Nie można usunąć — usługa jest używana w szansach sprzedaży. Dezaktywuj zamiast usuwać.",
      );
    }

    // Sprawdź czy używana w zleceniach
    const orderUsage = await ctx.db
      .query("orders")
      .filter((q) => q.eq(q.field("services"), [existing.name]))
      .first();
    if (orderUsage) {
      throw new Error(
        "Nie można usunąć — usługa jest używana w zleceniach. Dezaktywuj zamiast usuwać.",
      );
    }

    await ctx.db.delete(args.id);
  },
});

export const reorder = mutation({
  args: { id: v.id("services"), sortOrder: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Nie znaleziono usługi");
    await ctx.db.patch(args.id, { sortOrder: args.sortOrder });
  },
});

export const assignSuppliers = mutation({
  args: {
    serviceId: v.id("services"),
    supplierIds: v.array(v.id("suppliers")),
  },
  handler: async (ctx, args) => {
    const service = await ctx.db.get(args.serviceId);
    if (!service) throw new Error("Nie znaleziono usługi");

    await ctx.db.patch(args.serviceId, {
      supplierIds: args.supplierIds.length > 0 ? args.supplierIds : undefined,
    });
  },
});

// Seed — wstawia domyślne 8 usług z ikonami jeśli tabela jest pusta
export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("services").first();
    if (existing) return { seeded: false };

    const defaults = [
      { name: "Okna", icon: "AppWindow" },
      { name: "Drzwi", icon: "DoorClosed" },
      { name: "Brama", icon: "Warehouse" },
      { name: "Zabudowa tarasu", icon: "Sun" },
      { name: "Konstrukcja aluminiowa", icon: "Building2" },
      { name: "Ogrodzenie", icon: "ShieldCheck" },
      { name: "System przeciwsłoneczny", icon: "Umbrella" },
      { name: "Inne", icon: "Settings" },
    ];

    const user = await requireUser(ctx);
    const uid = userIdentifier(user);

    for (let i = 0; i < defaults.length; i++) {
      await ctx.db.insert("services", {
        name: defaults[i].name,
        icon: defaults[i].icon,
        isActive: true,
        sortOrder: i + 1,
        createdBy: uid,
      });
    }

    return { seeded: true };
  },
});

// migrateIcons — przypisuje domyślne ikony do istniejących usług w bazie
export const migrateIcons = mutation({
  args: {},
  handler: async (ctx) => {
    const list = await ctx.db.query("services").collect();
    const mapping: Record<string, string> = {
      "Okna": "AppWindow",
      "Okna PCV": "AppWindow",
      "Drzwi": "DoorClosed",
      "Brama": "Warehouse",
      "Bramy garażowe": "Warehouse",
      "Zabudowa tarasu": "Sun",
      "Ogrody letnie/zimowe": "Sun",
      "Ogród Letni": "Sun",
      "Konstrukcja aluminiowa": "Building2",
      "Fasady": "Building2",
      "Witryny": "Maximize",
      "Ogrodzenie": "ShieldCheck",
      "System przeciwsłoneczny": "Umbrella",
      "Zadaszenia": "Umbrella",
      "Systemy całokształtne": "Layers",
      "Belki aluminiowe": "AlignJustify",
      "Pergole": "AlignJustify",
      "Lamele": "Sliders",
      "Żaluzje fasadowe": "Sliders",
      "Rolety": "ChevronDown",
      "Inne": "Settings"
    };

    let count = 0;
    for (const svc of list) {
      const match = mapping[svc.name];
      if (match) {
        await ctx.db.patch(svc._id, { icon: match });
        count++;
      } else {
        await ctx.db.patch(svc._id, { icon: "Settings" });
        count++;
      }
    }
    return { migrated: count };
  },
});
