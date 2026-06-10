import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { getCurrentUser, requireRole } from "./lib/auth";

export type DashboardTask = {
  _id: Id<"orderTasks">;
  title: string;
  status: "todo" | "in_progress" | "done";
  dueDate?: number;
  // Zlecenie + klient (kontekst karty)
  orderId: Id<"orders">;
  clientId: Id<"clients">;
  orderName: string | null;
  customText: string | null;
  clientName: string;
  // Przypisana osoba
  assignedUserId?: Id<"users">;
  assignedUserName: string | null;
  assignedUserColor?: string;
};

function clientName(client: Doc<"clients"> | null): string {
  if (!client) return "—";
  if (client.clientType === "business" && client.companyName) return client.companyName;
  return `${client.lastName} ${client.firstName}`.trim() || "—";
}

/**
 * Lista zadań na Dashboard.
 *
 * - Zwykły user (sales/montaz): zawsze TYLKO swoje zadania — argument `filter`
 *   jest ignorowany (kontrola dostępu po stronie serwera).
 * - Admin: domyślnie wszystkie zadania. `filter` pozwala zawęzić do:
 *     - konkretnego usera (Id<"users">)
 *     - "unassigned" — zadania bez przypisanej osoby
 *     - "all" / brak — wszystkie zadania
 */
export const list = query({
  args: {
    filter: v.optional(
      v.union(v.id("users"), v.literal("all"), v.literal("unassigned")),
    ),
  },
  handler: async (ctx, { filter }): Promise<DashboardTask[]> => {
    const me = await getCurrentUser(ctx);
    if (!me || me.isActive !== true) return [];

    const isAdmin = me.role === "admin";

    let tasks: Doc<"orderTasks">[];
    if (!isAdmin) {
      // Zwykły user — tylko własne zadania, niezależnie od `filter`.
      tasks = await ctx.db
        .query("orderTasks")
        .withIndex("by_assignee", (q) => q.eq("assignedUserId", me._id))
        .collect();
    } else if (filter === "unassigned") {
      tasks = await ctx.db
        .query("orderTasks")
        .withIndex("by_assignee", (q) => q.eq("assignedUserId", undefined))
        .collect();
    } else if (filter && filter !== "all") {
      tasks = await ctx.db
        .query("orderTasks")
        .withIndex("by_assignee", (q) => q.eq("assignedUserId", filter))
        .collect();
    } else {
      // Admin, brak filtra / "all" — wszystkie zadania.
      tasks = await ctx.db.query("orderTasks").collect();
    }

    // Cache na zlecenia / klientów / userów, by uniknąć powtórnych odczytów.
    const orderCache = new Map<string, Doc<"orders"> | null>();
    const clientCache = new Map<string, Doc<"clients"> | null>();
    const userCache = new Map<string, Doc<"users"> | null>();

    const result = await Promise.all(
      tasks.map(async (task): Promise<DashboardTask | null> => {
        let order = orderCache.get(task.orderId);
        if (order === undefined) {
          order = await ctx.db.get(task.orderId);
          orderCache.set(task.orderId, order);
        }
        if (!order) return null; // osierocone zadanie — pomijamy

        let client = clientCache.get(order.clientId);
        if (client === undefined) {
          client = await ctx.db.get(order.clientId);
          clientCache.set(order.clientId, client);
        }

        let assignedUser: Doc<"users"> | null = null;
        if (task.assignedUserId) {
          const cached = userCache.get(task.assignedUserId);
          if (cached === undefined) {
            assignedUser = await ctx.db.get(task.assignedUserId);
            userCache.set(task.assignedUserId, assignedUser);
          } else {
            assignedUser = cached;
          }
        }

        return {
          _id: task._id,
          title: task.title,
          status: task.status,
          dueDate: task.dueDate,
          orderId: task.orderId,
          clientId: order.clientId,
          orderName: order.name ?? null,
          customText: order.customText ?? null,
          clientName: clientName(client),
          assignedUserId: task.assignedUserId,
          assignedUserName:
            assignedUser?.displayName ?? assignedUser?.email ?? null,
          assignedUserColor: assignedUser?.color ?? undefined,
        };
      }),
    );

    return result.filter((t): t is DashboardTask => t !== null);
  },
});

/**
 * Pojedyncze zadanie wzbogacone o kontekst zlecenia/klienta — dla panelu szczegółów.
 */
export const getOne = query({
  args: { taskId: v.id("orderTasks") },
  handler: async (ctx, { taskId }): Promise<DashboardTask | null> => {
    const me = await getCurrentUser(ctx);
    if (!me || me.isActive !== true) return null;

    const task = await ctx.db.get(taskId);
    if (!task) return null;

    const order = await ctx.db.get(task.orderId);
    if (!order) return null;
    const client = await ctx.db.get(order.clientId);
    const assignedUser = task.assignedUserId ? await ctx.db.get(task.assignedUserId) : null;

    return {
      _id: task._id,
      title: task.title,
      status: task.status,
      dueDate: task.dueDate,
      orderId: task.orderId,
      clientId: order.clientId,
      orderName: order.name ?? null,
      customText: order.customText ?? null,
      clientName: clientName(client),
      assignedUserId: task.assignedUserId,
      assignedUserName: assignedUser?.displayName ?? assignedUser?.email ?? null,
      assignedUserColor: assignedUser?.color ?? undefined,
    };
  },
});

/**
 * Dodanie zadania z poziomu Dashboardu — wyłącznie administrator
 * (wybór dowolnego zlecenia + przypisanie osoby).
 */
export const adminCreate = mutation({
  args: {
    orderId: v.id("orders"),
    title: v.string(),
    status: v.optional(
      v.union(v.literal("todo"), v.literal("in_progress"), v.literal("done")),
    ),
    dueDate: v.optional(v.number()),
    assignedUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const admin = await requireRole(ctx, "admin");
    const trimmed = args.title.trim();
    if (!trimmed) throw new ConvexError("Treść zadania jest wymagana.");
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new ConvexError("Zlecenie nie istnieje.");
    return ctx.db.insert("orderTasks", {
      orderId: args.orderId,
      title: trimmed,
      status: args.status ?? "todo",
      dueDate: args.dueDate,
      assignedUserId: args.assignedUserId,
      createdBy: admin.email ?? admin._id,
    });
  },
});
