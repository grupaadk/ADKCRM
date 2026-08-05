"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  X,
  Plus,
  Pencil,
  Trash2,
  Users,
  Phone,
  UserCheck,
  BarChart3,
  ChevronLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  Receipt,
  Calendar,
  Briefcase,
  ArrowRight,
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

function fmt(val: number) {
  return val.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function monthLabel(month: string) {
  const [y, m] = month.split("-");
  const names = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];
  return `${names[parseInt(m, 10) - 1]} ${y}`;
}

// ─── Panel finansowy ekipy ────────────────────────────────────────────────────
function TeamFinancialsPanel({
  teamId,
  teamName,
  teamColor,
  onBack,
}: {
  teamId: Id<"installationTeams">;
  teamName: string;
  teamColor: string;
  onBack: () => void;
}) {
  const data = useQuery(api.installationTeams.getTeamFinancials, { teamId });

  if (data === undefined) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
        Ładowanie danych finansowych...
      </div>
    );
  }

  const hasMonthly = data.monthlyBreakdown.length > 0;
  const hasExpenses = data.recentExpenses.length > 0;
  const marginPositive = data.margin >= 0;
  const maxBarValue = hasMonthly
    ? Math.max(...data.monthlyBreakdown.flatMap((m) => [m.earnings, m.expenses]), 1)
    : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors font-medium"
        >
          <ChevronLeft className="w-4 h-4" />
          Wszystkie ekipy
        </button>
        <span className="text-slate-300">/</span>
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ background: teamColor }}
          />
          <span className="font-bold text-slate-800">{teamName}</span>
        </div>
        <span className="ml-auto text-xs font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full flex items-center gap-1.5">
          <BarChart3 className="w-3.5 h-3.5" />
          Dane finansowe
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-emerald-400 rounded-t-xl" />
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Przychody ekipy</p>
          <p className="text-xl font-bold text-slate-900">{fmt(data.totalEarnings)} zł</p>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <Briefcase className="w-3 h-3" />
            {data.totalOrders} zleceń
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-red-400 rounded-t-xl" />
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Koszty (netto)</p>
          <p className="text-xl font-bold text-slate-900">{fmt(data.totalExpensesNet)} zł</p>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <Receipt className="w-3 h-3" />
            {data.expensesCount} wydatków
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className={`absolute inset-x-0 top-0 h-0.5 rounded-t-xl ${marginPositive ? "bg-blue-400" : "bg-orange-400"}`} />
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Wynik</p>
          <p className={`text-xl font-bold flex items-center gap-1 ${marginPositive ? "text-emerald-600" : "text-red-600"}`}>
            {marginPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {fmt(Math.abs(data.margin))} zł
          </p>
          <p className="text-xs text-slate-400 mt-1">{marginPositive ? "nadwyżka" : "niedobór"}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-violet-400 rounded-t-xl" />
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Roboczodni</p>
          <p className="text-xl font-bold text-slate-900">
            {data.totalWorkDays > 0 ? `${data.totalWorkDays} dni` : "—"}
          </p>
          {data.totalWorkDays > 0 && data.totalEarnings > 0 && (
            <p className="text-xs text-slate-400 mt-1">
              ≈ {fmt(data.totalEarnings / data.totalWorkDays)} zł/dzień
            </p>
          )}
        </div>
      </div>

      {/* Monthly breakdown */}
      {hasMonthly && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              Zestawienie miesięczne
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[540px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Miesiąc</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Przychody</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Koszty netto</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Wynik</th>
                  <th className="px-4 py-2.5 w-32" />
                </tr>
              </thead>
              <tbody>
                {[...data.monthlyBreakdown].reverse().map((row) => {
                  const pos = row.margin >= 0;
                  return (
                    <tr key={row.month} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">{monthLabel(row.month)}</td>
                      <td className="px-4 py-3 text-right text-emerald-700 font-medium tabular-nums">
                        {row.earnings > 0 ? `${fmt(row.earnings)} zł` : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-red-600 font-medium tabular-nums">
                        {row.expenses > 0 ? `${fmt(row.expenses)} zł` : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">
                        <span className={`inline-flex items-center gap-1 ${pos ? "text-emerald-600" : "text-red-600"}`}>
                          {pos ? <TrendingUp className="w-3.5 h-3.5" /> : row.margin === 0 ? <Minus className="w-3.5 h-3.5 text-slate-400" /> : <TrendingDown className="w-3.5 h-3.5" />}
                          {fmt(Math.abs(row.margin))} zł
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5 w-24">
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.round((row.earnings / maxBarValue) * 100)}%` }} />
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.round((row.expenses / maxBarValue) * 100)}%` }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200">
                  <td className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Łącznie</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-700 tabular-nums">{fmt(data.totalEarnings)} zł</td>
                  <td className="px-4 py-3 text-right font-bold text-red-600 tabular-nums">{fmt(data.totalExpensesNet)} zł</td>
                  <td className={`px-4 py-3 text-right font-bold tabular-nums ${marginPositive ? "text-emerald-600" : "text-red-600"}`}>{fmt(data.margin)} zł</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Recent expenses */}
      {hasExpenses && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Receipt className="w-4 h-4 text-slate-400" />
              Ostatnie wydatki montażowe
            </h3>
            <span className="text-xs text-slate-400">{data.expensesCount} łącznie</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Dokument / Dostawca</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kwota netto</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kwota brutto</th>
                </tr>
              </thead>
              <tbody>
                {data.recentExpenses.map((e) => (
                  <tr key={e._id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 truncate max-w-[220px]">
                        {e.number ?? e.sellerName ?? "—"}
                      </p>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.expensesCount > 20 && (
            <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400 text-right">
              Pokazano 20 z {data.expensesCount} wydatków
            </div>
          )}
        </div>
      )}

      {!hasMonthly && !hasExpenses && (
        <div className="bg-white border border-dashed border-slate-200 rounded-xl py-12 text-center text-slate-400 text-sm">
          Brak danych finansowych dla tej ekipy.<br />
          <span className="text-xs mt-1 block">Przypisz wydatki z kategorią „Montaż” do tej ekipy w szczegółach zlecenia.</span>
        </div>
      )}
    </div>
  );
}

// ─── Główny komponent ─────────────────────────────────────────────────────────
export function InstallationTeamsTab() {
  const teams = useQuery(api.installationTeams.listAll) ?? [];
  const createTeam = useMutation(api.installationTeams.create);
  const updateTeam = useMutation(api.installationTeams.update);
  const deleteTeam = useMutation(api.installationTeams.remove);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<Id<"installationTeams"> | null>(null);
  const [form, setForm] = useState<TeamFormData>(defaultForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [financialsTeamId, setFinancialsTeamId] = useState<Id<"installationTeams"> | null>(null);

  const financialsTeam = teams.find((t) => t._id === financialsTeamId) ?? null;

  const openCreate = () => {
    setForm(defaultForm());
    setEditingId(null);
    setError(null);
    setShowForm(true);
    setFinancialsTeamId(null);
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
    setFinancialsTeamId(null);
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
        await updateTeam({ id: editingId, name: form.name.trim(), color: form.color, leaderName: form.leaderName.trim() || undefined, phone: form.phone.trim() || undefined, members, pin: cleanPin || undefined, isActive: form.isActive });
      } else {
        await createTeam({ name: form.name.trim(), color: form.color, leaderName: form.leaderName.trim() || undefined, phone: form.phone.trim() || undefined, members, pin: cleanPin || undefined, isActive: form.isActive });
      }
      setShowForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Błąd podczas zapisywania ekipy.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: Id<"installationTeams">, name: string) => {
    if (!confirm(`Czy na pewno chcesz usunąć ekipę "${name}"?`)) return;
    try {
      await deleteTeam({ id });
      if (financialsTeamId === id) setFinancialsTeamId(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Nie udało się usunąć ekipy.");
    }
  };

  // Widok finansowy
  if (financialsTeam && financialsTeamId) {
    return (
      <TeamFinancialsPanel
        teamId={financialsTeamId}
        teamName={financialsTeam.name}
        teamColor={financialsTeam.color ?? "#10b981"}
        onBack={() => setFinancialsTeamId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Ekipy montażowe</h2>
          <p className="text-sm text-slate-500">
            Zarządzaj własnymi ekipami monterskimi. Przypisuj je do terminów montażu w zleceniach.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Dodaj ekipę
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900">{editingId ? "Edytuj ekipę montażową" : "Nowa ekipa montażowa"}</h3>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
              <X className="w-5 h-5" />
            </button>
          </div>
          {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Nazwa ekipy *</label>
                <input type="text" placeholder="np. Ekipa Alfa (Jan i Piotr)" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-slate-400 font-medium text-slate-800" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Kolor wyróżniający</label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 flex-1 overflow-x-auto py-1">
                    {PRESET_COLORS.map((c) => (
                      <button key={c} type="button" onClick={() => setForm((f) => ({ ...f, color: c }))} className={`w-6 h-6 rounded-full flex-shrink-0 transition-transform ${form.color === c ? "scale-125 ring-2 ring-slate-900 ring-offset-1" : "hover:scale-110"}`} style={{ background: c }} />
                    ))}
                  </div>
                  <input type="color" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} className="w-8 h-8 rounded border border-slate-200 cursor-pointer p-0" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Brygadzista / Kierownik</label>
                <input type="text" placeholder="np. Jan Kowalski" value={form.leaderName} onChange={(e) => setForm((f) => ({ ...f, leaderName: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-slate-400 text-slate-800" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Telefon kontaktowy</label>
                <input type="text" placeholder="+48 600 000 000" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-slate-400 text-slate-800" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">PIN do aplikacji mobilnej (4 cyfry)</label>
                <input
                  type="text"
                  placeholder="np. 1234"
                  maxLength={4}
                  pattern="[0-9]*"
                  value={form.pin}
                  onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-slate-400 text-slate-800 font-mono tracking-widest"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Członkowie ekipy (oddzieleni przecinkami)</label>
              <input type="text" placeholder="np. Piotr Nowak, Adam Wiśniewski" value={form.membersText} onChange={(e) => setForm((f) => ({ ...f, membersText: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-slate-400 text-slate-800" />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} className="rounded border-slate-300 text-slate-900 focus:ring-slate-400" />
                Ekipa aktywna (widoczna przy wyborze w zleceniach)
              </label>
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-600 text-sm font-semibold hover:bg-slate-100 rounded-lg transition-colors">Anuluj</button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50">
                {saving ? "Zapisywanie..." : editingId ? "Zapisz zmiany" : "Utwórz ekipę"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List of Teams */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 text-sm bg-white border border-slate-200 rounded-xl">
            Brak zdefiniowanych ekip montażowych. Kliknij &quot;Dodaj ekipę&quot;, aby utworzyć pierwszą.
          </div>
        ) : (
          teams.map((team) => {
            const color = team.color ?? "#10b981";
            return (
              <div key={team._id} className={`bg-white border rounded-xl p-4 transition-all shadow-sm space-y-3 relative overflow-hidden ${team.isActive ? "border-slate-200" : "border-slate-200 opacity-60 bg-slate-50"}`}>
                <div className="absolute top-0 left-0 bottom-0 w-1.5" style={{ background: color }} />
                <div className="flex items-start justify-between gap-2 pl-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-base">{team.name}</h3>
                      {!team.isActive && <span className="text-[10px] uppercase font-bold bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">Nieaktywna</span>}
                    </div>
                    {team.leaderName && (
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                        Kierownik: <span className="font-semibold text-slate-700">{team.leaderName}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(team)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" title="Edytuj"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(team._id, team.name)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Usuń"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="pl-2 space-y-1.5 text-xs text-slate-600 pt-1 border-t border-slate-100">
                  {team.phone && (<div className="flex items-center gap-1.5 text-slate-600"><Phone className="w-3.5 h-3.5 text-slate-400" /><span>{team.phone}</span></div>)}
                  {team.pin && (<div className="flex items-center gap-1.5 text-slate-600 font-mono"><Key className="w-3.5 h-3.5 text-slate-400" /><span className="font-semibold text-slate-700">PIN: {team.pin}</span></div>)}
                  {team.members && team.members.length > 0 && (<div className="flex items-start gap-1.5 text-slate-600"><Users className="w-3.5 h-3.5 text-slate-400 mt-0.5" /><span>{team.members.join(", ")}</span></div>)}
                </div>
                <button
                  onClick={() => setFinancialsTeamId(team._id)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-lg text-xs font-semibold text-slate-600 transition-colors"
                >
                  <span className="flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5 text-slate-400" />Dane finansowe</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
