"use client"

import { useState, useRef, useEffect } from "react"
import { useQuery, useMutation, useAction } from "convex/react"
import { useRouter } from "next/navigation"
import { api } from "@/convex/_generated/api"
import { useStatusLabels } from "@/components/StatusLabelsContext"
import type { KanbanItem } from "@/convex/kanban"
import { Plus, ChevronDown, ChevronUp } from "lucide-react"
import NewOrderModal from "@/app/admin/klient/[id]/NewOrderModal"

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
}: {
  item: KanbanItem
  isDragging: boolean
  expanded: boolean
  onDragStart: (e: React.DragEvent, item: KanbanItem) => void
  onDragEnd: () => void
  onClick: () => void
  onDelete: (item: KanbanItem) => void
  onToggleExpand: () => void
}) {
  const isPending = item.type === "pending"
  const fullName = `${item.clientFirstName} ${item.clientLastName}`.trim()
  const didDragRef = useRef(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

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
        padding: expanded ? "7px 8px 9px" : "6px 8px",
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
      {/* Wiersz tytułu + akcje */}
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...titleStyle, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.25 }}>
            {titleText}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-mute)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1, lineHeight: 1.3 }}>
            {fullName || "—"}
          </div>
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
  const [showNewOrderModal, setShowNewOrderModal] = useState(false)

  const items = useQuery(api.kanban.list)
  const changeStatus = useMutation(api.orders.changeStatus)
  const promoteToMeasurement = useMutation(api.jotformInternal.promoteToMeasurement)
  const updatePendingStage = useMutation(api.jotformInternal.updatePendingStage)
  const deleteOrder = useAction(api.orders.deleteOrder)
  const deletePending = useMutation(api.jotformInternal.deletePending)

  const topScrollRef = useRef<HTMLDivElement>(null)
  const bottomScrollRef = useRef<HTMLDivElement>(null)
  const syncingFromRef = useRef<HTMLDivElement | null>(null)
  const [scrollWidth, setScrollWidth] = useState(0)

  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (activeTab !== "kanban") return
    const el = bottomScrollRef.current
    if (!el) return
    const update = () => setScrollWidth(el.scrollWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    Array.from(el.children).forEach((c) => ro.observe(c))
    return () => ro.disconnect()
  }, [activeTab, items, expandedCards])

  const syncScroll = (source: HTMLDivElement | null) => {
    if (!source) return
    if (syncingFromRef.current && syncingFromRef.current !== source) return
    syncingFromRef.current = source
    const left = source.scrollLeft
    if (topScrollRef.current && topScrollRef.current !== source) topScrollRef.current.scrollLeft = left
    if (bottomScrollRef.current && bottomScrollRef.current !== source) bottomScrollRef.current.scrollLeft = left
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

  const allIds = (items ?? []).map((i) => i.id)
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
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
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
          {activeTab === "kanban" && (items?.length ?? 0) > 0 && (
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
          <button className="btn primary" onClick={() => setShowNewOrderModal(true)}>
            <Plus size={13} /> Nowe zlecenie
          </button>
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
        <>
          {/* Sticky top scrollbar — jedyny widoczny pasek */}
          <div style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--background)", paddingTop: 4, paddingBottom: 2 }}>
            <div
              ref={topScrollRef}
              onScroll={() => syncScroll(topScrollRef.current)}
              style={{ overflowX: "auto", overflowY: "hidden", height: 14 }}
            >
              <div style={{ width: scrollWidth, height: 1 }} />
            </div>
          </div>

          {/* Headers + bodies w jednym kontenerze ze wspólnym scrollem (ukryty) */}
          <div
            ref={bottomScrollRef}
            onScroll={() => syncScroll(bottomScrollRef.current)}
            className="no-scrollbar"
            style={{ overflowX: "auto", paddingBottom: 12 }}
          >
            <div style={{ width: "max-content", display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Wiersz nagłówków */}
              <div style={{ display: "flex", gap: 8 }}>
                {KANBAN_COLUMNS.map((col) => {
                  const colItems = (items ?? []).filter((i) => i.status === col.key)
                  const validTargets = draggingItem ? getValidTargets(draggingItem) : []
                  const isValid = validTargets.includes(col.key)
                  const isDraggingSameCol = draggingItem?.status === col.key
                  const colOpacity = draggingItem && !isDraggingSameCol && !isValid ? 0.45 : 1

                  return (
                    <div
                      key={col.key}
                      style={{ flex: "0 0 168px", minWidth: 0, maxWidth: 168, opacity: colOpacity, transition: "opacity 0.15s" }}
                      onDragOver={(e) => handleDragOver(e, col.key)}
                      onDrop={(e) => handleDrop(e, col.key)}
                      onDragLeave={() => setDragOverCol(null)}
                    >
                      <div style={{
                        padding: "7px 10px", borderRadius: 7,
                        background: col.bg, border: `1px solid ${col.border}`,
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        fontSize: 11.5, fontWeight: 700, color: "white",
                      }}>
                        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {statusLabels[col.key] ?? col.key}
                        </span>
                        <span style={{
                          background: "rgba(255,255,255,0.25)",
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
              <div style={{ display: "flex", gap: 8 }}>
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

                  const colOpacity = draggingItem && !isDraggingSameCol && !isValid ? 0.45 : 1

                  return (
                    <div
                      key={col.key}
                      style={{ flex: "0 0 168px", minWidth: 0, maxWidth: 168, display: "flex", flexDirection: "column", opacity: colOpacity, transition: "opacity 0.15s" }}
                      onDragOver={(e) => handleDragOver(e, col.key)}
                      onDrop={(e) => handleDrop(e, col.key)}
                      onDragLeave={() => setDragOverCol(null)}
                    >
                      <div style={{
                        display: "flex", flexDirection: "column", gap: 6,
                        minHeight: 80, padding: 3, borderRadius: 6,
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
            </div>
          </div>
        </>
      )}

      {/* Zakończone tab */}
      {activeTab === "completed" && <CompletedTab />}

      {showNewOrderModal && (
        <NewOrderModal
          onClose={() => setShowNewOrderModal(false)}
          onSuccess={(orderId, clientId) => {
            setShowNewOrderModal(false)
            router.push(`/admin/klient/${clientId}/zlecenie/${orderId}`)
          }}
        />
      )}
    </div>
  )
}
