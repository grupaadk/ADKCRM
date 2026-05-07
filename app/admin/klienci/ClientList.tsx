"use client"

import { useState, useMemo, useCallback } from "react"
import { useQuery, useMutation } from "convex/react"
import { useRouter } from "next/navigation"
import { api } from "@/convex/_generated/api"
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import { CrmSearch, CrmAvatar, CrmEmptyState, fmtDate } from "@/components/crm-ui"

type SortConfig = { field: string; direction: "asc" | "desc" }
type ViewConfig = {
  viewType: "table"
  columns: string[]
  sortBy: SortConfig
  filters?: { field: string; value: string }[]
  groupBy?: string
}

const DEFAULT_SORT: SortConfig = { field: "lastName", direction: "asc" }

type Client = {
  _id: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
  city?: string
  _creationTime: number
}

function SortIcon({ column, sortBy }: { column: string; sortBy: SortConfig }) {
  if (sortBy.field !== column)
    return <ChevronsUpDown className="ml-1 inline size-3" style={{ color: "var(--text-mute)", opacity: 0.5 }} />
  return sortBy.direction === "asc"
    ? <ChevronUp className="ml-1 inline size-3" style={{ color: "var(--text-strong)" }} />
    : <ChevronDown className="ml-1 inline size-3" style={{ color: "var(--text-strong)" }} />
}

export default function ClientList({ viewConfig }: { viewConfig?: ViewConfig }) {
  const router = useRouter()
  const updateSortMutation = useMutation(api.viewConfig.updateSort)

  const [query, setQuery] = useState("")

  const sortBy = viewConfig?.sortBy ?? DEFAULT_SORT
  const savedCityFilter = viewConfig?.filters?.find((f) => f.field === "city")?.value ?? ""

  const result = useQuery(api.clients.list, {})
  const clients = result?.page as Client[] | undefined
  const isLoading = result === undefined

  const displayClients = useMemo(() => {
    if (!clients) return undefined
    let filtered = clients

    if (query.trim()) {
      const lower = query.toLowerCase()
      filtered = filtered.filter((c) => {
        const name = `${c.firstName} ${c.lastName}`.toLowerCase()
        return (
          name.includes(lower) ||
          (c.city ?? "").toLowerCase().includes(lower) ||
          (c.phone ?? "").toLowerCase().includes(lower) ||
          (c.email ?? "").toLowerCase().includes(lower)
        )
      })
    }

    return [...filtered].sort((a, b) => {
      let aVal: string | number, bVal: string | number
      switch (sortBy.field) {
        case "lastName": aVal = a.lastName; bVal = b.lastName; break
        case "firstName": aVal = a.firstName; bVal = b.firstName; break
        case "city": aVal = a.city ?? ""; bVal = b.city ?? ""; break
        case "phone": aVal = a.phone ?? ""; bVal = b.phone ?? ""; break
        case "email": aVal = a.email ?? ""; bVal = b.email ?? ""; break
        case "createdAt": aVal = a._creationTime; bVal = b._creationTime; break
        default: aVal = a.lastName; bVal = b.lastName
      }
      const cmp = typeof aVal === "number"
        ? aVal - (bVal as number)
        : String(aVal).localeCompare(String(bVal), "pl")
      return sortBy.direction === "asc" ? cmp : -cmp
    })
  }, [clients, query, sortBy])

  const handleSort = useCallback((field: string) => {
    const direction: "asc" | "desc" =
      sortBy.field === field && sortBy.direction === "asc" ? "desc" : "asc"
    void updateSortMutation({ sortBy: { field, direction } })
  }, [sortBy, updateSortMutation])

  const thStyle = (field: string): React.CSSProperties => ({
    cursor: "pointer",
    userSelect: "none",
  })

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Toolbar */}
      <div className="panel" style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
        <CrmSearch
          value={query}
          onChange={setQuery}
          placeholder="Szukaj klienta, miasta, telefonu…"
          width={300}
        />
        <span className="mute" style={{ fontSize: 11, marginLeft: "auto" }}>
          {isLoading ? "Ładowanie…" : `${displayClients?.length ?? 0} klientów`}
        </span>
      </div>

      {/* Table */}
      <div className="panel" style={{ overflow: "hidden" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th style={thStyle("lastName")} onClick={() => handleSort("lastName")}>
                Klient <SortIcon column="lastName" sortBy={sortBy} />
              </th>
              <th style={{ ...thStyle("phone"), width: 140 }} onClick={() => handleSort("phone")}>
                Telefon <SortIcon column="phone" sortBy={sortBy} />
              </th>
              <th style={thStyle("email")} onClick={() => handleSort("email")}>
                Email <SortIcon column="email" sortBy={sortBy} />
              </th>
              <th style={{ ...thStyle("city"), width: 120 }} onClick={() => handleSort("city")}>
                Miasto <SortIcon column="city" sortBy={sortBy} />
              </th>
              <th style={{ ...thStyle("createdAt"), width: 120 }} onClick={() => handleSort("createdAt")}>
                Dodano <SortIcon column="createdAt" sortBy={sortBy} />
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 6 }).map((_, j) => (
                  <td key={j}><div style={{ height: 14, borderRadius: 4, background: "var(--panel-3)" }} /></td>
                ))}
              </tr>
            ))}

            {!isLoading && displayClients?.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <CrmEmptyState message={query ? "Brak klientów spełniających kryteria wyszukiwania." : "Brak klientów. Dodaj pierwszego klienta."} />
                </td>
              </tr>
            )}

            {displayClients?.map((client) => (
              <tr
                key={client._id}
                onClick={() => router.push(`/admin/klient/${client._id}`)}
                style={{ cursor: "pointer" }}
              >
                <td style={{ paddingRight: 0 }}>
                  <CrmAvatar name={`${client.firstName} ${client.lastName}`} size={26} />
                </td>
                <td>
                  <div className="strong" style={{ fontWeight: 500 }}>
                    {client.lastName} {client.firstName}
                  </div>
                </td>
                <td className="mono" style={{ fontSize: 12 }}>{client.phone ?? <span className="mute">—</span>}</td>
                <td className="dim" style={{ fontSize: 12 }}>{client.email ?? <span className="mute">—</span>}</td>
                <td style={{ fontSize: 12 }}>{client.city ?? <span className="mute">—</span>}</td>
                <td className="mono mute" style={{ fontSize: 11 }}>{fmtDate(client._creationTime)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
