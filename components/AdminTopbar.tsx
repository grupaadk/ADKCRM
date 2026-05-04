"use client"

import { usePathname } from "next/navigation"
import { Bell } from "lucide-react"

const ROUTE_LABELS: Record<string, string> = {
  "/admin": "Klienci",
  "/admin/dashboard": "Dashboard",
  "/admin/zamowienia": "Zlecenia",
  "/admin/faktury": "Faktury",
  "/admin/mail": "Mail",
  "/admin/szablony": "Szablony",
  "/admin/dokumenty": "Dokumenty",
  "/admin/ustawienia": "Ustawienia",
  "/admin/logi": "Logi systemu",
  "/admin/nowy": "Nowy klient",
}

function getTitle(pathname: string): string {
  if (pathname.startsWith("/admin/klient/") && pathname.includes("/zlecenie/")) return "Szczegóły zlecenia"
  if (pathname.startsWith("/admin/klient/")) return "Klient"
  if (pathname.startsWith("/admin/szablony/")) return "Szablon"
  return ROUTE_LABELS[pathname] ?? "Panel"
}

export function AdminTopbar() {
  const pathname = usePathname()

  return (
    <header
      className="sticky top-0 z-20 flex h-[52px] items-center gap-3 border-b px-4 shrink-0"
      style={{
        background: "rgba(246,247,249,0.92)",
        backdropFilter: "blur(8px)",
        borderColor: "var(--line)",
      }}
    >
      <div style={{ fontSize: 12.5 }}>
        <span style={{ color: "var(--text-mute)" }}>ADK</span>
        <span style={{ margin: "0 6px", color: "var(--text-mute)", opacity: 0.5 }}>›</span>
        <span style={{ color: "var(--text-strong)", fontWeight: 600 }}>
          {getTitle(pathname)}
        </span>
      </div>

      <div style={{ flex: 1 }} />

      <button
        className="btn ghost icon"
        title="Powiadomienia"
        style={{ position: "relative" }}
      >
        <Bell size={15} />
      </button>
    </header>
  )
}
