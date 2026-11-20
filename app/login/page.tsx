"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

interface Grecaptcha {
  ready: (cb: () => void) => void;
  render: (
    container: HTMLElement,
    parameters: {
      sitekey: string;
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    },
  ) => number;
  reset: (widgetId?: number) => void;
}

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

const RECAPTCHA_SITE_KEY =
  process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ||
  "6Lc8fykuAAAAAHaKhCBymLze0Wktfqm2xMjUltkN";

export default function LoginPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const search = useSearchParams();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<number | null>(null);

  const renderRecaptcha = useCallback(() => {
    if (!RECAPTCHA_SITE_KEY) return;
    if (!recaptchaContainerRef.current) return;
    if (widgetIdRef.current !== null) return;
    const grecaptcha = window.grecaptcha;
    if (!grecaptcha?.ready) return;

    grecaptcha.ready(() => {
      if (!recaptchaContainerRef.current || widgetIdRef.current !== null) return;
      if (!window.grecaptcha?.render) return;
      widgetIdRef.current = window.grecaptcha.render(recaptchaContainerRef.current, {
        sitekey: RECAPTCHA_SITE_KEY,
        callback: (token: string) => {
          setRecaptchaToken(token);
          setError(null);
        },
        "expired-callback": () => {
          setRecaptchaToken(null);
        },
        "error-callback": () => {
          setRecaptchaToken(null);
          setError("Błąd ładowania reCAPTCHA. Odśwież stronę i spróbuj ponownie.");
        },
      });
    });
  }, []);

  useEffect(() => {
    renderRecaptcha();
  }, [renderRecaptcha]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!RECAPTCHA_SITE_KEY) {
      setError("Brak konfiguracji klucza reCAPTCHA.");
      return;
    }

    if (!recaptchaToken) {
      setError("Potwierdź, że nie jesteś robotem.");
      return;
    }

    setSubmitting(true);
    try {
      await signIn("password", {
        flow: "signIn",
        email: login.trim().toLowerCase(),
        password,
        recaptchaToken,
      });
      const next = search.get("next") ?? "/admin/kalendarz";
      router.replace(next);
    } catch {
      setError("Nieprawidłowy login, hasło lub wygasła weryfikacja reCAPTCHA.");
      setRecaptchaToken(null);
      if (widgetIdRef.current !== null) {
        window.grecaptcha?.reset(widgetIdRef.current);
      }
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

        {RECAPTCHA_SITE_KEY ? (
          <>
            <Script
              src="https://www.google.com/recaptcha/api.js?render=explicit"
              strategy="afterInteractive"
              onLoad={renderRecaptcha}
              onReady={renderRecaptcha}
            />
            <div className="flex justify-center">
              <div ref={recaptchaContainerRef} />
            </div>
          </>
        ) : (
          <div
            style={{
              fontSize: 12,
              color: "#92400e",
              background: "#fffbeb",
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #fde68a",
            }}
          >
            Brak klucza reCAPTCHA (`NEXT_PUBLIC_RECAPTCHA_SITE_KEY`). Jeśli działasz lokalnie, zrestartuj serwer (`npm run dev`).
          </div>
        )}

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
