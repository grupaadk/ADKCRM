"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api";

function convexErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof ConvexError) {
    return typeof e.data === "string" ? e.data : fallback;
  }
  return e instanceof Error ? e.message : fallback;
}

export default function MyAccountPage() {
  const me = useQuery(api.users.me);
  const changeOwnPassword = useAction(api.users.changeOwnPassword);
  const updateOwnProfile = useMutation(api.users.updateOwnProfile);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (me) {
      setFirstName(me.firstName ?? "");
      setLastName(me.lastName ?? "");
      setPhone(me.phone ?? "");
    }
  }, [me]);

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    setProfileMessage(null);
    setProfileBusy(true);
    try {
      await updateOwnProfile({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      setProfileMessage({ type: "ok", text: "Dane zostały zapisane." });
    } catch (e) {
      setProfileMessage({
        type: "err",
        text: convexErrorMessage(e, "Błąd zapisu danych."),
      });
    } finally {
      setProfileBusy(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (newPassword !== newPasswordConfirm) {
      setMessage({ type: "err", text: "Nowe hasła nie są takie same." });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ type: "err", text: "Nowe hasło musi mieć co najmniej 8 znaków." });
      return;
    }
    setBusy(true);
    try {
      await changeOwnPassword({ oldPassword, newPassword });
      setMessage({ type: "ok", text: "Hasło zostało zmienione." });
      setOldPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
    } catch (e) {
      setMessage({
        type: "err",
        text: convexErrorMessage(e, "Błąd zmiany hasła."),
      });
    } finally {
      setBusy(false);
    }
  }

  if (me === undefined) {
    return <div className="p-6 text-sm text-gray-500">Ładowanie…</div>;
  }
  if (!me) {
    return <div className="p-6 text-sm text-red-600">Nie zalogowano.</div>;
  }

  return (
    <div className="max-w-md">
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Moje konto</h1>

      <div className="rounded-md border border-gray-200 bg-white p-4 mb-6">
        <div className="text-sm text-gray-600">Login</div>
        <div className="text-base font-mono text-gray-900">{me.login}</div>
        {me.displayName && (
          <>
            <div className="text-sm text-gray-600 mt-3">Nazwa wyświetlana</div>
            <div className="text-base text-gray-900">{me.displayName}</div>
          </>
        )}
        <div className="text-sm text-gray-600 mt-3">Rola</div>
        <div className="text-base text-gray-900">
          {me.role === "admin" ? "Administrator" : me.role === "sales" ? "Sprzedaż" : me.role === "montaz" ? "Montaż" : "—"}
        </div>
      </div>

      <form onSubmit={handleProfileSubmit} className="rounded-md border border-gray-200 bg-white p-4 mb-6 flex flex-col gap-3">
        <h2 className="text-base font-semibold text-gray-900">Dane osobowe i kontaktowe</h2>

        <label className="text-sm">
          Imię
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            disabled={profileBusy}
            placeholder="np. Wojtek"
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          />
        </label>

        <label className="text-sm">
          Nazwisko
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            disabled={profileBusy}
            placeholder="np. Zapora"
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          />
        </label>

        <label className="text-sm">
          Numer telefonu
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={profileBusy}
            placeholder="np. +48 600 000 000"
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          />
        </label>

        {profileMessage && (
          <div
            className={
              profileMessage.type === "ok"
                ? "rounded bg-green-50 px-3 py-2 text-sm text-green-700"
                : "rounded bg-red-50 px-3 py-2 text-sm text-red-700"
            }
          >
            {profileMessage.text}
          </div>
        )}

        <button
          type="submit"
          disabled={profileBusy}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {profileBusy ? "Zapisywanie…" : "Zapisz dane"}
        </button>
      </form>

      <form onSubmit={handleSubmit} className="rounded-md border border-gray-200 bg-white p-4 flex flex-col gap-3">
        <h2 className="text-base font-semibold text-gray-900">Zmiana hasła</h2>

        <label className="text-sm">
          Stare hasło
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            autoComplete="current-password"
            required
            disabled={busy}
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          />
        </label>

        <label className="text-sm">
          Nowe hasło (min. 8 znaków)
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            required
            disabled={busy}
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          />
        </label>

        <label className="text-sm">
          Powtórz nowe hasło
          <input
            type="password"
            value={newPasswordConfirm}
            onChange={(e) => setNewPasswordConfirm(e.target.value)}
            autoComplete="new-password"
            required
            disabled={busy}
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          />
        </label>

        {message && (
          <div
            className={
              message.type === "ok"
                ? "rounded bg-green-50 px-3 py-2 text-sm text-green-700"
                : "rounded bg-red-50 px-3 py-2 text-sm text-red-700"
            }
          >
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={busy || !oldPassword || !newPassword || !newPasswordConfirm}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {busy ? "Zapisywanie…" : "Zmień hasło"}
        </button>
      </form>
    </div>
  );
}
