"use client"

import { useState, useMemo } from "react"
import { useQuery } from "convex/react"
import { useRouter } from "next/navigation"
import { api } from "@/convex/_generated/api"
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import DocumentProgressTiles from "@/app/admin/klient/[id]/DocumentProgressTiles"
import { CrmEmptyState, fmtDate } from "@/components/crm-ui"

const STATUS_LABELS: Record<string, string> = {
  new: "Nowe",
  measurement: "Pomiar",
  offer: "Oferta",
  production: "Produkcja",
  installation: "Montaż",
  completed: "Zakończone",
  complaint: "Reklamacja",
}

const STATUS_ORDER = ["new", "measurement", "offer", "production", "installation", "complaint", "completed"]

type SortField = "client" | "city" | "status" | "services" | "createdAt" | "totalGross"
type SortDirection = "asc" | "desc"

type Order = {
  _id: string
  _creationTime: number
  clientId: string
  status: string
  services?: string[]
  name?: string
  client: { firstName: string; lastName: string; city?: string } | null
  fakturownia?: { invoices?: Array<{ kind: "advance" | "final" | "vat"; number?: string }> }
  documents?: Record<string, { url?: string; signatureStatus?: "signed" | "not_applicable" }>
  totalGross?: number | null
}

function InvoiceBadge({ invoices }: { invoices?: Array<{ kind: "advance" | "final" | "vat"; number?: string }> }) {
  const issued = (invoices ?? []).filter((i) => i.number)
  if (issued.length === 0) return <span className="mute">—</span>
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {issued.map((inv, i) => {
        const label = inv.kind === "advance" ? "Zaliczka" : inv.kind === "final" ? "Końcowa" : "VAT"
        const color = inv.kind === "final" ? "var(--ok)" : inv.kind === "advance" ? "var(--warn)" : "var(--info, #6366f1)"
        return (
          <span key={i} style={{ fontSize: 11, fontWeight: 500, color, whiteSpace: "nowrap" }}>
            {label}
          </span>
        )
      })}
    </div>
  )
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDirection }) {
  const cls = "ml-1 inline"
  if (sortField !== field) return <ChevronsUpDown className={`${cls} size-3`} style={{ color: "var(--text-mute)", opacity: 0.5 }} />
  return sortDir === "asc"
    ? <ChevronUp className={`${cls} size-3`} style={{ color: "var(--text-strong)" }} />
    : <ChevronDown className={`${cls} size-3`} style={{ color: "var(--text-strong)" }} />
}

function relativeTime(ms: number): string {
  const days = Math.floor((Date.now() - ms) / 86_400_000)
  if (days === 0) return "dziś"
  if (days === 1) return "wczoraj"
  if (days < 7) return `${days} dni temu`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks} tyg. temu`
  return `${Math.floor(days / 30)} mies. temu`
}

export default function OrderList() {
  const router = useRouter()
  const orders = useQuery(api.orders.list, {})
  const isLoading = orders === undefined

  const [sortField, setSortField] = useState<SortField>("createdAt")
  const [sortDir, setSortDir] = useState<SortDirection>("desc")
  const [viewFilter, setViewFilter] = useState<"all" | "active" | "complaint" | "completed">("active")
  const [statusFilter, setStatusFilter] = useState<string | null>(null)

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
    return [...filtered].sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case "client": {
          const aName = a.client ? `${a.client.lastName} ${a.client.firstName}` : ""
          const bName = b.client ? `${b.client.lastName} ${b.client.firstName}` : ""
          cmp = aName.localeCompare(bName, "pl"); break
        }
        case "status": cmp = a.status.localeCompare(b.status, "pl"); break
        case "services": cmp = (a.services ?? []).join().localeCompare((b.services ?? []).join(), "pl"); break
        case "createdAt": cmp = a._creationTime - b._creationTime; break
        case "city": cmp = (a.client?.city ?? "").localeCompare(b.client?.city ?? "", "pl"); break
        case "totalGross": cmp = (a.totalGross ?? 0) - (b.totalGross ?? 0); break
      }
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [orders, viewFilter, statusFilter, sortField, sortDir])

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
      {/* Toolbar */}
      <div className="panel" style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Row 1: view filter */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {viewTabs.map(({ key, label, count }) => (
            <FilterBtn key={key} isActive={viewFilter === key} onClick={() => setViewFilter(key)}>
              {label} <CountBadge count={count} active={viewFilter === key} />
            </FilterBtn>
          ))}
        </div>
        {/* Row 2: status filter */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4 }}>
          <span className="mute" style={{ fontSize: 11, marginRight: 2 }}>Status:</span>
          {STATUS_ORDER.filter((s) => (statusCounts[s] ?? 0) > 0).map((s) => (
            <FilterBtn key={s} isActive={statusFilter === s} onClick={() => setStatusFilter(statusFilter === s ? null : s)}>
              {STATUS_LABELS[s] ?? s} <CountBadge count={statusCounts[s] ?? 0} active={statusFilter === s} />
            </FilterBtn>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="panel" style={{ overflow: "hidden" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 130 }}>ID Zlecenia</th>
              <th style={{ cursor: "pointer" }} onClick={() => handleSort("client")}>
                Klient <SortIcon field="client" sortField={sortField} sortDir={sortDir} />
              </th>
              <th style={{ cursor: "pointer", width: 110 }} onClick={() => handleSort("city")}>
                Miasto <SortIcon field="city" sortField={sortField} sortDir={sortDir} />
              </th>
              <th style={{ cursor: "pointer", width: 150 }} onClick={() => handleSort("status")}>
                Status <SortIcon field="status" sortField={sortField} sortDir={sortDir} />
              </th>
              <th style={{ width: 130 }}>Dokumenty</th>
              <th style={{ width: 90 }}>Faktura</th>
              <th style={{ cursor: "pointer" }} onClick={() => handleSort("services")}>
                Usługi <SortIcon field="services" sortField={sortField} sortDir={sortDir} />
              </th>
              <th style={{ cursor: "pointer", width: 120 }} onClick={() => handleSort("createdAt")}>
                Data <SortIcon field="createdAt" sortField={sortField} sortDir={sortDir} />
              </th>
              <th style={{ cursor: "pointer", width: 120, textAlign: "right" }} onClick={() => handleSort("totalGross")}>
                Kwota brutto <SortIcon field="totalGross" sortField={sortField} sortDir={sortDir} />
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
                <td colSpan={9}><CrmEmptyState message="Brak zleceń spełniających kryteria." /></td>
              </tr>
            )}

            {displayOrders?.map((order) => {
              const isCompleted = order.status === "completed"
              return (
                <tr key={order._id} style={isCompleted ? { background: "var(--ok-soft)", cursor: "pointer" } : { cursor: "pointer" }} onClick={() => router.push(`/admin/klient/${order.clientId}/zlecenie/${order._id}`)}>
                  <td className="mono" style={{ fontSize: 11, color: "var(--text-mute)" }}>
                    {order.name ?? <span style={{ color: "var(--panel-3)" }}>—</span>}
                  </td>
                  <td>
                    <div className="strong" style={{ fontWeight: 500 }}>
                      {order.client ? `${order.client.lastName} ${order.client.firstName}` : <span className="mute">—</span>}
                    </div>
                  </td>
                  <td>
                    {order.client?.city ?? <span className="mute">—</span>}
                  </td>
                  <td style={{ fontSize: 12 }}>{STATUS_LABELS[order.status] ?? order.status}</td>
                  <td><DocumentProgressTiles documents={order.documents} /></td>
                  <td><InvoiceBadge invoices={order.fakturownia?.invoices} /></td>
                  <td style={{ fontSize: 12 }}>
                    {order.services && order.services.length > 0
                      ? order.services.join(", ")
                      : <span className="mute">—</span>}
                  </td>
                  <td>
                    <div className="mono" style={{ fontSize: 11 }}>
                      <div>{fmtDate(order._creationTime)}</div>
                      <div className="mute" style={{ fontSize: 10.5, marginTop: 1 }}>{relativeTime(order._creationTime)}</div>
                    </div>
                  </td>
                  <td className="mono tnum" style={{ textAlign: "right" }}>
                    {order.totalGross != null
                      ? `${order.totalGross.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
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
