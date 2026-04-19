import { httpRouter } from "convex/server";
import { webhook, fileRedirect } from "./jotform";
import { initiateOAuth, oauthCallback } from "./googleDriveAuth";
import { initiateOAuth as gmailInitiateOAuth, oauthCallback as gmailOauthCallback } from "./gmailAuth";
import { webhook as trelloWebhook } from "./trelloWebhook";

const http = httpRouter();

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
  path: "/api/webhooks/trello",
  method: "GET",
  handler: trelloWebhook,
});

http.route({
  path: "/api/webhooks/trello",
  method: "POST",
  handler: trelloWebhook,
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

export default http;
