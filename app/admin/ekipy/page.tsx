"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import {
  Wrench,
  Plus,
  Pencil,
  Trash2,
  Users,
  Phone,
  UserCheck,
  ChevronRight,
  ClipboardList,
  AlertTriangle,
  Calendar,
  Search,
  X,
  CheckCircle2,
  Key,
} from "lucide-react";

const PRESET_COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899",
  "#ef4444", "#06b6d4", "#84cc16", "#f97316", "#64748b",
];

interface TeamFormData {
  name: string;
  color: string;
  leaderName: string;
  phone: string;
  membersText: string;
  pin: string;
  isActive: boolean;
}

const defaultForm = (): TeamFormData => ({
  name: "",
  color: PRESET_COLORS[0],
  leaderName: "",
  phone: "",
  membersText: "",
  pin: "",
  isActive: true,
});

export default function EkipyPage() {
  const teams = useQuery(api.installationTeams.listAllWithStats) ?? [];
  const createTeam = useMutation(api.installationTeams.create);
  const updateTeam = useMutation(api.installationTeams.update);
  const deleteTeam = useMutation(api.installationTeams.remove);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<Id<"installationTeams"> | null>(null);
  const [form, setForm] = useState<TeamFormData>(defaultForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setForm(defaultForm());
    setEditingId(null);
    setError(null);
    setShowForm(true);
  };

  const openEdit = (team: typeof teams[0]) => {
    setForm({
      name: team.name,
      color: team.color ?? PRESET_COLORS[0],
      leaderName: team.leaderName ?? "",
      phone: team.phone ?? "",
      membersText: team.members ? team.members.join(", ") : "",
      pin: team.pin ?? "",
      isActive: team.isActive,
    });
    setEditingId(team._id);
    setError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Podaj nazwę ekipy montażowej.");
      return;
    }

    const cleanPin = form.pin.trim();
    if (cleanPin && !/^\d{4}$/.test(cleanPin)) {
      setError("PIN do aplikacji mobilnej musi składać się z 4 cyfr.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const members = form.membersText
        ? form.membersText.split(",").map((m) => m.trim()).filter(Boolean)
        : undefined;

      if (editingId) {
        await updateTeam({
          id: editingId,
          name: form.name.trim(),
          color: form.color,
          leaderName: form.leaderName.trim() || undefined,
          phone: form.phone.trim() || undefined,
          members,
          pin: cleanPin || undefined,
          isActive: form.isActive,
        });
      } else {
        await createTeam({
          name: form.name.trim(),
          color: form.color,
          leaderName: form.leaderName.trim() || undefined,
          phone: form.phone.trim() || undefined,
          members,
          pin: cleanPin || undefined,
          isActive: form.isActive,
        });
      }
      setShowForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Błąd zapisywania ekipy.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: Id<"installationTeams">, name: string) => {
    if (!confirm(`Czy na pewno chcesz usunąć ekipę "${name}"?`)) return;
    try {
      await deleteTeam({ id });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Nie udało się usunąć ekipy.");
    }
  };

  // Filtered teams
  const filteredTeams = teams.filter((t) => {
    if (filterStatus === "active" && !t.isActive) return false;
    if (filterStatus === "inactive" && t.isActive) return false;
    if (search.trim()) {
      const term = search.toLowerCase();
      const matchName = t.name.toLowerCase().includes(term);
      const matchLeader = (t.leaderName ?? "").toLowerCase().includes(term);
      const matchPhone = (t.phone ?? "").toLowerCase().includes(term);
      const matchMember = t.members?.some((m) => m.toLowerCase().includes(term));
      if (!matchName && !matchLeader && !matchPhone && !matchMember) return false;
    }
    return true;
  });

  const totalActive = teams.filter((t) => t.isActive).length;
  const totalUpcoming = teams.reduce((acc, t) => acc + (t.upcomingInstallationsCount ?? 0), 0);
  const totalOpenComplaints = teams.reduce((acc, t) => acc + (t.openComplaintsCount ?? 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Wrench className="w-6 h-6 text-slate-800" />
            <h1 className="text-2xl font-bold text-slate-900">Ekipy montażowe</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Zarządzaj zespołami monterskimi, śledź ich przydzielone montaże i zgłoszenia serwisowe.
          </p>
        </div>

        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-all shadow-sm self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Dodaj ekipę
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900">{totalActive}</div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Aktywne ekipy</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900">{totalUpcoming}</div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Zaplanowane montaże</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900">{totalOpenComplaints}</div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Otwarte serwisy</div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-xl shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Szukaj ekipy, kierownika, montera..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-slate-400 focus:bg-white text-slate-800"
          />
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          {(["all", "active", "inactive"] as const).map((st) => {
            const label = st === "all" ? "Wszystkie" : st === "active" ? "Aktywne" : "Nieaktywne";
            const active = filterStatus === st;
            return (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  active
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Form Drawer / Modal */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900">
              {editingId ? "Edytuj ekipę montażową" : "Nowa ekipa montażowa"}
            </h3>
            <button
              onClick={() => setShowForm(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nazwa ekipy <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="np. Ekipa Alfa - Jan Kowalski"
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
                    style={{ backgroundColor: form.color }}
                  />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, color: c }))}
                        className={`w-6 h-6 rounded-full border transition-transform cursor-pointer ${
                          form.color === c ? "scale-110 border-slate-900 shadow-sm" : "border-transparent opacity-80 hover:opacity-100"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Kierownik ekipy
                </label>
                <input
                  type="text"
                  value={form.leaderName}
                  onChange={(e) => setForm((f) => ({ ...f, leaderName: e.target.value }))}
                  placeholder="np. Jan Kowalski"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-slate-400 focus:bg-white text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Telefon kontaktowy
                </label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="np. +48 600 100 200"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-slate-400 focus:bg-white text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  PIN do aplikacji mobilnej (4 cyfry)
                </label>
                <input
                  type="text"
                  value={form.pin}
                  maxLength={4}
                  pattern="[0-9]*"
                  onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                  placeholder="np. 1234"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-slate-400 focus:bg-white text-slate-800 font-mono tracking-widest"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Członkowie ekipy (oddzieleni przecinkami)
              </label>
              <input
                type="text"
                value={form.membersText}
                onChange={(e) => setForm((f) => ({ ...f, membersText: e.target.value }))}
                placeholder="np. Piotr Nowak, Adam Wiśniewski, Tomasz Wójcik"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-slate-400 focus:bg-white text-slate-800"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="teamIsActive"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <label htmlFor="teamIsActive" className="text-xs font-medium text-slate-700 cursor-pointer">
                Ekipa aktywna (widoczna na listach wyboru przy zleceniach i kalendarzu)
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {saving ? "Zapisywanie..." : editingId ? "Zapisz zmiany" : "Utwórz ekipę"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Teams Grid Cards */}
      {filteredTeams.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
          <Wrench className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="font-semibold text-slate-700">Brak ekip montażowych</p>
          <p className="text-xs text-slate-500 mt-1">Nie znaleziono ekip spełniających kryteria wyszukiwania.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTeams.map((team) => {
            const teamColor = team.color ?? "#10b981";

            return (
              <div
                key={team._id}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4 group"
              >
                <div>
                  {/* Top Bar: Color, Name, Status */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0 shadow-xs"
                        style={{ backgroundColor: teamColor }}
                      />
                      <h3 className="font-bold text-slate-900 truncate text-base group-hover:text-blue-600 transition-colors">
                        {team.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {team.isActive ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                          Aktywna
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-wider">
                          Nieaktywna
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Leader & Contact */}
                  <div className="space-y-1.5 text-xs text-slate-600 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="text-slate-500">Kierownik:</span>
                      <span className="font-semibold text-slate-900 truncate">
                        {team.leaderName || "Nie przypisano"}
                      </span>
                    </div>

                    {team.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="text-slate-500">Tel:</span>
                        <a href={`tel:${team.phone}`} className="font-medium text-blue-600 hover:underline">
                          {team.phone}
                        </a>
                      </div>
                    )}

                    {team.pin && (
                      <div className="flex items-center gap-2">
                        <Key className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="text-slate-500">PIN (apka):</span>
                        <span className="font-semibold text-slate-900 font-mono tracking-wider">
                          {team.pin}
                        </span>
                      </div>
                    )}

                    {team.members && team.members.length > 0 && (
                      <div className="flex items-start gap-2 pt-1 border-t border-slate-200/60 mt-1">
                        <Users className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                        <div className="flex flex-wrap gap-1">
                          {team.members.map((m, idx) => (
                            <span key={idx} className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[10.5px] font-medium text-slate-700">
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* KPI Badges */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-2">
                      <div className="font-bold text-slate-900 text-sm">{team.ordersCount ?? 0}</div>
                      <div className="text-[10px] text-slate-500">Zlecenia</div>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-2">
                      <div className="font-bold text-blue-600 text-sm">{team.upcomingInstallationsCount ?? 0}</div>
                      <div className="text-[10px] text-slate-500">Montaże</div>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-2">
                      <div className={`font-bold text-sm ${team.openComplaintsCount ? "text-amber-600" : "text-slate-900"}`}>
                        {team.openComplaintsCount ?? 0}
                      </div>
                      <div className="text-[10px] text-slate-500">Serwisy</div>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <Link
                    href={`/admin/ekipy/${team._id}`}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Szczegóły ekipy
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>

                  <button
                    onClick={() => openEdit(team)}
                    title="Edytuj ekipę"
                    className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDelete(team._id, team.name)}
                    title="Usuń ekipę"
                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
