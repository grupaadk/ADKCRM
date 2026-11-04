"use client"

import { useState, useMemo, useEffect } from "react"
import { useQuery } from "convex/react"
import { useRouter } from "next/navigation"
import { api } from "@/convex/_generated/api"
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import DocumentProgressTiles, { DocumentColumnHeader } from "@/app/admin/klient/[id]/DocumentProgressTiles"
import { CrmEmptyState } from "@/components/crm-ui"
import { useStatusLabels, useStatuses } from "@/components/StatusLabelsContext"
import { calculateOrderRating } from "@/lib/rating"
import OrdersReportDashboard from "./OrdersReportDashboard"

type SortField = "client" | "balance" | "rating" | "status" | "services" | "createdAt" | "totalGross"
type SortDirection = "asc" | "desc"

type Order = {
  _id: string
  _creationTime: number
  clientId: string
  status: string
  services?: string[]
  name?: string
  customText?: string
  investmentCity?: string
  investmentStreet?: string
  comment?: string
  profit?: number | null
  workDays?: number | null
  assignees?: Array<{ id: string; name: string | null; color?: string }>
  client: {
    firstName: string
    lastName: string
    city?: string
    clientType?: "individual" | "business"
    companyName?: string
  } | null
  fakturownia?: { invoices?: Array<{ kind: "advance" | "final" | "vat"; number?: string }> }
  documents?: Record<string, { url?: string; signatureStatus?: "signed" | "not_applicable" }>
  totalNet?: number | null
  totalGross?: number | null
  assignedUserColor?: string
  assignedUserId?: string
  projectStartDate?: number
  projectEndDate?: number
  installationStartDate?: number
}

type ClientFilter = "all" | "individual" | "business"

function clientPrimaryName(client: Order["client"]): string {
  if (!client) return ""
  if (client.clientType === "business" && client.companyName) return client.companyName
  return `${client.lastName} ${client.firstName}`
}



function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDirection }) {
  const cls = "ml-1 inline"
  if (sortField !== field) return <ChevronsUpDown className={`${cls} size-3`} style={{ color: "var(--text-mute)", opacity: 0.5 }} />
  return sortDir === "asc"
    ? <ChevronUp className={`${cls} size-3`} style={{ color: "var(--text-strong)" }} />
    : <ChevronDown className={`${cls} size-3`} style={{ color: "var(--text-strong)" }} />
}

function OrderRatingProgressBar({ profit, workDays }: { profit?: number | null; workDays?: number | null }) {
  const { dailyProfit, rating, color, label, description, percentage } = calculateOrderRating(profit, workDays)

  return (
    <div
      title={`Rating: ${label}${dailyProfit !== null ? ` (${dailyProfit.toLocaleString("pl-PL")} zł/d)` : ""} — ${description}`}
      style={{ minWidth: 85, maxWidth: 110 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 9.5, fontWeight: 600, color: "var(--text-mute)", letterSpacing: "0.02em" }}>
          Rating
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: rating !== null ? color : "var(--text-mute)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          width: "100%",
          height: 5,
          borderRadius: 9999,
          backgroundColor: "#e2e8f0",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: "100%",
            borderRadius: 9999,
            backgroundColor: color,
            transition: "width 0.3s ease, background-color 0.3s ease",
          }}
        />
      </div>
    </div>
  )
}



function toAlphaColor(color: string, alphaHex: string = "18"): string {
  if (color.startsWith("#")) {
    if (color.length === 7) return `${color}${alphaHex}`
    if (color.length === 4) return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}${alphaHex}`
  }
  return color
}

export default function OrderList({ searchTerm = "", showReports = false }: { searchTerm?: string, showReports?: boolean, showFilters?: boolean }) {
  const router = useRouter()
  const statusLabels = useStatusLabels()
  const statuses = useStatuses()
  const orders = useQuery(api.orders.list, {})
  const allInvoices = useQuery(api.fakturownia.listCachedInvoices)
  const allExpenses = useQuery(api.fakturownia.listCachedExpenses)
  const currentUser = useQuery(api.users.me)
  const allUsers = useQuery(api.users.listAllActive)
  const isLoading = orders === undefined

  const [sortField, setSortField] = useState<SortField>("createdAt")
  const [sortDir, setSortDir] = useState<SortDirection>("desc")
  const [viewFilter, setViewFilter] = useState<"all" | "active" | "complaint" | "completed">("active")
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [clientFilter, setClientFilter] = useState<ClientFilter>("all")
  const [activeUserFilters, setActiveUserFilters] = useState<Set<string>>(new Set())
  const [debouncedSearch, setDebouncedSearch] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.toLowerCase().trim())
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])
  useEffect(() => {
    if (!currentUser?._id) return
    const key = `zamowienia_user_filter_${currentUser._id}`
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
        localStorage.setItem(`zamowienia_user_filter_${currentUser._id}`, JSON.stringify([...next]))
      }
      return next
    })
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortField(field); setSortDir("asc") }
  }

  const counts = useMemo(() => {
    if (!orders) return { all: 0, active: 0, complaint: 0, completed: 0 }
    const all = (orders as Order[]).length
    const completed = (orders as Order[]).filter((o) => o.status === "completed").length
    const complaint = (orders as Order[]).filter((o) => o.status === "complaint").length
    return { all, active: all - completed, complaint, completed }
  }, [orders])

  const statusCounts = useMemo(() => {
    if (!orders) return {} as Record<string, number>
    return (orders as Order[]).reduce<Record<string, number>>((acc, o) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1
      return acc
    }, {})
  }, [orders])

  const financialBalanceByOrder = useMemo(() => {
    if (allInvoices === undefined || allExpenses === undefined || !orders) {
      return null
    }

    const invMap = new Map<string, number>()
    for (const inv of allInvoices) {
      if (!inv.orderId) continue
      if (inv.kind === "estimate" || inv.kind === "order") continue
      invMap.set(inv.orderId, (invMap.get(inv.orderId) ?? 0) + (inv.netAmount ?? 0))
    }

    const expMap = new Map<string, number>()
    for (const exp of allExpenses) {
      if (!exp.orderId) continue
      expMap.set(exp.orderId, (expMap.get(exp.orderId) ?? 0) + (exp.netAmount ?? 0))
    }

    const result = new Map<string, { balNet: number; marginPct: number | null; invNet: number }>()

    for (const o of orders as Order[]) {
      const orderId = o._id
      const invNet = invMap.get(orderId) ?? 0
      const expNet = expMap.get(orderId) ?? 0
      const balNet = invNet - expNet
      const marginPct = invNet > 0 ? (balNet / invNet) * 100 : null
      result.set(orderId, { balNet, marginPct, invNet })
    }

    return result
  }, [orders, allInvoices, allExpenses])

  const displayOrders = useMemo(() => {
    if (!orders) return undefined
    let filtered = orders as Order[]
    if (viewFilter === "active") filtered = filtered.filter((o) => o.status !== "completed")
    else if (viewFilter === "complaint") filtered = filtered.filter((o) => o.status === "complaint")
    else if (viewFilter === "completed") filtered = filtered.filter((o) => o.status === "completed")
    if (statusFilter) filtered = filtered.filter((o) => o.status === statusFilter)
    if (clientFilter === "business") filtered = filtered.filter((o) => o.client?.clientType === "business")
    else if (clientFilter === "individual") filtered = filtered.filter((o) => o.client?.clientType !== "business")
    if (activeUserFilters.size > 0) {
      filtered = filtered.filter((o) => {
        const uid = o.assignedUserId
        if (!uid) return activeUserFilters.has("__none__")
        return activeUserFilters.has(uid)
      })
    }
    if (debouncedSearch) {
      const q = debouncedSearch
      filtered = filtered.filter((o) => {
        const client = o.client
        const clientName = client
          ? client.clientType === "business" && client.companyName
            ? `${client.companyName} ${client.firstName} ${client.lastName}`
            : `${client.lastName} ${client.firstName}`
          : ""
        const alcoNumbers = (o.serviceDeliveries ?? [])
          .map((d) => d.externalOrderNumber)
          .filter((n): n is string => Boolean(n))
        const alcoIds = (o.serviceDeliveries ?? [])
          .map((d) => d.externalOrderId)
          .filter((id): id is string => Boolean(id))
        const fields = [
          o.name ?? "",
          o.customText ?? "",
          o.investmentCity ?? "",
          o.investmentStreet ?? "",
          o.comment ?? "",
          clientName,
          client?.city ?? "",
          ...alcoNumbers,
          ...alcoIds,
        ]
        return fields.some((f) => f.toLowerCase().includes(q))
      })
    }
    return [...filtered].sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case "client": {
          const aName = clientPrimaryName(a.client)
          const bName = clientPrimaryName(b.client)
          cmp = aName.localeCompare(bName, "pl"); break
        }
        case "status": cmp = a.status.localeCompare(b.status, "pl"); break
        case "services": cmp = (a.services ?? []).join().localeCompare((b.services ?? []).join(), "pl"); break
        case "createdAt": cmp = (a.projectStartDate ?? a._creationTime) - (b.projectStartDate ?? b._creationTime); break
        case "balance": {
          const aBal = financialBalanceByOrder?.get(a._id)?.balNet ?? 0
          const bBal = financialBalanceByOrder?.get(b._id)?.balNet ?? 0
          cmp = aBal - bBal
          break
        }
        case "rating": {
          const aDaily = calculateOrderRating(a.profit, a.workDays).dailyProfit ?? -Infinity
          const bDaily = calculateOrderRating(b.profit, b.workDays).dailyProfit ?? -Infinity
          cmp = aDaily - bDaily
          break
        }
        case "totalGross": cmp = (a.totalGross ?? 0) - (b.totalGross ?? 0); break
      }
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [orders, viewFilter, statusFilter, clientFilter, activeUserFilters, sortField, sortDir, debouncedSearch, financialBalanceByOrder])

  const visibleSummary = useMemo(() => {
    if (!displayOrders || !financialBalanceByOrder) {
      return { count: 0, totalBalance: 0, totalNet: 0, overallMargin: null }
    }
    let totalBalance = 0
    let totalNet = 0
    let totalInvNet = 0
    for (const order of displayOrders) {
      const fin = financialBalanceByOrder.get(order._id)
      totalBalance += fin?.balNet ?? 0
      totalInvNet += fin?.invNet ?? 0
      totalNet += order.totalNet ?? 0
    }
    const overallMargin = totalInvNet > 0 ? (totalBalance / totalInvNet) * 100 : null
    return {
      count: displayOrders.length,
      totalBalance,
      totalNet,
      overallMargin,
    }
  }, [displayOrders, financialBalanceByOrder])

  const clientFilterLabels: { key: ClientFilter; label: string }[] = [
    { key: "all", label: "Wszyscy" },
    { key: "individual", label: "Indywidualni" },
    { key: "business", label: "Biznesowi" },
  ]

  const viewTabs: { key: "all" | "active" | "complaint" | "completed"; label: string; count: number }[] = [
    { key: "all",       label: "Wszystkie",  count: counts.all },
    { key: "active",    label: "Aktywne",    count: counts.active },
    { key: "complaint", label: "Reklamacje", count: counts.complaint },
    { key: "completed", label: "Zakończone", count: counts.completed },
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Reports Dashboard */}
      {showReports && (
        <div className="panel" style={{ padding: "20px 24px" }}>
          <OrdersReportDashboard />
        </div>
      )}

      {/* Minimalist Filters Toolbar - Always Visible */}
      <div
        className="panel"
        style={{
          padding: "8px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: 8,
          }}
        >
          {/* Top row: Widok + Typ klienta + Reset */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
              {/* Widok segmented control */}
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 2,
                background: "var(--panel-2)",
                padding: 2,
                borderRadius: 7,
                border: "1px solid var(--line)",
              }}>
                {viewTabs.map(({ key, label, count }) => {
                  const active = viewFilter === key
                  return (
                    <button
                      key={key}
                      onClick={() => setViewFilter(key)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "3px 9px",
                        borderRadius: 5,
                        fontSize: 11.5,
                        fontWeight: active ? 600 : 500,
                        background: active ? "var(--panel)" : "transparent",
                        color: active ? "var(--text-strong)" : "var(--text-mute)",
                        boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                        border: "none",
                        cursor: "pointer",
                        transition: "all 0.12s ease",
                        fontFamily: "inherit",
                      }}
                    >
                      {label}
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "0 4px",
                        borderRadius: 999,
                        background: active ? "var(--accent)" : "var(--panel-3)",
                        color: active ? "#fff" : "var(--text-mute)",
                      }}>
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div style={{ width: 1, height: 16, background: "var(--line)" }} />

              {/* Typ klienta segmented control */}
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 2,
                background: "var(--panel-2)",
                padding: 2,
                borderRadius: 7,
                border: "1px solid var(--line)",
              }}>
                {clientFilterLabels.map(({ key, label }) => {
                  const active = clientFilter === key
                  return (
                    <button
                      key={key}
                      onClick={() => setClientFilter(key)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "3px 9px",
                        borderRadius: 5,
                        fontSize: 11.5,
                        fontWeight: active ? 600 : 500,
                        background: active ? "var(--panel)" : "transparent",
                        color: active ? "var(--text-strong)" : "var(--text-mute)",
                        boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                        border: "none",
                        cursor: "pointer",
                        transition: "all 0.12s ease",
                        fontFamily: "inherit",
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Clear filters button */}
            {(statusFilter !== null || clientFilter !== "all" || activeUserFilters.size > 0 || viewFilter !== "active") && (
              <button
                onClick={() => {
                  setStatusFilter(null)
                  setClientFilter("all")
                  setActiveUserFilters(new Set())
                  setViewFilter("active")
                  if (currentUser?._id) {
                    localStorage.removeItem(`zamowienia_user_filter_${currentUser._id}`)
                  }
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 500,
                  color: "var(--text-mute)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "2px 6px",
                  borderRadius: 4,
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-strong)" }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-mute)" }}
              >
                ✕ Wyczyść filtry
              </button>
            )}
          </div>

          {/* Bottom row: Statusy + Opiekunowie */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14, paddingTop: 4, borderTop: "1px solid var(--line)" }}>
            {/* Statusy */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 0.5, marginRight: 2 }}>
                Status:
              </span>
              {statuses.map((st) => st.key).filter((s) => (statusCounts[s] ?? 0) > 0).map((s) => {
                const active = statusFilter === s
                const count = statusCounts[s] ?? 0
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(active ? null : s)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "2px 8px",
                      borderRadius: 14,
                      fontSize: 11,
                      fontWeight: active ? 600 : 500,
                      background: active ? "var(--accent-soft)" : "transparent",
                      color: active ? "var(--accent)" : "var(--text-dim)",
                      border: `1px solid ${active ? "var(--accent-line)" : "transparent"}`,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      transition: "all 0.1s ease",
                    }}
                  >
                    <span>{statusLabels[s] ?? s}</span>
                    <span style={{
                      fontSize: 9.5,
                      fontWeight: 600,
                      padding: "0 4px",
                      borderRadius: 999,
                      background: active ? "var(--accent)" : "var(--panel-3)",
                      color: active ? "#fff" : "var(--text-mute)",
                    }}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            <div style={{ width: 1, height: 14, background: "var(--line)" }} />

            {/* Przypisany */}
            {allUsers && (
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 0.5, marginRight: 2 }}>
                  Opiekun:
                </span>
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
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "2px 8px",
                          borderRadius: 14,
                          fontSize: 11,
                          background: active ? "var(--panel-3)" : "transparent",
                          color: active ? "var(--text-strong)" : "var(--text-dim)",
                          border: `1px solid ${active ? "var(--line-2)" : "transparent"}`,
                          fontWeight: active ? 600 : 500,
                          cursor: "pointer",
                          transition: "all 0.1s ease",
                          fontFamily: "inherit",
                        }}
                      >
                        <span style={{
                          width: 7, height: 7, borderRadius: "50%",
                          background: user.color ? (active ? user.color : `${user.color}80`) : (active ? "#64748b" : "#64748b40"),
                          flexShrink: 0,
                        }} />
                        {name}{isMe ? " (Ty)" : ""}
                      </button>
                    )
                  })
                }
                {/* Bez przypisania */}
                {(() => {
                  const active = activeUserFilters.has("__none__")
                  return (
                    <button
                      onClick={() => toggleUserFilter("__none__")}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "2px 8px",
                        borderRadius: 14,
                        fontSize: 11,
                        background: active ? "var(--panel-3)" : "transparent",
                        color: active ? "var(--text-strong)" : "var(--text-dim)",
                        border: `1px solid ${active ? "var(--line-2)" : "transparent"}`,
                        fontWeight: active ? 600 : 500,
                        cursor: "pointer",
                        transition: "all 0.1s ease",
                        fontFamily: "inherit",
                      }}
                    >
                      <span style={{
                        width: 7, height: 7, borderRadius: "50%",
                        border: "1.5px dashed var(--text-mute)",
                        flexShrink: 0,
                      }} />
                      Bez przypisania
                    </button>
                  )
                })()}
              </div>
            )}
          </div>
        </div>

      {/* Results Count Summary (if searching) */}
      {debouncedSearch && displayOrders && (
        <div style={{ display: "flex", alignItems: "center", padding: "0 4px", marginBottom: -4 }}>
          <span style={{
            fontSize: 12, fontWeight: 600, color: "var(--accent)", whiteSpace: "nowrap",
          }}>
            Znaleziono {displayOrders.length} wyników
          </span>
        </div>
      )}

      {/* Table */}
      <div className="panel" style={{ position: "relative" }}>
        <style>{`
          .tbl tr.order-colored-row:hover td {
            background: transparent !important;
          }
        `}</style>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 110, borderTopLeftRadius: 8 }}>Zlecenie</th>
              <th style={{ cursor: "pointer", width: 140 }} onClick={() => handleSort("client")}>
                Klient <SortIcon field="client" sortField={sortField} sortDir={sortDir} />
              </th>
              <th style={{ cursor: "pointer", width: 120 }} onClick={() => handleSort("status")}>
                Status <SortIcon field="status" sortField={sortField} sortDir={sortDir} />
              </th>
              <th style={{ cursor: "pointer", width: 150 }} onClick={() => handleSort("services")}>
                Usługi <SortIcon field="services" sortField={sortField} sortDir={sortDir} />
              </th>
              <th style={{ width: 140 }}>
                <DocumentColumnHeader />
              </th>
              <th style={{ cursor: "pointer", width: 110 }} onClick={() => handleSort("rating")}>
                Rating <SortIcon field="rating" sortField={sortField} sortDir={sortDir} />
              </th>
              <th style={{ cursor: "pointer", width: 130, textAlign: "right" }} onClick={() => handleSort("balance")}>
                Bilans (Zysk) <SortIcon field="balance" sortField={sortField} sortDir={sortDir} />
              </th>
              <th style={{ cursor: "pointer", width: 110, textAlign: "right", borderTopRightRadius: 8 }} onClick={() => handleSort("totalGross")}>
                Netto <SortIcon field="totalGross" sortField={sortField} sortDir={sortDir} />
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 8 }).map((_, j) => (
                  <td key={j}><div style={{ height: 14, borderRadius: 4, background: "var(--panel-3)", animation: "pulse 1.5s ease-in-out infinite" }} /></td>
                ))}
              </tr>
            ))}

            {!isLoading && displayOrders?.length === 0 && (
              <tr>
                <td colSpan={8}><CrmEmptyState message="Brak zleceń spełniających kryteria." /></td>
              </tr>
            )}

            {displayOrders?.map((order) => {
              const isCompleted = order.status === "completed"
              const clientName = order.client
                ? order.client.clientType === "business" && order.client.companyName
                  ? order.client.companyName
                  : `${order.client.lastName} ${order.client.firstName}`
                : null

              const assignees = (order.assignees && order.assignees.length > 0)
                ? order.assignees
                : (order.assignedUserColor ? [{ color: order.assignedUserColor }] : [])
              const userColors = assignees
                .map(a => a.color || (allUsers?.find(u => u._id === a.id)?.color))
                .filter((c): c is string => Boolean(c))

              let rowBackground: string | undefined = undefined
              if (userColors.length > 1) {
                const step = 100 / userColors.length
                const stops = userColors.map((c, i) => `${toAlphaColor(c, "18")} ${i * step}%, ${toAlphaColor(c, "18")} ${(i + 1) * step}%`)
                rowBackground = `linear-gradient(to right, ${stops.join(", ")})`
              } else if (userColors.length === 1) {
                rowBackground = toAlphaColor(userColors[0], "18")
              } else if (isCompleted) {
                rowBackground = "var(--ok-soft)"
              }

              return (
                <tr
                  key={order._id}
                  className={rowBackground ? "order-colored-row" : ""}
                  style={{
                    background: rowBackground,
                    cursor: "pointer",
                    transition: "filter 0.12s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (rowBackground) {
                      e.currentTarget.style.filter = "brightness(0.96)"
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (rowBackground) {
                      e.currentTarget.style.filter = ""
                    }
                  }}
                  onClick={() => router.push(`/admin/klient/${order.clientId}/zlecenie/${order._id}`)}
                >
                  <td className="mono" style={{
                    fontSize: 11,
                    color: "var(--text-mute)",
                    borderLeft: userColors.length > 0 ? `4px solid ${userColors[0]}` : undefined,
                  }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-start" }}>
                      <span style={{ fontWeight: 600, color: "var(--text-strong)" }}>{order.name ?? "—"}</span>
                      {order.customText && <span className="chip-custom">{order.customText}</span>}
                    </div>
                  </td>
                  <td>
                    {clientName ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); router.push(`/admin/klient/${order.clientId}`); }}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "3px 10px", borderRadius: 20, fontSize: 11.5,
                          fontWeight: 600, fontFamily: "inherit",
                          background: "var(--panel-2)", border: "1px solid var(--line)",
                          color: "var(--text-strong)", cursor: "pointer",
                          transition: "background 0.12s, border-color 0.12s",
                          maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}
                        title={clientName}
                      >
                        {clientName}
                      </button>
                    ) : (
                      <span className="mute">—</span>
                    )}
                  </td>
                  <td style={{ fontSize: 12 }}>{statusLabels[order.status] ?? order.status}</td>
                  <td>
                    {order.services && order.services.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                        {order.services.map((svc, i) => (
                          <span
                            key={i}
                            title={svc}
                            style={{
                              display: "inline-block",
                              fontSize: 10,
                              fontWeight: 600,
                              padding: "2px 7px",
                              borderRadius: 4,
                              background: "var(--accent-soft)",
                              color: "var(--accent)",
                              whiteSpace: "nowrap",
                              maxWidth: 90,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {svc}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="mute">—</span>
                    )}
                  </td>
                  <td><DocumentProgressTiles documents={order.documents} /></td>
                  <td style={{ verticalAlign: "middle", width: 110 }}>
                    <OrderRatingProgressBar profit={order.profit} workDays={order.workDays} />
                  </td>
                  <td className="mono tnum" style={{ textAlign: "right", fontSize: 11.5 }}>
                    {(() => {
                      if (!financialBalanceByOrder) return <span className="mute">—</span>
                      const fin = financialBalanceByOrder.get(order._id)
                      const balNet = fin?.balNet ?? 0
                      const isPositive = balNet >= 0
                      const color = isPositive ? "var(--ok, #16a34a)" : "var(--danger, #dc2626)"
                      const formatted = `${balNet.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLN`
                      return (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                          <span style={{ fontWeight: 600, color }}>{formatted}</span>
                          {fin && fin.marginPct !== null && fin.invNet > 0 && (
                            <span style={{ fontSize: 9.5, color: "var(--text-mute)" }}>
                              marża {fin.marginPct.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      )
                    })()}
                  </td>
                  <td className="mono tnum" style={{ textAlign: "right" }}>
                    {order.totalNet != null
                      ? `${order.totalNet.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
                      : <span className="mute">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
          {!isLoading && displayOrders && displayOrders.length > 0 && (
            <tfoot>
              <tr>
                <td
                  colSpan={5}
                  style={{
                    position: "sticky",
                    bottom: 0,
                    zIndex: 10,
                    background: "var(--panel-2)",
                    borderTop: "2px solid var(--line)",
                    borderBottomLeftRadius: 8,
                    boxShadow: "0 -3px 8px rgba(0, 0, 0, 0.05)",
                    padding: "10px 12px",
                    fontWeight: 600,
                    fontSize: 12,
                    color: "var(--text-strong)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>Suma dla widocznych zleceń:</span>
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "2px 7px",
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 700,
                      background: "var(--accent-soft)",
                      color: "var(--accent)",
                    }}>
                      {visibleSummary.count}
                      {counts.all > visibleSummary.count && (
                        <span style={{ fontWeight: 400, marginLeft: 3, opacity: 0.8 }}>
                          z {counts.all}
                        </span>
                      )}
                    </span>
                  </div>
                </td>
                <td
                  style={{
                    position: "sticky",
                    bottom: 0,
                    zIndex: 10,
                    background: "var(--panel-2)",
                    borderTop: "2px solid var(--line)",
                    boxShadow: "0 -3px 8px rgba(0, 0, 0, 0.05)",
                    padding: "10px 12px",
                  }}
                />
                <td
                  className="mono tnum"
                  style={{
                    position: "sticky",
                    bottom: 0,
                    zIndex: 10,
                    background: "var(--panel-2)",
                    borderTop: "2px solid var(--line)",
                    boxShadow: "0 -3px 8px rgba(0, 0, 0, 0.05)",
                    textAlign: "right",
                    padding: "10px 12px",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                    <span style={{
                      fontWeight: 700,
                      fontSize: 12.5,
                      color: visibleSummary.totalBalance >= 0 ? "var(--ok, #16a34a)" : "var(--danger, #dc2626)",
                    }}>
                      {visibleSummary.totalBalance.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLN
                    </span>
                    {visibleSummary.overallMargin !== null && (
                      <span style={{ fontSize: 9.5, color: "var(--text-mute)" }}>
                        marża ogólna {visibleSummary.overallMargin.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </td>
                <td
                  className="mono tnum"
                  style={{
                    position: "sticky",
                    bottom: 0,
                    zIndex: 10,
                    background: "var(--panel-2)",
                    borderTop: "2px solid var(--line)",
                    borderBottomRightRadius: 8,
                    boxShadow: "0 -3px 8px rgba(0, 0, 0, 0.05)",
                    textAlign: "right",
                    padding: "10px 12px",
                    fontWeight: 700,
                    fontSize: 12,
                    color: "var(--text-strong)",
                  }}
                >
                  {visibleSummary.totalNet.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
