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
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password<DataModel>({
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
    }),
  ],
});
