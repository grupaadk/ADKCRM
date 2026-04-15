import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { JOTFORM_SOURCE_LIST_ID, MEASUREMENT_LIST_ID } from "./trelloWebhookLists";

const TRELLO_STATUS_ENTRIES = [
  "lead",
  "inquiry",
  "measurement",
  "offer",
  "contract",
  "production",
  "installation",
  "completed",
  "warranty",
] as const;

type ClientStatus = (typeof TRELLO_STATUS_ENTRIES)[number];

type TrelloWebhookPayload = {
  action?: {
    data?: {
      card?: { id?: string };
      listBefore?: { id?: string };
      listAfter?: { id?: string };
    };
  };
};

function getWebhookPayload(value: unknown): TrelloWebhookPayload {
  if (!value || typeof value !== "object") {
    return {};
  }

  return value as TrelloWebhookPayload;
}

function getStatusForList(
  statusListMap: Partial<Record<ClientStatus, string>> | undefined,
  listId: string,
) {
  if (!statusListMap) {
    return null;
  }

  for (const status of TRELLO_STATUS_ENTRIES) {
    if (statusListMap[status] === listId) {
      return status;
    }
  }

  return null;
}

export const webhook = httpAction(async (ctx, request) => {
  if (request.method !== "POST") {
    return new Response("OK", { status: 200 });
  }

  let payload: TrelloWebhookPayload = {};

  try {
    payload = getWebhookPayload(await request.json());
  } catch {
    return new Response("OK", { status: 200 });
  }

  const cardId = payload.action?.data?.card?.id;
  const listBeforeId = payload.action?.data?.listBefore?.id;
  const listAfterId = payload.action?.data?.listAfter?.id;

  if (!cardId || !listAfterId) {
    return new Response("OK", { status: 200 });
  }

  // ── Przypadek 0: karta z maila przeniesiona na "Do pomiarów" ─────────────
  // AI wyciąga dane klienta z treści maila → tworzy klienta + zamówienie
  if (listAfterId === MEASUREMENT_LIST_ID) {
    const emailPending = await ctx.runQuery(
      api.emailLeads.findPendingByCardId,
      { trelloCardId: cardId },
    );

    console.info("[trello] card moved to MEASUREMENT", {
      cardId,
      listBeforeId,
      emailPendingFound: !!emailPending,
      alreadyProcessed: emailPending?.processed,
    });

    if (emailPending && !emailPending.processed) {
      try {
        await ctx.runAction(api.emailLeads.createFromEmail, {
          pendingId: emailPending._id as Id<"pendingEmailSubmissions">,
          trelloCardId: cardId,
        });
        console.info("[trello] created client+order from email lead", { cardId });
      } catch (error) {
        console.error("[trello] createFromEmail failed:", { cardId, error: String(error) });
      }
      return new Response("OK", { status: 200 });
    }
  }

  // ── Przypadek 1: karta przeniesiona z listy JotForm na "Do pomiarów" ──────
  // Tworzymy klienta + zamówienie z oczekującego zgłoszenia JotForm
  if (
    listAfterId === MEASUREMENT_LIST_ID &&
    (listBeforeId === JOTFORM_SOURCE_LIST_ID || !listBeforeId)
  ) {
    const pending = await ctx.runQuery(
      api.jotformInternal.findPendingByCardId,
      { trelloCardId: cardId },
    );

    if (pending && !pending.processed) {
      try {
        await ctx.runMutation(api.jotformInternal.createFromPending, {
          pendingId: pending._id,
          trelloCardId: cardId,
        });
        console.info("[trello] created client+order from pending submission", {
          cardId,
          pendingId: pending._id,
        });
      } catch (error) {
        console.error("[trello] createFromPending failed:", error);
      }
      return new Response("OK", { status: 200 });
    }
  }

  // ── Przypadek 2: standardowa zmiana statusu istniejącego zamówienia ───────
  const config = await ctx.runQuery(api.trello.getConfig, {});
  const order = await ctx.runQuery(api.orders.findByTrelloCardId, {
    trelloCardId: cardId,
  });

  if (!config || !order) {
    return new Response("OK", { status: 200 });
  }

  const nextStatus = getStatusForList(config.statusListMap, listAfterId);
  if (!nextStatus || nextStatus === order.status) {
    return new Response("OK", { status: 200 });
  }

  try {
    await ctx.runMutation(api.orders.changeStatus, {
      orderId: order._id,
      newStatus: nextStatus,
      triggeredBy: "trello",
    });
  } catch (error) {
    console.error("Trello webhook status sync failed:", error);
  }

  return new Response("OK", { status: 200 });
});
