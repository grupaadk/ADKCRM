import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireUser, requireRole } from "./lib/auth";

// ─────────────────────────────────────────────
//  EVENT TYPES
// ─────────────────────────────────────────────

export const getEventTypes = query({
  args: {},
  handler: async (ctx) => {
    const types = await ctx.db.query("calendarEventTypes").collect();
    const suppliers = await ctx.db.query("suppliers").collect();
    const supplierMap = new Map(suppliers.map((s) => [s._id, s.name]));

    return types.map((t) => ({
      ...t,
      linkedSupplierName: t.linkedSupplierId ? supplierMap.get(t.linkedSupplierId) ?? null : null,
    }));
  },
});

export const createEventType = mutation({
  args: {
    name: v.string(),
    color: v.string(),
    icon: v.optional(v.string()),
    isPrivate: v.boolean(),
    linkedOrderField: v.optional(v.string()),
    linkedSupplierId: v.optional(v.id("suppliers")),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");
    await ctx.db.insert("calendarEventTypes", {
      name: args.name,
      color: args.color,
      icon: args.icon,
      isPrivate: args.isPrivate,
      linkedOrderField: args.linkedOrderField,
      linkedSupplierId: args.linkedSupplierId,
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
    linkedOrderField: v.optional(v.union(v.string(), v.null())),
    linkedSupplierId: v.optional(v.union(v.id("suppliers"), v.null())),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");
    const { id, linkedOrderField, linkedSupplierId, ...updates } = args;
    const filtered: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined) filtered[key] = val;
    }
    if (linkedOrderField !== undefined) {
      filtered.linkedOrderField = linkedOrderField === null ? undefined : linkedOrderField;
    }
    if (linkedSupplierId !== undefined) {
      filtered.linkedSupplierId = linkedSupplierId === null ? undefined : linkedSupplierId;
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

export const getLinkedOrderEvents = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    const eventTypes = await ctx.db.query("calendarEventTypes").collect();
    const linkedTypes = eventTypes.filter((t) => t.linkedOrderField);
    if (linkedTypes.length === 0) return [];

    const orders = await ctx.db.query("orders").collect();
    const clients = await ctx.db.query("clients").collect();
    const suppliers = await ctx.db.query("suppliers").collect();
    const supplierMap = new Map(suppliers.map((s) => [s._id, s.name]));
    const clientMap = new Map(
      clients.map((c) => [
        c._id,
        c.companyName || `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "Klient",
      ]),
    );

    const results: Array<{
      id: string;
      orderId: string;
      clientId?: string;
      clientName: string;
      orderName?: string;
      eventTypeId: string;
      eventTypeName: string;
      color: string;
      startDate: number;
      deliveryIndex?: number;
      serviceName?: string;
      field: string;
      assignedUserId?: string;
    }> = [];

    for (const type of linkedTypes) {
      const field = type.linkedOrderField!;

      for (const order of orders) {
        const clientName = clientMap.get(order.clientId) ?? "Klient";

        if (field === "projectStartDate" && order.projectStartDate) {
          if (order.projectStartDate >= args.startDate && order.projectStartDate <= args.endDate) {
            results.push({
              id: `${type._id}_${order._id}_projectStart`,
              orderId: order._id,
              clientId: order.clientId,
              clientName,
              orderName: order.name,
              eventTypeId: type._id,
              eventTypeName: type.name,
              color: type.color,
              startDate: order.projectStartDate,
              field,
              assignedUserId: order.assignedUserId,
            });
          }
        } else if (field === "projectEndDate" && order.projectEndDate) {
          if (order.projectEndDate >= args.startDate && order.projectEndDate <= args.endDate) {
            results.push({
              id: `${type._id}_${order._id}_projectEnd`,
              orderId: order._id,
              clientId: order.clientId,
              clientName,
              orderName: order.name,
              eventTypeId: type._id,
              eventTypeName: type.name,
              color: type.color,
              startDate: order.projectEndDate,
              field,
              assignedUserId: order.assignedUserId,
            });
          }
        } else if (field.startsWith("serviceDeliveries.")) {
          const deliveryField = field.split(".")[1] as "deliveryDate" | "orderDate" | "confirmedDate" | "receivedDate";
          if (order.serviceDeliveries && Array.isArray(order.serviceDeliveries)) {
            order.serviceDeliveries.forEach((delivery, idx) => {
              if (type.linkedSupplierId && delivery.supplierId !== type.linkedSupplierId) {
                return;
              }
              const dateVal = delivery[deliveryField];
              if (dateVal && dateVal >= args.startDate && dateVal <= args.endDate) {
                const suppName = delivery.supplierId ? supplierMap.get(delivery.supplierId) : undefined;
                const label = [suppName, delivery.serviceName].filter(Boolean).join(" - ") || undefined;
                results.push({
                  id: `${type._id}_${order._id}_del_${idx}`,
                  orderId: order._id,
                  clientId: order.clientId,
                  clientName,
                  orderName: order.name,
                  eventTypeId: type._id,
                  eventTypeName: type.name,
                  color: type.color,
                  startDate: dateVal,
                  deliveryIndex: idx,
                  serviceName: label,
                  field,
                  assignedUserId: order.assignedUserId,
                });
              }
            });
          }
        }
      }
    }

    return results;
  },
});

export const updateLinkedOrderDate = mutation({
  args: {
    orderId: v.id("orders"),
    field: v.string(),
    deliveryIndex: v.optional(v.number()),
    newDate: v.number(),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Zlecenie nie istnieje.");

    if (args.field === "projectStartDate") {
      await ctx.db.patch(args.orderId, { projectStartDate: args.newDate });
    } else if (args.field === "projectEndDate") {
      await ctx.db.patch(args.orderId, { projectEndDate: args.newDate });
    } else if (args.field.startsWith("serviceDeliveries.") && args.deliveryIndex !== undefined) {
      const deliveryField = args.field.split(".")[1] as "deliveryDate" | "orderDate" | "confirmedDate" | "receivedDate";
      const deliveries = [...(order.serviceDeliveries ?? [])];
      if (deliveries[args.deliveryIndex]) {
        deliveries[args.deliveryIndex] = {
          ...deliveries[args.deliveryIndex],
          [deliveryField]: args.newDate,
        };
        await ctx.db.patch(args.orderId, { serviceDeliveries: deliveries });
      }
    }
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
