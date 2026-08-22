import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

export const exalcoWebhook = httpAction(async (ctx, request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: Record<string, any> = {};
  try {
    body = await request.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const dataObj = body.data || body.order || body;

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

  const statusLower = rawStatus.toLowerCase();
  const isAcceptance =
    statusLower.includes("akceptacj") ||
    statusLower.includes("accept") ||
    statusLower.includes("potwierdz");

  if (!isAcceptance) {
    return new Response(
      JSON.stringify({
        success: true,
        ignored: true,
        message: `Status '${rawStatus}' does not trigger confirmation. Expected 'Akceptacja'.`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // Wywołaj mutację ustawienia daty potwierdzenia (confirmedDate)
  const result = await ctx.runMutation(api.orders.confirmDeliveryByExalcoWebhook, {
    orderIdOrNumber: String(orderIdOrNumber),
    rawStatus,
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
      message: "Delivery status successfully updated to Confirmed (Potwierdzono)",
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
