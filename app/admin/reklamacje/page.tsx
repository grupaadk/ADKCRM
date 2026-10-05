"use client";

import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import ComplaintDetailPanel from "@/components/complaints/ComplaintDetailPanel";
import NewComplaintModal from "@/components/complaints/NewComplaintModal";
import ServiceTripsView from "@/components/complaints/ServiceTripsView";
import { useSearchParams } from "next/navigation";
import { CrmPageHeader } from "@/components/crm-ui";
import { Search, X, Plus, Printer, CheckCircle2, Filter, User, Users, RotateCcw, Car } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  aktualne: "Aktualne",
  archiwalne: "Archiwalne",
  nowa: "Aktualne",
  w_toku: "Aktualne",
  rozwiazana: "Archiwalne",
  zamknieta: "Archiwalne",
  zakonczona: "Archiwalne",
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}



function formatInvestmentAddress(c: {
  customClientAddress?: string;
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
  if (c.customClientAddress) {
    return { prefix: "ADRES INWESTYCJI:", primary: c.customClientAddress };
  }

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
  const searchParams = useSearchParams();
  const fromTab = searchParams.get("fromTab");
  const backHref = fromTab ? `/admin/panel?tab=${fromTab}` : "/admin/panel";

  const [statusFilter, setStatusFilter] = useState<string>("aktualne");
  const [assignedFilter, setAssignedFilter] = useState<string>("");
  const [teamFilter, setTeamFilter] = useState<string>("");
  const [clientFilter, setClientFilter] = useState<string>("");

  const [selectedId, setSelectedId] = useState<Id<"complaints"> | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"list" | "trips">("list");

  // Print mode state
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [selectedForPrint, setSelectedForPrint] = useState<Set<Id<"complaints">>>(new Set());



  const complaints = useQuery(api.complaints.getAll, {
    status: statusFilter !== "wszystkie" ? statusFilter : undefined,
    assignedTo: assignedFilter || undefined,
  });

  const users = useQuery(api.users.listAllActive);
  const teams = useQuery(api.installationTeams.listActive);

  // Client-side filtering logic
  const filtered = useMemo(() => {
    if (!complaints) return [];
    let result = complaints;

    // Search filter
    if (clientFilter.trim()) {
      const term = clientFilter.toLowerCase();
      result = result.filter((c) => {
        const name = (
          c.customClientName ||
          [c.client?.firstName, c.client?.lastName].filter(Boolean).join(" ") ||
          c.client?.companyName ||
          ""
        ).toLowerCase();
        const company = (c.client?.companyName ?? "").toLowerCase();
        const invAddr = (
          c.customClientAddress ||
          [
            c.order?.investmentStreet,
            c.order?.investmentCity,
            c.client?.street,
            c.client?.city,
            c.client?.address,
          ].filter(Boolean).join(" ")
        ).toLowerCase();
        const phone = (c.customClientPhone || c.client?.phone || "").toLowerCase();
        const notesText = [
          ...(c.notes ?? []).map((n) => n.text),
          ...(c.entries ?? []).filter((e) => e.type === "note").map((e) => e.text),
        ].join(" ").toLowerCase();
        return name.includes(term) || company.includes(term) || invAddr.includes(term) || phone.includes(term) || notesText.includes(term);
      });
    }

    // Team filter
    if (teamFilter) {
      result = result.filter((c) => c.installationTeamId === teamFilter);
    }

    return result;
  }, [complaints, clientFilter, teamFilter]);

  const statusCounts = useMemo(() => {
    if (!complaints) return {};
    const counts: Record<string, number> = { wszystkie: complaints.length };
    for (const c of complaints) {
      counts[c.status] = (counts[c.status] ?? 0) + 1;
    }
    return counts;
  }, [complaints]);

  const userColorMap = useMemo(() => {
    if (!users) return new Map<string, string>();
    const map = new Map<string, string>();
    for (const u of users) {
      const name = u.displayName ?? u.login ?? "";
      if (name && u.color) {
        map.set(name, u.color);
      }
    }
    return map;
  }, [users]);

  const countsByAssigned = useMemo(() => {
    if (!complaints) return {};
    const map: Record<string, number> = {};
    for (const c of complaints) {
      const assignedList = c.assignedToUsers && c.assignedToUsers.length > 0
        ? c.assignedToUsers
        : c.assignedTo
          ? c.assignedTo.split(", ").map((s) => s.trim()).filter(Boolean)
          : [];
      for (const name of assignedList) {
        map[name] = (map[name] ?? 0) + 1;
      }
    }
    return map;
  }, [complaints]);

  const countsByTeam = useMemo(() => {
    if (!complaints) return {};
    const map: Record<string, number> = {};
    for (const c of complaints) {
      if (c.installationTeamId) {
        map[c.installationTeamId] = (map[c.installationTeamId] ?? 0) + 1;
      }
    }
    return map;
  }, [complaints]);

  // Only users who have assigned complaints
  const activeAssignedUsers = useMemo(() => {
    if (!users) return [];
    return users.filter((u) => {
      const uName = u.displayName ?? u.login ?? "";
      return Boolean(uName && ((countsByAssigned[uName] ?? 0) > 0 || assignedFilter === uName));
    });
  }, [users, countsByAssigned, assignedFilter]);

  // Only teams who have assigned complaints
  const activeAssignedTeams = useMemo(() => {
    if (!teams) return [];
    return teams.filter((t) => (countsByTeam[t._id] ?? 0) > 0 || teamFilter === t._id);
  }, [teams, countsByTeam, teamFilter]);

  const hasActiveFilters = Boolean(assignedFilter || teamFilter || clientFilter);

  const handleResetFilters = () => {
    setAssignedFilter("");
    setTeamFilter("");
    setClientFilter("");
  };

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Page Header */}
        <CrmPageHeader
          title="Reklamacje"
          sub={complaints ? `${complaints.length} reklamacji łącznie` : "Ładowanie…"}
          backHref={backHref}
          backLabel="Powrót do Panelu zleceń"
          center={
            activeTab === "list" ? (
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
            ) : null
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

        {/* Tab switcher */}
        <div style={{
          display: "flex",
          gap: 4,
          background: "var(--panel-2)",
          border: "1px solid var(--line)",
          borderRadius: 10,
          padding: 4,
          width: "fit-content",
        }}>
          {([
            { id: "list", label: "Lista reklamacji", icon: <CheckCircle2 size={13} /> },
            { id: "trips", label: "Wyjazdy serwisowe", icon: <Car size={13} /> },
          ] as const).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  fontSize: 13, fontWeight: active ? 600 : 500,
                  padding: "6px 14px",
                  borderRadius: 7,
                  border: "none",
                  background: active ? "var(--panel)" : "transparent",
                  color: active ? "var(--text-strong)" : "var(--text-mute)",
                  cursor: "pointer",
                  boxShadow: active ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.15s",
                  fontFamily: "inherit",
                }}
              >
                {tab.icon} {tab.label}
              </button>
            );
          })}
        </div>

        {/* Trips view */}
        {activeTab === "trips" && <ServiceTripsView />}

        {/* List view */}
        {activeTab === "list" && (
        <>

        {/* Refined Interactive Filter Panel */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: "16px 20px",
            background: "#ffffff",
            border: "1px solid var(--line)",
            borderRadius: 12,
            boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
          }}
        >
          {/* Header Bar with Active Indicator & Reset Button */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Filter style={{ width: 15, height: 15, color: "var(--accent)" }} />
              {hasActiveFilters ? (
                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 12, background: "var(--accent-soft)", color: "var(--accent)" }}>
                  Wyniki: {filtered.length} reklamacji
                </span>
              ) : (
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-mute)" }}>
                  Wyniki: {filtered.length} reklamacji
                </span>
              )}
            </div>

            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: "none",
                  background: "#fee2e2",
                  color: "#991b1b",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  transition: "background 0.15s",
                }}
              >
                <RotateCcw size={12} />
                Wyczyść filtry
              </button>
            )}
          </div>

          {/* Row 1: Status */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-mute)", minWidth: 90, display: "flex", alignItems: "center", gap: 5 }}>
              <CheckCircle2 size={13} /> Status:
            </span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["aktualne", "archiwalne", "wszystkie"] as const).map((s) => {
                const active = statusFilter === s;
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 20,
                      border: active ? "1px solid var(--accent)" : "1px solid var(--line)",
                      background: active ? "var(--accent-soft)" : "var(--panel-2)",
                      color: active ? "var(--accent)" : "var(--text)",
                      fontSize: 12,
                      fontWeight: active ? 600 : 400,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      transition: "all 0.15s",
                    }}
                  >
                    {s === "wszystkie" ? "Wszystkie" : STATUS_LABELS[s]}
                    {statusCounts[s] != null && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "1px 6px",
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
          </div>

          {/* Row 2: Pracownik (Only Assigned) */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-mute)", minWidth: 90, display: "flex", alignItems: "center", gap: 5 }}>
              <User size={13} /> Pracownik:
            </span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <button
                onClick={() => setAssignedFilter("")}
                style={{
                  padding: "4px 12px",
                  borderRadius: 20,
                  border: assignedFilter === "" ? "1px solid var(--accent)" : "1px solid var(--line)",
                  background: assignedFilter === "" ? "var(--accent-soft)" : "var(--panel-2)",
                  color: assignedFilter === "" ? "var(--accent)" : "var(--text)",
                  fontSize: 12,
                  fontWeight: assignedFilter === "" ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                Wszyscy
              </button>
              {activeAssignedUsers.length === 0 ? (
                <span style={{ fontSize: 11.5, color: "var(--text-mute)", fontStyle: "italic" }}>Brak przypisanych reklamacji</span>
              ) : (
                activeAssignedUsers.map((u) => {
                  const uName = u.displayName ?? u.login ?? "";
                  const active = assignedFilter === uName;
                  const count = countsByAssigned[uName] ?? 0;
                  const userColor = u.color ?? "var(--accent)";
                  return (
                    <button
                      key={u._id}
                      onClick={() => setAssignedFilter(active ? "" : uName)}
                      style={{
                        padding: "4px 12px",
                        borderRadius: 20,
                        border: active ? `1px solid ${userColor}` : "1px solid var(--line)",
                        background: active ? `${userColor}1a` : "var(--panel-2)",
                        color: active ? userColor : "var(--text)",
                        fontSize: 12,
                        fontWeight: active ? 600 : 400,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        transition: "all 0.15s",
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: userColor }} />
                      <span>{uName}</span>
                      {count > 0 && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: 10,
                            background: active ? userColor : "var(--line)",
                            color: active ? "#fff" : "var(--text-mute)",
                          }}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Row 3: Ekipa (Only Assigned) */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-mute)", minWidth: 90, display: "flex", alignItems: "center", gap: 5 }}>
              <Users size={13} /> Ekipa:
            </span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <button
                onClick={() => setTeamFilter("")}
                style={{
                  padding: "4px 12px",
                  borderRadius: 20,
                  border: teamFilter === "" ? "1px solid var(--accent)" : "1px solid var(--line)",
                  background: teamFilter === "" ? "var(--accent-soft)" : "var(--panel-2)",
                  color: teamFilter === "" ? "var(--accent)" : "var(--text)",
                  fontSize: 12,
                  fontWeight: teamFilter === "" ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                Wszystkie ekipy
              </button>
              {activeAssignedTeams.length === 0 ? (
                <span style={{ fontSize: 11.5, color: "var(--text-mute)", fontStyle: "italic" }}>Brak przypisanych ekip</span>
              ) : (
                activeAssignedTeams.map((t) => {
                  const active = teamFilter === t._id;
                  const count = countsByTeam[t._id] ?? 0;
                  const teamColor = t.color ?? "#10b981";
                  return (
                    <button
                      key={t._id}
                      onClick={() => setTeamFilter(active ? "" : t._id)}
                      style={{
                        padding: "4px 12px",
                        borderRadius: 20,
                        border: active ? `1px solid ${teamColor}` : "1px solid var(--line)",
                        background: active ? `${teamColor}1a` : "var(--panel-2)",
                        color: active ? teamColor : "var(--text)",
                        fontSize: 12,
                        fontWeight: active ? 600 : 400,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        transition: "all 0.15s",
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: teamColor }} />
                      <span>{t.name}</span>
                      {count > 0 && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: 10,
                            background: active ? teamColor : "var(--line)",
                            color: active ? "#fff" : "var(--text-mute)",
                          }}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
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
                  {["DATA ZGŁOSZENIA", "Data serwisu", "Klient / Adres / Telefon", "Opis", "Notatki wewnętrzne", "Ekipa", ""].map((h) => (
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
                    c.customClientName ||
                    [c.client?.firstName, c.client?.lastName].filter(Boolean).join(" ") ||
                    c.client?.companyName ||
                    "—";
                  const phone = c.customClientPhone || c.client?.phone;
                  const isSelected = selectedId === c._id;

                  const assignedList = c.assignedToUsers && c.assignedToUsers.length > 0
                    ? c.assignedToUsers
                    : c.assignedTo
                      ? c.assignedTo.split(", ").map((s) => s.trim()).filter(Boolean)
                      : [];
                  const colors = assignedList.map((name) => userColorMap.get(name)).filter(Boolean) as string[];
                  const hasMultipleColors = colors.length > 1;
                  const singleColor = colors.length === 1 ? colors[0] : undefined;

                  let gradientStr = "";
                  if (hasMultipleColors) {
                    const step = 100 / colors.length;
                    const stops = colors.map((col, i) => `${col} ${i * step}%, ${col} ${(i + 1) * step}%`);
                    gradientStr = `linear-gradient(to bottom, ${stops.join(", ")})`;
                  }

                  const hasColorStripe = Boolean(singleColor || hasMultipleColors);

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
                      {isPrintMode ? (
                        <td style={{ position: "relative", padding: "14px 16px", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                          {hasColorStripe && (
                            <div
                              style={{
                                position: "absolute",
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: 5,
                                background: hasMultipleColors ? gradientStr : singleColor,
                              }}
                              title={`Przypisani: ${assignedList.join(", ")}`}
                            />
                          )}
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
                      ) : null}
                      <td style={{ position: "relative", padding: "14px 16px", paddingLeft: (!isPrintMode && hasColorStripe) ? 18 : 16, fontSize: 12.5, whiteSpace: "nowrap" }}>
                        {!isPrintMode && hasColorStripe && (
                          <div
                            style={{
                              position: "absolute",
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: 5,
                              background: hasMultipleColors ? gradientStr : singleColor,
                            }}
                            title={`Przypisani: ${assignedList.join(", ")}`}
                          />
                        )}
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
                      <td style={{ padding: "14px 16px", minWidth: 260 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-strong)" }}>
                              {clientName}
                            </span>
                            {c.client?.companyName && clientName !== c.client.companyName && (
                              <span style={{ fontSize: 11, color: "var(--text-mute)", fontStyle: "italic" }}>
                                ({c.client.companyName})
                              </span>
                            )}
                          </div>
                          {phone && (
                            <div style={{ fontSize: 11.5, color: "var(--text)", fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
                              <span style={{ color: "var(--text-mute)", fontSize: 11 }}>📞</span>
                              <span>{phone}</span>
                            </div>
                          )}
                          {(() => {
                            const addr = formatInvestmentAddress(c);
                            if (addr.primary === "—") return null;
                            return (
                              <div style={{ fontSize: 11.5, color: "var(--text-mute)", marginTop: 2, display: "flex", alignItems: "baseline", gap: 4, flexWrap: "wrap" }}>
                                <span style={{ color: "var(--accent)", fontWeight: 700, fontSize: 10 }}>
                                  📍 {addr.prefix ? addr.prefix.replace("ADRES ", "").replace(":", "") : "ADRES"}:
                                </span>
                                <span style={{ color: "var(--text)", fontWeight: 500 }}>{addr.primary}</span>
                                {addr.secondary && <span style={{ color: "var(--text-mute)" }}>({addr.secondary})</span>}
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "14px 16px",
                          fontSize: 13,
                          color: "var(--text)",
                          minWidth: 320,
                          maxWidth: 520,
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.45,
                        }}
                      >
                        {c.clientDescription || c.description || <em style={{ opacity: 0.5, color: "var(--text-mute)" }}>Brak opisu</em>}
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
                      <td style={{ padding: "14px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
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
      </>
      )}

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
