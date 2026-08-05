"use client";

import { useState, useMemo } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import ComplaintDetailPanel from "./ComplaintDetailPanel";
import NewComplaintModal from "./NewComplaintModal";
import { Search, X, Plus, CheckCircle2 } from "lucide-react";

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

function formatInvestmentAddress(c: {
  order?: {
    investmentStreet?: string;
    investmentBuildingNumber?: string;
    investmentApartmentNumber?: string;
    investmentCity?: string;
    investmentPostalCode?: string;
  } | null;
  client?: {
    street?: string;
    buildingNumber?: string;
    apartmentNumber?: string;
    city?: string;
    postalCode?: string;
    address?: string;
  } | null;
}): { prefix?: string; primary: string; secondary?: string } {
  if (c.order) {
    const street = [c.order.investmentStreet, c.order.investmentBuildingNumber]
      .filter(Boolean)
      .join(" ");
    const apt = c.order.investmentApartmentNumber ? `/${c.order.investmentApartmentNumber}` : "";
    const fullStreet = `${street}${apt}`.trim();
    const city = c.order.investmentCity?.trim() || "";
    const postal = c.order.investmentPostalCode?.trim() || "";
    const fullCity = [postal, city].filter(Boolean).join(" ");

    if (fullStreet || city) {
      if (fullStreet && city) {
        return { prefix: "ADRES INWESTYCJI:", primary: fullStreet, secondary: fullCity || city };
      }
      return { prefix: "ADRES INWESTYCJI:", primary: fullStreet || fullCity || city };
    }
    return { prefix: "ADRES INWESTYCJI:", primary: "Brak danych" };
  }

  if (c.client) {
    const street = [c.client.street, c.client.buildingNumber].filter(Boolean).join(" ");
    const apt = c.client.apartmentNumber ? `/${c.client.apartmentNumber}` : "";
    const fullStreet = `${street}${apt}`.trim();
    const city = c.client.city?.trim() || "";
    const postal = c.client.postalCode?.trim() || "";
    const fullCity = [postal, city].filter(Boolean).join(" ");

    if (fullStreet || city) {
      if (fullStreet && city) {
        return { prefix: "ADRES KLIENTA:", primary: fullStreet, secondary: fullCity || city };
      }
      return { prefix: "ADRES KLIENTA:", primary: fullStreet || fullCity || city };
    }
    if (c.client.address?.trim()) {
      return { prefix: "ADRES KLIENTA:", primary: c.client.address.trim() };
    }
    return { prefix: "ADRES KLIENTA:", primary: "Brak danych" };
  }

  return { primary: "—" };
}

type ComplaintRow = {
  _id: Id<"complaints">;
  _creationTime: number;
  status: string;
  startDate: number;
  serviceDate?: number;
  serviceDateEnd?: number;
  assignedTo?: string;
  clientDescription?: string;
  description?: string;
  notes?: { id: string; text: string; createdAt: number; createdBy: string }[];
  entries?: { id: string; type: string; text: string; createdAt: number; createdBy: string }[];
  client?: {
    firstName?: string;
    lastName?: string;
    companyName?: string;
    phone?: string;
    street?: string;
    buildingNumber?: string;
    apartmentNumber?: string;
    city?: string;
    postalCode?: string;
    address?: string;
  } | null;
  order?: {
    name?: string;
    investmentStreet?: string;
    investmentBuildingNumber?: string;
    investmentApartmentNumber?: string;
    investmentCity?: string;
    investmentPostalCode?: string;
  } | null;
  installationTeam?: { name: string; color?: string } | null;
};

type Props = {
  complaints: ComplaintRow[] | undefined;
  /** If provided, the "Nowa reklamacja" button is shown pre-filled with these */
  defaultClientId?: Id<"clients">;
  defaultOrderId?: Id<"orders">;
  /** Hide columns not relevant in order context */
  compact?: boolean;
  title?: string;
};

export default function ComplaintsTable({
  complaints,
  defaultClientId,
  defaultOrderId,
  compact = false,
  title,
}: Props) {
  const [statusFilter, setStatusFilter] = useState<string>("wszystkie");
  const [clientFilter, setClientFilter] = useState<string>("");
  const [selectedId, setSelectedId] = useState<Id<"complaints"> | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);

  const updateComplaintStatus = useMutation(api.complaints.updateStatus);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleToggleStatus = async (e: React.MouseEvent, complaintId: Id<"complaints">, currentStatus: string) => {
    e.stopPropagation();
    setUpdatingId(complaintId);
    try {
      const isClosed = currentStatus === "zamknieta" || currentStatus === "rozwiazana" || currentStatus === "zakonczona";
      await updateComplaintStatus({
        complaintId,
        status: isClosed ? "w_toku" : "zamknieta",
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Błąd zmiany statusu reklamacji");
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = useMemo(() => {
    if (!complaints) return [];
    let result = complaints;
    if (statusFilter !== "wszystkie") {
      result = result.filter((c) => c.status === statusFilter);
    }
    if (clientFilter.trim()) {
      const term = clientFilter.toLowerCase();
      result = result.filter((c) => {
        const name = [c.client?.firstName, c.client?.lastName].filter(Boolean).join(" ").toLowerCase();
        const company = (c.client?.companyName ?? "").toLowerCase();
        const notes = [
          ...(c.notes ?? []).map((n) => n.text),
          ...(c.entries ?? []).filter((e) => e.type === "note").map((e) => e.text),
        ].join(" ").toLowerCase();
        return name.includes(term) || company.includes(term) || notes.includes(term);
      });
    }
    return result;
  }, [complaints, statusFilter, clientFilter]);

  const statusCounts = useMemo(() => {
    if (!complaints) return {} as Record<string, number>;
    const counts: Record<string, number> = { wszystkie: complaints.length };
    for (const c of complaints) {
      counts[c.status] = (counts[c.status] ?? 0) + 1;
    }
    return counts;
  }, [complaints]);

  const tableHeaders = compact
    ? ["DATA ZGŁOSZENIA", "Data serwisu", "Status", "Opis", "Przypisany do", "Ekipa", ""]
    : ["DATA ZGŁOSZENIA", "Data serwisu", "Klient", "Adres inwestycji", "Telefon", "Status", "Opis", "Przypisany do", "Ekipa", ""];

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {title && (
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{title}</span>
            )}
            {complaints !== undefined && (
              <span style={{ fontSize: 12, color: "var(--text-mute)", fontWeight: 400 }}>
                ({complaints.length})
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1, justifyContent: "flex-end", flexWrap: "wrap" }}>
            {/* Search */}
            <div style={{ position: "relative", width: 280 }}>
              <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "var(--text-mute)" }} />
              <input
                type="text"
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                placeholder="Szukaj reklamacji…"
                style={{
                  width: "100%",
                  padding: "7px 28px 7px 30px",
                  borderRadius: 999,
                  border: "1px solid var(--line)",
                  background: "var(--panel)",
                  fontSize: 12.5,
                  fontFamily: "inherit",
                  color: "var(--text)",
                  outline: "none",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--line)"; }}
              />
              {clientFilter && (
                <button
                  onClick={() => setClientFilter("")}
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-mute)", display: "flex" }}
                >
                  <X style={{ width: 12, height: 12 }} />
                </button>
              )}
            </div>
            {/* New button */}
            <button
              onClick={() => setShowNewModal(true)}
              className="btn primary"
              style={{ fontSize: 12.5, padding: "7px 14px", display: "flex", alignItems: "center", gap: 5 }}
            >
              <Plus size={13} /> Nowa reklamacja
            </button>
          </div>
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
                  padding: "4px 11px",
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

        {/* Table */}
        <div className="panel" style={{ overflow: "hidden" }}>
          {complaints === undefined ? (
            <div style={{ padding: 40, textAlign: "center", fontSize: 13, color: "var(--text-mute)" }}>
              Ładowanie…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center" }}>
              <svg style={{ width: 36, height: 36, color: "var(--line)", margin: "0 auto 10px", display: "block" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-mute)" }}>
                {complaints.length === 0 ? "Brak reklamacji dla tego zlecenia." : "Brak reklamacji spełniających kryteria."}
              </p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  {tableHeaders.map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 16px",
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
                      {/* Data zgłoszenia */}
                      <td style={{ padding: "12px 16px", fontSize: 12.5, whiteSpace: "nowrap" }}>
                        {(() => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const start = new Date(c.startDate);
                          start.setHours(0, 0, 0, 0);
                          const diffDays = Math.round((today.getTime() - start.getTime()) / 86400000);
                          const daysText =
                            diffDays === 0 ? "Dzisiaj" : diffDays === 1 ? "Wczoraj" : `${diffDays} dni temu`;
                          return (
                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              <span style={{ color: "var(--text)", fontWeight: 500 }}>{formatDate(c.startDate)}</span>
                              <span style={{ color: "var(--text-mute)", fontSize: 10 }}>{daysText}</span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Data serwisu */}
                      <td style={{ padding: "12px 16px", fontSize: 12.5, whiteSpace: "nowrap" }}>
                        {(() => {
                          if (!c.serviceDate) return <span style={{ color: "var(--text-mute)" }}>—</span>;
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const service = new Date(c.serviceDate);
                          service.setHours(0, 0, 0, 0);
                          const diffDays = Math.round((service.getTime() - today.getTime()) / 86400000);

                          let badgeBg = "var(--panel-2)", badgeColor = "var(--text-mute)", daysText = "";
                          if (diffDays === 0) { badgeBg = "#fef08a"; badgeColor = "#854d0e"; daysText = "Dzisiaj"; }
                          else if (diffDays === 1) { badgeBg = "#bfdbfe"; badgeColor = "#1e3a8a"; daysText = "Jutro"; }
                          else if (diffDays > 1 && diffDays <= 3) { badgeBg = "#fed7aa"; badgeColor = "#9a3412"; daysText = `za ${diffDays} dni`; }
                          else if (diffDays > 3) { badgeBg = "#dcfce7"; badgeColor = "#166534"; daysText = `za ${diffDays} dni`; }
                          else { badgeBg = "#fee2e2"; badgeColor = "#991b1b"; daysText = `${Math.abs(diffDays)} dni po terminie`; }

                          const dStart = new Date(c.serviceDate);
                          const hasTime = dStart.getHours() !== 0 || dStart.getMinutes() !== 0 || !!c.serviceDateEnd;
                          const startStr = `${String(dStart.getHours()).padStart(2, "0")}:${String(dStart.getMinutes()).padStart(2, "0")}`;
                          let timeRangeStr = hasTime ? startStr : null;
                          if (hasTime && c.serviceDateEnd) {
                            const dEnd = new Date(c.serviceDateEnd);
                            const endStr = `${String(dEnd.getHours()).padStart(2, "0")}:${String(dEnd.getMinutes()).padStart(2, "0")}`;
                            timeRangeStr = `${startStr} – ${endStr}`;
                          }

                          return (
                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              <span style={{ color: "var(--text)", fontWeight: 600 }}>
                                {formatDate(c.serviceDate)}
                              </span>
                              {timeRangeStr && (
                                <span style={{ fontSize: 11, color: "var(--text-mute)", fontWeight: 500 }}>
                                  🕒 {timeRangeStr}
                                </span>
                              )}
                              <span style={{ background: badgeBg, color: badgeColor, fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 12, width: "fit-content", textTransform: "uppercase", letterSpacing: "0.02em", whiteSpace: "nowrap" }}>
                                {daysText}
                              </span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Klient — only in non-compact mode */}
                      {!compact && (
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text)" }}>
                            {clientName}
                          </span>
                          {c.client?.companyName && clientName !== c.client.companyName && (
                            <div style={{ fontSize: 11, color: "var(--text-mute)", marginTop: 2 }}>{c.client.companyName}</div>
                          )}
                        </td>
                      )}

                      {/* Adres — only non-compact */}
                      {!compact && (
                        <td style={{ padding: "12px 16px" }}>
                          {(() => {
                            const addr = formatInvestmentAddress(c);
                            return (
                              <div>
                                {addr.prefix && (
                                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", marginBottom: 2 }}>{addr.prefix}</div>
                                )}
                                <div style={{ fontSize: 12.5, color: addr.primary === "—" ? "var(--text-mute)" : "var(--text)", fontWeight: addr.primary === "—" ? 400 : 500 }}>
                                  {addr.primary}
                                </div>
                                {addr.secondary && <div style={{ fontSize: 11, color: "var(--text-mute)" }}>{addr.secondary}</div>}
                              </div>
                            );
                          })()}
                        </td>
                      )}

                      {/* Telefon — only non-compact */}
                      {!compact && (
                        <td style={{ padding: "12px 16px", fontSize: 12.5, whiteSpace: "nowrap" }}>
                          {c.client?.phone ? (
                            <span style={{ color: "var(--text)", fontWeight: 500 }}>{c.client.phone}</span>
                          ) : (
                            <span style={{ color: "var(--text-mute)" }}>—</span>
                          )}
                        </td>
                      )}

                      {/* Status */}
                      <td style={{ padding: "12px 16px" }}>
                        <StatusBadge status={c.status} />
                      </td>

                      {/* Opis */}
                      <td style={{ padding: "12px 16px", fontSize: 12.5, color: "var(--text-mute)", maxWidth: 240, whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
                        {c.clientDescription || c.description || <em style={{ opacity: 0.5 }}>Brak opisu</em>}
                      </td>

                      {/* Przypisany do */}
                      <td style={{ padding: "12px 16px", fontSize: 12.5, color: "var(--text-mute)" }}>
                        {c.assignedTo ?? "—"}
                      </td>

                      {/* Ekipa */}
                      <td style={{ padding: "12px 16px", fontSize: 12.5 }}>
                        {c.installationTeam ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 12, fontSize: 11.5, fontWeight: 600, background: `${c.installationTeam.color ?? "#10b981"}22`, color: c.installationTeam.color ?? "#10b981", whiteSpace: "nowrap" }}>
                            🛠️ {c.installationTeam.name}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-mute)" }}>—</span>
                        )}
                      </td>

                      {/* Arrow & Action */}
                      <td style={{ padding: "12px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                        {(() => {
                          const isClosed = c.status === "zamknieta" || c.status === "rozwiazana" || c.status === "zakonczona";
                          const isUpdating = updatingId === c._id;
                          return (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                              <button
                                type="button"
                                onClick={(e) => handleToggleStatus(e, c._id, c.status)}
                                disabled={isUpdating}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  padding: "3px 9px",
                                  borderRadius: 6,
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  border: isClosed ? "1px solid #bbf7d0" : "1px solid #cbd5e1",
                                  background: isClosed ? "#f0fdf4" : "#ffffff",
                                  color: isClosed ? "#15803d" : "#334155",
                                  opacity: isUpdating ? 0.5 : 1,
                                  transition: "all 0.15s ease",
                                }}
                                title={isClosed ? "Kliknij, aby otworzyć ponowne zgłoszenie" : "Kliknij, aby zamknąć tę reklamację"}
                              >
                                <CheckCircle2 size={13} style={{ color: isClosed ? "#16a34a" : "#64748b" }} />
                                {isClosed ? "Zamknięta ✓" : "Zamknij"}
                              </button>
                              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "var(--text-mute)" }}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                              </svg>
                            </div>
                          );
                        })()}
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
      {showNewModal && (
        <NewComplaintModal
          onClose={() => setShowNewModal(false)}
          onCreated={(id) => setSelectedId(id)}
          defaultClientId={defaultClientId}
          defaultOrderId={defaultOrderId}
        />
      )}
    </>
  );
}
