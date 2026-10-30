"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  PackagePlus,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  Search,
  CheckCircle2,
  XCircle,
  X,
  Loader2,
} from "lucide-react";

export function OfferAdditionsTab() {
  const templates = useQuery(api.offerAdditionTemplates.list, { includeInactive: true });
  const createTemplate = useMutation(api.offerAdditionTemplates.create);
  const updateTemplate = useMutation(api.offerAdditionTemplates.update);
  const removeTemplate = useMutation(api.offerAdditionTemplates.remove);
  const seedDefaults = useMutation(api.offerAdditionTemplates.seedDefaultsIfEmpty);

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"offerAdditionTemplates"> | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("szt.");
  const [defaultPriceNet, setDefaultPriceNet] = useState<number>(0);
  const [defaultCostNet, setDefaultCostNet] = useState<number>(0);
  const [defaultInstallationPriceNet, setDefaultInstallationPriceNet] = useState<number>(0);
  const [defaultInstallationCostNet, setDefaultInstallationCostNet] = useState<number>(0);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  const categories = React.useMemo(() => {
    if (!templates) return [];
    const set = new Set<string>();
    for (const t of templates) {
      if (t.category) set.add(t.category);
    }
    return Array.from(set).sort();
  }, [templates]);

  const filtered = React.useMemo(() => {
    if (!templates) return [];
    return templates.filter((t) => {
      const matchSearch =
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        (t.category && t.category.toLowerCase().includes(search.toLowerCase())) ||
        (t.description && t.description.toLowerCase().includes(search.toLowerCase()));
      const matchCat = selectedCategory === "all" || t.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [templates, search, selectedCategory]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setName("");
    setUnit("szt.");
    setDefaultPriceNet(0);
    setDefaultCostNet(0);
    setDefaultInstallationPriceNet(0);
    setDefaultInstallationCostNet(0);
    setCategory("");
    setDescription("");
    setIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (t: NonNullable<typeof templates>[number]) => {
    setEditingId(t._id);
    setName(t.name);
    setUnit(t.unit || "szt.");
    setDefaultPriceNet(t.defaultPriceNet || 0);
    setDefaultCostNet(t.defaultCostNet || 0);
    setDefaultInstallationPriceNet(t.defaultInstallationPriceNet || 0);
    setDefaultInstallationCostNet(t.defaultInstallationCostNet || 0);
    setCategory(t.category || "");
    setDescription(t.description || "");
    setIsActive(t.isActive);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      if (editingId) {
        await updateTemplate({
          id: editingId,
          name,
          unit,
          defaultPriceNet,
          defaultCostNet: defaultCostNet || undefined,
          defaultInstallationPriceNet: defaultInstallationPriceNet || undefined,
          defaultInstallationCostNet: defaultInstallationCostNet || undefined,
          category: category || undefined,
          description: description || undefined,
          isActive,
        });
      } else {
        await createTemplate({
          name,
          unit,
          defaultPriceNet,
          defaultCostNet: defaultCostNet || undefined,
          defaultInstallationPriceNet: defaultInstallationPriceNet || undefined,
          defaultInstallationCostNet: defaultInstallationCostNet || undefined,
          category: category || undefined,
          description: description || undefined,
          isActive,
        });
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Błąd podczas zapisywania szablonu dodatku.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: Id<"offerAdditionTemplates">) => {
    if (!confirm("Czy na pewno chcesz usunąć ten szablon dodatku?")) return;
    try {
      await removeTemplate({ id });
    } catch (err) {
      console.error(err);
      alert("Błąd podczas usuwania szablonu.");
    }
  };

  const handleToggleActive = async (id: Id<"offerAdditionTemplates">, current: boolean) => {
    await updateTemplate({ id, isActive: !current });
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      const count = await seedDefaults();
      if (count > 0) {
        alert(`Załadowano ${count} przykładowych dodatków do katalogu.`);
      } else {
        alert("Katalog zawiera już pozycje.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Nagłówek sekcji */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-[rgba(74,187,195,0.12)] text-[#0e7490] border border-[rgba(74,187,195,0.25)]">
            <PackagePlus size={22} className="text-[#4ABBC3]" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">
              Katalog dodatków i akcesoriów
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Zarządzaj stałą bazą akcesoriów, zamków, uszczelek i usług do wyboru w ofertach
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(!templates || templates.length === 0) && (
            <button
              type="button"
              onClick={handleSeed}
              disabled={isSeeding}
              className="px-3 py-2 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              {isSeeding ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              <span>Zainicjuj przykładowe dodatki</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2 text-xs font-bold text-white bg-[#0e7490] hover:bg-[#085a70] rounded-lg flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>Dodaj do katalogu</span>
          </button>
        </div>
      </div>

      {/* Pasek filtrów */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj dodatku..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-[#4ABBC3] focus:bg-white"
          />
        </div>

        {categories.length > 0 && (
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                selectedCategory === "all"
                  ? "bg-[#0e7490] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Wszystkie ({templates?.length || 0})
            </button>
            {categories.map((cat) => {
              const count = templates?.filter((t) => t.category === cat).length || 0;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    selectedCategory === cat
                      ? "bg-[#0e7490] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Tabela szablonów */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {templates === undefined ? (
          <div className="py-12 flex items-center justify-center text-xs text-slate-400 gap-2">
            <Loader2 size={16} className="animate-spin text-[#0e7490]" />
            <span>Ładowanie katalogu...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            {search || selectedCategory !== "all"
              ? "Brak dodatków spełniających kryteria wyszukiwania."
              : "Brak pozycji w katalogu. Kliknij „Dodaj do katalogu” lub „Zainicjuj przykładowe dodatki”."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Nazwa dodatku</th>
                  <th className="py-3 px-3">Kategoria</th>
                  <th className="py-3 px-3 text-center">Jedn.</th>
                  <th className="py-3 px-3 text-right">Cena netto</th>
                  <th className="py-3 px-3 text-right">Koszt netto</th>
                  <th className="py-3 px-3 text-right">Montaż netto</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right w-24">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((t) => (
                  <tr key={t._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{t.name}</div>
                      {t.description && (
                        <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5 font-normal">
                          {t.description}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {t.category ? (
                        <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-medium border border-slate-200">
                          {t.category}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-600">
                      {t.unit || "szt."}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      {t.defaultPriceNet.toLocaleString("pl-PL")} zł
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-500">
                      {t.defaultCostNet ? `${t.defaultCostNet.toLocaleString("pl-PL")} zł` : "—"}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-700">
                      {t.defaultInstallationPriceNet
                        ? `${t.defaultInstallationPriceNet.toLocaleString("pl-PL")} zł`
                        : "—"}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(t._id, t.isActive)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                          t.isActive
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-500 border border-slate-200"
                        }`}
                      >
                        {t.isActive ? (
                          <>
                            <CheckCircle2 size={11} className="text-emerald-600" />
                            <span>Aktywny</span>
                          </>
                        ) : (
                          <>
                            <XCircle size={11} className="text-slate-400" />
                            <span>Wyłączony</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(t)}
                          className="p-1 text-slate-400 hover:text-[#0e7490] hover:bg-slate-100 rounded transition-colors cursor-pointer"
                          title="Edytuj"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(t._id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          title="Usuń"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal dodawania / edycji szablonu */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <PackagePlus size={18} className="text-[#0e7490]" />
                <h3 className="font-bold text-sm text-slate-900">
                  {editingId ? "Edycja szablonu dodatku" : "Nowy szablon dodatku w katalogu"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nazwa dodatku / akcesorium *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="np. Zamek hakowy z kluczem"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#4ABBC3]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kategoria
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="np. Zamki i pochwyty"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#4ABBC3]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jednostka
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#4ABBC3] bg-white cursor-pointer"
                  >
                    <option value="szt.">szt. (sztuka)</option>
                    <option value="kpl.">kpl. (komplet)</option>
                    <option value="mb">mb (metr bieżący)</option>
                    <option value="m²">m² (metr kwadratowy)</option>
                    <option value="opak.">opak. (opakowanie)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-800 mb-1">
                    Domyślna cena sprzedaży netto (zł) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={defaultPriceNet || ""}
                    onChange={(e) => setDefaultPriceNet(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 border border-slate-200 rounded-md bg-white focus:outline-none focus:border-[#4ABBC3]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Koszt zakupu netto (zł)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={defaultCostNet || ""}
                    onChange={(e) => setDefaultCostNet(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 text-xs font-mono text-slate-700 border border-slate-200 rounded-md bg-white focus:outline-none focus:border-[#4ABBC3]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-800 mb-1">
                    Cena montażu netto (zł)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={defaultInstallationPriceNet || ""}
                    onChange={(e) =>
                      setDefaultInstallationPriceNet(parseFloat(e.target.value) || 0)
                    }
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 text-xs font-mono text-slate-900 border border-slate-200 rounded-md bg-white focus:outline-none focus:border-[#4ABBC3]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Koszt montażu netto (zł)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={defaultInstallationCostNet || ""}
                    onChange={(e) =>
                      setDefaultInstallationCostNet(parseFloat(e.target.value) || 0)
                    }
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 text-xs font-mono text-slate-700 border border-slate-200 rounded-md bg-white focus:outline-none focus:border-[#4ABBC3]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Opis / uwagi techniczne
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Opcjonalny opis techniczny..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#4ABBC3]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="tpl-active"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded text-[#0e7490] focus:ring-[#0e7490] cursor-pointer"
                />
                <label htmlFor="tpl-active" className="text-xs font-medium text-slate-700 cursor-pointer">
                  Szablon aktywny (widoczny w wyszukiwarce dodatków w ofercie)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-[#0e7490] hover:bg-[#085a70] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  {isSaving && <Loader2 size={13} className="animate-spin" />}
                  <span>{editingId ? "Zapisz zmiany" : "Utwórz szablon"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
