import { query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

type DocState = "gray" | "red" | "green"

function docState(entry: { enabled: boolean; signatureStatus?: string } | undefined): DocState {
  if (!entry || !entry.enabled) return "gray";
  if (entry.signatureStatus === "signed") return "green";
  return "red";
}

function orderDocs(documents: Doc<"orders">["documents"]): Record<string, DocState> {
  return {
    pomiar: docState(documents.pomiar),
    umowa: docState(documents.umowa),
    gwarancja_alco: docState(documents.gwarancja_alco),
    rekojmia_adk: docState(documents.rekojmia_adk),
    odbior_inwestor: docState(documents.odbior_inwestor),
    protokol_montaz: docState(documents.protokol_montaz),
    faktura: docState(documents.faktura),
    reklamacja: docState(documents.reklamacja),
  };
}

export type KanbanOrderItem = {
  type: "order";
  id: Id<"orders">;
  orderId: Id<"orders">;
  clientId: Id<"clients">;
  clientFirstName: string;
  clientLastName: string;
  clientType?: "individual" | "business";
  companyName?: string;
  status: Doc<"orders">["status"];
  orderName: string | undefined;
  customText: string | undefined;
  grossAmount: number | undefined;
  services: string[];
  docs: Record<string, DocState>;
  assignedUserColor?: string;
  assignedUserId?: Id<"users">;
  assignees?: {
    id: Id<"users">;
    name: string | null;
    color?: string;
  }[];
  investmentCity?: string;
  investmentStreet?: string;
  comment?: string;
  clientCity?: string;
  statusChangedAt?: number;
};

export type KanbanPendingItem = {
  type: "pending";
  id: Id<"pendingJotformSubmissions">;
  pendingId: Id<"pendingJotformSubmissions">;
  clientId: Id<"clients"> | undefined;
  clientFirstName: string;
  clientLastName: string;
  clientType?: "individual" | "business";
  companyName?: string;
  status: "lead" | "inquiry";
  customText: string | undefined;
  services: string[];
  assignedUserColor?: string;
  assignedUserId?: Id<"users">;
  assignees?: {
    id: Id<"users">;
    name: string | null;
    color?: string;
  }[];
  investmentCity?: string;
  investmentStreet?: string;
  comment?: string;
  clientCity?: string;
  statusChangedAt?: number;
  cost?: number;
  price?: number;
  profit?: number;
};

export type KanbanItem = KanbanOrderItem | KanbanPendingItem;

export const list = query({
  args: {},
  handler: async (ctx): Promise<KanbanItem[]> => {
    // Pobierz wszystkie aktywne zlecenia (bez zarchiwizowanych)
    const allOrders = await ctx.db
      .query("orders")
      .order("desc")
      .take(500);

    const activeOrders = allOrders.filter((o) => o.status !== "archived");

    // Pobierz wszystkie nieprzetworzone i niezarchiwizowane pending submissions
    const pendings = await ctx.db
      .query("pendingJotformSubmissions")
      .filter((q) =>
        q.and(
          q.eq(q.field("processed"), false),
          q.neq(q.field("archived"), true),
        ),
      )
      .collect();

    const orderItems: KanbanOrderItem[] = await Promise.all(
      activeOrders.map(async (order) => {
        const client = await ctx.db.get(order.clientId);
        const lineItems = await ctx.db
          .query("orderLineItems")
          .withIndex("by_order_sort", (q) => q.eq("orderId", order._id))
          .collect();
        let totalGross = 0;
        for (const item of lineItems) {
          const discount = item.discountPercent ?? 0;
          const net = item.quantity * item.unitPrice * (1 - discount / 100);
          totalGross += net * (1 + item.vatRate / 100);
        }
        let assignedUserColor: string | undefined;
        if (order.assignedUserId) {
          const assignedUser = await ctx.db.get(order.assignedUserId);
          assignedUserColor = assignedUser?.color ?? undefined;
        }

        const assigneesArray = Array.from(new Set([
          ...(order.assignedUserId ? [order.assignedUserId] : []),
          ...(order.assignedUserIds || [])
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
        
        const assignees = resolvedAssignees.filter((u): u is NonNullable<typeof u> => u !== null);

        return {
          type: "order" as const,
          id: order._id,
          orderId: order._id,
          clientId: order.clientId,
          clientFirstName: client?.firstName ?? "",
          clientLastName: client?.lastName ?? "",
          clientType: client?.clientType,
          companyName: client?.companyName,
          status: order.status,
          statusChangedAt: order.statusChangedAt ?? order._creationTime,
          orderName: order.name,
          customText: order.customText,
          grossAmount: lineItems.length > 0 ? Math.round(totalGross * 100) / 100 : undefined,
          services: order.services ?? [],
          docs: orderDocs(order.documents),
          assignedUserColor,
          assignedUserId: order.assignedUserId,
          assignees,
          investmentCity: order.investmentCity,
          investmentStreet: order.investmentStreet,
          comment: order.comment,
          clientCity: client?.city,
        };
      }),
    );

    const pendingItems: KanbanPendingItem[] = await Promise.all(
      pendings.map(async (pending) => {
        let firstName = pending.firstName;
        let lastName = pending.lastName;
        let clientType: "individual" | "business" | undefined;
        let companyName: string | undefined;
        let clientCity: string | undefined;
        if (pending.clientId) {
          const client = await ctx.db.get(pending.clientId);
          if (client) {
            firstName = client.firstName;
            lastName = client.lastName;
            clientType = client.clientType;
            companyName = client.companyName;
            clientCity = client.city;
          }
        }
        let assignedUserColor: string | undefined;
        if (pending.assignedUserId) {
          const user = await ctx.db.get(pending.assignedUserId);
          assignedUserColor = user?.color ?? undefined;
        }

        const assigneesArray = Array.from(new Set([
          ...(pending.assignedUserId ? [pending.assignedUserId] : []),
          ...(pending.assignedUserIds || [])
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
        
        const assignees = resolvedAssignees.filter((u): u is NonNullable<typeof u> => u !== null);

        return {
          type: "pending" as const,
          id: pending._id,
          pendingId: pending._id,
          clientId: pending.clientId,
          clientFirstName: firstName,
          clientLastName: lastName,
          clientType,
          companyName,
          status: pending.stage === "inquiry" ? "inquiry" : "lead",
          statusChangedAt: pending.stageChangedAt ?? pending._creationTime,
          customText: pending.customText,
          services: pending.services ?? [],
          assignedUserColor,
          assignedUserId: pending.assignedUserId,
          assignees,
          investmentCity: pending.investmentCity,
          investmentStreet: pending.investmentStreet,
          comment: pending.comment,
          clientCity: clientCity ?? pending.city,
          cost: pending.cost,
          price: pending.price,
          profit: pending.profit,
        };
      }),
    );

    return [...orderItems, ...pendingItems];
  },
});

export const listArchived = query({
  args: {},
  handler: async (ctx) => {
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_status", (q) => q.eq("status", "archived"))
      .order("desc")
      .take(300);

    return await Promise.all(
      orders.map(async (order) => {
        const client = await ctx.db.get(order.clientId);
        return {
          ...order,
          clientFirstName: client?.firstName ?? "",
          clientLastName: client?.lastName ?? "",
          clientType: client?.clientType,
          companyName: client?.companyName,
        };
      }),
    );
  },
});
