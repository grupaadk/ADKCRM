"use client"

import React, { ReactNode, CSSProperties } from "react"
import { useStatusDef } from "@/components/StatusLabelsContext"
import { deriveStatusStyle } from "@/lib/statuses"

// ── CrmPageHeader ──────────────────────────────────────────────────
type Tab = { key: string; label: string; count?: number }

interface PageHeaderProps {
  title: string
  sub?: string
  actions?: ReactNode
  center?: ReactNode
  tabs?: Tab[]
  activeTab?: string
  onTab?: (key: string) => void
}

export function CrmPageHeader({ title, sub, actions, center, tabs, activeTab, onTab }: PageHeaderProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginBottom: tabs ? 12 : 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-strong)", letterSpacing: "-0.01em", margin: 0 }}>
            {title}
          </h1>
          {sub && (
            <p style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 3, marginBottom: 0 }}>{sub}</p>
          )}
        </div>
        {center && (
          <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", paddingBottom: 2 }}>
            {center}
          </div>
        )}
        {(actions || center) ? (
          <div style={{ flex: 1, display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end" }}>
            {actions}
          </div>
        ) : null}
      </div>

      {tabs && (
        <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--line)", marginTop: 10 }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => onTab?.(t.key)}
              style={{
                padding: "6px 14px",
                fontSize: 12.5,
                fontWeight: activeTab === t.key ? 600 : 500,
                color: activeTab === t.key ? "var(--text-strong)" : "var(--text-mute)",
                marginBottom: -1,
                background: "none",
                border: "none",
                borderBottomStyle: "solid",
                borderBottomWidth: 2,
                borderBottomColor: activeTab === t.key ? "var(--accent)" : "transparent",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {t.label}
              {t.count !== undefined && (
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  padding: "1px 6px", borderRadius: 999,
                  background: activeTab === t.key ? "var(--accent)" : "var(--panel-3)",
                  color: activeTab === t.key ? "#fff" : "var(--text-mute)",
                }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── CrmCard ────────────────────────────────────────────────────────
interface CardProps {
  title?: string
  sub?: string
  actions?: ReactNode
  children: ReactNode
  pad?: boolean
  style?: CSSProperties
}

export function CrmCard({ title, sub, actions, children, pad = true, style }: CardProps) {
  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", ...style }}>
      {(title || actions) && (
        <div
          style={{
            display: "flex", alignItems: "center",
            padding: "10px 14px",
            borderBottom: "1px solid var(--line)",
            gap: 10,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-strong)" }}>{title}</div>
            {sub && <div style={{ fontSize: 11, color: "var(--text-mute)", marginTop: 1 }}>{sub}</div>}
          </div>
          {actions && <div style={{ display: "flex", gap: 4 }}>{actions}</div>}
        </div>
      )}
      <div style={{ padding: pad ? 14 : 0, flex: 1 }}>{children}</div>
    </div>
  )
}

// ── CrmKpiCard ─────────────────────────────────────────────────────
interface KpiCardProps {
  label: string
  value: string | number
  unit?: string
  color?: "ok" | "warn" | "bad" | "acc" | "violet"
}

export function CrmKpiCard({ label, value, unit, color }: KpiCardProps) {
  const colorMap = {
    ok: "var(--ok)", warn: "var(--warn)", bad: "var(--bad)",
    acc: "var(--accent)", violet: "var(--violet)",
  }
  return (
    <div className="panel" style={{ padding: "10px 14px" }}>
      <div className="up mute">{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
        <span
          style={{
            fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums",
            color: color ? colorMap[color] : "var(--text-strong)",
          }}
        >
          {value}
        </span>
        {unit && <span className="mute" style={{ fontSize: 11 }}>{unit}</span>}
      </div>
    </div>
  )
}

// ── Pill ───────────────────────────────────────────────────────────
type PillVariant = "default" | "ok" | "warn" | "bad" | "acc" | "violet"

interface PillProps {
  variant?: PillVariant
  dot?: boolean
  children: ReactNode
}

export function Pill({ variant = "default", dot = true, children }: PillProps) {
  return (
    <span className={`pill ${variant !== "default" ? variant : ""}`}>
      {dot && <span className="dot" />}
      {children}
    </span>
  )
}

// ── StatusPill — nazwa i kolor z dynamicznego rejestru ─────────────
export function StatusPill({ status }: { status: string }) {
  const def = useStatusDef(status)
  const label = def?.label ?? status
  const style = deriveStatusStyle(def?.color ?? "#6b7280")
  return (
    <span
      className="pill"
      style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}
    >
      <span className="dot" style={{ background: style.dot }} />
      {label}
    </span>
  )
}

// ── Avatar initials ────────────────────────────────────────────────
export function CrmAvatar({ name, size = 28 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
  return (
    <span
      className="av"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  )
}

// ── Filter tab bar ─────────────────────────────────────────────────
interface FilterTabsProps {
  tabs: { key: string; label: string; count?: number }[]
  active: string
  onChange: (key: string) => void
}

export function CrmFilterTabs({ tabs, active, onChange }: FilterTabsProps) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          style={{
            padding: "5px 11px",
            fontSize: 11.5,
            borderRadius: 4,
            background: active === t.key ? "var(--accent-soft)" : "transparent",
            color: active === t.key ? "var(--accent)" : "var(--text-mute)",
            border: "1px solid",
            borderColor: active === t.key ? "var(--accent-line)" : "transparent",
            fontWeight: active === t.key ? 600 : 500,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontFamily: "inherit",
          }}
        >
          {t.label}
          {t.count !== undefined && (
            <span style={{
              fontSize: 10, fontWeight: 600,
              padding: "0px 5px", borderRadius: 999,
              background: active === t.key ? "var(--accent)" : "var(--panel-3)",
              color: active === t.key ? "#fff" : "var(--text-mute)",
            }}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ── Search input ───────────────────────────────────────────────────
interface SearchInputProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  width?: number
}

export function CrmSearch({ value, onChange, placeholder = "Szukaj…", width = 260 }: SearchInputProps) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 7,
      background: "var(--panel-2)", border: "1px solid var(--line)",
      borderRadius: 5, padding: "5px 10px", width,
    }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-mute)" strokeWidth="2.2">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1, background: "none", border: "none", outline: "none",
          color: "var(--text)", fontSize: 12.5,
        }}
      />
      {value && (
        <button onClick={() => onChange("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--text-mute)" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  )
}

// ── Toolbar wrapper ────────────────────────────────────────────────
export function CrmToolbar({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      className="panel"
      style={{
        padding: "10px 12px",
        marginBottom: 12,
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ── Progress bar ───────────────────────────────────────────────────
export function CrmProgressBar({ value, color = "var(--accent)", height = 4 }: { value: number; color?: string; height?: number }) {
  return (
    <div className="bar" style={{ height }}>
      <i style={{ width: `${Math.min(value, 100)}%`, background: color }} />
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────
export function CrmEmptyState({ message = "Brak danych" }: { message?: string }) {
  return (
    <div className="mute" style={{ padding: "40px 20px", textAlign: "center", fontSize: 12.5 }}>
      {message}
    </div>
  )
}

// ── Format helpers ─────────────────────────────────────────────────
export function fmtPLN(v: number | undefined | null): string {
  if (v == null) return "—"
  return new Intl.NumberFormat("pl-PL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v)
}

export function fmtDate(ms: number | string | undefined): string {
  if (!ms) return "—"
  const d = new Date(typeof ms === "string" ? ms : ms)
  return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" })
}
