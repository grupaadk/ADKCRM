import { v } from "convex/values";
import type { ActionCtx } from "./_generated/server";
import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { decrypt } from "./lib/crypto";
import { CLIENT_STATUSES } from "./schema";
import {
  JOTFORM_SOURCE_LIST_ID,
  MEASUREMENT_LIST_ID,
} from "./trelloWebhookLists";

const clientStatusMapValidator = v.object({
  lead: v.optional(v.string()),
  inquiry: v.optional(v.string()),
  measurement: v.optional(v.string()),
  offer: v.optional(v.string()),
  contract: v.optional(v.string()),
  production: v.optional(v.string()),
  installation: v.optional(v.string()),
  completed: v.optional(v.string()),
  warranty: v.optional(v.string()),
});

type ClientStatus = keyof {
  lead: true;
  inquiry: true;
  measurement: true;
  offer: true;
  contract: true;
  production: true;
  installation: true;
  completed: true;
  warranty: true;
};

const TRELLO_API_BASE = "https://api.trello.com/1";

function getEnvTrelloCredentials() {
  const apiKey = process.env.TRELLO_API_KEY?.trim();
  const apiToken = process.env.TRELLO_API_TOKEN?.trim();

  if (!apiKey || !apiToken) {
    return null;
  }

  return { apiKey, apiToken };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

// Public query — never exposes decrypted keys
export const getConfig = query({
  args: {},
  handler: async (ctx) => {
    const envCredentials = getEnvTrelloCredentials();
    const config = await ctx.db.query("trelloConfig").first();
    if (!config) return null;
    return {
      boardId: config.boardId,
      listId: config.listId,
      webhookId: config.webhookId,
      statusListMap: config.statusListMap,
      syncEnabled: config.syncEnabled,
      connectedBy: config.connectedBy,
      hasApiKey: !!config.apiKey || !!envCredentials?.apiKey,
      hasApiToken: !!config.apiToken || !!envCredentials?.apiToken,
      usingEnvCredentials: !!envCredentials,
    };
  },
});

// Internal query — returns raw encrypted config for actions only
export const getConfigInternal = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("trelloConfig").first();
  },
});

// ─── Mutations ───────────────────────────────────────────────────────────────

// Accepts pre-encrypted apiKey and apiToken
export const saveConfig = mutation({
  args: {
    encryptedApiKey: v.optional(v.string()),
    encryptedApiToken: v.optional(v.string()),
    boardId: v.optional(v.string()),
    listId: v.optional(v.string()),
    statusListMap: v.optional(clientStatusMapValidator),
    syncEnabled: v.boolean(),
    connectedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("trelloConfig").first();
    const envCredentials = getEnvTrelloCredentials();

    if (
      !existing &&
      !envCredentials &&
      (!args.encryptedApiKey || !args.encryptedApiToken)
    ) {
      throw new Error("Brak kluczy Trello");
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(args.encryptedApiKey !== undefined
          ? { apiKey: args.encryptedApiKey }
          : {}),
        ...(args.encryptedApiToken !== undefined
          ? { apiToken: args.encryptedApiToken }
          : {}),
        boardId: args.boardId,
        listId: args.listId,
        statusListMap: args.statusListMap,
        syncEnabled: args.syncEnabled,
        connectedBy: args.connectedBy,
      });
      return existing._id;
    }

    return await ctx.db.insert("trelloConfig", {
      apiKey: args.encryptedApiKey ?? "",
      apiToken: args.encryptedApiToken ?? "",
      boardId: args.boardId,
      listId: args.listId,
      statusListMap: args.statusListMap,
      syncEnabled: args.syncEnabled,
      connectedBy: args.connectedBy,
    });
  },
});

export const saveWebhookId = mutation({
  args: { webhookId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("trelloConfig").first();
    if (!existing) {
      throw new Error("Trello config not found. Save config first.");
    }
    await ctx.db.patch(existing._id, { webhookId: args.webhookId });
  },
});

export const toggleSync = mutation({
  args: {
    syncEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("trelloConfig").first();
    if (!existing) {
      throw new Error("Trello config not found. Save config first.");
    }
    await ctx.db.patch(existing._id, { syncEnabled: args.syncEnabled });
  },
});

// ─── Actions ─────────────────────────────────────────────────────────────────

// Helper: decrypt Trello credentials from DB
async function getDecryptedCredentials(
  ctx: Pick<ActionCtx, "runQuery">,
): Promise<{ apiKey: string; apiToken: string } | null> {
  const envCredentials = getEnvTrelloCredentials();
  if (envCredentials) {
    return envCredentials;
  }

  const config = await ctx.runQuery(api.trello.getConfigInternal, {});
  if (!config?.apiKey || !config?.apiToken) return null;
  return {
    apiKey: await decrypt(config.apiKey),
    apiToken: await decrypt(config.apiToken),
  };
}

// Encrypt credentials action (called from frontend before saveConfig)
export const encryptCredentials = action({
  args: { apiKey: v.string(), apiToken: v.string() },
  handler: async (
    _ctx,
    args,
  ): Promise<{ encryptedApiKey: string; encryptedApiToken: string }> => {
    const { encrypt } = await import("./lib/crypto");
    return {
      encryptedApiKey: await encrypt(args.apiKey),
      encryptedApiToken: await encrypt(args.apiToken),
    };
  },
});

export const testConnection = action({
  args: {
    apiKey: v.optional(v.string()),
    apiToken: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<Array<{ id: string; name: string }>> => {
    const envCredentials = getEnvTrelloCredentials();
    const apiKey = args.apiKey?.trim() || envCredentials?.apiKey;
    const apiToken = args.apiToken?.trim() || envCredentials?.apiToken;

    if (!apiKey || !apiToken) {
      throw new Error("Trello API credentials are not configured");
    }

    const url = `${TRELLO_API_BASE}/members/me/boards?key=${apiKey}&token=${apiToken}&fields=id,name`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Trello API error: ${response.status}`);
    }

    const boards: Array<{ id: string; name: string }> = await response.json();
    return boards;
  },
});

export const listLists = action({
  args: {
    boardId: v.string(),
  },
  handler: async (_ctx, args): Promise<Array<{ id: string; name: string }>> => {
    const config = await _ctx.runQuery(api.trello.getConfigInternal, {});
    if (!config?.apiKey || !config?.apiToken) {
      throw new Error("Trello credentials are not configured");
    }

    const apiKey = await decrypt(config.apiKey);
    const apiToken = await decrypt(config.apiToken);
    const response = await fetch(
      `${TRELLO_API_BASE}/boards/${args.boardId}/lists?key=${apiKey}&token=${apiToken}&fields=id,name`,
    );

    if (!response.ok) {
      throw new Error(`Trello API error: ${response.status}`);
    }

    return await response.json();
  },
});

type ResolveStatusListMapWithNamesResult = {
  boardId: string | null;
  defaultListId: string | null;
  rows: Array<{
    status: (typeof CLIENT_STATUSES)[number];
    listId: string | null;
    listName: string | null;
    source: "statusListMap" | "listId_fallback" | "unconfigured";
  }>;
  webhookHardcoded: Array<{
    role: string;
    listId: string;
    listName: string | null;
  }>;
};

/** Zwraca mapowanie status CRM → ID listy → nazwa listy w Trello (API). */
export const resolveStatusListMapWithNames = action({
  args: {},
  handler: async (ctx): Promise<ResolveStatusListMapWithNamesResult> => {
    const creds = await getDecryptedCredentials(ctx);
    if (!creds) {
      throw new Error("Brak konfiguracji Trello");
    }
    const { apiKey, apiToken } = creds;

    const config = await ctx.runQuery(api.trello.getConfig, {});
    if (!config) {
      throw new Error("Brak zapisanej konfiguracji Trello");
    }

    const idToName = new Map<string, string>();

    if (config.boardId) {
      const boardResponse = await fetch(
        `${TRELLO_API_BASE}/boards/${config.boardId}/lists?key=${apiKey}&token=${apiToken}&fields=id,name`,
      );
      if (boardResponse.ok) {
        const lists: Array<{ id: string; name: string }> =
          await boardResponse.json();
        for (const list of lists) {
          idToName.set(list.id, list.name);
        }
      }
    }

    async function listNameForId(listId: string): Promise<string | null> {
      const cached = idToName.get(listId);
      if (cached !== undefined) {
        return cached;
      }
      const response = await fetch(
        `${TRELLO_API_BASE}/lists/${listId}?key=${apiKey}&token=${apiToken}&fields=name`,
      );
      if (!response.ok) {
        return null;
      }
      const data: { name?: string } = await response.json();
      const name = data.name ?? null;
      if (name) {
        idToName.set(listId, name);
      }
      return name;
    }

    const rows: Array<{
      status: (typeof CLIENT_STATUSES)[number];
      listId: string | null;
      listName: string | null;
      source: "statusListMap" | "listId_fallback" | "unconfigured";
    }> = [];

    for (const status of CLIENT_STATUSES) {
      const mapped = config.statusListMap?.[status];
      const effectiveId = mapped ?? config.listId ?? null;
      if (!effectiveId) {
        rows.push({
          status,
          listId: null,
          listName: null,
          source: "unconfigured",
        });
        continue;
      }
      const source: "statusListMap" | "listId_fallback" = mapped
        ? "statusListMap"
        : "listId_fallback";
      const listName =
        idToName.get(effectiveId) ?? (await listNameForId(effectiveId));
      rows.push({ status, listId: effectiveId, listName, source });
    }

    const webhookHardcoded: Array<{
      role: string;
      listId: string;
      listName: string | null;
    }> = [
      {
        role: "jotform_source",
        listId: JOTFORM_SOURCE_LIST_ID,
        listName:
          idToName.get(JOTFORM_SOURCE_LIST_ID) ??
          (await listNameForId(JOTFORM_SOURCE_LIST_ID)),
      },
      {
        role: "measurement_create_client_order",
        listId: MEASUREMENT_LIST_ID,
        listName:
          idToName.get(MEASUREMENT_LIST_ID) ??
          (await listNameForId(MEASUREMENT_LIST_ID)),
      },
    ];

    return {
      boardId: config.boardId ?? null,
      defaultListId: config.listId ?? null,
      rows,
      webhookHardcoded,
    };
  },
});

function getListIdForStatus(
  config: {
    listId?: string;
    statusListMap?: Partial<Record<ClientStatus, string>>;
  },
  status: ClientStatus,
) {
  return config.statusListMap?.[status] ?? config.listId;
}

function formatAddress(data: {
  street?: string;
  buildingNumber?: string;
  apartmentNumber?: string;
  postalCode?: string;
  city?: string;
}): string {
  const streetPart = [data.street, data.buildingNumber].filter(Boolean).join(" ");
  const aptPart = data.apartmentNumber ? `lok. ${data.apartmentNumber}` : "";
  const locationPart = [data.postalCode, data.city].filter(Boolean).join(" ");
  return [streetPart, aptPart, locationPart].filter(Boolean).join(", ");
}

function getAttachmentUrls(projectFiles: string | undefined) {
  if (!projectFiles) {
    return [];
  }

  return projectFiles
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getFileNameFromUrl(url: string, fallback: string) {
  try {
    const pathname = new URL(url).pathname;
    const lastSegment = pathname.split("/").filter(Boolean).at(-1);
    return lastSegment || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Jotform file URLs require authentication. If JOTFORM_API_KEY is set,
 * append it as a query param so the download works server-side without cookies.
 */
function buildJotformDownloadUrl(url: string): string {
  const apiKey = process.env.JOTFORM_API_KEY?.trim();
  if (!apiKey) return url;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("jotform.com")) {
      parsed.searchParams.set("apiKey", apiKey);
      return parsed.toString();
    }
  } catch {
    // invalid URL — return as-is
  }
  return url;
}

async function attachBinaryFileToCard(
  cardId: string,
  attachmentUrl: string,
  creds: { apiKey: string; apiToken: string },
) {
  const sourceResponse = await fetch(buildJotformDownloadUrl(attachmentUrl));
  if (!sourceResponse.ok) {
    throw new Error(`Source file download failed: ${sourceResponse.status}`);
  }

  // Jotform redirects unauthenticated requests to its login page with HTTP 200.
  // If we get HTML back, we received a login page, not the actual file — bail out
  // so the caller can fall back to attaching the URL instead.
  const contentType = sourceResponse.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    throw new Error(
      `File download returned HTML instead of the actual file (Jotform login redirect). Content-Type: ${contentType}`,
    );
  }

  const fileBlob = await sourceResponse.blob();
  const effectiveContentType = contentType || fileBlob.type;
  const fileName = getFileNameFromUrl(
    attachmentUrl,
    `attachment-${Date.now()}`,
  );
  const formData = new FormData();

  formData.append(
    "file",
    new Blob([await fileBlob.arrayBuffer()], {
      type: effectiveContentType || "application/octet-stream",
    }),
    fileName,
  );
  formData.append("name", fileName);

  const uploadResponse = await fetch(
    `${TRELLO_API_BASE}/cards/${cardId}/attachments?key=${creds.apiKey}&token=${creds.apiToken}`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!uploadResponse.ok) {
    throw new Error(
      `Trello binary attachment failed: ${uploadResponse.status}`,
    );
  }
}

async function attachUrlToCard(
  cardId: string,
  attachmentUrl: string,
  creds: { apiKey: string; apiToken: string },
) {
  const attachmentParams = new URLSearchParams({
    key: creds.apiKey,
    token: creds.apiToken,
    url: attachmentUrl,
  });

  const attachmentResponse = await fetch(
    `${TRELLO_API_BASE}/cards/${cardId}/attachments?${attachmentParams.toString()}`,
    { method: "POST" },
  );

  if (!attachmentResponse.ok) {
    throw new Error(
      `Trello URL attachment failed: ${attachmentResponse.status}`,
    );
  }
}

export const createCard = action({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ cardId: string; cardUrl: string } | null> => {
    const creds = await getDecryptedCredentials(ctx);
    if (!creds) return null;

    const rawConfig: {
      listId?: string;
      statusListMap?: Partial<Record<ClientStatus, string>>;
      syncEnabled: boolean;
    } | null = await ctx.runQuery(api.trello.getConfig);

    if (!rawConfig || !rawConfig.syncEnabled) {
      return null;
    }

    const order: {
      clientId: Id<"clients">;
      services?: string[];
      windowColor?: string[];
      doorColor?: string[];
      gateColor?: string[];
      terraceColor?: string[];
      constructionColor?: string[];
      sunProtectionType?: string[];
      projectFiles?: string;
      comment?: string;
      status: ClientStatus;
    } | null = await ctx.runQuery(api.orders.getById, {
      orderId: args.orderId,
    });

    if (!order) {
      throw new Error(`Order ${args.orderId} not found.`);
    }

    const client: {
      firstName: string;
      lastName: string;
      email?: string;
      phone?: string;
      street?: string;
      buildingNumber?: string;
      apartmentNumber?: string;
      postalCode?: string;
      city?: string;
      address?: string;
    } | null = await ctx.runQuery(api.clients.getById, {
      clientId: order.clientId,
    });

    if (!client) {
      throw new Error(`Client ${order.clientId} not found.`);
    }

    const listId = getListIdForStatus(rawConfig, order.status);
    if (!listId) {
      return null;
    }

    const servicesStr: string = order.services?.join(", ") ?? "";
    const cardName: string = [
      client.firstName,
      client.lastName,
      servicesStr,
      client.city ?? "",
    ]
      .filter(Boolean)
      .join("_");

    const clientAddress = formatAddress(client);
    const desc: string = [
      `### 👤 Dane Klienta`,
      `* **Imię:** ${client.firstName}`,
      `* **Nazwisko:** ${client.lastName}`,
      client.email ? `* **Adres e-mail:** ${client.email}` : null,
      client.phone ? `* **Nr. telefonu:** ${client.phone}` : null,
      clientAddress ? `* **Adres:** ${clientAddress}` : null,
      `---`,
      `### 🛠 Szczegóły Zlecenia`,
      order.services?.length
        ? `* **Usługa:** ${order.services.join(", ")}`
        : null,
      order.windowColor?.length
        ? `* **Kolor okien:** ${order.windowColor.join(", ")}`
        : null,
      order.doorColor?.length
        ? `* **Kolor drzwi:** ${order.doorColor.join(", ")}`
        : null,
      order.gateColor?.length
        ? `* **Kolor bramy:** ${order.gateColor.join(", ")}`
        : null,
      order.terraceColor?.length
        ? `* **Kolor zabudowy tarasu:** ${order.terraceColor.join(", ")}`
        : null,
      order.constructionColor?.length
        ? `* **Kolor konstrukcji:** ${order.constructionColor.join(", ")}`
        : null,
      order.sunProtectionType?.length
        ? `* **Typ systemu przeciwsłonecznego:** ${order.sunProtectionType.join(", ")}`
        : null,
      `---`,
      order.comment ? `### 💬 Komentarz\n${order.comment}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const params: URLSearchParams = new URLSearchParams({
      key: creds.apiKey,
      token: creds.apiToken,
      idList: listId,
      name: cardName,
      desc,
    });

    const response: Response = await fetch(
      `${TRELLO_API_BASE}/cards?${params.toString()}`,
      { method: "POST" },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Trello card creation failed ${response.status}: ${errorBody}`,
      );
    }

    const card: { id: string; shortUrl?: string; url: string } =
      await response.json();

    const attachmentUrls = getAttachmentUrls(order.projectFiles);
    for (const attachmentUrl of attachmentUrls) {
      try {
        await attachBinaryFileToCard(card.id, attachmentUrl, creds);
      } catch (error) {
        console.error(
          `Trello binary attachment failed for ${attachmentUrl}:`,
          error,
        );

        try {
          await attachUrlToCard(card.id, attachmentUrl, creds);
        } catch (fallbackError) {
          console.error(
            `Trello URL attachment fallback failed for ${attachmentUrl}:`,
            fallbackError,
          );
        }
      }
    }

    await ctx.runMutation(api.orders.updateTrelloCard, {
      orderId: args.orderId,
      trelloCardId: card.id,
      trelloCardUrl: card.shortUrl ?? card.url,
    });
    return { cardId: card.id, cardUrl: card.shortUrl ?? card.url };
  },
});

// Tworzenie karty Trello z oczekującego zgłoszenia JotForm (przed utworzeniem klienta/zamówienia)
export const createCardForPending = action({
  args: {
    pendingId: v.id("pendingJotformSubmissions"),
  },
  handler: async (ctx, args): Promise<{ cardId: string; cardUrl: string } | null> => {
    const creds = await getDecryptedCredentials(ctx);
    if (!creds) return null;

    const rawConfig: {
      listId?: string;
      statusListMap?: Partial<Record<ClientStatus, string>>;
      syncEnabled: boolean;
    } | null = await ctx.runQuery(api.trello.getConfig);

    if (!rawConfig || !rawConfig.syncEnabled) return null;

    const pending = await ctx.runQuery(api.jotformInternal.getPendingById, {
      pendingId: args.pendingId,
    });
    if (!pending || pending.processed) return null;

    // Karta trafia na listę "lead" lub domyślną listę
    const listId = getListIdForStatus(rawConfig, "lead");
    if (!listId) return null;

    const servicesStr = pending.services?.join(", ") ?? "";
    const cardName = [
      pending.firstName,
      pending.lastName,
      servicesStr,
      pending.city ?? "",
    ]
      .filter(Boolean)
      .join("_");

    const pendingAddress = formatAddress(pending);
    const desc = [
      `### 👤 Dane Klienta`,
      `* **Imię:** ${pending.firstName}`,
      `* **Nazwisko:** ${pending.lastName}`,
      pending.email ? `* **Adres e-mail:** ${pending.email}` : null,
      pending.phone ? `* **Nr. telefonu:** ${pending.phone}` : null,
      pendingAddress ? `* **Adres:** ${pendingAddress}` : null,
      `---`,
      `### 🛠 Szczegóły Zlecenia`,
      pending.services?.length ? `* **Usługa:** ${pending.services.join(", ")}` : null,
      pending.windowColor?.length ? `* **Kolor okien:** ${pending.windowColor.join(", ")}` : null,
      pending.doorColor?.length ? `* **Kolor drzwi:** ${pending.doorColor.join(", ")}` : null,
      pending.gateColor?.length ? `* **Kolor bramy:** ${pending.gateColor.join(", ")}` : null,
      pending.terraceColor?.length ? `* **Kolor zabudowy tarasu:** ${pending.terraceColor.join(", ")}` : null,
      pending.constructionColor?.length ? `* **Kolor konstrukcji:** ${pending.constructionColor.join(", ")}` : null,
      pending.sunProtectionType?.length ? `* **Typ systemu przeciwsłonecznego:** ${pending.sunProtectionType.join(", ")}` : null,
      `---`,
      pending.comment ? `### 💬 Komentarz\n${pending.comment}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const params = new URLSearchParams({
      key: creds.apiKey,
      token: creds.apiToken,
      idList: listId,
      name: cardName,
      desc,
    });

    const response = await fetch(`${TRELLO_API_BASE}/cards?${params.toString()}`, {
      method: "POST",
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Trello card creation failed ${response.status}: ${errorBody}`);
    }

    const card: { id: string; shortUrl?: string; url: string } = await response.json();

    // Dołącz załączniki z formularza
    const attachmentUrls = getAttachmentUrls(pending.projectFiles);
    for (const attachmentUrl of attachmentUrls) {
      try {
        await attachBinaryFileToCard(card.id, attachmentUrl, creds);
      } catch {
        try {
          await attachUrlToCard(card.id, attachmentUrl, creds);
        } catch (fallbackError) {
          console.error(`Trello attachment failed for ${attachmentUrl}:`, fallbackError);
        }
      }
    }

    // Zapisz ID karty Trello w oczekującym zgłoszeniu
    await ctx.runMutation(api.jotformInternal.updatePendingWithCardId, {
      pendingId: args.pendingId,
      trelloCardId: card.id,
    });

    return { cardId: card.id, cardUrl: card.shortUrl ?? card.url };
  },
});

export const registerWebhook = action({
  args: {
    boardId: v.string(),
    webhookUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const creds = await getDecryptedCredentials(ctx);
    if (!creds) {
      return { success: false, error: "Trello credentials are not configured" };
    }

    const params = new URLSearchParams({
      key: creds.apiKey,
      token: creds.apiToken,
      idModel: args.boardId,
      callbackURL: args.webhookUrl,
      description: "ADK CRM board sync",
    });

    let response: Response;
    try {
      response = await fetch(
        `${TRELLO_API_BASE}/webhooks?${params.toString()}`,
        { method: "POST" },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Błąd połączenia z Trello: ${msg}` };
    }

    if (!response.ok) {
      return { success: false, error: await response.text() };
    }

    const webhook: { id: string } = await response.json();
    await ctx.runMutation(api.trello.saveWebhookId, { webhookId: webhook.id });
    return { success: true };
  },
});

export const unregisterWebhook = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; error?: string }> => {
    const creds = await getDecryptedCredentials(ctx);
    const config = await ctx.runQuery(api.trello.getConfigInternal, {});
    if (!creds || !config?.webhookId) {
      return { success: true };
    }

    const response = await fetch(
      `${TRELLO_API_BASE}/webhooks/${config.webhookId}?key=${creds.apiKey}&token=${creds.apiToken}`,
      { method: "DELETE" },
    );

    if (!response.ok) {
      return { success: false, error: await response.text() };
    }

    await ctx.runMutation(api.trello.saveWebhookId, { webhookId: undefined });
    return { success: true };
  },
});

export const syncCardForStatus = action({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const creds = await getDecryptedCredentials(ctx);
    if (!creds) return { success: false };

    const config = await ctx.runQuery(api.trello.getConfig, {});
    const order = await ctx.runQuery(api.orders.getById, {
      orderId: args.orderId,
    });
    if (!config || !config.syncEnabled || !order?.trelloCardId) {
      return { success: false };
    }

    const listId = getListIdForStatus(config, order.status as ClientStatus);
    if (!listId) {
      return { success: false };
    }

    const response = await fetch(
      `${TRELLO_API_BASE}/cards/${order.trelloCardId}?key=${creds.apiKey}&token=${creds.apiToken}&idList=${listId}`,
      { method: "PUT" },
    );

    if (!response.ok) {
      throw new Error(`Trello card update failed ${response.status}`);
    }

    return { success: true };
  },
});

export const createCardFromEmail = action({
  args: {
    listId: v.string(),
    from: v.string(),
    subject: v.string(),
    body: v.string(),
    messageId: v.string(),
    attachments: v.array(
      v.object({
        attachmentId: v.string(),
        filename: v.string(),
        mimeType: v.string(),
      }),
    ),
  },
  handler: async (ctx, args): Promise<{ cardId: string; cardUrl: string }> => {
    const creds = await getDecryptedCredentials(ctx);
    if (!creds) throw new Error("Brak konfiguracji Trello");

    // Zapisz email jako pending — klient + zamówienie powstaną gdy karta trafi na "Pomiary"
    const pendingId: Id<"pendingEmailSubmissions"> = await ctx.runMutation(
      api.emailLeads.savePending,
      { from: args.from, subject: args.subject, body: args.body },
    );

    const params = new URLSearchParams({
      key: creds.apiKey,
      token: creds.apiToken,
      idList: args.listId,
      name: args.from,
      desc: args.body,
    });

    const response = await fetch(`${TRELLO_API_BASE}/cards?${params.toString()}`, {
      method: "POST",
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Trello card creation failed ${response.status}: ${errorBody}`);
    }

    const card: { id: string; shortUrl?: string; url: string } = await response.json();

    // Powiąż pending z kartą Trello
    await ctx.runMutation(api.emailLeads.updatePendingWithCardId, {
      pendingId,
      trelloCardId: card.id,
    });

    for (const att of args.attachments) {
      try {
        const { data } = await ctx.runAction(api.gmail.getAttachment, {
          messageId: args.messageId,
          attachmentId: att.attachmentId,
        });

        // URL-safe base64 → standard base64
        const standard = data.replace(/-/g, "+").replace(/_/g, "/");
        const binary = atob(standard);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        const formData = new FormData();
        formData.append(
          "file",
          new Blob([bytes], { type: att.mimeType || "application/octet-stream" }),
          att.filename,
        );
        formData.append("name", att.filename);

        const uploadRes = await fetch(
          `${TRELLO_API_BASE}/cards/${card.id}/attachments?key=${creds.apiKey}&token=${creds.apiToken}`,
          { method: "POST", body: formData },
        );

        if (!uploadRes.ok) {
          console.error(`Trello attachment upload failed for ${att.filename}: ${uploadRes.status}`);
        }
      } catch (err) {
        console.error(`Failed to attach ${att.filename}:`, err);
      }
    }

    return { cardId: card.id, cardUrl: card.shortUrl ?? card.url };
  },
});
