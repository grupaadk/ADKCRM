"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { ArrowUp, ArrowDown, Plus, Pencil, Trash2, CheckCircle2, XCircle } from "lucide-react";

const COMMON_VAT_RATES = [23, 8, 5, 0];

export function VatRateNamesTab() {
  const items = useQuery(api.vatRateNames.list, { includeInactive: true });
  const seedNames = useMutation(api.vatRateNames.seed);
  const createItem = useMutation(api.vatRateNames.create);
  const updateItem = useMutation(api.vatRateNames.update);
  const toggleActive = useMutation(api.vatRateNames.toggleActive);
  const removeItem = useMutation(api.vatRateNames.remove);
  const reorderItem = useMutation(api.vatRateNames.reorder);

  const [selectedVat, setSelectedVat] = useState<number | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<Id<"vatRateNames"> | null>(null);
  const [form, setForm] = useState({ vatRate: 23, name: "", label: "", isActive: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-seed if empty
  useEffect(() => {
    if (items !== undefined && items.length === 0) {
      seedNames().catch(() => {});
    }
  }, [items, seedNames]);

  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (selectedVat === "all") return items;
    return items.filter((i) => i.vatRate === selectedVat);
  }, [items, selectedVat]);

  function startCreate() {
    setEditingId(null);
    setForm({
      vatRate: typeof selectedVat === "number" ? selectedVat : 23,
      name: "",
      label: "",
      isActive: true,
    });
    setError(null);
    setShowForm(true);
  }

  function startEdit(item: Doc<"vatRateNames">) {
    setEditingId(item._id);
    setForm({
      vatRate: item.vatRate,
      name: item.name,
      label: item.label ?? "",
      isActive: item.isActive,
    });
    setError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Wpisz pełną nazwę pozycji.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (editingId) {
        await updateItem({
          id: editingId,
          vatRate: form.vatRate,
          name: form.name,
          label: form.label || undefined,
          isActive: form.isActive,
        });
      } else {
        await createItem({
          vatRate: form.vatRate,
          name: form.name,
          label: form.label || undefined,
          isActive: form.isActive,
        });
      }
      setShowForm(false);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd zapisu");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: Id<"vatRateNames">) {
    if (!confirm("Czy na pewno chcesz usunąć tę nazwę z listy predefiniowanych?")) return;
    await removeItem({ id });
  }

  async function handleToggle(id: Id<"vatRateNames">) {
    await toggleActive({ id });
  }

  async function handleMoveUp(item: Doc<"vatRateNames">) {
    if (!items) return;
    const sameVat = items.filter((i) => i.vatRate === item.vatRate).sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sameVat.findIndex((i) => i._id === item._id);
    if (idx <= 0) return;
    const prev = sameVat[idx - 1];
    await reorderItem({ id: prev._id, sortOrder: item.sortOrder });
    await reorderItem({ id: item._id, sortOrder: prev.sortOrder });
  }

  async function handleMoveDown(item: Doc<"vatRateNames">) {
    if (!items) return;
    const sameVat = items.filter((i) => i.vatRate === item.vatRate).sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sameVat.findIndex((i) => i._id === item._id);
    if (idx === -1 || idx >= sameVat.length - 1) return;
    const next = sameVat[idx + 1];
    await reorderItem({ id: next._id, sortOrder: item.sortOrder });
    await reorderItem({ id: item._id, sortOrder: next.sortOrder });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Nazwy pozycji wyceny (VAT)</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Zarządzaj predefiniowanymi nazwami przypisanymi do stawek VAT (23%, 8%, itd.). Nazwy te pojawią się jako przyciski szybkiego wyboru przy tworzeniu wyceny.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!showForm && (
            <button
              onClick={startCreate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition-all"
            >
              <Plus className="h-4 w-4" />
              Dodaj nazwę VAT
            </button>
          )}
        </div>
      </div>

      {/* Filter by VAT Rate */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-2">Filtruj wg VAT:</span>
        <button
          onClick={() => setSelectedVat("all")}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
            selectedVat === "all"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Wszystkie ({items?.length ?? 0})
        </button>
        {COMMON_VAT_RATES.map((rate) => {
          const count = items?.filter((i) => i.vatRate === rate).length ?? 0;
          return (
            <button
              key={rate}
              onClick={() => setSelectedVat(rate)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                selectedVat === rate
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {rate}% ({count})
            </button>
          );
        })}
      </div>

      {/* Form (Add / Edit) */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {editingId ? "Edycja predefiniowanej nazwy" : "Nowa predefiniowana nazwa VAT"}
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Stawka VAT (%) *
              </label>
              <input
                type="number"
                required
                min="0"
                max="100"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white font-bold"
                value={form.vatRate}
                onChange={(e) => setForm((f) => ({ ...f, vatRate: parseInt(e.target.value) || 0 }))}
              />
            </div>

            <div className="sm:col-span-3">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Etykieta przycisku (opcjonalnie, krótka nazwa na pigułce)
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="np. brama garażowa z montażem (jeśli puste, pojawi się pełna nazwa)"
              />
            </div>

            <div className="sm:col-span-4">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Pełna nazwa pozycji na umowie/wycenie *
              </label>
              <textarea
                required
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="np. Usługa remontowo budowlana w budynku mieszkalnym do 300m2 w XXXXXXX (brama garażowa z montażem) PKWiU 43.32.10.0."
              />
            </div>

            <div className="sm:col-span-4 flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span>Aktywna (widoczna w wycenie)</span>
              </label>
            </div>
          </div>

          {error && <p className="text-xs font-medium text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {editingId ? "Zapisz zmiany" : "Dodaj nazwę"}
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        {items === undefined ? (
          <div className="p-8 text-center text-sm text-slate-400">Ładowanie nazw VAT…</div>
        ) : filteredItems.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            Brak zdefiniowanych nazw VAT dla wybranych kryteriów.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3 w-20">VAT</th>
                <th className="px-4 py-3 w-48">Przycisk (Etykieta)</th>
                <th className="px-4 py-3">Pełna nazwa pozycji w wycenie</th>
                <th className="px-4 py-3 w-28 text-center">Status</th>
                <th className="px-4 py-3 w-36 text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item) => (
                <tr key={item._id} className={`hover:bg-slate-50/80 transition-colors ${!item.isActive ? "opacity-50 bg-slate-50/50" : ""}`}>
                  <td className="px-4 py-3 font-extrabold text-blue-900 whitespace-nowrap">
                    <span className="inline-block rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 border border-blue-200">
                      {item.vatRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 border border-slate-200">
                      {item.label || item.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 font-mono leading-relaxed whitespace-pre-wrap">
                    {item.name}
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <button
                      onClick={() => handleToggle(item._id)}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-all ${
                        item.isActive
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      {item.isActive ? (
                        <>
                          <CheckCircle2 className="h-3 w-3 text-green-600" /> Aktywna
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 text-slate-400" /> Nieaktywna
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => handleMoveUp(item)}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        title="Przesuń wyżej"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveDown(item)}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        title="Przesuń niżej"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => startEdit(item)}
                        className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                        title="Edytuj"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item._id)}
                        className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                        title="Usuń"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
