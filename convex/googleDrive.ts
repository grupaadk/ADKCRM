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

function extractGoogleDriveFileId(url: string): string | null {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

async function copyFileToDriveFolder(
  ctx: ActionCtx,
  fileId: string,
  destinationFolderId: string,
): Promise<{ id: string; name: string; url: string }> {
  const data = await driveApiFetchWithRetry(
    ctx,
    `/files/${fileId}/copy?supportsAllDrives=true`,
    {
      method: "POST",
      body: JSON.stringify({ parents: [destinationFolderId] }),
    },
  ) as unknown as { id?: string; name?: string };

  if (!data.id || !data.name) {
    throw new Error(`Drive copy returned no id/name for file ${fileId}`);
  }

  return {
    id: data.id,
    name: data.name,
    url: `https://drive.google.com/file/d/${data.id}/view`,
  };
}

async function listDriveFolderFiles(
  ctx: ActionCtx,
  folderId: string,
): Promise<Array<{ id: string; name: string; mimeType?: string }>> {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`,
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    fields: "files(id,name,mimeType)",
    pageSize: "200",
  });

  const data = await driveApiFetchWithRetry(
    ctx,
    `/files?${params.toString()}`,
  ) as unknown as { files?: Array<{ id?: string; name?: string; mimeType?: string }> };

  return (data.files ?? [])
    .filter((f): f is { id: string; name: string; mimeType?: string } => !!f.id && !!f.name)
    .map(f => ({ id: f.id, name: f.name, mimeType: f.mimeType }));
}

async function moveFileToDriveFolder(
  ctx: ActionCtx,
  fileId: string,
  fromFolderId: string,
  toFolderId: string,
): Promise<void> {
  await driveApiFetchWithRetry(
    ctx,
    `/files/${fileId}?addParents=${toFolderId}&removeParents=${fromFolderId}&supportsAllDrives=true`,
    { method: "PATCH", body: JSON.stringify({}) },
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

export const createClientFolderForOpportunity = action({
  args: {
    opportunityId: v.id("pendingJotformSubmissions"),
    uploadedFileIds: v.optional(v.array(v.id("_storage"))),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ folderId: string; folderUrl: string } | null> => {
    const log = async (
      level: "info" | "warn" | "error",
      message: string,
      data?: Record<string, unknown>,
    ) => {
      console[level](`[createClientFolderForOpportunity] ${message}`, data ?? "");
      try {
        await ctx.runMutation(internal.systemLogs.insert, {
          level,
          source: "createClientFolderForOpportunity",
          message,
          data: { opportunityId: args.opportunityId, ...data },
        });
      } catch (e) {
        console.error("[createClientFolderForOpportunity] systemLogs.insert failed", e);
      }
    };

    try {
      await log("info", "START");

      const opp = await ctx.runQuery(api.salesOpportunities.getSalesOpportunity, {
        opportunityId: args.opportunityId,
      });
      if (!opp) {
        await log("error", "Opportunity not found");
        return null;
      }

      // Idempotency: jeśli folder szansy już istnieje — pomijamy
      if (opp.opportunityFolderId) {
        await log("info", "opportunity folder already exists — pomijam", { folderId: opp.opportunityFolderId });
        return { folderId: opp.opportunityFolderId, folderUrl: opp.opportunityFolderUrl ?? "" };
      }

      const connection = await getAuthorizedConnection(ctx);
      await log("info", "connection OK", { connectedEmail: connection.connectedEmail });

      // Krok 1: Znajdź lub utwórz folder klienta
      let clientFolderId = opp.clientFolderId;

      if (!clientFolderId && opp.clientId) {
        const client = await ctx.runQuery(api.clients.getById, { clientId: opp.clientId });
        clientFolderId = client?.clientFolderId ?? undefined;
        if (clientFolderId) {
          await log("info", "using existing client folder from client record", { clientFolderId });
        }
      }

      if (!clientFolderId) {
        let clientFolderName: string;
        if (opp.clientId) {
          const client = await ctx.runQuery(api.clients.getById, { clientId: opp.clientId });
          clientFolderName = client?.clientType === "business" && client.companyName
            ? client.companyName
            : `${opp.firstName}_${opp.lastName}`;
        } else {
          clientFolderName = `${opp.firstName}_${opp.lastName}`;
        }

        await log("info", "creating client folder", { clientFolderName });
        clientFolderId = await findOrCreateDriveFolder(
          connection.accessToken,
          clientFolderName,
          CLIENTS_FOLDER_ID,
        );
        const clientFolderUrl = `https://drive.google.com/drive/folders/${clientFolderId}`;

        await ctx.runMutation(internal.salesOpportunities.updateClientFolder, {
          opportunityId: args.opportunityId,
          clientFolderId,
          clientFolderUrl,
        });

        if (opp.clientId) {
          await ctx.runMutation(api.clients.updateClientFolder, {
            clientId: opp.clientId,
            clientFolderId,
            clientFolderUrl,
          });
        }
      }

      // Krok 2: Utwórz/znajdź podfolder "Szanse sprzedaży" w folderze klienta
      await log("info", "creating Szanse sprzedaży subfolder", { parentId: clientFolderId });
      const salesOpportunitiesFolderId = await findOrCreateDriveFolder(
        connection.accessToken,
        "Szanse sprzedaży",
        clientFolderId,
      );

      // Krok 3: Utwórz podfolder szansy — RRRR-MM-DD_TekstWłasny_Miasto_Ulica_Usługa
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const segments: string[] = [`${yyyy}-${mm}-${dd}`];
      if (opp.customText) segments.push(opp.customText);
      if (opp.city) segments.push(opp.city);
      if (opp.street) segments.push(opp.street);
      if (opp.services && opp.services.length > 0) segments.push(opp.services.join("-"));
      const opportunityFolderName = segments.join("_");

      await log("info", "creating opportunity folder", { opportunityFolderName, parentId: salesOpportunitiesFolderId });
      const opportunityFolderId = await findOrCreateDriveFolder(
        connection.accessToken,
        opportunityFolderName,
        salesOpportunitiesFolderId,
      );
      const opportunityFolderUrl = `https://drive.google.com/drive/folders/${opportunityFolderId}`;

      // Krok 4: Utwórz 3 podfoldery wewnątrz folderu szansy
      await log("info", "creating subfolders inside opportunity folder");
      const valuationFilesFolderId = await findOrCreateDriveFolder(
        connection.accessToken,
        "Pliki do wyceny od klienta - rzuty i przysłane",
        opportunityFolderId,
      );
      const offersReceivedFolderId = await findOrCreateDriveFolder(
        connection.accessToken,
        "Oferty otrzymane - koszta",
        opportunityFolderId,
      );
      const offersSentFolderId = await findOrCreateDriveFolder(
        connection.accessToken,
        "Oferty wysłane",
        opportunityFolderId,
      );
      const ponzioFilesFolderId = await findOrCreateDriveFolder(
        connection.accessToken,
        "Ponzio pliki",
        opportunityFolderId,
      );
      const otherFilesFolderId = await findOrCreateDriveFolder(
        connection.accessToken,
        "Inne",
        opportunityFolderId,
      );

      // Krok 5: Zapisz wszystkie foldery w rekordzie szansy
      await ctx.runMutation(internal.salesOpportunities.updateOpportunityFolders, {
        opportunityId: args.opportunityId,
        opportunityFolderId,
        opportunityFolderUrl,
        valuationFilesFolderId,
        offersReceivedFolderId,
        offersSentFolderId,
        ponzioFilesFolderId,
        otherFilesFolderId,
      });

      // Krok 6: Zaplanuj upload plików z Jotform do "Pliki do wyceny od klienta"
      await ctx.scheduler.runAfter(
        0,
        api.googleDrive.uploadSalesOpportunityFiles,
        { opportunityId: args.opportunityId },
      );

      // Krok 7: Zaplanuj upload ręcznie dołączonych plików do "Inne" (foldery już gotowe)
      for (const storageId of args.uploadedFileIds ?? []) {
        await ctx.scheduler.runAfter(
          0,
          api.googleDrive.uploadManualOpportunityFile,
          { opportunityId: args.opportunityId, storageId },
        );
      }

      await log("info", "DONE — foldery zapisane w rekordzie szansy", { opportunityFolderId });
      return { folderId: opportunityFolderId, folderUrl: opportunityFolderUrl };
    } catch (err) {
      await log("error", "NIEOCZEKIWANY BŁĄD", { error: String(err) });
      return null;
    }
  },
});

export const createOrderFolder = action({
  args: {
    orderId: v.id("orders"),
    opportunityId: v.optional(v.id("pendingJotformSubmissions")),
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

      // Krok 1: Znajdź lub utwórz folder klienta w shared drive
      let clientFolderId = client.clientFolderId;
      if (!clientFolderId) {
        const clientFolderName = client.clientType === "business" && client.companyName
          ? client.companyName
          : `${client.firstName}_${client.lastName}`;
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

      // Krok 2: Znajdź lub utwórz podfolder "Zlecenia" w folderze klienta
      await log("info", "finding or creating Zlecenia subfolder", { parentId: clientFolderId });
      const zleceniaFolderId = await findOrCreateDriveFolder(
        connection.accessToken,
        "Zlecenia",
        clientFolderId,
      );

      // Krok 3: Utwórz podfolder zlecenia wewnątrz "Zlecenia"
      // Konwencja: DD.MM.YYYY_Usługa_Miejscowość
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, "0");
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const yyyy = now.getFullYear();
      const service = (order.services ?? []).join("-") || "Zlecenie";
      const city = client.city ?? "";
      const orderFolderName = `${dd}.${mm}.${yyyy}_${service}_${city}`;

      await log("info", "creating order folder", { orderFolderName, parentId: zleceniaFolderId });
      const { id: folderId, url: folderUrl } = await createDriveFolder(
        ctx,
        orderFolderName,
        zleceniaFolderId,
      );
      await log("info", "order folder created", { folderId, folderUrl });

      // Krok 4: Skopiuj pliki z podfolderów szansy sprzedaży (oryginały zostają w szansie)
      const driveProjectFiles: Array<{ fileId: string; name: string; url: string }> = [];

      let filesCopiedFromOpportunity = false;
      if (args.opportunityId) {
        const opp = await ctx.runQuery(api.salesOpportunities.getSalesOpportunity, {
          opportunityId: args.opportunityId,
        });

        const subfoldersToCopy = [
          { id: opp?.valuationFilesFolderId, name: "Pliki do wyceny od klienta - rzuty i przysłane" },
          { id: opp?.offersReceivedFolderId, name: "Oferty otrzymane - koszta" },
          { id: opp?.offersSentFolderId, name: "Oferty wysłane" },
          { id: opp?.ponzioFilesFolderId, name: "Ponzio pliki" },
          { id: opp?.otherFilesFolderId, name: "Inne" },
        ].filter((sf): sf is { id: string; name: string } => !!sf.id);

        if (subfoldersToCopy.length > 0) {
          await log("info", "copying files from opportunity subfolders", { count: subfoldersToCopy.length });
          for (const subfolder of subfoldersToCopy) {
            try {
              const { id: destSubfolderId } = await createDriveFolder(ctx, subfolder.name, folderId);
              const files = await listDriveFolderFiles(ctx, subfolder.id);
              for (const file of files) {
                try {
                  const copied = await copyFileToDriveFolder(ctx, file.id, destSubfolderId);
                  driveProjectFiles.push({ fileId: copied.id, name: copied.name, url: copied.url });
                } catch (error) {
                  await log("error", "file copy failed", { fileId: file.id, name: file.name, error: String(error) });
                }
              }
            } catch (error) {
              await log("error", "subfolder copy failed", { subfolder: subfolder.name, error: String(error) });
            }
          }
          filesCopiedFromOpportunity = true;
          await log("info", "files copied from opportunity subfolders", { count: driveProjectFiles.length });
        } else if (opp?.driveProjectFiles && opp.driveProjectFiles.length > 0) {
          // Fallback dla starych szans bez struktury podfolderów
          await log("info", "copying files from driveProjectFiles (legacy fallback)", {
            count: opp.driveProjectFiles.length,
          });
          for (const file of opp.driveProjectFiles) {
            const fileId = extractGoogleDriveFileId(file.url);
            if (!fileId) {
              await log("warn", "could not extract fileId from URL — skipping", { url: file.url });
              continue;
            }
            try {
              const copied = await copyFileToDriveFolder(ctx, fileId, folderId);
              driveProjectFiles.push({ fileId: copied.id, name: copied.name, url: copied.url });
            } catch (error) {
              await log("error", "file copy failed (legacy)", { fileId, url: file.url, error: String(error) });
            }
          }
          filesCopiedFromOpportunity = driveProjectFiles.length > 0;
        }
      }

      if (!filesCopiedFromOpportunity) {
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
      }

      // Krok 5: Utwórz stałe podfoldery zlecenia
      await log("info", "creating order subfolders");
      await Promise.all([
        createDriveFolder(ctx, "Faktury", folderId),
        createDriveFolder(ctx, "Umowy", folderId),
        createDriveFolder(ctx, "Zdjęcia budowy", folderId),
        createDriveFolder(ctx, "Rysunki konstrukcji do zamówienia", folderId),
      ]);

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

      const clientFolderName = client.clientType === "business" && client.companyName
        ? client.companyName
        : `${client.firstName}_${client.lastName}`;
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
    newFolderName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { oldFirstName, oldLastName, newFirstName, newLastName, clientFolderId, clientId } = args;

    // 1. Przemianuj folder klienta
    const newFolderName = args.newFolderName ?? `${newFirstName}_${newLastName}`;
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

export const listOpportunityFolderContents = action({
  args: {
    opportunityId: v.id("pendingJotformSubmissions"),
    folderId: v.string(),
  },
  handler: async (ctx, args): Promise<Array<{
    id: string;
    name: string;
    isFolder: boolean;
    url?: string;
    mimeType?: string;
  }>> => {
    await requireUserIdentifierInAction(ctx);

    const params = new URLSearchParams({
      q: `'${args.folderId}' in parents and trashed=false`,
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      fields: "files(id,name,mimeType,webViewLink)",
      pageSize: "200",
      orderBy: "folder,name",
    });

    const data = await driveApiFetchWithRetry(
      ctx,
      `/files?${params.toString()}`,
    ) as unknown as { files?: Array<{ id?: string; name?: string; mimeType?: string; webViewLink?: string }> };

    const items = (data.files ?? [])
      .filter((f): f is { id: string; name: string; mimeType?: string; webViewLink?: string } => !!f.id && !!f.name)
      .map(f => ({
        id: f.id,
        name: f.name,
        isFolder: f.mimeType === "application/vnd.google-apps.folder",
        url: f.mimeType !== "application/vnd.google-apps.folder"
          ? (f.webViewLink ?? `https://drive.google.com/file/d/${f.id}/view`)
          : undefined,
        mimeType: f.mimeType,
      }));

    items.sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      return a.name.localeCompare(b.name, "pl");
    });

    return items;
  },
});

export const uploadManualOpportunityFile = action({
  args: {
    opportunityId: v.id("pendingJotformSubmissions"),
    storageId: v.id("_storage"),
    maxRetries: v.optional(v.number()),
    targetFolderId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ uploaded: boolean; folderId?: string } | null> => {
    const maxRetries = args.maxRetries ?? 3;
    let retryCount = 0;

    const log = async (
      level: "info" | "warn" | "error",
      message: string,
      data?: Record<string, unknown>,
    ) => {
      console[level](`[uploadManualOpportunityFile] ${message}`, data ?? "");
      try {
        await ctx.runMutation(internal.systemLogs.insert, {
          level,
          source: "uploadManualOpportunityFile",
          message,
          data: { opportunityId: args.opportunityId, ...data },
        });
      } catch (e) {
        console.error("[uploadManualOpportunityFile] systemLogs.insert failed", e);
      }
    };

    try {
      await log("info", "START");

      const opp = await ctx.runQuery(api.salesOpportunities.getSalesOpportunity, {
        opportunityId: args.opportunityId,
      });
      if (!opp) {
        await log("error", "Opportunity not found");
        return null;
      }

      let uploadFolderId: string | undefined = args.targetFolderId;

      if (!uploadFolderId) {
        // Czekaj na folder "Inne" w szansie sprzedaży (z retry)
        let otherFilesFolderId = opp.otherFilesFolderId;

        while (!otherFilesFolderId && retryCount < maxRetries) {
          if (retryCount > 0) {
            await log("warn", "Inne folder not ready, retrying...", { retryCount, maxRetries });
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }

          const refreshedOpp = await ctx.runQuery(
            api.salesOpportunities.getSalesOpportunity,
            { opportunityId: args.opportunityId },
          );
          otherFilesFolderId = refreshedOpp?.otherFilesFolderId;
          retryCount++;
        }

        if (!otherFilesFolderId) {
          await log("error", "Inne folder not found after retries", { retryCount });
          return null;
        }

        uploadFolderId = otherFilesFolderId;
      }

      await log("info", "Upload folder ready", { folderId: uploadFolderId });

      const connection = await getAuthorizedConnection(ctx);

      // Pobierz plik z storage
      const fileUrl = await ctx.storage.getUrl(args.storageId);
      if (!fileUrl) {
        await log("error", "File URL not found in storage");
        return null;
      }

      // Wgraj plik do podfolderu
      const result = await uploadFileToDrive(ctx, fileUrl, uploadFolderId);
      if (result) {
        await log("info", "File uploaded", {
          fileId: result.fileId,
          name: result.name,
          folderId: uploadFolderId,
        });
        try {
          await ctx.runMutation(internal.salesOpportunities.addDriveProjectFile, {
            opportunityId: args.opportunityId,
            name: result.name,
            url: result.url,
          });
        } catch (e) {
          await log("warn", "Failed to save Drive file link", {
            name: result.name,
            error: String(e),
          });
        }
        return { uploaded: true, folderId: uploadFolderId };
      } else {
        await log("warn", "File upload returned null");
        return null;
      }
    } catch (err) {
      await log("error", "UNEXPECTED ERROR", { error: String(err) });
      return null;
    }
  },
});

export const uploadSalesOpportunityFiles = action({
  args: {
    opportunityId: v.id("pendingJotformSubmissions"),
    maxRetries: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ uploaded: number; failed: number; folderId?: string } | null> => {
    const maxRetries = args.maxRetries ?? 3;
    let retryCount = 0;

    const log = async (
      level: "info" | "warn" | "error",
      message: string,
      data?: Record<string, unknown>,
    ) => {
      console[level](`[uploadSalesOpportunityFiles] ${message}`, data ?? "");
      try {
        await ctx.runMutation(internal.systemLogs.insert, {
          level,
          source: "uploadSalesOpportunityFiles",
          message,
          data: { opportunityId: args.opportunityId, ...data },
        });
      } catch (e) {
        console.error("[uploadSalesOpportunityFiles] systemLogs.insert failed", e);
      }
    };

    try {
      await log("info", "START");

      const opp = await ctx.runQuery(api.salesOpportunities.getSalesOpportunity, {
        opportunityId: args.opportunityId,
      });
      if (!opp) {
        await log("error", "Opportunity not found");
        return null;
      }

      // Sprawdź czy są pliki do wgrania
      const fileUrls = (opp.projectFiles ?? "")
        .split(/[\n,]+/)
        .map((u: string) => u.trim())
        .filter(Boolean);

      if (fileUrls.length === 0) {
        await log("info", "No files to upload");
        return { uploaded: 0, failed: 0 };
      }

      // Czekaj na folder "Pliki do wyceny od klienta" w szansie sprzedaży (z retry)
      let valuationFilesFolderId = opp.valuationFilesFolderId;

      while (!valuationFilesFolderId && retryCount < maxRetries) {
        if (retryCount > 0) {
          await log("warn", "Valuation folder not ready, retrying...", {
            retryCount,
            maxRetries,
          });
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        const refreshedOpp = await ctx.runQuery(
          api.salesOpportunities.getSalesOpportunity,
          { opportunityId: args.opportunityId },
        );
        valuationFilesFolderId = refreshedOpp?.valuationFilesFolderId;
        retryCount++;
      }

      if (!valuationFilesFolderId) {
        await log("error", "Valuation files folder not found after retries", {
          retryCount,
          maxRetries,
        });
        return null;
      }

      await log("info", "Valuation files folder ready", {
        folderId: valuationFilesFolderId,
        fileCount: fileUrls.length,
      });

      const connection = await getAuthorizedConnection(ctx);

      // Wgraj pliki do "Pliki do wyceny od klienta - rzuty i przysłane"
      let uploaded = 0;
      let failed = 0;

      for (const url of fileUrls) {
        try {
          const result = await uploadFileToDrive(ctx, url, valuationFilesFolderId, {
            jotformApiKey: await getJotformApiKeyForActions(ctx),
          });
          if (result) {
            uploaded++;
            await log("info", "File uploaded to valuation folder", {
              url: url.substring(0, 50),
              fileId: result.fileId,
              name: result.name,
            });
            try {
              await ctx.runMutation(internal.salesOpportunities.addDriveProjectFile, {
                opportunityId: args.opportunityId,
                name: result.name,
                url: result.url,
              });
            } catch (e) {
              await log("warn", "Failed to save Drive file link", {
                name: result.name,
                error: String(e),
              });
            }
          } else {
            failed++;
            await log("warn", "File upload returned null", { url });
          }
        } catch (error) {
          failed++;
          await log("error", "File upload failed", {
            url: url.substring(0, 50),
            error: String(error),
          });
        }
      }

      await log("info", "DONE", { uploaded, failed, folderId: valuationFilesFolderId });
      return { uploaded, failed, folderId: valuationFilesFolderId };
    } catch (err) {
      await log("error", "UNEXPECTED ERROR", { error: String(err) });
      return null;
    }
  },
});

// ── Order folder browser ──────────────────────────────────────────────────────

export const listOrderFolderContents = action({
  args: {
    orderId: v.id("orders"),
    folderId: v.string(),
  },
  handler: async (ctx, args): Promise<Array<{
    id: string;
    name: string;
    isFolder: boolean;
    url?: string;
    mimeType?: string;
  }>> => {
    await requireUserIdentifierInAction(ctx);

    const params = new URLSearchParams({
      q: `'${args.folderId}' in parents and trashed=false`,
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      fields: "files(id,name,mimeType,webViewLink)",
      pageSize: "200",
      orderBy: "folder,name",
    });

    const data = await driveApiFetchWithRetry(
      ctx,
      `/files?${params.toString()}`,
    ) as unknown as { files?: Array<{ id?: string; name?: string; mimeType?: string; webViewLink?: string }> };

    const items = (data.files ?? [])
      .filter((f): f is { id: string; name: string; mimeType?: string; webViewLink?: string } => !!f.id && !!f.name)
      .map(f => ({
        id: f.id,
        name: f.name,
        isFolder: f.mimeType === "application/vnd.google-apps.folder",
        url: f.mimeType !== "application/vnd.google-apps.folder"
          ? (f.webViewLink ?? `https://drive.google.com/file/d/${f.id}/view`)
          : undefined,
        mimeType: f.mimeType,
      }));

    items.sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      return a.name.localeCompare(b.name, "pl");
    });

    return items;
  },
});

export const uploadManualOrderFile = action({
  args: {
    orderId: v.id("orders"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.optional(v.string()),
    targetFolderId: v.string(),
  },
  handler: async (ctx, args): Promise<{ fileId: string; name: string; url: string }> => {
    await requireUserIdentifierInAction(ctx);

    const order = await ctx.runQuery(api.orders.getById, { orderId: args.orderId });
    if (!order) throw new Error("Zlecenie nie znalezione");
    if (!order.folderId) throw new Error("To zlecenie nie ma folderu w Google Drive.");

    const connection = await getAuthorizedConnection(ctx);
    const { accessToken } = connection;

    const fileUrl = await ctx.storage.getUrl(args.storageId);
    if (!fileUrl) throw new Error("Nie znaleziono pliku w storage");

    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) throw new Error(`Nie udało się pobrać pliku: ${fileResponse.status}`);

    const contentType = args.mimeType || fileResponse.headers.get("content-type") || "application/octet-stream";
    const fileBuffer = await fileResponse.arrayBuffer();

    const metadata = JSON.stringify({ name: args.fileName, parents: [args.targetFolderId] });
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

    await ctx.storage.delete(args.storageId);

    return {
      fileId: uploaded.id,
      name: args.fileName,
      url: `https://drive.google.com/file/d/${uploaded.id}/view`,
    };
  },
});
