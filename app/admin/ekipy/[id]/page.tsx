"use client";

import { use, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
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
  User,
  Plus,
  X,
  FileText,
  BarChart3,
  Receipt,
  ExternalLink,
  CalendarDays,
  List,
  Key,
} from "lucide-react";
import UniversalCalendar from "@/app/admin/kalendarz/UniversalCalendar";

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
      <div className="p-8 text-center text-slate-500">
        <div className="animate-spin w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full mx-auto mb-2" />
        Ładowanie danych ekipy...
      </div>
    );
  }

  if (team === null) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200">
          Ekipa montażowa nie istnieje lub została usunięta.
        </div>
        <Link href="/admin/ekipy" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> Powrót do listy ekip
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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Back Link */}
      <Link
        href="/admin/ekipy"
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Powrót do listy ekip montażowych
      </Link>

      {/* Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-2xl shadow-sm flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: teamColor }}
            >
              <Wrench className="w-6 h-6" />
            </div>

            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900">{team.name}</h1>
                {team.isActive ? (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                    Aktywna
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-wider">
                    Nieaktywna
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 mt-1.5">
                <div className="flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                  <span>Kierownik: <strong>{team.leaderName || "Nie przypisano"}</strong></span>
                </div>

                {team.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <a href={`tel:${team.phone}`} className="font-semibold text-blue-600 hover:underline">
                      {team.phone}
                    </a>
                  </div>
                )}

                <div className="flex items-center gap-1.5 font-mono">
                  <Key className="w-3.5 h-3.5 text-slate-400" />
                  <span>PIN (apka): <strong className="text-slate-900 tracking-wider">{team.pin ? team.pin : "Brak PIN"}</strong></span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={openEdit}
            className="flex items-center gap-2 px-3.5 py-2 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors self-start md:self-auto cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edytuj ekipę
          </button>
        </div>

        {/* Quick KPI Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-slate-900">{teamOrders.length}</div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Wszystkie zlecenia</div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-blue-600">{upcomingOrders.length}</div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Nadchodzące montaże</div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-amber-600">{openComplaints.length}</div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Otwarte serwisy</div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-slate-900">{team.members?.length ?? 0}</div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Liczba monterów</div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-6">
        {[
          { key: "schedule", label: "Harmonogram prac", icon: Calendar, badge: scheduleItems.length },
          { key: "finanse", label: "Finanse", icon: BarChart3 },
          { key: "info", label: "Skład & Informacje", icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as Tab)}
              className={`flex items-center gap-2 py-3 border-b-2 text-xs font-semibold transition-colors cursor-pointer ${
                active
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.badge !== undefined && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}

      {/* TAB 1: SCHEDULE */}
      {activeTab === "schedule" && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Harmonogram prac i serwisów
              </h3>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setScheduleView("list")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                    scheduleView === "list"
                      ? "bg-white text-slate-900 shadow-sm font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  Lista prac
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleView("calendar")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                    scheduleView === "calendar"
                      ? "bg-white text-slate-900 shadow-sm font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  Kalendarz ekipy
                </button>
              </div>
            </div>

            {scheduleView === "calendar" ? (
              <div className="pt-2 min-h-[680px]">
                <UniversalCalendar initialTeamId={teamId} initialView="timeGridWeek" />
              </div>
            ) : scheduleItems.length === 0 ? (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-200 rounded-lg">
                Brak zaplanowanych montaży i serwisów dla tej ekipy.
              </div>
            ) : (
              <div className="space-y-3">
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
                      className={`p-4 border rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors ${
                        isDone
                          ? "bg-emerald-50/40 border-emerald-200/60"
                          : isFuture
                          ? "bg-white border-slate-200 hover:border-slate-300"
                          : "bg-slate-50/70 border-slate-200 opacity-75"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider flex-shrink-0 mt-0.5 ${
                            isDone
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : isMontaz
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {isDone
                            ? isMontaz
                              ? "✓ 🔧 Montaż"
                              : "✓ 🛠️ Serwis"
                            : isMontaz
                            ? "🔧 Montaż"
                            : "🛠️ Serwis"}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-sm ${isDone ? "text-slate-500 line-through" : "text-slate-900"}`}>
                              {item.title}
                            </span>
                            <span className="text-xs text-slate-500">({item.clientName})</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-semibold text-slate-800">{formatDate(item.date)}</span>
                            </div>

                            {item.timeStr && (
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span className="font-medium text-slate-700">{item.timeStr}</span>
                              </div>
                            )}

                            {item.address && (
                              <div className="flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                <span>{item.address}</span>
                              </div>
                            )}

                            {item.phone && (
                              <div className="flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-slate-400" />
                                <a href={`tel:${item.phone}`} className="text-blue-600 hover:underline">
                                  {item.phone}
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-auto">
                        <button
                          type="button"
                          onClick={() => handleToggleDone(item)}
                          disabled={isUpdating}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            isDone
                              ? "bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300"
                              : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                          } ${isUpdating ? "opacity-50 cursor-wait" : ""}`}
                          title={isDone ? "Kliknij, aby cofnąć oznaczenie jako zrobione" : "Oznacz tę pracę jako wykonaną"}
                        >
                          {isUpdating ? (
                            <div className="animate-spin w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          {isDone ? "Zrobione ✓" : "Oznacz jako zrobione"}
                        </button>

                        <Link
                          href={item.href}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                          Przejdź <ChevronRight className="w-3.5 h-3.5" />
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


      {/* TAB 3: TEAM INFO */}
      {activeTab === "info" && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6 max-w-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-700" />
              Skład osobowy & Szczegóły ekipy
            </h3>
            <button
              onClick={openEdit}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 cursor-pointer flex items-center gap-1.5"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edytuj dane
            </button>
          </div>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <span className="text-slate-500 block">Kierownik:</span>
                <strong className="text-slate-900 text-sm">{team.leaderName || "Nie przypisano"}</strong>
              </div>

              <div>
                <span className="text-slate-500 block">Telefon kontaktowy:</span>
                <strong className="text-blue-600 text-sm">{team.phone || "Brak numeru"}</strong>
              </div>

              <div>
                <span className="text-slate-500 block">PIN (apka mobilna):</span>
                <strong className="text-slate-900 text-sm font-mono tracking-wider">
                  {team.pin ? `🔑 ${team.pin}` : "Brak PIN"}
                </strong>
              </div>
            </div>

            <div>
              <span className="text-slate-500 block mb-2 font-semibold">Monterzy w zespole:</span>
              {team.members && team.members.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {team.members.map((m, idx) => (
                    <span key={idx} className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg font-medium text-slate-800 shadow-xs">
                      👤 {m}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-slate-400 italic">Nie wprowadzono członków ekipy</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT TEAM MODAL */}
      {editingInfo && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-lg w-full space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Edytuj dane ekipy montażowej</h3>
              <button
                onClick={() => setEditingInfo(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveInfo} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nazwa ekipy <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-slate-400 focus:bg-white text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Kolor ekipy w kalendarzu
                </label>
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg border border-slate-300 flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`w-6 h-6 rounded-full border transition-transform cursor-pointer ${
                          color === c ? "scale-110 border-slate-900 shadow-sm" : "border-transparent opacity-80 hover:opacity-100"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Kierownik ekipy</label>
                  <input
                    type="text"
                    value={leaderName}
                    onChange={(e) => setLeaderName(e.target.value)}
                    placeholder="np. Jan Kowalski"
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-slate-400 focus:bg-white text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Telefon kontaktowy</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="np. +48 600 000 000"
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-slate-400 focus:bg-white text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  PIN do aplikacji mobilnej (4 cyfry)
                </label>
                <input
                  type="text"
                  value={pin}
                  maxLength={4}
                  pattern="[0-9]*"
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="np. 1234"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-slate-400 focus:bg-white text-slate-800 font-mono tracking-widest"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Członkowie ekipy (oddzieleni przecinkami)
                </label>
                <input
                  type="text"
                  value={membersText}
                  onChange={(e) => setMembersText(e.target.value)}
                  placeholder="np. Piotr Nowak, Adam Wiśniewski"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-slate-400 focus:bg-white text-slate-800"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="modalInfoIsActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <label htmlFor="modalInfoIsActive" className="text-xs font-medium text-slate-700 cursor-pointer">
                  Ekipa aktywna (widoczna na listach wyboru przy zleceniach i kalendarzu)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingInfo(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {saving ? "Zapisywanie..." : "Zapisz zmiany"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 5: FINANSE */}
      {activeTab === "finanse" && (
        <div className="space-y-5">
          {teamFinancials === undefined ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
              <div className="animate-spin w-5 h-5 border-2 border-slate-300 border-t-slate-700 rounded-full mr-3" />
              Ładowanie danych finansowych...
            </div>
          ) : (
            <>
              {/* Monthly breakdown — główna sekcja */}
              {teamFinancials.monthlyBreakdown.length > 0 ? (() => {
                const maxVal = Math.max(...teamFinancials.monthlyBreakdown.map((m) => m.expenses), 1);
                const reversed = [...teamFinancials.monthlyBreakdown].reverse();
                return (
                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-5 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        Koszty miesiąc po miesiącu
                      </h3>
                      <span className="text-xs text-slate-400">
                        {teamFinancials.monthlyBreakdown.length} {teamFinancials.monthlyBreakdown.length === 1 ? "miesiąc" : "miesięcy"}
                      </span>
                    </div>

                    {/* Line chart */}
                    <div className="px-2 pt-4 pb-2">
                      <ResponsiveContainer width="100%" height={210}>
                        <AreaChart
                          data={teamFinancials.monthlyBreakdown.map((m) => ({
                            name: monthLabel(m.month),
                            koszty: m.expenses,
                            bilans: m.earnings,
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
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 11, fill: "#94a3b8" }}
                            axisLine={false}
                            tickLine={false}
                            dy={6}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: "#94a3b8" }}
                            axisLine={false}
                            tickLine={false}
                            width={60}
                            tickFormatter={(v: number) =>
                              v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`
                            }
                          />
                          <Tooltip
                            contentStyle={{
                              fontSize: 12,
                              borderRadius: 10,
                              border: "1px solid #e2e8f0",
                              boxShadow: "0 4px 12px rgba(0,0,0,0.07)",
                            }}
                            formatter={(value, name) => [
                              `${(value as number).toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł`,
                              (name as string) === "koszty" ? "Koszty netto" : "Bilans ze zleceń",
                            ]}
                            labelStyle={{ fontWeight: 700, color: "#1e293b", marginBottom: 4 }}
                          />
                          <Area
                            type="monotone"
                            dataKey="koszty"
                            stroke="#f87171"
                            strokeWidth={2.5}
                            fill="url(#colorKoszty)"
                            dot={{ r: 4, fill: "#f87171", strokeWidth: 2, stroke: "#fff" }}
                            activeDot={{ r: 6, fill: "#ef4444", stroke: "#fff", strokeWidth: 2 }}
                            name="koszty"
                          />
                          <Area
                            type="monotone"
                            dataKey="bilans"
                            stroke="#10b981"
                            strokeWidth={2.5}
                            fill="url(#colorBilans)"
                            dot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }}
                            activeDot={{ r: 6, fill: "#059669", stroke: "#fff", strokeWidth: 2 }}
                            strokeDasharray="5 3"
                            name="bilans"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                      {/* Legenda */}
                      <div className="flex items-center justify-center gap-6 pt-1 pb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block w-6 h-0.5 bg-red-400 rounded-full" />
                          <span className="text-xs text-slate-500 font-medium">Koszty netto</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block w-6 border-t-2 border-dashed border-emerald-400 rounded-full" />
                          <span className="text-xs text-slate-500 font-medium">Bilans ze zleceń</span>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto border-t border-slate-100">
                      <table className="w-full text-sm min-w-[560px]">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/60">
                            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Miesiąc</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Koszty netto</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Koszty brutto</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-emerald-600 uppercase tracking-wider">Bilans ze zleceń</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Faktury</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">vs poprz.</th>
                            <th className="px-4 py-3 w-40" />
                          </tr>
                        </thead>
                        <tbody>
                          {reversed.map((row) => {
                            const mom = row.momChange;
                            const momUp = mom !== null && mom > 0;
                            const momDown = mom !== null && mom < 0;
                            const barPct = Math.round((row.expenses / maxVal) * 100);
                            return (
                              <tr key={row.month} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                <td className="px-5 py-3.5 font-bold text-slate-800 whitespace-nowrap">
                                  {monthLabel(row.month)}
                                </td>
                                <td className="px-4 py-3.5 text-right font-semibold text-slate-800 tabular-nums whitespace-nowrap">
                                  {fmt(row.expenses)} zł
                                </td>
                                <td className="px-4 py-3.5 text-right text-slate-500 tabular-nums whitespace-nowrap text-xs">
                                  {fmt(row.expensesGross)} zł
                                </td>
                                <td className="px-4 py-3.5 text-right font-semibold text-emerald-600 tabular-nums whitespace-nowrap">
                                  {row.earnings > 0 ? `${fmt(row.earnings)} zł` : <span className="text-slate-300 font-normal">—</span>}
                                </td>
                                <td className="px-4 py-3.5 text-right tabular-nums">
                                  <span className="inline-flex items-center justify-center min-w-[1.5rem] px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-600 rounded-full">
                                    {row.count}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5 text-right tabular-nums whitespace-nowrap">
                                  {mom === null ? (
                                    <span className="text-slate-300 text-xs">—</span>
                                  ) : (
                                    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
                                      momUp
                                        ? "bg-red-50 text-red-600"
                                        : momDown
                                        ? "bg-emerald-50 text-emerald-600"
                                        : "bg-slate-100 text-slate-500"
                                    }`}>
                                      {momUp ? "▲" : momDown ? "▼" : "="}
                                      {Math.abs(mom).toFixed(0)}%
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3.5">
                                  <div className="flex items-center gap-2">
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex-1 max-w-[120px]">
                                      <div
                                        className="h-full bg-red-400 rounded-full transition-all"
                                        style={{ width: `${barPct}%` }}
                                      />
                                    </div>
                                    <span className="text-[10px] text-slate-400 tabular-nums w-8 text-right">{barPct}%</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50 border-t-2 border-slate-200">
                            <td className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Łącznie</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-800 tabular-nums">{fmt(teamFinancials.totalExpensesNet)} zł</td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-500 tabular-nums text-xs">{fmt(teamFinancials.totalExpensesGross)} zł</td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-600 tabular-nums">
                              {teamFinancials.totalEarnings > 0 ? `${fmt(teamFinancials.totalEarnings)} zł` : "—"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="inline-flex items-center justify-center min-w-[1.5rem] px-2 py-0.5 text-xs font-bold bg-slate-200 text-slate-700 rounded-full">
                                {teamFinancials.expensesCount}
                              </span>
                            </td>
                            <td colSpan={2} />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })() : null}

              {/* Recent expenses */}
              {teamFinancials.recentExpenses.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-slate-400" />
                      Ostatnie wydatki montażowe
                    </h3>
                    <span className="text-xs text-slate-400">{teamFinancials.expensesCount} łącznie</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[480px]">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/60">
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Dokument / Dostawca</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kwota netto</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kwota brutto</th>
                          <th className="px-4 py-2.5" />
                        </tr>
                      </thead>
                      <tbody>
                        {teamFinancials.recentExpenses.map((e) => (
                          <tr key={e._id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-800 truncate max-w-[220px]">{e.number ?? e.sellerName ?? "—"}</p>
                              {e.sellerName && e.number && (
                                <p className="text-xs text-slate-400 truncate max-w-[220px]">{e.sellerName}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{e.issueDate ?? "—"}</td>
                            <td className="px-4 py-3 text-right font-medium text-slate-700 tabular-nums whitespace-nowrap">
                              {e.netAmount != null ? `${fmt(e.netAmount)} zł` : "—"}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-500 tabular-nums whitespace-nowrap">
                              {e.grossAmount != null ? `${fmt(e.grossAmount)} zł` : "—"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {e.clientId && e.orderId ? (
                                <Link
                                  href={`/admin/klient/${e.clientId}/zlecenie/${e.orderId}`}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors whitespace-nowrap"
                                  title={e.orderName ?? "Przejdź do zlecenia"}
                                >
                                  {e.orderName ? (
                                    <span className="truncate max-w-[120px]">{e.orderName}</span>
                                  ) : (
                                    "Zlecenie"
                                  )}
                                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                </Link>
                              ) : (
                                <span className="text-slate-300 text-xs">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {teamFinancials.expensesCount > 20 && (
                    <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400 text-right">
                      Pokazano 20 z {teamFinancials.expensesCount} wydatków
                    </div>
                  )}
                </div>
              )}

              {teamFinancials.monthlyBreakdown.length === 0 && teamFinancials.recentExpenses.length === 0 && (
                <div className="bg-white border border-dashed border-slate-200 rounded-xl py-12 text-center text-slate-400 text-sm">
                  Brak danych finansowych dla tej ekipy.<br />
                  <span className="text-xs mt-1 block">Przypisz wydatki z kategorią „Montaż“ do tej ekipy w szczegółach zlecenia.</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
