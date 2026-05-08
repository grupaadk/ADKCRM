"use client"

import { useState, useRef } from "react"
import { useQuery, useMutation } from "convex/react"
import { useRouter } from "next/navigation"
import { api } from "@/convex/_generated/api"
import { useStatusLabels } from "@/components/StatusLabelsContext"
import type { KanbanItem } from "@/convex/kanban"

const KANBAN_COLUMNS = [
  { key: "lead",         bg: "#8b5cf6", border: "#7c3aed" },
  { key: "inquiry",      bg: "#6366f1", border: "#4f46e5" },
  { key: "measurement",  bg: "#f59e0b", border: "#d97706" },
  { key: "offer",        bg: "#ec4899", border: "#db2777" },
  { key: "contract",     bg: "#8b5cf6", border: "#7c3aed" },
  { key: "production",   bg: "#3b82f6", border: "#1d4ed8" },
  { key: "installation", bg: "#06b6d4", border: "#0891b2" },
  { key: "complaint",    bg: "#ef4444", border: "#dc2626" },
  { key: "completed",    bg: "#16a34a", border: "#15803d" },
] as const

type ColumnKey = (typeof KANBAN_COLUMNS)[number]["key"]
type DocState = "gray" | "red" | "green"

const DOC_COLORS: Record<DocState, string> = {
  gray:  "#d0d4dc",
  red:   "#ef4444",
  green: "#22c55e",
}

const DOC_KEYS = ["pomiar", "umowa", "gwarancja_alco", "rekojmia_adk", "odbior_inwestor", "protokol_montaz", "faktura", "reklamacja"]

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
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 7 }}>
      {shown.map((s, i) => {
        const color = SERVICE_COLORS[i % SERVICE_COLORS.length]
        return (
          <span key={s} style={{
            fontSize: 10, fontWeight: 600,
            background: color.bg, color: color.text,
            borderRadius: 4, padding: "2px 7px", lineHeight: 1.5,
            whiteSpace: "nowrap",
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
  onDragStart,
  onDragEnd,
  onClick,
}: {
  item: KanbanItem
  isDragging: boolean
  onDragStart: (e: React.DragEvent, item: KanbanItem) => void
  onDragEnd: () => void
  onClick: () => void
}) {
  const isPending = item.type === "pending"
  const fullName = `${item.clientFirstName} ${item.clientLastName}`.trim()
  const didDragRef = useRef(false)

  return (
    <div
      draggable
      onClick={() => { if (!didDragRef.current) onClick() }}
      onDragStart={(e) => { didDragRef.current = false; onDragStart(e, item) }}
      onDragEnd={() => { didDragRef.current = true; setTimeout(() => { didDragRef.current = false }, 300); onDragEnd() }}
      style={{
        background: "var(--panel)",
        border: `1px solid ${isDragging ? "var(--accent)" : isPending ? "#f59e0b55" : "var(--line)"}`,
        borderRadius: 8,
        padding: "11px 13px",
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
        transition: "all 0.15s ease",
        boxShadow: isDragging ? "0 8px 20px rgba(0,0,0,0.18)" : "0 1px 3px rgba(0,0,0,0.06)",
        transform: isDragging ? "scale(1.02)" : undefined,
        opacity: isDragging ? 0.6 : 1,
        position: "relative",
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
      {isPending && (
        <div style={{
          position: "absolute", top: 8, right: 10,
          fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
          background: "#fef3c7", color: "#b45309",
          borderRadius: 4, padding: "2px 6px",
        }}>
          NOWE
        </div>
      )}

      {item.type === "order" && item.orderName ? (
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)", marginBottom: 2, fontFamily: "monospace", paddingRight: isPending ? 44 : 0 }}>
          #{item.orderName}
        </div>
      ) : item.type === "pending" ? (
        <div style={{ fontSize: 13, fontWeight: 700, color: "#b45309", marginBottom: 2, paddingRight: 44 }}>
          Nowe zgłoszenie
        </div>
      ) : null}

      <div style={{ fontSize: 12, color: "var(--text-mute)", marginBottom: 3 }}>
        {fullName || "—"}
      </div>

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
  )
}

// ─── Zakładka Zakończone ────────────────────────────────────────────
function CompletedTab() {
  const statusLabels = useStatusLabels()
  const router = useRouter()
  const completed = useQuery(api.kanban.listCompleted)

  if (!completed) {
    return <div style={{ padding: 32, textAlign: "center", fontSize: 13, color: "var(--text-mute)" }}>Ładowanie...</div>
  }

  if (completed.length === 0) {
    return <div style={{ padding: 32, textAlign: "center", fontSize: 13, color: "var(--text-mute)" }}>Brak zakończonych zleceń</div>
  }

  return (
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
          {completed.map((order) => (
            <tr
              key={order._id}
              style={{ borderBottom: "1px solid var(--line)", cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--panel-2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "")}
              onClick={() => router.push(`/admin/klient/${order.clientId}/zlecenie/${order._id}`)}
            >
              <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "var(--text-strong)", fontWeight: 600 }}>
                {order.name ?? "—"}
              </td>
              <td style={{ padding: "10px 12px", color: "var(--text-strong)", fontWeight: 600 }}>
                {order.clientFirstName} {order.clientLastName}
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
                <span style={{ fontSize: 10, fontWeight: 700, background: "#dcfce7", color: "#15803d", borderRadius: 3, padding: "2px 6px" }}>
                  {statusLabels["completed"] ?? "Zakończone"}
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
  )
}

// ─── Główny komponent ────────────────────────────────────────────────
export default function PanelPage() {
  const statusLabels = useStatusLabels()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"kanban" | "completed">("kanban")
  const [draggingItem, setDraggingItem] = useState<KanbanItem | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const items = useQuery(api.kanban.list)
  const changeStatus = useMutation(api.orders.changeStatus)
  const promoteToMeasurement = useMutation(api.jotformInternal.promoteToMeasurement)
  const updatePendingStage = useMutation(api.jotformInternal.updatePendingStage)

  function getValidTargets(item: KanbanItem): string[] {
    if (item.type === "pending") {
      return ["lead", "inquiry", "measurement"].filter((k) => k !== item.status)
    }
    return KANBAN_COLUMNS.map((c) => c.key).filter((k) => k !== item.status)
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
    } else if (item.clientId) {
      router.push(`/admin/klient/${item.clientId}`)
    }
  }

  const totalActive = items?.filter((i) => i.type === "order").length ?? 0
  const totalPending = items?.filter((i) => i.type === "pending").length ?? 0

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
            Panel zleceń
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-mute)", margin: "2px 0 0" }}>
            {totalActive} {totalActive === 1 ? "zlecenie" : "zleceń"} aktywnych
            {totalPending > 0 && ` · ${totalPending} nowych zgłoszeń`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, fontSize: 10, color: "var(--text-mute)", alignItems: "center" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "#d0d4dc", display: "inline-block" }} />
            Nie wygenerowany
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "#ef4444", display: "inline-block" }} />
            Nie podpisany
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "#22c55e", display: "inline-block" }} />
            Podpisany
          </span>
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
        {(["kanban", "completed"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "8px 16px",
              fontSize: 12.5,
              fontWeight: activeTab === tab ? 600 : 500,
              color: activeTab === tab ? "var(--accent)" : "var(--text-mute)",
              borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: -1,
              background: "none",
              border: "none",
              borderBottomStyle: "solid",
              borderBottomWidth: 2,
              borderBottomColor: activeTab === tab ? "var(--accent)" : "transparent",
              cursor: "pointer",
            }}
          >
            {tab === "kanban" ? "Kanban" : "Archiwum"}
          </button>
        ))}
      </div>

      {/* Kanban tab */}
      {activeTab === "kanban" && (
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 12 }}>
          {KANBAN_COLUMNS.map((col) => {
            const colItems = (items ?? []).filter((i) => i.status === col.key)
            const isOver = dragOverCol === col.key
            const isDraggingOver = draggingItem !== null && isOver
            const validTargets = draggingItem ? getValidTargets(draggingItem) : []
            const isValid = validTargets.includes(col.key)
            const isDraggingSameCol = draggingItem?.status === col.key

            let dropBg = "transparent"
            let dropBorder = "1.5px dashed transparent"
            if (isDraggingOver && isValid) {
              dropBg = "rgba(74,187,195,0.06)"
              dropBorder = "1.5px dashed var(--accent)"
            } else if (isDraggingOver && !isValid && !isDraggingSameCol) {
              dropBg = "rgba(239,68,68,0.04)"
              dropBorder = "1.5px dashed #fca5a5"
            }

            // Dim invalid columns while dragging
            const colOpacity = draggingItem && !isDraggingSameCol && !isValid ? 0.45 : 1

            return (
              <div
                key={col.key}
                style={{ flex: "0 0 215px", display: "flex", flexDirection: "column", gap: 8, opacity: colOpacity, transition: "opacity 0.15s" }}
                onDragOver={(e) => handleDragOver(e, col.key)}
                onDrop={(e) => handleDrop(e, col.key)}
                onDragLeave={() => setDragOverCol(null)}
              >
                {/* Column header */}
                <div style={{
                  padding: "9px 12px", borderRadius: 8,
                  background: col.bg, border: `1px solid ${col.border}`,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  fontSize: 12, fontWeight: 700, color: "white",
                }}>
                  <span>{statusLabels[col.key] ?? col.key}</span>
                  <span style={{
                    background: "rgba(255,255,255,0.25)",
                    borderRadius: 5, padding: "1px 7px",
                    fontSize: 11, fontWeight: 700,
                  }}>
                    {colItems.length}
                  </span>
                </div>

                {/* Column body */}
                <div style={{
                  display: "flex", flexDirection: "column", gap: 8,
                  minHeight: 80, padding: 4, borderRadius: 6,
                  background: dropBg, border: dropBorder,
                  transition: "background 0.15s, border 0.15s",
                }}>
                  {colItems.map((item) => (
                    <OrderCard
                      key={item.id}
                      item={item}
                      isDragging={draggingItem?.id === item.id}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onClick={() => handleCardClick(item)}
                    />
                  ))}
                  {colItems.length === 0 && (
                    <div style={{
                      textAlign: "center", fontSize: 10,
                      color: "var(--text-mute)", padding: "12px 0", opacity: 0.6,
                    }}>
                      Brak zleceń
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Zakończone tab */}
      {activeTab === "completed" && <CompletedTab />}

    </div>
  )
}
