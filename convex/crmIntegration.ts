import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api, internal } from "./_generated/api";

export const sendDeliveryOrderToCrm = action({
  args: {
    orderId: v.id("orders"),
    deliveryIndex: v.number(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; externalOrderId?: string; externalOrderNumber?: string }> => {
    // 1. Pobierz zlecenie
    const order = await ctx.runQuery(api.orders.getById, { orderId: args.orderId });
    if (!order) {
      throw new ConvexError("Nie znaleziono zlecenia w systemie ADKokna.");
    }

    const deliveries = order.serviceDeliveries ?? [];
    const delivery = deliveries[args.deliveryIndex];
    if (!delivery) {
      throw new ConvexError("Nie znaleziono pozycji zamówienia u dostawcy.");
    }

    // 2. Pobierz dostawcę
    const supplier = await ctx.runQuery(api.suppliers.getByIdInternal, { supplierId: delivery.supplierId });
    if (!supplier) {
      throw new ConvexError("Nie znaleziono dostawcy.");
    }

    if (!supplier.isApiEnabled || !supplier.apiEndpoint || !supplier.apiKey) {
      throw new ConvexError(`Dostawca ${supplier.name} nie ma aktywnej integracji API lub brak skonfigurowanych parametrów.`);
    }

    // 3. Pobierz klienta zlecenia do stworzenia wyczerpującej notatki
    const client = await ctx.runQuery(api.clients.getById, { clientId: order.clientId });
    const clientName = client ? (client.companyName ? `${client.companyName} (${client.firstName} ${client.lastName})` : `${client.firstName} ${client.lastName}`) : "Brak danych klienta";
    const clientPhone = client?.phone ? ` | Tel: ${client.phone}` : "";
    const clientEmail = client?.email ? ` | Email: ${client.email}` : "";
    const investmentParts = [order.investmentStreet, order.investmentBuildingNumber, order.investmentCity].filter(Boolean);
    const investmentAddress = investmentParts.length > 0 ? ` | Inwestycja: ${investmentParts.join(" ")}` : "";

    const feedNotesText = (delivery.notesFeed ?? []).map((n) => n.note).join("\n---\n");
    const notesTextToUse = feedNotesText || delivery.notes || "";

    const notesCombined = [
      `Zlecenie ADK: ${order.name || order.customText || order._id}`,
      `Usługa: ${delivery.serviceName}`,
      `Klient: ${clientName}${clientPhone}${clientEmail}${investmentAddress}`,
      notesTextToUse ? `\nUwagi do zamówienia:\n${notesTextToUse}` : "",
    ].filter(Boolean).join("\n");

    const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL || "https://fearless-firefly-85.eu-west-1.convex.site";
    const webhookUrl = `${siteUrl.replace(/\/+$/, "")}/api/webhooks/exalco`;

    if (!delivery.netAmount || delivery.netAmount <= 0) {
      throw new ConvexError(
        "Przed wysłaniem zamówienia do ALCO uzupełnij pole 'Kwota netto' w sekcji realizacji – musi być większa od 0."
      );
    }

    const payload = {
      valueNetto: delivery.netAmount,
      notes: notesCombined,
      webhookUrl,
      callbackUrl: webhookUrl,
    };

    // 4. Wyślij żądanie HTTP POST do API CRM
    let rawEndpoint = supplier.apiEndpoint.trim();
    if (!rawEndpoint.startsWith("http://") && !rawEndpoint.startsWith("https://")) {
      rawEndpoint = `https://${rawEndpoint}`;
    }
    // Wyciągnij bazowy URL serwera CRM
    const baseUrl = rawEndpoint.replace(/\/api\/partner\/orders.*$/, "").replace(/\/+$/, "");
    const createOrderUrl = `${baseUrl}/api/partner/orders`;

    const response = await fetch(createOrderUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": supplier.apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ConvexError(`Błąd wysyłania do CRM API (${response.status}): ${errorText}`);
    }

    const result = (await response.json()) as {
      success: boolean;
      orderId?: string;
      orderNumber?: string;
      message?: string;
    };

    if (!result.success) {
      throw new ConvexError(result.message || "Odpowiedź CRM API wskazała niepowodzenie.");
    }

    // 5. Zapisz zwrócone externalOrderId i externalOrderNumber w Convex
    await ctx.runMutation(api.orders.updateExternalOrderInfo, {
      orderId: args.orderId,
      deliveryIndex: args.deliveryIndex,
      externalOrderId: result.orderId,
      externalOrderNumber: result.orderNumber,
    });

    if (delivery.notes?.trim()) {
      await ctx.runMutation(api.orders.recordCrmNoteSent, {
        orderId: args.orderId,
        deliveryIndex: args.deliveryIndex,
        noteText: delivery.notes.trim(),
      });
    }

    return {
      success: true,
      externalOrderId: result.orderId,
      externalOrderNumber: result.orderNumber,
    };
  },
});

export const addNoteToCrmOrder = action({
  args: {
    orderId: v.id("orders"),
    deliveryIndex: v.number(),
    noteText: v.string(),
    threadId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<unknown> => {
    const order = await ctx.runQuery(api.orders.getById, { orderId: args.orderId });
    if (!order) throw new ConvexError("Nie znaleziono zlecenia.");
    const delivery = order.serviceDeliveries?.[args.deliveryIndex];
    if (!delivery || !delivery.externalOrderNumber) {
      throw new ConvexError("Zamówienie nie zostało jeszcze utworzone w CRM Exalco.");
    }
    const supplier = await ctx.runQuery(api.suppliers.getByIdInternal, { supplierId: delivery.supplierId });
    if (!supplier || !supplier.apiEndpoint || !supplier.apiKey) {
      throw new ConvexError("Dostawca nie posiada skonfigurowanego API.");
    }

    let rawEndpoint: string = supplier.apiEndpoint.trim();
    if (!rawEndpoint.startsWith("http://") && !rawEndpoint.startsWith("https://")) {
      rawEndpoint = `https://${rawEndpoint}`;
    }
    const baseUrl = rawEndpoint.replace(/\/api\/partner\/orders.*$/, "").replace(/\/+$/, "");
    const addNoteUrl = `${baseUrl}/api/partner/orders/add-note`;

    const response = await fetch(addNoteUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": supplier.apiKey,
      },
      body: JSON.stringify({
        orderIdOrNumber: delivery.externalOrderNumber,
        notes: args.noteText,
        threadId: args.threadId,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new ConvexError(`Błąd dodawania notatki w CRM (${response.status}): ${errText}`);
    }

    const resJson = await response.json();

    await ctx.runMutation(api.orders.recordCrmNoteSent, {
      orderId: args.orderId,
      deliveryIndex: args.deliveryIndex,
      noteText: args.noteText.trim(),
      threadId: args.threadId,
    });

    return resJson;
  },
});

export const uploadFileToCrmOrder = action({
  args: {
    orderId: v.id("orders"),
    deliveryIndex: v.number(),
    fileId: v.optional(v.string()),
    fileType: v.union(v.literal("RW"), v.literal("Rysunek")),
    fileName: v.string(),
    fileBase64: v.string(),
    externalOrderNumber: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<unknown> => {
    const order = await ctx.runQuery(api.orders.getById, { orderId: args.orderId });
    if (!order) throw new ConvexError("Nie znaleziono zlecenia.");
    const delivery = order.serviceDeliveries?.[args.deliveryIndex];
    const orderNumberToUse = args.externalOrderNumber || delivery?.externalOrderNumber;
    if (!orderNumberToUse) {
      throw new ConvexError("Zamówienie nie zostało jeszcze utworzone w CRM Exalco.");
    }
    const supplierIdToUse = delivery?.supplierId;
    if (!supplierIdToUse) {
      throw new ConvexError("Nie odnaleziono ID dostawcy w zamówieniu.");
    }
    const supplier = await ctx.runQuery(api.suppliers.getByIdInternal, { supplierId: supplierIdToUse });
    if (!supplier || !supplier.apiEndpoint || !supplier.apiKey) {
      throw new ConvexError("Dostawca nie posiada skonfigurowanego API.");
    }

    let rawEndpoint: string = supplier.apiEndpoint.trim();
    if (!rawEndpoint.startsWith("http://") && !rawEndpoint.startsWith("https://")) {
      rawEndpoint = `https://${rawEndpoint}`;
    }
    const baseUrl = rawEndpoint.replace(/\/api\/partner\/orders.*$/, "").replace(/\/+$/, "");
    const uploadFileUrl = `${baseUrl}/api/partner/orders/upload-file`;

    const response = await fetch(uploadFileUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": supplier.apiKey,
      },
      body: JSON.stringify({
        orderIdOrNumber: orderNumberToUse,
        fileType: args.fileType,
        fileName: args.fileName,
        fileBase64: args.fileBase64,
      }),
    });

    const resData = await response.json();
    try {
      await ctx.runMutation(internal.orders.recordSentApiFilesInternal, {
        orderId: args.orderId,
        deliveryIndex: args.deliveryIndex,
        files: [
          {
            fileId: args.fileId || args.fileName,
            fileName: args.fileName,
            fileType: args.fileType,
            sentAt: Date.now(),
          },
        ],
      });
    } catch (e) {
      console.warn("Nie udało się zapisać historii wysłanych plików:", e);
    }

    return resData;
  },
});

// Action for sending delivery order with attached files to CRM
export const sendDeliveryOrderWithFilesToCrm = action({
  args: {
    orderId: v.id("orders"),
    deliveryIndex: v.number(),
    filesToUpload: v.optional(
      v.array(
        v.object({
          fileId: v.string(),
          fileName: v.string(),
          fileType: v.union(v.literal("RW"), v.literal("Rysunek")),
        })
      )
    ),
  },
  handler: async (ctx, args): Promise<unknown> => {
    // 1. Send delivery order to CRM
    const result = (await ctx.runAction(api.crmIntegration.sendDeliveryOrderToCrm, {
      orderId: args.orderId,
      deliveryIndex: args.deliveryIndex,
    })) as { success: boolean; externalOrderId?: string; externalOrderNumber?: string };

    // 2. Upload selected files sequentially if provided
    if (args.filesToUpload && args.filesToUpload.length > 0 && result.externalOrderNumber) {
      for (const fileItem of args.filesToUpload) {
        let uploaded = false;
        let lastError: unknown = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const downloaded = await ctx.runAction(api.googleDrive.downloadDriveFileBase64, {
              fileId: fileItem.fileId,
            });

            await ctx.runAction(api.crmIntegration.uploadFileToCrmOrder, {
              orderId: args.orderId,
              deliveryIndex: args.deliveryIndex,
              fileId: fileItem.fileId,
              fileType: fileItem.fileType,
              fileName: fileItem.fileName,
              fileBase64: downloaded.base64,
              externalOrderNumber: result.externalOrderNumber,
            });
            uploaded = true;
            break;
          } catch (err) {
            lastError = err;
            await new Promise((r) => setTimeout(r, 2000));
          }
        }
        if (!uploaded) {
          console.error(`Nie udało się przesłać pliku ${fileItem.fileName} po 3 próbach:`, lastError);
        }
      }
    }

    return result;
  },
});

