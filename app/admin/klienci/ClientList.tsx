"use client"

import { useState, useMemo, useCallback } from "react"
import { useQuery, useMutation } from "convex/react"
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
import { cx } from "@/components/ui/utils"
import { ChevronUp, ChevronDown, ChevronsUpDown, Settings2 } from "lucide-react"

type SortConfig = {
  field: string
  direction: "asc" | "desc"
}

type ViewConfig = {
  viewType: "table"
  columns: string[]
  sortBy: SortConfig
  filters?: { field: string; value: string }[]
  groupBy?: string
}

const ALL_COLUMNS: { key: string; label: string }[] = [
  { key: "lastName", label: "Nazwisko" },
  { key: "firstName", label: "Imię" },
  { key: "city", label: "Miejscowość" },
  { key: "phone", label: "Telefon" },
  { key: "email", label: "Email" },
  { key: "createdAt", label: "Data utworzenia" },
]

const DEFAULT_COLUMNS = ["lastName", "firstName", "city", "phone", "email"]
const DEFAULT_SORT: SortConfig = { field: "lastName", direction: "asc" }

function countEnabledDocuments(
  documents: Record<string, { enabled: boolean; url?: string; generatedAt?: number }> | undefined,
): number {
  if (!documents) return 0
  return Object.values(documents).filter((doc) => doc.enabled).length
}

function countGeneratedDocuments(
  documents: Record<string, { enabled: boolean; url?: string; generatedAt?: number }> | undefined,
): number {
  if (!documents) return 0
  return Object.values(documents).filter(
    (doc) => doc.enabled && (doc.url != null || doc.generatedAt != null),
  ).length
}

function DocumentProgressBar({
  documents,
}: {
  documents: Record<string, { enabled: boolean; url?: string; generatedAt?: number }> | undefined
}) {
  const total = countEnabledDocuments(documents)
  const generated = countGeneratedDocuments(documents)

  if (total === 0) return <span className="text-xs text-gray-400">Brak</span>

  const percent = Math.round((generated / total) * 100)
  const isComplete = generated === total

  return (
    <div className="flex min-w-[100px] flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${isComplete ? "text-emerald-700" : "text-gray-600"}`}>
          {generated}/{total}
        </span>
        <span className="text-xs text-gray-400">{percent}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full transition-all ${isComplete ? "bg-emerald-500" : "bg-blue-500"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

function SkeletonRow({ colCount }: { colCount: number }) {
  return (
    <TableRow className="animate-pulse">
      {Array.from({ length: colCount }).map((_, i) => (
        <TableCell key={i}>
          <div className="h-4 rounded bg-gray-200" />
        </TableCell>
      ))}
    </TableRow>
  )
}

type Client = {
  _id: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
  city?: string
  _creationTime: number
}

function getCellValue(client: Client, columnKey: string): string | number {
  switch (columnKey) {
    case "lastName": return client.lastName
    case "firstName": return client.firstName
    case "city": return client.city ?? ""
    case "phone": return client.phone ?? ""
    case "email": return client.email ?? ""
    case "createdAt": return client._creationTime
    default: return ""
  }
}

function SortIcon({ column, sortBy }: { column: string; sortBy: SortConfig }) {
  if (sortBy.field !== column) {
    return <ChevronsUpDown className="ml-1 inline size-3.5 text-gray-300" />
  }
  return sortBy.direction === "asc"
    ? <ChevronUp className="ml-1 inline size-3.5 text-gray-700" />
    : <ChevronDown className="ml-1 inline size-3.5 text-gray-700" />
}

export default function ClientList({ viewConfig }: { viewConfig?: ViewConfig }) {
  const saveMutation = useMutation(api.viewConfig.save)
  const updateSortMutation = useMutation(api.viewConfig.updateSort)

  const [cityFilterOverride, setCityFilterOverride] = useState<string>()
  const [showColumnPanel, setShowColumnPanel] = useState(false)

  const activeColumns = viewConfig?.columns ?? DEFAULT_COLUMNS
  const sortBy = viewConfig?.sortBy ?? DEFAULT_SORT
  const savedCityFilter =
    viewConfig?.filters?.find((f) => f.field === "city")?.value ?? ""
  const cityFilter = cityFilterOverride ?? savedCityFilter

  const result = useQuery(api.clients.list, {})
  const clients = result?.page as Client[] | undefined
  const isLoading = result === undefined

  const displayClients = useMemo(() => {
    if (!clients) return undefined

    let filtered = clients
    if (cityFilter.trim()) {
      const lower = cityFilter.toLowerCase()
      filtered = filtered.filter((c) =>
        (c.city ?? "").toLowerCase().includes(lower),
      )
    }

    return [...filtered].sort((a, b) => {
      const aVal = getCellValue(a, sortBy.field)
      const bVal = getCellValue(b, sortBy.field)
      let cmp: number
      if (typeof aVal === "number" && typeof bVal === "number") {
        cmp = aVal - bVal
      } else {
        cmp = String(aVal).localeCompare(String(bVal), "pl")
      }
      return sortBy.direction === "asc" ? cmp : -cmp
    })
  }, [clients, cityFilter, sortBy])

  const handleSort = useCallback(
    (field: string) => {
      const newDirection: "asc" | "desc" =
        sortBy.field === field && sortBy.direction === "asc" ? "desc" : "asc"
      void updateSortMutation({ sortBy: { field, direction: newDirection } })
    },
    [sortBy, updateSortMutation],
  )

  const handleColumnToggle = useCallback(
    (columnKey: string) => {
      const newColumns = activeColumns.includes(columnKey)
        ? activeColumns.filter((c) => c !== columnKey)
        : [...activeColumns, columnKey]
      if (newColumns.length === 0) return
      void saveMutation({
        viewType: viewConfig?.viewType ?? "table",
        columns: newColumns,
        sortBy,
        filters: viewConfig?.filters,
        groupBy: viewConfig?.groupBy,
      })
    },
    [activeColumns, sortBy, viewConfig, saveMutation],
  )

  const visibleColumns = ALL_COLUMNS.filter((col) =>
    activeColumns.includes(col.key),
  )

  const renderCell = (client: Client, columnKey: string) => {
    switch (columnKey) {
      case "lastName":
        return (
          <TableCell key={columnKey} className="font-medium text-gray-900">
            {client.lastName}
          </TableCell>
        )
      case "firstName":
        return (
          <TableCell key={columnKey} className="text-gray-700">
            {client.firstName}
          </TableCell>
        )
      case "city":
        return (
          <TableCell key={columnKey}>{client.city ?? "—"}</TableCell>
        )
      case "phone":
        return (
          <TableCell key={columnKey}>{client.phone ?? "—"}</TableCell>
        )
      case "email":
        return (
          <TableCell key={columnKey}>{client.email ?? "—"}</TableCell>
        )
      case "createdAt":
        return (
          <TableCell key={columnKey}>
            {new Date(client._creationTime).toLocaleDateString("pl-PL")}
          </TableCell>
        )
      default:
        return <TableCell key={columnKey}>—</TableCell>
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Filtruj wg miejscowości..."
          value={cityFilter}
          onChange={(e) => setCityFilterOverride(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 sm:w-56"
        />

        <div className="relative">
          <button
            onClick={() => setShowColumnPanel(!showColumnPanel)}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium shadow-sm transition-colors",
              showColumnPanel
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
            )}
          >
            <Settings2 className="size-3.5 shrink-0" aria-hidden="true" />
            Kolumny
          </button>

          {showColumnPanel && (
            <div className="absolute top-full left-0 z-20 mt-1 w-56 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Widoczne kolumny
              </p>
              {ALL_COLUMNS.map((col) => (
                <label
                  key={col.key}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={activeColumns.includes(col.key)}
                    onChange={() => handleColumnToggle(col.key)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <TableRoot>
          <Table>
            <TableHead>
              <TableRow>
                {visibleColumns.map((col) => (
                  <TableHeaderCell
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="group cursor-pointer select-none hover:bg-gray-50"
                  >
                    {col.label}
                    <SortIcon column={col.key} sortBy={sortBy} />
                  </TableHeaderCell>
                ))}
                <TableHeaderCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonRow key={i} colCount={visibleColumns.length + 1} />
                ))}

              {!isLoading && displayClients && displayClients.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={visibleColumns.length + 1}
                    className="py-12 text-center text-gray-400"
                  >
                    Brak klientów. Dodaj pierwszego klienta, aby rozpocząć.
                  </TableCell>
                </TableRow>
              )}

              {displayClients?.map((client) => (
                <TableRow
                  key={client._id}
                  className="transition-colors hover:bg-gray-50"
                >
                  {visibleColumns.map((col) => renderCell(client, col.key))}
                  <TableCell>
                    <Link
                      href={`/admin/klient/${client._id}`}
                      className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 transition-colors"
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
