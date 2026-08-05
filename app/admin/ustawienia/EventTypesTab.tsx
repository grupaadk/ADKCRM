"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { X, Plus, Pencil, Trash2 } from "lucide-react";

const PRESET_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#64748b",
];

const LINKED_DATE_FIELDS = [
  { value: "", label: "— Brak (tylko ręcznie tworzone zdarzenia) —" },
  { value: "projectStartDate", label: "Zlecenie: Data rozpoczęcia projektu" },
  { value: "projectEndDate", label: "Zlecenie: Data montażu (zakończenia)" },
  { value: "serviceDeliveries.deliveryDate", label: "Dostawa: Planowana data dostawy" },
  { value: "serviceDeliveries.orderDate", label: "Dostawa: Data zamówienia u dostawcy" },
  { value: "serviceDeliveries.confirmedDate", label: "Dostawa: Data potwierdzenia zamówienia" },
  { value: "serviceDeliveries.receivedDate", label: "Dostawa: Data odbioru fizycznego" },
];

interface EventTypeFormData {
  name: string;
  color: string;
  isPrivate: boolean;
  linkedOrderField: string;
  linkedSupplierId: string;
  linkedInstallationTeamId: string;
  defaultTimeMode: "all_day" | "timed";
}

const defaultForm = (): EventTypeFormData => ({
  name: "",
  color: PRESET_COLORS[0],
  isPrivate: false,
  linkedOrderField: "",
  linkedSupplierId: "",
  linkedInstallationTeamId: "",
  defaultTimeMode: "all_day",
});

export function EventTypesTab() {
  const eventTypes = useQuery(api.calendarEvents.getEventTypes) ?? [];
  const suppliers = useQuery(api.suppliers.listActive) ?? [];
  const installationTeams = useQuery(api.installationTeams.listActive) ?? [];
  const createEventType = useMutation(api.calendarEvents.createEventType);
  const updateEventType = useMutation(api.calendarEvents.updateEventType);
  const deleteEventType = useMutation(api.calendarEvents.deleteEventType);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<Id<"calendarEventTypes"> | null>(null);
  const [form, setForm] = useState<EventTypeFormData>(defaultForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [supplierFilter, setSupplierFilter] = useState<string>("");
  const [teamFilter, setTeamFilter] = useState<string>("");

  const filteredEventTypes = useMemo(() => {
    return eventTypes.filter((t) => {
      if (supplierFilter) {
        if (t.linkedSupplierId !== supplierFilter) return false;
      }
      if (teamFilter) {
        if (t.linkedInstallationTeamId !== teamFilter) return false;
      }
      return true;
    });
  }, [eventTypes, supplierFilter, teamFilter]);

  const openCreate = () => {
    setForm(defaultForm());
    setEditingId(null);
    setError(null);
    setShowForm(true);
  };

  const openEdit = (type: {
    _id: Id<"calendarEventTypes">;
    name: string;
    color: string;
    isPrivate: boolean;
    linkedOrderField?: string;
    linkedSupplierId?: Id<"suppliers">;
    linkedInstallationTeamId?: Id<"installationTeams">;
    defaultTimeMode?: "all_day" | "timed";
  }) => {
    setForm({
      name: type.name,
      color: type.color,
      isPrivate: type.isPrivate,
      linkedOrderField: type.linkedOrderField ?? "",
      linkedSupplierId: type.linkedSupplierId ?? "",
      linkedInstallationTeamId: type.linkedInstallationTeamId ?? "",
      defaultTimeMode: type.defaultTimeMode ?? "all_day",
    });
    setEditingId(type._id);
    setError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Nazwa jest wymagana."); return; }
    setSaving(true);
    setError(null);
    try {
      const supplierIdVal = form.linkedOrderField.startsWith("serviceDeliveries.") && form.linkedSupplierId
        ? (form.linkedSupplierId as Id<"suppliers">)
        : null;

      const teamIdVal = (form.linkedOrderField === "projectEndDate" || form.linkedOrderField === "complaintServiceDate") && form.linkedInstallationTeamId
        ? (form.linkedInstallationTeamId as Id<"installationTeams">)
        : null;

      if (editingId) {
        await updateEventType({
          id: editingId,
          name: form.name.trim(),
          color: form.color,
          isPrivate: form.isPrivate,
          linkedOrderField: form.linkedOrderField || null,
          linkedSupplierId: supplierIdVal,
          linkedInstallationTeamId: teamIdVal,
          defaultTimeMode: form.defaultTimeMode,
        });
      } else {
        await createEventType({
          name: form.name.trim(),
          color: form.color,
          isPrivate: form.isPrivate,
          linkedOrderField: form.linkedOrderField || undefined,
          linkedSupplierId: supplierIdVal || undefined,
          linkedInstallationTeamId: teamIdVal || undefined,
          defaultTimeMode: form.defaultTimeMode,
        });
      }
      setShowForm(false);
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nieznany błąd");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: Id<"calendarEventTypes">, name: string) => {
    if (!confirm(`Usunąć typ "${name}"? Akcja jest nieodwracalna.`)) return;
    try {
      await deleteEventType({ id });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Błąd przy usuwaniu");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Typy Wydarzeń</h2>
          <p className="text-sm text-slate-500 mt-1">
            Zarządzaj kategoriami wydarzeń w Kalendarzu. Możesz też powiązać typ wydarzenia z polem daty w zleceniu.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm shrink-0 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> Dodaj typ
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">{editingId ? "Edytuj typ" : "Nowy typ zdarzenia"}</h3>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Nazwa *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="np. Serwis, Urlop, Dostawa Okna…"
                autoFocus
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-slate-400 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Kolor</label>
              <div className="flex flex-wrap items-center gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setForm((f) => ({ ...f, color }))}
                    style={{ background: color }}
                    className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${form.color === color ? "ring-2 ring-offset-2 ring-slate-400 scale-110" : ""}`}
                    title={color}
                  />
                ))}
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="w-7 h-7 rounded-full border border-slate-200 cursor-pointer"
                  title="Własny kolor"
                />
                <div className="flex items-center gap-2 ml-2">
                  <div className="w-5 h-5 rounded-full" style={{ background: form.color }} />
                  <span className="text-xs font-mono text-slate-500">{form.color}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Tryb czasu w kalendarzu
              </label>
              <div className="flex items-center gap-4 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <label className="flex items-center gap-2 text-sm cursor-pointer font-medium text-slate-700">
                  <input
                    type="radio"
                    name="defaultTimeMode"
                    value="all_day"
                    checked={form.defaultTimeMode === "all_day"}
                    onChange={() => setForm((f) => ({ ...f, defaultTimeMode: "all_day" }))}
                    className="text-slate-900 focus:ring-slate-400"
                  />
                  ☀️ Cały dzień
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer font-medium text-slate-700">
                  <input
                    type="radio"
                    name="defaultTimeMode"
                    value="timed"
                    checked={form.defaultTimeMode === "timed"}
                    onChange={() => setForm((f) => ({ ...f, defaultTimeMode: "timed" }))}
                    className="text-slate-900 focus:ring-slate-400"
                  />
                  ⏱ Przedział godzinowy (od – do)
                </label>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Wydarzenia całodniowe trafiają do kontenera &quot;Cały dzień&quot;. Wydarzenia z przedziałem godzinowym lądują na siatce czasu.
              </p>
            </div>

            {/* Powiązanie z automatycznymi zdarzeniami ze zleceń i dostaw */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Powiązanie z automatycznym zdarzeniem ze zlecenia
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 bg-white cursor-pointer hover:border-slate-300 transition-colors">
                    <input
                      type="radio"
                      name="linkedTypeCategory"
                      checked={!form.linkedOrderField}
                      onChange={() => setForm((f) => ({ ...f, linkedOrderField: "", linkedSupplierId: "" }))}
                      className="text-slate-900 focus:ring-slate-400"
                    />
                    <span className="text-sm font-medium text-slate-800">
                      ⚪ Brak powiązania (zdarzenie dodawane ręcznie)
                    </span>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 bg-white cursor-pointer hover:border-slate-300 transition-colors">
                    <input
                      type="radio"
                      name="linkedTypeCategory"
                      checked={form.linkedOrderField === "projectStartDate"}
                      onChange={() => setForm((f) => ({ ...f, linkedOrderField: "projectStartDate", linkedSupplierId: "" }))}
                      className="text-slate-900 focus:ring-slate-400"
                    />
                    <span className="text-sm font-medium text-slate-800">
                      📅 Zlecenie: Data rozpoczęcia projektu
                    </span>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 bg-white cursor-pointer hover:border-slate-300 transition-colors">
                    <input
                      type="radio"
                      name="linkedTypeCategory"
                      checked={form.linkedOrderField === "projectEndDate"}
                      onChange={() => setForm((f) => ({ ...f, linkedOrderField: "projectEndDate", linkedSupplierId: "" }))}
                      className="text-slate-900 focus:ring-slate-400"
                    />
                    <span className="text-sm font-medium text-slate-800">
                      🔧 Zlecenie: Data montażu (zakończenia projektu)
                    </span>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 bg-white cursor-pointer hover:border-slate-300 transition-colors">
                    <input
                      type="radio"
                      name="linkedTypeCategory"
                      checked={form.linkedOrderField === "complaintServiceDate"}
                      onChange={() => setForm((f) => ({ ...f, linkedOrderField: "complaintServiceDate", linkedSupplierId: "" }))}
                      className="text-slate-900 focus:ring-slate-400"
                    />
                    <span className="text-sm font-medium text-slate-800">
                      ⚠️ Reklamacja: Data serwisu (naprawy / serwisu reklamacyjnego)
                    </span>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 bg-white cursor-pointer hover:border-slate-300 transition-colors">
                    <input
                      type="radio"
                      name="linkedTypeCategory"
                      checked={form.linkedOrderField.startsWith("serviceDeliveries.")}
                      onChange={() => setForm((f) => ({ ...f, linkedOrderField: "serviceDeliveries.deliveryDate" }))}
                      className="text-slate-900 focus:ring-slate-400"
                    />
                    <span className="text-sm font-medium text-slate-800">
                      🚚 Dostawa od Dostawcy (pozycja z listy dostaw w zleceniu)
                    </span>
                  </label>
                </div>
              </div>

              {/* Sub-options for Montaż / Reklamacja (Linked Installation Team) */}
              {(form.linkedOrderField === "projectEndDate" || form.linkedOrderField === "complaintServiceDate") && (
                <div className="pt-3 border-t border-slate-200 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                      Powiązana Ekipa Montażowa (opcjonalnie)
                    </label>
                    <select
                      value={form.linkedInstallationTeamId}
                      onChange={(e) => setForm((f) => ({ ...f, linkedInstallationTeamId: e.target.value }))}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-slate-400 bg-white font-medium text-slate-800"
                    >
                      <option value="">— Wszystkie ekipy / brak dedykowanej ekipy —</option>
                      {installationTeams.map((t) => (
                        <option key={t._id} value={t._id}>
                          🛠️ {t.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">
                      Dzięki temu ten typ wydarzenia zostanie połączony z wybraną ekipą montażową.
                    </p>
                  </div>
                </div>
              )}

              {/* Sub-options for Dostawa (Linked Supplier & Delivery Date Field) */}
              {form.linkedOrderField.startsWith("serviceDeliveries.") && (
                <div className="pt-3 border-t border-slate-200 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                      Pole daty w dostawie *
                    </label>
                    <select
                      value={form.linkedOrderField}
                      onChange={(e) => setForm((f) => ({ ...f, linkedOrderField: e.target.value }))}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-slate-400 bg-white font-medium text-slate-800"
                    >
                      <option value="serviceDeliveries.deliveryDate">📦 Planowana data dostawy</option>
                      <option value="serviceDeliveries.orderDate">📝 Data złożenia zamówienia</option>
                      <option value="serviceDeliveries.confirmedDate">✅ Data potwierdzenia zamówienia</option>
                      <option value="serviceDeliveries.receivedDate">🏢 Data odbioru fizycznego</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                      Powiązany Dostawca
                    </label>
                    <select
                      value={form.linkedSupplierId}
                      onChange={(e) => setForm((f) => ({ ...f, linkedSupplierId: e.target.value }))}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-slate-400 bg-white font-medium text-slate-800"
                    >
                      <option value="">— Wszyscy dostawcy (brak filtra) —</option>
                      {suppliers.map((s) => (
                        <option key={s._id} value={s._id}>
                          🏢 {s.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">
                      Po wybraniu dostawcy wydarzenia stworzą się automatycznie wyłącznie dla pozycji dostaw powiązanych z tym konkretnym dostawcą.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Podgląd</label>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium" style={{ background: `${form.color}22`, color: form.color, borderColor: `${form.color}66` }}>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: form.color }} />
                  {form.name || "Podgląd"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isPrivateType"
                checked={form.isPrivate}
                onChange={(e) => setForm((f) => ({ ...f, isPrivate: e.target.checked }))}
                className="rounded border-slate-300"
              />
              <label htmlFor="isPrivateType" className="text-sm text-slate-700 cursor-pointer">
                Typ prywatny – zdarzenia domyślnie widoczne tylko dla twórcy
              </label>
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">
                Anuluj
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                {saving ? "Zapisuję…" : editingId ? "Zapisz zmiany" : "Utwórz"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      {eventTypes.length > 0 && !showForm && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dostawcy:</span>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white font-medium text-slate-700 outline-none focus:border-slate-400"
            >
              <option value="">Wszyscy dostawcy</option>
              {suppliers.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ekipy:</span>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white font-medium text-slate-700 outline-none focus:border-slate-400"
            >
              <option value="">Wszystkie ekipy</option>
              {installationTeams.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {(supplierFilter || teamFilter) && (
            <button
              onClick={() => { setSupplierFilter(""); setTeamFilter(""); }}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Wyczyść filtry
            </button>
          )}
        </div>
      )}

      {/* List */}
      {filteredEventTypes.length === 0 && !showForm ? (
        <div className="text-center py-16 border border-dashed border-slate-200 rounded-xl text-slate-500">
          <p className="font-medium">Brak pasujących typów wydarzeń</p>
          <p className="text-sm mt-1">Zmień wybrane filtry lub kliknij &quot;Dodaj typ&quot;, aby stworzyć nowy.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredEventTypes.map((type) => {
            const linkedLabel = LINKED_DATE_FIELDS.find((f) => f.value === type.linkedOrderField)?.label;
            const supplierName = type.linkedSupplierName;
            return (
              <div
                key={type._id}
                className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-4 hover:border-slate-300 transition-colors group"
              >
                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: type.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900 text-sm">{type.name}</span>
                    {type.isPrivate && (
                      <span className="text-xs bg-slate-100 text-slate-500 rounded px-1.5 py-0.5">🔒 Prywatny</span>
                    )}
                    {type.linkedOrderField && (
                      <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-0.5 font-medium flex items-center gap-1">
                        🔗 {linkedLabel || type.linkedOrderField}
                      </span>
                    )}
                    {supplierName && (
                      <span className="text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded px-2 py-0.5 font-medium flex items-center gap-1">
                        🏢 Dostawca: <strong className="font-semibold">{supplierName}</strong>
                      </span>
                    )}
                    {!supplierName && type.linkedOrderField?.startsWith("serviceDeliveries.") && (
                      <span className="text-xs bg-amber-50/60 text-amber-700 border border-amber-200/60 rounded px-2 py-0.5 font-medium">
                        🏢 Dostawcy: <em>Wszyscy</em>
                      </span>
                    )}
                    {type.linkedInstallationTeamName && (
                      <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 rounded px-2 py-0.5 font-medium flex items-center gap-1">
                        🛠️ Ekipa: <strong className="font-semibold">{type.linkedInstallationTeamName}</strong>
                      </span>
                    )}
                    {!type.linkedInstallationTeamName && (type.linkedOrderField === "projectEndDate" || type.linkedOrderField === "complaintServiceDate") && (
                      <span className="text-xs bg-emerald-50/60 text-emerald-700 border border-emerald-200/60 rounded px-2 py-0.5 font-medium">
                        🛠️ Ekipy: <em>Wszystkie</em>
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-mono text-slate-400">{type.color}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(type)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                    title="Edytuj"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(type._id, type.name)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Usuń"
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
