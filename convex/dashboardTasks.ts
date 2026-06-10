import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { getCurrentUser, requireRole } from "./lib/auth";

export type DashboardTask = {
  _id: Id<"orderTasks">;
  title: string;
  status: "todo" | "in_progress" | "done";
  dueDate?: number;
  // Źródło zadania: zlecenie, szansa sprzedaży albo reklamacja.
  source: "order" | "opportunity" | "complaint";
  // Kontekst karty.
  orderId?: Id<"orders">;
  opportunityId?: Id<"pendingJotformSubmissions">;
  complaintId?: Id<"complaints">;
  clientId?: Id<"clients">;
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

function opportunityName(opp: Doc<"pendingJotformSubmissions">): string {
  return `${opp.firstName} ${opp.lastName}`.trim() || "—";
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

    // Cache na zlecenia / klientów / userów / reklamacje, by uniknąć powtórnych odczytów.
    const orderCache = new Map<string, Doc<"orders"> | null>();
    const clientCache = new Map<string, Doc<"clients"> | null>();
    const userCache = new Map<string, Doc<"users"> | null>();
    const oppCache = new Map<string, Doc<"pendingJotformSubmissions"> | null>();
    const complaintCache = new Map<string, Doc<"complaints"> | null>();

    const result = await Promise.all(
      tasks.map(async (task): Promise<DashboardTask | null> => {
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
        const assignee = {
          assignedUserId: task.assignedUserId,
          assignedUserName: assignedUser?.displayName ?? assignedUser?.email ?? null,
          assignedUserColor: assignedUser?.color ?? undefined,
        };

        // Zadanie szansy sprzedaży
        if (task.opportunityId) {
          let opp = oppCache.get(task.opportunityId);
          if (opp === undefined) {
            opp = await ctx.db.get(task.opportunityId);
            oppCache.set(task.opportunityId, opp);
          }
          if (!opp) return null; // osierocone — pomijamy
          return {
            _id: task._id,
            title: task.title,
            status: task.status,
            dueDate: task.dueDate,
            source: "opportunity",
            opportunityId: task.opportunityId,
            orderName: null,
            customText: opp.customText ?? null,
            clientName: opportunityName(opp),
            ...assignee,
          };
        }

        // Zadanie reklamacji
        if (task.complaintId) {
          let complaint = complaintCache.get(task.complaintId);
          if (complaint === undefined) {
            complaint = await ctx.db.get(task.complaintId);
            complaintCache.set(task.complaintId, complaint);
          }
          if (!complaint) return null; // osierocone — pomijamy

          let order = orderCache.get(complaint.orderId);
          if (order === undefined) {
            order = await ctx.db.get(complaint.orderId);
            orderCache.set(complaint.orderId, order);
          }
          if (!order) return null;

          let client = clientCache.get(order.clientId);
          if (client === undefined) {
            client = await ctx.db.get(order.clientId);
            clientCache.set(order.clientId, client);
          }

          return {
            _id: task._id,
            title: task.title,
            status: task.status,
            dueDate: task.dueDate,
            source: "complaint",
            complaintId: task.complaintId,
            orderId: complaint.orderId,
            clientId: order.clientId,
            orderName: order.name ?? null,
            customText: order.customText ?? null,
            clientName: clientName(client),
            ...assignee,
          };
        }

        // Zadanie zlecenia
        if (!task.orderId) return null; // brak powiązania — pomijamy
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

        return {
          _id: task._id,
          title: task.title,
          status: task.status,
          dueDate: task.dueDate,
          source: "order",
          orderId: task.orderId,
          clientId: order.clientId,
          orderName: order.name ?? null,
          customText: order.customText ?? null,
          clientName: clientName(client),
          ...assignee,
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

    const assignedUser = task.assignedUserId ? await ctx.db.get(task.assignedUserId) : null;
    const assignee = {
      assignedUserId: task.assignedUserId,
      assignedUserName: assignedUser?.displayName ?? assignedUser?.email ?? null,
      assignedUserColor: assignedUser?.color ?? undefined,
    };

    if (task.opportunityId) {
      const opp = await ctx.db.get(task.opportunityId);
      if (!opp) return null;
      return {
        _id: task._id,
        title: task.title,
        status: task.status,
        dueDate: task.dueDate,
        source: "opportunity",
        opportunityId: task.opportunityId,
        orderName: null,
        customText: opp.customText ?? null,
        clientName: opportunityName(opp),
        ...assignee,
      };
    }

    if (task.complaintId) {
      const complaint = await ctx.db.get(task.complaintId);
      if (!complaint) return null;
      const order = await ctx.db.get(complaint.orderId);
      if (!order) return null;
      const client = await ctx.db.get(order.clientId);
      return {
        _id: task._id,
        title: task.title,
        status: task.status,
        dueDate: task.dueDate,
        source: "complaint",
        complaintId: task.complaintId,
        orderId: complaint.orderId,
        clientId: order.clientId,
        orderName: order.name ?? null,
        customText: order.customText ?? null,
        clientName: clientName(client),
        ...assignee,
      };
    }

    if (!task.orderId) return null;
    const order = await ctx.db.get(task.orderId);
    if (!order) return null;
    const client = await ctx.db.get(order.clientId);

    return {
      _id: task._id,
      title: task.title,
      status: task.status,
      dueDate: task.dueDate,
      source: "order",
      orderId: task.orderId,
      clientId: order.clientId,
      orderName: order.name ?? null,
      customText: order.customText ?? null,
      clientName: clientName(client),
      ...assignee,
    };
  },
});

/**
 * Dodanie zadania z poziomu Dashboardu — wyłącznie administrator
 * (wybór dowolnego zlecenia + przypisanie osoby).
 */
export const adminCreate = mutation({
  args: {
    orderId: v.optional(v.id("orders")),
    opportunityId: v.optional(v.id("pendingJotformSubmissions")),
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
    if ((args.orderId == null) === (args.opportunityId == null)) {
      throw new ConvexError(
        "Zadanie musi należeć dokładnie do jednego: zlecenia lub szansy sprzedaży.",
      );
    }
    if (args.opportunityId) {
      const opp = await ctx.db.get(args.opportunityId);
      if (!opp) throw new ConvexError("Szansa sprzedaży nie istnieje.");
    } else if (args.orderId) {
      const order = await ctx.db.get(args.orderId);
      if (!order) throw new ConvexError("Zlecenie nie istnieje.");
    }
    return ctx.db.insert("orderTasks", {
      orderId: args.orderId,
      opportunityId: args.opportunityId,
      title: trimmed,
      status: args.status ?? "todo",
      dueDate: args.dueDate,
      assignedUserId: args.assignedUserId,
      createdBy: admin.email ?? admin._id,
    });
  },
});
