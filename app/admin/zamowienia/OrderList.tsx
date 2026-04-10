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

type SortField = "client" | "status" | "services" | "createdAt"
type SortDirection = "asc" | "desc"

type Order = {
  _id: string
  _creationTime: number
  clientId: string
  status: string
  services?: string[]
  name?: string
  client: { firstName: string; lastName: string } | null
}

const STATUS_OPTIONS = [
  { value: "", label: "Wszystkie statusy" },
  { value: "lead", label: "Lead" },
  { value: "inquiry", label: "Oferta wysłana" },
  { value: "measurement", label: "Do pomiarów" },
  { value: "offer", label: "Oferta po pomiarze" },
  { value: "contract", label: "Umowa" },
  { value: "production", label: "Produkcja" },
  { value: "installation", label: "Montaż" },
  { value: "completed", label: "Zakończone" },
  { value: "warranty", label: "Gwarancja" },
]

function SkeletonRow() {
  return (
    <TableRow className="animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
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
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
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
                <TableHeaderCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

              {!isLoading && displayOrders && displayOrders.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-12 text-center text-gray-400"
                  >
                    Brak zamówień.
                  </TableCell>
                </TableRow>
              )}

              {displayOrders?.map((order) => (
                <TableRow key={order._id} className="transition-colors hover:bg-gray-50">
                  <TableCell className="font-medium text-gray-900">
                    {order.client
                      ? `${order.client.lastName} ${order.client.firstName}`
                      : <span className="text-gray-400">—</span>}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={order.status} />
                  </TableCell>
                  <TableCell>
                    {order.services && order.services.length > 0
                      ? order.services.join(", ")
                      : <span className="text-gray-400">—</span>}
                  </TableCell>
                  <TableCell>
                    {new Date(order._creationTime).toLocaleDateString("pl-PL")}
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
              ))}
            </TableBody>
          </Table>
        </TableRoot>
      </div>
    </div>
  )
}
