import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

export const exalcoWebhook = httpAction(async (ctx, request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const dataObj = ((body.data || body.order || body) ?? {}) as Record<string, unknown>;

  // Identyfikacja zlecenia z ładunku Exalco (wsparcie płaścich i zagnieżdżonych struktur)
  const orderIdOrNumber =
    dataObj.orderNumber ||
    dataObj.orderId ||
    dataObj.externalOrderNumber ||
    dataObj.externalOrderId ||
    dataObj.number ||
    dataObj.id ||
    dataObj.order_number ||
    dataObj.order_id ||
    body.orderNumber ||
    body.orderId ||
    body.externalOrderNumber ||
    body.externalOrderId ||
    body.number ||
    body.id;

  // Odczyt statusu
  const rawStatus = String(
    dataObj.status ||
    dataObj.newStatus ||
    dataObj.state ||
    dataObj.event ||
    dataObj.statusName ||
    body.status ||
    body.newStatus ||
    body.state ||
    body.event ||
    body.statusName ||
    "",
  ).trim();

  if (!orderIdOrNumber) {
    return new Response(
      JSON.stringify({ error: "Missing order identification (orderNumber/orderId) in payload" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Odczyt daty dostawy / odbioru z Exalco (wyłącznie z dedykowanych pól dostawy/odbioru)
  const rawDateVal =
    dataObj.deliveryDate ||
    dataObj.plannedDeliveryDate ||
    dataObj.expectedDeliveryDate ||
    dataObj.pickupDate ||
    dataObj.plannedPickupDate ||
    body.deliveryDate ||
    body.plannedDeliveryDate ||
    body.expectedDeliveryDate ||
    body.pickupDate;

  let deliveryDateTs: number | undefined;
  if (rawDateVal) {
    if (typeof rawDateVal === "number") {
      deliveryDateTs = rawDateVal;
    } else {
      const parsed = Date.parse(String(rawDateVal));
      if (!isNaN(parsed)) deliveryDateTs = parsed;
    }
  }

  const statusLower = rawStatus.toLowerCase();
  const isAcceptance =
    statusLower.includes("akceptacj") ||
    statusLower.includes("accept") ||
    statusLower.includes("potwierdz");

  if (!isAcceptance && !deliveryDateTs) {
    return new Response(
      JSON.stringify({
        success: true,
        ignored: true,
        message: `Status '${rawStatus}' does not trigger action and no date provided.`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // Wywołaj mutację ustawienia daty potwierdzenia (confirmedDate) oraz daty dostawy/odbioru z Exalco (deliveryDate)
  const result = await ctx.runMutation(api.orders.confirmDeliveryByExalcoWebhook, {
    orderIdOrNumber: String(orderIdOrNumber),
    rawStatus: isAcceptance ? rawStatus : undefined,
    deliveryDate: deliveryDateTs,
  });

  if (!result.success) {
    return new Response(JSON.stringify({ error: result.reason }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      orderId: result.orderId,
      confirmedDate: result.confirmedDate,
      message: "Delivery status and/or Exalco delivery date successfully updated",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});

export const exalcoWebhookOptions = httpAction(async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Api-Key, X-Webhook-Secret",
    },
  });
});
