"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

function convexErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof ConvexError) {
    return typeof e.data === "string" ? e.data : fallback;
  }
  return e instanceof Error ? e.message : fallback;
}

type Role = "admin" | "sales" | "montaz";

const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  sales: "Sprzedaż",
  montaz: "Montaż",
};

export default function UsersAdminPage() {
  const me = useQuery(api.users.me);
  const users = useQuery(api.users.list);
  const createUser = useAction(api.users.create);
  const setRole = useMutation(api.users.setRole);
  const setActive = useAction(api.users.setActive);
  const resetPassword = useAction(api.users.resetPassword);
  const updateProfile = useMutation(api.users.updateProfile);
  const setColor = useMutation(api.users.setColor);

  const [showAdd, setShowAdd] = useState(false);
  const [editingColorId, setEditingColorId] = useState<Id<"users"> | null>(null);
  const [newLogin, setNewLogin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<Role>("sales");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (me === undefined) {
    return <div className="p-6 text-sm text-gray-500">Ładowanie…</div>;
  }
  if (!me || me.role !== "admin") {
    return (
      <div className="p-6 text-sm text-red-600">
        Brak uprawnień — tylko administrator może zarządzać użytkownikami.
      </div>
    );
  }

  async function handleCreate() {
    setError(null);
    if (!newLogin.trim() || !newPassword) {
      setError("Wpisz login i hasło.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Hasło musi mieć co najmniej 8 znaków.");
      return;
    }
    setBusy(true);
    try {
      await createUser({
        login: newLogin.trim(),
        password: newPassword,
        role: newRole,
        displayName: newDisplayName.trim() || undefined,
      });
      setNewLogin("");
      setNewPassword("");
      setNewDisplayName("");
      setNewRole("sales");
      setShowAdd(false);
    } catch (e) {
      setError(convexErrorMessage(e, "Błąd dodawania użytkownika."));
    } finally {
      setBusy(false);
    }
  }

  async function handleRoleChange(userId: Id<"users">, role: Role) {
    try {
      await setRole({ userId, role });
    } catch (e) {
      alert(convexErrorMessage(e, "Błąd zmiany roli."));
    }
  }

  async function handleToggleActive(userId: Id<"users">, isActive: boolean) {
    const action = isActive ? "aktywować" : "dezaktywować";
    if (!confirm(`Na pewno ${action} to konto?`)) return;
    try {
      await setActive({ userId, isActive });
    } catch (e) {
      alert(convexErrorMessage(e, "Błąd zmiany statusu."));
    }
  }

  async function handleResetPassword(userId: Id<"users">, login: string) {
    const newPw = prompt(`Nowe hasło tymczasowe dla "${login}" (min. 8 znaków):`);
    if (!newPw) return;
    if (newPw.length < 8) {
      alert("Hasło musi mieć co najmniej 8 znaków.");
      return;
    }
    try {
      await resetPassword({ userId, newPassword: newPw });
      alert(`Hasło zresetowane. Przekaż użytkownikowi: ${newPw}`);
    } catch (e) {
      alert(convexErrorMessage(e, "Błąd resetu hasła."));
    }
  }

  async function handleEditDisplayName(userId: Id<"users">, current: string | undefined) {
    const next = prompt("Nazwa wyświetlana (zostaw puste aby usunąć):", current ?? "");
    if (next === null) return;
    try {
      await updateProfile({
        userId,
        displayName: next.trim() || undefined,
      });
    } catch (e) {
      alert(convexErrorMessage(e, "Błąd zapisu."));
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Użytkownicy</h1>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          {showAdd ? "Anuluj" : "Dodaj użytkownika"}
        </button>
      </div>

      {showAdd && (
        <div className="mb-6 rounded-md border border-gray-200 bg-white p-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Login
              <input
                type="text"
                value={newLogin}
                onChange={(e) => setNewLogin(e.target.value)}
                className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                placeholder="np. wojtek"
              />
            </label>
            <label className="text-sm">
              Hasło tymczasowe
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                placeholder="min. 8 znaków"
              />
            </label>
            <label className="text-sm">
              Rola
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as Role)}
                className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              >
                <option value="admin">Administrator</option>
                <option value="sales">Sprzedaż</option>
                <option value="montaz">Montaż</option>
              </select>
            </label>
            <label className="text-sm">
              Nazwa wyświetlana (opcjonalna)
              <input
                type="text"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                placeholder="np. Wojtek Zapora"
              />
            </label>
          </div>
          {error && (
            <div className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={busy}
              className="rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {busy ? "Tworzenie…" : "Utwórz"}
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-md border px-4 py-1.5 text-sm hover:bg-gray-50"
            >
              Anuluj
            </button>
          </div>
        </div>
      )}

      <div className="rounded-md border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-[12px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Login</th>
              <th className="px-3 py-2">Nazwa</th>
              <th className="px-3 py-2">Rola</th>
              <th className="px-3 py-2">Kolor</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {users === undefined && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-gray-400">
                  Ładowanie…
                </td>
              </tr>
            )}
            {users?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-gray-400">
                  Brak użytkowników.
                </td>
              </tr>
            )}
            {users?.map((u) => {
              const isSelf = u._id === me._id;
              return (
                <tr key={u._id} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono text-[13px] text-gray-900">
                    {u.login ?? "—"}
                    {isSelf && (
                      <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                        ty
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    <button
                      type="button"
                      onClick={() => handleEditDisplayName(u._id, u.displayName ?? undefined)}
                      className="text-left hover:underline"
                    >
                      {u.displayName || <span className="text-gray-400">— ustaw —</span>}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={u.role ?? ""}
                      onChange={(e) => handleRoleChange(u._id, e.target.value as Role)}
                      disabled={isSelf}
                      className="rounded border px-2 py-1 text-[13px] disabled:bg-gray-100 disabled:text-gray-500"
                    >
                      <option value="admin">{ROLE_LABELS.admin}</option>
                      <option value="sales">{ROLE_LABELS.sales}</option>
                      <option value="montaz">{ROLE_LABELS.montaz}</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        title={u.color ?? "Brak koloru"}
                        onClick={() => setEditingColorId(editingColorId === u._id ? null : u._id)}
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: u.color ?? "#e5e7eb",
                          border: "1px solid rgba(0,0,0,0.12)",
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      />
                      {editingColorId === u._id && (
                        <div className="flex items-center gap-1">
                          <input
                            type="color"
                            defaultValue={u.color ?? "#50253F"}
                            onChange={(e) => {
                              void setColor({ userId: u._id, color: e.target.value });
                            }}
                            style={{ width: 32, height: 24, border: "none", padding: 0, cursor: "pointer" }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              void setColor({ userId: u._id, color: undefined });
                              setEditingColorId(null);
                            }}
                            className="text-[11px] text-gray-400 hover:text-red-500"
                            title="Usuń kolor"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        u.isActive
                          ? "rounded bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700"
                          : "rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500"
                      }
                    >
                      {u.isActive ? "aktywny" : "nieaktywny"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleResetPassword(u._id, u.login ?? "")}
                        className="rounded border px-2 py-1 text-[12px] hover:bg-gray-50"
                      >
                        Reset hasła
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(u._id, !u.isActive)}
                        disabled={isSelf}
                        className="rounded border px-2 py-1 text-[12px] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {u.isActive ? "Dezaktywuj" : "Aktywuj"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
