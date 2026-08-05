"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import ComplaintDetailPanel from "@/components/complaints/ComplaintDetailPanel";
import NewComplaintModal from "@/components/complaints/NewComplaintModal";
import { createPortal } from "react-dom";
import { CrmPageHeader } from "@/components/crm-ui";
import { Search, X, Plus, Printer, CheckCircle2 } from "lucide-react";

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
    const street = [c.client.street, c.client.buildingNumber]
      .filter(Boolean)
      .join(" ");
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

export default function ReklamacjePage() {
  const [statusFilter, setStatusFilter] = useState<string>("wszystkie");
  const [assignedFilter, setAssignedFilter] = useState<string>("");
  const [clientFilter, setClientFilter] = useState<string>("");
  const [startDateFrom, setStartDateFrom] = useState<string>("");
  const [startDateTo, setStartDateTo] = useState<string>("");
  const [serviceDateFrom, setServiceDateFrom] = useState<string>("");
  const [serviceDateTo, setServiceDateTo] = useState<string>("");

  const [selectedId, setSelectedId] = useState<Id<"complaints"> | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);

  // Print mode state
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [selectedForPrint, setSelectedForPrint] = useState<Set<Id<"complaints">>>(new Set());

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
        const invAddr = [
          c.order?.investmentStreet,
          c.order?.investmentCity,
          c.client?.street,
          c.client?.city,
          c.client?.address,
        ].filter(Boolean).join(" ").toLowerCase();
        const phone = (c.client?.phone ?? "").toLowerCase();
        const notesText = [
          ...(c.notes ?? []).map((n) => n.text),
          ...(c.entries ?? []).filter((e) => e.type === "note").map((e) => e.text),
        ].join(" ").toLowerCase();
        return name.includes(term) || company.includes(term) || invAddr.includes(term) || phone.includes(term) || notesText.includes(term);
      });
    }
    if (startDateFrom) {
      const from = new Date(startDateFrom).getTime();
      result = result.filter((c) => c.startDate >= from);
    }
    if (startDateTo) {
      const to = new Date(startDateTo).getTime() + 86400000; // inclusive
      result = result.filter((c) => c.startDate <= to);
    }
    if (serviceDateFrom) {
      const from = new Date(serviceDateFrom).getTime();
      result = result.filter((c) => c.serviceDate !== undefined && c.serviceDate >= from);
    }
    if (serviceDateTo) {
      const to = new Date(serviceDateTo).getTime() + 86400000; // inclusive
      result = result.filter((c) => c.serviceDate !== undefined && c.serviceDate <= to);
    }
    return result;
  }, [complaints, clientFilter, startDateFrom, startDateTo, serviceDateFrom, serviceDateTo]);

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
        <CrmPageHeader
          title="Reklamacje"
          sub={complaints ? `${complaints.length} reklamacji łącznie` : "Ładowanie…"}
          center={
            <div style={{ position: "relative", width: "100%", maxWidth: 420 }}>
              <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--text-mute)" }} />
              <input
                type="text"
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                placeholder="Szukaj reklamacji, klienta…"
                style={{
                  width: "100%",
                  padding: "8px 30px 8px 34px",
                  borderRadius: 999,
                  border: "1px solid var(--line)",
                  background: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: "inherit",
                  color: "var(--text-strong)",
                  outline: "none",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-soft)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--line)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              {clientFilter && (
                <button
                  onClick={() => setClientFilter("")}
                  style={{
                    position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                    background: "var(--panel-3)", border: "none", borderRadius: "50%",
                    cursor: "pointer", color: "var(--text-mute)", width: 20, height: 20,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <X style={{ width: 12, height: 12 }} />
                </button>
              )}
            </div>
          }
          actions={
            <div style={{ display: "flex", gap: 8 }}>
              {isPrintMode ? (
                <>
                  <button
                    onClick={() => {
                      setIsPrintMode(false);
                      setSelectedForPrint(new Set());
                    }}
                    className="btn ghost"
                  >
                    Anuluj
                  </button>
                  <button
                    onClick={() => {
                      if (selectedForPrint.size === 0) return;
                      // Otwieramy nowy widok do druku
                      const ids = Array.from(selectedForPrint).join(",");
                      window.open(`/admin/reklamacje/print?ids=${ids}`, "_blank");
                    }}
                    className="btn primary"
                    disabled={selectedForPrint.size === 0}
                    style={{ opacity: selectedForPrint.size === 0 ? 0.5 : 1, cursor: selectedForPrint.size === 0 ? "not-allowed" : "pointer" }}
                  >
                    <Printer size={13} /> Generuj PDF ({selectedForPrint.size})
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsPrintMode(true)}
                    className="btn ghost"
                    style={{ background: "var(--panel-2)" }}
                  >
                    <Printer size={13} /> Drukuj
                  </button>
                  <button
                    onClick={() => setShowNewModal(true)}
                    className="btn primary"
                  >
                    <Plus size={13} /> Nowa reklamacja
                  </button>
                </>
              )}
            </div>
          }
        />

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
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 12px", background: "var(--accent-soft)", borderRadius: 8, border: "1px solid rgba(59, 130, 246, 0.2)" }}>
            <span style={{ fontSize: 11.5, color: "var(--accent)", fontWeight: 600 }}>Zgłoszenie:</span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 11.5, color: "var(--accent)", opacity: 0.8 }}>od</span>
              <input
                type="date"
                value={startDateFrom}
                onChange={(e) => setStartDateFrom(e.target.value)}
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
              <span style={{ fontSize: 11.5, color: "var(--accent)", opacity: 0.8 }}>do</span>
              <input
                type="date"
                value={startDateTo}
                onChange={(e) => setStartDateTo(e.target.value)}
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
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 12px", background: "rgba(34, 197, 94, 0.1)", borderRadius: 8, border: "1px solid rgba(34, 197, 94, 0.2)" }}>
            <span style={{ fontSize: 11.5, color: "#166534", fontWeight: 600 }}>Serwis:</span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 11.5, color: "#166534", opacity: 0.8 }}>od</span>
              <input
                type="date"
                value={serviceDateFrom}
                onChange={(e) => setServiceDateFrom(e.target.value)}
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
              <span style={{ fontSize: 11.5, color: "#166534", opacity: 0.8 }}>do</span>
              <input
                type="date"
                value={serviceDateTo}
                onChange={(e) => setServiceDateTo(e.target.value)}
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
          </div>
          {(clientFilter || assignedFilter || startDateFrom || startDateTo || serviceDateFrom || serviceDateTo) && (
            <button
              onClick={() => {
                setClientFilter("");
                setAssignedFilter("");
                setStartDateFrom("");
                setStartDateTo("");
                setServiceDateFrom("");
                setServiceDateTo("");
              }}
              style={{
                fontSize: 11.5,
                padding: "5px 10px",
                borderRadius: 6,
                border: "none",
                background: "var(--accent-soft)",
                color: "var(--accent)",
                cursor: "pointer",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <X size={12} />
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
                  {isPrintMode && (
                    <th style={{ padding: "14px 16px", width: 40, textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={filtered.length > 0 && selectedForPrint.size === filtered.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedForPrint(new Set(filtered.map(c => c._id)));
                          } else {
                            setSelectedForPrint(new Set());
                          }
                        }}
                        style={{ cursor: "pointer" }}
                      />
                    </th>
                  )}
                  {["DATA ZGŁOSZENIA", "Data serwisu", "Klient", "Adres inwestycji", "Telefon", "Zlecenie", "Status", "Opis", "Notatki wewnętrzne", "Przypisany do", "Ekipa", ""].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "14px 16px",
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
                      {isPrintMode && (
                        <td style={{ padding: "14px 16px", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedForPrint.has(c._id)}
                            onChange={(e) => {
                              const next = new Set(selectedForPrint);
                              if (e.target.checked) next.add(c._id);
                              else next.delete(c._id);
                              setSelectedForPrint(next);
                            }}
                            style={{ cursor: "pointer" }}
                          />
                        </td>
                      )}
                      <td style={{ padding: "14px 16px", fontSize: 12.5, whiteSpace: "nowrap" }}>
                        {(() => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const start = new Date(c.startDate);
                          start.setHours(0, 0, 0, 0);
                          const diffTime = today.getTime() - start.getTime();
                          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                          
                          let daysText = "";
                          if (diffDays === 0) daysText = "Dzisiaj";
                          else if (diffDays === 1) daysText = "Wczoraj";
                          else daysText = `${diffDays} dni temu`;

                          return (
                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              <span style={{ color: "var(--text)", fontWeight: 500 }}>{formatDate(c.startDate)}</span>
                              <span style={{ color: "var(--text-mute)", fontSize: 10 }}>{daysText}</span>
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 12.5, whiteSpace: "nowrap" }}>
                        {(() => {
                          if (!c.serviceDate) return <span style={{ color: "var(--text-mute)" }}>—</span>;
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const service = new Date(c.serviceDate);
                          service.setHours(0, 0, 0, 0);
                          const diffTime = service.getTime() - today.getTime();
                          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                          
                          let badgeBg = "var(--panel-2)";
                          let badgeColor = "var(--text-mute)";
                          let daysText = "";
                          
                          const isFinished = c.status === "zamknieta" || c.status === "rozwiazana" || c.status === "zakonczona";
                          if (isFinished) {
                            // If finished, no need to show countdown aggressively
                            daysText = diffDays > 0 ? `Zrealizowano przed terminem` : `Data serwisu minęła`;
                          } else if (diffDays === 0) {
                            badgeBg = "#fef08a"; // yellow-200
                            badgeColor = "#854d0e"; // yellow-800
                            daysText = "Dzisiaj";
                          } else if (diffDays === 1) {
                            badgeBg = "#bfdbfe"; // blue-200
                            badgeColor = "#1e3a8a"; // blue-900
                            daysText = "Jutro";
                          } else if (diffDays > 1 && diffDays <= 3) {
                            badgeBg = "#fed7aa"; // orange-200
                            badgeColor = "#9a3412"; // orange-800
                            daysText = `za ${diffDays} dni`;
                          } else if (diffDays > 3) {
                            badgeBg = "#dcfce7"; // green-100
                            badgeColor = "#166534"; // green-800
                            daysText = `za ${diffDays} dni`;
                          } else {
                            badgeBg = "#fee2e2"; // red-100
                            badgeColor = "#991b1b"; // red-800
                            daysText = `${Math.abs(diffDays)} dni po terminie`;
                          }
                          
                          return (
                            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                              <span style={{ color: "var(--text)", fontWeight: 500 }}>{formatDate(c.serviceDate)}</span>
                              {!isFinished && (
                                <span style={{
                                  display: "inline-block",
                                  background: badgeBg,
                                  color: badgeColor,
                                  fontSize: 10,
                                  fontWeight: 600,
                                  padding: "2px 6px",
                                  borderRadius: 12,
                                  width: "fit-content",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.02em",
                                  whiteSpace: "nowrap"
                                }}>
                                  {daysText}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text)" }}>
                          {clientName}
                        </span>
                        {c.client?.companyName && clientName !== c.client.companyName && (
                          <div style={{ fontSize: 11, color: "var(--text-mute)", marginTop: 2 }}>{c.client.companyName}</div>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        {(() => {
                          const addr = formatInvestmentAddress(c);
                          return (
                            <div>
                              {addr.prefix && (
                                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", marginBottom: 2 }}>
                                  {addr.prefix}
                                </div>
                              )}
                              <div
                                style={{
                                  fontSize: 12.5,
                                  color: addr.primary === "—" ? "var(--text-mute)" : "var(--text)",
                                  fontWeight: addr.primary === "—" ? 400 : 500,
                                }}
                              >
                                {addr.primary}
                              </div>
                              {addr.secondary && (
                                <div style={{ fontSize: 11, color: "var(--text-mute)" }}>
                                  {addr.secondary}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 12.5, whiteSpace: "nowrap" }}>
                        {c.client?.phone ? (
                          <span style={{ color: "var(--text)", fontWeight: 500 }}>{c.client.phone}</span>
                        ) : (
                          <span style={{ color: "var(--text-mute)" }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontSize: 12.5, color: "var(--text)" }}>
                          {c.order?.name ?? "—"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <StatusBadge status={c.status} />
                      </td>
                      <td
                        style={{
                          padding: "14px 16px",
                          fontSize: 12.5,
                          color: "var(--text-mute)",
                          maxWidth: 240,
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.4,
                        }}
                      >
                        {c.clientDescription || c.description || <em style={{ opacity: 0.5 }}>Brak opisu</em>}
                      </td>
                      <td
                        style={{
                          padding: "14px 16px",
                          fontSize: 12,
                          color: "var(--text)",
                          maxWidth: 260,
                        }}
                      >
                        {(() => {
                          const allNotes = [
                            ...(c.notes ?? []),
                            ...(c.entries ?? []).filter((e) => e.type === "note").map((e) => ({
                              id: e.id,
                              text: e.text,
                              createdAt: e.createdAt,
                              createdBy: e.createdBy,
                            })),
                          ].sort((a, b) => a.createdAt - b.createdAt);

                          if (allNotes.length === 0) {
                            return <span style={{ color: "var(--text-mute)" }}>—</span>;
                          }

                          return (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              {allNotes.map((n) => (
                                <div
                                  key={n.id}
                                  style={{
                                    background: "var(--panel-2, rgba(0,0,0,0.03))",
                                    padding: "5px 8px",
                                    borderRadius: 5,
                                    border: "1px solid var(--line)",
                                    fontSize: 11.5,
                                    lineHeight: 1.35,
                                  }}
                                >
                                  <div style={{ color: "var(--text)", whiteSpace: "pre-wrap" }}>{n.text}</div>
                                  <div style={{ fontSize: 10, color: "var(--text-mute)", marginTop: 3 }}>
                                    {n.createdBy}
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 12.5, color: "var(--text-mute)" }}>
                        {c.assignedTo ?? "—"}
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 12.5 }}>
                        {c.installationTeam ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "3px 8px",
                              borderRadius: 12,
                              fontSize: 11.5,
                              fontWeight: 600,
                              background: `${c.installationTeam.color ?? "#10b981"}22`,
                              color: c.installationTeam.color ?? "#10b981",
                              whiteSpace: "nowrap",
                            }}
                          >
                            🛠️ {c.installationTeam.name}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-mute)" }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
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
                                  padding: "4px 10px",
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
