import { query } from "./_generated/server";
import { CLIENT_STATUSES } from "./schema";

// Dashboard stats: count orders by status, total clients, documents enabled
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const allClients = await ctx.db.query("clients").collect();
    const total = allClients.length;

    const allOrders = await ctx.db.query("orders").collect();

    // Count orders by status
    const byStatus: Record<string, number> = {};
    for (const status of CLIENT_STATUSES) {
      byStatus[status] = 0;
    }
    for (const order of allOrders) {
      byStatus[order.status] = (byStatus[order.status] ?? 0) + 1;
    }

    // New clients this week (last 7 days)
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const newThisWeek = allClients.filter(
      (c) => c._creationTime >= oneWeekAgo,
    ).length;

    // Count total enabled documents across all orders
    let documentsEnabledCount = 0;
    for (const order of allOrders) {
      for (const doc of Object.values(order.documents)) {
        if (doc.enabled) {
          documentsEnabledCount++;
        }
      }
    }

    return {
      total,
      byStatus,
      newThisWeek,
      documentsEnabledCount,
    };
  },
});

// Counts for sidebar badges
export const getCounts = query({
  args: {},
  handler: async (ctx) => {
    const allClients = await ctx.db.query("clients").collect();
    const templates = await ctx.db.query("documentTemplates").collect();
    return {
      clients: allClients.length,
      templates: templates.length,
    };
  },
});

// Recent events across all clients
export const getRecentEvents = query({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db
      .query("clientEvents")
      .order("desc")
      .take(20);

    // Enrich with client names
    const enriched = await Promise.all(
      events.map(async (event) => {
        const client = await ctx.db.get(event.clientId);
        return {
          ...event,
          clientName: client
            ? `${client.firstName} ${client.lastName}`
            : "Usuniety klient",
        };
      }),
    );

    return enriched;
  },
});
