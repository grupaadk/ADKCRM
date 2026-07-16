import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { getCurrentUser, requireRole } from "./lib/auth";

export type TaskType = "order" | "opportunity" | "complaint" | "general";

export type DashboardTask = {
  _id: Id<"orderTasks">;
  title: string;
  status: "todo" | "in_progress" | "done";
  priority?: "high" | "normal";
  completedAt?: number;
  archived?: boolean;
  archivedAt?: number;
  dueDate?: number;
  position?: number;
  // Źródło zadania: zlecenie, szansa sprzedaży albo reklamacja.
  source: TaskType;
  // Opcjonalne przypisanie do niestandardowej kolumny
  columnId?: Id<"taskColumns">;
  columnChangedAt?: number;
  // Kontekst karty.
  orderId?: Id<"orders">;
  opportunityId?: Id<"pendingJotformSubmissions">;
  complaintId?: Id<"complaints">;
  clientId?: Id<"clients">;
  orderName: string | null;
  customText: string | null;
  clientName: string;
  // Przypisana osoba (legacy)
  assignedUserId?: Id<"users">;
  assignedUserName: string | null;
  assignedUserColor?: string;
  // Lista wszystkich przypisanych
  assignees?: {
    id: Id<"users">;
    name: string | null;
    color?: string;
  }[];
  labelIds?: Id<"taskLabels">[];
  labels?: {
    id: Id<"taskLabels">;
    title: string;
    color: string;
  }[];
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

    const allTasks = await ctx.db.query("orderTasks").collect();
    let tasks: Doc<"orderTasks">[];

    if (!isAdmin) {
      // Zwykły user — tylko własne zadania
      tasks = allTasks.filter(t => 
        t.assignedUserId === me._id || (t.assignedUserIds && t.assignedUserIds.includes(me._id))
      );
    } else if (filter === "unassigned") {
      tasks = allTasks.filter(t => 
        !t.assignedUserId && (!t.assignedUserIds || t.assignedUserIds.length === 0)
      );
    } else if (filter && filter !== "all") {
      tasks = allTasks.filter(t => 
        t.assignedUserId === filter || (t.assignedUserIds && t.assignedUserIds.includes(filter))
      );
    } else {
      // Admin, brak filtra / "all" — wszystkie zadania.
      tasks = allTasks;
    }

    // Cache na zlecenia / klientów / userów / reklamacje, by uniknąć powtórnych odczytów.
    const orderCache = new Map<string, Doc<"orders"> | null>();
    const clientCache = new Map<string, Doc<"clients"> | null>();
    const userCache = new Map<string, Doc<"users"> | null>();
    const oppCache = new Map<string, Doc<"pendingJotformSubmissions"> | null>();
    const complaintCache = new Map<string, Doc<"complaints"> | null>();

    const allLabels = await ctx.db.query("taskLabels").collect();
    const labelMap = new Map(allLabels.map((l) => [l._id, l]));

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

        const assigneesArray = Array.from(new Set([
          ...(task.assignedUserId ? [task.assignedUserId] : []),
          ...(task.assignedUserIds || [])
        ]));

        const resolvedAssignees = await Promise.all(assigneesArray.map(async (uid) => {
          let u = userCache.get(uid);
          if (u === undefined) {
            u = await ctx.db.get(uid);
            userCache.set(uid, u);
          }
          if (!u) return null;
          return {
            id: u._id,
            name: u.displayName ?? u.email ?? null,
            color: u.color ?? undefined,
          };
        }));

        const finalAssignees = resolvedAssignees.filter((u): u is NonNullable<typeof u> => u !== null);

        const resolvedLabels = (task.labelIds || [])
          .map((id) => labelMap.get(id))
          .filter((l): l is Doc<"taskLabels"> => !!l)
          .map((l) => ({
            id: l._id,
            title: l.title,
            color: l.color,
          }));

        const assigneeProps = {
          assignedUserId: task.assignedUserId,
          assignedUserName: assignedUser?.displayName ?? assignedUser?.email ?? null,
          assignedUserColor: assignedUser?.color ?? undefined,
          assignees: finalAssignees,
          labelIds: task.labelIds,
          labels: resolvedLabels,
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
            priority: task.priority,
            completedAt: task.completedAt,
            archived: task.archived,
            archivedAt: task.archivedAt,
            dueDate: task.dueDate,
            source: "opportunity",
            opportunityId: task.opportunityId,
            orderName: null,
            customText: opp.customText ?? null,
            clientName: opportunityName(opp),
            columnId: task.columnId,
            columnChangedAt: task.columnChangedAt,
            position: task.position,
            ...assigneeProps,
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

          let order = complaint.orderId ? orderCache.get(complaint.orderId) : undefined;
          if (complaint.orderId && order === undefined) {
            order = await ctx.db.get(complaint.orderId);
            orderCache.set(complaint.orderId, order);
          }
          const client = order
            ? (() => {
                const c = clientCache.get(order.clientId);
                if (c === undefined) return undefined; // will be fetched below
                return c;
              })()
            : undefined;

          // Fetch client: prefer via order, fallback via complaint.clientId
          let resolvedClient = client;
          if (!resolvedClient) {
            const cid = order?.clientId ?? complaint.clientId;
            resolvedClient = clientCache.get(cid);
            if (resolvedClient === undefined) {
              resolvedClient = await ctx.db.get(cid);
              if (resolvedClient) clientCache.set(cid, resolvedClient);
            }
          }

          return {
            _id: task._id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            completedAt: task.completedAt,
            archived: task.archived,
            archivedAt: task.archivedAt,
            dueDate: task.dueDate,
            source: "complaint",
            complaintId: task.complaintId,
            orderId: complaint.orderId,
            clientId: order?.clientId ?? complaint.clientId,
            orderName: order?.name ?? null,
            customText: order?.customText ?? null,
            clientName: clientName(resolvedClient ?? null),
            columnId: task.columnId,
            columnChangedAt: task.columnChangedAt,
            position: task.position,
            ...assigneeProps,
          };
        }

        // Zadanie zlecenia lub ogólne
        if (task.orderId) {
          let order = orderCache.get(task.orderId);
          if (order === undefined) {
            order = await ctx.db.get(task.orderId);
            orderCache.set(task.orderId, order);
          }
          if (order) {
            let client = clientCache.get(order.clientId);
            if (client === undefined) {
              client = await ctx.db.get(order.clientId);
              clientCache.set(order.clientId, client);
            }

            return {
              _id: task._id,
              title: task.title,
              status: task.status,
              priority: task.priority,
              completedAt: task.completedAt,
              archived: task.archived,
              archivedAt: task.archivedAt,
              dueDate: task.dueDate,
              source: "order",
              orderId: task.orderId,
              clientId: order.clientId,
              orderName: order.name ?? null,
              customText: order.customText ?? null,
              clientName: clientName(client),
              columnId: task.columnId,
              columnChangedAt: task.columnChangedAt,
              position: task.position,
              ...assigneeProps,
            };
          }
        }

        // Zadanie ogólne (brak orderId, opportunityId, complaintId)
        return {
          _id: task._id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          completedAt: task.completedAt,
          archived: task.archived,
          archivedAt: task.archivedAt,
          dueDate: task.dueDate,
          source: "general",
          orderName: null,
          customText: null,
          clientName: "Zadanie",
          columnId: task.columnId,
          columnChangedAt: task.columnChangedAt,
          position: task.position,
          ...assigneeProps,
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
    
    const assigneesArray = Array.from(new Set([
      ...(task.assignedUserId ? [task.assignedUserId] : []),
      ...(task.assignedUserIds || [])
    ]));

    const resolvedAssignees = await Promise.all(assigneesArray.map(async (uid) => {
      const u = await ctx.db.get(uid);
      if (!u) return null;
      return {
        id: u._id,
        name: u.displayName ?? u.email ?? null,
        color: u.color ?? undefined,
      };
    }));

    const finalAssignees = resolvedAssignees.filter((u): u is NonNullable<typeof u> => u !== null);

    const resolvedLabels = await Promise.all(
      (task.labelIds || []).map(async (id) => {
        const l = await ctx.db.get(id);
        if (!l) return null;
        return {
          id: l._id,
          title: l.title,
          color: l.color,
        };
      })
    );
    const finalLabels = resolvedLabels.filter((l): l is NonNullable<typeof l> => l !== null);

    const assigneeProps = {
      assignedUserId: task.assignedUserId,
      assignedUserName: assignedUser?.displayName ?? assignedUser?.email ?? null,
      assignedUserColor: assignedUser?.color ?? undefined,
      assignees: finalAssignees,
      labelIds: task.labelIds,
      labels: finalLabels,
    };

    if (task.opportunityId) {
      const opp = await ctx.db.get(task.opportunityId);
      if (!opp) return null;
      return {
        _id: task._id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        completedAt: task.completedAt,
        archived: task.archived,
        archivedAt: task.archivedAt,
        dueDate: task.dueDate,
        source: "opportunity",
        opportunityId: task.opportunityId,
        orderName: null,
        customText: opp.customText ?? null,
        clientName: opportunityName(opp),
        columnId: task.columnId,
        columnChangedAt: task.columnChangedAt,
        ...assigneeProps,
      };
    }

    if (task.complaintId) {
      const complaint = await ctx.db.get(task.complaintId);
      if (!complaint) return null;
      const order = complaint.orderId ? await ctx.db.get(complaint.orderId) : null;
      const clientId = order?.clientId ?? complaint.clientId;
      const client = await ctx.db.get(clientId);
      return {
        _id: task._id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        completedAt: task.completedAt,
        archived: task.archived,
        archivedAt: task.archivedAt,
        dueDate: task.dueDate,
        source: "complaint",
        complaintId: task.complaintId,
        orderId: complaint.orderId,
        clientId,
        orderName: order?.name ?? null,
        customText: order?.customText ?? null,
        clientName: clientName(client),
        columnId: task.columnId,
        columnChangedAt: task.columnChangedAt,
        ...assigneeProps,
      };
    }


    if (task.orderId) {
      const order = await ctx.db.get(task.orderId);
      if (!order) return null;
      const client = await ctx.db.get(order.clientId);
      return {
        _id: task._id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        completedAt: task.completedAt,
        archived: task.archived,
        archivedAt: task.archivedAt,
        dueDate: task.dueDate,
        source: "order",
        orderId: task.orderId,
        clientId: order.clientId,
        orderName: order.name ?? null,
        customText: order.customText ?? null,
        clientName: clientName(client),
        columnId: task.columnId,
        columnChangedAt: task.columnChangedAt,
        ...assigneeProps,
      };
    }

    return {
      _id: task._id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      completedAt: task.completedAt,
      archived: task.archived,
      archivedAt: task.archivedAt,
      dueDate: task.dueDate,
      source: "general",
      orderName: null,
      customText: null,
      clientName: "Zadanie",
      columnId: task.columnId,
      columnChangedAt: task.columnChangedAt,
      ...assigneeProps,
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
    priority: v.optional(v.union(v.literal("high"), v.literal("normal"))),
    assignedUserId: v.optional(v.id("users")),
    columnId: v.optional(v.id("taskColumns")),
  },
  handler: async (ctx, args) => {
    const admin = await requireRole(ctx, "admin", "sales");
    const trimmed = args.title.trim();
    if (!trimmed) throw new ConvexError("Treść zadania jest wymagana.");
    const targetCount = [args.orderId, args.opportunityId].filter(Boolean).length;
    if (targetCount > 1) {
      throw new ConvexError(
        "Zadanie może należeć do maksymalnie jednego obiektu (zlecenie lub szansa).",
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
      priority: args.priority,
      assignedUserId: args.assignedUserId,
      columnId: args.columnId,
      columnChangedAt: args.columnId ? Date.now() : undefined,
      createdBy: admin.email ?? admin._id,
    });
  },
});
