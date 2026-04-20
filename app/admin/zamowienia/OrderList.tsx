"use client"

import { useState, useMemo } from "react"
import { useQuery } from "convex/react"
import Link from "next/link"
import { api } from "@/convex/_generated/api"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@/components/ui/Table"
import { StatusBadge } from "@/components/ui/Badge"
import { ChevronUp, ChevronDown, ChevronsUpDown, CalendarDays, Clock } from "lucide-react"
import { useStatusLabels } from "@/components/StatusLabelsContext"

function relativeTime(ms: number): string {
  const days = Math.floor((Date.now() - ms) / 86_400_000)
  if (days === 0) return "dziś"
  if (days === 1) return "wczoraj"
  if (days < 7) return `${days} dni temu`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks} tyg. temu`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} mies. temu`
  return `${Math.floor(days / 365)} lat temu`
}

type SortField = "client" | "city" | "status" | "services" | "createdAt" | "totalGross"
type SortDirection = "asc" | "desc"

const STATUS_BUTTON_STYLES: Record<string, { dot: string; active: string; inactive: string }> = {
  lead:         { dot: "bg-blue-500",    active: "bg-blue-100 text-blue-800 border-blue-300",    inactive: "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-700" },
  inquiry:      { dot: "bg-purple-500",  active: "bg-purple-100 text-purple-800 border-purple-300",  inactive: "bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:text-purple-700" },
  measurement:  { dot: "bg-amber-500",   active: "bg-amber-100 text-amber-800 border-amber-300",   inactive: "bg-white text-gray-600 border-gray-200 hover:border-amber-300 hover:text-amber-700" },
  offer:        { dot: "bg-orange-500",  active: "bg-orange-100 text-orange-800 border-orange-300",  inactive: "bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-700" },
  contract:     { dot: "bg-emerald-600", active: "bg-emerald-100 text-emerald-800 border-emerald-300", inactive: "bg-white text-gray-600 border-gray-200 hover:border-emerald-300 hover:text-emerald-700" },
  production:   { dot: "bg-violet-500",  active: "bg-violet-100 text-violet-800 border-violet-300",  inactive: "bg-white text-gray-600 border-gray-200 hover:border-violet-300 hover:text-violet-700" },
  installation: { dot: "bg-teal-500",    active: "bg-teal-100 text-teal-800 border-teal-300",    inactive: "bg-white text-gray-600 border-gray-200 hover:border-teal-300 hover:text-teal-700" },
  completed:    { dot: "bg-emerald-600", active: "bg-emerald-100 text-emerald-800 border-emerald-300", inactive: "bg-white text-gray-600 border-gray-200 hover:border-emerald-300 hover:text-emerald-700" },
  warranty:     { dot: "bg-cyan-500",    active: "bg-cyan-100 text-cyan-800 border-cyan-300",    inactive: "bg-white text-gray-600 border-gray-200 hover:border-cyan-300 hover:text-cyan-700" },
}

type Order = {
  _id: string
  _creationTime: number
  clientId: string
  status: string
  services?: string[]
  name?: string
  client: { firstName: string; lastName: string; city?: string } | null
  fakturownia?: {
    invoices?: Array<{ kind: "advance" | "final" }>
  }
  totalGross?: number | null
}

const STATUS_KEYS = [
  "lead", "inquiry", "measurement", "offer", "contract",
  "production", "installation", "completed", "warranty",
]

function SkeletonRow() {
  return (
    <TableRow className="animate-pulse">
      {Array.from({ length: 7 }).map((_, i) => (
        <TableCell key={i}>
          <div className="h-4 rounded bg-gray-200" />
        </TableCell>
      ))}
    </TableRow>
  )
}

function SortIcon({
  field,
  sortField,
  sortDir,
}: {
  field: SortField
  sortField: SortField
  sortDir: SortDirection
}) {
  if (sortField !== field) {
    return <ChevronsUpDown className="ml-1 inline size-3.5 text-gray-300" />
  }
  return sortDir === "asc"
    ? <ChevronUp className="ml-1 inline size-3.5 text-gray-700" />
    : <ChevronDown className="ml-1 inline size-3.5 text-gray-700" />
}

export default function OrderList() {
  const orders = useQuery(api.orders.list, {})
  const isLoading = orders === undefined
  const statusLabels = useStatusLabels()

  const [sortField, setSortField] = useState<SortField>("createdAt")
  const [sortDir, setSortDir] = useState<SortDirection>("desc")
  const [statusFilter, setStatusFilter] = useState("")

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  const statusCounts = useMemo(() => {
    if (!orders) return {}
    const counts: Record<string, number> = {}
    for (const o of orders as Order[]) {
      counts[o.status] = (counts[o.status] ?? 0) + 1
    }
    return counts
  }, [orders])

  const displayOrders = useMemo(() => {
    if (!orders) return undefined

    let filtered = orders as Order[]
    if (statusFilter) {
      filtered = filtered.filter((o) => o.status === statusFilter)
    }

    return [...filtered].sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case "client": {
          const aName = a.client ? `${a.client.lastName} ${a.client.firstName}` : ""
          const bName = b.client ? `${b.client.lastName} ${b.client.firstName}` : ""
          cmp = aName.localeCompare(bName, "pl")
          break
        }
        case "status":
          cmp = a.status.localeCompare(b.status, "pl")
          break
        case "services": {
          const aS = (a.services ?? []).join(", ")
          const bS = (b.services ?? []).join(", ")
          cmp = aS.localeCompare(bS, "pl")
          break
        }
        case "createdAt":
          cmp = a._creationTime - b._creationTime
          break
        case "city":
          cmp = (a.client?.city ?? "").localeCompare(b.client?.city ?? "", "pl")
          break
        case "totalGross":
          cmp = (a.totalGross ?? 0) - (b.totalGross ?? 0)
          break
      }
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [orders, statusFilter, sortField, sortDir])

  return (
    <div className="space-y-4">
      {/* Status filter buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setStatusFilter("")}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            statusFilter === ""
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900"
          }`}
        >
          Wszystkie
          {orders && (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${statusFilter === "" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
              {(orders as Order[]).length}
            </span>
          )}
        </button>

        {STATUS_KEYS.map((key) => {
          const styles = STATUS_BUTTON_STYLES[key]
          const count = statusCounts[key] ?? 0
          const isActive = statusFilter === key
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(isActive ? "" : key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${isActive ? styles.active : styles.inactive}`}
            >
              <span className={`size-1.5 shrink-0 rounded-full ${styles.dot}`} />
              {statusLabels[key] ?? key}
              {orders && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${isActive ? "bg-black/10" : "bg-gray-100 text-gray-500"}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <TableRoot>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell
                  onClick={() => handleSort("client")}
                  className="cursor-pointer select-none hover:bg-gray-50"
                >
                  Klient
                  <SortIcon field="client" sortField={sortField} sortDir={sortDir} />
                </TableHeaderCell>
                <TableHeaderCell
                  onClick={() => handleSort("city")}
                  className="cursor-pointer select-none hover:bg-gray-50"
                >
                  Miasto
                  <SortIcon field="city" sortField={sortField} sortDir={sortDir} />
                </TableHeaderCell>
                <TableHeaderCell
                  onClick={() => handleSort("status")}
                  className="cursor-pointer select-none hover:bg-gray-50"
                >
                  Status
                  <SortIcon field="status" sortField={sortField} sortDir={sortDir} />
                </TableHeaderCell>
                <TableHeaderCell
                  onClick={() => handleSort("services")}
                  className="cursor-pointer select-none hover:bg-gray-50"
                >
                  Usługi
                  <SortIcon field="services" sortField={sortField} sortDir={sortDir} />
                </TableHeaderCell>
                <TableHeaderCell
                  onClick={() => handleSort("createdAt")}
                  className="cursor-pointer select-none hover:bg-gray-50"
                >
                  Data utworzenia
                  <SortIcon field="createdAt" sortField={sortField} sortDir={sortDir} />
                </TableHeaderCell>
                <TableHeaderCell
                  onClick={() => handleSort("totalGross")}
                  className="cursor-pointer select-none hover:bg-gray-50 text-right"
                >
                  Kwota brutto
                  <SortIcon field="totalGross" sortField={sortField} sortDir={sortDir} />
                </TableHeaderCell>
                <TableHeaderCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

              {!isLoading && displayOrders && displayOrders.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-12 text-center text-gray-400"
                  >
                    Brak zamówień.
                  </TableCell>
                </TableRow>
              )}

              {displayOrders?.map((order) => {
                const isCompleted = order.status === "completed"
                const hasFinalInvoice = (order.fakturownia?.invoices ?? []).some((inv) => inv.kind === "final")
                return (
                  <TableRow key={order._id} className={`transition-colors ${isCompleted ? "border-l-4 border-l-green-400 bg-green-50/40 hover:bg-green-50/70" : "hover:bg-gray-50"}`}>
                    <TableCell className="font-medium text-gray-900">
                      {order.client
                        ? `${order.client.lastName} ${order.client.firstName}`
                        : <span className="text-gray-400">—</span>}
                    </TableCell>
                    <TableCell>
                      {order.client?.city
                        ? <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{order.client.city}</span>
                        : <span className="text-gray-400">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={order.status} />
                        {isCompleted && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-700">
                            <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            Zakończone
                          </span>
                        )}
                        {hasFinalInvoice && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                            <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                            Faktura wystawiona
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {order.services && order.services.length > 0
                        ? <div className="flex flex-wrap gap-1">{order.services.map((s) => <span key={s} className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{s}</span>)}</div>
                        : <span className="text-gray-400">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="inline-flex items-center gap-1 text-sm text-gray-900">
                          <CalendarDays className="size-3.5 text-gray-400 shrink-0" />
                          {new Date(order._creationTime).toLocaleDateString("pl-PL")}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="size-3 shrink-0" />
                          {relativeTime(order._creationTime)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-gray-900">
                      {order.totalGross != null
                        ? `${order.totalGross.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
                        : <span className="text-gray-400">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/klient/${order.clientId}/zlecenie/${order._id}?tab=wycena`}
                          className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-white transition-colors"
                          style={{ backgroundColor: "#2B2A2A" }}
                        >
                          Wycena
                        </Link>
                        <Link
                          href={`/admin/klient/${order.clientId}/zlecenie/${order._id}`}
                          className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          Szczegóły
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableRoot>
      </div>
    </div>
  )
}
