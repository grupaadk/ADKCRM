"use client"

import { useState } from "react"

const KANBAN_COLUMNS = [
  { key: "lead",         label: "Oferta",            bg: "#8b5cf6", border: "#7c3aed" },
  { key: "inquiry",      label: "Oferta wysłana",     bg: "#6366f1", border: "#4f46e5" },
  { key: "measurement",  label: "Do pomiarów",         bg: "#f59e0b", border: "#d97706" },
  { key: "offer",        label: "Oferta po pomiarze", bg: "#ec4899", border: "#db2777" },
  { key: "contract",     label: "Akceptacja",          bg: "#8b5cf6", border: "#7c3aed" },
  { key: "production",   label: "Zamówienie",          bg: "#3b82f6", border: "#1d4ed8" },
  { key: "installation", label: "Realizowane",         bg: "#06b6d4", border: "#0891b2" },
  { key: "completed",    label: "Zakończone",          bg: "#10b981", border: "#059669" },
  { key: "complaint",    label: "Reklamacja",          bg: "#ef4444", border: "#dc2626" },
] as const

type ColumnKey = (typeof KANBAN_COLUMNS)[number]["key"]

type DocState = "gray" | "red" | "green"

type Order = {
  id: string
  name: string
  status: ColumnKey
  clientName: string
  clientType?: "b2b"
  services: string
  amount: number
  docs: Record<string, DocState>
}

const allGray: Record<string, DocState> = {
  pomiar: "gray", umowa: "gray", gwarancja_alco: "gray", rekojmia_adk: "gray",
  odbior_inwestor: "gray", protokol_montaz: "gray", faktura: "gray", reklamacja: "gray",
}

const MOCK_ORDERS: Order[] = [
  {
    id: "1", name: "1/01/2025", status: "lead",
    clientName: "Jan Kowalski", services: "Okna", amount: 12500,
    docs: { ...allGray },
  },
  {
    id: "2", name: "2/01/2025", status: "lead",
    clientName: "Maria Nowak", services: "Drzwi, Okna", amount: 8300,
    docs: { ...allGray, pomiar: "red" },
  },
  {
    id: "3", name: "3/01/2025", status: "inquiry",
    clientName: "Kowalski & Co.", clientType: "b2b", services: "Brama", amount: 25000,
    docs: { ...allGray, pomiar: "green", umowa: "red" },
  },
  {
    id: "4", name: "4/01/2025", status: "inquiry",
    clientName: "Anna Lewandowska", services: "Okna", amount: 5500,
    docs: { ...allGray, pomiar: "green" },
  },
  {
    id: "5", name: "5/01/2025", status: "measurement",
    clientName: "Piotr Wiśniewski", services: "Zabudowa tarasu", amount: 15000,
    docs: { ...allGray, pomiar: "green" },
  },
  {
    id: "6", name: "6/01/2025", status: "measurement",
    clientName: "ADK Nieruchomości", clientType: "b2b", services: "Okna, Drzwi", amount: 48000,
    docs: { ...allGray, pomiar: "green", umowa: "red" },
  },
  {
    id: "7", name: "7/01/2025", status: "offer",
    clientName: "Katarzyna Kowalczyk", services: "Ogrodzenie", amount: 9200,
    docs: { ...allGray, pomiar: "green", umowa: "green" },
  },
  {
    id: "8", name: "8/01/2025", status: "offer",
    clientName: "Tomasz Majewski", services: "Okna", amount: 7800,
    docs: { ...allGray, pomiar: "green", umowa: "red" },
  },
  {
    id: "9", name: "9/01/2025", status: "contract",
    clientName: "Maciej Szymański", services: "Okna, Brama", amount: 18600,
    docs: { ...allGray, pomiar: "green", umowa: "green", gwarancja_alco: "red" },
  },
  {
    id: "10", name: "10/01/2025", status: "contract",
    clientName: "Joanna Nowosielska", services: "Drzwi", amount: 6400,
    docs: { ...allGray, pomiar: "green", umowa: "green" },
  },
  {
    id: "11", name: "11/01/2025", status: "production",
    clientName: "Robert Wojciechowski", services: "Okna", amount: 11000,
    docs: { ...allGray, pomiar: "green", umowa: "green", gwarancja_alco: "green", rekojmia_adk: "green", faktura: "red" },
  },
  {
    id: "12", name: "12/01/2025", status: "production",
    clientName: "Firma Budmax Sp. z o.o.", clientType: "b2b", services: "Okna, Drzwi, Brama", amount: 67000,
    docs: { ...allGray, pomiar: "green", umowa: "green", gwarancja_alco: "green", rekojmia_adk: "red", faktura: "red" },
  },
  {
    id: "13", name: "13/01/2025", status: "installation",
    clientName: "Elżbieta Wróbel", services: "Okna", amount: 22000,
    docs: { ...allGray, pomiar: "green", umowa: "green", gwarancja_alco: "green", rekojmia_adk: "green", odbior_inwestor: "red", faktura: "green" },
  },
  {
    id: "14", name: "14/01/2025", status: "installation",
    clientName: "Krzysztof Dąbrowski", services: "Zabudowa tarasu", amount: 31000,
    docs: { ...allGray, pomiar: "green", umowa: "green", gwarancja_alco: "green", rekojmia_adk: "green", faktura: "red" },
  },
  {
    id: "15", name: "15/01/2025", status: "completed",
    clientName: "Agnieszka Zielińska", services: "Okna, Drzwi", amount: 14500,
    docs: { pomiar: "green", umowa: "green", gwarancja_alco: "green", rekojmia_adk: "green", odbior_inwestor: "green", protokol_montaz: "green", faktura: "green", reklamacja: "gray" },
  },
  {
    id: "16", name: "16/01/2025", status: "completed",
    clientName: "Stanisław Krawczyk", services: "Brama", amount: 8900,
    docs: { pomiar: "green", umowa: "green", gwarancja_alco: "green", rekojmia_adk: "green", odbior_inwestor: "green", protokol_montaz: "green", faktura: "green", reklamacja: "gray" },
  },
  {
    id: "17", name: "17/01/2025", status: "complaint",
    clientName: "Marta Jankowska", services: "Okna", amount: 9800,
    docs: { pomiar: "green", umowa: "green", gwarancja_alco: "green", rekojmia_adk: "green", odbior_inwestor: "green", protokol_montaz: "green", faktura: "green", reklamacja: "red" },
  },
]

const DOC_COLORS: Record<DocState, string> = {
  gray:  "#d0d4dc",
  red:   "#ef4444",
  green: "#22c55e",
}

const DOC_KEYS = ["pomiar", "umowa", "gwarancja_alco", "rekojmia_adk", "odbior_inwestor", "protokol_montaz", "faktura", "reklamacja"]

function DocSquares({ docs }: { docs: Record<string, DocState> }) {
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center", marginTop: 6 }}>
      {DOC_KEYS.map((key) => (
        <div
          key={key}
          title={key.replace(/_/g, " ")}
          style={{
            width: 10,
            height: 10,
            borderRadius: 2,
            backgroundColor: DOC_COLORS[docs[key] ?? "gray"],
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  )
}

function OrderCard({
  order,
  isDragging,
  onDragStart,
}: {
  order: Order
  isDragging: boolean
  onDragStart: (e: React.DragEvent, id: string) => void
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, order.id)}
      style={{
        background: "var(--panel)",
        border: `1px solid ${isDragging ? "var(--accent)" : "var(--line)"}`,
        borderRadius: 4,
        padding: "8px",
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
        transition: "all 0.15s ease",
        boxShadow: isDragging
          ? "0 8px 20px rgba(0,0,0,0.18)"
          : "0 1px 2px rgba(0,0,0,0.04)",
        transform: isDragging ? "scale(1.02)" : undefined,
        opacity: isDragging ? 0.6 : 1,
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
          el.style.borderColor = "var(--line)"
          el.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)"
          el.style.transform = ""
        }
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-strong)", marginBottom: 2 }}>
        {order.name}
      </div>
      <div style={{ fontSize: 10, color: "var(--text-mute)", marginBottom: 3, display: "flex", alignItems: "center", gap: 4 }}>
        {order.clientType === "b2b" && (
          <span style={{
            fontSize: 9, fontWeight: 700, background: "#ede9fe", color: "#7c3aed",
            borderRadius: 3, padding: "1px 4px", lineHeight: 1.4,
          }}>
            B2B
          </span>
        )}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {order.clientName}
        </span>
      </div>
      <div style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {order.services}
      </div>
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--accent)", fontFamily: "monospace" }}>
        {order.amount.toLocaleString("pl-PL")} zł
      </div>
      <DocSquares docs={order.docs} />
    </div>
  )
}

export default function PanelPage() {
  const [orders, setOrders] = useState<Order[]>(MOCK_ORDERS)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<ColumnKey | null>(null)

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggingId(id)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragEnd = () => {
    setDraggingId(null)
    setDragOverCol(null)
  }

  const handleDragOver = (e: React.DragEvent, col: ColumnKey) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverCol(col)
  }

  const handleDrop = (e: React.DragEvent, col: ColumnKey) => {
    e.preventDefault()
    if (draggingId) {
      setOrders((prev) =>
        prev.map((o) => (o.id === draggingId ? { ...o, status: col } : o))
      )
    }
    setDraggingId(null)
    setDragOverCol(null)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
            Panel zleceń
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-mute)", margin: "2px 0 0" }}>
            {orders.length} zleceń łącznie
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

      <div
        style={{
          display: "flex",
          gap: 12,
          overflowX: "auto",
          paddingBottom: 12,
        }}
      >
        {KANBAN_COLUMNS.map((col) => {
          const colOrders = orders.filter((o) => o.status === col.key)
          const isOver = dragOverCol === col.key
          return (
            <div
              key={col.key}
              style={{ flex: "0 0 190px", display: "flex", flexDirection: "column", gap: 8 }}
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDrop={(e) => handleDrop(e, col.key)}
              onDragLeave={() => setDragOverCol(null)}
            >
              <div
                style={{
                  padding: "8px 10px",
                  borderRadius: 6,
                  background: col.bg,
                  border: `1px solid ${col.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "white",
                }}
              >
                <span>{col.label}</span>
                <span style={{
                  background: "rgba(255,255,255,0.25)",
                  borderRadius: 4,
                  padding: "1px 6px",
                  fontSize: 10,
                  fontWeight: 700,
                }}>
                  {colOrders.length}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  minHeight: 80,
                  padding: 4,
                  borderRadius: 6,
                  background: isOver ? "rgba(74,187,195,0.06)" : "transparent",
                  border: isOver ? "1.5px dashed var(--accent)" : "1.5px dashed transparent",
                  transition: "background 0.15s, border 0.15s",
                }}
              >
                {colOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    isDragging={draggingId === order.id}
                    onDragStart={handleDragStart}
                  />
                ))}
                {colOrders.length === 0 && (
                  <div style={{
                    textAlign: "center",
                    fontSize: 10,
                    color: "var(--text-mute)",
                    padding: "12px 0",
                    opacity: 0.6,
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
  )
}
