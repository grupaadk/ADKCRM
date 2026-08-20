import { httpRouter } from "convex/server";
import { webhook, fileRedirect } from "./jotform";
import { initiateOAuth, oauthCallback } from "./googleDriveAuth";
import { initiateOAuth as gmailInitiateOAuth, oauthCallback as gmailOauthCallback } from "./gmailAuth";
import { auth } from "./auth";

const http = httpRouter();

// Convex Auth — endpointy /api/auth/signIn, /api/auth/signOut, /api/auth/verifyCode, etc.
auth.addHttpRoutes(http);

http.route({
  path: "/api/webhooks/jotform",
  method: "POST",
  handler: webhook,
});

http.route({
  path: "/api/jotform/file",
  method: "GET",
  handler: fileRedirect,
});

http.route({
  path: "/api/google-drive/auth",
  method: "GET",
  handler: initiateOAuth,
});

http.route({
  path: "/api/google-drive/callback",
  method: "GET",
  handler: oauthCallback,
});

http.route({
  path: "/api/gmail/auth",
  method: "GET",
  handler: gmailInitiateOAuth,
});

http.route({
  path: "/api/gmail/callback",
  method: "GET",
  handler: gmailOauthCallback,
});

import { websiteWebhook, websiteWebhookOptions } from "./websiteWebhook";
import { publicServices, publicServicesOptions } from "./publicApi";

http.route({
  path: "/api/webhooks/website",
  method: "POST",
  handler: websiteWebhook,
});

http.route({
  path: "/api/webhooks/website",
  method: "OPTIONS",
  handler: websiteWebhookOptions,
});

// Publiczny endpoint — aktywne usługi (dla strony głównej)
http.route({
  path: "/api/public/services",
  method: "GET",
  handler: publicServices,
});

http.route({
  path: "/api/public/services",
  method: "OPTIONS",
  handler: publicServicesOptions,
});

export default http;
