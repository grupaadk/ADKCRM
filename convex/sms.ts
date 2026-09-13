import { v } from "convex/values";
import { action, internalAction, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

// Normalizuje numer telefonu do formatu akceptowanego przez SMSAPI
// np. "+48 514 481 473" → "48514481473", "514481473" → "514481473"
function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-().]/g, "").replace(/^\+/, "");
}

// Domyślne wartości konfiguracji SMS
const DEFAULT_SENDER = "Grupa ADK";
const DEFAULT_INTERNAL_PHONE = "48515453090";

// Pobranie konfiguracji SMS
export const getConfig = query({
  args: {},
  handler: async (ctx) => {
    const config = await ctx.db.query("smsConfig").first();
    return config ?? null;
  },
});

// Zapis konfiguracji SMS
export const saveConfig = mutation({
  args: {
    internalPhone: v.string(),
    senderName: v.string(),
    recipients: v.optional(v.array(v.object({ name: v.string(), phone: v.string() }))),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("smsConfig").first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        internalPhone: args.internalPhone,
        senderName: args.senderName,
        recipients: args.recipients,
      });
    } else {
      await ctx.db.insert("smsConfig", {
        internalPhone: args.internalPhone,
        senderName: args.senderName,
        recipients: args.recipients,
      });
    }
  },
});

// Wysyła adres klienta (imię, nazwisko, adres) na skonfigurowany wewnętrzny numer
export const sendAddressSms = action({
  args: {
    clientId: v.id("clients"),
  },
  handler: async (ctx, args) => {
    const token = process.env.SMSAPI_TOKEN;
    if (!token) {
      throw new Error("SMSAPI_TOKEN nie ustawiony");
    }

    const [client, smsConfig] = await Promise.all([
      ctx.runQuery(api.clients.getById, { clientId: args.clientId }),
      ctx.runQuery(api.sms.getConfig, {}),
    ]);

    if (!client) {
      throw new Error("Klient nie znaleziony");
    }

    const internalPhone = smsConfig?.internalPhone || DEFAULT_INTERNAL_PHONE;
    const senderName = smsConfig?.senderName || DEFAULT_SENDER;

    const addressParts = [
      client.street && client.buildingNumber
        ? `ul. ${client.street} ${client.buildingNumber}${client.apartmentNumber ? `/${client.apartmentNumber}` : ""}`
        : client.street ?? null,
      client.postalCode && client.city
        ? `${client.postalCode} ${client.city}`
        : client.city ?? null,
    ].filter(Boolean);

    const fullAddress = addressParts.join(", ");

    const message = `${client.firstName} ${client.lastName}\n${fullAddress}`;

    const body = new URLSearchParams({
      to: internalPhone,
      message,
      from: senderName,
      encoding: "utf-8",
      format: "json",
    });

    const response = await fetch("https://api.smsapi.pl/sms.do", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const result = (await response.json()) as Record<string, unknown>;
    if (!response.ok || result.error) {
      const raw = JSON.stringify(result);
      console.error("[sms] Błąd wysyłki adresu", { status: response.status, raw });
      throw new Error(`Błąd SMSAPI (HTTP ${response.status}): ${raw}`);
    }

    const list = result.list as { id: string }[] | undefined;
    console.info("[sms] Adres wysłany SMS", { to: internalPhone, messageId: list?.[0]?.id });
  },
});

// Wysyła adres inwestycji ze zlecenia na wskazane numery telefonów
export const sendOrderAddressSms = action({
  args: {
    orderId: v.id("orders"),
    recipients: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const token = process.env.SMSAPI_TOKEN;
    if (!token) {
      throw new Error("SMSAPI_TOKEN nie ustawiony");
    }

    if (args.recipients.length === 0) {
      throw new Error("Nie podano żadnych odbiorców");
    }

    const [order, smsConfig] = await Promise.all([
      ctx.runQuery(api.orders.getById, { orderId: args.orderId }),
      ctx.runQuery(api.sms.getConfig, {}),
    ]);

    if (!order) {
      throw new Error("Zlecenie nie znalezione");
    }

    const client = await ctx.runQuery(api.clients.getById, { clientId: order.clientId });

    const senderName = smsConfig?.senderName || DEFAULT_SENDER;

    const addressParts = [
      order.investmentStreet && order.investmentBuildingNumber
        ? `ul. ${order.investmentStreet} ${order.investmentBuildingNumber}${order.investmentApartmentNumber ? `/${order.investmentApartmentNumber}` : ""}`
        : order.investmentStreet ?? null,
      order.investmentPostalCode && order.investmentCity
        ? `${order.investmentPostalCode} ${order.investmentCity}`
        : order.investmentCity ?? null,
    ].filter(Boolean);

    const fullAddress = addressParts.join(", ");
    const clientName = client ? `${client.firstName} ${client.lastName}` : "";
    const message = clientName ? `${clientName}\n${fullAddress}` : fullAddress;

    for (const phone of args.recipients) {
      const normalized = normalizePhone(phone);
      const body = new URLSearchParams({
        to: normalized,
        message,
        from: senderName,
        encoding: "utf-8",
        format: "json",
      });

      const response = await fetch("https://api.smsapi.pl/sms.do", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      const result = (await response.json()) as Record<string, unknown>;
      if (!response.ok || result.error) {
        const raw = JSON.stringify(result);
        console.error("[sms] Błąd wysyłki adresu zlecenia", { status: response.status, raw, to: normalized });
        throw new Error(`Błąd SMSAPI (HTTP ${response.status}): ${raw}`);
      }

      const list = result.list as { id: string }[] | undefined;
      console.info("[sms] Adres zlecenia wysłany SMS", { to: normalized, messageId: list?.[0]?.id });
    }
  },
});

// Wysyła SMS potwierdzający przyjęcie prośby o wycenę przez SMSAPI.pl
export const sendQuoteConfirmation = internalAction({
  args: {
    phone: v.string(),
    firstName: v.string(),
  },
  handler: async (ctx, args) => {
    const token = process.env.SMSAPI_TOKEN;
    if (!token) {
      console.warn("[sms] SMSAPI_TOKEN nie ustawiony — SMS pominięty");
      return;
    }

    const smsConfig = await ctx.runQuery(api.sms.getConfig, {});
    const senderName = smsConfig?.senderName || DEFAULT_SENDER;

    const normalized = normalizePhone(args.phone);
    const message =
      `Dziękujemy, ${args.firstName}! Twoja prośba o wycenę została przyjęta. ` +
      `Czas realizacji: 4 dni robocze. Zespół GRUPA ADK`;

    const body = new URLSearchParams({
      to: normalized,
      message,
      from: senderName,
      encoding: "utf-8",
      format: "json",
    });

    let result: unknown;
    try {
      const response = await fetch("https://api.smsapi.pl/sms.do", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      result = await response.json();

      if (!response.ok || (result as Record<string, unknown>).error) {
        console.error("[sms] Błąd SMSAPI", {
          status: response.status,
          result,
          to: normalized,
        });
      } else {
        const list = (result as Record<string, unknown>).list as
          | { id: string }[]
          | undefined;
        console.info("[sms] SMS wysłany", {
          to: normalized,
          messageId: list?.[0]?.id,
        });
      }
    } catch (err) {
      console.error("[sms] Wyjątek podczas wysyłki SMS", { err, to: normalized });
    }
  },
});
