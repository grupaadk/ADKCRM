// Sentry wrapper dla Convex actions.
// WAŻNE: używaj tylko w actions (nie w queries/mutations — te działają
// w V8 isolate bez pełnego Node.js i nie mogą robić zewnętrznych fetchów).
//
// Użycie w akcji:
//   import { captureConvexException } from "./lib/sentry";
//   try { ... } catch (err) { await captureConvexException(err, { fn: "myAction" }); throw err; }

import * as Sentry from "@sentry/node";

let initialized = false;

function init(): boolean {
  if (initialized) return true;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0,
    // Wyłącz integracje Node.js których Convex nie obsługuje
    defaultIntegrations: false,
  });
  initialized = true;
  return true;
}

/** Wyślij wyjątek do Sentry z opcjonalnym kontekstem. */
export async function captureConvexException(
  error: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  if (!init()) return;

  Sentry.withScope((scope) => {
    scope.setTag("runtime", "convex-backend");
    if (context) scope.setExtras(context);
    Sentry.captureException(error);
  });

  // flush jest konieczny — Convex nie czeka na pending I/O po zakończeniu funkcji
  await Sentry.flush(2000).catch(() => undefined);
}

/**
 * Wrapper automatycznie wyłapujący wyjątki.
 *
 * Przykład:
 *   export const myAction = action({ handler: withSentryAction("myAction", async (ctx, args) => {
 *     // Twój kod...
 *   })});
 */
export function withSentryAction<A, R>(
  name: string,
  fn: (ctx: A, args: Record<string, unknown>) => Promise<R>,
): (ctx: A, args: Record<string, unknown>) => Promise<R> {
  return async (ctx, args) => {
    try {
      return await fn(ctx, args);
    } catch (error) {
      await captureConvexException(error, { convexFn: name });
      throw error;
    }
  };
}
