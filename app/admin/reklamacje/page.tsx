"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import ComplaintDetailPanel from "@/components/complaints/ComplaintDetailPanel";
import NewComplaintModal from "@/components/complaints/NewComplaintModal";
import { createPortal } from "react-dom";

type Status = "nowa" | "w_toku" | "rozwiazana" | "zamknieta";

const STATUS_LABELS: Record<string, string> = {
  nowa: "Nowa",
  w_toku: "W toku",
  rozwiazana: "Rozwiązana",
  zamknieta: "Zamknięta",
};

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  nowa: { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  w_toku: { bg: "#fffbeb", color: "#b45309", border: "#fde68a" },
  rozwiazana: { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
  zamknieta: { bg: "#f8fafc", color: "#64748b", border: "#e2e8f0" },
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? { bg: "#f8fafc", color: "#64748b", border: "#e2e8f0" };
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 20,
        background: colors.bg,
        color: colors.color,
        border: `1px solid ${colors.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export default function ReklamacjePage() {
  const [statusFilter, setStatusFilter] = useState<string>("wszystkie");
  const [assignedFilter, setAssignedFilter] = useState<string>("");
  const [clientFilter, setClientFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const [selectedId, setSelectedId] = useState<Id<"complaints"> | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);

  const complaints = useQuery(api.complaints.getAll, {
    status: statusFilter !== "wszystkie" ? statusFilter : undefined,
    assignedTo: assignedFilter || undefined,
  });

  const users = useQuery(api.users.listAllActive);

  // Client-side filtering for client name and date
  const filtered = useMemo(() => {
    if (!complaints) return [];
    let result = complaints;
    if (clientFilter.trim()) {
      const term = clientFilter.toLowerCase();
      result = result.filter((c) => {
        const name = [c.client?.firstName, c.client?.lastName].filter(Boolean).join(" ").toLowerCase();
        const company = (c.client?.companyName ?? "").toLowerCase();
        return name.includes(term) || company.includes(term);
      });
    }
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      result = result.filter((c) => c.startDate >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86400000; // inclusive
      result = result.filter((c) => c.startDate <= to);
    }
    return result;
  }, [complaints, clientFilter, dateFrom, dateTo]);

  const statusCounts = useMemo(() => {
    if (!complaints) return {};
    const counts: Record<string, number> = { wszystkie: complaints.length };
    for (const c of complaints) {
      counts[c.status] = (counts[c.status] ?? 0) + 1;
    }
    return counts;
  }, [complaints]);

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Page Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--text-strong)" }}>
              Reklamacje
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--text-mute)" }}>
              {complaints ? `${complaints.length} reklamacji łącznie` : "Ładowanie…"}
            </p>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="btn"
            style={{ fontSize: 12.5, padding: "8px 16px", display: "flex", alignItems: "center", gap: 6 }}
          >
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nowa reklamacja
          </button>
        </div>

        {/* Status tabs */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {(["wszystkie", "nowa", "w_toku", "rozwiazana", "zamknieta"] as const).map((s) => {
            const active = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 20,
                  border: active ? "1px solid var(--accent)" : "1px solid var(--line)",
                  background: active ? "var(--accent-soft)" : "var(--panel-2)",
                  color: active ? "var(--accent)" : "var(--text-mute)",
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                {s === "wszystkie" ? "Wszystkie" : STATUS_LABELS[s]}
                {statusCounts[s] != null && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "1px 5px",
                      borderRadius: 10,
                      background: active ? "var(--accent)" : "var(--line)",
                      color: active ? "#fff" : "var(--text-mute)",
                    }}
                  >
                    {statusCounts[s]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Filters row */}
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
            padding: "10px 14px",
            background: "var(--panel-2)",
            border: "1px solid var(--line)",
            borderRadius: 8,
          }}
        >
          <input
            type="text"
            placeholder="Filtruj po kliencie…"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            style={{
              fontSize: 12.5,
              padding: "5px 10px",
              borderRadius: 6,
              border: "1px solid var(--line)",
              background: "var(--panel)",
              color: "var(--text)",
              fontFamily: "inherit",
              outline: "none",
              width: 180,
            }}
          />
          <select
            value={assignedFilter}
            onChange={(e) => setAssignedFilter(e.target.value)}
            style={{
              fontSize: 12.5,
              padding: "5px 10px",
              borderRadius: 6,
              border: "1px solid var(--line)",
              background: "var(--panel)",
              color: assignedFilter ? "var(--text)" : "var(--text-mute)",
              fontFamily: "inherit",
            }}
          >
            <option value="">Wszyscy pracownicy</option>
            {users?.map((u) => (
              <option key={u._id} value={u.displayName ?? u.login ?? ""}>
                {u.displayName ?? u.login}
              </option>
            ))}
          </select>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 11.5, color: "var(--text-mute)" }}>Od:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{
                fontSize: 12.5,
                padding: "5px 10px",
                borderRadius: 6,
                border: "1px solid var(--line)",
                background: "var(--panel)",
                color: "var(--text)",
                fontFamily: "inherit",
              }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 11.5, color: "var(--text-mute)" }}>Do:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{
                fontSize: 12.5,
                padding: "5px 10px",
                borderRadius: 6,
                border: "1px solid var(--line)",
                background: "var(--panel)",
                color: "var(--text)",
                fontFamily: "inherit",
              }}
            />
          </div>
          {(clientFilter || assignedFilter || dateFrom || dateTo) && (
            <button
              onClick={() => { setClientFilter(""); setAssignedFilter(""); setDateFrom(""); setDateTo(""); }}
              style={{
                fontSize: 11.5,
                padding: "5px 10px",
                borderRadius: 6,
                border: "1px solid var(--line)",
                background: "none",
                color: "var(--text-mute)",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Wyczyść filtry
            </button>
          )}
        </div>

        {/* Table */}
        <div
          className="panel"
          style={{ overflow: "hidden" }}
        >
          {complaints === undefined ? (
            <div style={{ padding: 40, textAlign: "center", fontSize: 13, color: "var(--text-mute)" }}>
              Ładowanie…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center" }}>
              <svg
                style={{ width: 40, height: 40, color: "var(--line)", margin: "0 auto 10px", display: "block" }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-mute)" }}>Brak reklamacji spełniających kryteria.</p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  {["Data", "Klient", "Zlecenie", "Status", "Opis", "Przypisany do", ""].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 14px",
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--text-mute)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        whiteSpace: "nowrap",
                        background: "var(--panel-2)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const clientName =
                    [c.client?.firstName, c.client?.lastName].filter(Boolean).join(" ") ||
                    c.client?.companyName ||
                    "—";
                  const isSelected = selectedId === c._id;
                  return (
                    <tr
                      key={c._id}
                      onClick={() => setSelectedId(c._id)}
                      style={{
                        borderBottom: "1px solid var(--line)",
                        cursor: "pointer",
                        background: isSelected ? "var(--accent-soft)" : "transparent",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = "var(--panel-2)";
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
                      }}
                    >
                      <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--text)", whiteSpace: "nowrap" }}>
                        {formatDate(c.startDate)}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text)" }}>
                          {clientName}
                        </span>
                        {c.client?.companyName && clientName !== c.client.companyName && (
                          <div style={{ fontSize: 11, color: "var(--text-mute)" }}>{c.client.companyName}</div>
                        )}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ fontSize: 12.5, color: "var(--text)" }}>
                          {c.order?.name ?? "—"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <StatusBadge status={c.status} />
                      </td>
                      <td
                        style={{
                          padding: "10px 14px",
                          fontSize: 12.5,
                          color: "var(--text-mute)",
                          maxWidth: 240,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {c.clientDescription || c.description || <em style={{ opacity: 0.5 }}>Brak opisu</em>}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--text-mute)" }}>
                        {c.assignedTo ?? "—"}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right" }}>
                        <svg
                          width="14"
                          height="14"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                          style={{ color: "var(--text-mute)" }}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Side panel */}
      {selectedId && (
        <ComplaintDetailPanel
          complaintId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}

      {/* New complaint modal */}
      {showNewModal &&
        typeof window !== "undefined" &&
        createPortal(
          <NewComplaintModal
            onClose={() => setShowNewModal(false)}
            onCreated={(id) => setSelectedId(id)}
          />,
          document.body,
        )}
    </>
  );
}
