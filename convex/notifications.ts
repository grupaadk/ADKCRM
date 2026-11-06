import { v, ConvexError } from "convex/values";
import { query, mutation, internalMutation, MutationCtx } from "./_generated/server";
import { getCurrentUser, requireUser } from "./lib/auth";
import type { Id } from "./_generated/dataModel";

/**
 * Pobiera listę ostatnich powiadomień dla aktualnie zalogowanego użytkownika.
 */
export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const limit = args.limit ?? 50;
    return await ctx.db
      .query("notifications")
      .withIndex("by_user_created", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);
  },
});

/**
 * Zwraca liczbę nieprzeczytanych powiadomień dla aktualnie zalogowanego użytkownika.
 */
export const getUnreadCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return 0;

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", user._id).eq("read", false))
      .collect();

    return unread.length;
  },
});

/**
 * Oznacza konkretne powiadomienie jako przeczytane.
 */
export const markAsRead = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const notification = await ctx.db.get(args.notificationId);

    if (!notification) {
      throw new ConvexError("Powiadomienie nie istnieje.");
    }
    if (notification.userId !== user._id) {
      throw new ConvexError("Brak uprawnień do tego powiadomienia.");
    }

    if (!notification.read) {
      await ctx.db.patch(args.notificationId, {
        read: true,
        readAt: Date.now(),
      });
    }

    return { success: true };
  },
});

/**
 * Oznacza wszystkie powiadomienia zalogowanego użytkownika jako przeczytane.
 */
export const markAllAsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", user._id).eq("read", false))
      .collect();

    const now = Date.now();
    for (const item of unread) {
      await ctx.db.patch(item._id, {
        read: true,
        readAt: now,
      });
    }

    return { updatedCount: unread.length };
  },
});

/**
 * Usuwa pojedyncze powiadomienie użytkownika.
 */
export const deleteNotification = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const notification = await ctx.db.get(args.notificationId);

    if (!notification) {
      throw new ConvexError("Powiadomienie nie istnieje.");
    }
    if (notification.userId !== user._id) {
      throw new ConvexError("Brak uprawnień do usunięcia tego powiadomienia.");
    }

    await ctx.db.delete(args.notificationId);
    return { success: true };
  },
});

/**
 * Pomocnicza funkcja wewnętrzna do tworzenia powiadomień o nowej szansie sprzedaży.
 * Powiadamia aktywnych użytkowników z rolami 'admin' i 'sales' (z wykluczeniem twórcy).
 */
export async function notifyNewOpportunity(
  ctx: MutationCtx,
  args: {
    opportunityId: Id<"pendingJotformSubmissions">;
    clientName: string;
    city?: string;
    services?: string[];
    source?: string;
    creatorUserId?: Id<"users">;
  },
) {
  const allUsers = await ctx.db.query("users").collect();

  // Odbiorcy: aktywni użytkownicy z rolami admin i sales (oraz każdy niebędący montażem)
  const recipients = allUsers.filter((u) => {
    if (u.isActive === false) return false;
    if (u.role === "montaz") return false;
    return true;
  });

  const detailParts = [
    args.city?.trim(),
    args.services && args.services.length > 0 ? args.services.join(", ") : undefined,
  ].filter(Boolean);

  const message = detailParts.length > 0 ? detailParts.join(" • ") : "Nowe zapytanie ofertowe";
  const now = Date.now();

  for (const user of recipients) {
    await ctx.db.insert("notifications", {
      userId: user._id,
      type: "new_opportunity",
      title: `Nowa szansa: ${args.clientName}`,
      message,
      link: `/admin/szansa/${args.opportunityId}`,
      entityType: "opportunity",
      entityId: args.opportunityId,
      read: false,
      createdAt: now,
    });
  }
}

/**
 * Pomocnicza funkcja wewnętrzna do tworzenia powiadomień o nowych wiadomościach w zamówieniach.
 * Powiadamia aktywnych użytkowników (admin, sales) z wykluczeniem nadawcy (jeśli to użytkownik ADK).
 */
export async function notifyNewOrderMessage(
  ctx: MutationCtx,
  args: {
    orderId: Id<"orders">;
    deliveryIndex: number;
    senderName: string;
    senderType: "adk" | "exalco";
    noteText: string;
    excludeUserId?: string;
  },
) {
  const order = await ctx.db.get(args.orderId);
  if (!order) return;

  const client = order.clientId ? await ctx.db.get(order.clientId) : null;
  const clientName = client
    ? client.clientType === "business" && client.companyName
      ? client.companyName
      : `${client.firstName} ${client.lastName}`.trim()
    : "Klient";

  const orderLabel = order.name ?? `Zlecenie`;
  const delivery = order.serviceDeliveries?.[args.deliveryIndex];
  const serviceName = delivery?.serviceName ?? "Zamówienie";

  const allUsers = await ctx.db.query("users").collect();
  const recipients = allUsers.filter((u) => {
    if (u.isActive === false) return false;
    if (u.role === "montaz") return false;
    if (args.excludeUserId && (u._id === args.excludeUserId || u.email === args.excludeUserId)) return false;
    return true;
  });

  const now = Date.now();
  const cleanText = args.noteText.replace(/\s+/g, " ").trim();
  const snippet = cleanText.length > 90 ? `${cleanText.slice(0, 87)}...` : cleanText;

  const senderPrefix = args.senderType === "exalco" ? "Exalco" : args.senderName;
  const title = `Nowa wiadomość (${senderPrefix}) • ${orderLabel}`;
  const message = `${clientName} (${serviceName}): ${snippet}`;
  const link = `/admin/klient/${order.clientId}/zlecenie/${order._id}?tab=zamowienia&deliveryIndex=${args.deliveryIndex}`;

  for (const user of recipients) {
    await ctx.db.insert("notifications", {
      userId: user._id,
      type: "order_message",
      title,
      message,
      link,
      entityType: "order",
      entityId: args.orderId,
      read: false,
      createdAt: now,
    });
  }
}

/**
 * Wewnętrzna mutacja do wywołania przez scheduler lub inne akcje, jeśli zajdzie taka potrzeba.
 */
export const internalNotifyNewOpportunity = internalMutation({
  args: {
    opportunityId: v.id("pendingJotformSubmissions"),
    clientName: v.string(),
    city: v.optional(v.string()),
    services: v.optional(v.array(v.string())),
    source: v.optional(v.string()),
    creatorUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    await notifyNewOpportunity(ctx, args);
  },
});
