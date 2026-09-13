import { v } from "convex/values";
import type { ActionCtx } from "./_generated/server";
import { query, mutation, action, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { encrypt, decrypt } from "./lib/crypto";

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

// ─── Types ────────────────────────────────────────────────────────────────────

type GmailHeader = { name: string; value: string };

type GmailMessagePart = {
  partId?: string;
  mimeType?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailMessagePart[];
};

type GmailMessageFull = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  payload?: GmailMessagePart;
  internalDate?: string;
};

type GmailListResponse = {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

type GmailThreadsListResponse = {
  threads?: Array<{ id: string; snippet: string }>;
  nextPageToken?: string;
};

type GmailThreadWithMessages = {
  id: string;
  messages?: GmailMessageFull[];
};

type GmailLabel = {
  id: string;
  name: string;
  type?: string;
  messagesTotal?: number;
  messagesUnread?: number;
  threadsTotal?: number;
  threadsUnread?: number;
};

type DecryptedConnection = {
  _id: string;
  _creationTime: number;
  accountKey?: "main" | "secondary";
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  connectedEmail: string;
  connectedBy: string;
  connectionStatus: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getHeader(headers: GmailHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodeGmailBody(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "===".slice((base64.length % 4 || 4) - 1);
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

type AttachmentMeta = {
  attachmentId?: string; // undefined for small inline attachments
  filename: string;
  mimeType: string;
  size: number;
  contentId?: string; // set for inline images (cid: references)
  data?: string; // inline base64 data for small attachments (no attachmentId)
};

function getFilename(part: GmailMessagePart): string {
  const cd = getHeader(part.headers, "Content-Disposition");
  const ct = getHeader(part.headers, "Content-Type");
  const fromCd = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';\r\n]+)/i)?.[1];
  const fromCt = ct.match(/name\*?=(?:UTF-8'')?["']?([^"';\r\n]+)/i)?.[1];
  const ext = part.mimeType?.split("/")[1] ?? "bin";
  return decodeURIComponent(fromCd ?? fromCt ?? `załącznik.${ext}`);
}

function collectAttachments(part: GmailMessagePart, out: AttachmentMeta[] = []): AttachmentMeta[] {
  if (part.body?.attachmentId) {
    // Standard attachment: large enough that Gmail stores it separately
    const rawCid = getHeader(part.headers, "Content-ID").replace(/[<>]/g, "").trim();
    out.push({
      attachmentId: part.body.attachmentId,
      filename: getFilename(part),
      mimeType: part.mimeType ?? "application/octet-stream",
      size: part.body.size ?? 0,
      contentId: rawCid || undefined,
    });
  } else if (part.body?.data) {
    // Small attachment returned inline (below Gmail's ~2KB threshold).
    // Only treat it as an attachment if it has an explicit filename or
    // Content-Disposition: attachment — not just a text/html or text/plain body part.
    const isBodyContent =
      part.mimeType === "text/plain" ||
      part.mimeType === "text/html" ||
      (part.mimeType?.startsWith("multipart/") ?? false);
    if (!isBodyContent) {
      const cd = getHeader(part.headers, "Content-Disposition");
      const ct = getHeader(part.headers, "Content-Type");
      const hasFilename = /filename/i.test(cd) || /name=/i.test(ct);
      const isAttachmentDisposition = /\battachment\b/i.test(cd);
      if (hasFilename || isAttachmentDisposition) {
        const rawCid = getHeader(part.headers, "Content-ID").replace(/[<>]/g, "").trim();
        out.push({
          filename: getFilename(part),
          mimeType: part.mimeType ?? "application/octet-stream",
          size: part.body.size ?? Math.ceil((part.body.data.length * 3) / 4),
          contentId: rawCid || undefined,
          data: part.body.data,
        });
      }
    }
  }
  for (const child of part.parts ?? []) {
    collectAttachments(child, out);
  }
  return out;
}

function extractBody(part: GmailMessagePart): { body: string; isHtml: boolean } {
  if (part.mimeType === "text/html" && part.body?.data) {
    return { body: decodeGmailBody(part.body.data), isHtml: true };
  }
  if (part.mimeType === "text/plain" && part.body?.data) {
    return { body: decodeGmailBody(part.body.data), isHtml: false };
  }
  if (part.parts) {
    // Prefer HTML over plain
    for (const p of part.parts) {
      if (p.mimeType === "text/html" && p.body?.data) {
        return { body: decodeGmailBody(p.body.data), isHtml: true };
      }
    }
    for (const p of part.parts) {
      if (p.mimeType === "text/plain" && p.body?.data) {
        return { body: decodeGmailBody(p.body.data), isHtml: false };
      }
    }
    // Recurse into nested parts
    for (const p of part.parts) {
      const result = extractBody(p);
      if (result.body) return result;
    }
  }
  return { body: "", isHtml: false };
}

function formatDate(internalDate: string | undefined): string {
  if (!internalDate) return "";
  const ms = parseInt(internalDate, 10);
  if (isNaN(ms)) return "";
  const date = new Date(ms);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (isToday) {
    return date.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  }
  const isThisYear = date.getFullYear() === now.getFullYear();
  if (isThisYear) {
    return date.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
  }
  return date.toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" });
}

function encodeSubject(subject: string): string {
  if (/^[\x00-\x7F]*$/.test(subject)) return subject;
  const bytes = new TextEncoder().encode(subject);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

function createRawEmail(params: {
  from: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
  messageId?: string;
  references?: string;
  attachments?: Array<{ filename: string; mimeType: string; data: string }>;
}): string {
  const headers: string[] = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Subject: ${encodeSubject(params.subject)}`,
    "MIME-Version: 1.0",
  ];

  if (params.cc) {
    headers.push(`Cc: ${params.cc}`);
  }

  if (params.messageId) {
    headers.push(`In-Reply-To: ${params.messageId}`);
    headers.push(`References: ${params.references ?? params.messageId}`);
  }

  let email: string;

  if (!params.attachments?.length) {
    headers.push("Content-Type: text/html; charset=UTF-8");
    email = [...headers, "", params.body].join("\r\n");
  } else {
    const boundary = "----=_Part_" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

    const parts: string[] = [
      ...headers,
      "",
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "",
      params.body,
    ];

    for (const att of params.attachments) {
      const encodedName = encodeSubject(att.filename);
      // Wrap base64 at 76 chars per MIME spec
      const b64 = att.data.replace(/\s/g, "");
      const wrapped = b64.match(/.{1,76}/g)?.join("\r\n") ?? b64;
      parts.push(
        `--${boundary}`,
        `Content-Type: ${att.mimeType}; name="${encodedName}"`,
        `Content-Disposition: attachment; filename="${encodedName}"`,
        "Content-Transfer-Encoding: base64",
        "",
        wrapped,
      );
    }

    parts.push(`--${boundary}--`);
    email = parts.join("\r\n");
  }

  const bytes = new TextEncoder().encode(email);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function parseFromServer(from: string): { name: string; email: string } {
  const match = from.match(/^(.*?)\s*<(.+?)>$/);
  if (match) return { name: match[1].trim().replace(/^"|"$/g, ""), email: match[2] };
  return { name: from, email: from };
}

// ─── Connection management ─────────────────────────────────────────────────

async function getDecryptedConnection(ctx: ActionCtx): Promise<DecryptedConnection | null> {
  const connection = await ctx.runQuery(api.gmail.getConnectionInternal);
  if (!connection) return null;
  return {
    ...connection,
    accessToken: await decrypt(connection.accessToken),
    refreshToken: await decrypt(connection.refreshToken),
  };
}

async function refreshAccessToken(
  ctx: ActionCtx,
  connection: DecryptedConnection,
): Promise<DecryptedConnection> {
  await ctx.runMutation(internal.gmail.updateStatus, { id: connection._id, connectionStatus: "refreshing" });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    await ctx.runMutation(internal.gmail.updateStatus, { id: connection._id, connectionStatus: "refresh_failed" });
    throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET env vars");
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
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
    await ctx.runMutation(internal.gmail.updateStatus, { id: connection._id, connectionStatus: "refresh_failed" });
    throw new Error(`Gmail token refresh failed: ${await response.text()}`);
  }

  const tokens = await response.json();
  const expiresAt = Date.now() + tokens.expires_in * 1000;
  const encryptedToken = await encrypt(tokens.access_token);

  await ctx.runMutation(internal.gmail.updateTokens, { id: connection._id, accessToken: encryptedToken, expiresAt });

  return { ...connection, accessToken: tokens.access_token, expiresAt, connectionStatus: "connected" };
}

async function getAuthorizedConnection(
  ctx: ActionCtx,
  options?: { forceRefresh?: boolean },
): Promise<DecryptedConnection> {
  const connection = await getDecryptedConnection(ctx);
  if (!connection) throw new Error("Gmail not connected");

  const shouldRefresh =
    options?.forceRefresh || connection.expiresAt <= Date.now() + 5 * 60 * 1000;

  if (!shouldRefresh) return connection;
  return refreshAccessToken(ctx, connection);
}

async function gmailApiFetch<T>(
  path: string,
  accessToken: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${GMAIL_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gmail API error ${response.status}: ${errorBody}`);
  }

  return response.json() as Promise<T>;
}

async function gmailApiFetchWithRetry<T>(
  ctx: ActionCtx,
  path: string,
  options?: RequestInit,
): Promise<T> {
  let connection = await getAuthorizedConnection(ctx);
  try {
    return await gmailApiFetch<T>(path, connection.accessToken, options);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Gmail API error 401")) {
      connection = await getAuthorizedConnection(ctx, { forceRefresh: true });
      return await gmailApiFetch<T>(path, connection.accessToken, options);
    }
    throw error;
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export const getConnectionStatus = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("gmailSettings").first();
    const activeKey = settings?.activeAccountKey ?? "main";
    const all = await ctx.db.query("gmailConnection").collect();
    const connection = all.find((c) => (c.accountKey ?? "main") === activeKey);
    if (!connection) return null;
    return {
      connectionStatus: connection.connectionStatus,
      connectedEmail: connection.connectedEmail,
      connectedBy: connection.connectedBy,
      expiresAt: connection.expiresAt,
    };
  },
});

export const getAllConnectionsStatus = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("gmailSettings").first();
    const activeAccountKey = settings?.activeAccountKey ?? "main";
    const all = await ctx.db.query("gmailConnection").collect();
    return {
      activeAccountKey,
      connections: all.map((c) => ({
        accountKey: (c.accountKey ?? "main") as "main" | "secondary",
        connectedEmail: c.connectedEmail,
        connectionStatus: c.connectionStatus,
        expiresAt: c.expiresAt,
      })),
    };
  },
});

export const getConnectionInternal = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("gmailSettings").first();
    const activeKey = settings?.activeAccountKey ?? "main";
    const all = await ctx.db.query("gmailConnection").collect();
    return all.find((c) => (c.accountKey ?? "main") === activeKey) ?? null;
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

export const saveConnection = mutation({
  args: {
    accountKey: v.optional(v.union(v.literal("main"), v.literal("secondary"))),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
    connectedBy: v.string(),
    connectedEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const accountKey = args.accountKey ?? "main";
    const all = await ctx.db.query("gmailConnection").collect();
    const existing = all.find((c) => (c.accountKey ?? "main") === accountKey);
    if (existing) {
      await ctx.db.patch(existing._id, {
        accountKey,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        expiresAt: args.expiresAt,
        connectedBy: args.connectedBy,
        connectedEmail: args.connectedEmail,
        connectionStatus: "connected",
      });
    } else {
      await ctx.db.insert("gmailConnection", {
        accountKey,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        expiresAt: args.expiresAt,
        connectedBy: args.connectedBy,
        connectedEmail: args.connectedEmail,
        connectionStatus: "connected",
      });
    }
    // Jeśli to pierwsze konto — ustaw jako aktywne
    const settingsExist = await ctx.db.query("gmailSettings").first();
    if (!settingsExist) {
      await ctx.db.insert("gmailSettings", { activeAccountKey: accountKey });
    }
  },
});

export const disconnect = mutation({
  args: { accountKey: v.union(v.literal("main"), v.literal("secondary")) },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("gmailConnection").collect();
    const connection = all.find((c) => (c.accountKey ?? "main") === args.accountKey);
    if (connection) {
      await ctx.db.delete(connection._id);
    }
  },
});

export const setActiveAccount = mutation({
  args: { accountKey: v.union(v.literal("main"), v.literal("secondary")) },
  handler: async (ctx, args) => {
    const settings = await ctx.db.query("gmailSettings").first();
    if (settings) {
      await ctx.db.patch(settings._id, { activeAccountKey: args.accountKey });
    } else {
      await ctx.db.insert("gmailSettings", { activeAccountKey: args.accountKey });
    }
  },
});

export const updateTokens = internalMutation({
  args: { id: v.string(), accessToken: v.string(), expiresAt: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id as never, {
      accessToken: args.accessToken,
      expiresAt: args.expiresAt,
      connectionStatus: "connected",
    });
  },
});

export const updateStatus = internalMutation({
  args: {
    id: v.string(),
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
    await ctx.db.patch(args.id as never, { connectionStatus: args.connectionStatus });
  },
});

// ─── Inbox filter query ───────────────────────────────────────────────────────
// Server-side pre-filter applied by Gmail before metadata is fetched.
// Mirrors the client-side FILTER_BLACKLIST in page.tsx.
// Note: atlassian.com covers Trello (trello.com routes through atlassian infra).
const INBOX_FILTER_QUERY = [
  "-from:trello.com",
  "-from:google.com",
  "-from:atlassian.com",
  "-from:mail.google.com",
  "-from:notifications",
  "-from:noreply",
  "-from:no-reply",
  "-from:donotreply",
  "-newsletter",
].join(" ");

// ─── Actions ──────────────────────────────────────────────────────────────────

export const listMessages = action({
  args: {
    labelId: v.string(),
    pageToken: v.optional(v.string()),
    maxResults: v.optional(v.number()),
    searchQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const maxResults = Math.min(args.maxResults ?? 20, 50);

    const params = new URLSearchParams({ maxResults: String(maxResults) });
    if (args.pageToken) params.set("pageToken", args.pageToken);
    if (args.labelId !== "ALL") params.set("labelIds", args.labelId);
    if (args.searchQuery) {
      params.set("q", args.searchQuery);
    } else if (args.labelId === "INBOX") {
      params.set("q", INBOX_FILTER_QUERY);
    }

    const listResponse = await gmailApiFetchWithRetry<GmailListResponse>(
      ctx,
      `/users/me/messages?${params}`,
    );

    if (!listResponse.messages?.length) {
      return { messages: [], nextPageToken: undefined };
    }

    // Fetch metadata in parallel
    const messages = await Promise.all(
      listResponse.messages.map(async (msg) => {
        const detail = await gmailApiFetchWithRetry<GmailMessageFull>(
          ctx,
          `/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Message-ID`,
        );
        const headers = detail.payload?.headers;
        return {
          id: detail.id,
          threadId: detail.threadId,
          from: getHeader(headers, "From"),
          to: getHeader(headers, "To"),
          subject: getHeader(headers, "Subject") || "(bez tematu)",
          date: formatDate(detail.internalDate),
          dateTimestamp: detail.internalDate ? parseInt(detail.internalDate, 10) : 0,
          snippet: detail.snippet ?? "",
          isRead: !detail.labelIds?.includes("UNREAD"),
          isStarred: detail.labelIds?.includes("STARRED") ?? false,
          labelIds: detail.labelIds ?? [],
          hasAttachment: detail.payload?.mimeType === "multipart/mixed",
        };
      }),
    );

    return { messages, nextPageToken: listResponse.nextPageToken };
  },
});

export const getMessage = action({
  args: { messageId: v.string() },
  handler: async (ctx, args) => {
    const detail = await gmailApiFetchWithRetry<GmailMessageFull>(
      ctx,
      `/users/me/messages/${args.messageId}?format=full`,
    );

    const headers = detail.payload?.headers;
    const { body: rawBody, isHtml } = extractBody(detail.payload ?? {});
    const allAttachments = collectAttachments(detail.payload ?? {});

    const inlineImages = allAttachments.filter((a) => a.contentId && a.mimeType.startsWith("image/"));
    const regularAttachments = allAttachments.filter((a) => !(a.contentId && a.mimeType.startsWith("image/")));

    // Replace cid: references with base64 data URLs so images render in iframe
    let body = rawBody;
    if (isHtml && inlineImages.length > 0) {
      const fetched = await Promise.all(
        inlineImages.map(async (img) => {
          try {
            let base64: string;
            if (img.data) {
              // Small inline image — data already available
              base64 = img.data.replace(/-/g, "+").replace(/_/g, "/");
            } else {
              const res = await gmailApiFetchWithRetry<{ data: string }>(
                ctx,
                `/users/me/messages/${args.messageId}/attachments/${img.attachmentId}`,
              );
              base64 = res.data.replace(/-/g, "+").replace(/_/g, "/");
            }
            return { cid: img.contentId!, dataUrl: `data:${img.mimeType};base64,${base64}` };
          } catch {
            return null;
          }
        }),
      );
      for (const item of fetched) {
        if (!item) continue;
        // Match both cid:id and cid:id with angle brackets variants
        body = body.replace(
          new RegExp(`cid:${item.cid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "gi"),
          item.dataUrl,
        );
      }
    }

    return {
      id: detail.id,
      threadId: detail.threadId,
      from: getHeader(headers, "From"),
      to: getHeader(headers, "To"),
      subject: getHeader(headers, "Subject") || "(bez tematu)",
      date: formatDate(detail.internalDate),
      dateTimestamp: detail.internalDate ? parseInt(detail.internalDate, 10) : 0,
      snippet: detail.snippet ?? "",
      isRead: !detail.labelIds?.includes("UNREAD"),
      isStarred: detail.labelIds?.includes("STARRED") ?? false,
      labelIds: detail.labelIds ?? [],
      body,
      isHtml,
      messageId: getHeader(headers, "Message-ID"),
      references: getHeader(headers, "References"),
      attachments: regularAttachments.map((a) => ({
        attachmentId: a.attachmentId,
        filename: a.filename,
        mimeType: a.mimeType,
        size: a.size,
        data: a.data,
      })),
      inlineImages: inlineImages.map((a) => ({
        attachmentId: a.attachmentId,
        filename: a.filename,
        mimeType: a.mimeType,
        size: a.size,
      })),
    };
  },
});

export const listThreads = action({
  args: {
    labelId: v.string(),
    pageToken: v.optional(v.string()),
    maxResults: v.optional(v.number()),
    searchQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const maxResults = Math.min(args.maxResults ?? 20, 50);
    const params = new URLSearchParams({ maxResults: String(maxResults) });
    if (args.pageToken) params.set("pageToken", args.pageToken);
    if (args.labelId !== "ALL") params.set("labelIds", args.labelId);
    if (args.searchQuery) {
      params.set("q", args.searchQuery);
    } else if (args.labelId === "INBOX") {
      params.set("q", INBOX_FILTER_QUERY);
    }

    const listResponse = await gmailApiFetchWithRetry<GmailThreadsListResponse>(
      ctx,
      `/users/me/threads?${params}`,
    );

    if (!listResponse.threads?.length) {
      return { threads: [], nextPageToken: undefined };
    }

    const threads = await Promise.all(
      listResponse.threads.map(async (t) => {
        const thread = await gmailApiFetchWithRetry<GmailThreadWithMessages>(
          ctx,
          `/users/me/threads/${t.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
        );
        const msgs = thread.messages ?? [];
        const lastMsg = msgs[msgs.length - 1];
        const firstMsg = msgs[0];

        // Collect unique participant display names
        const seen = new Set<string>();
        const participants: string[] = [];
        for (const msg of msgs) {
          const from = getHeader(msg.payload?.headers, "From");
          const { name, email } = parseFromServer(from);
          const label = name || email;
          if (!seen.has(label)) { seen.add(label); participants.push(label); }
        }

        return {
          id: t.id,
          subject: getHeader(firstMsg?.payload?.headers, "Subject") || "(bez tematu)",
          participants,
          messageCount: msgs.length,
          latestDate: formatDate(lastMsg?.internalDate),
          latestDateTimestamp: lastMsg?.internalDate ? parseInt(lastMsg.internalDate, 10) : 0,
          snippet: t.snippet,
          hasUnread: msgs.some((m) => m.labelIds?.includes("UNREAD")),
          isStarred: msgs.some((m) => m.labelIds?.includes("STARRED")),
          latestFrom: getHeader(lastMsg?.payload?.headers, "From"),
          hasAttachment: msgs.some((m) => m.payload?.mimeType === "multipart/mixed"),
        };
      }),
    );

    return { threads, nextPageToken: listResponse.nextPageToken };
  },
});

export const getThread = action({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const thread = await gmailApiFetchWithRetry<GmailThreadWithMessages>(
      ctx,
      `/users/me/threads/${args.threadId}?format=full`,
    );

    const messages = await Promise.all(
      (thread.messages ?? []).map(async (msg) => {
        const headers = msg.payload?.headers;
        const { body: rawBody, isHtml } = extractBody(msg.payload ?? {});
        const allAttachments = collectAttachments(msg.payload ?? {});
        const inlineImages = allAttachments.filter((a) => a.contentId && a.mimeType.startsWith("image/"));
        const regularAttachments = allAttachments.filter((a) => !(a.contentId && a.mimeType.startsWith("image/")));

        let body = rawBody;
        if (isHtml && inlineImages.length > 0) {
          const fetched = await Promise.all(
            inlineImages.map(async (img) => {
              try {
                let base64: string;
                if (img.data) {
                  base64 = img.data.replace(/-/g, "+").replace(/_/g, "/");
                } else {
                  const res = await gmailApiFetchWithRetry<{ data: string }>(
                    ctx,
                    `/users/me/messages/${msg.id}/attachments/${img.attachmentId}`,
                  );
                  base64 = res.data.replace(/-/g, "+").replace(/_/g, "/");
                }
                return { cid: img.contentId!, dataUrl: `data:${img.mimeType};base64,${base64}` };
              } catch { return null; }
            }),
          );
          for (const item of fetched) {
            if (!item) continue;
            body = body.replace(
              new RegExp(`cid:${item.cid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "gi"),
              item.dataUrl,
            );
          }
        }

        return {
          id: msg.id,
          from: getHeader(headers, "From"),
          to: getHeader(headers, "To"),
          date: formatDate(msg.internalDate),
          dateTimestamp: msg.internalDate ? parseInt(msg.internalDate, 10) : 0,
          snippet: msg.snippet ?? "",
          isRead: !msg.labelIds?.includes("UNREAD"),
          labelIds: msg.labelIds ?? [],
          body,
          isHtml,
          messageId: getHeader(headers, "Message-ID"),
          references: getHeader(headers, "References"),
          attachments: regularAttachments.map((a) => ({
            attachmentId: a.attachmentId,
            filename: a.filename,
            mimeType: a.mimeType,
            size: a.size,
            data: a.data,
          })),
          inlineImages: inlineImages.map((a) => ({
            attachmentId: a.attachmentId,
            filename: a.filename,
            mimeType: a.mimeType,
            size: a.size,
          })),
        };
      }),
    );

    return { messages };
  },
});

export const getAttachment = action({
  args: { messageId: v.string(), attachmentId: v.string() },
  handler: async (ctx, args) => {
    const res = await gmailApiFetchWithRetry<{ data: string }>(
      ctx,
      `/users/me/messages/${args.messageId}/attachments/${args.attachmentId}`,
    );
    return { data: res.data }; // URL-safe base64
  },
});

export const sendEmail = action({
  args: {
    to: v.string(),
    cc: v.optional(v.string()),
    subject: v.string(),
    body: v.string(),
    inReplyToMessageId: v.optional(v.string()),
    references: v.optional(v.string()),
    threadId: v.optional(v.string()),
    attachments: v.optional(v.array(v.object({
      filename: v.string(),
      mimeType: v.string(),
      data: v.string(),
    }))),
  },
  handler: async (ctx, args) => {
    const connection = await getAuthorizedConnection(ctx);

    const raw = createRawEmail({
      from: connection.connectedEmail,
      to: args.to,
      cc: args.cc,
      subject: args.subject,
      body: args.body,
      messageId: args.inReplyToMessageId,
      references: args.references,
      attachments: args.attachments,
    });

    const payload: Record<string, string> = { raw };
    if (args.threadId) payload.threadId = args.threadId;

    const sent = await gmailApiFetch<{ id: string; threadId: string }>(
      "/users/me/messages/send",
      connection.accessToken,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );

    return { id: sent.id, threadId: sent.threadId };
  },
});

export const modifyMessage = action({
  args: {
    messageId: v.string(),
    addLabelIds: v.optional(v.array(v.string())),
    removeLabelIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await gmailApiFetchWithRetry(ctx, `/users/me/messages/${args.messageId}/modify`, {
      method: "POST",
      body: JSON.stringify({
        addLabelIds: args.addLabelIds ?? [],
        removeLabelIds: args.removeLabelIds ?? [],
      }),
    });
    return { success: true };
  },
});

export const trashMessage = action({
  args: { messageId: v.string() },
  handler: async (ctx, args) => {
    await gmailApiFetchWithRetry(ctx, `/users/me/messages/${args.messageId}/trash`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    return { success: true };
  },
});

export const getLabels = action({
  args: {},
  handler: async (ctx) => {
    const response = await gmailApiFetchWithRetry<{ labels?: GmailLabel[] }>(
      ctx,
      "/users/me/labels",
    );
    return response.labels ?? [];
  },
});

export const getLabelInfo = action({
  args: { labelId: v.string() },
  handler: async (ctx, args) => {
    const label = await gmailApiFetchWithRetry<GmailLabel>(
      ctx,
      `/users/me/labels/${args.labelId}`,
    );
    return {
      id: label.id,
      name: label.name,
      messagesTotal: label.messagesTotal ?? 0,
      messagesUnread: label.messagesUnread ?? 0,
    };
  },
});
