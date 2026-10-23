import { v } from "convex/values";
import type { ActionCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { query, mutation, action, internalMutation, internalAction, internalQuery } from "./_generated/server";
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
const SLIDES_API_BASE = "https://slides.googleapis.com/v1";

const CLIENTS_FOLDER_ID = "0AF5F7v0YZWQHUk9PVA";
const TEMPLATES_FOLDER_ID = "0ANuZnSEtUiLTUk9PVA";

export function resolveFoldersConfig(config: Doc<"crmConfig"> | null | undefined) {
  const legacyCustomFolders = (config?.googleDriveFolders as Record<string, unknown> | undefined)?.customSubfolders as string[] | undefined;
  return {
    opportunity: {
      valuationFiles: config?.googleDriveFolders?.opportunity?.valuationFiles ?? "Pliki do wyceny od klienta - rzuty i przysłane",
      offersReceived: config?.googleDriveFolders?.opportunity?.offersReceived ?? "Koszta - oferty od dostawców",
      offersSent: config?.googleDriveFolders?.opportunity?.offersSent ?? "Oferty - wysłane do Klienta",
      ponzioFiles: config?.googleDriveFolders?.opportunity?.ponzioFiles ?? "Ponzio - pliki",
      customSubfolders: config?.googleDriveFolders?.opportunity?.customSubfolders ?? [],
    },
    order: {
      invoices: config?.googleDriveFolders?.order?.invoices ?? "Faktury - sprzedażowe, kosztowe, potwierdzenia, zamówienia",
      documents: config?.googleDriveFolders?.order?.documents ?? "Dokumenty - gwarancje, protokoły, umowy",
      measurements: config?.googleDriveFolders?.order?.measurements ?? "Pomiary - ustalenia",
      customSubfolders: config?.googleDriveFolders?.order?.customSubfolders ?? legacyCustomFolders ?? [
        "Zdjęcia budowy",
        "Rysunki konstrukcji do zamówienia"
      ],
      // document type → subfolder name mapping (set in admin settings)
      documentTypeRoutes: (config?.googleDriveFolders?.order?.documentTypeRoutes ?? {}) as Record<string, string>,
    }
  };
}

function getDocumentType(key: string): "pomiar" | "umowa" | "gwarancja" | "faktura" | "custom" {
  if (key === "pomiar") return "pomiar";
  if (key === "umowa") return "umowa";
  if (key === "faktura") return "faktura";
  if (key.startsWith("gwarancja_") || key === "gwarancja_alco") return "gwarancja";
  return "custom";
}

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
  mimeType?: string;
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

async function renameDriveFolder(
  ctx: ActionCtx,
  folderId: string,
  newName: string,
) {
  await driveApiFetchWithRetry(
    ctx,
    `/files/${folderId}?supportsAllDrives=true`,
    {
      method: "PATCH",
      body: JSON.stringify({
        name: newName,
      }),
    },
  );
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
      sharedDriveId: connection.sharedDriveId || CLIENTS_FOLDER_ID,
      templatesFolderId: connection.templatesFolderId || TEMPLATES_FOLDER_ID,
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
    let oldSharedDriveId: string | undefined;
    let oldTemplatesFolderId: string | undefined;
    const existing = await ctx.db.query("driveConnection").first();
    if (existing) {
      oldSharedDriveId = existing.sharedDriveId;
      oldTemplatesFolderId = existing.templatesFolderId;
      await ctx.db.delete(existing._id);
    }

    const id = await ctx.db.insert("driveConnection", {
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      expiresAt: args.expiresAt,
      connectedBy: args.connectedBy,
      connectedEmail: args.connectedEmail,
      connectionStatus: "connected",
      sharedDriveId: oldSharedDriveId,
      templatesFolderId: oldTemplatesFolderId,
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
            : `${opp.lastName}_${opp.firstName}`;
        } else {
          clientFolderName = `${opp.lastName}_${opp.firstName}`;
        }

        const clientsFolderId = connection.sharedDriveId || CLIENTS_FOLDER_ID;
        await log("info", "creating client folder", { clientFolderName, parentId: clientsFolderId });
        clientFolderId = await findOrCreateDriveFolder(
          connection.accessToken,
          clientFolderName,
          clientsFolderId,
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
      const config = await ctx.runQuery(api.crmConfig.getConfig);
      const folders = resolveFoldersConfig(config);

      const valuationFilesFolderId = await findOrCreateDriveFolder(
        connection.accessToken,
        folders.opportunity.valuationFiles,
        opportunityFolderId,
      );
      const offersReceivedFolderId = await findOrCreateDriveFolder(
        connection.accessToken,
        folders.opportunity.offersReceived,
        opportunityFolderId,
      );
      const offersSentFolderId = await findOrCreateDriveFolder(
        connection.accessToken,
        folders.opportunity.offersSent,
        opportunityFolderId,
      );
      const ponzioFilesFolderId = await findOrCreateDriveFolder(
        connection.accessToken,
        folders.opportunity.ponzioFiles,
        opportunityFolderId,
      );
      const otherFilesFolderId = await findOrCreateDriveFolder(
        connection.accessToken,
        "Inne",
        opportunityFolderId,
      );

      // Krok 4.5: Utwórz dodatkowe niestandardowe podfoldery dla szansy
      for (const customFolder of folders.opportunity.customSubfolders) {
        await findOrCreateDriveFolder(
          connection.accessToken,
          customFolder,
          opportunityFolderId,
        );
      }

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

      // Krok 7: Zaplanuj upload ręcznie dołączonych plików do folderu wyceny ("Pliki do wyceny od klienta")
      for (const storageId of args.uploadedFileIds ?? []) {
        await ctx.scheduler.runAfter(
          0,
          api.googleDrive.uploadManualOpportunityFile,
          { opportunityId: args.opportunityId, storageId, targetFolderId: valuationFilesFolderId },
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
          : `${client.lastName}_${client.firstName}`;
        const clientsFolderId = connection.sharedDriveId || CLIENTS_FOLDER_ID;
        await log("info", "creating client folder", { clientFolderName, parentId: clientsFolderId });
        const { id, url: clientFolderUrl } = await createDriveFolder(
          ctx,
          clientFolderName,
          clientsFolderId,
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
      // Konwencja: DD.MM.YYYY_Usługa_TekstWłasny
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, "0");
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const yyyy = now.getFullYear();
      const service = (order.services ?? []).join("-") || "Zlecenie";
      const segments: string[] = [`${dd}.${mm}.${yyyy}`, service];
      if (order.customText) segments.push(order.customText);
      const orderFolderName = segments.join("_");

      await log("info", "creating order folder", { orderFolderName, parentId: zleceniaFolderId });
      const { id: folderId, url: folderUrl } = await createDriveFolder(
        ctx,
        orderFolderName,
        zleceniaFolderId,
      );
      await log("info", "order folder created", { folderId, folderUrl });

      // Krok 4: Utwórz wszystkie podfoldery zlecenia (zawsze, niezależnie od szansy)
      await log("info", "creating order subfolders");
      const config = await ctx.runQuery(api.crmConfig.getConfig);
      const folders = resolveFoldersConfig(config);

      const OPPORTUNITY_SUBFOLDERS = [
        folders.opportunity.valuationFiles,
        folders.opportunity.offersReceived,
        folders.opportunity.offersSent,
        folders.opportunity.ponzioFiles,
        ...folders.opportunity.customSubfolders,
      ];
      const ORDER_SUBFOLDERS = [
        folders.order.invoices,
        folders.order.documents,
        folders.order.measurements,
        ...folders.order.customSubfolders,
      ];

      const [oppSubfolderIds] = await Promise.all([
        Promise.all(OPPORTUNITY_SUBFOLDERS.map((name) => createDriveFolder(ctx, name, folderId).then((r) => ({ name, id: r.id })))),
        Promise.all(ORDER_SUBFOLDERS.map((name) => createDriveFolder(ctx, name, folderId))),
      ]);
      const oppSubfolderByName = Object.fromEntries(oppSubfolderIds.map((s) => [s.name, s.id]));

      // Krok 5: Skopiuj pliki z podfolderów szansy sprzedaży do odpowiednich podfolderów zlecenia
      const driveProjectFiles: Array<{ fileId: string; name: string; url: string }> = [];
      let filesCopiedFromOpportunity = false;

      if (args.opportunityId) {
        const opp = await ctx.runQuery(api.salesOpportunities.getSalesOpportunity, {
          opportunityId: args.opportunityId,
        });

        // Pobierz foldery z Google Drive szansy w celu znalezienia niestandardowych podfolderów
        let driveFolders: Array<{ id: string; name: string }> = [];
        if (opp?.opportunityFolderId) {
          try {
            const params = new URLSearchParams({
              q: `'${opp.opportunityFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
              supportsAllDrives: "true",
              includeItemsFromAllDrives: "true",
              fields: "files(id,name)",
            });
            const driveData = await driveApiFetchWithRetry(ctx, `/files?${params.toString()}`) as { files?: Array<{ id?: string; name?: string }> };
            driveFolders = (driveData.files ?? []).filter((f): f is { id: string; name: string } => !!(f.id && f.name));
          } catch (e) {
            await log("error", "failed to list opportunity subfolders from Drive", { error: String(e) });
          }
        }

        const subfoldersToCopy = [
          { id: opp?.valuationFilesFolderId, name: folders.opportunity.valuationFiles },
          { id: opp?.offersReceivedFolderId, name: folders.opportunity.offersReceived },
          { id: opp?.offersSentFolderId, name: folders.opportunity.offersSent },
          { id: opp?.ponzioFilesFolderId, name: folders.opportunity.ponzioFiles },
          { id: opp?.otherFilesFolderId, name: "Inne pliki" },
          { id: opp?.opportunityFolderId, name: "Główny folder szansy" },
        ].filter((sf): sf is { id: string; name: string } => !!sf.id);

        for (const cfName of folders.opportunity.customSubfolders) {
          const matched = driveFolders.find((df) => df.name === cfName);
          if (matched) {
            subfoldersToCopy.push({ id: matched.id, name: cfName });
          }
        }

        if (subfoldersToCopy.length > 0) {
          await log("info", "copying files from opportunity subfolders", { count: subfoldersToCopy.length });
          for (const subfolder of subfoldersToCopy) {
            try {
              const destFolderId = oppSubfolderByName[subfolder.name] || folderId;
              const files = await listDriveFolderFiles(ctx, subfolder.id);
              for (const file of files) {
                try {
                  const copied = await copyFileToDriveFolder(ctx, file.id, destFolderId);
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
        : `${client.lastName}_${client.firstName}`;
      const clientsFolderId = (connection as Record<string, unknown>).sharedDriveId as string | undefined || CLIENTS_FOLDER_ID;
      await log("info", "creating Drive folder", { clientFolderName, parentId: clientsFolderId });

      const { id, url: clientFolderUrl } = await createDriveFolder(ctx, clientFolderName, clientsFolderId);
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

export const uploadUserDocumentPublic = action({
  args: {
    orderId: v.id("orders"),
    documentType: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
    signatureStatus: v.union(v.literal("signed"), v.literal("not_applicable")),
  },
  handler: async (ctx, args): Promise<string> => {
    const currentUserId = await getAuthUserId(ctx);
    let performedBy = "PWA App User";
    if (currentUserId) {
      const user = (await ctx.runQuery(internal.users._internalGetUser, {
        userId: currentUserId,
      })) as Doc<"users"> | null;
      if (user && user.isActive === true) {
        performedBy = user.email ?? user._id;
      }
    }

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

    const config = await ctx.runQuery(api.crmConfig.getConfig);
    const folders = resolveFoldersConfig(config);

    let targetFolderId = order.folderId;
    const docType = getDocumentType(args.documentType);

    // Priority 1: explicit folder route configured in admin settings for this document type
    const configuredFolderName = folders.order.documentTypeRoutes[args.documentType];
    if (configuredFolderName) {
      targetFolderId = await findOrCreateDriveFolder(connection.accessToken, configuredFolderName, order.folderId);
    } else {
      // Priority 2: legacy fallback by broad document type
      if (docType === "umowa" || docType === "gwarancja") {
        targetFolderId = await findOrCreateDriveFolder(connection.accessToken, folders.order.documents, order.folderId);
      } else if (docType === "faktura") {
        targetFolderId = await findOrCreateDriveFolder(connection.accessToken, folders.order.invoices, order.folderId);
      } else if (docType === "pomiar") {
        targetFolderId = await findOrCreateDriveFolder(connection.accessToken, folders.order.measurements, order.folderId);
      }
      // otherwise: root order folder
    }

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

export const uploadUserDocument = action({
  args: {
    orderId: v.id("orders"),
    documentType: v.string(),
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

    const config = await ctx.runQuery(api.crmConfig.getConfig);
    const folders = resolveFoldersConfig(config);

    let targetFolderId = order.folderId;
    const docType = getDocumentType(args.documentType);
    if (docType === "umowa" || docType === "gwarancja") {
      targetFolderId = await findOrCreateDriveFolder(connection.accessToken, folders.order.documents, order.folderId);
    } else if (docType === "faktura") {
      targetFolderId = await findOrCreateDriveFolder(connection.accessToken, folders.order.invoices, order.folderId);
    }

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

    const existingAttachments = (await ctx.runQuery(api.attachments.listByOrder, {
      orderId: args.orderId,
    })) as Doc<"orderAttachments">[];
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

      const lineItemsResult = (await ctx.runQuery(api.orderLineItems.listByOrder, {
        orderId: args.orderId,
      })) as { items: Doc<"orderLineItems">[]; totals: { totalGross: number; totalNet: number } };
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
      const isAdvance = effectiveType === "advance_final" || effectiveType === "advance_2_final";
      const advancePct = isAdvance ? storedAdvancePct : 0;
      const advance2Pct = effectiveType === "advance_2_final" ? (order.invoicePlan?.advance2Pct ?? 0) : 0;
      const finalPct = 100 - advancePct - advance2Pct;
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
        invoiceAdvancePct: isAdvance ? `${advancePct}%` : "",
        invoiceAdvanceAmount: isAdvance ? formatPLN(round2(totalGross * advancePct / 100)) : "",
        invoiceAdvanceNetAmount: isAdvance ? formatPLN(round2(totalNet * advancePct / 100)) : "",
        // Faktura zaliczkowa 2
        invoiceAdvance2Pct: effectiveType === "advance_2_final" ? `${advance2Pct}%` : "",
        invoiceAdvance2Amount: effectiveType === "advance_2_final" ? formatPLN(round2(totalGross * advance2Pct / 100)) : "",
        invoiceAdvance2NetAmount: effectiveType === "advance_2_final" ? formatPLN(round2(totalNet * advance2Pct / 100)) : "",
        // Faktura końcowa
        invoiceFinalPct: isAdvance ? `${finalPct}%` : "",
        invoiceFinalAmount: isAdvance ? formatPLN(round2(totalGross * finalPct / 100)) : "",
        invoiceFinalNetAmount: isAdvance ? formatPLN(round2(totalNet * finalPct / 100)) : "",
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

      const config = await ctx.runQuery(api.crmConfig.getConfig);
      const folders = resolveFoldersConfig(config);

      let targetFolderId = order.folderId;
      const targetFolderName = (template as Record<string, unknown>).targetFolder as string | undefined;

      if (targetFolderName) {
        targetFolderId = await findOrCreateDriveFolder(connection.accessToken, targetFolderName, order.folderId);
      } else {
        const docType = getDocumentType(args.templateKey);
        if (docType === "umowa" || docType === "gwarancja") {
          targetFolderId = await findOrCreateDriveFolder(connection.accessToken, folders.order.documents, order.folderId);
        } else if (docType === "faktura") {
          targetFolderId = await findOrCreateDriveFolder(connection.accessToken, folders.order.invoices, order.folderId);
        }
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

      console.log(`[copyTemplate] templateKey=${args.templateKey}, targetFolderId=${targetFolderId}, orderFolderId=${order.folderId}`);

      const copyData = await driveApiFetchWithRetry(
        ctx,
        `/files/${template.googleDriveFileId}/copy?supportsAllDrives=true`,
        {
          method: "POST",
          body: JSON.stringify({
            name: fileName,
            parents: [targetFolderId],
          }),
        },
      );

      if (!copyData.id) {
        throw new Error("Google Drive copy returned no file id");
      }

      // Ensure the file actually ended up in the target folder
      // (Google Drive may ignore `parents` when copying from Shared Drives)
      if (targetFolderId !== order.folderId) {
        try {
          const fileMetaRes = await fetch(
            `${DRIVE_API_BASE}/files/${copyData.id}?fields=parents&supportsAllDrives=true`,
            { headers: { Authorization: `Bearer ${connection.accessToken}` } },
          );
          if (fileMetaRes.ok) {
            const fileMeta = await fileMetaRes.json() as { parents?: string[] };
            const actualParents = fileMeta.parents ?? [];
            console.log(`[copyTemplate] File ${copyData.id} parents=${JSON.stringify(actualParents)}, expected=${targetFolderId}`);
            if (!actualParents.includes(targetFolderId)) {
              const currentParent = actualParents[0] ?? order.folderId;
              await fetch(
                `${DRIVE_API_BASE}/files/${copyData.id}?addParents=${targetFolderId}&removeParents=${currentParent}&supportsAllDrives=true`,
                {
                  method: "PATCH",
                  headers: {
                    Authorization: `Bearer ${connection.accessToken}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({}),
                },
              );
              console.log(`[copyTemplate] Moved file ${copyData.id} from ${currentParent} to ${targetFolderId}`);
            }
          }
        } catch (moveErr) {
          console.error(`[copyTemplate] Failed to verify/move file to target folder:`, moveErr);
        }
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

      const lineItemsResult = (await ctx.runQuery(api.orderLineItems.listByOrder, { orderId: args.orderId })) as {
        items: Doc<"orderLineItems">[];
        totals: { totalGross: number; totalNet: number };
      };
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
      const isAdvance = effectiveType === "advance_final" || effectiveType === "advance_2_final";
      const advancePct = isAdvance ? storedAdvancePct : 0;
      const advance2Pct = effectiveType === "advance_2_final" ? (order.invoicePlan?.advance2Pct ?? 0) : 0;
      const finalPct = 100 - advancePct - advance2Pct;
      const round2 = (n: number) => Math.round(n * 100) / 100;
      const lineItemsList = lineItemsResult.items.map((item) => item.name).join("\n");
      const computedFields = {
        estimateTotal: formatPLN(totalGross),
        estimateNetTotal: formatPLN(totalNet),
        lineItemsList,
        invoiceVatPct: effectiveType === "vat" ? "100%" : "",
        invoiceVatAmount: effectiveType === "vat" ? formatPLN(totalGross) : "",
        invoiceVatNetAmount: effectiveType === "vat" ? formatPLN(totalNet) : "",
        invoiceAdvancePct: isAdvance ? `${advancePct}%` : "",
        invoiceAdvanceAmount: isAdvance ? formatPLN(round2(totalGross * advancePct / 100)) : "",
        invoiceAdvanceNetAmount: isAdvance ? formatPLN(round2(totalNet * advancePct / 100)) : "",
        invoiceAdvance2Pct: effectiveType === "advance_2_final" ? `${advance2Pct}%` : "",
        invoiceAdvance2Amount: effectiveType === "advance_2_final" ? formatPLN(round2(totalGross * advance2Pct / 100)) : "",
        invoiceAdvance2NetAmount: effectiveType === "advance_2_final" ? formatPLN(round2(totalNet * advance2Pct / 100)) : "",
        invoiceFinalPct: isAdvance ? `${finalPct}%` : "",
        invoiceFinalAmount: isAdvance ? formatPLN(round2(totalGross * finalPct / 100)) : "",
        invoiceFinalNetAmount: isAdvance ? formatPLN(round2(totalNet * finalPct / 100)) : "",
      };

      let fileName = template.fileNamePattern;
      fileName = fileName.replace("{{firstName}}", client.firstName);
      fileName = fileName.replace("{{lastName}}", client.lastName);
      fileName = fileName.replace("{{city}}", client.city ?? "");
      fileName = fileName.replace("{{date}}", new Date().toISOString().slice(0, 10));

      const connection = await getAuthorizedConnection(ctx);
      const targetFolderId = await findOrCreateDriveFolder(connection.accessToken, "Gwarancja", order.folderId);

      console.log(`[copyWarrantyTemplate] key=${args.key}, targetFolderId=${targetFolderId}, orderFolderId=${order.folderId}`);

      const copyData = await driveApiFetchWithRetry(
        ctx,
        `/files/${template.googleDriveFileId}/copy?supportsAllDrives=true`,
        {
          method: "POST",
          body: JSON.stringify({ name: fileName, parents: [targetFolderId] }),
        },
      );
      if (!copyData.id) throw new Error("Google Drive copy returned no file id");

      // Ensure the file actually ended up in the target folder
      // (Google Drive may ignore `parents` when copying from Shared Drives)
      if (targetFolderId !== order.folderId) {
        try {
          const fileMetaRes = await fetch(
            `${DRIVE_API_BASE}/files/${copyData.id}?fields=parents&supportsAllDrives=true`,
            { headers: { Authorization: `Bearer ${connection.accessToken}` } },
          );
          if (fileMetaRes.ok) {
            const fileMeta = await fileMetaRes.json() as { parents?: string[] };
            const actualParents = fileMeta.parents ?? [];
            console.log(`[copyWarrantyTemplate] File ${copyData.id} parents=${JSON.stringify(actualParents)}, expected=${targetFolderId}`);
            if (!actualParents.includes(targetFolderId)) {
              const currentParent = actualParents[0] ?? order.folderId;
              await fetch(
                `${DRIVE_API_BASE}/files/${copyData.id}?addParents=${targetFolderId}&removeParents=${currentParent}&supportsAllDrives=true`,
                {
                  method: "PATCH",
                  headers: {
                    Authorization: `Bearer ${connection.accessToken}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({}),
                },
              );
              console.log(`[copyWarrantyTemplate] Moved file ${copyData.id} from ${currentParent} to ${targetFolderId}`);
            }
          }
        } catch (moveErr) {
          console.error(`[copyWarrantyTemplate] Failed to verify/move file to target folder:`, moveErr);
        }
      }

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
    const connection = await getAuthorizedConnection(ctx);
    const parentId = connection.templatesFolderId || TEMPLATES_FOLDER_ID;

    const params = new URLSearchParams({
      q: `'${parentId}' in parents and trashed=false`,
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

export const DEFAULT_OFFER_DOCS_TEMPLATE_ID = "1XJnz47VXgNXFrOagFj7JiFxcmesIFWQAkQXS7ckc-6Y";
export const OFFER_SLIDES_TEMPLATE_ID = "1-gl0q_8B9k6eM0mWwh30tAbx9LN8sfhmwrHMRI-ppUg";
export const OFFER_DOCX_TEMPLATE_ID = DEFAULT_OFFER_DOCS_TEMPLATE_ID;

async function uploadBufferToDrive(
  accessToken: string,
  buffer: ArrayBuffer | Uint8Array,
  fileName: string,
  contentType: string,
  parentId: string,
): Promise<{ fileId: string; name: string; url: string }> {
  const metadata = JSON.stringify({ name: fileName, parents: [parentId] });
  const boundary = `drive_upload_${Date.now()}`;
  const encoder = new TextEncoder();
  const preamble = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`,
  );
  const epilogue = encoder.encode(`\r\n--${boundary}--`);

  const u8Buffer = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const body = new Uint8Array(
    preamble.byteLength + u8Buffer.byteLength + epilogue.byteLength,
  );
  body.set(preamble, 0);
  body.set(u8Buffer, preamble.byteLength);
  body.set(epilogue, preamble.byteLength + u8Buffer.byteLength);

  const response = await fetch(
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

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Google Drive upload failed ${response.status}: ${errorBody}`);
  }

  const uploadedFile = (await response.json()) as { id?: string; name?: string };
  if (!uploadedFile.id) {
    throw new Error("Google Drive upload did not return file id");
  }

  return {
    fileId: uploadedFile.id,
    name: uploadedFile.name ?? fileName,
    url: `https://drive.google.com/file/d/${uploadedFile.id}/view`,
  };
}

export const generateOfferPdf = action({
  args: {
    offerId: v.id("offers"),
    templateFileId: v.optional(v.string()),
    itemsCadImages: v.optional(
      v.array(
        v.object({
          positionIndex: v.number(),
          imageUrl: v.string(),
        })
      )
    ),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ pdfUrl: string; fileId: string; fileName: string; folderUrl: string }> => {
    // 1. Pobierz ofertę i jej pozycje oraz powiązaną usługę
    const offerData = await ctx.runQuery(api.offers.getOfferWithItems, {
      offerId: args.offerId,
    });
    if (!offerData || !offerData.offer) {
      throw new Error("Oferta nie została znaleziona.");
    }
    const { offer, items, opportunity, client, service } = offerData;
    if (!opportunity) {
      throw new Error("Szansa sprzedaży powiązana z ofertą nie została znaleziona.");
    }

    // Dynamiczne ustalenie szablonu:
    // 1. Jawnie przekazany w akcji (args.templateFileId)
    // 2. Przypisany wprost do oferty (offer.templateFileId)
    // 3. Szablon skonfigurowany w usłudze oferty / szansy (service.offerTemplateGoogleDriveId)
    // 4. Domyślny szablon Google Docs (DEFAULT_OFFER_DOCS_TEMPLATE_ID)
    const templateId =
      args.templateFileId ||
      offer.templateFileId ||
      service?.offerTemplateGoogleDriveId ||
      DEFAULT_OFFER_DOCS_TEMPLATE_ID;

    const connection = await getAuthorizedConnection(ctx);
    const accessToken = connection.accessToken;

    const config = await ctx.runQuery(api.crmConfig.getConfig);
    const folders = resolveFoldersConfig(config);
    const offersSentFolderName = folders.opportunity.offersSent || "Oferty - wysłane do Klienta";

    // 2. Znajdź lub utwórz folder "Oferty - wysłane do Klienta" dla szansy sprzedaży
    let targetFolderId = opportunity.offersSentFolderId;

    if (!targetFolderId) {
      let oppFolderId = opportunity.opportunityFolderId;
      if (!oppFolderId) {
        try {
          await ctx.runAction(api.googleDrive.createClientFolderForOpportunity, {
            opportunityId: opportunity._id,
          });
          const refreshedOpp = await ctx.runQuery(api.salesOpportunities.getSalesOpportunity, {
            opportunityId: opportunity._id,
          });
          targetFolderId = refreshedOpp?.offersSentFolderId;
          oppFolderId = refreshedOpp?.opportunityFolderId;
        } catch (folderErr) {
          console.warn("[generateOfferPdf] createClientFolderForOpportunity failed, will try direct creation:", folderErr);
        }
      }

      if (!targetFolderId && oppFolderId) {
        targetFolderId = await findOrCreateDriveFolder(accessToken, offersSentFolderName, oppFolderId);
      }
    }

    // Fallback: jeśli nadal nie ma folderu szansy, użyj folderu klienta lub głównego folderu klientów
    if (!targetFolderId) {
      const parentFallback = client?.clientFolderId || CLIENTS_FOLDER_ID;
      targetFolderId = await findOrCreateDriveFolder(accessToken, offersSentFolderName, parentFallback);
    }

    // 3. Przygotuj dane do podstawienia
    const formatPLN = (amount: number): string => {
      const rounded = Math.round(amount * 100) / 100;
      const str = rounded.toFixed(2);
      const dotIdx = str.indexOf(".");
      const intPart = str.slice(0, dotIdx);
      const decPart = str.slice(dotIdx + 1);
      return `${intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${decPart} zł`;
    };

    const clientFirstName = opportunity.firstName || client?.firstName || "";
    const clientLastName = opportunity.lastName || client?.lastName || "";
    const clientFullName = [clientFirstName, clientLastName].filter(Boolean).join(" ") || "Klient";
    const clientPhone = opportunity.phone || client?.phone || "";
    const clientEmail = opportunity.email || client?.email || "";
    const clientCity = opportunity.city || client?.city || "";
    const clientStreet = opportunity.street || client?.street || "";
    const clientPostalCode = opportunity.postalCode || client?.postalCode || "";
    const clientAddress = [clientStreet, [clientPostalCode, clientCity].filter(Boolean).join(" ")].filter(Boolean).join(", ");

    const now = new Date();
    const todayStr = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;

    const totalNetStr = formatPLN(offer.totalPriceNet);
    const totalGrossStr = formatPLN(offer.totalPriceGross);
    const discountPctStr = `${offer.discountPercent || 0}%`;
    const netBeforeDiscount = (offer.discountPercent && offer.discountPercent > 0)
      ? offer.totalPriceNet / (1 - offer.discountPercent / 100)
      : offer.totalPriceNet;
    const netBeforeDiscountStr = formatPLN(netBeforeDiscount);

    const lineItemsSummary = items.map((it, idx) => {
      const dims = (it.widthMm && it.heightMm) ? ` (B=${it.widthMm}, H=${it.heightMm})` : "";
      const sys = it.systemName ? `${it.systemName} - ` : "";
      const itemTotalNet = (it.priceNet || 0) * (it.quantity || 1);
      return `${idx + 1}. ${sys}${it.name}${dims}\nIlość: ${it.quantity} szt. | Cena netto: ${formatPLN(it.priceNet)} | Wartość netto: ${formatPLN(itemTotalNet)}`;
    }).join("\n\n");

    const safeLastName = clientLastName.replace(/[/\\:*?"<>|]/g, "_") || "Klient";
    const safeOfferNumber = (offer.offerNumber || "ADK").replace(/[/\\:*?"<>|]/g, "_");
    const docCopyName = `Oferta_${safeOfferNumber}_${safeLastName}_temp_${Date.now()}`;

    // 4. Skopiuj szablon na Google Drive
    const copyData = await driveApiFetchWithRetry(
      ctx,
      `/files/${templateId}/copy?supportsAllDrives=true`,
      {
        method: "POST",
        body: JSON.stringify({
          name: docCopyName,
          parents: [targetFolderId],
        }),
      },
    );

    if (!copyData.id) {
      throw new Error("Kopiowanie szablonu Google nie powiodło się.");
    }
    const copyDocId = copyData.id;

    // 5. Przygotuj mapę obrazków CAD (rozwiązując ew. storageId na publiczne URL)
    const cadImageMap = new Map<number, string>();
    if (args.itemsCadImages) {
      for (const itemImg of args.itemsCadImages) {
        let resolvedUrl = itemImg.imageUrl;
        if (!resolvedUrl.startsWith("http")) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const fromStorage = await ctx.storage.getUrl(resolvedUrl as any);
            if (fromStorage) resolvedUrl = fromStorage;
          } catch (storageErr) {
            console.warn("[generateOfferPdf] storage.getUrl error:", storageErr);
          }
        }
        cadImageMap.set(itemImg.positionIndex, resolvedUrl);
      }
    }

    // 6. Sprawdź typ pliku szablonu (Google Docs vs Google Slides)
    let isPresentation = false;
    try {
      const fileMeta = await driveApiFetchWithRetry(
        ctx,
        `/files/${copyDocId}?fields=id,name,mimeType&supportsAllDrives=true`
      );
      if (fileMeta?.mimeType === "application/vnd.google-apps.presentation") {
        isPresentation = true;
      }
    } catch (metaErr) {
      console.warn("[generateOfferPdf] mimeType fetch error:", metaErr);
    }

    let processedAsSlides = false;
    if (isPresentation) {
      const presCheckRes = await fetch(`${SLIDES_API_BASE}/presentations/${copyDocId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!presCheckRes.ok) {
        const errText = await presCheckRes.text();
        console.warn(`[generateOfferPdf] Slides API fetch warning (${presCheckRes.status}): ${errText}`);
        if (presCheckRes.status === 403 || presCheckRes.status === 401) {
          throw new Error(
            `Brak uprawnień do edycji Prezentacji Google (status ${presCheckRes.status}). ` +
            `Twoje konto Google Drive w CRM wymaga odświeżenia uprawnień o Google Slides. ` +
            `Przejdź do: Ustawienia -> zakładka Google Drive, kliknij 'Rozłącz z Google Drive', a następnie 'Połącz z Google Drive', aby zatwierdzić dostęp do prezentacji.`
          );
        }
      } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const presentation = (await presCheckRes.json()) as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const slides: any[] = presentation.slides ?? [];

      if (slides.length > 0) {
        processedAsSlides = true;

        // Pomocnicza funkcja do wyciągania tekstu ze slajdu
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const extractSlideText = (slide: any): string => {
          let res = "";
          for (const el of slide.pageElements ?? []) {
            if (el.shape?.text?.textElements) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              for (const te of el.shape.text.textElements) {
                if (te.textRun?.content) res += te.textRun.content + " ";
              }
            }
            if (el.table?.tableRows) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              for (const row of el.table.tableRows) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                for (const cell of row.tableCells ?? []) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  for (const te of cell.text?.textElements ?? []) {
                    if (te.textRun?.content) res += te.textRun.content + " ";
                  }
                }
              }
            }
          }
          return res.toLowerCase();
        };

        // Znajdź slajd wzorcowy pozycji (zawierający markery konstrukcji lub szkicu)
        let itemTemplateIndex = slides.findIndex((s) => {
          const txt = extractSlideText(s);
          return (
            txt.includes("{{pozycja") ||
            txt.includes("{{nazwa") ||
            txt.includes("{{wymiary") ||
            txt.includes("pozycja") ||
            txt.includes("konstrukcja") ||
            txt.includes("szkic") ||
            txt.includes("pe68") ||
            txt.includes("drzwi")
          );
        });

        if (itemTemplateIndex === -1) {
          itemTemplateIndex = slides.length >= 2 ? 1 : 0;
        }

        const itemTemplateSlide = slides[itemTemplateIndex];

        // A. Duplikacja slajdów pozycji dla wielu konstrukcji w ofercie
        if (items.length > 1 && itemTemplateSlide?.objectId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const duplicateReqs: any[] = [];
          for (let i = 1; i < items.length; i++) {
            duplicateReqs.push({
              duplicateObject: {
                objectId: itemTemplateSlide.objectId,
              },
            });
          }

          if (duplicateReqs.length > 0) {
            const dupRes = await fetch(`${SLIDES_API_BASE}/presentations/${copyDocId}:batchUpdate`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ requests: duplicateReqs }),
            });
            if (!dupRes.ok) {
              console.warn("[generateOfferPdf] duplicateObject failed:", await dupRes.text());
            }
          }
        }

        // Pobierz odświeżoną strukturę prezentacji (ze zduplikowanymi slajdami i nowymi ID obiektów)
        const refreshedRes = await fetch(`${SLIDES_API_BASE}/presentations/${copyDocId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const refreshedPres = (await refreshedRes.json()) as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const refreshedSlides: any[] = refreshedPres.slides ?? slides;

        // Wyznacz slajdy odpowiadające poszczególnym pozycjom
        const positionSlides = refreshedSlides.slice(
          itemTemplateIndex,
          itemTemplateIndex + Math.max(1, items.length)
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textBatchRequests: any[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const imageBatchRequests: any[] = [];

        // B. Wypełnij parametry i szkice CAD dla każdej konstrukcji z osobna
        for (let idx = 0; idx < items.length; idx++) {
          const it = items[idx];
          const slide = positionSlides[idx] || positionSlides[0];
          const slideId = slide?.objectId;
          if (!slideId) continue;

          const itDims = it.widthMm && it.heightMm ? `B = ${it.widthMm} mm × H = ${it.heightMm} mm` : "";
          const itSys = it.systemName ? `${it.systemName} - ` : "";
          const itDesc = `${itSys}${it.name}${itDims ? `\n(${itDims})` : ""}`;
          const itTotalNet = (it.priceNet || 0) * (it.quantity || 1);

          const posReplacements: Array<{ placeholder: string; value: string }> = [
            { placeholder: "{{pozycja_nr}}", value: String(idx + 1) },
            { placeholder: "{{nr_pozycji}}", value: String(idx + 1) },
            { placeholder: "{{nazwa_konstrukcji}}", value: it.name || `Konstrukcja #${idx + 1}` },
            { placeholder: "{{nazwa}}", value: it.name || `Konstrukcja #${idx + 1}` },
            { placeholder: "{{opis_konstrukcji}}", value: it.description || itDesc },
            { placeholder: "{{opis}}", value: it.description || itDesc },
            { placeholder: "{{system}}", value: it.systemName || "" },
            { placeholder: "{{kolor}}", value: it.color || "" },
            { placeholder: "{{wymiary}}", value: itDims || `${it.widthMm} × ${it.heightMm}` },
            { placeholder: "{{szerokosc}}", value: `${it.widthMm} mm` },
            { placeholder: "{{wysokosc}}", value: `${it.heightMm} mm` },
            { placeholder: "{{szklenie}}", value: it.fillType || "" },
            { placeholder: "{{wypelnienie}}", value: it.fillType || "" },
            { placeholder: "{{ilosc}}", value: `${it.quantity} szt.` },
            { placeholder: "{{cena_netto}}", value: formatPLN(it.priceNet) },
            { placeholder: "{{wartosc_netto_pozycji}}", value: formatPLN(itTotalNet) },
            { placeholder: "{{uwagi_pozycji}}", value: it.notes || "" },

            // Wzorce specyficzne z oryginalnego wzorca:
            {
              placeholder: "PE68 - Drzwi otwierane na zewnątrz, klamka - klamka, szyba potrójna, RAL  7016\x0B(B=1 490, H=2 100)",
              value: itDesc,
            },
            {
              placeholder: "PE68 - Drzwi otwierane na zewnątrz, klamka - klamka, szyba potrójna, RAL  7016\u000b(B=1\u00a0490, H=2\u00a0100)",
              value: itDesc,
            },
            {
              placeholder: "6 997,11",
              value: formatPLN(itTotalNet).replace(" zł", ""),
            },
            {
              placeholder: "6\u00a0997,11",
              value: formatPLN(itTotalNet).replace(" zł", ""),
            },
          ];

          for (const rep of posReplacements) {
            textBatchRequests.push({
              replaceAllText: {
                containsText: {
                  text: rep.placeholder,
                  matchCase: false,
                },
                replaceText: rep.value,
                pageObjectIds: [slideId],
              },
            });
          }

          // Podmiana / wstawienie obrazka szkicu CAD dla danej konstrukcji
          const cadImgUrl = cadImageMap.get(it.positionIndex) ?? cadImageMap.get(idx + 1);
          if (cadImgUrl) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pageElements: any[] = slide.pageElements ?? [];

            // Szukamy obrazka do podmiany (replaceImage)
            const existingImageEl = pageElements.find((el) => Boolean(el.image));

            if (existingImageEl) {
              imageBatchRequests.push({
                replaceImage: {
                  imageObjectId: existingImageEl.objectId,
                  url: cadImgUrl,
                  imageReplaceMethod: "CENTER_INSIDE",
                },
              });
            } else {
              // Jeśli nie ma obrazka, szukamy prostokąta/kształtu ze słowem szkic lub cad
              const placeholderShape = pageElements.find((el) => {
                let shapeTxt = "";
                if (el.shape?.text?.textElements) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  for (const te of el.shape.text.textElements) {
                    if (te.textRun?.content) shapeTxt += te.textRun.content + " ";
                  }
                }
                return (
                  shapeTxt.toLowerCase().includes("szkic") ||
                  shapeTxt.toLowerCase().includes("cad") ||
                  shapeTxt.toLowerCase().includes("rysunek")
                );
              });

              if (placeholderShape?.size && placeholderShape?.transform) {
                imageBatchRequests.push({
                  deleteObject: { objectId: placeholderShape.objectId },
                });
                imageBatchRequests.push({
                  createImage: {
                    url: cadImgUrl,
                    elementProperties: {
                      pageObjectId: slideId,
                      size: placeholderShape.size,
                      transform: placeholderShape.transform,
                    },
                  },
                });
              } else {
                imageBatchRequests.push({
                  createImage: {
                    url: cadImgUrl,
                    elementProperties: {
                      pageObjectId: slideId,
                      size: {
                        width: { magnitude: 380, unit: "PT" },
                        height: { magnitude: 260, unit: "PT" },
                      },
                      transform: {
                        scaleX: 1,
                        scaleY: 1,
                        translateX: 40,
                        translateY: 90,
                        unit: "PT",
                      },
                    },
                  },
                });
              }
            }
          }
        }

        // C. Podstaw ogólne dane oferty i klienta w całej prezentacji (okładka, stopka, podsumowanie)
        const globalReplacements: Array<{ placeholder: string; value: string }> = [
          // Różne warianty tagu klienta
          { placeholder: "{{klient}}", value: clientFullName },
          { placeholder: "{{KLIENT}}", value: clientFullName },
          { placeholder: "{{Klient}}", value: clientFullName },
          { placeholder: "{{ klient }}", value: clientFullName },
          { placeholder: "{{ KLIENT }}", value: clientFullName },
          { placeholder: "{{ Klient }}", value: clientFullName },
          { placeholder: "{{client}}", value: clientFullName },
          { placeholder: "{{clientName}}", value: clientFullName },
          { placeholder: "{{imie}}", value: clientFirstName },
          { placeholder: "{{nazwisko}}", value: clientLastName },
          { placeholder: "{{telefon}}", value: clientPhone },
          { placeholder: "{{phone}}", value: clientPhone },
          { placeholder: "{{email}}", value: clientEmail },
          { placeholder: "{{miasto}}", value: clientCity },
          { placeholder: "{{city}}", value: clientCity },
          { placeholder: "{{ulica}}", value: clientStreet },
          { placeholder: "{{street}}", value: clientStreet },
          { placeholder: "{{kod_pocztowy}}", value: clientPostalCode },
          { placeholder: "{{postalCode}}", value: clientPostalCode },
          { placeholder: "{{adres}}", value: clientAddress },
          { placeholder: "{{address}}", value: clientAddress },
          { placeholder: "{{numer_oferty}}", value: offer.offerNumber || "" },
          { placeholder: "{{offerNumber}}", value: offer.offerNumber || "" },
          { placeholder: "{{tytul_oferty}}", value: offer.title || "" },
          { placeholder: "{{data}}", value: todayStr },
          { placeholder: "{{today}}", value: todayStr },
          { placeholder: "{{dzisiaj}}", value: todayStr },
          { placeholder: "{{wartosc_netto}}", value: totalNetStr },
          { placeholder: "{{totalNet}}", value: totalNetStr },
          { placeholder: "{{wartosc_brutto}}", value: totalGrossStr },
          { placeholder: "{{totalGross}}", value: totalGrossStr },
          { placeholder: "{{wartość zamówienia netto}}", value: totalNetStr },
          { placeholder: "{{wartość zamówienia brutto}}", value: totalGrossStr },
          { placeholder: "{{rabat}}", value: discountPctStr },
          { placeholder: "{{discount}}", value: discountPctStr },
          { placeholder: "{{wartosc_przed_rabatem}}", value: netBeforeDiscountStr },
          { placeholder: "{{uwagi}}", value: offer.notes || "" },
          { placeholder: "{{notes}}", value: offer.notes || "" },
          { placeholder: "{{warunki}}", value: offer.terms || "" },
          { placeholder: "{{lineItemsList}}", value: lineItemsSummary },
          { placeholder: "{{pozycje}}", value: lineItemsSummary },

          // Wzorce finansowe ze wzorca:
          {
            placeholder: "RAZEM =  6 497.69zł netto + 23%VAT =7 992.15 zł brutto",
            value: `RAZEM =  ${totalNetStr} netto + 23%VAT = ${totalGrossStr} brutto`,
          },
          {
            placeholder: "6 997,11 - 20%RABAT = 5 597,69",
            value: `${netBeforeDiscountStr} - ${discountPctStr}RABAT = ${totalNetStr}`,
          },
          {
            placeholder: "6\u00a0997,11 - 20%RABAT = 5\u00a0597,69",
            value: `${netBeforeDiscountStr} - ${discountPctStr}RABAT = ${totalNetStr}`,
          },
          {
            placeholder: "W przypadku potrzeby uzyskania kontroli dostępu: + 200 zł netto",
            value: offer.notes ? offer.notes : "",
          },
        ];

        // 1. Dodaj globalne podstawienia tekstu dla całej prezentacji
        for (const rep of globalReplacements) {
          textBatchRequests.push({
            replaceAllText: {
              containsText: {
                text: rep.placeholder,
                matchCase: false,
              },
              replaceText: rep.value,
            },
          });
        }

        // 2. Jeśli tekst znajduje się we wzorcu lub układzie slajdu (masters / layouts), podmień także tam
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const layoutMasterIds = [
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(refreshedPres.masters ?? []).map((m: any) => m.objectId),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(refreshedPres.layouts ?? []).map((l: any) => l.objectId),
        ].filter(Boolean);

        for (const lmId of layoutMasterIds) {
          textBatchRequests.push({
            replaceAllText: {
              containsText: {
                text: "{{klient}}",
                matchCase: false,
              },
              replaceText: clientFullName,
              pageObjectIds: [lmId],
            },
          });
          textBatchRequests.push({
            replaceAllText: {
              containsText: {
                text: "{{numer_oferty}}",
                matchCase: false,
              },
              replaceText: offer.offerNumber || "",
              pageObjectIds: [lmId],
            },
          });
          textBatchRequests.push({
            replaceAllText: {
              containsText: {
                text: "{{data}}",
                matchCase: false,
              },
              replaceText: todayStr,
              pageObjectIds: [lmId],
            },
          });
        }

        // KROK 1: Wyślij batch podstawiania tekstów
        if (textBatchRequests.length > 0) {
          const textBatchRes = await fetch(`${SLIDES_API_BASE}/presentations/${copyDocId}:batchUpdate`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ requests: textBatchRequests }),
          });

          if (!textBatchRes.ok) {
            const errBody = await textBatchRes.text();
            console.error(`[generateOfferPdf] Slides text batchUpdate error (${textBatchRes.status}): ${errBody}`);
            throw new Error(`Błąd podstawiania tekstów w Prezentacji Google (${textBatchRes.status}): ${errBody}`);
          }
        }

        // KROK 2: Wyślij batch operacji graficznych w osobnym kroku (odporny na błędy)
        if (imageBatchRequests.length > 0) {
          try {
            const imgBatchRes = await fetch(`${SLIDES_API_BASE}/presentations/${copyDocId}:batchUpdate`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ requests: imageBatchRequests }),
            });
            if (!imgBatchRes.ok) {
              const imgErrBody = await imgBatchRes.text();
              console.warn(`[generateOfferPdf] Slides image batchUpdate warning (${imgBatchRes.status}): ${imgErrBody}`);
            }
          } catch (imgErr) {
            console.warn("[generateOfferPdf] Slides image batchUpdate network error:", imgErr);
          }
        }
      }
    }
  }

    // 7. Aktualizacja szablonu Google Docs (jeśli szablon nie był prezentacją Slides)
    if (!processedAsSlides) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const findTextRangeInDoc = (doc: any, target: string): { startIndex: number; endIndex: number } | null => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const scanContent = (contentList: any[]): { startIndex: number; endIndex: number } | null => {
            if (!Array.isArray(contentList)) return null;
            for (const elem of contentList) {
              if (elem.paragraph?.elements) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                for (const pe of elem.paragraph.elements) {
                  const text = pe.textRun?.content;
                  if (text && text.includes(target)) {
                    const offset = text.indexOf(target);
                    const elemStart = pe.startIndex ?? 0;
                    return {
                      startIndex: elemStart + offset,
                      endIndex: elemStart + offset + target.length,
                    };
                  }
                }
              } else if (elem.table?.tableRows) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                for (const row of elem.table.tableRows) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  for (const cell of row.tableCells ?? []) {
                    const res = scanContent(cell.content ?? []);
                    if (res) return res;
                  }
                }
              }
            }
            return null;
          };
          return scanContent(doc.body?.content ?? []);
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const findAllTextRangesInDoc = (doc: any, target: string): Array<{ startIndex: number; endIndex: number }> => {
          const results: Array<{ startIndex: number; endIndex: number }> = [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const scanContent = (contentList: any[]) => {
            if (!Array.isArray(contentList)) return;
            for (const elem of contentList) {
              if (elem.paragraph?.elements) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                for (const pe of elem.paragraph.elements) {
                  const text = pe.textRun?.content;
                  if (text && text.includes(target)) {
                    let searchStart = 0;
                    while (true) {
                      const idx = text.indexOf(target, searchStart);
                      if (idx === -1) break;
                      const elemStart = pe.startIndex ?? 0;
                      results.push({
                        startIndex: elemStart + idx,
                        endIndex: elemStart + idx + target.length,
                      });
                      searchStart = idx + target.length;
                    }
                  }
                }
              } else if (elem.table?.tableRows) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                for (const row of elem.table.tableRows) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  for (const cell of row.tableCells ?? []) {
                    scanContent(cell.content ?? []);
                  }
                }
              }
            }
          };
          scanContent(doc.body?.content ?? []);
          return results;
        };

        const docReplacements: Array<{ placeholder: string; value: string }> = [
          // Różne warianty tagu klienta
          { placeholder: "{{klient}}", value: clientFullName },
          { placeholder: "{{KLIENT}}", value: clientFullName },
          { placeholder: "{{Klient}}", value: clientFullName },
          { placeholder: "{{ klient }}", value: clientFullName },
          { placeholder: "{{ KLIENT }}", value: clientFullName },
          { placeholder: "{{ Klient }}", value: clientFullName },
          { placeholder: "{{client}}", value: clientFullName },
          { placeholder: "{{clientName}}", value: clientFullName },
          { placeholder: "{{imie}}", value: clientFirstName },
          { placeholder: "{{nazwisko}}", value: clientLastName },
          { placeholder: "{{telefon}}", value: clientPhone },
          { placeholder: "{{phone}}", value: clientPhone },
          { placeholder: "{{email}}", value: clientEmail },
          { placeholder: "{{miasto}}", value: clientCity },
          { placeholder: "{{city}}", value: clientCity },
          { placeholder: "{{ulica}}", value: clientStreet },
          { placeholder: "{{street}}", value: clientStreet },
          { placeholder: "{{kod_pocztowy}}", value: clientPostalCode },
          { placeholder: "{{postalCode}}", value: clientPostalCode },
          { placeholder: "{{adres}}", value: clientAddress },
          { placeholder: "{{address}}", value: clientAddress },
          { placeholder: "{{numer_oferty}}", value: offer.offerNumber || "" },
          { placeholder: "{{numer oferty}}", value: offer.offerNumber || "" },
          { placeholder: "{{nr_oferty}}", value: offer.offerNumber || "" },
          { placeholder: "{{offerNumber}}", value: offer.offerNumber || "" },
          { placeholder: "{{tytul_oferty}}", value: offer.title || "" },
          { placeholder: "{{data}}", value: todayStr },
          { placeholder: "{{dzisiaj}}", value: todayStr },
          { placeholder: "{{today}}", value: todayStr },
          { placeholder: "{{date}}", value: todayStr },
          { placeholder: "{{wartosc_netto}}", value: totalNetStr },
          { placeholder: "{{totalNet}}", value: totalNetStr },
          { placeholder: "{{wartosc_brutto}}", value: totalGrossStr },
          { placeholder: "{{totalGross}}", value: totalGrossStr },
          { placeholder: "{{wartość zamówienia netto}}", value: totalNetStr },
          { placeholder: "{{wartość zamówienia brutto}}", value: totalGrossStr },
          { placeholder: "{{rabat}}", value: discountPctStr },
          { placeholder: "{{discount}}", value: discountPctStr },
          { placeholder: "{{wartosc_przed_rabatem}}", value: netBeforeDiscountStr },
          { placeholder: "{{uwagi}}", value: offer.notes || "" },
          { placeholder: "{{notes}}", value: offer.notes || "" },
          { placeholder: "{{warunki}}", value: offer.terms || "" },
          { placeholder: "{{lineItemsList}}", value: lineItemsSummary },
          { placeholder: "{{pozycje}}", value: lineItemsSummary },

          // Wzorce finansowe ze wzorca 1XJnz47VXgNXFrOagFj7JiFxcmesIFWQAkQXS7ckc-6Y:
          {
            placeholder: "RAZEM =  6 497.69zł netto + 23%VAT =7 992.15 zł brutto",
            value: `RAZEM =  ${totalNetStr} netto + 23%VAT = ${totalGrossStr} brutto`,
          },
          {
            placeholder: "6 997,11 - 20%RABAT = 5 597,69",
            value: `${netBeforeDiscountStr} - ${discountPctStr}RABAT = ${totalNetStr}`,
          },
          {
            placeholder: "6\u00a0997,11 - 20%RABAT = 5\u00a0597,69",
            value: `${netBeforeDiscountStr} - ${discountPctStr}RABAT = ${totalNetStr}`,
          },
          {
            placeholder: "W przypadku potrzeby uzyskania kontroli dostępu: + 200 zł netto",
            value: offer.notes ? offer.notes : "",
          },
          {
            placeholder: "PE68 - Drzwi otwierane na zewnątrz, klamka - klamka, szyba potrójna, RAL  7016\x0B(B=1 490, H=2 100)",
            value: lineItemsSummary || "",
          },
          {
            placeholder: "PE68 - Drzwi otwierane na zewnątrz, klamka - klamka, szyba potrójna, RAL  7016",
            value: lineItemsSummary || "",
          },
        ];

        // Dodaj indywidualne znaczniki rysunków (np. {{rysunek_1}}) jeśli użytkownik używa sztywnego szablonu
        for (let i = 0; i < items.length; i++) {
          const posIdx = items[i].positionIndex;
          docReplacements.push({
            placeholder: `{{rysunek_${posIdx}}}`,
            value: `{{__cad_img_${posIdx}__}}`,
          });
          docReplacements.push({
            placeholder: `{{rysunek_${i + 1}}}`,
            value: `{{__cad_img_${posIdx}__}}`,
          });
        }

        const docRequests = docReplacements.map((rep) => ({
          replaceAllText: {
            containsText: { text: rep.placeholder, matchCase: false },
            replaceText: rep.value,
          },
        }));

        const docRes = await fetch(`${DOCS_API_BASE}/documents/${copyDocId}:batchUpdate`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ requests: docRequests }),
        });
        if (!docRes.ok) {
          const errBody = await docRes.text();
          console.error(`[generateOfferPdf] Docs batchUpdate error (${docRes.status}): ${errBody}`);
          throw new Error(`Błąd aktualizacji dokumentu Google Docs (${docRes.status}): ${errBody}`);
        }

        // KROK 7a: Obsługa sekcji {{pozycje_cad}} w układzie 3-kolumnowym (Tabela zgodna z układem ofert)
        const currentDocRes = await fetch(`${DOCS_API_BASE}/documents/${copyDocId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (currentDocRes.ok) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const currentDoc = (await currentDocRes.json()) as any;
          const cadTagAliases = [
            "{{pozycje_cad}}",
            "{{POZYCJE_CAD}}",
            "{{ pozycje_cad }}",
            "{{konstrukcje_cad}}",
            "{{rysunki_cad}}",
          ];

          let foundCadTag: { startIndex: number; endIndex: number; tag: string } | null = null;
          for (const alias of cadTagAliases) {
            const range = findTextRangeInDoc(currentDoc, alias);
            if (range) {
              foundCadTag = { ...range, tag: alias };
              break;
            }
          }

          if (foundCadTag) {
            if (items.length === 0) {
              await fetch(`${DOCS_API_BASE}/documents/${copyDocId}:batchUpdate`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  requests: [
                    {
                      deleteContentRange: {
                        range: {
                          startIndex: foundCadTag.startIndex,
                          endIndex: foundCadTag.endIndex,
                        },
                      },
                    },
                    {
                      insertText: {
                        location: { index: foundCadTag.startIndex },
                        text: "Brak pozycji konstrukcji w ofercie.",
                      },
                    },
                  ],
                }),
              });
            } else {
              // 1. Usuń znacznik {{pozycje_cad}} i wstaw tabelę o N wierszach i 3 kolumnach
              const tableInsertRes = await fetch(`${DOCS_API_BASE}/documents/${copyDocId}:batchUpdate`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  requests: [
                    {
                      deleteContentRange: {
                        range: {
                          startIndex: foundCadTag.startIndex,
                          endIndex: foundCadTag.endIndex,
                        },
                      },
                    },
                    {
                      insertTable: {
                        rows: items.length,
                        columns: 3,
                        location: { index: foundCadTag.startIndex },
                      },
                    },
                  ],
                }),
              });

              if (tableInsertRes.ok) {
                // 2. Pobierz odświeżony dokument, aby poznać dokładne pozycje komórek tabeli
                const postTableDocRes = await fetch(`${DOCS_API_BASE}/documents/${copyDocId}`, {
                  headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (postTableDocRes.ok) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const postTableDoc = (await postTableDocRes.json()) as any;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const tableElem = postTableDoc.body?.content?.find(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (el: any) =>
                      el.table &&
                      el.startIndex >= foundCadTag!.startIndex &&
                      el.startIndex <= foundCadTag!.startIndex + 5
                  );

                  if (tableElem?.table?.tableRows) {
                    // Stylizuj tabelę: przezroczyste obramowania góra/lewo/prawo, delikatna linia na dole, padding
                    try {
                      await fetch(`${DOCS_API_BASE}/documents/${copyDocId}:batchUpdate`, {
                        method: "POST",
                        headers: {
                          Authorization: `Bearer ${accessToken}`,
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          requests: [
                            {
                              updateTableCellStyle: {
                                tableStartLocation: { index: tableElem.startIndex },
                                tableCellStyle: {
                                  borderTop: {
                                    color: { color: { rgbColor: { red: 1, green: 1, blue: 1 } } },
                                    width: { magnitude: 0, unit: "PT" },
                                    dashStyle: "SOLID",
                                  },
                                  borderLeft: {
                                    color: { color: { rgbColor: { red: 1, green: 1, blue: 1 } } },
                                    width: { magnitude: 0, unit: "PT" },
                                    dashStyle: "SOLID",
                                  },
                                  borderRight: {
                                    color: { color: { rgbColor: { red: 1, green: 1, blue: 1 } } },
                                    width: { magnitude: 0, unit: "PT" },
                                    dashStyle: "SOLID",
                                  },
                                  borderBottom: {
                                    color: { color: { rgbColor: { red: 0.85, green: 0.85, blue: 0.85 } } },
                                    width: { magnitude: 0.5, unit: "PT" },
                                    dashStyle: "SOLID",
                                  },
                                  paddingTop: { magnitude: 12, unit: "PT" },
                                  paddingBottom: { magnitude: 12, unit: "PT" },
                                  paddingLeft: { magnitude: 6, unit: "PT" },
                                  paddingRight: { magnitude: 6, unit: "PT" },
                                },
                                fields: "borderTop,borderLeft,borderRight,borderBottom,paddingTop,paddingBottom,paddingLeft,paddingRight",
                              },
                            },
                            {
                              updateTableColumnProperties: {
                                tableStartLocation: { index: tableElem.startIndex },
                                columnIndices: [0],
                                tableColumnProperties: {
                                  widthType: "FIXED_WIDTH",
                                  width: { magnitude: 175, unit: "PT" },
                                },
                                fields: "width,widthType",
                              },
                            },
                            {
                              updateTableColumnProperties: {
                                tableStartLocation: { index: tableElem.startIndex },
                                columnIndices: [1],
                                tableColumnProperties: {
                                  widthType: "FIXED_WIDTH",
                                  width: { magnitude: 185, unit: "PT" },
                                },
                                fields: "width,widthType",
                              },
                            },
                            {
                              updateTableColumnProperties: {
                                tableStartLocation: { index: tableElem.startIndex },
                                columnIndices: [2],
                                tableColumnProperties: {
                                  widthType: "FIXED_WIDTH",
                                  width: { magnitude: 120, unit: "PT" },
                                },
                                fields: "width,widthType",
                              },
                            },
                          ],
                        }),
                      });
                    } catch (styleErr) {
                      console.warn("[generateOfferPdf] Table styling warning:", styleErr);
                    }

                    // Wypełnij komórki od najwyższego indeksu do najniższego (descending order),
                    // co gwarantuje 100% spójność indeksów znakowych w Docs API.
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const cellRequests: any[] = [];
                    const rows = tableElem.table.tableRows;
                    const formatDim = (mm: number) => mm.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

                    for (let rIdx = rows.length - 1; rIdx >= 0; rIdx--) {
                      const it = items[rIdx];
                      if (!it) continue;
                      const row = rows[rIdx];
                      const cell0 = row.tableCells?.[0];
                      const cell1 = row.tableCells?.[1];
                      const cell2 = row.tableCells?.[2];

                      const c0Start = cell0?.content?.[0]?.paragraph?.elements?.[0]?.startIndex;
                      const c1Start = cell1?.content?.[0]?.paragraph?.elements?.[0]?.startIndex;
                      const c2Start = cell2?.content?.[0]?.paragraph?.elements?.[0]?.startIndex;

                      const num = it.positionIndex || rIdx + 1;
                      const itemTotalNet = (it.priceNet || 0) * (it.quantity || 1);

                      // 1. Prawa kolumna: Ceny
                      if (typeof c2Start === "number") {
                        const rightText = `Cena za sztukę netto:\n${formatPLN(it.priceNet)}\n\nWartość netto:\n${formatPLN(itemTotalNet)}`;
                        cellRequests.push({
                          insertText: {
                            location: { index: c2Start },
                            text: rightText,
                          },
                        });
                      }

                      // 2. Środkowa kolumna: Rysunek CAD
                      if (typeof c1Start === "number") {
                        const cadUrl = cadImageMap.get(it.positionIndex) || cadImageMap.get(rIdx + 1);
                        if (cadUrl) {
                          cellRequests.push({
                            insertInlineImage: {
                              location: { index: c1Start },
                              uri: cadUrl,
                              objectSize: {
                                width: { magnitude: 180, unit: "PT" },
                                height: { magnitude: 135, unit: "PT" },
                              },
                            },
                          });
                        } else {
                          cellRequests.push({
                            insertText: {
                              location: { index: c1Start },
                              text: "[Szkic CAD konstrukcji]",
                            },
                          });
                        }
                      }

                      // 3. Lewa kolumna: Pozycja, Konstrukcja, Wymiary, Opis techniczny, Ilość
                      if (typeof c0Start === "number") {
                        const sysPrefix = it.systemName ? `${it.systemName} - ` : "";
                        const title = `${sysPrefix}${it.name}`;
                        const dimsStr = (it.widthMm && it.heightMm)
                          ? `(B=${formatDim(it.widthMm)}, H=${formatDim(it.heightMm)})`
                          : "";

                        // Pobierz pole "Opis techniczny" z parametrów konstrukcji (item.description)
                        const techDesc = it.description?.trim();
                        const descSection = techDesc ? `\n\nOpis techniczny:\n${techDesc}` : "";

                        const leftText = `${num}\n\nKonstrukcja:\n${title}${dimsStr ? "\n" + dimsStr : ""}${descSection}\n\nIlość: ${it.quantity || 1}`;
                        cellRequests.push({
                          insertText: {
                            location: { index: c0Start },
                            text: leftText,
                          },
                        });
                      }
                    }

                    if (cellRequests.length > 0) {
                      const populateRes = await fetch(`${DOCS_API_BASE}/documents/${copyDocId}:batchUpdate`, {
                        method: "POST",
                        headers: {
                          Authorization: `Bearer ${accessToken}`,
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ requests: cellRequests }),
                      });
                      if (!populateRes.ok) {
                        console.warn("[generateOfferPdf] Populating CAD table warning:", await populateRes.text());
                      } else {
                        // 3. Po wstawieniu tekstu, pobierz dokument i wyboldowane etykiety: Konstrukcja:, Opis techniczny:, Ilość: itd.
                        try {
                          const postPopulateDocRes = await fetch(`${DOCS_API_BASE}/documents/${copyDocId}`, {
                            headers: { Authorization: `Bearer ${accessToken}` },
                          });
                          if (postPopulateDocRes.ok) {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const postPopulateDoc = (await postPopulateDocRes.json()) as any;
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const boldRequests: any[] = [];
                            const boldLabels = [
                              "Konstrukcja:",
                              "Opis techniczny:",
                              "Ilość:",
                              "Cena za sztukę netto:",
                              "Wartość netto:",
                            ];

                            for (const label of boldLabels) {
                              const ranges = findAllTextRangesInDoc(postPopulateDoc, label);
                              for (const r of ranges) {
                                boldRequests.push({
                                  updateTextStyle: {
                                    range: { startIndex: r.startIndex, endIndex: r.endIndex },
                                    textStyle: { bold: true },
                                    fields: "bold",
                                  },
                                });
                              }
                            }

                            // Wyboldowanie i powiększenie numerów pozycji (np. 1, 2, 3...)
                            const populatedTable = postPopulateDoc.body?.content?.find(
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              (el: any) =>
                                el.table &&
                                el.startIndex >= foundCadTag!.startIndex &&
                                el.startIndex <= foundCadTag!.startIndex + 5
                            );
                            if (populatedTable?.table?.tableRows) {
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              for (let rowIdx = 0; rowIdx < populatedTable.table.tableRows.length; rowIdx++) {
                                const rowEl = populatedTable.table.tableRows[rowIdx];
                                const itm = items[rowIdx];
                                const numStr = String(itm?.positionIndex || rowIdx + 1);
                                const c0Start = rowEl.tableCells?.[0]?.content?.[0]?.paragraph?.elements?.[0]?.startIndex;
                                if (typeof c0Start === "number") {
                                  boldRequests.push({
                                    updateTextStyle: {
                                      range: { startIndex: c0Start, endIndex: c0Start + numStr.length },
                                      textStyle: { bold: true, fontSize: { magnitude: 13, unit: "PT" } },
                                      fields: "bold,fontSize",
                                    },
                                  });
                                }
                              }
                            }

                            if (boldRequests.length > 0) {
                              await fetch(`${DOCS_API_BASE}/documents/${copyDocId}:batchUpdate`, {
                                method: "POST",
                                headers: {
                                  Authorization: `Bearer ${accessToken}`,
                                  "Content-Type": "application/json",
                                },
                                body: JSON.stringify({ requests: boldRequests }),
                              });
                            }
                          }
                        } catch (boldErr) {
                          console.warn("[generateOfferPdf] Bold styling warning:", boldErr);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // KROK 7b: Podstawienie rysunków CAD w miejsca {{__cad_img_X__}} (dla niestandardowych szablonów z ręcznymi tagami)
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          const tag = `{{__cad_img_${it.positionIndex}__}}`;
          const cadUrl = cadImageMap.get(it.positionIndex) || cadImageMap.get(i + 1);

          try {
            const currentDocRes2 = await fetch(`${DOCS_API_BASE}/documents/${copyDocId}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!currentDocRes2.ok) break;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const currentDoc2 = (await currentDocRes2.json()) as any;
            const foundRange = findTextRangeInDoc(currentDoc2, tag);

            if (foundRange) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const imageRequests: any[] = [
                {
                  deleteContentRange: {
                    range: {
                      startIndex: foundRange.startIndex,
                      endIndex: foundRange.endIndex,
                    },
                  },
                },
              ];

              if (cadUrl) {
                imageRequests.push({
                  insertInlineImage: {
                    location: {
                      index: foundRange.startIndex,
                    },
                    uri: cadUrl,
                    objectSize: {
                      width: { magnitude: 450, unit: "PT" },
                      height: { magnitude: 275, unit: "PT" },
                    },
                  },
                });
              }

              const imgUpdateRes = await fetch(`${DOCS_API_BASE}/documents/${copyDocId}:batchUpdate`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ requests: imageRequests }),
              });
              if (!imgUpdateRes.ok) {
                const imgErr = await imgUpdateRes.text();
                console.warn(`[generateOfferPdf] Docs image insert warning for position #${it.positionIndex}:`, imgErr);
              }
            }
          } catch (itemImgErr) {
            console.warn(`[generateOfferPdf] Error inserting CAD image for position #${it.positionIndex}:`, itemImgErr);
          }
        }
      } catch (docErr) {
        console.warn("[generateOfferPdf] Docs batchUpdate warning:", docErr);
        throw docErr;
      }
    }

    // 8. Eksportuj do PDF
    const exportUrl = `${DRIVE_API_BASE}/files/${copyDocId}/export?mimeType=application/pdf&supportsAllDrives=true`;
    const exportRes = await fetch(exportUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!exportRes.ok) {
      const errText = await exportRes.text();
      throw new Error(`Eksport oferty do formatu PDF nie powiódł się (${exportRes.status}): ${errText}`);
    }
    const pdfBuffer = await exportRes.arrayBuffer();

    // 9. Wgraj plik PDF do folderu "Oferty - wysłane do Klienta"
    const pdfFileName = `Oferta_${safeOfferNumber}_${safeLastName}.pdf`;
    const uploadedPdf = await uploadBufferToDrive(
      accessToken,
      pdfBuffer,
      pdfFileName,
      "application/pdf",
      targetFolderId,
    );

    // 10. Usuń tymczasowy plik roboczy z Drive
    try {
      await fetch(`${DRIVE_API_BASE}/files/${copyDocId}?supportsAllDrives=true`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ trashed: true }),
      });
    } catch (trashErr) {
      console.warn("[generateOfferPdf] cleanup temp presentation failed:", trashErr);
    }

    // 11. Zarejestruj plik PDF w szansie sprzedaży
    try {
      await ctx.runMutation(internal.salesOpportunities.addDriveProjectFile, {
        opportunityId: opportunity._id,
        name: pdfFileName,
        url: uploadedPdf.url,
      });
    } catch (dbErr) {
      console.warn("[generateOfferPdf] addDriveProjectFile error:", dbErr);
    }

    // 12. Zapisz URL PDF na dokumencie oferty (trwały link do CTA)
    try {
      await ctx.runMutation(internal.offers.setOfferLastPdfUrl, {
        offerId: args.offerId,
        pdfUrl: uploadedPdf.url,
      });
    } catch (pdfUrlErr) {
      console.warn("[generateOfferPdf] setOfferLastPdfUrl error:", pdfUrlErr);
    }

    return {
      pdfUrl: uploadedPdf.url,
      fileId: uploadedPdf.fileId,
      fileName: pdfFileName,
      folderUrl: `https://drive.google.com/drive/folders/${targetFolderId}`,
    };
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
      const result = await uploadFileToDrive(ctx, fileUrl, uploadFolderId!);
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
          let downloadUrl = url;
          const isStorageId = !url.startsWith("http://") && !url.startsWith("https://");
          if (isStorageId) {
            const resolvedUrl = await ctx.storage.getUrl(url);
            if (!resolvedUrl) {
              await log("error", "File URL not found in storage", { storageId: url });
              failed++;
              continue;
            }
            downloadUrl = resolvedUrl;
          }

          const result = await uploadFileToDrive(ctx, downloadUrl, valuationFilesFolderId, {
            jotformApiKey: !isStorageId ? await getJotformApiKeyForActions(ctx) : null,
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
    orderId: v.optional(v.id("orders")),
    clientId: v.optional(v.id("clients")),
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
    orderId: v.optional(v.id("orders")),
    clientId: v.optional(v.id("clients")),
    complaintId: v.optional(v.id("complaints")),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.optional(v.string()),
    targetFolderId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ fileId: string; name: string; url: string }> => {
    await requireUserIdentifierInAction(ctx);

    let orderFolderId: string | undefined = args.targetFolderId;

    if (!orderFolderId && args.complaintId) {
      const complaint = await ctx.runQuery(api.complaints.getById, { complaintId: args.complaintId });
      if (complaint?.complaintFolderId) {
        orderFolderId = complaint.complaintFolderId;
      }
    }

    const connection = await getAuthorizedConnection(ctx);
    const { accessToken } = connection;

    if (!orderFolderId) {
      if (args.orderId) {
        const order = await ctx.runQuery(api.orders.getById, { orderId: args.orderId });
        if (!order) throw new Error("Zlecenie nie znalezione");
        if (order.folderId) {
          // Find or create "Reklamacja" subfolder in order folder
          orderFolderId = await findOrCreateDriveFolder(accessToken, "Reklamacja", order.folderId);
        }
      }
      if (!orderFolderId && args.clientId) {
        const client = await ctx.runQuery(api.clients.getById, { clientId: args.clientId });
        if (!client) throw new Error("Klient nie znaleziony");
        if (client.clientFolderId) {
          orderFolderId = await findOrCreateDriveFolder(accessToken, "Reklamacja", client.clientFolderId);
        }
      }
    }

    if (!orderFolderId) {
      throw new Error("Nie można ustalić docelowego folderu Google Drive dla plików reklamacji.");
    }


    const fileUrl = await ctx.storage.getUrl(args.storageId);
    if (!fileUrl) throw new Error("Nie znaleziono pliku w storage");

    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) throw new Error(`Nie udało się pobrać pliku: ${fileResponse.status}`);

    const contentType = args.mimeType || fileResponse.headers.get("content-type") || "application/octet-stream";
    const fileBuffer = await fileResponse.arrayBuffer();

    const metadata = JSON.stringify({ name: args.fileName, parents: [orderFolderId] });

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

export const listFolderContentsByPin = action({
  args: {
    pin: v.string(),
    folderId: v.string(),
  },
  handler: async (ctx, args): Promise<Array<{
    id: string;
    name: string;
    isFolder: boolean;
    url?: string;
    mimeType?: string;
  }>> => {
    const cleanPin = args.pin.trim();
    const teams = (await ctx.runQuery(api.installationTeams.listAll, {})) as Array<{ isActive: boolean; pin?: string }>;
    const team = teams.find((t) => t.isActive && t.pin === cleanPin);
    if (!team) {
      throw new Error("Nieprawidłowy PIN ekipy.");
    }

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

export const uploadFileByPin = action({
  args: {
    pin: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.optional(v.string()),
    targetFolderId: v.string(),
  },
  handler: async (ctx, args): Promise<{ fileId: string; name: string; url: string }> => {
    const cleanPin = args.pin.trim();
    const teams = (await ctx.runQuery(api.installationTeams.listAll, {})) as Array<{ isActive: boolean; pin?: string }>;
    const team = teams.find((t) => t.isActive && t.pin === cleanPin);
    if (!team) {
      throw new Error("Nieprawidłowy PIN ekipy.");
    }

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

export const createOpportunityFolder = action({
  args: {
    opportunityId: v.id("pendingJotformSubmissions"),
    parentFolderId: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args): Promise<{ id: string; url: string }> => {
    const performedBy = await requireUserIdentifierInAction(ctx);

    const opp = await ctx.runQuery(api.salesOpportunities.getSalesOpportunity, {
      opportunityId: args.opportunityId,
    });
    if (!opp) throw new Error("Szansa sprzedaży nie znaleziona");

    const connection = await getAuthorizedConnection(ctx);
    const accessToken = connection.accessToken;

    const createRes = await fetch(`${DRIVE_API_BASE}/files?supportsAllDrives=true`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: args.name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [args.parentFolderId],
      }),
    });

    if (!createRes.ok) {
      const errorBody = await createRes.text();
      throw new Error(`Nie udało się utworzyć folderu Drive: ${createRes.status} - ${errorBody}`);
    }

    const folder = await createRes.json() as { id?: string };
    if (!folder.id) throw new Error("Drive nie zwróciło ID folderu");

    return {
      id: folder.id,
      url: `https://drive.google.com/drive/folders/${folder.id}`,
    };
  },
});

export const createComplaintFolder = internalAction({
  args: {
    complaintId: v.id("complaints"),
    orderId: v.optional(v.id("orders")),
    clientId: v.optional(v.id("clients")),
  },
  handler: async (ctx, args): Promise<{ id: string; url: string }> => {
    // ── 1. Resolve parent folder (order folder or client folder) ──────────────
    let parentFolderId: string | null = null;
    let investmentAddress = "";

    if (args.orderId) {
      const order = await ctx.runQuery(api.orders.getById, { orderId: args.orderId });
      if (!order) throw new Error("Zlecenie nie znalezione");
      if (!order.folderId) throw new Error("To zlecenie nie ma folderu w Google Drive.");
      parentFolderId = order.folderId;

      // Build investment address string for subfolder name
      const street = [order.investmentStreet, order.investmentBuildingNumber]
        .filter(Boolean)
        .join(" ");
      const apt = order.investmentApartmentNumber ? `/${order.investmentApartmentNumber}` : "";
      const city = order.investmentCity?.trim() ?? "";
      investmentAddress = [street + apt, city].filter(Boolean).join(", ");
    } else if (args.clientId) {
      const client = await ctx.runQuery(api.clients.getById, { clientId: args.clientId });
      if (!client) throw new Error("Klient nie znaleziony");
      if (!client.clientFolderId) throw new Error("Ten klient nie ma folderu w Google Drive.");
      parentFolderId = client.clientFolderId;
    }

    // ── 2. Fetch complaint details for subfolder name ─────────────────────────
    const complaint = await ctx.runQuery(api.complaints.getById, {
      complaintId: args.complaintId,
    });
    if (!complaint) throw new Error("Reklamacja nie znaleziona");

    const datePart = new Date(complaint.startDate).toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).replace(/\./g, "-"); // "04-08-2026"

    const descRaw = (complaint.clientDescription ?? complaint.description ?? "").trim();
    // Sanitize for Drive folder name: remove slashes, colons, etc.
    const sanitize = (s: string) =>
      s.replace(/[/\\:*?"<>|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
    const descPart = sanitize(descRaw);
    const addrPart = sanitize(investmentAddress);

    // Build subfolder name: "04-08-2026_Opis reklamacji_ul. Budowlana 5, Warszawa"
    const subfolderName = [datePart, descPart, addrPart]
      .filter(Boolean)
      .join("_");

    // ── 3. Find or create "Reklamacja" parent folder ──────────────────────────
    const connection = await getAuthorizedConnection(ctx);
    const accessToken = connection.accessToken;

    if (!parentFolderId) {
      throw new Error("Brak folderu nadrzędnego dla tej reklamacji.");
    }
    const targetParentId: string = parentFolderId;

    const reklamacjaFolderId = await findOrCreateDriveFolder(
      accessToken,
      "Reklamacja",
      targetParentId,
    );

    // ── 4. Create the per-complaint subfolder inside "Reklamacja" ─────────────
    const createRes = await fetch(`${DRIVE_API_BASE}/files?supportsAllDrives=true`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: subfolderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [reklamacjaFolderId],
      }),
    });

    if (!createRes.ok) {
      const errorBody = await createRes.text();
      throw new Error(`Nie udało się utworzyć podfolderu reklamacji: ${createRes.status} - ${errorBody}`);
    }

    const folder = await createRes.json() as { id?: string };
    if (!folder.id) throw new Error("Drive nie zwróciło ID folderu");

    const url = `https://drive.google.com/drive/folders/${folder.id}`;

    await ctx.runMutation(internal.complaints.setFolderId, {
      complaintId: args.complaintId,
      folderId: folder.id,
      folderUrl: url,
    });

    return { id: folder.id, url };
  },
});


export const createOrderFolderInDrive = action({
  args: {
    orderId: v.id("orders"),
    parentFolderId: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args): Promise<{ id: string; url: string }> => {
    const performedBy = await requireUserIdentifierInAction(ctx);

    const order = await ctx.runQuery(api.orders.getById, { orderId: args.orderId });
    if (!order) throw new Error("Zlecenie nie znalezione");
    if (!order.folderId) throw new Error("To zlecenie nie ma folderu w Google Drive.");

    const connection = await getAuthorizedConnection(ctx);
    const accessToken = connection.accessToken;

    const createRes = await fetch(`${DRIVE_API_BASE}/files?supportsAllDrives=true`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: args.name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [args.parentFolderId],
      }),
    });

    if (!createRes.ok) {
      const errorBody = await createRes.text();
      throw new Error(`Nie udało się utworzyć folderu Drive: ${createRes.status} - ${errorBody}`);
    }

    const folder = await createRes.json() as { id?: string };
    if (!folder.id) throw new Error("Drive nie zwróciło ID folderu");

    return {
      id: folder.id,
      url: `https://drive.google.com/drive/folders/${folder.id}`,
    };
  },
});

export const createOpportunityFolderInDrive = action({
  args: {
    opportunityId: v.id("pendingJotformSubmissions"),
    parentFolderId: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args): Promise<{ id: string; url: string }> => {
    await requireUserIdentifierInAction(ctx);

    const opp = await ctx.runQuery(api.salesOpportunities.getSalesOpportunity, { opportunityId: args.opportunityId });
    if (!opp) throw new Error("Szansa sprzedaży nie znaleziona");
    if (!opp.opportunityFolderId) throw new Error("Ta szansa nie ma folderu w Google Drive.");

    const connection = await getAuthorizedConnection(ctx);
    const accessToken = connection.accessToken;

    const createRes = await fetch(`${DRIVE_API_BASE}/files?supportsAllDrives=true`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: args.name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [args.parentFolderId],
      }),
    });

    if (!createRes.ok) {
      const errorBody = await createRes.text();
      throw new Error(`Nie udało się utworzyć folderu Drive: ${createRes.status} - ${errorBody}`);
    }

    const folder = (await createRes.json()) as { id?: string };
    if (!folder.id) throw new Error("Drive nie zwróciło ID folderu");

    return {
      id: folder.id,
      url: `https://drive.google.com/drive/folders/${folder.id}`,
    };
  },
});

export const getRenameTargets = internalQuery({
  args: {},
  handler: async (ctx) => {
    const clients = await ctx.db.query("clients").collect();
    const pendings = await ctx.db
      .query("pendingJotformSubmissions")
      .filter((q) => q.neq(q.field("clientFolderId"), undefined))
      .collect();

    return {
      clients: clients.map((c) => ({
        id: c._id,
        clientType: c.clientType,
        companyName: c.companyName,
        firstName: c.firstName,
        lastName: c.lastName,
        clientFolderId: c.clientFolderId,
      })),
      pendings: pendings.map((p) => ({
        id: p._id,
        clientId: p.clientId,
        firstName: p.firstName,
        lastName: p.lastName,
        clientFolderId: p.clientFolderId,
      })),
    };
  },
});

export const syncClientFolderLinks = internalMutation({
  args: {},
  handler: async (ctx) => {
    const pendings = await ctx.db
      .query("pendingJotformSubmissions")
      .filter((q) => q.neq(q.field("clientFolderId"), undefined))
      .collect();

    let count = 0;
    for (const p of pendings) {
      if (p.clientId && p.clientFolderId) {
        const client = await ctx.db.get(p.clientId);
        if (client && !client.clientFolderId) {
          await ctx.db.patch(p.clientId, {
            clientFolderId: p.clientFolderId,
            clientFolderUrl: p.clientFolderUrl,
          });
          count++;
        }
      }
    }
    return count;
  },
});

export const backfillRenameClientFolders = action({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    // 1. Sync database client folder references from pending submissions
    const syncedCount = (await ctx.runMutation(internal.googleDrive.syncClientFolderLinks as any)) as number;
    console.log(`Synced database folder references for ${syncedCount} clients`);

    // 2. Fetch updated targets
    const { clients, pendings } = (await ctx.runQuery(internal.googleDrive.getRenameTargets as any)) as {
      clients: Array<{
        id: any;
        clientType: string;
        companyName?: string;
        firstName?: string;
        lastName?: string;
        clientFolderId?: string;
      }>;
      pendings: Array<{
        id: any;
        clientId?: any;
        firstName?: string;
        lastName?: string;
        clientFolderId?: string;
      }>;
    };
    /* eslint-enable @typescript-eslint/no-explicit-any */

    let count = 0;
    // 3. Rename folders for clients
    for (const client of clients) {
      if (client.clientType !== "business" && client.clientFolderId) {
        const newFolderName = `${client.lastName}_${client.firstName}`;
        try {
          await renameDriveFolder(ctx, client.clientFolderId, newFolderName);
          count++;
        } catch (e) {
          console.error(`Failed to rename folder ${client.clientFolderId} to ${newFolderName}:`, e);
        }
      }
    }

    // 4. Rename folders for stand-alone opportunities
    for (const pending of pendings) {
      if (!pending.clientId && pending.clientFolderId) {
        const newFolderName = `${pending.lastName}_${pending.firstName}`;
        try {
          await renameDriveFolder(ctx, pending.clientFolderId, newFolderName);
          count++;
        } catch (e) {
          console.error(`Failed to rename pending opportunity folder ${pending.clientFolderId} to ${newFolderName}:`, e);
        }
      }
    }

    return `Zaktualizowano nazwy ${count} folderów na Google Drive (Format: Nazwisko_Imię). Synchronicznie naprawiono ${syncedCount} relacji bazodanowych.`;
  },
});

export const checkFolderInfo = action({
  args: { folderId: v.string() },
  handler: async (ctx, args) => {
    const data = await driveApiFetchWithRetry(
      ctx,
      `/files/${args.folderId}?supportsAllDrives=true&fields=id,name,mimeType,parents,webViewLink`,
    );
    return data;
  },
});

export const downloadDriveFileBase64 = action({
  args: {
    fileId: v.string(),
    mimeType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let connection = await getAuthorizedConnection(ctx);

    let isGoogleApp = args.mimeType?.startsWith("application/vnd.google-apps.") ?? false;
    let downloadUrl: string;

    if (isGoogleApp) {
      downloadUrl = `${DRIVE_API_BASE}/files/${args.fileId}/export?mimeType=application/pdf&supportsAllDrives=true`;
    } else {
      downloadUrl = `${DRIVE_API_BASE}/files/${args.fileId}?alt=media&supportsAllDrives=true`;
    }

    let res = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${connection.accessToken}` },
    });

    if (res.status === 401) {
      connection = await getAuthorizedConnection(ctx, { forceRefresh: true });
      res = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${connection.accessToken}` },
      });
    }

    // Jeśli standardowe pobieranie zwróciło 403 z błędem braku treści binarnej (fileNotDownloadable), eksportujemy jako PDF
    if (!res.ok && res.status === 403 && !isGoogleApp) {
      const errTextPeek = await res.clone().text();
      if (errTextPeek.includes("fileNotDownloadable") || errTextPeek.includes("binary content")) {
        const exportUrl = `${DRIVE_API_BASE}/files/${args.fileId}/export?mimeType=application/pdf&supportsAllDrives=true`;
        const exportRes = await fetch(exportUrl, {
          headers: { Authorization: `Bearer ${connection.accessToken}` },
        });
        if (exportRes.ok) {
          res = exportRes;
          isGoogleApp = true;
        }
      }
    }

    const arrayBuffer = await res.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(arrayBuffer);
    const len = bytes.byteLength;
    const chunkSize = 8192;
    for (let i = 0; i < len; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64 = btoa(binary);

    return { base64, isExportedPdf: isGoogleApp };
  },
});

// Action for listing drawings in 'Rysunki konstrukcji do zamówienia' subfolder (or fallback to root order folder)
export const listOrderConstructionDrawingsFiles = action({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    await requireUserIdentifierInAction(ctx);
    const order = await ctx.runQuery(api.orders.getById, { orderId: args.orderId });
    if (!order) return { files: [], sourceFolderName: "Brak zlecenia" };

    const orderFolderId = order.folderId;
    if (!orderFolderId) return { files: [], sourceFolderName: "Brak folderu w Google Drive" };

    // 1. Try finding subfolder "Rysunki konstrukcji do zamówienia"
    const params = new URLSearchParams({
      q: `'${orderFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and name='Rysunki konstrukcji do zamówienia' and trashed=false`,
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      fields: "files(id,name)",
    });

    const data = (await driveApiFetchWithRetry(ctx, `/files?${params.toString()}`)) as {
      files?: Array<{ id: string; name: string }>;
    };

    const targetSubfolderId = data.files?.[0]?.id;

    if (targetSubfolderId) {
      const fileParams = new URLSearchParams({
        q: `'${targetSubfolderId}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
        fields: "files(id,name,mimeType,webViewLink)",
        pageSize: "100",
        orderBy: "name",
      });

      const filesData = (await driveApiFetchWithRetry(ctx, `/files?${fileParams.toString()}`)) as {
        files?: Array<{ id: string; name: string; mimeType?: string; webViewLink?: string }>;
      };

      if (filesData.files && filesData.files.length > 0) {
        return {
          sourceFolderName: "Rysunki konstrukcji do zamówienia",
          files: filesData.files.map((f) => ({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            url: f.webViewLink,
            defaultType: (f.name.toUpperCase().includes("RW") ? "RW" : "Rysunek") as "RW" | "Rysunek",
          })),
        };
      }
    }

    // 2. Fallback to root order folder if subfolder is empty or missing
    const rootFileParams = new URLSearchParams({
      q: `'${orderFolderId}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      fields: "files(id,name,mimeType,webViewLink)",
      pageSize: "100",
      orderBy: "name",
    });

    const rootFilesData = (await driveApiFetchWithRetry(ctx, `/files?${rootFileParams.toString()}`)) as {
      files?: Array<{ id: string; name: string; mimeType?: string; webViewLink?: string }>;
    };

    return {
      files: (rootFilesData.files ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        url: f.webViewLink,
        defaultType: (f.name.toUpperCase().includes("RW") ? "RW" : "Rysunek") as "RW" | "Rysunek",
      })),
    };
  },
});

/**
 * Pobiera listę plików w folderze klienta na Google Drive (rekursywnie z podfolderami).
 */
export const getClientDriveFilesMetadata = action({
  args: {
    clientId: v.id("clients"),
  },
  handler: async (ctx, args) => {
    await requireUserIdentifierInAction(ctx);

    const client = (await ctx.runQuery(api.clients.getById, {
      clientId: args.clientId,
    })) as Doc<"clients"> | null;

    if (!client) {
      return { files: [] };
    }

    const folderIdsToScan: Array<{ folderId: string; rootPrefix: string }> = [];
    const visitedFolderIds = new Set<string>();

    const mainFolderId = client.clientFolderId || client.folderId;
    if (mainFolderId) {
      folderIdsToScan.push({ folderId: mainFolderId, rootPrefix: "" });
    }

    // Dodatkowo zbieramy foldery ze Zleceń klienta, na wypadek gdyby leżały poza głównym katalogiem
    try {
      const orders = (await ctx.runQuery(api.orders.listByClient, { clientId: args.clientId })) as Doc<"orders">[];
      for (const order of orders ?? []) {
        if (order.folderId) {
          folderIdsToScan.push({ folderId: order.folderId, rootPrefix: `Zamówienia/${order.name || order._id}` });
        }
        if (order.attachmentsFolderId) {
          folderIdsToScan.push({ folderId: order.attachmentsFolderId, rootPrefix: `Zamówienia/${order.name || order._id}/Załączniki` });
        }
      }
    } catch {
      // Ignorujemy ew. błąd zapytania pomocniczego zleceń
    }

    const files: Array<{ id: string; name: string; relativePath: string; mimeType: string }> = [];
    const addedFileIds = new Set<string>();

    async function scanFolder(currentFolderId: string, currentPath: string) {
      if (visitedFolderIds.has(currentFolderId)) return;
      visitedFolderIds.add(currentFolderId);

      const params = new URLSearchParams({
        q: `'${currentFolderId}' in parents and trashed=false`,
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
        corpora: "allDrives",
        fields: "files(id,name,mimeType)",
        pageSize: "1000",
      });

      const response = (await driveApiFetchWithRetry(ctx, `/files?${params.toString()}`)) as {
        files?: Array<{ id: string; name: string; mimeType: string }>;
      };

      for (const item of response.files ?? []) {
        const itemPath = currentPath ? `${currentPath}/${item.name}` : item.name;
        if (item.mimeType === "application/vnd.google-apps.folder") {
          await scanFolder(item.id, itemPath);
        } else {
          if (!addedFileIds.has(item.id)) {
            addedFileIds.add(item.id);
            files.push({
              id: item.id,
              name: item.name,
              relativePath: itemPath,
              mimeType: item.mimeType,
            });
          }
        }
      }
    }

    for (const item of folderIdsToScan) {
      try {
        await scanFolder(item.folderId, item.rootPrefix);
      } catch (err) {
        console.error(`Błąd skanowania folderu ${item.folderId} klienta na Google Drive:`, err);
      }
    }

    return { files };
  },
});

/**
 * Pobiera listę wszystkich plików ze wszystkich folderów klientów na Google Drive.
 */
export const getAllDriveFilesMetadata = action({
  args: {},
  handler: async (ctx) => {
    await requireUserIdentifierInAction(ctx);

    const clientsRes = (await ctx.runQuery(api.clients.list, {})) as { page: Doc<"clients">[] };
    const clients = clientsRes.page ?? [];

    const result: Array<{
      clientId: string;
      clientName: string;
      files: Array<{ id: string; name: string; relativePath: string; mimeType: string }>;
    }> = [];

    for (const client of clients) {
      const folderId = client.clientFolderId || client.folderId;
      if (!folderId) continue;

      const clientName = client.companyName || `${client.lastName || ""} ${client.firstName || ""}`.trim() || client._id;
      const files: Array<{ id: string; name: string; relativePath: string; mimeType: string }> = [];
      const visitedFolderIds = new Set<string>();

      async function scanFolder(currentFolderId: string, currentPath: string) {
        if (visitedFolderIds.has(currentFolderId)) return;
        visitedFolderIds.add(currentFolderId);

        const params = new URLSearchParams({
          q: `'${currentFolderId}' in parents and trashed=false`,
          supportsAllDrives: "true",
          includeItemsFromAllDrives: "true",
          corpora: "allDrives",
          fields: "files(id,name,mimeType)",
          pageSize: "1000",
        });

        const response = (await driveApiFetchWithRetry(ctx, `/files?${params.toString()}`)) as {
          files?: Array<{ id: string; name: string; mimeType: string }>;
        };

        for (const item of response.files ?? []) {
          const itemPath = currentPath ? `${currentPath}/${item.name}` : item.name;
          if (item.mimeType === "application/vnd.google-apps.folder") {
            await scanFolder(item.id, itemPath);
          } else {
            files.push({
              id: item.id,
              name: item.name,
              relativePath: itemPath,
              mimeType: item.mimeType,
            });
          }
        }
      }

      try {
        await scanFolder(folderId, "");
        if (files.length > 0) {
          result.push({
            clientId: client._id,
            clientName,
            files,
          });
        }
      } catch (err) {
        console.error(`Błąd skanowania plików klienta ${client._id} na Google Drive:`, err);
      }
    }

    return { clientFiles: result };
  },
});


/**
 * Wgrywa plik z kopii zapasowej na Google Drive do folderu klienta (tworząc brakujące podfoldery).
 */
export const uploadBackupDriveFile = action({
  args: {
    clientId: v.id("clients"),
    relativePath: v.string(),
    fileBase64: v.string(),
    mimeType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireUserIdentifierInAction(ctx);

    const folderRes = await ctx.runAction(api.googleDrive.createClientFolder, {
      clientId: args.clientId,
    });

    const rootFolderId = folderRes?.clientFolderId;
    if (!rootFolderId) {
      throw new Error("Brak połączenia z Google Drive lub błąd tworzenia folderu klienta.");
    }

    const connection = await getAuthorizedConnection(ctx);

    const pathParts = args.relativePath.split("/").filter(Boolean);
    const fileName = pathParts.pop() || "plik";
    let currentParentId = rootFolderId;

    for (const subfolderName of pathParts) {
      const queryParams = new URLSearchParams({
        q: `'${currentParentId}' in parents and name='${subfolderName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
        fields: "files(id)",
      });

      const res = (await driveApiFetchWithRetry(ctx, `/files?${queryParams.toString()}`)) as {
        files?: Array<{ id: string }>;
      };

      if (res.files && res.files.length > 0) {
        currentParentId = res.files[0].id;
      } else {
        const createRes = (await driveApiFetchWithRetry(ctx, "/files?supportsAllDrives=true", {
          method: "POST",
          body: JSON.stringify({
            name: subfolderName,
            mimeType: "application/vnd.google-apps.folder",
            parents: [currentParentId],
          }),
        })) as { id: string };
        currentParentId = createRes.id;
      }
    }

    const boundary = "-------314159265358979323846";
    const mime = args.mimeType || "application/octet-stream";

    const metadata = JSON.stringify({
      name: fileName,
      parents: [currentParentId],
    });

    const preamble = new TextEncoder().encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`
    );
    const epilogue = new TextEncoder().encode(`\r\n--${boundary}--`);

    const binaryString = atob(args.fileBase64);
    const fileBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      fileBytes[i] = binaryString.charCodeAt(i);
    }

    const multipartRequestBody = new Uint8Array(preamble.byteLength + fileBytes.byteLength + epilogue.byteLength);
    multipartRequestBody.set(preamble, 0);
    multipartRequestBody.set(fileBytes, preamble.byteLength);
    multipartRequestBody.set(epilogue, preamble.byteLength + fileBytes.byteLength);

    const uploadRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${connection.accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      }
    );

    if (!uploadRes.ok) {
      const errBody = await uploadRes.text();
      throw new Error(`Google Drive upload error ${uploadRes.status}: ${errBody}`);
    }

    const uploadedFileData = (await uploadRes.json()) as { id: string };
    return { fileId: uploadedFileData.id, name: fileName };
  },
});

export const createTestingOfferTemplateDoc = action({
  args: {
    folderId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const parentFolderId = args.folderId || "0AJxR931eVMJoUk9PVA";
    const connection = await getAuthorizedConnection(ctx);
    const accessToken = connection.accessToken;

    // 1. Utwórz nowy dokument Google Docs w podanym folderze
    const createRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?supportsAllDrives=true`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Wzorzec Oferty ADK z Konstrukcjami CAD",
          mimeType: "application/vnd.google-apps.document",
          parents: [parentFolderId],
        }),
      }
    );

    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Błąd tworzenia dokumentu na Google Drive (${createRes.status}): ${err}`);
    }

    const docFile = (await createRes.json()) as { id: string; name: string };
    const docId = docFile.id;

    // 2. Przygotuj treść: Strona 1 (Informacje ogólne, klient, finanse) + Podział strony + Strona 2 (Widoki CAD)
    const page1 = [
      "OFERTA HANDLOWA",
      "ADK Stolarka & Konstrukcje Aluminiowe",
      "",
      "Numer oferty: {{numer_oferty}}",
      "Data wystawienia: {{data}}",
      "",
      "DANE ZAMAWIAJĄCEGO:",
      "Klient: {{klient}}",
      "Telefon: {{telefon}}",
      "E-mail: {{email}}",
      "Adres inwestycji: {{adres}}",
      "",
      "ZESTAWIENIE POZYCJI W OFERCIE:",
      "{{lineItemsList}}",
      "",
      "PODSUMOWANIE FINANSOWE:",
      "Wartość zamówienia netto: {{wartosc_netto}}",
      "Wartość zamówienia brutto: {{wartosc_brutto}}",
      "Rabat: {{rabat}}",
      "Wartość przed rabatem: {{wartosc_przed_rabatem}}",
      "",
      "UWAGI I WARUNKI REALIZACJI:",
      "{{uwagi}}",
      "{{warunki}}",
      "",
    ].join("\n");

    const page2 = [
      "\n",
      "SPECYFIKACJA TECHNICZNA I WIDOKI KONSTRUKCJI CAD",
      "",
      "{{pozycje_cad}}",
      "",
    ].join("\n");

    // Wstaw część 1
    await fetch(`${DOCS_API_BASE}/documents/${docId}:batchUpdate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: page1,
            },
          },
        ],
      }),
    });

    // Pobierz dokument, aby poznać endIndex na wstawienie Page Break i części 2
    const currentDocRes = await fetch(`${DOCS_API_BASE}/documents/${docId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentDoc = (await currentDocRes.json()) as any;
    const bodyContent = currentDoc.body?.content ?? [];
    const lastElem = bodyContent[bodyContent.length - 1];
    const insertIdx = Math.max(1, (lastElem?.endIndex ?? 2) - 1);

    await fetch(`${DOCS_API_BASE}/documents/${docId}:batchUpdate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            insertPageBreak: {
              location: { index: insertIdx },
            },
          },
          {
            insertText: {
              location: { index: insertIdx + 1 },
              text: page2,
            },
          },
        ],
      }),
    });

    return {
      docId,
      docUrl: `https://docs.google.com/document/d/${docId}/edit`,
      name: docFile.name,
    };
  },
});



