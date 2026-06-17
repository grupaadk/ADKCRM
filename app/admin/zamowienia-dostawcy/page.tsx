"use client"

import { useState, useMemo } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, X } from "lucide-react"
import { CrmPageHeader, CrmEmptyState, fmtDate } from "@/components/crm-ui"

type SortField =
  | "orderName"
  | "clientName"
  | "serviceName"
  | "supplierName"
  | "orderDate"
  | "deliveryDate"
  | "receivedDate"
  | "status"
type SortDirection = "asc" | "desc"
type DeliveryStatus = "pending" | "overdue" | "delivered"

type Row = {
  key: string
  orderId: Id<"orders">
  clientId: string
  orderName: string | null
  clientName: string
  deliveryIndex: number
  serviceName: string
  supplierName: string
  orderDate?: number
  deliveryDate?: number
  receivedDate?: number
}

function tsToInputValue(ts?: number): string {
  if (!ts) return ""
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function inputValueToTs(value: string): number | null {
  if (!value) return null
  const [y, m, d] = value.split("-").map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d).getTime()
}

// Status linii dostawy:
// - dostarczone  → data faktycznego odbioru (receivedDate), która już nadeszła
//   (data w przyszłości to błąd wprowadzania — nie da się odebrać towaru w przyszłości)
// - przeterminowane → minęła planowana data dostawy, a towar nie został odebrany
// - oczekuje     → pozostałe
function rowStatus(r: Row, todayStart: number): DeliveryStatus {
  if (r.receivedDate != null && r.receivedDate <= todayStart) return "delivered"
  if (r.deliveryDate != null && r.deliveryDate < todayStart) return "overdue"
  return "pending"
}

const STATUS_META: Record<DeliveryStatus, { label: string; color: string }> = {
  pending: { label: "Oczekuje", color: "var(--warn, #d97706)" },
  overdue: { label: "Przeterminowane", color: "var(--err, #dc2626)" },
  delivered: { label: "Dostarczone", color: "var(--ok, #16a34a)" },
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDirection }) {
  const cls = "ml-1 inline"
  if (sortField !== field) return <ChevronsUpDown className={`${cls} size-3`} style={{ color: "var(--text-mute)", opacity: 0.5 }} />
  return sortDir === "asc"
    ? <ChevronUp className={`${cls} size-3`} style={{ color: "var(--text-strong)" }} />
    : <ChevronDown className={`${cls} size-3`} style={{ color: "var(--text-strong)" }} />
}

function FilterBtn({ isActive, onClick, children }: { isActive: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "4px 10px", borderRadius: 4, fontSize: 11.5,
        background: isActive ? "var(--accent-soft)" : "transparent",
        color: isActive ? "var(--accent)" : "var(--text-mute)",
        border: "1px solid", borderColor: isActive ? "var(--accent-line)" : "transparent",
        fontWeight: isActive ? 600 : 500, cursor: "pointer", fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  )
}

function CountBadge({ count, active }: { count: number; active: boolean }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: "0 5px", borderRadius: 999,
      background: active ? "var(--accent)" : "var(--panel-3)",
      color: active ? "#fff" : "var(--text-mute)",
    }}>{count}</span>
  )
}

function StatusBadge({ status }: { status: DeliveryStatus }) {
  const { label, color } = STATUS_META[status]
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 500, color }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      {label}
    </span>
  )
}

const dateInputStyle: React.CSSProperties = {
  fontFamily: "inherit",
  fontSize: 12,
  color: "var(--text-strong)",
  background: "var(--panel)",
  border: "1px solid var(--line)",
  borderRadius: 6,
  padding: "4px 6px",
  outline: "none",
}

const DAY_MS = 86_400_000
const UPCOMING_DAYS = 3 // planowana dostawa "bliska", gdy zostało ≤ tylu dni

function localMidnight(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// Wyróżnienie komórki "Planowana dostawa":
// - przeterminowane → czerwona ramka (status liczony osobno, bez etykiety)
// - bliska dostawa (nieodebrane, ≤ UPCOMING_DAYS dni): żółto (2–3 dni) lub pomarańczowo (dziś/jutro) + etykieta
function deliveryCellDecor(
  r: Row,
  status: DeliveryStatus,
  todayStart: number,
): { style: React.CSSProperties; label: string | null; labelColor: string } {
  if (status === "overdue") {
    return {
      style: { ...dateInputStyle, borderColor: "var(--err, #dc2626)", color: "var(--err, #dc2626)" },
      label: null,
      labelColor: "var(--err, #dc2626)",
    }
  }
  if (status === "pending" && r.deliveryDate != null) {
    const days = Math.round((localMidnight(r.deliveryDate) - todayStart) / DAY_MS)
    if (days >= 0 && days <= UPCOMING_DAYS) {
      const strong = days <= 1 // dziś lub jutro
      return {
        style: strong
          ? { ...dateInputStyle, background: "#fff1e6", borderColor: "#fb923c", color: "#9a3412", fontWeight: 600 }
          : { ...dateInputStyle, background: "#fefce8", borderColor: "#f0c000", color: "#854d0e", fontWeight: 600 },
        label: days === 0 ? "dziś" : days === 1 ? "jutro" : `za ${days} dni`,
        labelColor: strong ? "#c2410c" : "#a16207",
      }
    }
  }
  return { style: dateInputStyle, label: null, labelColor: "var(--text-mute)" }
}

export default function SupplierOrdersPage() {
  const orders = useQuery(api.orders.listSupplierOrders)
  const isLoading = orders === undefined

  // Północ dzisiaj — granica dla wykrywania przeterminowanych planowanych dostaw
  const todayStart = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }, [])

  const updateDeliveryDate = useMutation(
    api.orders.updateServiceDeliveryDate,
  ).withOptimisticUpdate((localStore, args) => {
    const cur = localStore.getQuery(api.orders.listSupplierOrders, {})
    if (!cur) return
    const next = cur.map((o) =>
      o._id === args.orderId
        ? {
            ...o,
            deliveries: o.deliveries.map((d) =>
              d.index === args.deliveryIndex
                ? { ...d, [args.field]: args.value ?? undefined }
                : d,
            ),
          }
        : o,
    )
    localStore.setQuery(api.orders.listSupplierOrders, {}, next)
  })

  const [search, setSearch] = useState("")
  const [supplierFilter, setSupplierFilter] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<Set<DeliveryStatus>>(new Set())
  const [sortField, setSortField] = useState<SortField>("deliveryDate")
  const [sortDir, setSortDir] = useState<SortDirection>("asc")

  // Spłaszczenie: 1 wiersz = 1 zamówienie u dostawcy (linia serviceDeliveries)
  const allRows = useMemo<Row[]>(() => {
    if (!orders) return []
    return orders.flatMap((o) =>
      o.deliveries.map((d) => ({
        key: `${o._id}:${d.index}`,
        orderId: o._id,
        clientId: o.clientId as string,
        orderName: o.name ?? null,
        clientName: o.clientName,
        deliveryIndex: d.index,
        serviceName: d.serviceName,
        supplierName: d.supplierName,
        orderDate: d.orderDate,
        deliveryDate: d.deliveryDate,
        receivedDate: d.receivedDate,
      })),
    )
  }, [orders])

  const suppliers = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of allRows) counts.set(r.supplierName, (counts.get(r.supplierName) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], "pl"))
  }, [allRows])

  const statusCounts = useMemo(() => {
    const c: Record<DeliveryStatus, number> = { pending: 0, overdue: 0, delivered: 0 }
    for (const r of allRows) c[rowStatus(r, todayStart)]++
    return c
  }, [allRows, todayStart])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    const filtered = allRows.filter((r) => {
      if (term) {
        const hit =
          (r.orderName ?? "").toLowerCase().includes(term) ||
          r.clientName.toLowerCase().includes(term) ||
          r.serviceName.toLowerCase().includes(term) ||
          r.supplierName.toLowerCase().includes(term)
        if (!hit) return false
      }
      if (supplierFilter.size > 0 && !supplierFilter.has(r.supplierName)) return false
      if (statusFilter.size > 0 && !statusFilter.has(rowStatus(r, todayStart))) return false
      return true
    })

    const mul = sortDir === "asc" ? 1 : -1
    return [...filtered].sort((a, b) => {
      if (sortField === "orderDate" || sortField === "deliveryDate" || sortField === "receivedDate") {
        const av = a[sortField]
        const bv = b[sortField]
        if (av == null && bv == null) return 0
        if (av == null) return 1 // brak daty zawsze na końcu
        if (bv == null) return -1
        return (av - bv) * mul
      }
      if (sortField === "status") {
        const rank: Record<DeliveryStatus, number> = { overdue: 0, pending: 1, delivered: 2 }
        return (rank[rowStatus(a, todayStart)] - rank[rowStatus(b, todayStart)]) * mul
      }
      const av = String(a[sortField] ?? "").toLowerCase()
      const bv = String(b[sortField] ?? "").toLowerCase()
      return av.localeCompare(bv, "pl") * mul
    })
  }, [allRows, search, supplierFilter, statusFilter, sortField, sortDir, todayStart])

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortField(field); setSortDir("asc") }
  }

  const toggleSupplier = (name: string) => {
    setSupplierFilter((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const toggleStatus = (s: DeliveryStatus) => {
    setStatusFilter((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }

  const handleDateChange = (
    row: Row,
    field: "orderDate" | "deliveryDate" | "receivedDate",
    value: string,
  ) => {
    updateDeliveryDate({
      orderId: row.orderId,
      deliveryIndex: row.deliveryIndex,
      field,
      value: inputValueToTs(value),
    })
  }

  // Odbiór: przycisk ustawia dzisiejszą datę, krzyżyk ją usuwa
  const markReceived = (row: Row) =>
    updateDeliveryDate({ orderId: row.orderId, deliveryIndex: row.deliveryIndex, field: "receivedDate", value: todayStart })

  const clearReceived = (row: Row) =>
    updateDeliveryDate({ orderId: row.orderId, deliveryIndex: row.deliveryIndex, field: "receivedDate", value: null })

  // Klik w wiersz otwiera szczegóły zlecenia w nowej karcie — ignoruj kliknięcia
  // w interaktywne elementy (pola dat, przyciski odbioru)
  const openOrder = (row: Row, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("input, button")) return
    window.open(`/admin/klient/${row.clientId}/zlecenie/${row.orderId}`, "_blank")
  }

  const isFiltering = !!search.trim() || supplierFilter.size > 0 || statusFilter.size > 0

  return (
    <div>
      <CrmPageHeader
        title="Zamówienia od dostawcy"
        sub={`${allRows.length} zamówień · ${statusCounts.pending} oczekuje · ${statusCounts.overdue} przeterminowanych`}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Toolbar */}
        <div className="panel" style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Search */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, maxWidth: 520 }}>
            <span style={{
              fontSize: 12, fontWeight: 600, color: "var(--text-strong)",
              whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5,
            }}>
              <Search style={{ width: 15, height: 15 }} />
              Szukaj
            </span>
            <div style={{ position: "relative", flex: 1 }}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Numer zlecenia, klient, usługa lub dostawca"
                style={{
                  width: "100%",
                  padding: "10px 34px 10px 12px",
                  borderRadius: 8,
                  border: "2px solid var(--accent-line)",
                  background: "var(--bg)",
                  fontSize: 14,
                  fontWeight: 500,
                  fontFamily: "inherit",
                  color: "var(--text-strong)",
                  outline: "none",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent)"
                  e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-soft)"
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent-line)"
                  e.currentTarget.style.boxShadow = "none"
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  style={{
                    position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                    background: "var(--panel-3)", border: "none", borderRadius: "50%",
                    cursor: "pointer", color: "var(--text-mute)", width: 22, height: 22,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <X style={{ width: 13, height: 13 }} />
                </button>
              )}
            </div>
            {isFiltering && (
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", whiteSpace: "nowrap" }}>
                {rows.length} wyników
              </span>
            )}
          </div>

          {/* Status filter */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4 }}>
            <span className="mute" style={{ fontSize: 11, marginRight: 2 }}>Status:</span>
            {(["pending", "overdue", "delivered"] as const).map((s) => (
              <FilterBtn key={s} isActive={statusFilter.has(s)} onClick={() => toggleStatus(s)}>
                {STATUS_META[s].label} <CountBadge count={statusCounts[s]} active={statusFilter.has(s)} />
              </FilterBtn>
            ))}
          </div>

          {/* Supplier filter */}
          {suppliers.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4 }}>
              <span className="mute" style={{ fontSize: 11, marginRight: 2 }}>Dostawca:</span>
              {suppliers.map(([name, count]) => (
                <FilterBtn key={name} isActive={supplierFilter.has(name)} onClick={() => toggleSupplier(name)}>
                  {name} <CountBadge count={count} active={supplierFilter.has(name)} />
                </FilterBtn>
              ))}
            </div>
          )}
        </div>

        {/* Table */}
        <div className="panel" style={{ overflow: "hidden" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ cursor: "pointer", width: 130 }} onClick={() => handleSort("orderName")}>
                  Nr zlecenia <SortIcon field="orderName" sortField={sortField} sortDir={sortDir} />
                </th>
                <th style={{ cursor: "pointer" }} onClick={() => handleSort("clientName")}>
                  Klient <SortIcon field="clientName" sortField={sortField} sortDir={sortDir} />
                </th>
                <th style={{ cursor: "pointer" }} onClick={() => handleSort("serviceName")}>
                  Usługa <SortIcon field="serviceName" sortField={sortField} sortDir={sortDir} />
                </th>
                <th style={{ cursor: "pointer" }} onClick={() => handleSort("supplierName")}>
                  Dostawca <SortIcon field="supplierName" sortField={sortField} sortDir={sortDir} />
                </th>
                <th style={{ cursor: "pointer", width: 140 }} onClick={() => handleSort("orderDate")}>
                  Data zamówienia <SortIcon field="orderDate" sortField={sortField} sortDir={sortDir} />
                </th>
                <th style={{ cursor: "pointer", width: 140 }} onClick={() => handleSort("deliveryDate")}>
                  Planowana dostawa <SortIcon field="deliveryDate" sortField={sortField} sortDir={sortDir} />
                </th>
                <th style={{ cursor: "pointer", width: 140 }} onClick={() => handleSort("receivedDate")}>
                  Odebrano <SortIcon field="receivedDate" sortField={sortField} sortDir={sortDir} />
                </th>
                <th style={{ cursor: "pointer", width: 150 }} onClick={() => handleSort("status")}>
                  Status <SortIcon field="status" sortField={sortField} sortDir={sortDir} />
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j}><div style={{ height: 14, borderRadius: 4, background: "var(--panel-3)", animation: "pulse 1.5s ease-in-out infinite" }} /></td>
                  ))}
                </tr>
              ))}

              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <CrmEmptyState message={isFiltering ? "Brak wyników dla wybranych filtrów." : "Brak zamówień od dostawców."} />
                  </td>
                </tr>
              )}

              {!isLoading && rows.map((r) => {
                const status = rowStatus(r, todayStart)
                const delivery = deliveryCellDecor(r, status, todayStart)
                return (
                  <tr key={r.key} onClick={(e) => openOrder(r, e)} style={{ cursor: "pointer" }} title="Otwórz zlecenie w nowej karcie">
                    <td className="mono" style={{ fontSize: 11, color: "var(--text-mute)" }}>
                      {r.orderName ?? <span style={{ color: "var(--panel-3)" }}>—</span>}
                    </td>
                    <td className="strong" style={{ fontWeight: 500 }}>{r.clientName}</td>
                    <td style={{ fontSize: 12 }}>{r.serviceName}</td>
                    <td style={{ fontSize: 12 }}>{r.supplierName}</td>
                    <td>
                      <input
                        type="date"
                        value={tsToInputValue(r.orderDate)}
                        onChange={(e) => handleDateChange(r, "orderDate", e.target.value)}
                        style={dateInputStyle}
                      />
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-start" }}>
                        <input
                          type="date"
                          value={tsToInputValue(r.deliveryDate)}
                          onChange={(e) => handleDateChange(r, "deliveryDate", e.target.value)}
                          style={delivery.style}
                        />
                        {delivery.label && (
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: delivery.labelColor }}>
                            {delivery.label}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      {r.receivedDate ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span className="mono" style={{
                            fontSize: 12, fontWeight: 600,
                            color: status === "delivered" ? "var(--ok, #16a34a)" : "var(--text-strong)",
                          }}>
                            {fmtDate(r.receivedDate)}
                          </span>
                          <button
                            onClick={() => clearReceived(r)}
                            title="Usuń datę odbioru"
                            style={{
                              display: "inline-flex", alignItems: "center", justifyContent: "center",
                              background: "transparent", border: "none", cursor: "pointer",
                              color: "var(--text-mute)", padding: 2, borderRadius: 4,
                            }}
                          >
                            <X style={{ width: 13, height: 13 }} />
                          </button>
                        </span>
                      ) : (
                        <button
                          className="btn"
                          onClick={() => markReceived(r)}
                          title="Oznacz jako odebrane (dzisiejsza data)"
                          style={{ padding: "3px 10px", fontSize: 11.5, color: "var(--ok, #16a34a)" }}
                        >
                          Potwierdź odbiór
                        </button>
                      )}
                    </td>
                    <td><StatusBadge status={status} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
