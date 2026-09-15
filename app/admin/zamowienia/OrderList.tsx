"use client"

import { useState, useMemo, useEffect } from "react"
import { useQuery } from "convex/react"
import { useRouter } from "next/navigation"
import { api } from "@/convex/_generated/api"
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import DocumentProgressTiles from "@/app/admin/klient/[id]/DocumentProgressTiles"
import { CrmEmptyState, fmtDate } from "@/components/crm-ui"
import { useStatusLabels, useStatuses } from "@/components/StatusLabelsContext"
import OrdersReportDashboard from "./OrdersReportDashboard"

type SortField = "client" | "city" | "status" | "services" | "createdAt" | "totalGross"
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



export default function OrderList({ searchTerm = "", showFilters = false, showReports = false }: { searchTerm?: string, showFilters?: boolean, showReports?: boolean }) {
  const router = useRouter()
  const statusLabels = useStatusLabels()
  const statuses = useStatuses()
  const orders = useQuery(api.orders.list, {})
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
        case "city": cmp = (a.investmentCity ?? a.client?.city ?? "").localeCompare(b.investmentCity ?? b.client?.city ?? "", "pl"); break
        case "totalGross": cmp = (a.totalGross ?? 0) - (b.totalGross ?? 0); break
      }
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [orders, viewFilter, statusFilter, clientFilter, activeUserFilters, sortField, sortDir, debouncedSearch])

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Reports Dashboard */}
      {showReports && (
        <div className="panel" style={{ padding: "20px 24px" }}>
          <OrdersReportDashboard />
        </div>
      )}

      {/* Filters Area */}
      {showFilters && (
        <div className="panel" style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Top row: Widok + Status */}
          <div style={{ display: "flex", gap: 16 }}>
            {/* Widok */}
            <div style={{
              flex: "0 0 auto",
              background: "var(--panel-2)",
              borderRadius: 10,
              padding: "12px 16px",
              border: "1px solid var(--line)",
            }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-mute)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6 }}>Widok</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {viewTabs.map(({ key, label, count }) => (
                  <FilterBtn key={key} isActive={viewFilter === key} onClick={() => setViewFilter(key)}>
                    {label} <CountBadge count={count} active={viewFilter === key} />
                  </FilterBtn>
                ))}
              </div>
            </div>

            {/* Status */}
            <div style={{
              flex: 1,
              background: "var(--panel-2)",
              borderRadius: 10,
              padding: "12px 16px",
              border: "1px solid var(--line)",
            }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-mute)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6 }}>Status zlecenia</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {statuses.map((st) => st.key).filter((s) => (statusCounts[s] ?? 0) > 0).map((s) => (
                  <FilterBtn key={s} isActive={statusFilter === s} onClick={() => setStatusFilter(statusFilter === s ? null : s)}>
                    {statusLabels[s] ?? s} <CountBadge count={statusCounts[s] ?? 0} active={statusFilter === s} />
                  </FilterBtn>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom row: Typ klienta + Przypisany */}
          <div style={{ display: "flex", gap: 16 }}>
            {/* Typ klienta */}
            <div style={{
              flex: "0 0 auto",
              background: "var(--panel-2)",
              borderRadius: 10,
              padding: "12px 16px",
              border: "1px solid var(--line)",
            }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-mute)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6 }}>Typ klienta</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {clientFilterLabels.map(({ key, label }) => (
                  <FilterBtn key={key} isActive={clientFilter === key} onClick={() => setClientFilter(key)}>
                    {label}
                  </FilterBtn>
                ))}
              </div>
            </div>

            {/* Przypisany */}
            {allUsers && (
              <div style={{
                flex: 1,
                background: "var(--panel-2)",
                borderRadius: 10,
                padding: "12px 16px",
                border: "1px solid var(--line)",
              }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-mute)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6 }}>Przypisany</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
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
                            background: active ? "var(--panel-3)" : "transparent",
                            color: active ? "var(--text-strong)" : "var(--text-mute)",
                            border: `1.5px solid ${active ? "var(--text-mute)" : "transparent"}`,
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
                      background: activeUserFilters.has("__none__") ? "var(--panel-3)" : "transparent",
                      color: activeUserFilters.has("__none__") ? "var(--text-strong)" : "var(--text-mute)",
                      border: `1.5px solid ${activeUserFilters.has("__none__") ? "var(--text-mute)" : "transparent"}`,
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
              </div>
            )}
          </div>
        </div>
      )}

      {/* Results Count Summary (if searching) */}
      {!showFilters && debouncedSearch && displayOrders && (
        <div style={{ display: "flex", alignItems: "center", padding: "0 4px", marginBottom: -4 }}>
          <span style={{
            fontSize: 12, fontWeight: 600, color: "var(--accent)", whiteSpace: "nowrap",
          }}>
            Znaleziono {displayOrders.length} wyników
          </span>
        </div>
      )}

      {/* Table */}
      <div className="panel" style={{ overflow: "hidden" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 110 }}>Zlecenie</th>
              <th style={{ cursor: "pointer", width: 140 }} onClick={() => handleSort("client")}>
                Klient <SortIcon field="client" sortField={sortField} sortDir={sortDir} />
              </th>
              <th style={{ cursor: "pointer", width: 100 }} onClick={() => handleSort("city")}>
                Miasto <SortIcon field="city" sortField={sortField} sortDir={sortDir} />
              </th>
              <th style={{ cursor: "pointer", width: 120 }} onClick={() => handleSort("status")}>
                Status <SortIcon field="status" sortField={sortField} sortDir={sortDir} />
              </th>
              <th style={{ cursor: "pointer", width: 150 }} onClick={() => handleSort("services")}>
                Usługi <SortIcon field="services" sortField={sortField} sortDir={sortDir} />
              </th>
              <th style={{ width: 100 }}>Dokumenty</th>
              <th style={{ cursor: "pointer", width: 95 }} onClick={() => handleSort("createdAt")}>
                Start <SortIcon field="createdAt" sortField={sortField} sortDir={sortDir} />
              </th>
              <th style={{ width: 95 }}>Koniec</th>
              <th style={{ cursor: "pointer", width: 110, textAlign: "right" }} onClick={() => handleSort("totalGross")}>
                Netto <SortIcon field="totalGross" sortField={sortField} sortDir={sortDir} />
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 9 }).map((_, j) => (
                  <td key={j}><div style={{ height: 14, borderRadius: 4, background: "var(--panel-3)", animation: "pulse 1.5s ease-in-out infinite" }} /></td>
                ))}
              </tr>
            ))}

            {!isLoading && displayOrders?.length === 0 && (
              <tr>
                <td colSpan={10}><CrmEmptyState message="Brak zleceń spełniających kryteria." /></td>
              </tr>
            )}

            {displayOrders?.map((order) => {
              const isCompleted = order.status === "completed"
              const clientName = order.client
                ? order.client.clientType === "business" && order.client.companyName
                  ? order.client.companyName
                  : `${order.client.lastName} ${order.client.firstName}`
                : null
              return (
                <tr key={order._id} style={isCompleted ? { background: "var(--ok-soft)", cursor: "pointer" } : { cursor: "pointer" }} onClick={() => router.push(`/admin/klient/${order.clientId}/zlecenie/${order._id}`)}>
                  <td className="mono" style={{
                    fontSize: 11,
                    color: "var(--text-mute)",
                    borderLeft: order.assignedUserColor ? `4px solid ${order.assignedUserColor}` : undefined,
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
                  <td style={{ fontSize: 12 }}>
                    {order.investmentCity ?? order.client?.city ?? <span className="mute">—</span>}
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
                  <td className="mono" style={{ fontSize: 11 }}>
                    {order.projectStartDate ? fmtDate(order.projectStartDate) : <span className="mute">—</span>}
                  </td>
                  <td className="mono" style={{ fontSize: 11 }}>
                    {order.projectEndDate ? fmtDate(order.projectEndDate) : <span className="mute">—</span>}
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
        </table>
      </div>
    </div>
  )
}
