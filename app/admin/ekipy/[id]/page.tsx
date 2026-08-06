"use client";

import { use, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
  Line,
} from "recharts";
import {
  Wrench,
  ArrowLeft,
  Calendar,
  Users,
  Phone,
  UserCheck,
  CheckCircle2,
  Clock,
  MapPin,
  Pencil,
  ChevronRight,
  X,
  BarChart3,
  Receipt,
  ExternalLink,
  CalendarDays,
  List,
  Key,
} from "lucide-react";
import UniversalCalendar from "@/app/admin/kalendarz/UniversalCalendar";
import { CrmPageHeader } from "@/components/crm-ui";

const PRESET_COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899",
  "#ef4444", "#06b6d4", "#84cc16", "#f97316", "#64748b",
];

type Tab = "schedule" | "finanse" | "info";

function fmt(val: number) {
  return val.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function monthLabel(month: string) {
  const [y, m] = month.split("-");
  const names = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];
  return `${names[parseInt(m, 10) - 1]} ${y}`;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTimeRange(serviceDate?: number, serviceDateEnd?: number) {
  if (!serviceDate) return null;
  const dStart = new Date(serviceDate);
  const startStr = `${String(dStart.getHours()).padStart(2, "0")}:${String(dStart.getMinutes()).padStart(2, "0")}`;
  if (serviceDateEnd) {
    const dEnd = new Date(serviceDateEnd);
    const endStr = `${String(dEnd.getHours()).padStart(2, "0")}:${String(dEnd.getMinutes()).padStart(2, "0")}`;
    return `${startStr} – ${endStr}`;
  }
  if (dStart.getHours() !== 0 || dStart.getMinutes() !== 0) {
    return startStr;
  }
  return null;
}

export default function EkipaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const teamId = resolvedParams.id as Id<"installationTeams">;

  const team = useQuery(api.installationTeams.getById, { id: teamId });
  const teamOrders = useQuery(api.installationTeams.getTeamOrders, { teamId }) ?? [];
  const teamComplaints = useQuery(api.installationTeams.getTeamComplaints, { teamId }) ?? [];
  const teamFinancials = useQuery(api.installationTeams.getTeamFinancials, { teamId });
  const updateTeam = useMutation(api.installationTeams.update);
  const changeOrderStatus = useMutation(api.orders.changeStatus);
  const updateComplaintStatus = useMutation(api.complaints.updateStatus);

  const [activeTab, setActiveTab] = useState<Tab>("schedule");
  const [scheduleView, setScheduleView] = useState<"list" | "calendar">("list");
  const [editingInfo, setEditingInfo] = useState(false);
  const [updatingScheduleId, setUpdatingScheduleId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [leaderName, setLeaderName] = useState("");
  const [phone, setPhone] = useState("");
  const [color, setColor] = useState("#10b981");
  const [membersText, setMembersText] = useState("");
  const [pin, setPin] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  if (team === undefined) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "var(--text-mute)" }}>
        <div style={{ width: 24, height: 24, border: "2px solid var(--text-mute)", borderTopColor: "transparent", borderRadius: "50%", margin: "0 auto 12px", animation: "spin 1s linear infinite" }} />
        Ładowanie danych ekipy...
      </div>
    );
  }

  if (team === null) {
    return (
      <div style={{ padding: 32, maxWidth: 500, margin: "0 auto", textAlign: "center", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: "#fef2f2", color: "#b91c1c", padding: 16, borderRadius: 12, border: "1px solid #fecaca", fontSize: 13, fontWeight: 500 }}>
          Ekipa montażowa nie istnieje lub została usunięta.
        </div>
        <Link href="/admin/ekipy" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--text-strong)", textDecoration: "none", margin: "0 auto" }}>
          <ArrowLeft style={{ width: 16, height: 16 }} /> Powrót do listy ekip
        </Link>
      </div>
    );
  }

  const openEdit = () => {
    setName(team.name);
    setLeaderName(team.leaderName ?? "");
    setPhone(team.phone ?? "");
    setColor(team.color ?? "#10b981");
    setMembersText(team.members ? team.members.join(", ") : "");
    setPin(team.pin ?? "");
    setIsActive(team.isActive);
    setEditingInfo(true);
  };

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pin.trim();
    if (cleanPin && !/^\d{4}$/.test(cleanPin)) {
      alert("PIN do aplikacji mobilnej musi składać się z 4 cyfr.");
      return;
    }
    setSaving(true);
    try {
      const members = membersText
        ? membersText.split(",").map((m) => m.trim()).filter(Boolean)
        : undefined;

      await updateTeam({
        id: teamId,
        name: name.trim(),
        color,
        leaderName: leaderName.trim() || undefined,
        phone: phone.trim() || undefined,
        members,
        pin: cleanPin || undefined,
        isActive,
      });
      setEditingInfo(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Błąd edycji ekipy.");
    } finally {
      setSaving(false);
    }
  };

  const teamColor = team.color ?? "#10b981";
  const openComplaints = teamComplaints.filter((c) => c.status !== "rozwiazana" && c.status !== "zamknieta");
  const upcomingOrders = teamOrders.filter((o) => o.projectEndDate && o.projectEndDate >= Date.now());

  // Combined Schedule (Installations + Services) sorted by date
  const scheduleItems = [
    ...teamOrders
      .filter((o) => o.projectEndDate)
      .map((o) => ({
        type: "montaz" as const,
        id: o._id,
        date: o.projectEndDate!,
        timeStr: o.installationStartDate
          ? `${Math.floor(o.installationStartDate / 60).toString().padStart(2, "0")}:${(o.installationStartDate % 60).toString().padStart(2, "0")}`
          : undefined,
        title: o.name,
        clientName: o.clientName,
        address: o.clientAddress,
        phone: o.clientPhone,
        status: o.status,
        href: `/admin/klient/${o.clientId}/zlecenie/${o._id}`,
      })),
    ...teamComplaints
      .filter((c) => c.serviceDate)
      .map((c) => ({
        type: "serwis" as const,
        id: c._id,
        date: c.serviceDate!,
        timeStr: formatTimeRange(c.serviceDate, c.serviceDateEnd),
        title: `Serwis: ${c.orderName}`,
        clientName: c.clientName,
        address: undefined,
        phone: undefined,
        status: c.status,
        href: c.orderId ? `/admin/klient/${c.clientId}/zlecenie/${c.orderId}` : `/admin/reklamacje`,
      })),
  ].sort((a, b) => a.date - b.date);

  const handleToggleDone = async (item: typeof scheduleItems[0]) => {
    setUpdatingScheduleId(item.id);
    try {
      if (item.type === "montaz") {
        const isDone = item.status === "completed";
        await changeOrderStatus({
          orderId: item.id as Id<"orders">,
          newStatus: isDone ? "installation" : "completed",
        });
      } else {
        const isDone =
          item.status === "rozwiazana" ||
          item.status === "zamknieta" ||
          item.status === "zakonczona";
        await updateComplaintStatus({
          complaintId: item.id as Id<"complaints">,
          status: isDone ? "w_toku" : "rozwiazana",
        });
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Błąd zmiany statusu.");
    } finally {
      setUpdatingScheduleId(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Back Link */}
      <div>
        <Link
          href="/admin/ekipy"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5,
            fontWeight: 600, color: "var(--text-mute)", textDecoration: "none",
            transition: "color 0.15s",
          }}
        >
          <ArrowLeft style={{ width: 14, height: 14 }} /> Powrót do listy ekip montażowych
        </Link>
      </div>

      {/* Header Card */}
      <div style={{
        background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: 24,
        boxShadow: "0 1px 4px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", gap: 20,
      }}>
        <div style={{
          display: "flex", flexWrap: "wrap", alignItems: "center", justifyBetween: "space-between",
          gap: 16, borderBottom: "1px solid var(--line)", paddingBottom: 16, justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 48, height: 48, borderRadius: 14, boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
                fontWeight: 700, backgroundColor: teamColor, flexShrink: 0,
              }}
            >
              <Wrench style={{ width: 24, height: 24 }} />
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-strong)", margin: 0, letterSpacing: "-0.01em" }}>
                  {team.name}
                </h1>
                {team.isActive ? (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Aktywna
                  </span>
                ) : (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "var(--panel-2)", color: "var(--text-mute)", border: "1px solid var(--line)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Nieaktywna
                  </span>
                )}
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, fontSize: 12, color: "var(--text-mute)", marginTop: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <UserCheck style={{ width: 14, height: 14, color: "var(--text-mute)" }} />
                  <span>Kierownik: <strong style={{ color: "var(--text-strong)" }}>{team.leaderName || "Nie przypisano"}</strong></span>
                </div>

                {team.phone && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Phone style={{ width: 14, height: 14, color: "var(--text-mute)" }} />
                    <a href={`tel:${team.phone}`} style={{ fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}>
                      {team.phone}
                    </a>
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "monospace" }}>
                  <Key style={{ width: 14, height: 14, color: "var(--text-mute)" }} />
                  <span>PIN (apka): <strong style={{ color: "var(--text-strong)", letterSpacing: "0.1em" }}>{team.pin ? team.pin : "Brak PIN"}</strong></span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={openEdit}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px",
              border: "1px solid var(--line)", borderRadius: 8, fontSize: 12.5, fontWeight: 600,
              color: "var(--text-strong)", background: "var(--panel)", cursor: "pointer",
              transition: "border-color 0.15s, background 0.15s",
            }}
          >
            <Pencil style={{ width: 14, height: 14 }} />
            Edytuj ekipę
          </button>
        </div>

        {/* Quick KPI Stats Bar */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-strong)" }}>{teamOrders.length}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 2 }}>
              Wszystkie zlecenia
            </div>
          </div>

          <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#3b82f6" }}>{upcomingOrders.length}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 2 }}>
              Nadchodzące montaże
            </div>
          </div>

          <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: openComplaints.length ? "#f59e0b" : "var(--text-strong)" }}>{openComplaints.length}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 2 }}>
              Otwarte serwisy
            </div>
          </div>

          <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-strong)" }}>{team.members?.length ?? 0}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 2 }}>
              Liczba monterów
            </div>
          </div>
        </div>
      </div>

      {/* Page Header Tabs */}
      <CrmPageHeader
        title=""
        tabs={[
          { key: "schedule", label: "Harmonogram prac", count: scheduleItems.length },
          { key: "finanse", label: "Finanse" },
          { key: "info", label: "Skład & Informacje" },
        ]}
        activeTab={activeTab}
        onTab={(k) => setActiveTab(k as Tab)}
      />

      {/* Tab Content */}

      {/* TAB 1: SCHEDULE */}
      {activeTab === "schedule" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", borderBottom: "1px solid var(--line)", paddingBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <Calendar style={{ width: 16, height: 16, color: "var(--accent)" }} />
                Harmonogram prac i serwisów
              </h3>

              <div style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--panel)", padding: 4, borderRadius: 8, border: "1px solid var(--line)" }}>
                <button
                  type="button"
                  onClick={() => setScheduleView("list")}
                  style={{
                    padding: "4px 12px", fontSize: 12, fontWeight: scheduleView === "list" ? 700 : 500,
                    borderRadius: 6, border: "none", cursor: "pointer",
                    background: scheduleView === "list" ? "var(--card)" : "transparent",
                    color: scheduleView === "list" ? "var(--text-strong)" : "var(--text-mute)",
                    boxShadow: scheduleView === "list" ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                    display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
                  }}
                >
                  <List style={{ width: 14, height: 14 }} />
                  Lista prac
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleView("calendar")}
                  style={{
                    padding: "4px 12px", fontSize: 12, fontWeight: scheduleView === "calendar" ? 700 : 500,
                    borderRadius: 6, border: "none", cursor: "pointer",
                    background: scheduleView === "calendar" ? "var(--card)" : "transparent",
                    color: scheduleView === "calendar" ? "var(--text-strong)" : "var(--text-mute)",
                    boxShadow: scheduleView === "calendar" ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                    display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
                  }}
                >
                  <CalendarDays style={{ width: 14, height: 14 }} />
                  Kalendarz ekipy
                </button>
              </div>
            </div>

            {scheduleView === "calendar" ? (
              <div style={{ paddingTop: 8, minHeight: 680 }}>
                <UniversalCalendar initialTeamId={teamId} initialView="timeGridWeek" />
              </div>
            ) : scheduleItems.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center", color: "var(--text-mute)", border: "1px dashed var(--line)", borderRadius: 10 }}>
                Brak zaplanowanych montaży i serwisów dla tej ekipy.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {scheduleItems.map((item, idx) => {
                  const isMontaz = item.type === "montaz";
                  const isFuture = item.date >= Date.now();
                  const isDone = isMontaz
                    ? item.status === "completed"
                    : item.status === "rozwiazana" ||
                      item.status === "zamknieta" ||
                      item.status === "zakonczona";
                  const isUpdating = updatingScheduleId === item.id;

                  return (
                    <div
                      key={`${item.type}_${item.id}_${idx}`}
                      style={{
                        padding: 16, borderRadius: 10, border: "1px solid var(--line)",
                        display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between",
                        gap: 12, transition: "all 0.15s",
                        background: isDone
                          ? "rgba(16, 185, 129, 0.05)"
                          : isFuture
                          ? "var(--card)"
                          : "var(--panel)",
                        opacity: !isFuture && !isDone ? 0.75 : 1,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            padding: "3px 8px", borderRadius: 6, fontSize: 10.5, fontWeight: 700,
                            textTransform: "uppercase", letterSpacing: "0.04em", flexShrink: 0, marginTop: 2,
                            background: isDone ? "#ecfdf5" : isMontaz ? "#eff6ff" : "#fffbeb",
                            color: isDone ? "#047857" : isMontaz ? "#1d4ed8" : "#b45309",
                            border: `1px solid ${isDone ? "#a7f3d0" : isMontaz ? "#bfdbfe" : "#fde68a"}`,
                          }}
                        >
                          {isDone
                            ? isMontaz
                              ? "✓ 🔧 Montaż"
                              : "✓ 🛠️ Serwis"
                            : isMontaz
                            ? "🔧 Montaż"
                            : "🛠️ Serwis"}
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{
                              fontWeight: 700, fontSize: 14, color: "var(--text-strong)",
                              textDecoration: isDone ? "line-through" : "none", opacity: isDone ? 0.6 : 1,
                            }}>
                              {item.title}
                            </span>
                            <span style={{ fontSize: 12, color: "var(--text-mute)" }}>({item.clientName})</span>
                          </div>

                          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14, fontSize: 12, color: "var(--text-mute)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <Calendar style={{ width: 14, height: 14, color: "var(--text-mute)" }} />
                              <span style={{ fontWeight: 600, color: "var(--text-strong)" }}>{formatDate(item.date)}</span>
                            </div>

                            {item.timeStr && (
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <Clock style={{ width: 14, height: 14, color: "var(--text-mute)" }} />
                                <span style={{ fontWeight: 500, color: "var(--text-strong)" }}>{item.timeStr}</span>
                              </div>
                            )}

                            {item.address && (
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <MapPin style={{ width: 14, height: 14, color: "var(--text-mute)" }} />
                                <span>{item.address}</span>
                              </div>
                            )}

                            {item.phone && (
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <Phone style={{ width: 14, height: 14, color: "var(--text-mute)" }} />
                                <a href={`tel:${item.phone}`} style={{ color: "var(--accent)", textDecoration: "none" }}>
                                  {item.phone}
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => handleToggleDone(item)}
                          disabled={isUpdating}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                            cursor: isUpdating ? "wait" : "pointer", transition: "all 0.15s",
                            background: isDone ? "#ecfdf5" : "#10b981",
                            color: isDone ? "#047857" : "#ffffff",
                            border: isDone ? "1px solid #a7f3d0" : "none",
                            opacity: isUpdating ? 0.6 : 1,
                          }}
                          title={isDone ? "Kliknij, aby cofnąć oznaczenie jako zrobione" : "Oznacz tę pracę jako wykonaną"}
                        >
                          <CheckCircle2 style={{ width: 14, height: 14 }} />
                          {isDone ? "Zrobione ✓" : "Oznacz jako zrobione"}
                        </button>

                        <Link
                          href={item.href}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "6px 12px", background: "var(--panel)", border: "1px solid var(--line)",
                            borderRadius: 8, fontSize: 12, fontWeight: 600, color: "var(--text-strong)",
                            textDecoration: "none", transition: "border-color 0.15s",
                          }}
                        >
                          Przejdź <ChevronRight style={{ width: 14, height: 14 }} />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: FINANSE */}
      {activeTab === "finanse" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {teamFinancials === undefined ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--text-mute)" }}>
              Ładowanie danych finansowych...
            </div>
          ) : (
            <>
              {teamFinancials.monthlyBreakdown.length > 0 ? (() => {
                const maxVal = Math.max(...teamFinancials.monthlyBreakdown.map((m) => m.expenses), 1);
                const reversed = [...teamFinancials.monthlyBreakdown].reverse();
                return (
                  <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                    <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                        <Calendar style={{ width: 16, height: 16, color: "var(--text-mute)" }} />
                        Koszty i montaże miesiąc po miesiącu
                      </h3>
                      
                      <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 11.5, fontWeight: 600 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f87171" }} />
                          <span style={{ color: "var(--text-mute)" }}>Koszty netto</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
                          <span style={{ color: "var(--text-mute)" }}>Bilans ze zleceń</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6" }} />
                          <span style={{ color: "var(--text-strong)", fontWeight: 700 }}>Liczba montaży</span>
                        </div>
                      </div>
                    </div>

                    {/* Chart */}
                    <div style={{ padding: "16px 12px 8px" }}>
                      <ResponsiveContainer width="100%" height={230}>
                        <ComposedChart
                          data={teamFinancials.monthlyBreakdown.map((m) => ({
                            name: monthLabel(m.month),
                            koszty: m.expenses,
                            bilans: m.earnings,
                            montaze: m.installationsCount ?? 0,
                          }))}
                          margin={{ top: 8, right: 20, left: 10, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="colorKoszty" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f87171" stopOpacity={0.15} />
                              <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorBilans" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#34d399" stopOpacity={0.15} />
                              <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--text-mute)" }} axisLine={false} tickLine={false} dy={6} />
                          <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "var(--text-mute)" }} axisLine={false} tickLine={false} width={60} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#2563eb", fontWeight: 700 }} axisLine={false} tickLine={false} width={35} allowDecimals={false} unit=" szt." />
                          <Tooltip
                            contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid var(--line)", background: "var(--card)", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                            formatter={(value, name) => [
                              (name as string) === "montaze"
                                ? `${value} montaż(y)`
                                : `${(value as number).toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł`,
                              (name as string) === "koszty"
                                ? "Koszty netto"
                                : (name as string) === "bilans"
                                ? "Bilans ze zleceń"
                                : "Liczba montaży",
                            ]}
                            labelStyle={{ fontWeight: 700, color: "var(--text-strong)", marginBottom: 4 }}
                          />
                          <Area yAxisId="left" type="monotone" dataKey="koszty" stroke="#f87171" strokeWidth={2.5} fill="url(#colorKoszty)" dot={{ r: 4, fill: "#f87171", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6, fill: "#ef4444", stroke: "#fff", strokeWidth: 2 }} name="koszty" />
                          <Area yAxisId="left" type="monotone" dataKey="bilans" stroke="#10b981" strokeWidth={2.5} fill="url(#colorBilans)" dot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6, fill: "#059669", stroke: "#fff", strokeWidth: 2 }} strokeDasharray="5 3" name="bilans" />
                          <Line yAxisId="right" type="monotone" dataKey="montaze" stroke="#3b82f6" strokeWidth={3} dot={{ r: 5, fill: "#3b82f6", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 7, fill: "#1d4ed8", stroke: "#fff", strokeWidth: 2 }} name="montaze" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>

                    <div style={{ overflowX: "auto", borderTop: "1px solid var(--line)" }}>
                      <table style={{ width: "100%", textLeft: "left", fontSize: 12.5, borderCollapse: "collapse", minWidth: 620 }}>
                        <thead>
                          <tr style={{ background: "var(--panel)", borderBottom: "1px solid var(--line)", color: "var(--text-mute)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                            <th style={{ padding: "10px 20px", textAlign: "left" }}>Miesiąc</th>
                            <th style={{ padding: "10px 16px", textAlign: "right", color: "#2563eb" }}>Montaże</th>
                            <th style={{ padding: "10px 16px", textAlign: "right" }}>Koszty netto</th>
                            <th style={{ padding: "10px 16px", textAlign: "right" }}>Koszty brutto</th>
                            <th style={{ padding: "10px 16px", textAlign: "right", color: "#10b981" }}>Bilans ze zleceń</th>
                            <th style={{ padding: "10px 16px", textAlign: "right" }}>Faktury</th>
                            <th style={{ padding: "10px 16px", textAlign: "right" }}>vs poprz.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reversed.map((row) => {
                            const mom = row.momChange;
                            const momUp = mom !== null && mom > 0;
                            const momDown = mom !== null && mom < 0;
                            return (
                              <tr key={row.month} style={{ borderBottom: "1px solid var(--line)" }}>
                                <td style={{ padding: "12px 20px", fontWeight: 700, color: "var(--text-strong)" }}>
                                  {monthLabel(row.month)}
                                </td>
                                <td style={{ padding: "12px 16px", textAlign: "right" }}>
                                  <span style={{ display: "inline-flex", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" }}>
                                    🛠️ {row.installationsCount ?? 0}
                                  </span>
                                </td>
                                <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "var(--text-strong)" }}>
                                  {fmt(row.expenses)} zł
                                </td>
                                <td style={{ padding: "12px 16px", textAlign: "right", color: "var(--text-mute)" }}>
                                  {fmt(row.expensesGross)} zł
                                </td>
                                <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: "#10b981" }}>
                                  {row.earnings > 0 ? `${fmt(row.earnings)} zł` : <span style={{ color: "var(--text-mute)", fontWeight: 400 }}>—</span>}
                                </td>
                                <td style={{ padding: "12px 16px", textAlign: "right" }}>
                                  <span style={{ display: "inline-flex", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "var(--panel-2)", color: "var(--text-strong)" }}>
                                    {row.count}
                                  </span>
                                </td>
                                <td style={{ padding: "12px 16px", textAlign: "right" }}>
                                  {mom === null ? (
                                    <span style={{ color: "var(--text-mute)" }}>—</span>
                                  ) : (
                                    <span style={{
                                      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                                      background: momUp ? "#fef2f2" : momDown ? "#ecfdf5" : "var(--panel)",
                                      color: momUp ? "#ef4444" : momDown ? "#10b981" : "var(--text-mute)",
                                    }}>
                                      {momUp ? "▲" : momDown ? "▼" : "="} {Math.abs(mom).toFixed(0)}%
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })() : null}

              {/* Recent Expenses Table */}
              {teamFinancials.recentExpenses.length > 0 && (
                <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                      <Receipt style={{ width: 16, height: 16, color: "var(--text-mute)" }} />
                      Ostatnie wydatki montażowe
                    </h3>
                    <span style={{ fontSize: 12, color: "var(--text-mute)" }}>{teamFinancials.expensesCount} łącznie</span>
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", textLeft: "left", fontSize: 12.5, borderCollapse: "collapse", minWidth: 480 }}>
                      <thead>
                        <tr style={{ background: "var(--panel)", borderBottom: "1px solid var(--line)", color: "var(--text-mute)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          <th style={{ padding: "10px 20px", textAlign: "left" }}>Dokument / Dostawca</th>
                          <th style={{ padding: "10px 16px", textAlign: "left" }}>Data</th>
                          <th style={{ padding: "10px 16px", textAlign: "right" }}>Kwota netto</th>
                          <th style={{ padding: "10px 16px", textAlign: "right" }}>Kwota brutto</th>
                          <th style={{ padding: "10px 20px", textAlign: "right" }}>Akcja</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamFinancials.recentExpenses.map((e) => (
                          <tr key={e._id} style={{ borderBottom: "1px solid var(--line)" }}>
                            <td style={{ padding: "12px 20px" }}>
                              <p style={{ fontWeight: 600, color: "var(--text-strong)", margin: 0 }}>{e.number ?? e.sellerName ?? "—"}</p>
                              {e.sellerName && e.number && (
                                <p style={{ fontSize: 11, color: "var(--text-mute)", margin: "2px 0 0" }}>{e.sellerName}</p>
                              )}
                            </td>
                            <td style={{ padding: "12px 16px", color: "var(--text-mute)" }}>{e.issueDate ?? "—"}</td>
                            <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "var(--text-strong)" }}>
                              {e.netAmount != null ? `${fmt(e.netAmount)} zł` : "—"}
                            </td>
                            <td style={{ padding: "12px 16px", textAlign: "right", color: "var(--text-mute)" }}>
                              {e.grossAmount != null ? `${fmt(e.grossAmount)} zł` : "—"}
                            </td>
                            <td style={{ padding: "12px 20px", textAlign: "right" }}>
                              {e.clientId && e.orderId ? (
                                <Link
                                  href={`/admin/klient/${e.clientId}/zlecenie/${e.orderId}`}
                                  style={{
                                    display: "inline-flex", alignItems: "center", gap: 4,
                                    fontSize: 12, fontWeight: 600, color: "var(--accent)", textDecoration: "none",
                                  }}
                                >
                                  Zlecenie <ExternalLink style={{ width: 13, height: 13 }} />
                                </Link>
                              ) : (
                                <span style={{ color: "var(--text-mute)", fontSize: 12 }}>—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {teamFinancials.monthlyBreakdown.length === 0 && teamFinancials.recentExpenses.length === 0 && (
                <div style={{
                  background: "var(--card)", border: "1px dashed var(--line)", borderRadius: 12, padding: "48px 24px",
                  textAlign: "center", color: "var(--text-mute)", fontSize: 13,
                }}>
                  Brak danych finansowych dla tej ekipy.<br />
                  <span style={{ fontSize: 11.5, marginTop: 4, display: "block" }}>Przypisz wydatki z kategorią „Montaż” do tej ekipy w szczegółach zlecenia.</span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 3: TEAM INFO */}
      {activeTab === "info" && (
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", gap: 20, maxWidth: 640 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <Users style={{ width: 16, height: 16, color: "var(--text-mute)" }} />
              Skład osobowy & Szczegóły ekipy
            </h3>
            <button
              onClick={openEdit}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px",
                borderRadius: 8, fontSize: 12, fontWeight: 600, background: "var(--panel)",
                color: "var(--text-strong)", border: "1px solid var(--line)", cursor: "pointer",
              }}
            >
              <Pencil style={{ width: 14, height: 14 }} />
              Edytuj dane
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, fontSize: 12.5 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, background: "var(--panel)", padding: 16, borderRadius: 10, border: "1px solid var(--line)" }}>
              <div>
                <span style={{ color: "var(--text-mute)", display: "block", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>Kierownik</span>
                <strong style={{ color: "var(--text-strong)", fontSize: 14 }}>{team.leaderName || "Nie przypisano"}</strong>
              </div>

              <div>
                <span style={{ color: "var(--text-mute)", display: "block", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>Telefon</span>
                <strong style={{ color: "var(--accent)", fontSize: 14 }}>{team.phone || "Brak numeru"}</strong>
              </div>

              <div>
                <span style={{ color: "var(--text-mute)", display: "block", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>PIN (apka)</span>
                <strong style={{ color: "var(--text-strong)", fontSize: 14, fontFamily: "monospace", letterSpacing: "0.1em" }}>
                  {team.pin ? team.pin : "Brak PIN"}
                </strong>
              </div>
            </div>

            <div>
              <span style={{ color: "var(--text-strong)", display: "block", marginBottom: 8, fontWeight: 700 }}>Monterzy w zespole:</span>
              {team.members && team.members.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {team.members.map((m, idx) => (
                    <span key={idx} style={{ background: "var(--card)", border: "1px solid var(--line)", padding: "6px 12px", borderRadius: 8, fontWeight: 600, color: "var(--text-strong)" }}>
                      👤 {m}
                    </span>
                  ))}
                </div>
              ) : (
                <span style={{ color: "var(--text-mute)", fontStyle: "italic" }}>Nie wprowadzono członków ekipy</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT TEAM MODAL */}
      {editingInfo && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", backdropFilter: "blur(2px)",
          zIndex: 99, display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div style={{
            background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: 24,
            width: "100%", maxWidth: 520, boxShadow: "0 12px 36px rgba(0,0,0,0.18)",
            display: "flex", flexDirection: "column", gap: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
                Edytuj dane ekipy montażowej
              </h3>
              <button
                onClick={() => setEditingInfo(false)}
                style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-mute)", padding: 4 }}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <form onSubmit={handleSaveInfo} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>
                  Nazwa ekipy <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={{
                    width: "100%", padding: "8px 12px", fontSize: 12.5, borderRadius: 8,
                    border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text-strong)", outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>
                  Kolor ekipy w kalendarzu
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--line)", backgroundColor: color, flexShrink: 0 }}
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        style={{
                          width: 24, height: 24, borderRadius: "50%", border: color === c ? "2px solid var(--text-strong)" : "1px solid transparent",
                          backgroundColor: c, cursor: "pointer", transition: "transform 0.1s",
                          transform: color === c ? "scale(1.15)" : "scale(1)",
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>Kierownik ekipy</label>
                  <input
                    type="text"
                    value={leaderName}
                    onChange={(e) => setLeaderName(e.target.value)}
                    placeholder="np. Jan Kowalski"
                    style={{
                      width: "100%", padding: "8px 12px", fontSize: 12.5, borderRadius: 8,
                      border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text-strong)", outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>Telefon kontaktowy</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="np. +48 600 000 000"
                    style={{
                      width: "100%", padding: "8px 12px", fontSize: 12.5, borderRadius: 8,
                      border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text-strong)", outline: "none",
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>
                  PIN do aplikacji mobilnej (4 cyfry)
                </label>
                <input
                  type="text"
                  value={pin}
                  maxLength={4}
                  pattern="[0-9]*"
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="np. 1234"
                  style={{
                    width: "100%", padding: "8px 12px", fontSize: 12.5, borderRadius: 8,
                    border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text-strong)", outline: "none",
                    fontFamily: "monospace", letterSpacing: "0.2em",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>
                  Członkowie ekipy (oddzieleni przecinkami)
                </label>
                <input
                  type="text"
                  value={membersText}
                  onChange={(e) => setMembersText(e.target.value)}
                  placeholder="np. Piotr Nowak, Adam Wiśniewski"
                  style={{
                    width: "100%", padding: "8px 12px", fontSize: 12.5, borderRadius: 8,
                    border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text-strong)", outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 4 }}>
                <input
                  type="checkbox"
                  id="modalInfoIsActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ cursor: "pointer" }}
                />
                <label htmlFor="modalInfoIsActive" style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-strong)", cursor: "pointer" }}>
                  Ekipa aktywna (widoczna na listach wyboru przy zleceniach i kalendarzu)
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 14, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setEditingInfo(false)}
                  style={{
                    padding: "8px 16px", fontSize: 12.5, fontWeight: 600, color: "var(--text-mute)",
                    background: "none", border: "none", cursor: "pointer", borderRadius: 8,
                  }}
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn primary"
                  style={{
                    padding: "8px 20px", fontSize: 12.5, fontWeight: 600, borderRadius: 8,
                    cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? "Zapisywanie..." : "Zapisz zmiany"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
