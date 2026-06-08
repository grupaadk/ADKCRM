"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";

function getInitials(value?: string | null): string {
  if (!value) return "?";
  const trimmed = value.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

function roleLabel(role?: string): string {
  switch (role) {
    case "admin":
      return "Administrator";
    case "sales":
      return "Sprzedaż";
    case "montaz":
      return "Montaż";
    default:
      return "—";
  }
}

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const me = useQuery(api.users.me);
  const setColor = useMutation(api.users.setColor);
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    router.replace("/login");
  }

  const displayName = me?.displayName ?? me?.login ?? "";
  const initials = getInitials(me?.displayName || me?.login);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={me?.login ?? "Konto"}
        className="flex size-8 items-center justify-center rounded-full text-[12px] font-semibold text-white"
        style={{ background: me?.color ?? "var(--accent, #50253F)" }}
      >
        {initials}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-56 rounded-md border shadow-lg z-30"
          style={{ background: "white", borderColor: "var(--line, #e5e5e5)" }}
        >
          <div className="px-3 py-2.5 border-b" style={{ borderColor: "var(--line, #e5e5e5)" }}>
            <div className="text-[13px] font-semibold text-gray-900">{displayName || "Konto"}</div>
            {me?.login && (
              <div className="text-[11px] text-gray-500 mt-0.5">@{me.login}</div>
            )}
            <div className="text-[11px] text-gray-500 mt-1">{roleLabel(me?.role)}</div>
          </div>
          <Link
            href="/admin/ustawienia/konto"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-[13px] text-gray-700 hover:bg-gray-100"
          >
            Zmień hasło
          </Link>

          {/* Kolor konta */}
          <div className="border-t" style={{ borderColor: "var(--line, #e5e5e5)" }}>
            <button
              type="button"
              onClick={() => setShowColorPicker((v) => !v)}
              className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-gray-700 hover:bg-gray-100"
            >
              <span
                style={{
                  display: "inline-block",
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: me?.color ?? "#ccc",
                  border: "1px solid rgba(0,0,0,0.12)",
                  flexShrink: 0,
                }}
              />
              Kolor konta
            </button>
            {showColorPicker && (
              <div className="px-3 pb-3">
                <input
                  type="color"
                  defaultValue={me?.color ?? "#50253F"}
                  onChange={(e) => {
                    void setColor({ color: e.target.value });
                  }}
                  style={{
                    width: "100%",
                    height: 32,
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    padding: 0,
                    background: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    void setColor({ color: undefined });
                    setShowColorPicker(false);
                  }}
                  className="mt-1 w-full text-center text-[11px] text-gray-400 hover:text-gray-600"
                >
                  Usuń kolor
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="block w-full text-left px-3 py-2 text-[13px] text-gray-700 hover:bg-gray-100 border-t"
            style={{ borderColor: "var(--line, #e5e5e5)" }}
          >
            Wyloguj się
          </button>
        </div>
      )}

      {!compact && false && <span className="hidden">{me?.login}</span>}
    </div>
  );
}
