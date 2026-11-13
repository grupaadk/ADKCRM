import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

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

  try {
    await ctx.runMutation(internal.systemLogs.insert, {
      level: "info",
      source: "exalcoWebhook",
      message: "Otrzymano webhook z Exalco",
      data: body,
    });
  } catch (err) {
    console.warn("[exalcoWebhook] Nie udało się zapisać logu webhooka:", err);
  }

  const rawDataObj = body.data || body.order || body;
  const dataObj = (typeof rawDataObj === "object" && rawDataObj !== null ? rawDataObj : body) as Record<string, unknown>;

  // Identyfikacja zlecenia z ładunku Exalco (wsparcie płaskich i zagnieżdżonych struktur)
  const orderIdOrNumber =
    (typeof body.order === "string" || typeof body.order === "number" ? String(body.order) : "") ||
    (typeof body.orderIdOrNumber === "string" || typeof body.orderIdOrNumber === "number" ? String(body.orderIdOrNumber) : "") ||
    (typeof dataObj.orderIdOrNumber === "string" || typeof dataObj.orderIdOrNumber === "number" ? String(dataObj.orderIdOrNumber) : "") ||
    dataObj.orderNumber ||
    dataObj.orderId ||
    dataObj.externalOrderNumber ||
    dataObj.externalOrderId ||
    dataObj.adkOrderId ||
    dataObj.clientOrderId ||
    dataObj.number ||
    dataObj.id ||
    dataObj.order_number ||
    dataObj.order_id ||
    body.orderNumber ||
    body.orderId ||
    body.externalOrderNumber ||
    body.externalOrderId ||
    body.adkOrderId ||
    body.clientOrderId ||
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
  if (rawDateVal && rawDateVal !== "null" && rawDateVal !== "undefined") {
    if (typeof rawDateVal === "number" && rawDateVal > 0) {
      deliveryDateTs = rawDateVal;
    } else if (typeof rawDateVal === "string" && rawDateVal.trim()) {
      const parsed = Date.parse(rawDateVal.trim());
      if (!isNaN(parsed) && parsed > 0) deliveryDateTs = parsed;
    }
  }

  // Weryfikacja czy wyciągnięta data dostawy nie jest w rzeczywistości datą utworzenia/złożenia zamówienia w ALCO
  const creationDateVal =
    dataObj.createdAt ||
    dataObj.created_at ||
    dataObj.orderDate ||
    dataObj.date ||
    body.createdAt ||
    body.created_at ||
    body.orderDate ||
    body.date;

  if (creationDateVal && deliveryDateTs) {
    const createdTs = typeof creationDateVal === "number" ? creationDateVal : Date.parse(String(creationDateVal));
    if (!isNaN(createdTs) && Math.abs(deliveryDateTs - createdTs) < 86400000) {
      // Data odbioru z ALCO odpowiada dacie utworzenia zlecenia — ALCO nie ustawiło rzeczywistej daty odbioru
      deliveryDateTs = undefined;
    }
  }

  const statusLower = rawStatus.toLowerCase();
  const isAcceptance =
    statusLower.includes("akceptacj") ||
    statusLower.includes("accept") ||
    statusLower.includes("potwierdz");

  // Odczyt nadchodzącej notatki / wiadomości z Exalco
  const rawNoteObj = (dataObj.note || body.note || dataObj.message || body.message) as Record<string, unknown> | undefined;
  const isRawNoteObj = typeof rawNoteObj === "object" && rawNoteObj !== null;

  const incomingNote = String(
    (typeof dataObj.note === "string" ? dataObj.note : "") ||
    (typeof body.note === "string" ? body.note : "") ||
    (typeof dataObj.notes === "string" ? dataObj.notes : "") ||
    (typeof body.notes === "string" ? body.notes : "") ||
    (typeof dataObj.message === "string" ? dataObj.message : "") ||
    (typeof body.message === "string" ? body.message : "") ||
    (isRawNoteObj ? rawNoteObj.note || rawNoteObj.text || rawNoteObj.content || rawNoteObj.message || rawNoteObj.body || "" : "") ||
    dataObj.comment ||
    dataObj.noteText ||
    dataObj.text ||
    dataObj.body ||
    body.comment ||
    body.noteText ||
    body.text ||
    body.body ||
    "",
  ).trim();

  const extractName = (val: unknown): string => {
    if (!val) return "";
    if (typeof val === "string") return val.trim();
    if (typeof val === "object") {
      const obj = val as Record<string, unknown>;
      return String(obj.name || obj.displayName || obj.userName || obj.authorName || obj.email || "").trim();
    }
    return String(val).trim();
  };

  const authorName =
    extractName(dataObj.authorName) ||
    extractName(dataObj.author) ||
    extractName(dataObj.userName) ||
    extractName(dataObj.sender) ||
    extractName(dataObj.senderName) ||
    (isRawNoteObj ? extractName(rawNoteObj.authorName) || extractName(rawNoteObj.author) || extractName(rawNoteObj.createdByName) || extractName(rawNoteObj.sender) || extractName(rawNoteObj.userName) : "") ||
    extractName(body.authorName) ||
    extractName(body.author) ||
    extractName(body.userName) ||
    extractName(body.sender) ||
    extractName(body.senderName) ||
    "";

  // Zawsze zapisz nadchodzącą notatkę z Exalco, niezależnie od statusu
  let noteSaved = false;
  let noteError: string | undefined;

  if (incomingNote) {
    const noteResult = await ctx.runMutation(api.orders.receiveNoteFromExalcoWebhook, {
      orderIdOrNumber: String(orderIdOrNumber),
      noteText: incomingNote,
      authorName: authorName || undefined,
    });

    if (noteResult.success) {
      noteSaved = true;
    } else {
      noteError = noteResult.reason;
      try {
        await ctx.runMutation(internal.systemLogs.insert, {
          level: "warn",
          source: "exalcoWebhook",
          message: `Nie udało się przypisać notatki z Exalco: ${noteResult.reason}`,
          data: {
            orderIdOrNumber: String(orderIdOrNumber),
            incomingNote,
            authorName,
            payload: body,
          },
        });
      } catch (err) {
        console.warn("[exalcoWebhook] Nie udało się zapisać błędu notatki do logów:", err);
      }
    }
  }

  // Jeśli brak statusu akceptacji i brak daty dostawy — odpowiedz sukcesem lub błędem przypisania notatki
  if (!isAcceptance && !deliveryDateTs) {
    if (noteError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: noteError,
          message: `Failed to save note: ${noteError}`,
        }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({
        success: true,
        noted: noteSaved,
        message: `Status '${rawStatus}' does not trigger status update. ${noteSaved ? "Note saved." : "No note to save."}`,
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
