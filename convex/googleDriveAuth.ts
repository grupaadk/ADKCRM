import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { encrypt } from "./lib/crypto";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

// GET /api/google-drive/auth
export const initiateOAuth = httpAction(async (_ctx, request) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const siteUrl = process.env.CONVEX_SITE_URL;

  if (!clientId || !siteUrl) {
    return new Response(
      JSON.stringify({ error: "Missing GOOGLE_CLIENT_ID or CONVEX_SITE_URL env vars" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // Extract userId, appUrl and optional returnPath from query params
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId") ?? "unknown";
  const appUrl = url.searchParams.get("appUrl") ?? process.env.APP_URL ?? "";
  const rawReturnPath = url.searchParams.get("returnPath") ?? "/admin/ustawienia";
  const returnPath =
    rawReturnPath.startsWith("/") && !rawReturnPath.startsWith("//")
      ? rawReturnPath
      : "/admin/ustawienia";

  const redirectUri = `${siteUrl}/api/google-drive/callback`;

  const state = JSON.stringify({ userId, appUrl, returnPath });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/presentations email profile",
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${GOOGLE_AUTH_URL}?${params.toString()}`,
    },
  });
});

// GET /api/google-drive/callback
export const oauthCallback = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const siteUrl = process.env.CONVEX_SITE_URL;

  let userId = "unknown";
  let appUrl = process.env.APP_URL ?? "";
  let returnPath = "/admin/ustawienia";
  if (stateParam) {
    try {
      const state = JSON.parse(stateParam);
      userId = state.userId ?? "unknown";
      if (state.appUrl) appUrl = state.appUrl;
      if (
        typeof state.returnPath === "string" &&
        state.returnPath.startsWith("/") &&
        !state.returnPath.startsWith("//")
      ) {
        returnPath = state.returnPath;
      }
    } catch {
      // ignore parse errors
    }
  }

  const buildRedirectUrl = (paramName: string, paramValue: string) => {
    const separator = returnPath.includes("?") ? "&" : "?";
    return `${appUrl}${returnPath}${separator}${paramName}=${encodeURIComponent(paramValue)}`;
  };

  if (error) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: buildRedirectUrl("error", error),
      },
    });
  }

  if (!code) {
    return new Response(
      JSON.stringify({ error: "Missing authorization code" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret || !siteUrl) {
    return new Response(
      JSON.stringify({ error: "Missing required env vars" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const redirectUri = `${siteUrl}/api/google-drive/callback`;

  // Exchange authorization code for tokens
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    console.error("Token exchange failed:", errorBody);
    return new Response(null, {
      status: 302,
      headers: {
        Location: buildRedirectUrl("error", "Token exchange failed"),
      },
    });
  }

  const tokens = await tokenResponse.json();

  // Fetch the user's email from Google
  let connectedEmail = "unknown";
  try {
    const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json();
      connectedEmail = userInfo.email ?? "unknown";
    }
  } catch {
    // non-critical, proceed with "unknown"
  }

  const expiresAt = Date.now() + (tokens.expires_in ?? 3600) * 1000;

  // Encrypt tokens before storing (refresh_token may be omitted if Google reuses previous grant)
  const encryptedAccess = await encrypt(tokens.access_token);
  const encryptedRefresh = tokens.refresh_token
    ? await encrypt(tokens.refresh_token)
    : "";

  // Save the connection to the database
  await ctx.runMutation(api.googleDrive.saveConnection, {
    accessToken: encryptedAccess,
    refreshToken: encryptedRefresh,
    expiresAt,
    connectedBy: userId,
    connectedEmail,
  });

  // Redirect back to the originating page (or settings by default)
  return new Response(null, {
    status: 302,
    headers: {
      Location: buildRedirectUrl("drive", "connected"),
    },
  });
});
