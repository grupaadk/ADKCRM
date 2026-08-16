import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const sendDeliveryOrderToCrm = action({
  args: {
    orderId: v.id("orders"),
    deliveryIndex: v.number(),
  },
  handler: async (ctx, args) => {
    // 1. Pobierz zlecenie
    const order = await ctx.runQuery(api.orders.getById, { orderId: args.orderId });
    if (!order) {
      throw new Error("Nie znaleziono zlecenia w systemie ADKokna.");
    }

    const deliveries = order.serviceDeliveries ?? [];
    const delivery = deliveries[args.deliveryIndex];
    if (!delivery) {
      throw new Error("Nie znaleziono pozycji zamówienia u dostawcy.");
    }

    // 2. Pobierz dostawcę
    const supplier = await ctx.runQuery(api.suppliers.getByIdInternal, { supplierId: delivery.supplierId });
    if (!supplier) {
      throw new Error("Nie znaleziono dostawcy.");
    }

    if (!supplier.isApiEnabled || !supplier.apiEndpoint || !supplier.apiKey) {
      throw new Error(`Dostawca ${supplier.name} nie ma aktywnej integracji API lub brak skonfigurowanych parametrów.`);
    }

    // 3. Pobierz klienta zlecenia do stworzenia wyczerpującej notatki
    const client = await ctx.runQuery(api.clients.getById, { clientId: order.clientId });
    const clientName = client ? (client.companyName ? `${client.companyName} (${client.firstName} ${client.lastName})` : `${client.firstName} ${client.lastName}`) : "Brak danych klienta";
    const clientPhone = client?.phone ? ` | Tel: ${client.phone}` : "";
    const clientEmail = client?.email ? ` | Email: ${client.email}` : "";
    const investmentParts = [order.investmentStreet, order.investmentBuildingNumber, order.investmentCity].filter(Boolean);
    const investmentAddress = investmentParts.length > 0 ? ` | Inwestycja: ${investmentParts.join(" ")}` : "";

    const notesCombined = [
      `Zlecenie ADK: ${order.name || order.customText || order._id}`,
      `Usługa: ${delivery.serviceName}`,
      `Klient: ${clientName}${clientPhone}${clientEmail}${investmentAddress}`,
      delivery.notes ? `\nUwagi do zamówienia:\n${delivery.notes}` : "",
    ].filter(Boolean).join("\n");

    const payload = {
      valueNetto: delivery.netAmount ?? 0,
      notes: notesCombined,
    };

    // 4. Wyślij żądanie HTTP POST do API CRM
    let targetUrl = supplier.apiEndpoint.trim();
    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      targetUrl = `https://${targetUrl}`;
    }
    if (!targetUrl.includes("/api/partner/orders")) {
      targetUrl = targetUrl.replace(/\/+$/, "") + "/api/partner/orders";
    }

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": supplier.apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Błąd wysyłania do CRM API (${response.status}): ${errorText}`);
    }

    const result = (await response.json()) as {
      success: boolean;
      orderId?: string;
      orderNumber?: string;
      message?: string;
    };

    if (!result.success) {
      throw new Error(result.message || "Odpowiedź CRM API wskazała niepowodzenie.");
    }

    // 5. Zapisz zwrócone externalOrderId i externalOrderNumber w Convex
    await ctx.runMutation(api.orders.updateExternalOrderInfo, {
      orderId: args.orderId,
      deliveryIndex: args.deliveryIndex,
      externalOrderId: result.orderId,
      externalOrderNumber: result.orderNumber,
    });

    return {
      success: true,
      externalOrderId: result.orderId,
      externalOrderNumber: result.orderNumber,
    };
  },
});
