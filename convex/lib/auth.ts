/**
 * Helpery autoryzacji dla funkcji Convex.
 *
 * Stosować w queries / mutations zamiast bezpośredniego
 * `ctx.auth.getUserIdentity()`. Identifier zalogowanego użytkownika
 * (`user.email`) jest również zapisywany w polach typu `createdBy`,
 * `performedBy`, `uploadedBy` itp.
 */
import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import type { UserRole } from "../schema";

type AuthCtx = QueryCtx | MutationCtx | ActionCtx;

/**
 * Zwraca aktualnie zalogowanego użytkownika lub `null`.
 * W actions (które nie mają dostępu do DB) zwraca `null` — używaj wewnątrz
 * actions tylko do sprawdzenia czy ktoś jest zalogowany; dane usera pobierz
 * przez `ctx.runQuery(api.users.me)`.
 */
export async function getCurrentUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  return await ctx.db.get(userId);
}

/**
 * Zwraca usera lub rzuca `Not authenticated`. Sprawdza również, czy konto
 * jest aktywne — nieaktywne konta są traktowane jak niezalogowane.
 */
export async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (!user) {
    throw new ConvexError("Not authenticated");
  }
  if (user.isActive !== true) {
    throw new ConvexError("Account is inactive");
  }
  return user;
}

/**
 * Weryfikuje że user ma jedną z podanych ról.
 * Wymaga aktywnego konta (`requireUser`).
 */
export async function requireRole(
  ctx: QueryCtx | MutationCtx,
  ...allowed: UserRole[]
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (!user.role || !allowed.includes(user.role)) {
    throw new ConvexError("Forbidden");
  }
  return user;
}

/**
 * Zwraca identyfikator zapisywany w polach `createdBy`, `performedBy` itp.
 * Konwencja: login użytkownika (email field) — dla rekordów historycznych
 * z czasów Clerka zostają subject ID, których nie ruszamy.
 */
export function userIdentifier(user: Doc<"users">): string {
  return user.email ?? user._id;
}

/**
 * Wariant nieblokujący — pobiera identifier z bieżącej sesji lub zwraca
 * `"anonymous"`. Używać tylko w miejscach, gdzie brak loginu jest dopuszczalny
 * (np. webhooks, zadania cron). Nowy kod powinien wymagać usera przez
 * `requireUser`.
 */
export async function getUserIdentifier(
  ctx: QueryCtx | MutationCtx,
): Promise<string> {
  const user = await getCurrentUser(ctx);
  return user ? userIdentifier(user) : "anonymous";
}

/**
 * Helper dla actions — zwraca ID zalogowanego usera lub rzuca.
 * Nie ładuje dokumentu (actions nie mają ctx.db).
 */
export async function requireAuthUserIdInAction(
  ctx: ActionCtx,
): Promise<string> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("Not authenticated");
  return userId;
}

