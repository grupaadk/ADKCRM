import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { encrypt } from "./lib/crypto";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

// GET /api/gmail/auth
export const initiateOAuth = httpAction(async (_ctx, request) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return new Response(
      JSON.stringify({ error: "Missing GOOGLE_CLIENT_ID env var" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const url = new URL(request.url);
  const siteUrl = `${url.protocol}//${url.host}`;
  const userId = url.searchParams.get("userId") ?? "unknown";
  const redirectUri = `${siteUrl}/api/gmail/callback`;
  const state = JSON.stringify({ userId });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://mail.google.com/ email profile",
    access_type: "offline",
    prompt: "consent",
    login_hint: "kontakt@adkokna.pl",
    hd: "adkokna.pl",
    state,
  });

  return new Response(null, {
    status: 302,
    headers: { Location: `${GOOGLE_AUTH_URL}?${params.toString()}` },
  });
});

// GET /api/gmail/callback
export const oauthCallback = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const siteUrl = `${url.protocol}//${url.host}`;
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  if (error) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${appUrl}/admin/mail?error=${encodeURIComponent(error)}`,
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

  if (!clientId || !clientSecret) {
    return new Response(
      JSON.stringify({ error: "Missing required env vars" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const redirectUri = `${siteUrl}/api/gmail/callback`;

  let userId = "unknown";
  if (stateParam) {
    try {
      const state = JSON.parse(stateParam);
      userId = state.userId ?? "unknown";
    } catch {
      // ignore
    }
  }

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
    console.error("Gmail token exchange failed:", errorBody);
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${appUrl}/admin/mail?error=${encodeURIComponent("Token exchange failed")}`,
      },
    });
  }

  const tokens = await tokenResponse.json();

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
    // non-critical
  }

  const expiresAt = Date.now() + (tokens.expires_in ?? 3600) * 1000;
  const encryptedAccess = await encrypt(tokens.access_token);
  const encryptedRefresh = await encrypt(tokens.refresh_token);

  await ctx.runMutation(api.gmail.saveConnection, {
    accessToken: encryptedAccess,
    refreshToken: encryptedRefresh,
    expiresAt,
    connectedBy: userId,
    connectedEmail,
  });

  return new Response(null, {
    status: 302,
    headers: { Location: `${appUrl}/admin/mail?gmail=connected` },
  });
});
