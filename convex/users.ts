/**
 * Zarządzanie użytkownikami wewnętrznymi.
 *
 * - `me` — bieżący zalogowany user (do UI)
 * - `list` / `create` / `setRole` / `resetPassword` / `setActive` /
 *   `updateProfile` — operacje administracyjne (wymagają roli `admin`)
 * - `changeOwnPassword` — zmiana własnego hasła (każdy zalogowany)
 */
import { v, ConvexError } from "convex/values";
import {
  createAccount,
  modifyAccountCredentials,
  retrieveAccount,
  invalidateSessions,
  getAuthUserId,
} from "@convex-dev/auth/server";
import {
  action,
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { getCurrentUser, requireUser, requireRole } from "./lib/auth";

const userRoleValidator = v.union(
  v.literal("admin"),
  v.literal("sales"),
  v.literal("montaz"),
);

function normalizeLogin(login: string): string {
  return login.toLowerCase().trim();
}

function validatePassword(password: string) {
  if (typeof password !== "string" || password.length < 8) {
    throw new ConvexError("Hasło musi mieć co najmniej 8 znaków.");
  }
}

function validateLogin(login: string) {
  if (!login || login.length < 2) {
    throw new ConvexError("Login musi mieć co najmniej 2 znaki.");
  }
  if (!/^[a-z0-9._-]+$/i.test(login)) {
    throw new ConvexError(
      "Login może zawierać tylko litery, cyfry, kropkę, kreskę i podkreślnik.",
    );
  }
}

/**
 * Bieżący zalogowany user (z bazy). Zwraca `null` jeśli niezalogowany
 * lub konto nieaktywne (UI traktuje tak samo jak niezalogowanego).
 */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || user.isActive !== true) return null;
    return {
      _id: user._id,
      login: user.email,
      displayName: user.displayName,
      role: user.role,
      isActive: user.isActive,
    };
  },
});

/**
 * Lista wszystkich userów (admin only).
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, "admin");
    const users = await ctx.db.query("users").collect();
    return users
      .map((u) => ({
        _id: u._id,
        _creationTime: u._creationTime,
        login: u.email,
        displayName: u.displayName,
        role: u.role,
        isActive: u.isActive ?? false,
      }))
      .sort((a, b) => (a.login ?? "").localeCompare(b.login ?? ""));
  },
});

/**
 * Mutation wewnętrzna — aktualizuje pola usera. Wywoływana z akcji
 * po `createAccount` (które tworzy podstawowy rekord przez Password
 * provider, ale nie ustawia naszych pól role/isActive/displayName).
 */
export const _internalUpdateUserFields = internalMutation({
  args: {
    userId: v.id("users"),
    role: v.optional(userRoleValidator),
    isActive: v.optional(v.boolean()),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: Partial<Doc<"users">> = {};
    if (args.role !== undefined) patch.role = args.role;
    if (args.isActive !== undefined) patch.isActive = args.isActive;
    if (args.displayName !== undefined) patch.displayName = args.displayName;
    await ctx.db.patch(args.userId, patch);
  },
});

/**
 * Admin tworzy nowe konto użytkownika.
 *
 * To jest `action` bo `createAccount` z Convex Auth musi działać
 * w runtime Node (hashing scrypt). Wewnątrz wywołuje też internal mutation
 * żeby ustawić role/isActive/displayName.
 */
export const create = action({
  args: {
    login: v.string(),
    password: v.string(),
    role: userRoleValidator,
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ userId: Id<"users">; login: string }> => {
    // Sprawdzenie uprawnień admina przez query w runtime
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) throw new ConvexError("Not authenticated");
    const currentUser: Doc<"users"> | null = await ctx.runQuery(
      internal.users._internalGetUser,
      { userId: currentUserId },
    );
    if (
      !currentUser ||
      currentUser.isActive !== true ||
      currentUser.role !== "admin"
    ) {
      throw new ConvexError("Forbidden");
    }

    const login = normalizeLogin(args.login);
    validateLogin(login);
    validatePassword(args.password);

    // Sprawdź czy login już zajęty
    const existing: Doc<"users"> | null = await ctx.runQuery(
      internal.users._internalFindByLogin,
      { login },
    );
    if (existing) {
      throw new ConvexError("Użytkownik o tym loginie już istnieje.");
    }

    const created = await createAccount(ctx, {
      provider: "password",
      account: { id: login, secret: args.password },
      profile: { email: login },
      shouldLinkViaEmail: false,
      shouldLinkViaPhone: false,
    });

    await ctx.runMutation(internal.users._internalUpdateUserFields, {
      userId: created.user._id,
      role: args.role,
      isActive: true,
      displayName: args.displayName,
    });

    return { userId: created.user._id, login };
  },
});

export const _internalGetUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => ctx.db.get(args.userId),
});

export const _internalFindByLogin = internalQuery({
  args: { login: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.login))
      .unique();
  },
});

/**
 * Admin zmienia rolę usera.
 */
export const setRole = mutation({
  args: {
    userId: v.id("users"),
    role: userRoleValidator,
  },
  handler: async (ctx, args) => {
    const admin = await requireRole(ctx, "admin");
    if (admin._id === args.userId) {
      throw new ConvexError("Nie możesz zmienić własnej roli.");
    }
    const target = await ctx.db.get(args.userId);
    if (!target) throw new ConvexError("Użytkownik nie istnieje.");
    await ctx.db.patch(args.userId, { role: args.role });
  },
});

/**
 * Admin aktywuje / dezaktywuje konto. Dezaktywacja unieważnia też sesje.
 */
export const setActive = action({
  args: {
    userId: v.id("users"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) throw new ConvexError("Not authenticated");
    const currentUser: Doc<"users"> | null = await ctx.runQuery(
      internal.users._internalGetUser,
      { userId: currentUserId },
    );
    if (
      !currentUser ||
      currentUser.isActive !== true ||
      currentUser.role !== "admin"
    ) {
      throw new ConvexError("Forbidden");
    }
    if (currentUser._id === args.userId) {
      throw new ConvexError("Nie możesz dezaktywować własnego konta.");
    }
    await ctx.runMutation(internal.users._internalUpdateUserFields, {
      userId: args.userId,
      isActive: args.isActive,
    });
    if (!args.isActive) {
      await invalidateSessions(ctx, { userId: args.userId });
    }
  },
});

/**
 * Admin edytuje displayName.
 */
export const updateProfile = mutation({
  args: {
    userId: v.id("users"),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");
    const target = await ctx.db.get(args.userId);
    if (!target) throw new ConvexError("Użytkownik nie istnieje.");
    await ctx.db.patch(args.userId, { displayName: args.displayName });
  },
});

/**
 * Admin resetuje hasło wybranego usera (wpisuje nowe). Unieważnia sesje.
 */
export const resetPassword = action({
  args: {
    userId: v.id("users"),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) throw new ConvexError("Not authenticated");
    const currentUser: Doc<"users"> | null = await ctx.runQuery(
      internal.users._internalGetUser,
      { userId: currentUserId },
    );
    if (
      !currentUser ||
      currentUser.isActive !== true ||
      currentUser.role !== "admin"
    ) {
      throw new ConvexError("Forbidden");
    }
    validatePassword(args.newPassword);

    const target: Doc<"users"> | null = await ctx.runQuery(
      internal.users._internalGetUser,
      { userId: args.userId },
    );
    if (!target || !target.email) {
      throw new ConvexError("Użytkownik nie istnieje lub nie ma loginu.");
    }
    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: target.email, secret: args.newPassword },
    });
    // Unieważnij sesje resetowanego usera (poza bieżącą, czyli adminem)
    await invalidateSessions(ctx, { userId: args.userId });
  },
});

/**
 * Każdy zalogowany user może zmienić własne hasło.
 * Wymaga podania starego hasła do weryfikacji.
 */
export const changeOwnPassword = action({
  args: {
    oldPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) throw new ConvexError("Not authenticated");
    const currentUser: Doc<"users"> | null = await ctx.runQuery(
      internal.users._internalGetUser,
      { userId: currentUserId },
    );
    if (
      !currentUser ||
      currentUser.isActive !== true ||
      !currentUser.email
    ) {
      throw new ConvexError("Not authenticated");
    }
    validatePassword(args.newPassword);

    try {
      const retrieved = await retrieveAccount(ctx, {
        provider: "password",
        account: { id: currentUser.email, secret: args.oldPassword },
      });
      if (!retrieved) {
        throw new ConvexError("Stare hasło jest nieprawidłowe.");
      }
    } catch {
      throw new ConvexError("Stare hasło jest nieprawidłowe.");
    }

    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: currentUser.email, secret: args.newPassword },
    });
  },
});

/**
 * Helper internal — wywoływany z seed scriptu lub initial setup.
 * Tworzy pierwszego admina jeśli nie istnieje żaden user.
 *
 * Uwaga: action wewnętrzna, bo używa createAccount.
 */
export const seedInitialAdmin = action({
  args: {
    login: v.string(),
    password: v.string(),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const users: Doc<"users">[] = await ctx.runQuery(internal.users._listAll, {});
    if (users.length > 0) {
      throw new ConvexError(
        "Konta już istnieją — seed dozwolony tylko gdy baza userów jest pusta.",
      );
    }
    const login = normalizeLogin(args.login);
    validateLogin(login);
    validatePassword(args.password);

    const created = await createAccount(ctx, {
      provider: "password",
      account: { id: login, secret: args.password },
      profile: { email: login },
      shouldLinkViaEmail: false,
      shouldLinkViaPhone: false,
    });
    await ctx.runMutation(internal.users._internalUpdateUserFields, {
      userId: created.user._id,
      role: "admin",
      isActive: true,
      displayName: args.displayName,
    });
    return { userId: created.user._id, login };
  },
});

export const _listAll = internalQuery({
  args: {},
  handler: async (ctx) => ctx.db.query("users").collect(),
});

/**
 * Zwraca listę użytkowników dostępnych do przypisania (role: sales + admin).
 * Dostępne dla każdego zalogowanego usera (do przypisywania zadań itp.)
 */
export const listAssignable = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const users = await ctx.db.query("users").collect();
    return users
      .filter((u) => (u.role === "sales" || u.role === "admin") && u.isActive !== false)
      .map((u) => ({
        _id: u._id,
        displayName: u.displayName,
        login: u.email,
        role: u.role,
      }))
      .sort((a, b) => (a.displayName ?? a.login ?? "").localeCompare(b.displayName ?? b.login ?? ""));
  },
});

/**
 * Sprawdza czy bieżący user ma uprawnienia do roli (przydatne w UI).
 * Public query — można wołać bez bycia adminem.
 */
export const hasAnyRole = query({
  args: { roles: v.array(userRoleValidator) },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user || user.isActive !== true || !user.role) return false;
    return args.roles.includes(user.role);
  },
});
