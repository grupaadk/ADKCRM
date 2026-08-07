"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { CrmPageHeader } from "@/components/crm-ui";
import {
  Wrench,
  Plus,
  Pencil,
  Trash2,
  Users,
  Phone,
  UserCheck,
  ChevronRight,
  AlertTriangle,
  Calendar,
  X,
  Key,
  CheckCircle2,
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

export function EkipyView() {
  const teams = useQuery(api.installationTeams.listAllWithStats) ?? [];
  const createTeam = useMutation(api.installationTeams.create);
  const updateTeam = useMutation(api.installationTeams.update);
  const deleteTeam = useMutation(api.installationTeams.remove);

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
      const membersArr = form.membersText
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);

      if (editingId) {
        await updateTeam({
          id: editingId,
          name: form.name.trim(),
          color: form.color,
          leaderName: form.leaderName.trim() || undefined,
          phone: form.phone.trim() || undefined,
          members: membersArr.length > 0 ? membersArr : undefined,
          pin: cleanPin || undefined,
          isActive: form.isActive,
        });
      } else {
        await createTeam({
          name: form.name.trim(),
          color: form.color,
          leaderName: form.leaderName.trim() || undefined,
          phone: form.phone.trim() || undefined,
          members: membersArr.length > 0 ? membersArr : undefined,
          pin: cleanPin || undefined,
          isActive: form.isActive,
        });
      }

      setShowForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Nie udało się zapisać ekipy.");
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
    return true;
  });

  const totalActive = teams.filter((t) => t.isActive).length;
  const totalUpcoming = teams.reduce((acc, t) => acc + (t.upcomingInstallationsCount ?? 0), 0);
  const totalOpenComplaints = teams.reduce((acc, t) => acc + (t.openComplaintsCount ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Pasek Wyszukiwania i Akcji (Styl zgodny z Urlopy/Nadgodziny) */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-gray-50 p-4 border border-gray-200">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Wrench className="size-5 text-brand" />
            Ekipy Montażowe ({filteredTeams.length})
          </h2>
          <p className="text-xs text-gray-500">
            Zarządzaj zespołami monterskimi, przypisanymi montażami i PINami do aplikacji mobilnej.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">

          {/* Przełącznik statusu */}
          <div className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white p-1">
            <button
              onClick={() => setFilterStatus("all")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                filterStatus === "all" ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Wszystkie ({teams.length})
            </button>
            <button
              onClick={() => setFilterStatus("active")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                filterStatus === "active" ? "bg-emerald-50 text-emerald-700 font-bold" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Aktywne ({totalActive})
            </button>
            <button
              onClick={() => setFilterStatus("inactive")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                filterStatus === "inactive" ? "bg-gray-200 text-gray-800 font-bold" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Nieaktywne ({teams.length - totalActive})
            </button>
          </div>

          {/* Przycisk Dodawania */}
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-brand/90"
          >
            <Plus className="size-4" />
            Dodaj ekipę
          </button>
        </div>
      </div>

      {/* Karty KPI Statystyk (Styl zbliżony do HR) */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Aktywne Zespoły
            </span>
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <UserCheck className="size-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">{totalActive}</span>
            <span className="text-sm font-medium text-gray-500">ekip</span>
          </div>
          <p className="mt-2 text-xs text-emerald-600 font-medium">Gotowe do realizacji zleceń</p>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Zaplanowane Montaże
            </span>
            <div className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-brand">
              <Calendar className="size-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">{totalUpcoming}</span>
            <span className="text-sm font-medium text-gray-500">przydzielonych</span>
          </div>
          <p className="mt-2 text-xs text-blue-600 font-medium">W harmonogramie kalendarza</p>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Otwarte Serwisy
            </span>
            <div className="flex size-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <AlertTriangle className="size-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">{totalOpenComplaints}</span>
            <span className="text-sm font-medium text-gray-500">zgłoszeń</span>
          </div>
          <p className="mt-2 text-xs text-amber-600 font-medium">Reklamacje w toku</p>
        </div>
      </div>

      {/* Siatka Kart Ekip Montażowych */}
      {filteredTeams.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTeams.map((team) => (
            <div
              key={team._id}
              className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md ${
                team.isActive ? "border-gray-200" : "border-gray-200 opacity-60 bg-gray-50/50"
              }`}
            >
              {/* Nagłówek karty z pasem koloru */}
              <div className="relative border-b border-gray-100 p-5">
                <div
                  className="absolute top-0 left-0 right-0 h-1.5"
                  style={{ backgroundColor: team.color || "#10b981" }}
                />
                <div className="flex items-start justify-between gap-3 pt-1">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <span
                        className="size-3 rounded-full shrink-0"
                        style={{ backgroundColor: team.color || "#10b981" }}
                      />
                      {team.name}
                    </h3>
                    {team.leaderName && (
                      <p className="mt-1 text-xs text-gray-500 flex items-center gap-1.5">
                        <Users className="size-3.5 text-gray-400" />
                        Kierownik: <strong className="text-gray-700">{team.leaderName}</strong>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(team)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-brand transition"
                      title="Edytuj ekipę"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(team._id, team.name)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition"
                      title="Usuń ekipę"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Zawartość karty */}
              <div className="p-5 space-y-4 text-xs text-gray-600">
                {/* Statusy i Wskaźniki */}
                <div className="flex flex-wrap items-center gap-2">
                  {team.isActive ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="size-3" />
                      Aktywna
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600 border border-gray-300">
                      Nieaktywna
                    </span>
                  )}

                  {team.pin && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-bold text-purple-700 border border-purple-200 font-mono">
                      <Key className="size-3 text-purple-500" />
                      PIN: {team.pin}
                    </span>
                  )}
                </div>

                {/* Przypisani Członkowie */}
                {team.members && team.members.length > 0 && (
                  <div>
                    <span className="block font-semibold text-gray-700 uppercase tracking-wider text-[10px] mb-1">
                      Skład osobowy:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {team.members.map((m, idx) => (
                        <span
                          key={idx}
                          className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-700 font-medium"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Telefon i Szczegóły */}
                {team.phone && (
                  <div className="flex items-center gap-2 text-gray-700 font-medium">
                    <Phone className="size-3.5 text-gray-400" />
                    <span>{team.phone}</span>
                  </div>
                )}

                {/* Statystyki Montaży i Serwisów */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 text-center">
                  <div className="rounded-lg bg-gray-50 p-2">
                    <span className="block text-base font-bold text-gray-900">
                      {team.upcomingInstallationsCount ?? 0}
                    </span>
                    <span className="text-[10px] font-medium text-gray-500">Zaplanowanych montaży</span>
                  </div>
                  <div className="rounded-lg bg-amber-50/60 p-2">
                    <span className="block text-base font-bold text-amber-900">
                      {team.openComplaintsCount ?? 0}
                    </span>
                    <span className="text-[10px] font-medium text-amber-700">Otwartych serwisów</span>
                  </div>
                </div>
              </div>

              {/* Stopka karty z przekierowaniem */}
              <div className="bg-gray-50/50 border-t border-gray-100 px-5 py-3 flex items-center justify-between">
                <span className="text-[11px] text-gray-400">PWA & Kalendarz</span>
                <Link
                  href={`/admin/ekipy/${team._id}`}
                  className="text-xs font-semibold text-brand hover:underline flex items-center gap-1"
                >
                  Szczegóły ekipy <ChevronRight className="size-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
          Nie znaleziono ekip montażowych spełniających kryteria.
        </div>
      )}

      {/* Modal Tworzenia / Edycji Ekipy */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h2 className="text-lg font-bold text-gray-900">
                {editingId ? "Edytuj ekipę montażową" : "Nowa ekipa montażowa"}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="size-5" />
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Nazwa ekipy *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="np. Ekipa Alfa - Jan Kowalski"
                  className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Kolor ekipy w kalendarzu
                </label>
                <div className="mt-2 flex items-center gap-3">
                  <div
                    className="size-8 rounded-lg border border-gray-200 shrink-0"
                    style={{ backgroundColor: form.color }}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setForm({ ...form, color: c })}
                        className={`size-6 rounded-full border transition transform ${
                          form.color === c ? "scale-125 border-gray-900 shadow" : "border-transparent"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Kierownik ekipy
                  </label>
                  <input
                    type="text"
                    value={form.leaderName}
                    onChange={(e) => setForm({ ...form, leaderName: e.target.value })}
                    placeholder="np. Jan Kowalski"
                    className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-brand focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Telefon kontaktowy
                  </label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="np. +48 600 100 200"
                    className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  PIN do aplikacji mobilnej (4 cyfry)
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={form.pin}
                  onChange={(e) =>
                    setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 4) })
                  }
                  placeholder="np. 1234"
                  className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 font-mono tracking-widest focus:border-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Członkowie ekipy (oddzieleni przecinkami)
                </label>
                <input
                  type="text"
                  value={form.membersText}
                  onChange={(e) => setForm({ ...form, membersText: e.target.value })}
                  placeholder="np. Piotr Nowak, Adam Wiśniewski"
                  className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-brand focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="teamIsActive"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="size-4 rounded border-gray-300 text-brand focus:ring-brand"
                />
                <label htmlFor="teamIsActive" className="text-xs font-medium text-gray-700">
                  Ekipa aktywna (widoczna w kalendarzu i zleceniach)
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-50"
                >
                  {saving ? "Zapisywanie..." : "Zapisz ekipę"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EkipyPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <CrmPageHeader
        title="Ekipy Montażowe"
        sub="Zarządzaj zespołami monterskimi, śledź przydzielone montaże, finanse i serwisy."
        backHref="/admin/hr?tab=ekipy"
        backLabel="Powrót do Centrum HR"
      />
      <EkipyView />
    </div>
  );
}
