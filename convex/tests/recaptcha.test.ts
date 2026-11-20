import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { verifyRecaptchaToken } from "../auth";

describe("verifyRecaptchaToken", () => {
  const originalSecret = process.env.RECAPTCHA_SECRET_KEY;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.RECAPTCHA_SECRET_KEY = "test-secret-key";
  });

  afterEach(() => {
    process.env.RECAPTCHA_SECRET_KEY = originalSecret;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  test("throws when RECAPTCHA_SECRET_KEY is missing", async () => {
    delete process.env.RECAPTCHA_SECRET_KEY;
    await expect(verifyRecaptchaToken("some-token")).rejects.toThrow(
      "Brak konfiguracji RECAPTCHA_SECRET_KEY na serwerze.",
    );
  });

  test("throws when token is missing or empty", async () => {
    await expect(verifyRecaptchaToken(undefined)).rejects.toThrow(
      "Potwierdź, że nie jesteś robotem (reCAPTCHA).",
    );
    await expect(verifyRecaptchaToken("   ")).rejects.toThrow(
      "Potwierdź, że nie jesteś robotem (reCAPTCHA).",
    );
  });

  test("passes when Google siteverify returns success=true", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(verifyRecaptchaToken("valid-token")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.google.com/recaptcha/api/siteverify",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }),
    );
  });

  test("throws when Google siteverify returns success=false", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: false }),
    }) as unknown as typeof fetch;

    await expect(verifyRecaptchaToken("bad-token")).rejects.toThrow(
      "Weryfikacja reCAPTCHA nie powiodła się.",
    );
  });

  test("throws when Google siteverify HTTP request fails", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }) as unknown as typeof fetch;

    await expect(verifyRecaptchaToken("token")).rejects.toThrow(
      "Błąd połączenia z usługą reCAPTCHA.",
    );
  });
});
