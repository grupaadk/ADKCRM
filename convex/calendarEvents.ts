import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireUser, requireRole } from "./lib/auth";

// ─────────────────────────────────────────────
//  EVENT TYPES
// ─────────────────────────────────────────────

export const getEventTypes = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("calendarEventTypes").collect();
  },
});

export const createEventType = mutation({
  args: {
    name: v.string(),
    color: v.string(),
    icon: v.optional(v.string()),
    isPrivate: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");
    await ctx.db.insert("calendarEventTypes", {
      name: args.name,
      color: args.color,
      icon: args.icon,
      isPrivate: args.isPrivate,
      createdAt: Date.now(),
    });
  },
});

export const updateEventType = mutation({
  args: {
    id: v.id("calendarEventTypes"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    isPrivate: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");
    const { id, ...updates } = args;
    const filtered: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined) filtered[key] = val;
    }
    await ctx.db.patch(id, filtered);
  },
});

export const deleteEventType = mutation({
  args: { id: v.id("calendarEventTypes") },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");
    const inUse = await ctx.db
      .query("calendarEvents")
      .withIndex("by_type", (q) => q.eq("eventTypeId", args.id))
      .take(1);
    if (inUse.length > 0) {
      throw new Error(
        "Nie można usunąć typu, który jest używany przez istniejące wydarzenia.",
      );
    }
    await ctx.db.delete(args.id);
  },
});

// ─────────────────────────────────────────────
//  CALENDAR EVENTS
// ─────────────────────────────────────────────

export const getEvents = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const events = await ctx.db
      .query("calendarEvents")
      .withIndex("by_start", (q) =>
        q.gte("startDate", args.startDate).lte("startDate", args.endDate),
      )
      .collect();

    const visible = events.filter(
      (e) => !e.isPrivate || e.createdBy === user._id,
    );

    const eventTypes = await ctx.db.query("calendarEventTypes").collect();
    const typeMap = new Map(eventTypes.map((t) => [t._id, t]));

    const allUsers = await ctx.db.query("users").collect();
    const userMap = new Map(
      allUsers.map((u) => [
        u._id,
        { name: u.name ?? u.email ?? "?", color: u.color ?? "#94a3b8" },
      ]),
    );

    return visible.map((e) => ({
      ...e,
      eventType: typeMap.get(e.eventTypeId) ?? null,
      assignedUsers: (e.assignedUserIds ?? [])
        .map((uid) => userMap.get(uid))
        .filter(Boolean),
    }));
  },
});

export const createEvent = mutation({
  args: {
    eventTypeId: v.id("calendarEventTypes"),
    title: v.string(),
    description: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.optional(v.number()),
    isAllDay: v.boolean(),
    assignedUserIds: v.optional(v.array(v.id("users"))),
    clientId: v.optional(v.id("clients")),
    orderId: v.optional(v.id("orders")),
    isPrivate: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await ctx.db.insert("calendarEvents", {
      ...args,
      createdBy: user._id,
      createdAt: Date.now(),
    });
  },
});

export const updateEvent = mutation({
  args: {
    id: v.id("calendarEvents"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.union(v.number(), v.null())),
    isAllDay: v.optional(v.boolean()),
    assignedUserIds: v.optional(v.array(v.id("users"))),
    clientId: v.optional(v.union(v.id("clients"), v.null())),
    orderId: v.optional(v.union(v.id("orders"), v.null())),
    isPrivate: v.optional(v.boolean()),
    eventTypeId: v.optional(v.id("calendarEventTypes")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const event = await ctx.db.get(args.id);
    if (!event) throw new Error("Zdarzenie nie istnieje.");
    if (event.createdBy !== user._id && user.role !== "admin") {
      throw new Error("Brak uprawnień do edycji tego zdarzenia.");
    }
    const { id, endDate, clientId, orderId, ...rest } = args;
    const patch: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(rest)) {
      if (val !== undefined) patch[key] = val;
    }
    if (endDate !== undefined) patch.endDate = endDate === null ? undefined : endDate;
    if (clientId !== undefined) patch.clientId = clientId === null ? undefined : clientId;
    if (orderId !== undefined) patch.orderId = orderId === null ? undefined : orderId;
    await ctx.db.patch(id, patch);
  },
});

export const deleteEvent = mutation({
  args: { id: v.id("calendarEvents") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const event = await ctx.db.get(args.id);
    if (!event) throw new Error("Zdarzenie nie istnieje.");
    if (event.createdBy !== user._id && user.role !== "admin") {
      throw new Error("Brak uprawnień do usunięcia tego zdarzenia.");
    }
    await ctx.db.delete(args.id);
  },
});
