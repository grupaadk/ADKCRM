"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const search = useSearchParams();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn("password", {
        flow: "signIn",
        email: login.trim().toLowerCase(),
        password,
      });
      const next = search.get("next") ?? "/admin/kalendarz";
      router.replace(next);
    } catch {
      setError("Nieprawidłowy login lub hasło.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{ background: "var(--background, #f5f5f5)" }}
    >
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 w-full max-w-sm p-8 rounded-xl"
        style={{
          background: "var(--panel, #fff)",
          border: "1px solid var(--line, #e5e5e5)",
          boxShadow: "0 2px 8px rgba(0,0,0,.06)",
        }}
      >
        <div className="flex flex-col items-center gap-3 mb-2">
          <div
            className="flex size-14 items-center justify-center rounded-xl"
            style={{ background: "var(--background, #f5f5f5)" }}
          >
            <span
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: "var(--accent, #50253F)",
              }}
            >
              A
            </span>
          </div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "var(--text-strong, #111)",
            }}
          >
            ADK CRM
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-mute, #666)" }}>
            Zaloguj się, aby uzyskać dostęp do panelu.
          </p>
        </div>

        <label style={{ fontSize: 13, fontWeight: 500 }}>
          Login
          <input
            type="text"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="username"
            autoFocus
            required
            disabled={submitting}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            style={{
              borderColor: "var(--line, #e5e5e5)",
              background: "var(--background, #fff)",
            }}
          />
        </label>

        <label style={{ fontSize: 13, fontWeight: 500 }}>
          Hasło
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            disabled={submitting}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            style={{
              borderColor: "var(--line, #e5e5e5)",
              background: "var(--background, #fff)",
            }}
          />
        </label>

        {error && (
          <div
            style={{
              fontSize: 13,
              color: "#b91c1c",
              background: "#fef2f2",
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #fecaca",
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !login || !password}
          className="btn primary"
          style={{
            padding: "10px 24px",
            fontSize: 14,
            opacity: submitting ? 0.6 : 1,
            cursor: submitting ? "wait" : "pointer",
          }}
        >
          {submitting ? "Logowanie…" : "Zaloguj się"}
        </button>
      </form>
    </div>
  );
}
