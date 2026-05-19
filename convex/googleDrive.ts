import { v } from "convex/values";
import type { ActionCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { query, mutation, action, internalMutation, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { encrypt, decrypt } from "./lib/crypto";
import { getAuthUserId } from "@convex-dev/auth/server";

async function requireUserIdentifierInAction(ctx: ActionCtx): Promise<string> {
  const currentUserId = await getAuthUserId(ctx);
  if (!currentUserId) throw new Error("Brak autoryzacji");
  const user = (await ctx.runQuery(internal.users._internalGetUser, {
    userId: currentUserId,
  })) as Doc<"users"> | null;
  if (!user || user.isActive !== true) throw new Error("Brak autoryzacji");
  return user.email ?? user._id;
}

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const DOCS_API_BASE = "https://docs.googleapis.com/v1";

const CLIENTS_FOLDER_ID = "0AF5F7v0YZWQHUk9PVA";
const TEMPLATES_FOLDER_ID = "0ANuZnSEtUiLTUk9PVA";

type DriveItem = {
  id: string;
  name: string;
  mimeType?: string;
};

type DriveResponse = {
  drives?: DriveItem[];
  files?: DriveItem[];
  id?: string;
  name?: string;
};

type GoogleDocsTextNode = {
  textRun?: { content?: string };
};

type GoogleDocsStructuralElement = {
  paragraph?: { elements?: GoogleDocsTextNode[] };
  table?: {
    tableRows?: Array<{
      tableCells?: Array<{
        content?: GoogleDocsStructuralElement[];
      }>;
    }>;
  };
  tableOfContents?: {
    content?: GoogleDocsStructuralElement[];
  };
};

type GoogleDocsDocument = {
  body?: {
    content?: GoogleDocsStructuralElement[];
  };
};

type DecryptedConnection = {
  _id: string;
  _creationTime: number;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  sharedDriveId?: string;
  templatesFolderId?: string;
  connectionStatus:
    | "connected"
    | "token_expiring"
    | "refreshing"
    | "expired"
    | "refresh_failed"
    | "disconnected"
    | "error";
  lastCheckedAt?: number;
  connectedBy: string;
  connectedEmail: string;
};


// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fetch the full connection record (with encrypted tokens) and decrypt them.
 * For use in actions only — never expose decrypted tokens to the frontend.
 */
/** Jotform upload URLs require API key; plain fetch returns the login HTML page. */
async function getJotformApiKeyForActions(
  ctx: ActionCtx,
): Promise<string | null> {
  const envKey = process.env.JOTFORM_API_KEY?.trim();
  if (envKey) {
    return envKey;
  }
  const config = await ctx.runQuery(api.jotformAdmin.getConfigInternal, {});
  if (!config?.apiKey) {
    return null;
  }
  return await decrypt(config.apiKey);
}

function appendJotformApiKeyQuery(fileUrl: string, apiKey: string): string {
  const u = new URL(fileUrl);
  u.searchParams.set("apiKey", apiKey);
  return u.toString();
}

function assertDownloadIsBinaryFile(
  fileBuffer: ArrayBuffer,
  contentType: string,
): void {
  const ct = contentType.toLowerCase();
  if (ct.includes("text/html") || ct.includes("application/xhtml")) {
    throw new Error(
      "Download returned HTML instead of a file (likely Jotform login page). Ensure Jotform API key is configured, or adjust Jotform security settings for uploaded files.",
    );
  }
  const head = fileBuffer.byteLength > 900 ? fileBuffer.slice(0, 900) : fileBuffer;
  const peek = new TextDecoder("utf-8", { fatal: false }).decode(head).trimStart().toLowerCase();
  if (peek.startsWith("<!doctype html") || peek.startsWith("<html")) {
    throw new Error(
      "Download returned HTML instead of a file (likely Jotform login page). Ensure Jotform API key is configured, or adjust Jotform security settings for uploaded files.",
    );
  }
}

async function getDecryptedConnection(
  ctx: ActionCtx,
): Promise<DecryptedConnection | null> {
  const connection = await ctx.runQuery(api.googleDrive.getConnectionInternal);
  if (!connection) return null;
  return {
    ...connection,
    accessToken: await decrypt(connection.accessToken),
    refreshToken: connection.refreshToken
      ? await decrypt(connection.refreshToken)
      : undefined,
  };
}

async function refreshConnectionAccessToken(
  ctx: ActionCtx,
  connection: DecryptedConnection,
): Promise<DecryptedConnection> {
  await ctx.runMutation(api.googleDrive.updateStatus, {
    connectionStatus: "refreshing",
  });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    await ctx.runMutation(api.googleDrive.updateStatus, {
      connectionStatus: "refresh_failed",
    });
    throw new Error(
      "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET env vars",
    );
  }

  if (!connection.refreshToken) {
    await ctx.runMutation(api.googleDrive.updateStatus, {
      connectionStatus: "refresh_failed",
    });
    throw new Error("Missing Google Drive refresh token");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: connection.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    await ctx.runMutation(api.googleDrive.updateStatus, {
      connectionStatus: "refresh_failed",
    });
    throw new Error(`Token refresh failed: ${errorBody}`);
  }

  const tokens = await response.json();
  const expiresAt = Date.now() + tokens.expires_in * 1000;
  const encryptedToken = await encrypt(tokens.access_token);

  await ctx.runMutation(api.googleDrive.updateTokens, {
    accessToken: encryptedToken,
    expiresAt,
  });

  return {
    ...connection,
    accessToken: tokens.access_token,
    expiresAt,
    connectionStatus: "connected",
  };
}

async function getAuthorizedConnection(
  ctx: ActionCtx,
  options?: { forceRefresh?: boolean },
): Promise<DecryptedConnection> {
  const connection = await getDecryptedConnection(ctx);
  if (!connection) {
    throw new Error("Google Drive not connected");
  }

  const shouldRefresh =
    options?.forceRefresh || connection.expiresAt <= Date.now() + 5 * 60 * 1000;

  if (!shouldRefresh) {
    return connection as DecryptedConnection;
  }

  return await refreshConnectionAccessToken(
    ctx,
    connection as DecryptedConnection,
  );
}

async function getDriveHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

async function driveApiFetch(
  path: string,
  accessToken: string,
  options?: RequestInit,
): Promise<DriveResponse> {
  const response = await fetch(`${DRIVE_API_BASE}${path}`, {
    ...options,
    headers: {
      ...(await getDriveHeaders(accessToken)),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Google Drive API error ${response.status}: ${errorBody}`);
  }

  return response.json();
}

async function driveApiFetchWithRetry(
  ctx: ActionCtx,
  path: string,
  options?: RequestInit,
): Promise<DriveResponse> {
  let connection = await getAuthorizedConnection(ctx);

  try {
    return await driveApiFetch(path, connection.accessToken, options);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Google Drive API error 401")
    ) {
      connection = await getAuthorizedConnection(ctx, { forceRefresh: true });
      return await driveApiFetch(path, connection.accessToken, options);
    }
    throw error;
  }
}

async function docsApiFetchWithRetry(
  ctx: ActionCtx,
  path: string,
  options?: RequestInit,
): Promise<GoogleDocsDocument> {
  let connection = await getAuthorizedConnection(ctx);

  const execute = async (accessToken: string) => {
    const response = await fetch(`${DOCS_API_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Google Docs API error ${response.status}: ${errorBody}`);
    }

    return (await response.json()) as GoogleDocsDocument;
  };

  try {
    return await execute(connection.accessToken);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Google Docs API error 401")
    ) {
      connection = await getAuthorizedConnection(ctx, { forceRefresh: true });
      return await execute(connection.accessToken);
    }
    throw error;
  }
}

function extractTextFromDoc(
  elements: GoogleDocsStructuralElement[] = [],
): string {
  let result = "";

  for (const element of elements) {
    if (element.paragraph?.elements) {
      for (const paragraphElement of element.paragraph.elements) {
        result += paragraphElement.textRun?.content ?? "";
      }
    }

    if (element.table?.tableRows) {
      for (const row of element.table.tableRows) {
        for (const cell of row.tableCells ?? []) {
          result += extractTextFromDoc(cell.content);
        }
      }
    }

    if (element.tableOfContents?.content) {
      result += extractTextFromDoc(element.tableOfContents.content);
    }
  }

  return result;
}

async function renameDriveItem(
  ctx: ActionCtx,
  fileId: string,
  newName: string,
): Promise<void> {
  await driveApiFetchWithRetry(
    ctx,
    `/files/${fileId}?supportsAllDrives=true`,
    {
      method: "PATCH",
      body: JSON.stringify({ name: newName }),
    },
  );
}

async function createDriveFolder(
  ctx: ActionCtx,
  name: string,
  parentId: string,
) {
  const data = await driveApiFetchWithRetry(
    ctx,
    "/files?supportsAllDrives=true",
    {
      method: "POST",
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      }),
    },
  );

  if (!data.id) {
    throw new Error(`Google Drive folder creation returned no id for ${name}`);
  }

  return {
    id: data.id,
    url: `https://drive.google.com/drive/folders/${data.id}`,
  };
}

async function uploadFileToDrive(
  ctx: ActionCtx,
  fileUrl: string,
  parentId: string,
  options?: { jotformApiKey?: string | null },
): Promise<{ fileId: string; name: string; url: string } | null> {
  const connection = await getAuthorizedConnection(ctx);

  const jotformApiKey = options?.jotformApiKey ?? null;
  const downloadUrl =
    jotformApiKey !== null && jotformApiKey !== ""
      ? appendJotformApiKeyQuery(fileUrl, jotformApiKey)
      : fileUrl;

  const sourceResponse = await fetch(downloadUrl, {
    headers:
      jotformApiKey !== null && jotformApiKey !== ""
        ? { APIKEY: jotformApiKey }
        : {},
  });
  if (!sourceResponse.ok) {
    throw new Error(`File download failed: ${sourceResponse.status}`);
  }

  const contentType =
    sourceResponse.headers.get("content-type") ||
    "application/octet-stream";

  let fileName: string;
  try {
    const pathname = new URL(fileUrl).pathname;
    fileName =
      pathname.split("/").filter(Boolean).at(-1) ||
      `attachment-${Date.now()}`;
  } catch {
    fileName = `attachment-${Date.now()}`;
  }

  const metadata = JSON.stringify({ name: fileName, parents: [parentId] });
  const boundary = `drive_upload_${Date.now()}`;
  const fileBuffer = await sourceResponse.arrayBuffer();
  assertDownloadIsBinaryFile(fileBuffer, contentType);

  const encoder = new TextEncoder();
  const preamble = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`,
  );
  const epilogue = encoder.encode(`\r\n--${boundary}--`);

  const body = new Uint8Array(
    preamble.byteLength + fileBuffer.byteLength + epilogue.byteLength,
  );
  body.set(preamble, 0);
  body.set(new Uint8Array(fileBuffer), preamble.byteLength);
  body.set(epilogue, preamble.byteLength + fileBuffer.byteLength);

  const response = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Google Drive file upload failed ${response.status}: ${errorBody}`,
    );
  }

  const uploadedFile = await response.json() as { id?: string; name?: string };
  if (!uploadedFile.id) return null;
  return {
    fileId: uploadedFile.id,
    name: uploadedFile.name ?? fileName,
    url: `https://drive.google.com/file/d/${uploadedFile.id}/view`,
  };
}

// ─── Mail Merge Helper ───────────────────────────────────────────────────────

/**
 * Resolve a field mapping value from client data.
 * Handles regular fields, array fields (joined with ", "), and special fields.
 */
function resolveFieldValue(
  client: Record<string, unknown>,
  field: string,
): string {
  // Special fields
  if (field === "__today") {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  }
  if (field === "__year") {
    return String(new Date().getFullYear());
  }
  if (field === "__empty") {
    return "";
  }

  const value = client[field];
  if (value === undefined || value === null) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return String(value);
}

/**
 * Perform find & replace on a Google Docs document using batchUpdate.
 * Throws on failure so the caller knows the merge did not complete.
 */
async function performMailMerge(
  ctx: ActionCtx,
  documentId: string,
  client: Record<string, unknown>,
  fieldMappings: Array<{ placeholder: string; field: string }>,
): Promise<void> {
  if (fieldMappings.length === 0) {
    return;
  }

  const requests = fieldMappings.map((mapping) => ({
    replaceAllText: {
      containsText: {
        text: mapping.placeholder,
        matchCase: true,
      },
      replaceText: resolveFieldValue(client, mapping.field),
    },
  }));

  const execute = async (accessToken: string) => {
    const response = await fetch(
      `${DOCS_API_BASE}/documents/${documentId}:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requests }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Google Docs API error ${response.status}: ${errorBody}`,
      );
    }

    const responseBody = await response.json() as {
      replies?: Array<{ replaceAllText?: { occurrencesChanged?: number } }>;
    };
    const replies = responseBody.replies ?? [];
    for (let i = 0; i < fieldMappings.length; i++) {
      const occurrences = replies[i]?.replaceAllText?.occurrencesChanged ?? 0;
      const mapping = fieldMappings[i];
      if (occurrences === 0) {
        console.warn(
          `[mailMerge] BRAK DOPASOWANIA: placeholder="${mapping.placeholder}" field="${mapping.field}" value="${resolveFieldValue(client, mapping.field)}"`,
        );
      } else {
        console.log(
          `[mailMerge] OK: placeholder="${mapping.placeholder}" field="${mapping.field}" zastąpiono ${occurrences}x`,
        );
      }
    }
  };

  let connection = await getAuthorizedConnection(ctx);
  try {
    await execute(connection.accessToken);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Google Docs API error 401")
    ) {
      connection = await getAuthorizedConnection(ctx, { forceRefresh: true });
      await execute(connection.accessToken);
    } else {
      throw error;
    }
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

// Public query — NEVER exposes tokens to frontend
export const getConnectionStatus = query({
  args: {},
  handler: async (ctx) => {
    const connection = await ctx.db.query("driveConnection").first();
    if (!connection) return null;
    return {
      _id: connection._id,
      connectionStatus: connection.connectionStatus,
      connectedBy: connection.connectedBy,
      connectedEmail: connection.connectedEmail,
      expiresAt: connection.expiresAt,
      sharedDriveId: CLIENTS_FOLDER_ID,
      templatesFolderId: TEMPLATES_FOLDER_ID,
      lastCheckedAt: connection.lastCheckedAt,
    };
  },
});

// Internal query — returns full record with encrypted tokens (for actions only)
export const getConnectionInternal = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("driveConnection").first();
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

export const saveConnection = mutation({
  args: {
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
    connectedBy: v.string(),
    connectedEmail: v.string(),
  },
  handler: async (ctx, args) => {
    // Remove any existing connection (singleton pattern)
    const existing = await ctx.db.query("driveConnection").first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    const id = await ctx.db.insert("driveConnection", {
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      expiresAt: args.expiresAt,
      connectedBy: args.connectedBy,
      connectedEmail: args.connectedEmail,
      connectionStatus: "connected",
    });
    return id;
  },
});

export const updateTokens = mutation({
  args: {
    accessToken: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db.query("driveConnection").first();
    if (!connection) {
      throw new Error("No drive connection found");
    }
    await ctx.db.patch(connection._id, {
      accessToken: args.accessToken,
      expiresAt: args.expiresAt,
      connectionStatus: "connected",
    });
  },
});

export const updateStatus = mutation({
  args: {
    connectionStatus: v.union(
      v.literal("connected"),
      v.literal("token_expiring"),
      v.literal("refreshing"),
      v.literal("expired"),
      v.literal("refresh_failed"),
      v.literal("disconnected"),
      v.literal("error"),
    ),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db.query("driveConnection").first();
    if (!connection) {
      throw new Error("No drive connection found");
    }
    await ctx.db.patch(connection._id, {
      connectionStatus: args.connectionStatus,
    });
  },
});

export const saveSharedDriveConfig = mutation({
  args: {
    sharedDriveId: v.optional(v.string()),
    templatesFolderId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db.query("driveConnection").first();
    if (!connection) {
      throw new Error("No drive connection found");
    }
    const patch: Record<string, string> = {};
    if (args.sharedDriveId !== undefined)
      patch.sharedDriveId = args.sharedDriveId;
    if (args.templatesFolderId !== undefined)
      patch.templatesFolderId = args.templatesFolderId;
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(connection._id, patch);
    }
  },
});

export const disconnect = mutation({
  args: {},
  handler: async (ctx) => {
    const connection = await ctx.db.query("driveConnection").first();
    if (connection) {
      await ctx.db.delete(connection._id);
    }
  },
});

// ─── Actions ──────────────────────────────────────────────────────────────────

export const listSharedDrives = action({
  args: {},
  handler: async (ctx): Promise<{ id: string; name: string }[]> => {
    const data = await driveApiFetchWithRetry(ctx, "/drives?pageSize=100");

    return (data.drives ?? []).map((d) => ({
      id: d.id,
      name: d.name,
    }));
  },
});

export const listFolders = action({
  args: {
    driveId: v.optional(v.string()),
    parentFolderId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ id: string; name: string }[]> => {
    const parent = args.parentFolderId ?? args.driveId ?? "root";
    const q = `'${parent}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const params = new URLSearchParams({
      q,
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      fields: "files(id,name,mimeType)",
      pageSize: "100",
    });

    // If browsing a shared drive, scope to that drive
    if (args.driveId) {
      params.set("corpora", "drive");
      params.set("driveId", args.driveId);
    } else {
      params.set("corpora", "user");
    }

    const data = await driveApiFetchWithRetry(
      ctx,
      `/files?${params.toString()}`,
    );

    return (data.files ?? []).map((f) => ({
      id: f.id,
      name: f.name,
    }));
  },
});

export const createOrderFolder = action({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ folderId: string; folderUrl: string | undefined }> => {
    const log = async (
      level: "info" | "warn" | "error",
      message: string,
      data?: Record<string, unknown>,
    ) => {
      console[level](`[createOrderFolder] ${message}`, data ?? "");
      try {
        await ctx.runMutation(internal.systemLogs.insert, {
          level,
          source: "createOrderFolder",
          message,
          data: { orderId: args.orderId, ...data },
        });
      } catch (e) {
        console.error("[createOrderFolder] systemLogs.insert failed", e);
      }
    };

    try {
      await log("info", "START");

      const order = await ctx.runQuery(api.orders.getById, {
        orderId: args.orderId,
      });
      if (!order) {
        await log("error", "Order not found");
        throw new Error("Order not found");
      }

      if (order.folderId) {
        await log("info", "folder already exists — pomijam", { folderId: order.folderId });
        return { folderId: order.folderId, folderUrl: order.folderUrl };
      }

      const client = await ctx.runQuery(api.clients.getById, {
        clientId: order.clientId,
      });
      if (!client) {
        await log("error", "Client not found", { clientId: order.clientId });
        throw new Error("Client not found");
      }

      const connection = await getAuthorizedConnection(ctx);
      await log("info", "connection OK", { connectedEmail: connection.connectedEmail });

      // Krok 1: Znajdź lub utwórz folder klienta (Imię_Nazwisko) w shared drive
      let clientFolderId = client.clientFolderId;
      if (!clientFolderId) {
        const clientFolderName = `${client.firstName}_${client.lastName}`;
        await log("info", "creating client folder", { clientFolderName, parentId: CLIENTS_FOLDER_ID });
        const { id, url: clientFolderUrl } = await createDriveFolder(
          ctx,
          clientFolderName,
          CLIENTS_FOLDER_ID,
        );
        clientFolderId = id;
        await ctx.runMutation(api.clients.updateClientFolder, {
          clientId: order.clientId,
          clientFolderId: id,
          clientFolderUrl,
        });
        await log("info", "client folder created", { clientFolderId: id });
      } else {
        await log("info", "client folder exists — reusing", { clientFolderId });
      }

      // Krok 2: Utwórz podfolder zlecenia wewnątrz folderu klienta
      // Konwencja: DD.MM.YYYY_Usługa_Miejscowość
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, "0");
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const yyyy = now.getFullYear();
      const service = (order.services ?? []).join("-") || "Zlecenie";
      const city = client.city ?? "";
      const orderFolderName = `${dd}.${mm}.${yyyy}_${service}_${city}`;

      await log("info", "creating order folder", { orderFolderName, parentId: clientFolderId });
      const { id: folderId, url: folderUrl } = await createDriveFolder(
        ctx,
        orderFolderName,
        clientFolderId,
      );
      await log("info", "order folder created", { folderId, folderUrl });

      // Krok 3: Wgraj załączniki z formularza bezpośrednio do folderu zlecenia
      const attachmentUrls = (order.projectFiles ?? "")
        .split(/[\n,]+/)
        .map((u: string) => u.trim())
        .filter(Boolean);

      const fromJotform =
        order.source === "jotform" || !!order.jotformSubmissionId;
      const jotformApiKey = fromJotform
        ? await getJotformApiKeyForActions(ctx)
        : null;
      if (fromJotform && attachmentUrls.length > 0 && !jotformApiKey) {
        await log("warn", "Jotform order has attachments but no API key configured");
      }

      const driveProjectFiles: Array<{ fileId: string; name: string; url: string }> = [];
      for (const url of attachmentUrls) {
        try {
          const result = await uploadFileToDrive(ctx, url, folderId, { jotformApiKey });
          if (result) driveProjectFiles.push(result);
        } catch (error) {
          await log("error", "attachment upload failed", { url, error: String(error) });
        }
      }
      if (attachmentUrls.length > 0) {
        await log("info", "attachments uploaded", { uploaded: driveProjectFiles.length, total: attachmentUrls.length });
      }

      await ctx.runMutation(api.orders.updateDriveFolder, {
        orderId: args.orderId,
        folderId,
        folderUrl,
      });

      if (driveProjectFiles.length > 0) {
        await ctx.runMutation(api.orders.updateDriveProjectFiles, {
          orderId: args.orderId,
          driveProjectFiles,
        });
      }

      await ctx.runMutation(internal.orders.addEvent, {
        orderId: args.orderId,
        type: "folder_created",
        details: { folderId, folderUrl, folderName: orderFolderName, clientFolderId },
        performedBy: connection.connectedBy,
      });

      await log("info", "DONE — folder zapisany w rekordzie zlecenia", { folderId });
      return { folderId, folderUrl };
    } catch (err) {
      await log("error", "NIEOCZEKIWANY BŁĄD", { error: String(err) });
      throw err;
    }
  },
});

export const createClientFolder = action({
  args: {
    clientId: v.id("clients"),
  },
  handler: async (ctx, args): Promise<{ clientFolderId: string; clientFolderUrl: string } | null> => {
    // Zapisuje log do DB — błąd zapisu nie przerywa akcji
    const log = async (
      level: "info" | "warn" | "error",
      message: string,
      data?: Record<string, unknown>,
    ) => {
      console[level](`[createClientFolder] ${message}`, data ?? "");
      try {
        await ctx.runMutation(internal.systemLogs.insert, {
          level,
          source: "createClientFolder",
          message,
          data: { clientId: args.clientId, ...data },
        });
      } catch (e) {
        console.error("[createClientFolder] systemLogs.insert failed", e);
      }
    };

    try {
      await log("info", "START");

      const connection = await getDecryptedConnection(ctx);
      await log("info", "connection check", {
        hasConnection: !!connection,
        status: connection ? (connection as { connectionStatus?: string }).connectionStatus : null,
      });

      if (!connection) {
        await log("warn", "Drive not connected — brak połączenia z Google Drive");
        return null;
      }

      const client = await ctx.runQuery(api.clients.getById, { clientId: args.clientId }) as Doc<"clients"> | null;
      await log("info", "client fetched", {
        found: !!client,
        existingFolderId: client?.clientFolderId ?? null,
      });

      if (!client) {
        await log("error", "Client not found");
        throw new Error("Client not found");
      }

      if (client.clientFolderId) {
        await log("info", "folder already exists — pomijam", { folderId: client.clientFolderId });
        return { clientFolderId: client.clientFolderId, clientFolderUrl: client.clientFolderUrl ?? "" };
      }

      const clientFolderName = `${client.firstName}_${client.lastName}`;
      await log("info", "creating Drive folder", { clientFolderName, parentId: CLIENTS_FOLDER_ID });

      const { id, url: clientFolderUrl } = await createDriveFolder(ctx, clientFolderName, CLIENTS_FOLDER_ID);
      await log("info", "Drive folder created OK", { folderId: id, clientFolderUrl });

      await ctx.runMutation(api.clients.updateClientFolder, {
        clientId: args.clientId,
        clientFolderId: id,
        clientFolderUrl,
      });

      await log("info", "DONE — folder zapisany w rekordzie klienta", { folderId: id });
      return { clientFolderId: id, clientFolderUrl };
    } catch (err) {
      await log("error", "NIEOCZEKIWANY BŁĄD", { error: String(err) });
      throw err;
    }
  },
});

export const uploadUserDocument = action({
  args: {
    orderId: v.id("orders"),
    documentType: v.union(
      v.literal("pomiar"),
      v.literal("umowa"),
      v.literal("gwarancja_alco"),
      v.literal("rekojmia_adk"),
      v.literal("odbior_inwestor"),
      v.literal("protokol_montaz"),
      v.literal("faktura"),
      v.literal("reklamacja"),
    ),
    storageId: v.id("_storage"),
    fileName: v.string(),
    signatureStatus: v.union(v.literal("signed"), v.literal("not_applicable")),
  },
  handler: async (ctx, args): Promise<string> => {
    const performedBy = await requireUserIdentifierInAction(ctx);

    const order = await ctx.runQuery(api.orders.getById, { orderId: args.orderId });
    if (!order) throw new Error("Zlecenie nie znalezione");
    if (!order.folderId) throw new Error("To zlecenie nie ma folderu w Google Drive. Zmień status zlecenia (np. na 'Pomiar'), aby automatycznie utworzyć folder.");

    const fileUrl = await ctx.storage.getUrl(args.storageId);
    if (!fileUrl) throw new Error("Nie znaleziono pliku w storage");

    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) throw new Error(`Nie udało się pobrać pliku: ${fileResponse.status}`);

    const contentType = fileResponse.headers.get("content-type") || "application/octet-stream";
    const fileBuffer = await fileResponse.arrayBuffer();

    const connection = await getAuthorizedConnection(ctx);

    const metadata = JSON.stringify({ name: args.fileName, parents: [order.folderId] });
    const boundary = `drive_upload_${Date.now()}`;
    const encoder = new TextEncoder();
    const preamble = encoder.encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`,
    );
    const epilogue = encoder.encode(`\r\n--${boundary}--`);

    const body = new Uint8Array(preamble.byteLength + fileBuffer.byteLength + epilogue.byteLength);
    body.set(preamble, 0);
    body.set(new Uint8Array(fileBuffer), preamble.byteLength);
    body.set(epilogue, preamble.byteLength + fileBuffer.byteLength);

    const uploadResponse = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${connection.accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Błąd uploadu do Drive (${uploadResponse.status}): ${errorText}`);
    }

    const uploaded = await uploadResponse.json() as { id?: string };
    if (!uploaded.id) throw new Error("Google Drive nie zwróciło ID pliku");

    const driveFileUrl = `https://drive.google.com/file/d/${uploaded.id}/view`;

    await ctx.runMutation(internal.orders.attachUploadedDocument, {
      orderId: args.orderId,
      documentType: args.documentType,
      driveFileUrl,
      performedBy,
      signatureStatus: args.signatureStatus,
    });

    await ctx.storage.delete(args.storageId);

    return driveFileUrl;
  },
});

export const deleteFile = action({
  args: {
    fileId: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    let connection = await getAuthorizedConnection(ctx);

    const doDelete = async (accessToken: string) => {
      const response = await fetch(
        `${DRIVE_API_BASE}/files/${args.fileId}?supportsAllDrives=true`,
        {
          method: "DELETE",
          headers: await getDriveHeaders(accessToken),
        },
      );
      if (!response.ok && response.status !== 404) {
        const errorBody = await response.text();
        throw new Error(`Google Drive API error ${response.status}: ${errorBody}`);
      }
    };

    try {
      await doDelete(connection.accessToken);
    } catch (error) {
      if (error instanceof Error && error.message.includes("401")) {
        connection = await getAuthorizedConnection(ctx, { forceRefresh: true });
        await doDelete(connection.accessToken);
      } else {
        throw error;
      }
    }
  },
});

// ─── Attachments ─────────────────────────────────────────────────────────────

async function findOrCreateDriveFolder(
  accessToken: string,
  name: string,
  parentId: string,
): Promise<string> {
  const q = `name='${name.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
  const searchParams = new URLSearchParams({
    q,
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    fields: "files(id)",
    pageSize: "1",
  });
  const searchRes = await fetch(`${DRIVE_API_BASE}/files?${searchParams.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (searchRes.ok) {
    const data = await searchRes.json() as { files?: DriveItem[] };
    if (data.files && data.files.length > 0 && data.files[0].id) {
      return data.files[0].id;
    }
  }
  const createRes = await fetch(`${DRIVE_API_BASE}/files?supportsAllDrives=true`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });
  if (!createRes.ok) {
    const errorBody = await createRes.text();
    throw new Error(`Nie udało się utworzyć folderu Drive: ${errorBody}`);
  }
  const folder = await createRes.json() as { id?: string };
  if (!folder.id) throw new Error("Drive nie zwróciło ID folderu");
  return folder.id;
}

export const uploadOrderAttachment = action({
  args: {
    orderId: v.id("orders"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.optional(v.string()),
    size: v.optional(v.number()),
    folderPath: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ fileId: string; name: string; url: string }> => {
    const performedBy = await requireUserIdentifierInAction(ctx);

    const order = await ctx.runQuery(api.orders.getById, { orderId: args.orderId });
    if (!order) throw new Error("Zlecenie nie znalezione");
    if (!order.folderId) throw new Error("To zlecenie nie ma folderu w Google Drive.");

    const connection = await getAuthorizedConnection(ctx);
    const { accessToken } = connection;

    // Get or create "Załączniki" subfolder
    let attachmentsFolderId = order.attachmentsFolderId;
    if (!attachmentsFolderId) {
      attachmentsFolderId = await findOrCreateDriveFolder(accessToken, "Załączniki", order.folderId);
      await ctx.runMutation(internal.attachments.setAttachmentsFolderId, {
        orderId: args.orderId,
        folderId: attachmentsFolderId,
      });
    }

    // Resolve target folder for nested paths
    let targetFolderId = attachmentsFolderId;
    if (args.folderPath) {
      const parts = args.folderPath.split("/").filter(Boolean);
      for (const part of parts) {
        targetFolderId = await findOrCreateDriveFolder(accessToken, part, targetFolderId);
      }
    }

    // Download from Convex storage
    const fileUrl = await ctx.storage.getUrl(args.storageId);
    if (!fileUrl) throw new Error("Nie znaleziono pliku w storage");

    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) throw new Error(`Nie udało się pobrać pliku: ${fileResponse.status}`);

    const contentType = args.mimeType || fileResponse.headers.get("content-type") || "application/octet-stream";
    const fileBuffer = await fileResponse.arrayBuffer();

    // Upload to Drive (multipart)
    const metadata = JSON.stringify({ name: args.fileName, parents: [targetFolderId] });
    const boundary = `drive_upload_${Date.now()}`;
    const encoder = new TextEncoder();
    const preamble = encoder.encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`,
    );
    const epilogue = encoder.encode(`\r\n--${boundary}--`);
    const body = new Uint8Array(preamble.byteLength + fileBuffer.byteLength + epilogue.byteLength);
    body.set(preamble, 0);
    body.set(new Uint8Array(fileBuffer), preamble.byteLength);
    body.set(epilogue, preamble.byteLength + fileBuffer.byteLength);

    const uploadResponse = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Błąd uploadu do Drive (${uploadResponse.status}): ${errorText}`);
    }

    const uploaded = await uploadResponse.json() as { id?: string; name?: string };
    if (!uploaded.id) throw new Error("Google Drive nie zwróciło ID pliku");

    const driveUrl = `https://drive.google.com/file/d/${uploaded.id}/view`;

    await ctx.runMutation(internal.attachments.add, {
      orderId: args.orderId,
      fileId: uploaded.id,
      name: args.fileName,
      url: driveUrl,
      mimeType: contentType,
      size: args.size,
      folderPath: args.folderPath,
      uploadedBy: performedBy,
    });

    await ctx.storage.delete(args.storageId);

    return { fileId: uploaded.id, name: args.fileName, url: driveUrl };
  },
});

async function listDriveFolderRecursive(
  ctx: ActionCtx,
  folderId: string,
  currentPath: string,
  results: Array<{
    fileId: string;
    name: string;
    mimeType?: string;
    size?: number;
    folderPath: string;
    webViewLink?: string;
  }>,
): Promise<void> {
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed=false`,
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      fields: "nextPageToken,files(id,name,mimeType,size,webViewLink)",
      pageSize: "200",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const data = (await driveApiFetchWithRetry(
      ctx,
      `/files?${params.toString()}`,
    )) as unknown as {
      files?: Array<{
        id?: string;
        name?: string;
        mimeType?: string;
        size?: string;
        webViewLink?: string;
      }>;
      nextPageToken?: string;
    };

    for (const file of data.files ?? []) {
      if (!file.id || !file.name) continue;
      if (file.mimeType === "application/vnd.google-apps.folder") {
        const subPath = currentPath ? `${currentPath}/${file.name}` : file.name;
        await listDriveFolderRecursive(ctx, file.id, subPath, results);
      } else {
        results.push({
          fileId: file.id,
          name: file.name,
          mimeType: file.mimeType,
          size: file.size ? Number(file.size) : undefined,
          folderPath: currentPath,
          webViewLink: file.webViewLink,
        });
      }
    }

    pageToken = data.nextPageToken;
  } while (pageToken);
}

export const listOrderFolderFiles = action({
  args: { orderId: v.id("orders") },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<{
      fileId: string;
      name: string;
      mimeType?: string;
      size?: number;
      folderPath: string;
      webViewLink?: string;
    }>
  > => {
    const order = await ctx.runQuery(api.orders.getById, {
      orderId: args.orderId,
    });
    if (!order) throw new Error("Zlecenie nie znalezione");
    if (!order.folderId) return [];

    await getAuthorizedConnection(ctx);

    const files: Array<{
      fileId: string;
      name: string;
      mimeType?: string;
      size?: number;
      folderPath: string;
      webViewLink?: string;
    }> = [];
    await listDriveFolderRecursive(ctx, order.folderId, "", files);

    files.sort((a, b) => {
      const pathCmp = a.folderPath.localeCompare(b.folderPath, "pl");
      if (pathCmp !== 0) return pathCmp;
      return a.name.localeCompare(b.name, "pl");
    });

    return files;
  },
});

export const syncOrderAttachments = action({
  args: { orderId: v.id("orders") },
  handler: async (
    ctx,
    args,
  ): Promise<{ added: number; removed: number; updated: number }> => {
    const performedBy = await requireUserIdentifierInAction(ctx);

    const order = await ctx.runQuery(api.orders.getById, {
      orderId: args.orderId,
    });
    if (!order) throw new Error("Zlecenie nie znalezione");
    if (!order.folderId)
      throw new Error("To zlecenie nie ma folderu w Google Drive.");

    const connection = await getAuthorizedConnection(ctx);
    const { accessToken } = connection;

    let attachmentsFolderId = order.attachmentsFolderId;
    if (!attachmentsFolderId) {
      attachmentsFolderId = await findOrCreateDriveFolder(
        accessToken,
        "Załączniki",
        order.folderId,
      );
      await ctx.runMutation(internal.attachments.setAttachmentsFolderId, {
        orderId: args.orderId,
        folderId: attachmentsFolderId,
      });
    }

    const driveFiles: Array<{
      fileId: string;
      name: string;
      mimeType?: string;
      size?: number;
      folderPath: string;
    }> = [];
    await listDriveFolderRecursive(ctx, attachmentsFolderId, "", driveFiles);

    const existingAttachments = await ctx.runQuery(api.attachments.listByOrder, {
      orderId: args.orderId,
    });
    const existingByFileId = new Map(
      existingAttachments.map((a) => [a.fileId, a] as const),
    );
    const driveFileIds = new Set(driveFiles.map((f) => f.fileId));

    let added = 0;
    let updated = 0;
    for (const file of driveFiles) {
      const existing = existingByFileId.get(file.fileId);
      if (!existing) {
        await ctx.runMutation(internal.attachments.add, {
          orderId: args.orderId,
          fileId: file.fileId,
          name: file.name,
          url: `https://drive.google.com/file/d/${file.fileId}/view`,
          mimeType: file.mimeType,
          size: file.size,
          folderPath: file.folderPath || undefined,
          uploadedBy: performedBy,
        });
        added++;
      } else if (
        existing.name !== file.name ||
        (existing.folderPath ?? "") !== file.folderPath ||
        existing.size !== file.size ||
        existing.mimeType !== file.mimeType
      ) {
        await ctx.runMutation(internal.attachments.updateFromDrive, {
          attachmentId: existing._id,
          name: file.name,
          mimeType: file.mimeType,
          size: file.size,
          folderPath: file.folderPath || undefined,
        });
        updated++;
      }
    }

    let removed = 0;
    for (const attachment of existingAttachments) {
      if (driveFileIds.has(attachment.fileId)) continue;
      await ctx.runMutation(internal.attachments.removeById, {
        attachmentId: attachment._id,
      });
      removed++;
    }

    return { added, removed, updated };
  },
});

export const deleteOrderAttachment = action({
  args: {
    attachmentId: v.id("orderAttachments"),
  },
  handler: async (ctx, args): Promise<void> => {
    const attachment = await ctx.runQuery(internal.attachments.getById, {
      attachmentId: args.attachmentId,
    });
    if (!attachment) throw new Error("Załącznik nie znaleziony");

    const connection = await getAuthorizedConnection(ctx);

    const deleteRes = await fetch(
      `${DRIVE_API_BASE}/files/${attachment.fileId}?supportsAllDrives=true`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${connection.accessToken}` },
      },
    );

    if (!deleteRes.ok && deleteRes.status !== 404) {
      const errorBody = await deleteRes.text();
      throw new Error(`Google Drive API error ${deleteRes.status}: ${errorBody}`);
    }

    await ctx.runMutation(internal.attachments.removeById, {
      attachmentId: args.attachmentId,
    });
  },
});

export const copyTemplate = action({
  args: {
    orderId: v.id("orders"),
    templateKey: v.string(),
    templateId: v.optional(v.id("documentTemplates")),
  },
  handler: async (ctx, args): Promise<{ url: string; fileId?: string }> => {
    try {
      const order = await ctx.runQuery(api.orders.getById, {
        orderId: args.orderId,
      });
      if (!order) {
        throw new Error("Order not found");
      }
      if (!order.folderId) {
        throw new Error("Order folder not created yet");
      }

      // Check idempotency: skip if document URL already exists for this template
      const docEntry =
        order.documents[args.templateKey as keyof typeof order.documents];
      if (docEntry?.url) {
        return { url: docEntry.url };
      }

      // Read client data for name/city and mail merge
      const client = await ctx.runQuery(api.clients.getById, {
        clientId: order.clientId,
      });
      if (!client) {
        throw new Error("Client not found");
      }

      const lineItemsResult = await ctx.runQuery(api.orderLineItems.listByOrder, {
        orderId: args.orderId,
      });
      const { totalGross, totalNet } = lineItemsResult.totals;
      const formatPLN = (amount: number): string => {
        const rounded = Math.round(amount * 100) / 100;
        const str = rounded.toFixed(2);
        const dotIdx = str.indexOf(".");
        const intPart = str.slice(0, dotIdx);
        const decPart = str.slice(dotIdx + 1);
        return `${intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${decPart} zł`;
      };
      const invoiceType = order.invoicePlan?.type;
      // Backward compat: type may be absent on older records
      const storedAdvancePct = order.invoicePlan?.advancePct ?? 0;
      const effectiveType = invoiceType ?? (storedAdvancePct > 0 ? "advance_final" : undefined);
      const advancePct = effectiveType === "advance_final" ? storedAdvancePct : 0;
      const finalPct = 100 - advancePct;
      const round2 = (n: number) => Math.round(n * 100) / 100;
      const lineItemsList = lineItemsResult.items.map((item) => item.name).join("\n");
      const computedFields = {
        estimateTotal: formatPLN(totalGross),
        estimateNetTotal: formatPLN(totalNet),
        lineItemsList,
        // Faktura VAT
        invoiceVatPct: effectiveType === "vat" ? "100%" : "",
        invoiceVatAmount: effectiveType === "vat" ? formatPLN(totalGross) : "",
        invoiceVatNetAmount: effectiveType === "vat" ? formatPLN(totalNet) : "",
        // Faktura zaliczkowa
        invoiceAdvancePct: effectiveType === "advance_final" ? `${advancePct}%` : "",
        invoiceAdvanceAmount: effectiveType === "advance_final" ? formatPLN(round2(totalGross * advancePct / 100)) : "",
        invoiceAdvanceNetAmount: effectiveType === "advance_final" ? formatPLN(round2(totalNet * advancePct / 100)) : "",
        // Faktura końcowa
        invoiceFinalPct: effectiveType === "advance_final" ? `${finalPct}%` : "",
        invoiceFinalAmount: effectiveType === "advance_final" ? formatPLN(round2(totalGross * finalPct / 100)) : "",
        invoiceFinalNetAmount: effectiveType === "advance_final" ? formatPLN(round2(totalNet * finalPct / 100)) : "",
      };

      const connection = await getAuthorizedConnection(ctx);

      // Get template — by specific ID if provided, otherwise first by key
      const template = args.templateId
        ? await ctx.runQuery(api.documentTemplates.getById, { id: args.templateId })
        : await ctx.runQuery(api.documentTemplates.getByKey, { key: args.templateKey });
      if (!template) {
        throw new Error(`Template not found: ${args.templateKey}`);
      }
      if (!template.googleDriveFileId) {
        throw new Error(`Template has no Google Drive file: ${args.templateKey}`);
      }

      // Build file name from pattern
      let fileName = template.fileNamePattern;
      fileName = fileName.replace("{{firstName}}", client.firstName);
      fileName = fileName.replace("{{lastName}}", client.lastName);
      fileName = fileName.replace("{{city}}", client.city ?? "");
      fileName = fileName.replace(
        "{{date}}",
        new Date().toISOString().slice(0, 10),
      );

      // Copy file via Drive API
      const copyData = await driveApiFetchWithRetry(
        ctx,
        `/files/${template.googleDriveFileId}/copy?supportsAllDrives=true`,
        {
          method: "POST",
          body: JSON.stringify({
            name: fileName,
            parents: [order.folderId],
          }),
        },
      );

      if (!copyData.id) {
        throw new Error("Google Drive copy returned no file id");
      }

      const fileUrl = `https://docs.google.com/document/d/${copyData.id}/edit`;

      // Perform mail merge — replace placeholders in the copied document
      if (template.fieldMappings && template.fieldMappings.length > 0) {
        await performMailMerge(
          ctx,
          copyData.id,
          { ...client, ...order, ...computedFields },
          template.fieldMappings,
        );
      }

      // Save URL to order's documents
      await ctx.runMutation(api.orders.updateDocumentUrl, {
        orderId: args.orderId,
        documentType: args.templateKey,
        url: fileUrl,
      });

      return { url: fileUrl, fileId: copyData.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(internal.orders.setDocumentError, {
        orderId: args.orderId,
        documentType: args.templateKey,
        error: errorMessage,
        errorAt: Date.now(),
      });
      throw error;
    }
  },
});

export const copyWarrantyTemplate = action({
  args: {
    orderId: v.id("orders"),
    key: v.string(),
    templateId: v.id("documentTemplates"),
  },
  handler: async (ctx, args): Promise<{ url: string }> => {
    try {
      const order = await ctx.runQuery(api.orders.getById, { orderId: args.orderId });
      if (!order) throw new Error("Order not found");
      if (!order.folderId) throw new Error("Order folder not created yet");

      const existing = order.warrantyDocs?.[args.key];
      if (existing?.url) return { url: existing.url };

      const client = await ctx.runQuery(api.clients.getById, { clientId: order.clientId });
      if (!client) throw new Error("Client not found");

      const template = await ctx.runQuery(api.documentTemplates.getById, { id: args.templateId });
      if (!template) throw new Error(`Template not found: ${args.templateId}`);
      if (!template.googleDriveFileId) throw new Error(`Template has no Google Drive file: ${args.key}`);

      const lineItemsResult = await ctx.runQuery(api.orderLineItems.listByOrder, { orderId: args.orderId });
      const { totalGross, totalNet } = lineItemsResult.totals;
      const formatPLN = (amount: number): string => {
        const rounded = Math.round(amount * 100) / 100;
        const str = rounded.toFixed(2);
        const dotIdx = str.indexOf(".");
        const intPart = str.slice(0, dotIdx);
        const decPart = str.slice(dotIdx + 1);
        return `${intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${decPart} zł`;
      };
      const invoiceType = order.invoicePlan?.type;
      const storedAdvancePct = order.invoicePlan?.advancePct ?? 0;
      const effectiveType = invoiceType ?? (storedAdvancePct > 0 ? "advance_final" : undefined);
      const advancePct = effectiveType === "advance_final" ? storedAdvancePct : 0;
      const finalPct = 100 - advancePct;
      const round2 = (n: number) => Math.round(n * 100) / 100;
      const lineItemsList = lineItemsResult.items.map((item) => item.name).join("\n");
      const computedFields = {
        estimateTotal: formatPLN(totalGross),
        estimateNetTotal: formatPLN(totalNet),
        lineItemsList,
        invoiceVatPct: effectiveType === "vat" ? "100%" : "",
        invoiceVatAmount: effectiveType === "vat" ? formatPLN(totalGross) : "",
        invoiceVatNetAmount: effectiveType === "vat" ? formatPLN(totalNet) : "",
        invoiceAdvancePct: effectiveType === "advance_final" ? `${advancePct}%` : "",
        invoiceAdvanceAmount: effectiveType === "advance_final" ? formatPLN(round2(totalGross * advancePct / 100)) : "",
        invoiceAdvanceNetAmount: effectiveType === "advance_final" ? formatPLN(round2(totalNet * advancePct / 100)) : "",
        invoiceFinalPct: effectiveType === "advance_final" ? `${finalPct}%` : "",
        invoiceFinalAmount: effectiveType === "advance_final" ? formatPLN(round2(totalGross * finalPct / 100)) : "",
        invoiceFinalNetAmount: effectiveType === "advance_final" ? formatPLN(round2(totalNet * finalPct / 100)) : "",
      };

      let fileName = template.fileNamePattern;
      fileName = fileName.replace("{{firstName}}", client.firstName);
      fileName = fileName.replace("{{lastName}}", client.lastName);
      fileName = fileName.replace("{{city}}", client.city ?? "");
      fileName = fileName.replace("{{date}}", new Date().toISOString().slice(0, 10));

      const copyData = await driveApiFetchWithRetry(
        ctx,
        `/files/${template.googleDriveFileId}/copy?supportsAllDrives=true`,
        {
          method: "POST",
          body: JSON.stringify({ name: fileName, parents: [order.folderId] }),
        },
      );
      if (!copyData.id) throw new Error("Google Drive copy returned no file id");

      const fileUrl = `https://docs.google.com/document/d/${copyData.id}/edit`;

      if (template.fieldMappings && template.fieldMappings.length > 0) {
        await performMailMerge(ctx, copyData.id, { ...client, ...order, ...computedFields }, template.fieldMappings);
      }

      await ctx.runMutation(api.orders.updateWarrantyDocUrl, {
        orderId: args.orderId,
        key: args.key,
        url: fileUrl,
      });

      return { url: fileUrl };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(internal.orders.setWarrantyDocError, {
        orderId: args.orderId,
        key: args.key,
        error: errorMessage,
        errorAt: Date.now(),
      });
      throw error;
    }
  },
});

export const initializeMeasurement = internalAction({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    // Krok 1: Utwórz folder zlecenia (idempotentne — pomija jeśli już istnieje)
    await ctx.runAction(api.googleDrive.createOrderFolder, {
      orderId: args.orderId,
    });

    // Krok 2: Sprawdź czy szablon pomiar jest skonfigurowany
    const template = await ctx.runQuery(api.documentTemplates.getByKey, {
      key: "pomiar",
    });
    if (!template?.googleDriveFileId) {
      console.warn(
        "Szablon 'pomiar' nie jest skonfigurowany — pomijanie generowania pliku pomiaru",
      );
      return;
    }

    // Krok 3: Skopiuj szablon do folderu zlecenia (idempotentne — pomija jeśli URL już istnieje)
    await ctx.runAction(api.googleDrive.copyTemplate, {
      orderId: args.orderId,
      templateKey: "pomiar",
    });
  },
});

export const listTemplateFiles = action({
  args: {},
  handler: async (ctx): Promise<Array<{ id: string; name: string }>> => {
    await getAuthorizedConnection(ctx);

    const params = new URLSearchParams({
      q: `'${TEMPLATES_FOLDER_ID}' in parents and trashed=false`,
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      fields: "files(id,name,mimeType)",
      orderBy: "name",
      pageSize: "100",
    });

    const data = await driveApiFetchWithRetry(
      ctx,
      `/files?${params.toString()}`,
    );

    return (data.files ?? [])
      .filter((file) => file.mimeType !== "application/vnd.google-apps.folder")
      .map((file) => ({ id: file.id, name: file.name }));
  },
});

export const detectTemplatePlaceholders = action({
  args: {
    documentFileId: v.string(),
  },
  handler: async (ctx, args): Promise<string[]> => {
    let text = "";

    // Try Google Docs API first (native Google Docs)
    try {
      const document = await docsApiFetchWithRetry(
        ctx,
        `/documents/${args.documentFileId}`,
      );
      text = extractTextFromDoc(document.body?.content);
    } catch {
      // Fallback: export via Drive API (works for .doc, .docx, native Docs)
      const connection = await getAuthorizedConnection(ctx);
      const exportUrl = `${DRIVE_API_BASE}/files/${args.documentFileId}/export?mimeType=text/plain&supportsAllDrives=true`;
      const response = await fetch(exportUrl, {
        headers: { Authorization: `Bearer ${connection.accessToken}` },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `Google Drive export failed ${response.status}: ${errorBody}`,
        );
      }

      text = await response.text();
    }

    const matches = text.match(/\{\{[^{}]+\}\}/g) ?? [];

    return Array.from(new Set(matches.map((match) => match.trim()))).sort(
      (a, b) => a.localeCompare(b),
    );
  },
});

export const refreshAccessToken = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; expiresAt: number }> => {
    const connection = await getAuthorizedConnection(ctx, {
      forceRefresh: true,
    });
    return { success: true, expiresAt: connection.expiresAt };
  },
});

export const applyMailMerge = action({
  args: {
    clientId: v.id("clients"),
    templateKey: v.string(),
    documentFileId: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const client = await ctx.runQuery(api.clients.getById, {
      clientId: args.clientId,
    });
    if (!client) {
      throw new Error("Client not found");
    }

    const template = await ctx.runQuery(api.documentTemplates.getByKey, {
      key: args.templateKey,
    });
    if (!template) {
      throw new Error(`Template not found: ${args.templateKey}`);
    }

    if (!template.fieldMappings || template.fieldMappings.length === 0) {
      return { success: true };
    }

    try {
      await performMailMerge(
        ctx,
        args.documentFileId,
        client,
        template.fieldMappings,
      );
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    return { success: true };
  },
});

// Przemianowuje folder klienta i pliki dokumentów w zleceniach po zmianie imienia/nazwiska
export const renameClientAssets = internalAction({
  args: {
    clientId: v.id("clients"),
    oldFirstName: v.string(),
    oldLastName: v.string(),
    newFirstName: v.string(),
    newLastName: v.string(),
    clientFolderId: v.string(),
  },
  handler: async (ctx, args) => {
    const { oldFirstName, oldLastName, newFirstName, newLastName, clientFolderId, clientId } = args;

    // 1. Przemianuj folder klienta (Imię_Nazwisko)
    const newFolderName = `${newFirstName}_${newLastName}`;
    try {
      await renameDriveItem(ctx, clientFolderId, newFolderName);
    } catch (error) {
      console.error(`[renameClientAssets] Failed to rename client folder ${clientFolderId}:`, error);
    }

    // 2. Przemianuj pliki dokumentów we wszystkich zleceniach klienta
    const orders = await ctx.runQuery(api.orders.listByClient, { clientId });

    for (const order of orders) {
      if (!order.documents) continue;

      const docEntries = Object.entries(order.documents) as Array<[string, { enabled: boolean; url?: string }]>;
      for (const [, docEntry] of docEntries) {
        if (!docEntry?.url) continue;

        // Wyciągnij ID pliku z URL Google Docs/Drive
        const match = docEntry.url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (!match) continue;
        const fileId = match[1];

        try {
          // Pobierz aktualną nazwę pliku z Drive
          const fileData = await driveApiFetchWithRetry(
            ctx,
            `/files/${fileId}?supportsAllDrives=true&fields=id,name`,
          );
          if (!fileData.name) continue;

          // Zastąp stare imię i nazwisko nowymi
          const newName = fileData.name
            .replaceAll(oldFirstName, newFirstName)
            .replaceAll(oldLastName, newLastName);

          if (newName !== fileData.name) {
            await renameDriveItem(ctx, fileId, newName);
          }
        } catch (error) {
          console.error(`[renameClientAssets] Failed to rename document ${fileId}:`, error);
        }
      }
    }
  },
});

// Internal mutation wrapper for cron — schedules the healthCheck action
export const scheduledHealthCheck = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, api.googleDrive.healthCheck);
  },
});

export const healthCheck = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ status: string; lastCheckedAt?: number; error?: string }> => {
    let connection = await getDecryptedConnection(ctx);
    if (!connection) {
      return { status: "disconnected" as const };
    }

    try {
      connection = await getAuthorizedConnection(ctx);

      // Test the connection by listing a single file
      const params = new URLSearchParams({
        pageSize: "1",
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
      });

      const response = await fetch(
        `${DRIVE_API_BASE}/files?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${connection.accessToken}` },
        },
      );

      const now = Date.now();

      if (response.ok) {
        // Update lastCheckedAt and ensure status is connected
        await ctx.runMutation(api.googleDrive.updateStatus, {
          connectionStatus: "connected",
        });
        return { status: "connected" as const, lastCheckedAt: now };
      }

      // Token might be expired
      if (response.status === 401) {
        await ctx.runMutation(api.googleDrive.updateStatus, {
          connectionStatus: "expired",
        });
        return { status: "expired" as const, lastCheckedAt: now };
      }

      await ctx.runMutation(api.googleDrive.updateStatus, {
        connectionStatus: "error",
      });
      return { status: "error" as const, lastCheckedAt: now };
    } catch (error) {
      await ctx.runMutation(api.googleDrive.updateStatus, {
        connectionStatus: "error",
      });
      return {
        status: "error" as const,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
