"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { useQuery, useMutation, useAction } from "convex/react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { api } from "@/convex/_generated/api"
import { useStatusLabels, useStatuses } from "@/components/StatusLabelsContext"
import { deriveStatusStyle } from "@/lib/statuses"
import type { KanbanItem } from "@/convex/kanban"
import { Plus, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Archive, ArchiveRestore, Search, X, ClipboardList, Users, AlertTriangle, Package } from "lucide-react"
import NewOrderModal from "@/app/admin/klient/[id]/NewOrderModal"
import NewOpportunityModal from "@/components/NewOpportunityModal"

type DocState = "gray" | "red" | "green"

const DOC_COLORS: Record<DocState, string> = {
  gray:  "#d0d4dc",
  red:   "#ef4444",
  green: "#22c55e",
}

const DOC_KEYS = ["pomiar", "umowa", "gwarancja_alco", "odbior_inwestor", "protokol_montaz", "faktura", "reklamacja"]

const sortItemsByDuration = (a: KanbanItem, b: KanbanItem) => {
  const now = Date.now()
  const aOlder = a.statusChangedAt ? (now - a.statusChangedAt > 1000 * 60 * 60 * 24) : false
  const bOlder = b.statusChangedAt ? (now - b.statusChangedAt > 1000 * 60 * 60 * 24) : false
  if (aOlder && !bOlder) return -1
  if (!aOlder && bOlder) return 1
  return (a.statusChangedAt ?? 0) - (b.statusChangedAt ?? 0)
}

const SERVICE_COLORS = [
  { bg: "#ede9fe", text: "#6d28d9" },
  { bg: "#dbeafe", text: "#1d4ed8" },
  { bg: "#dcfce7", text: "#15803d" },
  { bg: "#fef3c7", text: "#b45309" },
  { bg: "#fce7f3", text: "#be185d" },
  { bg: "#e0f2fe", text: "#0369a1" },
  { bg: "#ffedd5", text: "#c2410c" },
  { bg: "#f0fdf4", text: "#166534" },
]

function ServiceBadges({ services }: { services: string[] }) {
  const MAX = 2
  const shown = services.slice(0, MAX)
  const rest = services.length - MAX
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 7, minWidth: 0, maxWidth: "100%" }}>
      {shown.map((s, i) => {
        const color = SERVICE_COLORS[i % SERVICE_COLORS.length]
        return (
          <span key={s} style={{
            fontSize: 10, fontWeight: 600,
            background: color.bg, color: color.text,
            borderRadius: 4, padding: "2px 7px", lineHeight: 1.5,
            whiteSpace: "nowrap",
            maxWidth: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "inline-block",
          }}>
            {s}
          </span>
        )
      })}
      {rest > 0 && (
        <span style={{
          fontSize: 10, fontWeight: 600,
          background: "#f1f5f9", color: "#64748b",
          borderRadius: 4, padding: "2px 7px", lineHeight: 1.5,
        }}>
          +{rest}
        </span>
      )}
    </div>
  )
}

function DocSquares({ docs }: { docs: Record<string, DocState> }) {
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center", marginTop: 8 }}>
      {DOC_KEYS.map((key) => (
        <div key={key} title={key.replace(/_/g, " ")} style={{
          width: 12, height: 12, borderRadius: 3,
          backgroundColor: DOC_COLORS[(docs[key] ?? "gray") as DocState],
          flexShrink: 0,
        }} />
      ))}
    </div>
  )
}

function OrderCard({
  item,
  isDragging,
  expanded,
  onDragStart,
  onDragEnd,
  onClick,
  onDelete,
  onToggleExpand,
  onArchive,
}: {
  item: KanbanItem
  isDragging: boolean
  expanded: boolean
  onDragStart: (e: React.DragEvent, item: KanbanItem) => void
  onDragEnd: () => void
  onClick: () => void
  onDelete: (item: KanbanItem) => void
  onToggleExpand: () => void
  onArchive?: (item: KanbanItem) => void
}) {
  const isPending = item.type === "pending"

  const fullName = item.clientType === "business" && item.companyName
    ? item.companyName
    : `${item.clientFirstName} ${item.clientLastName}`.trim()
  const didDragRef = useRef(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [daysInStatusLabel, setDaysInStatusLabel] = useState<string | null>(null)
  const [daysInStatusColor, setDaysInStatusColor] = useState<string>("slate")

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!item.statusChangedAt) {
        setDaysInStatusLabel(null)
        return
      }
      const diffMs = Date.now() - item.statusChangedAt
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      if (diffDays <= 0) {
        setDaysInStatusLabel("na liście: dzisiaj")
        setDaysInStatusColor("slate")
      } else if (diffDays === 1) {
        setDaysInStatusLabel("na liście: 1 dzień")
        setDaysInStatusColor("slate")
      } else {
        setDaysInStatusLabel(`na liście: ${diffDays} dni`)
        if (diffDays >= 7) {
          setDaysInStatusColor("red")
        } else if (diffDays >= 3) {
          setDaysInStatusColor("amber")
        } else {
          setDaysInStatusColor("slate")
        }
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [item.statusChangedAt])

  const titleText =
    item.type === "order" && item.orderName
      ? item.orderName
      : item.type === "pending"
        ? "Nowe zgłoszenie"
        : "—"
  const titleStyle: React.CSSProperties =
    item.type === "order" && item.orderName
      ? { fontSize: 12, fontWeight: 700, color: "var(--text-strong)", fontFamily: "monospace" }
      : { fontSize: 11.5, fontWeight: 700, color: "#b45309" }

  const assignees = item.assignees && item.assignees.length > 0
    ? item.assignees
    : item.assignedUserColor
      ? [{ color: item.assignedUserColor }]
      : [];
  
  const colors = assignees.map(a => a.color).filter(Boolean) as string[];
  const hasMultipleColors = colors.length > 1;
  const singleColor = colors.length === 1 ? colors[0] : undefined;

  let gradientStr = "";
  if (hasMultipleColors) {
    const step = 100 / colors.length;
    const stops = colors.map((c, i) => `${c} ${i * step}%, ${c} ${(i + 1) * step}%`);
    gradientStr = `linear-gradient(to bottom, ${stops.join(", ")})`;
  }

  return (
    <div
      draggable
      onClick={() => { if (!didDragRef.current) onClick() }}
      onDragStart={(e) => { didDragRef.current = false; onDragStart(e, item) }}
      onDragEnd={() => { didDragRef.current = true; setTimeout(() => { didDragRef.current = false }, 300); onDragEnd() }}
      style={{
        background: "var(--panel)",
        border: `1px solid ${isDragging ? "var(--accent)" : isPending ? "#f59e0b55" : "var(--line)"}`,
        borderRadius: 7,
        padding: expanded 
          ? `7px 8px 9px ${(singleColor || hasMultipleColors) && !isDragging ? 18 : 8}px` 
          : `6px 8px 6px ${(singleColor || hasMultipleColors) && !isDragging ? 18 : 8}px`,
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
        transition: "all 0.15s ease",
        boxShadow: isDragging ? "0 8px 20px rgba(0,0,0,0.18)" : "0 1px 3px rgba(0,0,0,0.06)",
        transform: isDragging ? "scale(1.02)" : undefined,
        opacity: isDragging ? 0.6 : 1,
        position: "relative",
        minWidth: 0,
        maxWidth: "100%",
        boxSizing: "border-box",
        overflow: confirmDelete ? "visible" : "hidden",
      }}
      onMouseEnter={(e) => {
        if (!isDragging) {
          const el = e.currentTarget as HTMLDivElement
          el.style.borderColor = "var(--accent)"
          el.style.boxShadow = "0 2px 6px rgba(0,0,0,0.1)"
          el.style.transform = "translateY(-2px)"
        }
      }}
      onMouseLeave={(e) => {
        if (!isDragging) {
          const el = e.currentTarget as HTMLDivElement
          el.style.borderColor = isPending ? "#f59e0b55" : "var(--line)"
          el.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)"
          el.style.transform = ""
        }
      }}
    >
      {(singleColor || hasMultipleColors) && !isDragging && (
        <div style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 10,
          background: hasMultipleColors ? gradientStr : singleColor,
          borderTopLeftRadius: 6,
          borderBottomLeftRadius: 6,
          zIndex: 1,
        }} />
      )}
      {/* Wiersz tytułu + akcje */}
      <div style={{ display: "flex", alignItems: "center", gap: 3, position: "relative", zIndex: 2 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...titleStyle, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.25 }}>
            {titleText}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-mute)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1, lineHeight: 1.3 }}>
            {fullName || "—"}
          </div>
          {item.customText && (
            <span className="chip-custom" style={{ marginTop: 3 }}>{item.customText}</span>
          )}
          {daysInStatusLabel && (
            <div style={{ display: "flex", marginTop: 4 }}>
              <span 
                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-[9.5px] border ${
                  daysInStatusColor === "red"
                    ? "bg-red-50 text-red-600 border-red-200/40"
                    : daysInStatusColor === "amber"
                    ? "bg-amber-50 text-amber-600 border-amber-200/40"
                    : "bg-slate-50 text-slate-500 border-slate-200/40"
                }`}
                title={`Czas w tym statusie: ${daysInStatusLabel}`}
              >
                <svg 
                  className={`size-2.5 ${
                    daysInStatusColor === "red"
                      ? "text-red-400"
                      : daysInStatusColor === "amber"
                      ? "text-amber-400"
                      : "text-slate-400"
                  }`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor" 
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span className="tabular-nums">{daysInStatusLabel}</span>
              </span>
            </div>
          )}
        </div>

        {/* Chevron rozwijania */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleExpand() }}
          style={{
            width: 18, height: 18, borderRadius: 4,
            background: "transparent", border: "none",
            color: "var(--text-mute)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: 0.6, flexShrink: 0,
            transition: "opacity 0.15s, background 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; (e.currentTarget as HTMLButtonElement).style.background = "var(--panel-2)" }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.6"; (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}
          title={expanded ? "Zwiń" : "Rozwiń szczegóły"}
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {/* Przycisk archiwizowania (tylko szanse sprzedaży) */}
        {isPending && onArchive && (
          <button
            onClick={(e) => { e.stopPropagation(); onArchive(item) }}
            style={{
              width: 18, height: 18, borderRadius: 4,
              background: "transparent", border: "none",
              color: "var(--text-mute)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: 0.4, flexShrink: 0,
              transition: "opacity 0.15s, background 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; (e.currentTarget as HTMLButtonElement).style.background = "#fef3c7"; (e.currentTarget as HTMLButtonElement).style.color = "#b45309" }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.4"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-mute)" }}
            title="Archiwizuj szansę"
          >
            <Archive size={11} />
          </button>
        )}

        {/* Przycisk usuwania */}
        <button
          onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }}
          style={{
            width: 18, height: 18, borderRadius: 4,
            background: "transparent", border: "none",
            color: "var(--text-mute)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: 0.4, flexShrink: 0,
            transition: "opacity 0.15s, background 0.15s",
            fontSize: 13, lineHeight: 1,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; (e.currentTarget as HTMLButtonElement).style.background = "#fee2e2"; (e.currentTarget as HTMLButtonElement).style.color = "#ef4444" }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.4"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-mute)" }}
          title="Usuń"
        >
          ×
        </button>
      </div>

      {/* Szczegóły rozwinięte */}
      {expanded && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed var(--line)" }}>
          {isPending && (
            <div style={{
              display: "inline-block",
              fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
              background: "#fef3c7", color: "#b45309",
              borderRadius: 4, padding: "2px 6px", marginBottom: 6,
            }}>
              NOWE
            </div>
          )}

          {item.type === "order" && item.grossAmount != null && (
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-strong)", marginBottom: 2 }}>
              {item.grossAmount.toLocaleString("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
          )}

          <ServiceBadges services={item.services} />

          {item.type === "order" && (
            <DocSquares docs={item.docs} />
          )}
        </div>
      )}

      {/* Overlay potwierdzenia usuwania */}
      {confirmDelete && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute", top: 5, right: 5, left: 5,
            background: "var(--panel)", border: "1px solid #fca5a5",
            borderRadius: 6, padding: "8px 10px",
            display: "flex", flexDirection: "column", gap: 6,
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
            zIndex: 10,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 600, color: "#dc2626" }}>
            Usunąć {item.type === "pending" ? "zgłoszenie" : "zlecenie"}?
          </span>
          <div style={{ display: "flex", gap: 5 }}>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(item) }}
              style={{
                flex: 1, padding: "4px 0", borderRadius: 4, border: "none",
                background: "#ef4444", color: "#fff",
                fontSize: 11, fontWeight: 600, cursor: "pointer",
              }}
            >
              Usuń
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(false) }}
              style={{
                flex: 1, padding: "4px 0", borderRadius: 4,
                border: "1px solid var(--line)", background: "var(--panel-2)",
                fontSize: 11, fontWeight: 500, cursor: "pointer", color: "var(--text)",
              }}
            >
              Anuluj
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Zakładka Archiwum LEAD ─────────────────────────────────────────
function ArchivedLeadsTab({ searchQuery }: { searchQuery: string }) {
  const router = useRouter()
  const archivedLeads = useQuery(api.salesOpportunities.listArchivedOpportunities)
  const unarchive = useMutation(api.salesOpportunities.unarchiveOpportunity)
  const [activeServiceFilters, setActiveServiceFilters] = useState<Set<string>>(new Set())

  if (!archivedLeads) {
    return <div style={{ padding: 32, textAlign: "center", fontSize: 13, color: "var(--text-mute)" }}>Ładowanie...</div>
  }

  const q = searchQuery.toLowerCase().trim()

  // Liczba pozycji dla każdej usługi — bez wpływu aktywnych filtrów
  const serviceCountMap: Record<string, number> = {}
  for (const opp of archivedLeads) {
    for (const s of opp.services ?? []) {
      serviceCountMap[s] = (serviceCountMap[s] ?? 0) + 1
    }
  }
  // Unikalne usługi posortowane malejąco po liczbie
  const uniqueServices = Object.entries(serviceCountMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)

  const toggleService = (name: string) => {
    setActiveServiceFilters(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  let filtered = archivedLeads

  if (activeServiceFilters.size > 0) {
    filtered = filtered.filter(opp =>
      (opp.services ?? []).some(s => activeServiceFilters.has(s))
    )
  }

  if (q) {
    filtered = filtered.filter((opp) =>
      `${opp.firstName} ${opp.lastName}`.toLowerCase().includes(q) ||
      (opp.email ?? "").toLowerCase().includes(q) ||
      (opp.services ?? []).some((s) => s.toLowerCase().includes(q))
    )
  }

  const hasActiveFilters = activeServiceFilters.size > 0 || !!q

  return (
    <div>
      {/* Chipy filtra usług */}
      {uniqueServices.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: "var(--text-mute)", alignSelf: "center", marginRight: 2, fontWeight: 500 }}>Usługi:</span>
          {uniqueServices.map((name, i) => {
            const color = SERVICE_COLORS[i % SERVICE_COLORS.length]
            const active = activeServiceFilters.has(name)
            const count = serviceCountMap[name] ?? 0
            return (
              <button
                key={name}
                onClick={() => toggleService(name)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "4px 10px", borderRadius: 20, fontSize: 11.5,
                  background: active ? color.bg : "var(--panel)",
                  color: active ? color.text : "var(--text-mute)",
                  border: `1.5px solid ${active ? color.text + "55" : "var(--line)"}`,
                  fontWeight: active ? 600 : 500, cursor: "pointer",
                  transition: "all 0.12s", fontFamily: "inherit",
                }}
              >
                {name}
                {count > 0 && (
                  <span style={{
                    minWidth: 16, height: 16, borderRadius: 8,
                    background: active ? color.text + "22" : "var(--panel-2)",
                    color: active ? color.text : "var(--text-mute)",
                    fontSize: 10, fontWeight: 700,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    padding: "0 4px", lineHeight: 1,
                  }}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
          {activeServiceFilters.size > 0 && (
            <button
              onClick={() => setActiveServiceFilters(new Set())}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "4px 8px", borderRadius: 20, fontSize: 11,
                background: "transparent", color: "var(--text-mute)",
                border: "1.5px solid var(--line)",
                fontWeight: 500, cursor: "pointer",
                transition: "all 0.12s", fontFamily: "inherit",
              }}
              title="Wyczyść filtry usług"
            >
              <X size={10} /> Wyczyść
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 && !hasActiveFilters && (
        <div style={{ padding: 32, textAlign: "center", fontSize: 13, color: "var(--text-mute)" }}>Brak zarchiwizowanych szans sprzedaży</div>
      )}
      {filtered.length === 0 && hasActiveFilters && (
        <div style={{ padding: 32, textAlign: "center", fontSize: 13, color: "var(--text-mute)" }}>Brak wyników dla wybranych filtrów</div>
      )}

      {filtered.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                {["Klient", "Etap", "Usługi", ""].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "var(--text-mute)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((opp) => (
                <tr
                  key={opp._id}
                  style={{ borderBottom: "1px solid var(--line)", cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--panel-2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                  onClick={() => router.push(`/admin/szansa/${opp._id}`)}
                >
                  <td style={{ padding: "10px 12px", color: "var(--text-strong)", fontWeight: 600 }}>
                    {opp.firstName} {opp.lastName}
                    {opp.email && <div style={{ fontSize: 10, color: "var(--text-mute)", fontWeight: 400 }}>{opp.email}</div>}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, background: opp.stage === "inquiry" ? "#dbeafe" : "#fef3c7", color: opp.stage === "inquiry" ? "#1d4ed8" : "#b45309", borderRadius: 3, padding: "2px 6px" }}>
                      {opp.stage === "inquiry" ? "Oferta wysłana" : "Oferty"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                      {(opp.services ?? []).slice(0, 3).map((s, i) => {
                        const c = SERVICE_COLORS[i % SERVICE_COLORS.length]
                        return (
                          <span key={s} style={{ fontSize: 10, fontWeight: 600, background: c.bg, color: c.text, borderRadius: 3, padding: "2px 6px" }}>{s}</span>
                        )
                      })}
                      {(opp.services ?? []).length > 3 && (
                        <span style={{ fontSize: 10, fontWeight: 600, background: "#f1f5f9", color: "#64748b", borderRadius: 3, padding: "2px 6px" }}>+{(opp.services ?? []).length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        void unarchive({ opportunityId: opp._id })
                      }}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "4px 10px", borderRadius: 5,
                        border: "1px solid var(--line)", background: "var(--panel)",
                        fontSize: 11, fontWeight: 500, color: "var(--text)",
                        cursor: "pointer",
                      }}
                      title="Przywróć z archiwum"
                    >
                      <ArchiveRestore size={12} /> Przywróć
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Zakładka Archiwum ──────────────────────────────────────────────
function ArchivedTab({ searchQuery }: { searchQuery: string }) {
  const statusLabels = useStatusLabels()
  const router = useRouter()
  const archived = useQuery(api.kanban.listArchived)

  if (!archived) {
    return <div style={{ padding: 32, textAlign: "center", fontSize: 13, color: "var(--text-mute)" }}>Ładowanie...</div>
  }

  const q = searchQuery.toLowerCase().trim()
  const filtered = q
    ? archived.filter((order) =>
        (order.name ?? "").toLowerCase().includes(q) ||
        (order.customText ?? "").toLowerCase().includes(q) ||
        (order.clientFirstName ?? "").toLowerCase().includes(q) ||
        (order.clientLastName ?? "").toLowerCase().includes(q) ||
        (order.companyName ?? "").toLowerCase().includes(q) ||
        `${order.clientFirstName ?? ""} ${order.clientLastName ?? ""}`.toLowerCase().includes(q) ||
        (order.services ?? []).some((s) => s.toLowerCase().includes(q))
      )
    : archived

  return (
    <div>
      {filtered.length === 0 && !q && (
        <div style={{ padding: 32, textAlign: "center", fontSize: 13, color: "var(--text-mute)" }}>Brak zarchiwizowanych zleceń</div>
      )}
      {filtered.length === 0 && q && (
        <div style={{ padding: 32, textAlign: "center", fontSize: 13, color: "var(--text-mute)" }}>Brak wyników dla „{q}”</div>
      )}

      {filtered.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                {["Nr zlecenia", "Klient", "Usługi", "Status", ""].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "var(--text-mute)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <tr
                  key={order._id}
                  style={{ borderBottom: "1px solid var(--line)", cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--panel-2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                  onClick={() => router.push(`/admin/klient/${order.clientId}/zlecenie/${order._id}`)}
                >
                  <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "var(--text-strong)", fontWeight: 600 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-start" }}>
                      <span>{order.name ?? "—"}</span>
                      {order.customText && <span className="chip-custom">{order.customText}</span>}
                    </div>
                  </td>
                  <td style={{ padding: "10px 12px", color: "var(--text-strong)", fontWeight: 600 }}>
                    {order.clientType === "business" && order.companyName
                      ? order.companyName
                      : `${order.clientFirstName} ${order.clientLastName}`}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                      {(order.services ?? []).map((s, i) => {
                        const c = SERVICE_COLORS[i % SERVICE_COLORS.length]
                        return (
                          <span key={s} style={{
                            fontSize: 10, fontWeight: 600,
                            background: c.bg, color: c.text,
                            borderRadius: 3, padding: "2px 6px",
                          }}>{s}</span>
                        )
                      })}
                    </div>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, background: "#e2e8f0", color: "#475569", borderRadius: 3, padding: "2px 6px" }}>
                      {statusLabels["archived"] ?? "Archiwalne"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>
                    <span style={{ fontSize: 11, color: "var(--accent)" }}>→</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Główny komponent ────────────────────────────────────────────────
export default function PanelPage() {
  const statusLabels = useStatusLabels()
  const statuses = useStatuses()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = searchParams.get("tab") as "kanban" | "opportunities" | "archived" | "archived-leads" | null
  const [activeTab, setActiveTab] = useState<"kanban" | "opportunities" | "archived" | "archived-leads">(
    initialTab && ["kanban", "opportunities", "archived", "archived-leads"].includes(initialTab) ? initialTab : "kanban"
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [draggingItem, setDraggingItem] = useState<KanbanItem | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showNewOrderModal, setShowNewOrderModal] = useState(false)
  const [showNewOpportunityModal, setShowNewOpportunityModal] = useState(false)

  const items = useQuery(api.kanban.list)
  const currentUser = useQuery(api.users.me)
  const allUsers = useQuery(api.users.listAllActive)
  const servicesList = useQuery(api.services.listActive) ?? []
  const [activeUserFilters, setActiveUserFilters] = useState<Set<string>>(new Set())
  const [activeServiceFilters, setActiveServiceFilters] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!currentUser?._id) return
    const key = `panel_user_filter_${currentUser._id}`
    try {
      const saved = localStorage.getItem(key)
      if (saved) {
        const arr = JSON.parse(saved)
        if (Array.isArray(arr)) {
          setTimeout(() => setActiveUserFilters(new Set(arr)), 0)
        }
      }
    } catch {}
  }, [currentUser?._id])

  const toggleUserFilter = (id: string) => {
    setActiveUserFilters(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      if (currentUser?._id) {
        localStorage.setItem(`panel_user_filter_${currentUser._id}`, JSON.stringify([...next]))
      }
      return next
    })
  }

  const toggleServiceFilter = (name: string) => {
    setActiveServiceFilters(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  // color → userId lookup as fallback when assignedUserId isn't yet in kanban items
  const colorToUserId = useMemo(() => {
    if (!allUsers) return {} as Record<string, string>
    const map: Record<string, string> = {}
    for (const u of allUsers) {
      if (u.color) map[u.color] = u._id as string
    }
    return map
  }, [allUsers])

  const displayItems = useMemo(() => {
    const all = items ?? []
    
    let filtered = all.filter(item => {
      if (activeUserFilters.size === 0) return true
      const uids = item.assignees?.map(a => a.id) || []
      if (item.assignedUserId && !uids.includes(item.assignedUserId)) {
        uids.push(item.assignedUserId)
      }
      if (item.assignedUserColor && uids.length === 0) {
        const uidFromColor = colorToUserId[item.assignedUserColor]
        if (uidFromColor) uids.push(uidFromColor)
      }

      if (uids.length === 0) return activeUserFilters.has("__none__")
      return uids.some(uid => activeUserFilters.has(uid))
    })

    // Service filter — only applied on opportunities tab for pending items
    if (activeServiceFilters.size > 0) {
      filtered = filtered.filter(item => {
        // orders in kanban tab are unaffected
        if (item.type === "order") return true
        const itemServices = item.services ?? []
        return itemServices.some(s => activeServiceFilters.has(s))
      })
    }
    
    const q = searchQuery.toLowerCase().trim()
    if (q) {
      filtered = filtered.filter(item => {
        const name = (item.type === "order" ? item.orderName : "") || ""
        const clientName = `${item.clientFirstName ?? ""} ${item.clientLastName ?? ""}`.trim()
        const company = (item.type === "order" && item.clientType === "business" ? item.companyName : "") || ""
        const customText = item.customText || ""
        const services = item.services?.join(" ") || ""
        
        return name.toLowerCase().includes(q) ||
               clientName.toLowerCase().includes(q) ||
               company.toLowerCase().includes(q) ||
               customText.toLowerCase().includes(q) ||
               services.toLowerCase().includes(q)
      })
    }
    
    return filtered
  }, [items, activeUserFilters, activeServiceFilters, colorToUserId, searchQuery])

  const changeStatus = useMutation(api.orders.changeStatus)
  const promoteToMeasurement = useMutation(api.jotformInternal.promoteToMeasurement)
  const updatePendingStage = useMutation(api.jotformInternal.updatePendingStage)
  const deleteOrder = useAction(api.orders.deleteOrder)
  const deletePending = useMutation(api.jotformInternal.deletePending)
  const archiveOpportunity = useMutation(api.salesOpportunities.archiveOpportunity)

  const topScrollRef = useRef<HTMLDivElement>(null)
  const bottomScrollRef = useRef<HTMLDivElement>(null)
  const syncingFromRef = useRef<HTMLDivElement | null>(null)
  const [scrollWidth, setScrollWidth] = useState(0)
  const [hasOverflow, setHasOverflow] = useState(false)
  const [showLeftScroll, setShowLeftScroll] = useState(false)
  const [showRightScroll, setShowRightScroll] = useState(true)

  const scrollRaf = useRef<number | null>(null)
  const scrollVelocity = useRef(0)
  const scrollTarget = useRef(0)

  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())

  const checkScroll = () => {
    if (!bottomScrollRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = bottomScrollRef.current
    setShowLeftScroll(scrollLeft > 0)
    setShowRightScroll(Math.ceil(scrollLeft + clientWidth) < scrollWidth - 2)
  }

  useEffect(() => {
    if (activeTab !== "kanban" && activeTab !== "opportunities") return

    const el = bottomScrollRef.current
    if (!el) return
    const update = () => {
      setScrollWidth(el.scrollWidth)
      setHasOverflow(el.scrollWidth - el.clientWidth > 1)
      checkScroll()
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    Array.from(el.children).forEach((c) => ro.observe(c))
    window.addEventListener("resize", checkScroll)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", checkScroll)
    }
  }, [activeTab, items, expandedCards])

  const runScrollLoop = () => {
    const el = bottomScrollRef.current
    if (!el) {
      scrollRaf.current = null
      return
    }
    scrollVelocity.current += (scrollTarget.current - scrollVelocity.current) * 0.12
    el.scrollLeft += scrollVelocity.current
    if (scrollTarget.current === 0 && Math.abs(scrollVelocity.current) < 0.15) {
      scrollVelocity.current = 0
      scrollRaf.current = null
      return
    }
    scrollRaf.current = requestAnimationFrame(runScrollLoop)
  }

  const startScrolling = (direction: "left" | "right") => {
    const MAX_SPEED = 22
    scrollTarget.current = direction === "right" ? MAX_SPEED : -MAX_SPEED
    if (scrollRaf.current == null) {
      scrollRaf.current = requestAnimationFrame(runScrollLoop)
    }
  }

  const stopScrolling = () => {
    scrollTarget.current = 0
  }

  useEffect(() => {
    return () => {
      if (scrollRaf.current) cancelAnimationFrame(scrollRaf.current)
    }
  }, [])

  const visibleColumns = statuses.filter((s) =>
    s.hidden
      ? false
      : activeTab === "opportunities"
        ? s.kind === "opportunity"
        : s.kind === "order",
  )

  const newLeadsCount = (items ?? []).filter((i) => i.status === "lead").length

  // Szanse sprzedaży: tylko 2 kolumny — ograniczamy max szerokość, żeby nie rozjeżdżały się przez cały ekran.
  // Pozostałe widoki: kolumny rozciągają się równomiernie do pełnej dostępnej szerokości.
  const gridTemplate =
    activeTab === "opportunities"
      ? `repeat(${visibleColumns.length}, minmax(220px, 340px))`
      : `repeat(${visibleColumns.length}, minmax(178px, 1fr))`

  const syncScroll = (source: HTMLDivElement | null) => {
    if (!source) return
    if (syncingFromRef.current && syncingFromRef.current !== source) return
    syncingFromRef.current = source
    const left = source.scrollLeft
    if (topScrollRef.current && topScrollRef.current !== source) topScrollRef.current.scrollLeft = left
    if (bottomScrollRef.current && bottomScrollRef.current !== source) bottomScrollRef.current.scrollLeft = left
    checkScroll()
    requestAnimationFrame(() => { syncingFromRef.current = null })
  }

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allIds = displayItems.map((i) => i.id)
  const allExpanded = allIds.length > 0 && allIds.every((id) => expandedCards.has(id))
  const toggleAll = () => {
    if (allExpanded) setExpandedCards(new Set())
    else setExpandedCards(new Set(allIds))
  }

  async function handleDelete(item: KanbanItem) {
    try {
      if (item.type === "order") {
        await deleteOrder({ orderId: item.orderId })
      } else {
        await deletePending({ pendingId: item.pendingId })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Błąd usuwania"
      setErrorMsg(msg)
      setTimeout(() => setErrorMsg(null), 3000)
    }
  }

  async function handleArchiveOpportunity(item: KanbanItem) {
    if (item.type !== "pending") return
    try {
      await archiveOpportunity({ opportunityId: item.pendingId })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Błąd archiwizacji"
      setErrorMsg(msg)
      setTimeout(() => setErrorMsg(null), 3000)
    }
  }

  function getValidTargets(item: KanbanItem): string[] {
    if (item.type === "pending") {
      return ["lead", "inquiry", "measurement"].filter((k) => k !== item.status)
    }
    // Zlecenia: dowolny status order-side (any→any), poza bieżącym.
    return statuses
      .filter((s) => s.kind === "order")
      .map((s) => s.key)
      .filter((k) => k !== item.status)
  }

  const handleDragStart = (e: React.DragEvent, item: KanbanItem) => {
    setDraggingItem(item)
    e.dataTransfer.effectAllowed = "move"
    setErrorMsg(null)
  }

  const handleDragEnd = () => {
    setDraggingItem(null)
    setDragOverCol(null)
  }

  const handleDragOver = (e: React.DragEvent, col: string) => {
    e.preventDefault()
    const valid = draggingItem ? getValidTargets(draggingItem) : []
    if (draggingItem?.status === col) {
      e.dataTransfer.dropEffect = "none"
    } else if (valid.includes(col)) {
      e.dataTransfer.dropEffect = "move"
    } else {
      e.dataTransfer.dropEffect = "none"
    }
    setDragOverCol(col)
  }

  const handleDrop = async (e: React.DragEvent, targetCol: string) => {
    e.preventDefault()
    if (!draggingItem) return
    setDraggingItem(null)
    setDragOverCol(null)

    if (draggingItem.status === targetCol) return

    const valid = getValidTargets(draggingItem)
    if (!valid.includes(targetCol)) {
      setErrorMsg(`Niedozwolone przejście: ${statusLabels[draggingItem.status] ?? draggingItem.status} → ${statusLabels[targetCol] ?? targetCol}`)
      setTimeout(() => setErrorMsg(null), 3000)
      return
    }

    try {
      if (draggingItem.type === "pending") {
        if (targetCol === "measurement") {
          await promoteToMeasurement({ pendingId: draggingItem.pendingId })
        } else {
          await updatePendingStage({
            pendingId: draggingItem.pendingId,
            stage: targetCol as "lead" | "inquiry",
          })
        }
      } else {
        await changeStatus({
          orderId: draggingItem.orderId,
          newStatus: targetCol as Parameters<typeof changeStatus>[0]["newStatus"],
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Błąd zmiany statusu"
      setErrorMsg(msg)
      setTimeout(() => setErrorMsg(null), 3000)
    }
  }

  function handleCardClick(item: KanbanItem) {
    if (item.type === "order") {
      router.push(`/admin/klient/${item.clientId}/zlecenie/${item.orderId}`)
    } else {
      router.push(`/admin/szansa/${item.pendingId}`)
    }
  }

  const totalActive = items?.filter((i) => i.type === "order").length ?? 0
  const totalPending = items?.filter((i) => i.type === "pending").length ?? 0

  const opportunitiesProfit = useMemo(() => {
    if (activeTab !== "opportunities") return 0
    return displayItems
      .filter((i) => i.type === "pending" && i.status === "inquiry" && typeof (i as any).profit === "number")
      .reduce((sum, i) => sum + ((i as any).profit || 0), 0)
  }, [activeTab, displayItems])

  // Liczba szans sprzedaży (pending items) dla każdej usługi — bez wpływu aktywnych filtrów
  const serviceCountMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const item of items ?? []) {
      if (item.type !== "pending") continue
      for (const s of item.services ?? []) {
        map[s] = (map[s] ?? 0) + 1
      }
    }
    return map
  }, [items])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", minWidth: 0, height: "100%", minHeight: 0 }}>
      {/* Header */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
              Panel zleceń
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Link
                href={`/admin/zamowienia?fromTab=${activeTab}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-mute)",
                  textDecoration: "none",
                  padding: "3px 9px",
                  borderRadius: 999,
                  background: "var(--panel-2)",
                  border: "1px solid var(--line)",
                  transition: "all 0.15s ease",
                }}
                className="hover:text-brand hover:border-brand/30"
                title="Przejdź do pełnej listy / tabeli zleceń"
              >
                <ClipboardList style={{ width: 12, height: 12 }} />
                <span>Lista zleceń</span>
              </Link>
              <Link
                href={`/admin/klienci?fromTab=${activeTab}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-mute)",
                  textDecoration: "none",
                  padding: "3px 9px",
                  borderRadius: 999,
                  background: "var(--panel-2)",
                  border: "1px solid var(--line)",
                  transition: "all 0.15s ease",
                }}
                className="hover:text-brand hover:border-brand/30"
                title="Przejdź do bazy klientów"
              >
                <Users style={{ width: 12, height: 12 }} />
                <span>Baza klientów</span>
              </Link>
              <Link
                href={`/admin/reklamacje?fromTab=${activeTab}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-mute)",
                  textDecoration: "none",
                  padding: "3px 9px",
                  borderRadius: 999,
                  background: "var(--panel-2)",
                  border: "1px solid var(--line)",
                  transition: "all 0.15s ease",
                }}
                className="hover:text-amber-600 hover:border-amber-300"
                title="Przejdź do zgłoszeń reklamacyjnych"
              >
                <AlertTriangle style={{ width: 12, height: 12 }} />
                <span>Reklamacje</span>
              </Link>
              <Link
                href={`/admin/zamowienia-dostawcy?fromTab=${activeTab}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-mute)",
                  textDecoration: "none",
                  padding: "3px 9px",
                  borderRadius: 999,
                  background: "var(--panel-2)",
                  border: "1px solid var(--line)",
                  transition: "all 0.15s ease",
                }}
                className="hover:text-brand hover:border-brand/30"
                title="Przejdź do zamówień od dostawcy"
              >
                <Package style={{ width: 12, height: 12 }} />
                <span>Dostawcy</span>
              </Link>
            </div>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-mute)", margin: "2px 0 0" }}>
            {totalActive} {totalActive === 1 ? "zlecenie" : "zleceń"} aktywnych
            {totalPending > 0 && ` · ${totalPending} nowych zgłoszeń`}
          </p>
        </div>


        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "flex-end" }}>
          <div style={{ position: "relative", width: 220 }}>
            <Search
              size={14}
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-mute)" }}
            />
            <input
              type="text"
              placeholder="Szukaj w kanbanie..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%", padding: "6px 12px 6px 30px", borderRadius: 6,
                border: "1px solid var(--line)", background: "var(--panel-2)",
                fontSize: 12, color: "var(--text-strong)", outline: "none",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", color: "var(--text-mute)", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", padding: 2,
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
          {(activeTab === "kanban" || activeTab === "opportunities") && (items?.length ?? 0) > 0 && (
            <button
              onClick={toggleAll}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "6px 10px", borderRadius: 6,
                border: "1px solid var(--line)", background: "var(--panel)",
                fontSize: 12, fontWeight: 500, color: "var(--text)",
                cursor: "pointer",
              }}
              title={allExpanded ? "Zwiń wszystkie karty" : "Rozwiń wszystkie karty"}
            >
              {allExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {allExpanded ? "Zwiń wszystkie" : "Rozwiń wszystkie"}
            </button>
          )}
          {activeTab === "opportunities" || activeTab === "archived-leads" ? (
            <button className="btn primary" onClick={() => setShowNewOpportunityModal(true)}>
              <Plus size={13} /> Nowa szansa sprzedaży
            </button>
          ) : (
            <button className="btn primary" onClick={() => setShowNewOrderModal(true)}>
              <Plus size={13} /> Nowe zlecenie
            </button>
          )}
        </div>
      </div>

      {/* Error toast */}
      {errorMsg && (
        <div style={{
          background: "#fef2f2", border: "1px solid #fca5a5", color: "#dc2626",
          borderRadius: 6, padding: "8px 14px", fontSize: 12, fontWeight: 500,
        }}>
          {errorMsg}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--line)", marginBottom: 4 }}>
        {(["kanban", "opportunities", "archived", "archived-leads"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "8px 16px",
              fontSize: 12.5,
              fontWeight: activeTab === tab ? 600 : 500,
              color: activeTab === tab ? "var(--accent)" : "var(--text-mute)",
              marginBottom: -1,
              background: "none",
              border: "none",
              borderBottomStyle: "solid",
              borderBottomWidth: 2,
              borderBottomColor: activeTab === tab ? "var(--accent)" : "transparent",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {tab === "kanban" ? "Zlecenia"
              : tab === "opportunities" ? "Szanse sprzedaży"
              : tab === "archived" ? "Archiwum"
              : "Archiwum LEAD"}
            {tab === "opportunities" && newLeadsCount > 0 && (
              <span
                aria-label={`${newLeadsCount} nowych szans sprzedaży`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 18,
                  height: 18,
                  padding: "0 5px",
                  borderRadius: 9,
                  background: "#dc2626",
                  color: "#fff",
                  fontSize: 10.5,
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                {newLeadsCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* User filter chips */}
      {(activeTab === "kanban" || activeTab === "opportunities") && allUsers && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 4 }}>
          {[...allUsers]
            .sort((a, b) => {
              if (a._id === currentUser?._id) return -1
              if (b._id === currentUser?._id) return 1
              return 0
            })
            .map(user => {
              const name = user.displayName ?? user.login ?? "?"
              const isMe = user._id === currentUser?._id
              const active = activeUserFilters.has(user._id as string)
              return (
                <button
                  key={user._id}
                  onClick={() => toggleUserFilter(user._id as string)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "4px 10px", borderRadius: 20, fontSize: 11.5,
                    background: active ? `${user.color ?? "#64748b"}22` : "var(--panel)",
                    color: active ? (user.color ?? "var(--accent)") : "var(--text-mute)",
                    border: `1.5px solid ${active ? (user.color ?? "var(--accent)") : "var(--line)"}`,
                    fontWeight: active ? 600 : 500, cursor: "pointer",
                    transition: "all 0.12s", fontFamily: "inherit",
                  }}
                >
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: user.color ? (active ? user.color : `${user.color}80`) : (active ? "#64748b" : "#64748b40"),
                    flexShrink: 0,
                  }} />
                  {name}{isMe ? " (Ty)" : ""}
                </button>
              )
            })
          }
          <button
            onClick={() => toggleUserFilter("__none__")}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "4px 10px", borderRadius: 20, fontSize: 11.5,
              background: activeUserFilters.has("__none__") ? "var(--panel-3)" : "var(--panel)",
              color: activeUserFilters.has("__none__") ? "var(--text-strong)" : "var(--text-mute)",
              border: `1.5px solid ${activeUserFilters.has("__none__") ? "var(--text-mute)" : "var(--line)"}`,
              fontWeight: activeUserFilters.has("__none__") ? 600 : 500, cursor: "pointer",
              transition: "all 0.12s", fontFamily: "inherit",
            }}
          >
            <span style={{
              width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
              border: `1.5px dashed ${activeUserFilters.has("__none__") ? "var(--text-strong)" : "var(--text-mute)"}`,
            }} />
            Bez przypisania
          </button>
        </div>
      )}

      {/* Service filter chips — tylko zakładka Szanse sprzedaży */}
      {activeTab === "opportunities" && servicesList.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: "var(--text-mute)", alignSelf: "center", marginRight: 2, fontWeight: 500 }}>Usługi:</span>
          {servicesList.map((svc, i) => {
            const color = SERVICE_COLORS[i % SERVICE_COLORS.length]
            const active = activeServiceFilters.has(svc.name)
            return (
              <button
                key={svc._id}
                onClick={() => toggleServiceFilter(svc.name)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "4px 10px", borderRadius: 20, fontSize: 11.5,
                  background: active ? color.bg : "var(--panel)",
                  color: active ? color.text : "var(--text-mute)",
                  border: `1.5px solid ${active ? color.text + "55" : "var(--line)"}`,
                  fontWeight: active ? 600 : 500, cursor: "pointer",
                  transition: "all 0.12s", fontFamily: "inherit",
                }}
              >
                {svc.name}
                {(serviceCountMap[svc.name] ?? 0) > 0 && (
                  <span style={{
                    minWidth: 16, height: 16,
                    borderRadius: 8,
                    background: active ? color.text + "22" : "var(--panel-2)",
                    color: active ? color.text : "var(--text-mute)",
                    fontSize: 10, fontWeight: 700,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    padding: "0 4px",
                    lineHeight: 1,
                  }}>
                    {serviceCountMap[svc.name]}
                  </span>
                )}
              </button>
            )
          })}
          {activeServiceFilters.size > 0 && (
            <button
              onClick={() => setActiveServiceFilters(new Set())}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "4px 8px", borderRadius: 20, fontSize: 11,
                background: "transparent",
                color: "var(--text-mute)",
                border: "1.5px solid var(--line)",
                fontWeight: 500, cursor: "pointer",
                transition: "all 0.12s", fontFamily: "inherit",
              }}
              title="Wyczyść filtry usług"
            >
              <X size={10} /> Wyczyść
            </button>
          )}
        </div>
      )}

      {/* Zestawienie finansowe (tylko Szanse sprzedaży) */}
      {activeTab === "opportunities" && (
        <div style={{ marginBottom: 12, padding: "8px 16px", background: "var(--panel)", borderRadius: 8, border: "1px solid var(--line)", display: "inline-block" }}>
          <span style={{ fontSize: 12, color: "var(--text-mute)", marginRight: 8 }}>
            Zarobek w szansach (Oferta wysłana):
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>
            {opportunitiesProfit.toLocaleString("pl-PL", { style: "currency", currency: "PLN" })}
          </span>
        </div>
      )}

      {/* Kanban tab (Zlecenia + Szanse sprzedaży) */}
      {(activeTab === "kanban" || activeTab === "opportunities") && (
        <>
          {/* ── Kontrolki Scrollowania ── */}
          {(showLeftScroll || showRightScroll) && (
            <div className="flex justify-center gap-2 mb-2 w-full">
              <button
                onMouseEnter={() => showLeftScroll && startScrolling('left')}
                onMouseLeave={stopScrolling}
                className={`flex size-9 items-center justify-center rounded-full shadow transition-all ${
                  showLeftScroll ? "bg-[#4abbc3] text-white hover:opacity-90 hover:scale-110 cursor-pointer" : "bg-gray-100 text-gray-400 cursor-not-allowed opacity-50"
                }`}
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                onMouseEnter={() => showRightScroll && startScrolling('right')}
                onMouseLeave={stopScrolling}
                className={`flex size-9 items-center justify-center rounded-full shadow transition-all ${
                  showRightScroll ? "bg-[#4abbc3] text-white hover:opacity-90 hover:scale-110 cursor-pointer" : "bg-gray-100 text-gray-400 cursor-not-allowed opacity-50"
                }`}
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
          )}

          {/* Sticky top scrollbar — widoczny tylko gdy kolumny nie mieszczą się w szerokości */}
          {hasOverflow && (
            <div style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--background)", paddingTop: 4, paddingBottom: 2 }}>
              <div
                ref={topScrollRef}
                onScroll={() => syncScroll(topScrollRef.current)}
                style={{ overflowX: "auto", overflowY: "hidden", height: 14 }}
              >
                <div style={{ width: scrollWidth, height: 1 }} />
              </div>
            </div>
          )}

          {/* Headers + bodies — pełna szerokość, grid z minmax dla równomiernego rozłożenia */}
          <div
            ref={bottomScrollRef}
            onScroll={() => syncScroll(bottomScrollRef.current)}
            className="no-scrollbar"
            style={{ overflow: "auto", paddingBottom: 12, width: "100%", flex: 1, minHeight: 0 }}
          >
            <div style={{ minWidth: "100%", minHeight: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Wiersz nagłówków */}
              <div style={{ display: "grid", gridTemplateColumns: gridTemplate, columnGap: 8 }}>
                {visibleColumns.map((col) => {
                  const colItems = displayItems.filter((i) => i.status === col.key).sort(sortItemsByDuration)
                  const validTargets = draggingItem ? getValidTargets(draggingItem) : []
                  const isValid = validTargets.includes(col.key)
                  const isDraggingSameCol = draggingItem?.status === col.key
                  const colOpacity = draggingItem && !isDraggingSameCol && !isValid ? 0.45 : 1
                  const st = deriveStatusStyle(col.color)
                  const onSolid = st.solidText === "#ffffff" ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.12)"

                  return (
                    <div
                      key={col.key}
                      style={{ minWidth: 0, opacity: colOpacity, transition: "opacity 0.15s" }}
                      onDragOver={(e) => handleDragOver(e, col.key)}
                      onDrop={(e) => handleDrop(e, col.key)}
                      onDragLeave={() => setDragOverCol(null)}
                    >
                      <div style={{
                        padding: "7px 10px", borderRadius: 7,
                        background: st.solidBg, border: `1px solid ${st.solidBorder}`,
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        fontSize: 11.5, fontWeight: 700, color: st.solidText,
                      }}>
                        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {col.label}
                        </span>
                        <span style={{
                          background: onSolid,
                          borderRadius: 4, padding: "1px 6px",
                          fontSize: 10.5, fontWeight: 700, flexShrink: 0, marginLeft: 4,
                        }}>
                          {colItems.length}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Wiersz treści kolumn */}
              <div style={{ display: "grid", gridTemplateColumns: gridTemplate, columnGap: 8, flex: 1, minHeight: 0 }}>
                {visibleColumns.map((col) => {
                  const colItems = displayItems.filter((i) => i.status === col.key).sort(sortItemsByDuration)
                  const isOver = dragOverCol === col.key
                  const isDraggingOver = draggingItem !== null && isOver
                  const validTargets = draggingItem ? getValidTargets(draggingItem) : []
                  const isValid = validTargets.includes(col.key)
                  const isDraggingSameCol = draggingItem?.status === col.key

                  const dropBg: string = "transparent"
                  let dropBorder = `1.5px dashed ${deriveStatusStyle(col.color).solidBorder}`
                  if (isDraggingOver && isValid) {
                    dropBorder = "1.5px dashed var(--accent)"
                  } else if (isDraggingOver && !isValid && !isDraggingSameCol) {
                    dropBorder = "1.5px dashed #fca5a5"
                  }

                  const colOpacity = draggingItem && !isDraggingSameCol && !isValid ? 0.45 : 1

                  return (
                    <div
                      key={col.key}
                      style={{ minWidth: 0, display: "flex", flexDirection: "column", opacity: colOpacity, transition: "opacity 0.15s" }}
                      onDragOver={(e) => handleDragOver(e, col.key)}
                      onDrop={(e) => handleDrop(e, col.key)}
                      onDragLeave={() => setDragOverCol(null)}
                    >
                      <div style={{
                        display: "flex", flexDirection: "column", gap: 6,
                        flex: 1, minHeight: 80, padding: 3, borderRadius: 6,
                        background: dropBg, border: dropBorder,
                        transition: "background 0.15s, border 0.15s",
                      }}>
                        {colItems.map((item) => (
                          <OrderCard
                            key={item.id}
                            item={item}
                            isDragging={draggingItem?.id === item.id}
                            expanded={expandedCards.has(item.id)}
                            onToggleExpand={() => toggleCard(item.id)}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            onDelete={handleDelete}
                            onClick={() => handleCardClick(item)}
                            onArchive={handleArchiveOpportunity}
                          />
                        ))}
                        {colItems.length === 0 && (
                          <div style={{
                            textAlign: "center", fontSize: 10,
                            color: "rgba(255,255,255,0.75)", padding: "12px 0",
                          }}>
                            Brak zleceń
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Archiwum tab (zlecenia) */}
      {activeTab === "archived" && <ArchivedTab searchQuery={searchQuery} />}

      {/* Archiwum LEAD tab (szanse sprzedaży) */}
      {activeTab === "archived-leads" && <ArchivedLeadsTab searchQuery={searchQuery} />}

      {showNewOrderModal && (
        <NewOrderModal
          onClose={() => setShowNewOrderModal(false)}
          onSuccess={(orderId, clientId) => {
            setShowNewOrderModal(false)
            router.push(`/admin/klient/${clientId}/zlecenie/${orderId}`)
          }}
        />
      )}

      {showNewOpportunityModal && (
        <NewOpportunityModal
          onClose={() => setShowNewOpportunityModal(false)}
          onSuccess={(opportunityId) => {
            setShowNewOpportunityModal(false)
            router.push(`/admin/szansa/${opportunityId}`)
          }}
        />
      )}
    </div>
  )
}
