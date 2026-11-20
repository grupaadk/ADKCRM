import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import type { DataModel } from "./_generated/dataModel";
import type { Value } from "convex/values";

/**
 * Konfiguracja Convex Auth.
 *
 * Używamy Password providera z username (string) jako identyfikatorem konta.
 * Login użytkownika jest przechowywany w polu `email` w tabeli `users` —
 * to wymóg Password providera, który traktuje `email` jako external account id.
 * W UI to pole nazywane jest "Login".
 *
 * Publiczna rejestracja jest zablokowana. Konta tworzy wyłącznie admin
 * przez `createAccount` z `@convex-dev/auth/server` (patrz `convex/users.ts`).
 */
/**
 * Weryfikuje token Google reCAPTCHA w usłudze siteverify.
 * Rzuca błąd, jeśli brakuje konfiguracji, token jest pusty lub Google odrzuci weryfikację.
 */
export async function verifyRecaptchaToken(token: Value | undefined) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    throw new Error("Brak konfiguracji RECAPTCHA_SECRET_KEY na serwerze.");
  }
  if (typeof token !== "string" || token.trim().length === 0) {
    throw new Error("Potwierdź, że nie jesteś robotem (reCAPTCHA).");
  }

  const body = new URLSearchParams({
    secret,
    response: token,
  });

  const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error("Błąd połączenia z usługą reCAPTCHA.");
  }

  const data = (await res.json()) as { success?: boolean; score?: number };
  if (!data.success) {
    throw new Error("Weryfikacja reCAPTCHA nie powiodła się.");
  }
  if (typeof data.score === "number" && data.score < 0.5) {
    throw new Error("Weryfikacja reCAPTCHA nie przeszła oceny bezpieczeństwa.");
  }
}

const basePassword = Password<DataModel>({
  profile(params: Record<string, Value | undefined>) {
    if (params.flow === "signUp") {
      throw new Error(
        "Publiczna rejestracja jest wyłączona. Skontaktuj się z administratorem.",
      );
    }
    const rawLogin = params.email;
    if (typeof rawLogin !== "string" || rawLogin.trim().length === 0) {
      throw new Error("Brak loginu");
    }
    const login = rawLogin.toLowerCase().trim();
    return { email: login };
  },
  validatePasswordRequirements(password: string) {
    if (typeof password !== "string" || password.length < 8) {
      throw new Error("Hasło musi mieć co najmniej 8 znaków.");
    }
  },
});

const passwordWithRecaptcha: typeof basePassword = {
  ...basePassword,
  authorize: async (params, ctx) => {
    if (params.flow === "signIn") {
      await verifyRecaptchaToken(params.recaptchaToken);
    }
    return basePassword.authorize(params, ctx);
  },
};

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [passwordWithRecaptcha],
});
