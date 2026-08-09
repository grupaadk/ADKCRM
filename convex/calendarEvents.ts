import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireUser, requireRole } from "./lib/auth";

// ─────────────────────────────────────────────
//  EVENT TYPES
// ─────────────────────────────────────────────

export const ensureSupplierEventTypes = mutation({
  args: {},
  handler: async (ctx) => {
    const suppliers = await ctx.db.query("suppliers").collect();
    const existingTypes = await ctx.db.query("calendarEventTypes").collect();

    let createdCount = 0;

    for (const supplier of suppliers) {
      // 1. Potwierdzenie
      const hasPotwierdzenie = existingTypes.some(
        (t) =>
          t.linkedSupplierId === supplier._id &&
          (t.linkedOrderField === "serviceDeliveries.confirmedDate" ||
            t.name.toLowerCase().includes("potwierdzenie"))
      );

      if (!hasPotwierdzenie) {
        const newId = await ctx.db.insert("calendarEventTypes", {
          name: `${supplier.name} - Potwierdzenie`,
          color: "#10b981",
          isPrivate: false,
          linkedOrderField: "serviceDeliveries.confirmedDate",
          linkedSupplierId: supplier._id,
          defaultTimeMode: "timed",
          createdAt: Date.now(),
        });
        existingTypes.push({
          _id: newId,
          _creationTime: Date.now(),
          name: `${supplier.name} - Potwierdzenie`,
          color: "#10b981",
          isPrivate: false,
          linkedOrderField: "serviceDeliveries.confirmedDate",
          linkedSupplierId: supplier._id,
          defaultTimeMode: "timed",
          createdAt: Date.now(),
        });
        createdCount++;
      }

      // 2. Dostawa
      const hasDostawa = existingTypes.some(
        (t) =>
          t.linkedSupplierId === supplier._id &&
          (t.linkedOrderField === "serviceDeliveries.deliveryDate" ||
            t.name.toLowerCase().includes("dostawa"))
      );

      if (!hasDostawa) {
        const newId = await ctx.db.insert("calendarEventTypes", {
          name: `${supplier.name} - Dostawa`,
          color: "#f59e0b",
          isPrivate: false,
          linkedOrderField: "serviceDeliveries.deliveryDate",
          linkedSupplierId: supplier._id,
          defaultTimeMode: "timed",
          createdAt: Date.now(),
        });
        existingTypes.push({
          _id: newId,
          _creationTime: Date.now(),
          name: `${supplier.name} - Dostawa`,
          color: "#f59e0b",
          isPrivate: false,
          linkedOrderField: "serviceDeliveries.deliveryDate",
          linkedSupplierId: supplier._id,
          defaultTimeMode: "timed",
          createdAt: Date.now(),
        });
        createdCount++;
      }

      // 3. Odbiór
      const existingOdbior = existingTypes.find(
        (t) =>
          t.linkedSupplierId === supplier._id &&
          (t.name.toLowerCase().includes("odbior") || t.name.toLowerCase().includes("odbiór"))
      );

      if (existingOdbior) {
        if (existingOdbior.linkedOrderField !== "serviceDeliveries.receivedDate") {
          await ctx.db.patch(existingOdbior._id, {
            linkedOrderField: "serviceDeliveries.receivedDate",
          });
          existingOdbior.linkedOrderField = "serviceDeliveries.receivedDate";
        }
      } else {
        const newId = await ctx.db.insert("calendarEventTypes", {
          name: `${supplier.name} - Odbiór`,
          color: "#3b82f6",
          isPrivate: false,
          linkedOrderField: "serviceDeliveries.receivedDate",
          linkedSupplierId: supplier._id,
          defaultTimeMode: "timed",
          createdAt: Date.now(),
        });
        existingTypes.push({
          _id: newId,
          _creationTime: Date.now(),
          name: `${supplier.name} - Odbiór`,
          color: "#3b82f6",
          isPrivate: false,
          linkedOrderField: "serviceDeliveries.receivedDate",
          linkedSupplierId: supplier._id,
          defaultTimeMode: "timed",
          createdAt: Date.now(),
        });
        createdCount++;
      }
    }

    // 4. Własne (zawsze tworzone niezależnie od dostawców)
    const hasWlasne = existingTypes.some(
      (t) => t.name.toLowerCase() === "własne" || t.name.toLowerCase() === "wlasne"
    );

    if (!hasWlasne) {
      const newId = await ctx.db.insert("calendarEventTypes", {
        name: "Własne",
        color: "#6366f1",
        isPrivate: false,
        defaultTimeMode: "timed",
        createdAt: Date.now(),
      });
      existingTypes.push({
        _id: newId,
        _creationTime: Date.now(),
        name: "Własne",
        color: "#6366f1",
        isPrivate: false,
        defaultTimeMode: "timed",
        createdAt: Date.now(),
      });
      createdCount++;
    }

    return { createdCount };
  },
});

export const getEventTypes = query({
  args: {},
  handler: async (ctx) => {
    const types = await ctx.db.query("calendarEventTypes").collect();
    const suppliers = await ctx.db.query("suppliers").collect();
    const supplierMap = new Map(suppliers.map((s) => [s._id, s.name]));
    const teams = await ctx.db.query("installationTeams").collect();
    const teamMap = new Map(teams.map((t) => [t._id, t]));

    const mapped = types.map((t) => ({
      ...t,
      linkedSupplierName: t.linkedSupplierId ? supplierMap.get(t.linkedSupplierId) ?? null : null,
      linkedInstallationTeamName: t.linkedInstallationTeamId ? teamMap.get(t.linkedInstallationTeamId)?.name ?? null : null,
      linkedInstallationTeamColor: t.linkedInstallationTeamId ? teamMap.get(t.linkedInstallationTeamId)?.color ?? null : null,
    }));

    const hasWlasne = mapped.some(
      (t) => t.name.toLowerCase() === "własne" || t.name.toLowerCase() === "wlasne"
    );

    if (!hasWlasne) {
      // Wstawiamy pigułkę Własne jako domyślny typ na samej górze
      const syntheticId = "wlasne_default_id" as unknown as typeof types[0]["_id"];
      mapped.unshift({
        _id: syntheticId,
        _creationTime: Date.now(),
        name: "Własne",
        color: "#6366f1",
        isPrivate: false,
        defaultTimeMode: "timed",
        createdAt: Date.now(),
        linkedSupplierName: null,
        linkedInstallationTeamName: null,
        linkedInstallationTeamColor: null,
      });
    }

    return mapped;
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
    linkedInstallationTeamId: v.optional(v.id("installationTeams")),
    defaultTimeMode: v.optional(v.union(v.literal("all_day"), v.literal("timed"))),
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
      linkedInstallationTeamId: args.linkedInstallationTeamId,
      defaultTimeMode: args.defaultTimeMode ?? "all_day",
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
    linkedInstallationTeamId: v.optional(v.union(v.id("installationTeams"), v.null())),
    defaultTimeMode: v.optional(v.union(v.literal("all_day"), v.literal("timed"), v.null())),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");
    const { id, linkedOrderField, linkedSupplierId, linkedInstallationTeamId, defaultTimeMode, ...updates } = args;
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
    if (linkedInstallationTeamId !== undefined) {
      filtered.linkedInstallationTeamId = linkedInstallationTeamId === null ? undefined : linkedInstallationTeamId;
    }
    if (defaultTimeMode !== undefined) {
      filtered.defaultTimeMode = defaultTimeMode === null ? undefined : defaultTimeMode;
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

    const orders = await ctx.db.query("orders").collect();
    const completedOrderIds = new Set(
      orders
        .filter((o) => o.status === "completed" || o.status === "archived")
        .map((o) => o._id),
    );

    const visible = events.filter(
      (e) =>
        (!e.isPrivate || e.createdBy === user._id) &&
        (!e.orderId || !completedOrderIds.has(e.orderId)),
    );

    const eventTypes = await ctx.db.query("calendarEventTypes").collect();
    const typeMap = new Map(eventTypes.map((t) => [t._id, t]));

    const carEvents = await ctx.db.query("carEvents").collect();
    const calendarEventToCarMap = new Map<string, string>();
    for (const ce of carEvents) {
      if (ce.linkedCalendarEventId) {
        calendarEventToCarMap.set(ce.linkedCalendarEventId, ce.carId);
      }
    }

    const allUsers = await ctx.db.query("users").collect();
    const userMap = new Map(
      allUsers.map((u) => [
        u._id,
        { name: u.displayName ?? u.name ?? u.email ?? "Użytkownik", color: u.color ?? "#94a3b8" },
      ]),
    );

    return visible.map((e) => ({
      ...e,
      carId: e.carId ?? calendarEventToCarMap.get(e._id) ?? null,
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
    const linkedTypes = [...eventTypes.filter((t) => t.linkedOrderField)];

    if (!linkedTypes.some((t) => t.linkedOrderField === "projectEndDate")) {
      linkedTypes.push({
        _id: "builtin_montaz" as unknown as Id<"calendarEventTypes">,
        _creationTime: Date.now(),
        name: "Montaż",
        color: "#3b82f6",
        isPrivate: false,
        linkedOrderField: "projectEndDate",
        defaultTimeMode: "timed",
        createdAt: Date.now(),
      });
    }

    if (!linkedTypes.some((t) => t.linkedOrderField === "complaintServiceDate")) {
      linkedTypes.push({
        _id: "builtin_serwis" as unknown as Id<"calendarEventTypes">,
        _creationTime: Date.now(),
        name: "Serwis",
        color: "#f59e0b",
        isPrivate: false,
        linkedOrderField: "complaintServiceDate",
        defaultTimeMode: "timed",
        createdAt: Date.now(),
      });
    }

    const orders = await ctx.db.query("orders").collect();
    const complaints = await ctx.db.query("complaints").collect();
    const orderMap = new Map(orders.map((o) => [o._id, o]));
    const clients = await ctx.db.query("clients").collect();
    const suppliers = await ctx.db.query("suppliers").collect();
    const supplierMap = new Map(suppliers.map((s) => [s._id, s.name]));
    const teams = await ctx.db.query("installationTeams").collect();
    const teamMap = new Map(teams.map((t) => [t._id, t]));
    const clientMap = new Map(
      clients.map((c) => [
        c._id,
        c.companyName || `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "Klient",
      ]),
    );

    const results: Array<{
      id: string;
      orderId?: string;
      complaintId?: string;
      clientId?: string;
      clientName: string;
      orderName?: string;
      customText?: string;
      eventTypeId: string;
      eventTypeName: string;
      color: string;
      startDate: number;
      endDate?: number;
      hasTime?: boolean;
      supplierId?: string;
      supplierName?: string;
      installationTeamId?: string;
      installationTeamName?: string;
      installationTeamColor?: string;
      deliveryIndex?: number;
      serviceName?: string;
      field: string;
      assignedUserId?: string;
      serviceDateOffset?: number;
    }> = [];

    for (const type of linkedTypes) {
      const field = type.linkedOrderField!;
      const timeMode = type.defaultTimeMode ?? "all_day";

      if (field === "complaintServiceDate") {
        for (const complaint of complaints) {
          if (!complaint.serviceDate) continue;
          if (type.linkedInstallationTeamId && complaint.installationTeamId !== type.linkedInstallationTeamId) {
            continue;
          }
          const order = complaint.orderId ? orderMap.get(complaint.orderId) : null;
          if (order && (order.status === "completed" || order.status === "archived")) {
            continue;
          }
          if (complaint.serviceDate >= args.startDate && complaint.serviceDate <= args.endDate) {
            const clientName = clientMap.get(complaint.clientId) ?? "Klient";
            const teamId = complaint.installationTeamId ?? type.linkedInstallationTeamId;
            const team = teamId ? teamMap.get(teamId) : undefined;

            let startVal = complaint.serviceDate;
            const d = new Date(startVal);
            const hasHours = d.getHours() !== 0 || d.getMinutes() !== 0;
            const hasTime = timeMode === "timed" || hasHours || !!complaint.serviceDateEnd;
            if (hasTime && d.getHours() === 0 && d.getMinutes() === 0) {
              d.setHours(8, 0, 0, 0);
              startVal = d.getTime();
            }

            results.push({
              id: `${type._id}_${complaint._id}_complaintService`,
              complaintId: complaint._id,
              orderId: complaint.orderId,
              clientId: complaint.clientId,
              clientName,
              orderName: order?.name ?? "Reklamacja",
              customText: complaint.clientDescription || complaint.description,
              eventTypeId: type._id,
              eventTypeName: type.name,
              color: type.color,
              startDate: startVal,
              endDate: complaint.serviceDateEnd ?? (hasTime ? startVal + 3600000 : undefined),
              hasTime,
              installationTeamId: teamId,
              installationTeamName: team?.name,
              installationTeamColor: team?.color,
              field,
              assignedUserId: complaint.assignedTo ? undefined : order?.assignedUserId,
              // Duration offset so frontend can compute new serviceDateEnd when dragging
              serviceDateOffset:
                complaint.serviceDate && complaint.serviceDateEnd
                  ? complaint.serviceDateEnd - complaint.serviceDate
                  : 3600000,
            });
          }
        }
        continue;
      }

      for (const order of orders) {
        if (order.status === "completed" || order.status === "archived") {
          continue;
        }
        const clientName = clientMap.get(order.clientId) ?? "Klient";
        const team = order.installationTeamId ? teamMap.get(order.installationTeamId) : undefined;

        if (field === "projectStartDate" && order.projectStartDate) {
          if (order.projectStartDate >= args.startDate && order.projectStartDate <= args.endDate) {
            let startVal = order.projectStartDate;
            let hasTime = timeMode === "timed";
            if (timeMode === "timed") {
              const d = new Date(startVal);
              if (d.getHours() === 0 && d.getMinutes() === 0) {
                d.setHours(8, 0, 0, 0);
                startVal = d.getTime();
              }
            } else {
              hasTime = false;
            }
            results.push({
              id: `${type._id}_${order._id}_projectStart`,
              orderId: order._id,
              clientId: order.clientId,
              clientName,
              orderName: order.name,
              customText: order.customText,
              eventTypeId: type._id,
              eventTypeName: type.name,
              color: type.color,
              startDate: startVal,
              hasTime,
              supplierId: type.linkedSupplierId,
              installationTeamId: order.installationTeamId,
              installationTeamName: team?.name,
              installationTeamColor: team?.color,
              field,
              assignedUserId: order.assignedUserId,
            });
          }
        } else if (field === "projectEndDate" && order.projectEndDate) {
          if (type.linkedInstallationTeamId && order.installationTeamId !== type.linkedInstallationTeamId) {
            continue;
          }
          if (order.projectEndDate >= args.startDate && order.projectEndDate <= args.endDate) {
            let hasTime = false;
            let computedStart = order.projectEndDate;
            if (timeMode === "timed") {
              hasTime = true;
              const startMins = order.installationStartDate ?? 480;
              computedStart = order.projectEndDate + startMins * 60 * 1000;
            } else {
              hasTime = false;
            }
            results.push({
              id: `${type._id}_${order._id}_projectEnd`,
              orderId: order._id,
              clientId: order.clientId,
              clientName,
              orderName: order.name,
              customText: order.customText,
              eventTypeId: type._id,
              eventTypeName: type.name,
              color: type.color,
              startDate: computedStart,
              hasTime,
              supplierId: type.linkedSupplierId,
              installationTeamId: type.linkedInstallationTeamId ?? order.installationTeamId,
              installationTeamName: team?.name,
              installationTeamColor: team?.color,
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
                
                let startVal = dateVal;
                let hasTime = timeMode === "timed";
                if (timeMode === "timed") {
                  const d = new Date(startVal);
                  if (d.getHours() === 0 && d.getMinutes() === 0) {
                    d.setHours(8, 0, 0, 0);
                    startVal = d.getTime();
                  }
                } else {
                  hasTime = false;
                }

                results.push({
                  id: `${type._id}_${order._id}_del_${idx}`,
                  orderId: order._id,
                  clientId: order.clientId,
                  clientName,
                  orderName: order.name,
                  customText: order.customText,
                  eventTypeId: type._id,
                  eventTypeName: type.name,
                  color: type.color,
                  startDate: startVal,
                  hasTime,
                  supplierId: delivery.supplierId ?? type.linkedSupplierId,
                  supplierName: suppName,
                  deliveryIndex: idx,
                  serviceName: label,
                  field,
                  assignedUserId: order.assignedUserId,
                  installationTeamId: order.installationTeamId,
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
    orderId: v.optional(v.id("orders")),
    complaintId: v.optional(v.id("complaints")),
    field: v.string(),
    deliveryIndex: v.optional(v.number()),
    newDate: v.number(),
    serviceDateEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    if (args.field === "complaintServiceDate" && args.complaintId) {
      const patch: Record<string, unknown> = { serviceDate: args.newDate };
      if (args.serviceDateEnd !== undefined) {
        patch.serviceDateEnd = args.serviceDateEnd;
      }
      await ctx.db.patch(args.complaintId, patch);
      return;
    }

    if (!args.orderId) throw new Error("Wymagane ID zlecenia.");
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Zlecenie nie istnieje.");

    if (args.field === "projectStartDate") {
      await ctx.db.patch(args.orderId, { projectStartDate: args.newDate });
    } else if (args.field === "projectEndDate") {
      const d = new Date(args.newDate);
      const mins = d.getHours() * 60 + d.getMinutes();
      const midnightTs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      await ctx.db.patch(args.orderId, {
        projectEndDate: midnightTs,
        installationStartDate: mins,
      });
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

    let realEventTypeId = args.eventTypeId;
    if ((args.eventTypeId as string) === "wlasne_default_id") {
      const existing = await ctx.db.query("calendarEventTypes").collect();
      const wlasne = existing.find(
        (t) => t.name.toLowerCase() === "własne" || t.name.toLowerCase() === "wlasne"
      );
      if (wlasne) {
        realEventTypeId = wlasne._id;
      } else {
        realEventTypeId = await ctx.db.insert("calendarEventTypes", {
          name: "Własne",
          color: "#6366f1",
          isPrivate: false,
          defaultTimeMode: "timed",
          createdAt: Date.now(),
        });
      }
    }

    await ctx.db.insert("calendarEvents", {
      ...args,
      eventTypeId: realEventTypeId,
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
