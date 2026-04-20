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
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import { useStatusLabels } from "@/components/StatusLabelsContext"

type SortField = "client" | "status" | "services" | "createdAt" | "totalGross"
type SortDirection = "asc" | "desc"

type Order = {
  _id: string
  _creationTime: number
  clientId: string
  status: string
  services?: string[]
  name?: string
  client: { firstName: string; lastName: string } | null
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
      {Array.from({ length: 6 }).map((_, i) => (
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
        case "totalGross":
          cmp = (a.totalGross ?? 0) - (b.totalGross ?? 0)
          break
      }
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [orders, statusFilter, sortField, sortDir])

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="">Wszystkie statusy</option>
          {STATUS_KEYS.map((key) => (
            <option key={key} value={key}>
              {statusLabels[key] ?? key}
            </option>
          ))}
        </select>
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
                    colSpan={6}
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
                        ? order.services.join(", ")
                        : <span className="text-gray-400">—</span>}
                    </TableCell>
                    <TableCell>
                      {new Date(order._creationTime).toLocaleDateString("pl-PL")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-gray-900">
                      {order.totalGross != null
                        ? `${order.totalGross.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
                        : <span className="text-gray-400">—</span>}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/klient/${order.clientId}/zlecenie/${order._id}`}
                        className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
                      >
                        Szczegóły →
                      </Link>
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
