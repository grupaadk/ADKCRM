import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

const MS_PER_DAY = 86_400_000;

function normalizeDayStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function addDays(ts: number, days: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatDatePl(ts: number): string {
  return new Date(ts).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
  });
}

export interface StageConflict {
  orderId: Id<"orders">;
  orderLabel: string;
  dateLabel: string;
  source: "gantt" | "calendar";
  stageTitle?: string;
}

/**
 * Pobiera etapy Gantta dla zlecenia oraz wykrywa kolizje przypisanych ekip na innych zleceniach.
 */
export const listByOrder = query({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const stages = await ctx.db
      .query("orderInstallationStages")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();

    const sorted = [...stages].sort((a, b) => a.position - b.position || a.startDate - b.startDate);

    // Zbierz unikalne ekipy z etapów, aby wykryć kolizje tylko dla używanych ekip
    const teamIds = Array.from(
      new Set(
        sorted
          .map((s) => s.installationTeamId)
          .filter((id): id is Id<"installationTeams"> => Boolean(id))
      )
    );

    const otherGanttByTeam = new Map<
      Id<"installationTeams">,
      Array<{
        orderId: Id<"orders">;
        title: string;
        startDate: number;
        endDate: number;
      }>
    >();

    for (const teamId of teamIds) {
      const teamStages = await ctx.db
        .query("orderInstallationStages")
        .withIndex("by_team", (q) => q.eq("installationTeamId", teamId))
        .collect();
      otherGanttByTeam.set(
        teamId,
        teamStages
          .filter((s) => s.orderId !== args.orderId)
          .map((s) => ({
            orderId: s.orderId,
            title: s.title,
            startDate: normalizeDayStart(s.startDate),
            endDate: normalizeDayStart(s.endDate),
          }))
      );
    }

    // Sprawdź również terminy z Kalendarza CRM (order.installationDates) dla innych zleceń
    const ordersByTeam = new Map<
      Id<"installationTeams">,
      Array<{
        orderId: Id<"orders">;
        orderLabel: string;
        dates: number[];
      }>
    >();

    if (teamIds.length > 0) {
      const teamIdSet = new Set(teamIds);
      const allOrders = await ctx.db.query("orders").take(500);
      const clientCache = new Map<Id<"clients">, string>();

      const getOrderLabel = async (o: (typeof allOrders)[number]): Promise<string> => {
        let clientLabel = clientCache.get(o.clientId);
        if (!clientLabel) {
          const client = await ctx.db.get(o.clientId);
          clientLabel = client
            ? client.companyName || `${client.firstName} ${client.lastName}`.trim()
            : "Klient";
          clientCache.set(o.clientId, clientLabel);
        }
        return o.name ? `${clientLabel} (${o.name})` : clientLabel;
      };

      for (const o of allOrders) {
        if (o._id === args.orderId || o.status === "archived") continue;
        if (!o.installationDates || o.installationDates.length === 0) continue;

        for (const inst of o.installationDates) {
          const tId = inst.installationTeamId ?? o.installationTeamId;
          if (!tId || !teamIdSet.has(tId) || !inst.date) continue;
          const label = await getOrderLabel(o);
          const list = ordersByTeam.get(tId) ?? [];
          const existing = list.find((entry) => entry.orderId === o._id);
          const dayTs = normalizeDayStart(inst.date);
          if (existing) {
            existing.dates.push(dayTs);
          } else {
            list.push({ orderId: o._id, orderLabel: label, dates: [dayTs] });
          }
          ordersByTeam.set(tId, list);
        }
      }
    }

    const orderLabelCache = new Map<Id<"orders">, string>();
    const resolveOrderLabel = async (oId: Id<"orders">): Promise<string> => {
      const cached = orderLabelCache.get(oId);
      if (cached) return cached;
      const o = await ctx.db.get(oId);
      if (!o) return "Inne zlecenie";
      const client = await ctx.db.get(o.clientId);
      const clientLabel = client
        ? client.companyName || `${client.firstName} ${client.lastName}`.trim()
        : "Klient";
      const label = o.name ? `${clientLabel} (${o.name})` : clientLabel;
      orderLabelCache.set(oId, label);
      return label;
    };

    const enriched = [];
    for (const stage of sorted) {
      const sStart = normalizeDayStart(stage.startDate);
      const sEnd = Math.max(sStart, normalizeDayStart(stage.endDate));
      const conflicts: StageConflict[] = [];

      if (stage.installationTeamId) {
        const ganttMatches = otherGanttByTeam.get(stage.installationTeamId) ?? [];
        for (const other of ganttMatches) {
          if (other.startDate <= sEnd && other.endDate >= sStart) {
            const orderLabel = await resolveOrderLabel(other.orderId);
            conflicts.push({
              orderId: other.orderId,
              orderLabel,
              dateLabel:
                other.startDate === other.endDate
                  ? formatDatePl(other.startDate)
                  : `${formatDatePl(other.startDate)}–${formatDatePl(other.endDate)}`,
              source: "gantt",
              stageTitle: other.title,
            });
          }
        }

        const calMatches = ordersByTeam.get(stage.installationTeamId) ?? [];
        for (const calOrder of calMatches) {
          const overlappingDays = calOrder.dates.filter((d) => d >= sStart && d <= sEnd);
          if (overlappingDays.length > 0) {
            const minD = Math.min(...overlappingDays);
            const maxD = Math.max(...overlappingDays);
            conflicts.push({
              orderId: calOrder.orderId,
              orderLabel: calOrder.orderLabel,
              dateLabel:
                minD === maxD ? formatDatePl(minD) : `${formatDatePl(minD)}–${formatDatePl(maxD)}`,
              source: "calendar",
            });
          }
        }
      }

      enriched.push({
        ...stage,
        startDate: sStart,
        endDate: sEnd,
        conflicts,
      });
    }

    return enriched;
  },
});

/**
 * Tworzy nowy etap montażowy na wykresie Gantta.
 */
export const createStage = mutation({
  args: {
    orderId: v.id("orders"),
    title: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    startMins: v.optional(v.number()),
    endMins: v.optional(v.number()),
    installationTeamId: v.optional(v.id("installationTeams")),
    status: v.optional(v.union(v.literal("planned"), v.literal("in_progress"), v.literal("done"))),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const title = args.title.trim();
    if (!title) throw new Error("Nazwa etapu montażu nie może być pusta.");

    const startDate = normalizeDayStart(args.startDate);
    const endDate = Math.max(startDate, normalizeDayStart(args.endDate));

    const existing = await ctx.db
      .query("orderInstallationStages")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();
    const nextPos = existing.length > 0 ? Math.max(...existing.map((s) => s.position)) + 1 : 0;

    const now = Date.now();
    return await ctx.db.insert("orderInstallationStages", {
      orderId: args.orderId,
      title,
      startDate,
      endDate,
      startMins: args.startMins ?? 480,
      endMins: args.endMins ?? 960,
      installationTeamId: args.installationTeamId,
      status: args.status ?? "planned",
      note: args.note?.trim() || undefined,
      position: nextPos,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Tworzy standardowy harmonogram montażu (4 etapy startowe) od podanej daty.
 */
export const seedPresetStages = mutation({
  args: {
    orderId: v.id("orders"),
    anchorDate: v.number(),
    defaultTeamId: v.optional(v.id("installationTeams")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("orderInstallationStages")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();
    if (existing.length > 0) return { created: 0 };

    const day0 = normalizeDayStart(args.anchorDate);
    const now = Date.now();

    const preset = [
      { title: "Przygotowanie i kotwienie", offsetStart: 0, durationDays: 1 },
      { title: "Montaż konstrukcji głównej", offsetStart: 1, durationDays: 2 },
      { title: "Szklenie / montaż pokrycia", offsetStart: 3, durationDays: 1 },
      { title: "Obróbki, regulacja i odbiór", offsetStart: 4, durationDays: 1 },
    ];

    for (let i = 0; i < preset.length; i++) {
      const p = preset[i];
      const start = addDays(day0, p.offsetStart);
      const end = addDays(start, Math.max(0, p.durationDays - 1));
      await ctx.db.insert("orderInstallationStages", {
        orderId: args.orderId,
        title: p.title,
        startDate: start,
        endDate: end,
        startMins: 480,
        endMins: 960,
        installationTeamId: args.defaultTeamId,
        status: "planned",
        position: i,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { created: preset.length };
  },
});

/**
 * Aktualizuje parametry etapu (daty po drag/resize, ekipę, status, godziny, notatkę).
 */
export const updateStage = mutation({
  args: {
    stageId: v.id("orderInstallationStages"),
    title: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    startMins: v.optional(v.number()),
    endMins: v.optional(v.number()),
    installationTeamId: v.optional(v.union(v.id("installationTeams"), v.null())),
    status: v.optional(v.union(v.literal("planned"), v.literal("in_progress"), v.literal("done"))),
    note: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.stageId);
    if (!existing) throw new Error("Etap montażu nie został znaleziony.");

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.title !== undefined) {
      const trimmed = args.title.trim();
      if (!trimmed) throw new Error("Nazwa etapu montażu nie może być pusta.");
      patch.title = trimmed;
    }

    const nextStart =
      args.startDate !== undefined ? normalizeDayStart(args.startDate) : existing.startDate;
    const rawEnd = args.endDate !== undefined ? normalizeDayStart(args.endDate) : existing.endDate;
    const nextEnd = Math.max(nextStart, rawEnd);

    if (args.startDate !== undefined) patch.startDate = nextStart;
    if (args.endDate !== undefined || args.startDate !== undefined) patch.endDate = nextEnd;
    if (args.startMins !== undefined) patch.startMins = args.startMins;
    if (args.endMins !== undefined) patch.endMins = args.endMins;
    if (args.installationTeamId !== undefined) {
      patch.installationTeamId = args.installationTeamId ?? undefined;
    }
    if (args.status !== undefined) patch.status = args.status;
    if (args.note !== undefined) {
      patch.note = args.note ? args.note.trim() || undefined : undefined;
    }

    await ctx.db.patch(args.stageId, patch);
  },
});

/**
 * Zmienia kolejność etapów na wykresie Gantta.
 */
export const reorderStages = mutation({
  args: {
    orderId: v.id("orders"),
    orderedIds: v.array(v.id("orderInstallationStages")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (let i = 0; i < args.orderedIds.length; i++) {
      const id = args.orderedIds[i];
      const stage = await ctx.db.get(id);
      if (stage && stage.orderId === args.orderId) {
        await ctx.db.patch(id, { position: i, updatedAt: now });
      }
    }
  },
});

/**
 * Usuwa etap montażu z wykresu Gantta.
 */
export const removeStage = mutation({
  args: {
    stageId: v.id("orderInstallationStages"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.stageId);
  },
});

export { MS_PER_DAY };
