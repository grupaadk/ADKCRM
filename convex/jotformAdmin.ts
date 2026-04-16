import { v } from "convex/values";
import type { ActionCtx } from "./_generated/server";
import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";
import { encrypt, decrypt } from "./lib/crypto";

const JOTFORM_API_BASE = "https://api.jotform.com";

function getEnvJotformApiKey() {
  const apiKey = process.env.JOTFORM_API_KEY?.trim();
  return apiKey || null;
}

function getEnvJotformFormId() {
  const formId = process.env.JOTFORM_FORM_ID?.trim();
  return formId || null;
}

// ─── Config (singleton) ──────────────────────────────────────────────────────

// Returns config WITHOUT decrypted API key (safe for frontend)
export const getConfig = query({
  args: {},
  handler: async (ctx) => {
    const envApiKey = getEnvJotformApiKey();
    const envFormId = getEnvJotformFormId();
    const config = await ctx.db.query("jotformConfig").first();
    if (!config && !envApiKey && !envFormId) return null;
    return {
      formId: config?.formId || envFormId || "",
      webhookRegistered: config?.webhookRegistered ?? false,
      hasApiKey: !!config?.apiKey || !!envApiKey,
      usingEnvApiKey: !!envApiKey,
    };
  },
});

// Encrypts API key before saving
export const saveConfig = mutation({
  args: {
    encryptedApiKey: v.optional(v.string()),
    formId: v.string(),
    webhookRegistered: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("jotformConfig").first();
    const envApiKey = getEnvJotformApiKey();
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(args.encryptedApiKey !== undefined
          ? { apiKey: args.encryptedApiKey }
          : {}),
        formId: args.formId,
        ...(args.webhookRegistered !== undefined
          ? { webhookRegistered: args.webhookRegistered }
          : {}),
      });
    } else {
      if (!args.encryptedApiKey && !envApiKey) {
        throw new Error("API key nie skonfigurowany");
      }

      await ctx.db.insert("jotformConfig", {
        apiKey: args.encryptedApiKey ?? "",
        formId: args.formId,
        webhookRegistered: args.webhookRegistered ?? false,
      });
    }
  },
});

export const markRegistered = mutation({
  args: { webhookRegistered: v.boolean() },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("jotformConfig").first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        webhookRegistered: args.webhookRegistered,
      });
    }
  },
});

// ─── Actions (encrypt/decrypt + external API) ───────────────────────────────

// Encrypts API key (called from frontend before saveConfig mutation)
export const encryptApiKey = action({
  args: { apiKey: v.string() },
  handler: async (_ctx, args): Promise<string> => {
    return await encrypt(args.apiKey);
  },
});

// Internal helper: read and decrypt API key from DB
async function getDecryptedApiKey(
  ctx: Pick<ActionCtx, "runQuery">,
): Promise<string | null> {
  const envApiKey = getEnvJotformApiKey();
  if (envApiKey) {
    return envApiKey;
  }

  const config: { apiKey?: string } | null = await ctx.runQuery(
    api.jotformAdmin.getConfigInternal,
    {},
  );
  if (!config?.apiKey) return null;
  return await decrypt(config.apiKey);
}

// Internal query returning raw (encrypted) config — only for actions
export const getConfigInternal = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("jotformConfig").first();
  },
});

// Rejestracja webhooka w Jotform
export const registerWebhook = action({
  args: {
    formId: v.string(),
    webhookUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const apiKey = await getDecryptedApiKey(ctx);
    if (!apiKey) {
      return { success: false, error: "API key nie skonfigurowany" };
    }

    const url = `${JOTFORM_API_BASE}/form/${args.formId}/webhooks?apiKey=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `webhookURL=${encodeURIComponent(args.webhookUrl)}`,
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        error: `Jotform API error (${response.status}): ${text}`,
      };
    }

    const data = await response.json();

    if (data.responseCode !== 200) {
      return {
        success: false,
        error: data.message ?? "Nieznany blad Jotform API",
      };
    }

    await ctx.runMutation(api.jotformAdmin.markRegistered, {
      webhookRegistered: true,
    });

    return { success: true };
  },
});

// Wyrejestrowanie webhooka
export const unregisterWebhook = action({
  args: {
    formId: v.string(),
    webhookUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const apiKey = await getDecryptedApiKey(ctx);
    if (!apiKey) {
      return { success: false, error: "API key nie skonfigurowany" };
    }

    const listUrl = `${JOTFORM_API_BASE}/form/${args.formId}/webhooks?apiKey=${apiKey}`;
    const listResp = await fetch(listUrl);

    if (!listResp.ok) {
      return { success: false, error: "Nie udalo sie pobrac webhookow" };
    }

    const listData = await listResp.json();
    const webhooks = listData.content ?? {};

    let webhookId: string | null = null;
    for (const [id, url] of Object.entries(webhooks)) {
      if (url === args.webhookUrl) {
        webhookId = id;
        break;
      }
    }

    if (!webhookId) {
      await ctx.runMutation(api.jotformAdmin.markRegistered, {
        webhookRegistered: false,
      });
      return { success: true };
    }

    const delUrl = `${JOTFORM_API_BASE}/form/${args.formId}/webhooks/${webhookId}?apiKey=${apiKey}`;
    const delResp = await fetch(delUrl, { method: "DELETE" });

    if (!delResp.ok) {
      return { success: false, error: "Nie udało się usunąć webhooka" };
    }

    await ctx.runMutation(api.jotformAdmin.markRegistered, {
      webhookRegistered: false,
    });

    return { success: true };
  },
});

// Sprawdzenie czy webhook jest zarejestrowany
export const checkWebhookStatus = action({
  args: {
    formId: v.string(),
    webhookUrl: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ registered: boolean; error?: string }> => {
    const apiKey = await getDecryptedApiKey(ctx);
    if (!apiKey) {
      return { registered: false, error: "API key nie skonfigurowany" };
    }

    const url = `${JOTFORM_API_BASE}/form/${args.formId}/webhooks?apiKey=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      return {
        registered: false,
        error: `Jotform API error (${response.status})`,
      };
    }

    const data = await response.json();
    const webhooks = data.content ?? {};

    const found = Object.values(webhooks).some(
      (hookUrl) => hookUrl === args.webhookUrl,
    );

    return { registered: found };
  },
});

// Test polaczenia z Jotform API (przyjmuje klucz z frontendu — nie z DB)
export const testConnection = action({
  args: {
    apiKey: v.optional(v.string()),
  },
  handler: async (
    _ctx,
    args,
  ): Promise<{ success: boolean; username?: string; error?: string }> => {
    const apiKey = args.apiKey?.trim() || getEnvJotformApiKey();
    if (!apiKey) {
      return { success: false, error: "API key nie skonfigurowany" };
    }

    const url = `${JOTFORM_API_BASE}/user?apiKey=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      return {
        success: false,
        error: `Jotform API error (${response.status})`,
      };
    }

    const data = await response.json();
    if (data.responseCode !== 200) {
      return { success: false, error: data.message ?? "Nieprawidlowy API key" };
    }

    return {
      success: true,
      username: data.content?.username ?? data.content?.name,
    };
  },
});
