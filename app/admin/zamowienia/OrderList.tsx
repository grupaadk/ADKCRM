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
import DocumentProgressTiles from "@/app/admin/klient/[id]/DocumentProgressTiles"

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
  documents?: Record<string, { url?: string; signatureStatus?: "signed" | "not_applicable" }>
  totalGross?: number | null
}

function SkeletonRow() {
  return (
    <TableRow className="animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
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

  const [sortField, setSortField] = useState<SortField>("createdAt")
  const [sortDir, setSortDir] = useState<SortDirection>("desc")
  const [viewFilter, setViewFilter] = useState<"all" | "active" | "complaint" | "completed">("active")

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  const counts = useMemo(() => {
    if (!orders) return { all: 0, active: 0, complaint: 0, completed: 0 }
    const all = (orders as Order[]).length
    const completed = (orders as Order[]).filter((o) => o.status === "completed").length
    const complaint = (orders as Order[]).filter((o) => o.status === "complaint").length
    return { all, active: all - completed, complaint, completed }
  }, [orders])

  const displayOrders = useMemo(() => {
    if (!orders) return undefined

    let filtered = orders as Order[]
    if (viewFilter === "active") {
      filtered = filtered.filter((o) => o.status !== "completed")
    } else if (viewFilter === "complaint") {
      filtered = filtered.filter((o) => o.status === "complaint")
    } else if (viewFilter === "completed") {
      filtered = filtered.filter((o) => o.status === "completed")
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
  }, [orders, viewFilter, sortField, sortDir])

  return (
    <div className="space-y-4">
      {/* View filter tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1 w-fit">
        {(["all", "active", "complaint", "completed"] as const).map((tab) => {
          const labels = { all: "Wszystkie", active: "Aktywne", complaint: "Reklamacje", completed: "Zakończone" }
          const isActive = viewFilter === tab
          return (
            <button
              key={tab}
              onClick={() => setViewFilter(tab)}
              className={`inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
                isActive
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {labels[tab]}
              {orders && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${isActive ? "bg-gray-100 text-gray-600" : "bg-gray-200 text-gray-400"}`}>
                  {counts[tab]}
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
                <TableHeaderCell className="text-gray-500 font-medium">
                  ID Zlecenia
                </TableHeaderCell>
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
                <TableHeaderCell>Dokumenty</TableHeaderCell>
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
                    colSpan={8}
                    className="py-12 text-center text-gray-400"
                  >
                    Brak zamówień.
                  </TableCell>
                </TableRow>
              )}

              {displayOrders?.map((order) => {
                const isCompleted = order.status === "completed"
                return (
                  <TableRow key={order._id} className={`transition-colors ${isCompleted ? "border-l-4 border-l-green-400 bg-green-50/40 hover:bg-green-50/70" : "hover:bg-gray-50"}`}>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-gray-500">
                      {order.name ?? <span className="text-gray-300">—</span>}
                    </TableCell>
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
                      <StatusBadge status={order.status} />
                    </TableCell>
                    <TableCell>
                      <DocumentProgressTiles documents={order.documents} />
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
                        {order.status === "completed" ? (
                          <Link
                            href={`/admin/klient/${order.clientId}/zlecenie/${order._id}?tab=dokumenty`}
                            className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-white transition-colors"
                            style={{ backgroundColor: "#2B2A2A" }}
                          >
                            Dokumenty
                          </Link>
                        ) : order.status === "complaint" ? (
                          <>
                            <Link
                              href={`/admin/klient/${order.clientId}/zlecenie/${order._id}?tab=reklamacja`}
                              className="inline-flex items-center gap-1 rounded-md bg-orange-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-orange-700"
                            >
                              Reklamacja
                            </Link>
                            <Link
                              href={`/admin/klient/${order.clientId}/zlecenie/${order._id}?tab=wycena`}
                              className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              Wycena
                            </Link>
                          </>
                        ) : (
                          <Link
                            href={`/admin/klient/${order.clientId}/zlecenie/${order._id}?tab=wycena`}
                            className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-white transition-colors"
                            style={{ backgroundColor: "#2B2A2A" }}
                          >
                            Wycena
                          </Link>
                        )}
                        <Link
                          href={`/admin/klient/${order.clientId}/zlecenie/${order._id}`}
                          className="inline-flex items-center gap-1 rounded-md bg-orange-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-orange-600"
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
