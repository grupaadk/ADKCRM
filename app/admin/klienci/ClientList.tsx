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
  clientType?: "individual" | "business"
  firstName: string
  lastName: string
  companyName?: string
  email?: string
  phone?: string
  city?: string
  _creationTime: number
}

type ClientFilter = "all" | "individual" | "business"

function SortIcon({ column, sortBy }: { column: string; sortBy: SortConfig }) {
  if (sortBy.field !== column)
    return <ChevronsUpDown className="ml-1 inline size-3" style={{ color: "var(--text-mute)", opacity: 0.5 }} />
  return sortBy.direction === "asc"
    ? <ChevronUp className="ml-1 inline size-3" style={{ color: "var(--text-strong)" }} />
    : <ChevronDown className="ml-1 inline size-3" style={{ color: "var(--text-strong)" }} />
}

function primaryName(c: Client): string {
  if (c.clientType === "business" && c.companyName) return c.companyName
  return `${c.lastName} ${c.firstName}`
}

export default function ClientList({ viewConfig, searchQuery }: { viewConfig?: ViewConfig, searchQuery: string }) {
  const router = useRouter()
  const updateSortMutation = useMutation(api.viewConfig.updateSort)


  const [clientFilter, setClientFilter] = useState<ClientFilter>("all")

  const sortBy = viewConfig?.sortBy ?? DEFAULT_SORT

  const result = useQuery(api.clients.list, {})
  const clients = result?.page as Client[] | undefined
  const isLoading = result === undefined

  const displayClients = useMemo(() => {
    if (!clients) return undefined
    let filtered = clients

    if (clientFilter !== "all") {
      filtered = filtered.filter((c) =>
        clientFilter === "business"
          ? c.clientType === "business"
          : c.clientType !== "business"
      )
    }

    if (searchQuery.trim()) {
      const lower = searchQuery.toLowerCase()
      filtered = filtered.filter((c) => {
        const name = `${c.firstName} ${c.lastName}`.toLowerCase()
        const company = (c.companyName ?? "").toLowerCase()
        return (
          name.includes(lower) ||
          company.includes(lower) ||
          (c.city ?? "").toLowerCase().includes(lower) ||
          (c.phone ?? "").toLowerCase().includes(lower) ||
          (c.email ?? "").toLowerCase().includes(lower)
        )
      })
    }

    return [...filtered].sort((a, b) => {
      let aVal: string | number, bVal: string | number
      switch (sortBy.field) {
        case "lastName":
          aVal = primaryName(a)
          bVal = primaryName(b)
          break
        case "firstName": aVal = a.firstName; bVal = b.firstName; break
        case "city": aVal = a.city ?? ""; bVal = b.city ?? ""; break
        case "phone": aVal = a.phone ?? ""; bVal = b.phone ?? ""; break
        case "email": aVal = a.email ?? ""; bVal = b.email ?? ""; break
        case "createdAt": aVal = a._creationTime; bVal = b._creationTime; break
        default: aVal = primaryName(a); bVal = primaryName(b)
      }
      const cmp = typeof aVal === "number"
        ? aVal - (bVal as number)
        : String(aVal).localeCompare(String(bVal), "pl")
      return sortBy.direction === "asc" ? cmp : -cmp
    })
  }, [clients, searchQuery, sortBy, clientFilter])

  const handleSort = useCallback((field: string) => {
    const direction: "asc" | "desc" =
      sortBy.field === field && sortBy.direction === "asc" ? "desc" : "asc"
    void updateSortMutation({ sortBy: { field, direction } })
  }, [sortBy, updateSortMutation])

  const thStyle = (field: string): React.CSSProperties => ({
    cursor: "pointer",
    userSelect: "none",
  })

  const filterLabels: { key: ClientFilter; label: string }[] = [
    { key: "all", label: "Wszyscy" },
    { key: "individual", label: "Indywidualni" },
    { key: "business", label: "Biznesowi" },
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Toolbar */}
      <div className="panel" style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 4, background: "var(--panel-2)", borderRadius: 8, padding: 3 }}>
          {filterLabels.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setClientFilter(key)}
              style={{
                padding: "4px 12px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: clientFilter === key ? 600 : 400,
                background: clientFilter === key ? "var(--panel-bg)" : "transparent",
                color: clientFilter === key ? "var(--text-strong)" : "var(--text-mute)",
                border: clientFilter === key ? "1px solid var(--border)" : "1px solid transparent",
                cursor: "pointer",
                transition: "all 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </button>
          ))}
        </div>


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
                  <CrmEmptyState message={searchQuery ? "Brak klientów spełniających kryteria wyszukiwania." : "Brak klientów. Dodaj pierwszego klienta."} />
                </td>
              </tr>
            )}

            {displayClients?.map((client) => {
              const isBusiness = client.clientType === "business"
              const avatarName = isBusiness && client.companyName ? client.companyName : `${client.firstName} ${client.lastName}`
              return (
                <tr
                  key={client._id}
                  onClick={() => router.push(`/admin/klient/${client._id}`)}
                  style={{ cursor: "pointer" }}
                >
                  <td style={{ paddingRight: 0 }}>
                    <CrmAvatar name={avatarName} size={26} />
                  </td>
                  <td>
                    {isBusiness && client.companyName ? (
                      <div>
                        <div className="strong" style={{ fontWeight: 500 }}>
                          {client.companyName}
                        </div>
                        <div className="mute" style={{ fontSize: 11 }}>
                          {client.firstName} {client.lastName}
                        </div>
                      </div>
                    ) : (
                      <div className="strong" style={{ fontWeight: 500 }}>
                        {client.lastName} {client.firstName}
                      </div>
                    )}
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>{client.phone ?? <span className="mute">—</span>}</td>
                  <td className="dim" style={{ fontSize: 12 }}>{client.email ?? <span className="mute">—</span>}</td>
                  <td style={{ fontSize: 12 }}>{client.city ?? <span className="mute">—</span>}</td>
                  <td className="mono mute" style={{ fontSize: 11 }}>{fmtDate(client._creationTime)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
