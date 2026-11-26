"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useAction } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import toast from "react-hot-toast";
import { HardDrive, RefreshCw, KeyRound, Loader2 } from "lucide-react";

const convexSiteUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL?.replace(".cloud", ".site") ?? "";

function formatTokenValidity(expiresAt: number, now: number): string {
  const diffMin = Math.round((expiresAt - now) / 60000);
  if (diffMin <= 0) return "Token wygasł";
  if (diffMin < 60) return `Ważny jeszcze ${diffMin} min`;
  const hours = Math.floor(diffMin / 60);
  const remMin = diffMin % 60;
  return remMin > 0 ? `Ważny jeszcze ${hours} godz. ${remMin} min` : `Ważny jeszcze ${hours} godz.`;
}

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
  const driveConnection = useQuery(api.googleDrive.getConnectionStatus);
  const setColor = useMutation(api.users.setColor);
  const refreshDriveToken = useAction(api.googleDrive.refreshAccessToken);
  const disconnectDrive = useMutation(api.googleDrive.disconnect);
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [refreshingDrive, setRefreshingDrive] = useState(false);
  const [disconnectingDrive, setDisconnectingDrive] = useState(false);
  const [nowTs, setNowTs] = useState<number>(0);
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

  async function handleRefreshDriveToken() {
    setRefreshingDrive(true);
    try {
      await refreshDriveToken();
      setNowTs(Date.now());
      toast.success("Token Google Drive został odświeżony.");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Nie udało się odświeżyć tokenu.";
      toast.error(msg);
    } finally {
      setRefreshingDrive(false);
    }
  }

  async function handleDisconnectDrive() {
    if (!confirm("Czy na pewno chcesz rozłączyć Google Drive?")) return;
    setDisconnectingDrive(true);
    try {
      await disconnectDrive();
      toast.success("Google Drive został rozłączony.");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Nie udało się rozłączyć Google Drive.";
      toast.error(msg);
    } finally {
      setDisconnectingDrive(false);
    }
  }

  function handleDriveOAuth() {
    if (!convexSiteUrl) {
      toast.error("Brak konfiguracji adresu Convex Site URL.");
      return;
    }
    const appUrl = encodeURIComponent(window.location.origin);
    const userId = encodeURIComponent(me?.displayName || me?.login || "unknown");
    const returnPath = encodeURIComponent(
      window.location.pathname || "/admin/ustawienia"
    );
    const authUrl = `${convexSiteUrl}/api/google-drive/auth?appUrl=${appUrl}&userId=${userId}&returnPath=${returnPath}`;
    setOpen(false);
    window.location.href = authUrl;
  }

  const displayName = me?.displayName ?? me?.login ?? "";
  const initials = getInitials(me?.displayName || me?.login);

  const isDriveConnected = driveConnection?.connectionStatus === "connected";
  const isDriveFailed = driveConnection?.connectionStatus === "refresh_failed";
  const isDriveDisconnected = driveConnection === null;
  const showDriveAlertDot = isDriveFailed || isDriveDisconnected;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) setNowTs(Date.now());
            return next;
          });
        }}
        title={
          isDriveFailed
            ? "Google Drive wymaga odnowienia tokenu"
            : isDriveDisconnected
              ? "Google Drive niepołączony"
              : (me?.login ?? "Konto")
        }
        className="relative flex size-8 items-center justify-center rounded-full text-[12px] font-semibold text-white cursor-pointer"
        style={{ background: me?.color ?? "var(--accent, #50253F)" }}
      >
        {initials}
        {showDriveAlertDot && (
          <span
            className={`absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-white ${
              isDriveFailed ? "bg-red-500" : "bg-amber-400"
            }`}
          />
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-64 rounded-md border shadow-lg z-30"
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

          {/* Google Drive */}
          <div
            className="border-t px-3 py-2.5 space-y-2"
            style={{ borderColor: "var(--line, #e5e5e5)" }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <HardDrive size={13} className="text-gray-500 shrink-0" />
                <span className="text-[12px] font-semibold text-gray-800 truncate">
                  Google Drive
                </span>
              </div>
              {driveConnection === undefined ? (
                <span className="text-[10px] text-gray-400">Ładowanie…</span>
              ) : (
                <span
                  className={`inline-flex items-center gap-1 text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                    isDriveConnected
                      ? "bg-emerald-50 text-emerald-700"
                      : isDriveFailed
                        ? "bg-red-50 text-red-700"
                        : "bg-gray-100 text-gray-600"
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      isDriveConnected
                        ? "bg-emerald-500"
                        : isDriveFailed
                          ? "bg-red-500"
                          : "bg-gray-400"
                    }`}
                  />
                  {isDriveConnected
                    ? "Połączono"
                    : isDriveFailed
                      ? "Błąd tokenu"
                      : "Rozłączono"}
                </span>
              )}
            </div>

            {driveConnection && (
              <div className="space-y-0.5">
                {driveConnection.connectedEmail && (
                  <div className="text-[11px] text-gray-600 truncate">
                    {driveConnection.connectedEmail}
                  </div>
                )}
                {driveConnection.expiresAt > 0 && nowTs > 0 && (
                  <div className="text-[10.5px] text-gray-400">
                    {formatTokenValidity(driveConnection.expiresAt, nowTs)}
                  </div>
                )}
              </div>
            )}

            {driveConnection !== undefined && (
              <div className="flex flex-col gap-1.5 pt-0.5">
                {isDriveConnected ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      disabled={refreshingDrive}
                      onClick={() => void handleRefreshDriveToken()}
                      className="inline-flex items-center justify-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
                      title="Odśwież bieżący access token"
                    >
                      {refreshingDrive ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <RefreshCw size={11} />
                      )}
                      <span>Odśwież</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDriveOAuth}
                      className="inline-flex items-center justify-center gap-1 rounded border border-teal-200 bg-teal-50/70 px-2 py-1 text-[11px] font-medium text-teal-800 hover:bg-teal-100/70 cursor-pointer"
                      title="Odnów autoryzację Google bez rozłączania i bez utraty folderów"
                    >
                      <KeyRound size={11} />
                      <span>Odnów zgodę</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleDriveOAuth}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded bg-[#0e7490] px-2.5 py-1.5 text-[11.5px] font-semibold text-white hover:bg-[#0c637a] transition-colors cursor-pointer"
                  >
                    <KeyRound size={12} />
                    <span>
                      {isDriveFailed
                        ? "Połącz ponownie z Google"
                        : "Połącz Google Drive"}
                    </span>
                  </button>
                )}

                {me?.role === "admin" && (
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    {driveConnection ? (
                      <button
                        type="button"
                        disabled={disconnectingDrive}
                        onClick={() => void handleDisconnectDrive()}
                        className="text-[11px] text-red-500 hover:text-red-700 disabled:opacity-50 cursor-pointer"
                      >
                        {disconnectingDrive ? "Rozłączanie…" : "Rozłącz"}
                      </button>
                    ) : (
                      <span />
                    )}
                    <Link
                      href="/admin/ustawienia"
                      onClick={() => setOpen(false)}
                      className="text-[11px] text-gray-400 hover:text-gray-700"
                    >
                      Konfiguracja folderów →
                    </Link>
                  </div>
                )}
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
