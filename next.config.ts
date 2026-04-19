import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Auth token do uploadu source maps (ustaw SENTRY_AUTH_TOKEN na Vercel)
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Nie zaśmiecaj logów buildu gdy brak auth token (lokalnie)
  silent: !process.env.CI && !process.env.SENTRY_AUTH_TOKEN,

  // Uploaduj więcej plików source map (lepsza pokrycie błędów)
  widenClientFileUpload: true,

  // Usuń source mapy po uploadzie — nie lądują w bundlu produkcyjnym
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Wyłącz debug logger Sentry w bundlu produkcyjnym
  disableLogger: true,

  // Automatyczne Vercel Cron Monitors (jeśli używasz Vercel Cron)
  automaticVercelMonitors: true,
});
