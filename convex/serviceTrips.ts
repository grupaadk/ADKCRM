import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./lib/auth";

/** Lista wszystkich wyjazdów posortowana po dacie malejąco */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const trips = await ctx.db.query("serviceTrips").order("desc").collect();
    const result = await Promise.all(
      trips.map(async (trip) => {
        const complaints = await ctx.db
          .query("complaints")
          .withIndex("by_service_trip", (q) => q.eq("serviceTripId", trip._id))
          .collect();
        return { ...trip, complaintCount: complaints.length };
      }),
    );
    return result;
  },
});

/** Szczegóły wyjazdu + lista przypisanych reklamacji z joinami */
export const getWithComplaints = query({
  args: { tripId: v.id("serviceTrips") },
  handler: async (ctx, args) => {
    const trip = await ctx.db.get(args.tripId);
    if (!trip) return null;

    const complaints = await ctx.db
      .query("complaints")
      .withIndex("by_service_trip", (q) => q.eq("serviceTripId", args.tripId))
      .collect();

    complaints.sort((a, b) => (a.serviceTripPosition ?? 0) - (b.serviceTripPosition ?? 0));

    const enriched = await Promise.all(
      complaints.map(async (c) => {
        const client = c.clientId ? await ctx.db.get(c.clientId) : null;
        const order = c.orderId ? await ctx.db.get(c.orderId) : null;
        const team = c.installationTeamId ? await ctx.db.get(c.installationTeamId) : null;
        return {
          ...c,
          client,
          order,
          installationTeam: team ? { name: team.name, color: team.color } : null,
        };
      }),
    );

    return { ...trip, complaints: enriched };
  },
});

/** Wszystkie aktywne reklamacje bez wyjazdu (pula) */
export const getUnassignedComplaints = query({
  args: {},
  handler: async (ctx) => {
    const complaints = await ctx.db
      .query("complaints")
      .order("desc")
      .take(500);

    const active = complaints.filter(
      (c) =>
        !c.serviceTripId &&
        c.status !== "archiwalne" &&
        c.status !== "rozwiazana" &&
        c.status !== "zamknieta" &&
        c.status !== "zakonczona",
    );

    const enriched = await Promise.all(
      active.map(async (c) => {
        const client = c.clientId ? await ctx.db.get(c.clientId) : null;
        const order = c.orderId ? await ctx.db.get(c.orderId) : null;
        return { ...c, client, order };
      }),
    );

    return enriched;
  },
});

/** Tworzenie nowego wyjazdu serwisowego */
export const create = mutation({
  args: {
    name: v.string(),
    date: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const tripId = await ctx.db.insert("serviceTrips", {
      name: args.name.trim(),
      date: args.date,
      status: "open",
      createdBy: user?.displayName ?? user?.email ?? "Nieznany",
      createdAt: Date.now(),
    });
    return tripId;
  },
});

/** Aktualizacja wyjazdu */
export const update = mutation({
  args: {
    tripId: v.id("serviceTrips"),
    name: v.optional(v.string()),
    date: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.date !== undefined) patch.date = args.date;
    await ctx.db.patch(args.tripId, patch);
  },
});

/** Zamknięcie wyjazdu — archiwizuje wszystkie przypisane reklamacje */
export const close = mutation({
  args: { tripId: v.id("serviceTrips") },
  handler: async (ctx, args) => {
    const trip = await ctx.db.get(args.tripId);
    if (!trip) throw new Error("Wyjazd nie istnieje.");
    if (trip.status === "closed") throw new Error("Wyjazd jest już zamknięty.");

    const complaints = await ctx.db
      .query("complaints")
      .withIndex("by_service_trip", (q) => q.eq("serviceTripId", args.tripId))
      .collect();

    for (const c of complaints) {
      await ctx.db.patch(c._id, { status: "archiwalne" });
    }

    await ctx.db.patch(args.tripId, { status: "closed" });
  },
});

/** Przypisanie reklamacji do wyjazdu */
export const assignComplaint = mutation({
  args: {
    complaintId: v.id("complaints"),
    tripId: v.id("serviceTrips"),
  },
  handler: async (ctx, args) => {
    const complaint = await ctx.db.get(args.complaintId);
    if (!complaint) throw new Error("Reklamacja nie istnieje.");

    const trip = await ctx.db.get(args.tripId);
    if (!trip) throw new Error("Wyjazd nie istnieje.");
    if (trip.status === "closed") throw new Error("Nie można przypisać do zamkniętego wyjazdu.");

    const existing = await ctx.db
      .query("complaints")
      .withIndex("by_service_trip", (q) => q.eq("serviceTripId", args.tripId))
      .collect();

    const maxPosition = existing.reduce(
      (max, c) => Math.max(max, c.serviceTripPosition ?? 0),
      0,
    );

    await ctx.db.patch(args.complaintId, {
      serviceTripId: args.tripId,
      serviceTripPosition: maxPosition + 1,
    });
  },
});

/** Usunięcie reklamacji z wyjazdu */
export const unassignComplaint = mutation({
  args: { complaintId: v.id("complaints") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.complaintId, {
      serviceTripId: undefined,
      serviceTripPosition: undefined,
    });
  },
});

/** Zmiana kolejności reklamacji w wyjeździe */
export const reorder = mutation({
  args: {
    tripId: v.id("serviceTrips"),
    orderedIds: v.array(v.id("complaints")),
  },
  handler: async (ctx, args) => {
    for (let i = 0; i < args.orderedIds.length; i++) {
      await ctx.db.patch(args.orderedIds[i], { serviceTripPosition: i + 1 });
    }
  },
});
