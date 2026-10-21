"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Layers,
  Plus,
  Edit,
  Trash2,
  Sparkles,
  Search,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  XCircle,
  Loader2,
  Maximize2,
  X,
  FolderTree,
  Tag,
  Palette,
  Ruler,
} from "lucide-react";
import { CadCanvas } from "@/components/cad-configurator/CadCanvas";
import { CadConstructionDesignerModal } from "@/components/cad-configurator/CadConstructionDesignerModal";

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; dot: string; label: string }> = {
  cyan: { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200", dot: "bg-cyan-500", label: "Morski (Cyan)" },
  blue: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500", label: "Niebieski" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500", label: "Szmaragdowy" },
  indigo: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", dot: "bg-indigo-500", label: "Indygo" },
  purple: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", dot: "bg-purple-500", label: "Fioletowy" },
  amber: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500", label: "Bursztynowy" },
  rose: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", dot: "bg-rose-500", label: "Różany" },
  slate: { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200", dot: "bg-slate-500", label: "Szary" },
};

function getCategoryStyle(color?: string) {
  return CATEGORY_COLORS[color || "cyan"] || CATEGORY_COLORS.slate;
}

export function ConstructionsTab() {
  // Constructions Convex hooks
  const constructions = useQuery(api.constructions.list, { includeInactive: true });
  type ConstructionDoc = NonNullable<typeof constructions>[number];

  const createConstruction = useMutation(api.constructions.create);
  const updateConstruction = useMutation(api.constructions.update);
  const deleteConstruction = useMutation(api.constructions.remove);
  const reorderConstruction = useMutation(api.constructions.reorder);
  const seedDefaults = useMutation(api.constructions.seedDefault);

  // Categories Convex hooks
  const categories = useQuery(api.constructionCategories.list, { includeInactive: true });
  type CategoryDoc = NonNullable<typeof categories>[number];

  const createCategory = useMutation(api.constructionCategories.create);
  const updateCategory = useMutation(api.constructionCategories.update);
  const deleteCategory = useMutation(api.constructionCategories.remove);
  const reorderCategory = useMutation(api.constructionCategories.reorder);
  const seedCategories = useMutation(api.constructionCategories.seedDefault);

  // Auto-seed categories if empty
  useEffect(() => {
    if (categories !== undefined && categories.length === 0) {
      seedCategories().catch(() => {});
    }
  }, [categories, seedCategories]);

  // View state: 'constructions' | 'categories'
  const [activeView, setActiveView] = useState<"constructions" | "categories">("constructions");

  // Construction Search and CAD Designer Modal
  const [cadDesignerOpen, setCadDesignerOpen] = useState(false);
  const [editingConstruction, setEditingConstruction] = useState<ConstructionDoc | null>(null);
  const [previewConstruction, setPreviewConstruction] = useState<ConstructionDoc | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Category Search and Modals
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<Id<"constructionCategories"> | null>(null);
  const [categoryFormName, setCategoryFormName] = useState("");
  const [categoryFormCode, setCategoryFormCode] = useState("");
  const [categoryFormDescription, setCategoryFormDescription] = useState("");
  const [categoryFormColor, setCategoryFormColor] = useState("cyan");
  const [categoryFormIsActive, setCategoryFormIsActive] = useState(true);

  // Lookup map for categoryId -> category document
  const categoryMap = useMemo(() => {
    const map = new Map<string, CategoryDoc>();
    categories?.forEach((cat) => map.set(cat._id, cat));
    return map;
  }, [categories]);

  // Count constructions per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    constructions?.forEach((c) => {
      if (c.categoryId) {
        counts[c.categoryId] = (counts[c.categoryId] || 0) + 1;
      } else if (c.category) {
        counts[c.category] = (counts[c.category] || 0) + 1;
      }
    });
    return counts;
  }, [constructions]);

  // Filtered constructions
  const filteredConstructions = useMemo(() => {
    if (!constructions) return [];
    if (!searchQuery.trim()) return constructions;
    const q = searchQuery.toLowerCase().trim();
    return constructions.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.category && c.category.toLowerCase().includes(q)) ||
        (c.defaultSystem && c.defaultSystem.toLowerCase().includes(q)) ||
        (c.defaultFillType && c.defaultFillType.toLowerCase().includes(q)) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [constructions, searchQuery]);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    if (!categories) return [];
    if (!categorySearchQuery.trim()) return categories;
    const q = categorySearchQuery.toLowerCase().trim();
    return categories.filter(
      (cat) =>
        cat.name.toLowerCase().includes(q) ||
        (cat.code && cat.code.toLowerCase().includes(q)) ||
        (cat.description && cat.description.toLowerCase().includes(q))
    );
  }, [categories, categorySearchQuery]);

  // Handlers for Constructions (CAD Designer)
  const handleOpenCreate = () => {
    setEditingConstruction(null);
    setCadDesignerOpen(true);
  };

  const handleOpenEdit = (c: ConstructionDoc) => {
    setEditingConstruction(c);
    setCadDesignerOpen(true);
  };

  const handleSaveCadConstruction = async (data: {
    id?: Id<"constructions">;
    name: string;
    code: string;
    categoryId?: Id<"constructionCategories">;
    category?: string;
    description?: string;
    defaultSystem?: string;
    defaultColor?: string;
    defaultWidthMm: number;
    defaultHeightMm: number;
    defaultPanesCount: number;
    defaultFillType?: string;
    defaultWarning?: string;
    defaultPriceNet?: number;
  }) => {
    if (data.id) {
      await updateConstruction({
        id: data.id,
        name: data.name,
        code: data.code,
        categoryId: data.categoryId,
        category: data.category ?? "",
        description: data.description ?? "",
        defaultSystem: data.defaultSystem,
        defaultColor: data.defaultColor,
        defaultWidthMm: data.defaultWidthMm,
        defaultHeightMm: data.defaultHeightMm,
        defaultPanesCount: data.defaultPanesCount,
        defaultFillType: data.defaultFillType,
        defaultWarning: data.defaultWarning ?? "",
        defaultPriceNet: data.defaultPriceNet,
      });
    } else {
      await createConstruction({
        name: data.name,
        code: data.code,
        categoryId: data.categoryId,
        category: data.category,
        description: data.description,
        defaultSystem: data.defaultSystem,
        defaultColor: data.defaultColor,
        defaultWidthMm: data.defaultWidthMm,
        defaultHeightMm: data.defaultHeightMm,
        defaultPanesCount: data.defaultPanesCount,
        defaultFillType: data.defaultFillType,
        defaultWarning: data.defaultWarning,
        defaultPriceNet: data.defaultPriceNet,
      });
    }
  };

  const handleDelete = async (id: Id<"constructions">) => {
    if (!confirm("Czy na pewno chcesz usunąć tę konstrukcję z bazy?")) return;
    await deleteConstruction({ id });
  };

  const handleMoveUp = async (index: number) => {
    if (!filteredConstructions || index <= 0) return;
    const current = filteredConstructions[index];
    const prev = filteredConstructions[index - 1];
    const newCurrentOrder = prev.sortOrder;
    const newPrevOrder = current.sortOrder === prev.sortOrder ? prev.sortOrder + 1 : current.sortOrder;
    await reorderConstruction({ id: current._id, sortOrder: newCurrentOrder });
    await reorderConstruction({ id: prev._id, sortOrder: newPrevOrder });
  };

  const handleMoveDown = async (index: number) => {
    if (!filteredConstructions || index >= filteredConstructions.length - 1) return;
    const current = filteredConstructions[index];
    const next = filteredConstructions[index + 1];
    const newCurrentOrder = next.sortOrder;
    const newNextOrder = current.sortOrder === next.sortOrder ? next.sortOrder - 1 : current.sortOrder;
    await reorderConstruction({ id: current._id, sortOrder: newCurrentOrder });
    await reorderConstruction({ id: next._id, sortOrder: newNextOrder });
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedDefaults();
    } finally {
      setSeeding(false);
    }
  };

  // Handlers for Categories
  const handleOpenCreateCategory = () => {
    setEditingCategoryId(null);
    setCategoryFormName("");
    setCategoryFormCode("");
    setCategoryFormDescription("");
    setCategoryFormColor("cyan");
    setCategoryFormIsActive(true);
    setCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: CategoryDoc) => {
    setEditingCategoryId(cat._id);
    setCategoryFormName(cat.name);
    setCategoryFormCode(cat.code || "");
    setCategoryFormDescription(cat.description || "");
    setCategoryFormColor(cat.color || "cyan");
    setCategoryFormIsActive(cat.isActive);
    setCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryFormName.trim()) return;

    if (editingCategoryId) {
      await updateCategory({
        id: editingCategoryId,
        name: categoryFormName.trim(),
        code: categoryFormCode.trim(),
        description: categoryFormDescription.trim(),
        color: categoryFormColor,
        isActive: categoryFormIsActive,
      });
    } else {
      await createCategory({
        name: categoryFormName.trim(),
        code: categoryFormCode.trim() || undefined,
        description: categoryFormDescription.trim() || undefined,
        color: categoryFormColor,
        isActive: categoryFormIsActive,
      });
    }

    setCategoryModalOpen(false);
  };

  const handleDeleteCategory = async (id: Id<"constructionCategories">) => {
    if (!confirm("Czy na pewno chcesz usunąć tę kategorię? Przypisane konstrukcje zostaną odpięte.")) return;
    await deleteCategory({ id });
  };

  const handleMoveCategoryUp = async (index: number) => {
    if (!filteredCategories || index <= 0) return;
    const current = filteredCategories[index];
    const prev = filteredCategories[index - 1];
    const newCurrentOrder = prev.sortOrder;
    const newPrevOrder = current.sortOrder === prev.sortOrder ? prev.sortOrder + 1 : current.sortOrder;
    await reorderCategory({ id: current._id, sortOrder: newCurrentOrder });
    await reorderCategory({ id: prev._id, sortOrder: newPrevOrder });
  };

  const handleMoveCategoryDown = async (index: number) => {
    if (!filteredCategories || index >= filteredCategories.length - 1) return;
    const current = filteredCategories[index];
    const next = filteredCategories[index + 1];
    const newCurrentOrder = next.sortOrder;
    const newNextOrder = current.sortOrder === next.sortOrder ? next.sortOrder - 1 : current.sortOrder;
    await reorderCategory({ id: current._id, sortOrder: newCurrentOrder });
    await reorderCategory({ id: next._id, sortOrder: newNextOrder });
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#0b1220] flex items-center gap-2">
            <Layers className="text-[#4ABBC3]" size={20} />
            Baza szablonów i kategorii konstrukcji CAD
          </h2>
          <p className="text-xs text-[#7c8597] mt-0.5">
            Definicje konstrukcji, systemów oraz słownik kategorii wykorzystywanych w konfiguratorze ofert.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeView === "constructions" ? (
            <>
              {(!constructions || constructions.length === 0) && (
                <button
                  type="button"
                  onClick={handleSeed}
                  disabled={seeding}
                  className="btn"
                  style={{ padding: "6px 12px", fontSize: 12 }}
                >
                  {seeding ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} className="text-[#4ABBC3]" />
                  )}
                  <span>Zainicjuj przykładowe konstrukcje</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleOpenCreate}
                className="btn primary flex items-center gap-1.5"
                style={{ padding: "6px 14px", fontSize: 12 }}
              >
                <Ruler size={15} strokeWidth={2.5} />
                <span>Projektuj w CAD</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleOpenCreateCategory}
              className="btn primary"
              style={{ padding: "6px 14px", fontSize: 12 }}
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>Nowa kategoria</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-view Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveView("constructions")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeView === "constructions"
              ? "bg-[#0b1220] text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <Layers size={14} className={activeView === "constructions" ? "text-[#4ABBC3]" : "text-slate-400"} />
          <span>Szablony konstrukcji</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeView === "constructions" ? "bg-slate-800 text-cyan-300" : "bg-slate-200 text-slate-600"
            }`}
          >
            {constructions?.length ?? 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView("categories")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeView === "categories"
              ? "bg-[#0b1220] text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <FolderTree size={14} className={activeView === "categories" ? "text-[#4ABBC3]" : "text-slate-400"} />
          <span>Kategorie konstrukcji</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeView === "categories" ? "bg-slate-800 text-cyan-300" : "bg-slate-200 text-slate-600"
            }`}
          >
            {categories?.length ?? 0}
          </span>
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* VIEW 1: SZABLONY KONSTRUKCJI CAD                                       */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {activeView === "constructions" && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Szukaj po nazwie, kodzie, systemie..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
              />
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span>
                Szablony: <strong className="text-slate-800">{filteredConstructions.length}</strong>
                {constructions && filteredConstructions.length !== constructions.length && (
                  <span className="text-slate-400"> (z {constructions.length})</span>
                )}
              </span>
            </div>
          </div>

          {/* List / Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            {constructions === undefined ? (
              <div className="py-12 flex justify-center text-slate-400">
                <Loader2 className="animate-spin text-cyan-600 mr-2" size={20} />
                <span className="text-xs">Ładowanie szablonów konstrukcji...</span>
              </div>
            ) : constructions.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <Layers size={20} />
                </div>
                <h3 className="font-bold text-slate-800 text-sm">Baza konstrukcji jest pusta</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Możesz dodać własne definicje konstrukcji lub zainicjować gotowe szablony bazowe.
                </p>
                <button
                  type="button"
                  onClick={handleSeed}
                  disabled={seeding}
                  className="btn primary"
                  style={{ padding: "6px 14px", fontSize: 12 }}
                >
                  <Sparkles size={14} />
                  <span>Zainicjuj przykłady bazowe</span>
                </button>
              </div>
            ) : filteredConstructions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Brak konstrukcji spełniających kryteria wyszukiwania &quot;{searchQuery}&quot;.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3 min-w-[280px]">Konstrukcja / Kod</th>
                      <th className="px-3 py-3 w-40">Kategoria</th>
                      <th className="px-3 py-3 w-36">Wymiary (domyślne)</th>
                      <th className="px-3 py-3 min-w-[170px]">Szklenie & Kolor</th>
                      <th className="px-3 py-3 w-32">Cena netto</th>
                      <th className="px-3 py-3 w-28 text-center">Status</th>
                      <th className="px-4 py-3 w-32 text-right">Akcje</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredConstructions.map((c, index) => {
                      const panes = Math.max(1, c.defaultPanesCount || 3);
                      const width = c.defaultWidthMm || 2880;
                      const height = c.defaultHeightMm || 2300;

                      // Category style badge
                      const linkedCat = c.categoryId ? categoryMap.get(c.categoryId) : undefined;
                      const catStyle = getCategoryStyle(linkedCat?.color);

                      return (
                        <tr
                          key={c._id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            !c.isActive ? "opacity-60 bg-slate-50/40" : ""
                          }`}
                        >
                          {/* Mini preview + Kod + Nazwa */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => setPreviewConstruction(c)}
                                className="group relative w-14 h-9 bg-white rounded border border-slate-200 hover:border-cyan-500 hover:shadow-xs p-0.5 flex-shrink-0 flex items-center justify-center transition-all cursor-pointer"
                                title="Kliknij, aby otworzyć podgląd konstrukcji CAD"
                              >
                                <svg
                                  viewBox="0 0 160 90"
                                  className="w-full h-full pointer-events-none"
                                  preserveAspectRatio="xMidYMid meet"
                                >
                                  <rect x="2" y="2" width="156" height="86" fill="none" stroke="#dc2626" strokeWidth="1.5" />
                                  <rect x="3" y="3" width="154" height="84" fill="#29323d" stroke="#1e242b" strokeWidth="1" />
                                  <rect x="8" y="8" width="144" height="74" fill="#ffffff" />
                                  {Array.from({ length: panes }).map((_, i) => {
                                    const pw = 144 / panes;
                                    const px = 8 + i * pw;
                                    return (
                                      <g key={i}>
                                        <rect
                                          x={px + 0.5}
                                          y="8.5"
                                          width={pw - 1}
                                          height="73"
                                          fill="#ffffff"
                                          stroke="#e2e8f0"
                                          strokeWidth="0.5"
                                        />
                                        {i > 0 && <line x1={px} y1="8" x2={px} y2="82" stroke="#dc2626" strokeWidth="1.5" />}
                                      </g>
                                    );
                                  })}
                                </svg>
                                <div className="absolute inset-0 bg-slate-900/15 opacity-0 group-hover:opacity-100 rounded transition-opacity flex items-center justify-center pointer-events-none">
                                  <Maximize2 size={12} className="text-white drop-shadow-md" />
                                </div>
                              </button>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[10px] font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 px-1.5 py-0.5 rounded">
                                    {c.code}
                                  </span>
                                  <span className="font-bold text-slate-900 text-xs truncate">
                                    {c.name}
                                  </span>
                                </div>
                                {c.description && (
                                  <p className="text-[11px] text-slate-500 truncate max-w-sm mt-0.5">
                                    {c.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Kategoria jako obiekt z kolorem */}
                          <td className="px-3 py-3 whitespace-nowrap">
                            {c.category ? (
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${catStyle.dot}`} />
                                <span>{c.category}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">Brak kategorii</span>
                            )}
                          </td>

                          {/* Wymiary */}
                          <td className="px-3 py-3 text-slate-700 whitespace-nowrap font-mono text-[11px]">
                            <div>{width} × {height} mm</div>
                            <div className="text-[10px] text-slate-400 font-sans font-normal">
                              {panes} {panes === 1 ? "skrzydło" : panes < 5 ? "skrzydła" : "skrzydeł"}
                            </div>
                          </td>

                          {/* Szklenie & Kolor */}
                          <td className="px-3 py-3 text-[11px] space-y-0.5">
                            <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-700">
                              <span className="text-slate-400 font-sans">Szklenie:</span>
                              <span className="text-cyan-700 font-semibold">{c.defaultFillType || "—"}</span>
                            </div>
                            <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-600">
                              <span className="text-slate-400 font-sans">Kolor:</span>
                              <span>{c.defaultColor || "—"}</span>
                            </div>
                          </td>

                          {/* Cena netto */}
                          <td className="px-3 py-3 whitespace-nowrap font-mono text-xs">
                            {c.defaultPriceNet !== undefined && c.defaultPriceNet !== null ? (
                              <span className="font-bold text-slate-800">
                                {c.defaultPriceNet.toLocaleString("pl-PL")} zł
                              </span>
                            ) : (
                              <span className="text-slate-400 italic font-sans text-[11px]">Brak ceny</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-3 py-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => updateConstruction({ id: c._id, isActive: !c.isActive })}
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-all ${
                                c.isActive
                                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                                  : "bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200"
                              }`}
                            >
                              {c.isActive ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                  <span>Aktywny</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-3 w-3 text-slate-400" />
                                  <span>Nieaktywny</span>
                                </>
                              )}
                            </button>
                          </td>

                          {/* Akcje */}
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleMoveUp(index)}
                                disabled={index === 0}
                                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20 disabled:hover:bg-transparent"
                                title="Przesuń wyżej"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveDown(index)}
                                disabled={index === filteredConstructions.length - 1}
                                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20 disabled:hover:bg-transparent"
                                title="Przesuń niżej"
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(c)}
                                className="p-1 rounded text-slate-400 hover:text-cyan-700 hover:bg-cyan-50"
                                title="Projektuj / Edytuj w CAD"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(c._id)}
                                className="p-1 rounded text-slate-400 hover:text-red-700 hover:bg-red-50"
                                title="Usuń szablon"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* VIEW 2: KATEGORIE KONSTRUKCJI (OBIEKTY SŁOWNIKOWE)                      */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {activeView === "categories" && (
        <div className="space-y-4">
          {/* Categories Search & Stats Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={categorySearchQuery}
                onChange={(e) => setCategorySearchQuery(e.target.value)}
                placeholder="Szukaj kategorii po nazwie, kodzie, opisie..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
              />
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span>
                Kategorie: <strong className="text-slate-800">{filteredCategories.length}</strong>
                {categories && filteredCategories.length !== categories.length && (
                  <span className="text-slate-400"> (z {categories.length})</span>
                )}
              </span>
            </div>
          </div>

          {/* Categories Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            {categories === undefined ? (
              <div className="py-12 flex justify-center text-slate-400">
                <Loader2 className="animate-spin text-cyan-600 mr-2" size={20} />
                <span className="text-xs">Ładowanie kategorii konstrukcji...</span>
              </div>
            ) : categories.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <FolderTree size={20} />
                </div>
                <h3 className="font-bold text-slate-800 text-sm">Brak zdefiniowanych kategorii</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Możesz utworzyć własne kategorie lub zainicjować gotowe szablony (np. Systemy szklane, Stolarka aluminiowa, Pergole).
                </p>
                <button
                  type="button"
                  onClick={() => seedCategories()}
                  className="btn primary"
                  style={{ padding: "6px 14px", fontSize: 12 }}
                >
                  <Sparkles size={14} />
                  <span>Zainicjuj domyślne kategorie</span>
                </button>
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Brak kategorii pasujących do zapytania &quot;{categorySearchQuery}&quot;.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3 min-w-[220px]">Kategoria / Kod</th>
                      <th className="px-3 py-3 w-40">Etykieta (podgląd)</th>
                      <th className="px-3 py-3">Opis techniczny</th>
                      <th className="px-3 py-3 w-36 text-center">Przypisane szablony</th>
                      <th className="px-3 py-3 w-28 text-center">Status</th>
                      <th className="px-4 py-3 w-32 text-right">Akcje</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCategories.map((cat, index) => {
                      const count = categoryCounts[cat._id] || categoryCounts[cat.name] || 0;
                      const style = getCategoryStyle(cat.color);

                      return (
                        <tr
                          key={cat._id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            !cat.isActive ? "opacity-60 bg-slate-50/40" : ""
                          }`}
                        >
                          {/* Nazwa i kod */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <span className={`w-2.5 h-2.5 rounded-full ${style.dot} shrink-0`} />
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-900 text-xs">{cat.name}</span>
                                  {cat.code && (
                                    <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1 py-0.2 rounded">
                                      {cat.code}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Podgląd etykiety */}
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${style.bg} ${style.text} ${style.border}`}
                            >
                              <Tag size={10} />
                              <span>{cat.name}</span>
                            </span>
                          </td>

                          {/* Opis */}
                          <td className="px-3 py-3 text-slate-500 text-[11px] max-w-xs">
                            {cat.description || <span className="text-slate-300 italic">—</span>}
                          </td>

                          {/* Przypisane konstrukcje */}
                          <td className="px-3 py-3 text-center whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              {count} {count === 1 ? "szablon" : count < 5 ? "szablony" : "szablonów"}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-3 py-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => updateCategory({ id: cat._id, isActive: !cat.isActive })}
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-all ${
                                cat.isActive
                                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                                  : "bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200"
                              }`}
                            >
                              {cat.isActive ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                  <span>Aktywna</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-3 w-3 text-slate-400" />
                                  <span>Nieaktywna</span>
                                </>
                              )}
                            </button>
                          </td>

                          {/* Akcje */}
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleMoveCategoryUp(index)}
                                disabled={index === 0}
                                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20 disabled:hover:bg-transparent"
                                title="Przesuń wyżej"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveCategoryDown(index)}
                                disabled={index === filteredCategories.length - 1}
                                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20 disabled:hover:bg-transparent"
                                title="Przesuń niżej"
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditCategory(cat)}
                                className="p-1 rounded text-slate-400 hover:text-cyan-700 hover:bg-cyan-50"
                                title="Edytuj kategorię"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCategory(cat._id)}
                                className="p-1 rounded text-slate-400 hover:text-red-700 hover:bg-red-50"
                                title="Usuń kategorię"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: PROJEKTANT KONSTRUKCJI CAD (TWORZENIE I EDYCJA Z CADEM)           */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      <CadConstructionDesignerModal
        isOpen={cadDesignerOpen}
        onClose={() => setCadDesignerOpen(false)}
        onSave={handleSaveCadConstruction}
        initialData={editingConstruction}
        categories={categories}
      />

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: DODAJ / EDYTUJ KATEGORIĘ                                        */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {categoryModalOpen && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FolderTree className="text-cyan-600" size={18} />
                <span>{editingCategoryId ? "Edytuj kategorię konstrukcji" : "Nowa kategoria konstrukcji"}</span>
              </h3>
              <button
                type="button"
                onClick={() => setCategoryModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nazwa kategorii *
                </label>
                <input
                  type="text"
                  required
                  value={categoryFormName}
                  onChange={(e) => setCategoryFormName(e.target.value)}
                  placeholder="np. Systemy szklane"
                  className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Kod techniczny (opcjonalny skrót)
                </label>
                <input
                  type="text"
                  value={categoryFormCode}
                  onChange={(e) => setCategoryFormCode(e.target.value.toUpperCase())}
                  placeholder="np. SZKLO"
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-cyan-500 uppercase"
                />
              </div>

              {/* Wybór koloru etykiety */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Palette size={13} className="text-slate-500" />
                  <span>Kolor etykiety</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(CATEGORY_COLORS).map(([colorKey, style]) => {
                    const isSelected = categoryFormColor === colorKey;
                    return (
                      <button
                        key={colorKey}
                        type="button"
                        onClick={() => setCategoryFormColor(colorKey)}
                        className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-[11px] font-medium transition-all ${style.bg} ${style.text} ${
                          isSelected ? `${style.border} ring-2 ring-cyan-500/50 shadow-xs font-bold` : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                        <span className="capitalize">{colorKey}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Opis techniczny
                </label>
                <textarea
                  rows={2}
                  value={categoryFormDescription}
                  onChange={(e) => setCategoryFormDescription(e.target.value)}
                  placeholder="Krótki opis jakie systemy wchodzą w skład tej kategorii"
                  className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={categoryFormIsActive}
                    onChange={(e) => setCategoryFormIsActive(e.target.checked)}
                    className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 h-4 w-4"
                  />
                  <span className="font-semibold text-slate-700 text-xs">Kategoria aktywna (dostępna w konfiguratorze)</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e3e7ee]">
                <button
                  type="button"
                  onClick={() => setCategoryModalOpen(false)}
                  className="btn ghost"
                  style={{ padding: "6px 12px", fontSize: 12 }}
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="btn primary"
                  style={{ padding: "6px 14px", fontSize: 12 }}
                >
                  {editingCategoryId ? "Zapisz zmiany" : "Utwórz kategorię"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: PODGLĄD KONSTRUKCJI CAD                                         */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {previewConstruction && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewConstruction(null);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full border border-slate-200 overflow-hidden flex flex-col h-[88vh] max-h-[88vh]">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs font-bold text-cyan-700 bg-cyan-100/70 border border-cyan-200 px-2 py-0.5 rounded">
                  {previewConstruction.code}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    {previewConstruction.name}
                  </h3>
                  {previewConstruction.description && (
                    <p className="text-[11px] text-slate-500">
                      {previewConstruction.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const toEdit = previewConstruction;
                    setPreviewConstruction(null);
                    handleOpenEdit(toEdit);
                  }}
                  className="btn"
                  style={{ padding: "5px 12px", fontSize: 11 }}
                >
                  <Edit size={13} />
                  <span>Edytuj w CAD</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewConstruction(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                  title="Zamknij podgląd"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Quick Specs Bar */}
            <div className="px-5 py-2.5 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center gap-4 text-xs shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[11px]">Wymiary:</span>
                <span className="font-mono font-bold text-slate-800">
                  {previewConstruction.defaultWidthMm || 2880} × {previewConstruction.defaultHeightMm || 2300} mm
                </span>
                <span className="text-slate-500 font-sans">
                  ({previewConstruction.defaultPanesCount || 3}{" "}
                  {previewConstruction.defaultPanesCount === 1
                    ? "skrzydło"
                    : (previewConstruction.defaultPanesCount || 3) < 5
                    ? "skrzydła"
                    : "skrzydeł"}
                  )
                </span>
              </div>
              <div className="h-3 w-px bg-slate-200" />
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[11px]">Kategoria:</span>
                <span className="font-semibold text-slate-800">
                  {previewConstruction.category || "Inne"}
                </span>
              </div>
              <div className="h-3 w-px bg-slate-200" />
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[11px]">Szklenie:</span>
                <span className="font-mono font-medium text-cyan-700">
                  {previewConstruction.defaultFillType || "HART 10"}
                </span>
              </div>
              <div className="h-3 w-px bg-slate-200" />
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[11px]">Kolor:</span>
                <span className="font-mono text-slate-700">
                  {previewConstruction.defaultColor || "RAL 7016MAT"}
                </span>
              </div>
              <div className="h-3 w-px bg-slate-200" />
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[11px]">Cena netto:</span>
                <span className="font-mono font-bold text-emerald-700">
                  {previewConstruction.defaultPriceNet
                    ? `${previewConstruction.defaultPriceNet.toLocaleString("pl-PL")} zł`
                    : "—"}
                </span>
              </div>
            </div>

            {/* Interactive CadCanvas Preview */}
            <div className="flex-1 min-h-0 bg-white relative overflow-hidden flex flex-col">
              <CadCanvas
                key={previewConstruction._id}
                readOnly
                item={{
                  _id: previewConstruction._id,
                  positionIndex: 1,
                  name: previewConstruction.name,
                  shortName: previewConstruction.code,
                  description: previewConstruction.description,
                  color: previewConstruction.defaultColor || "RAL 7016MAT",
                  systemName: previewConstruction.defaultSystem || "",
                  quantity: 1,
                  widthMm: previewConstruction.defaultWidthMm || 2880,
                  heightMm: previewConstruction.defaultHeightMm || 2300,
                  panesCount: previewConstruction.defaultPanesCount || 3,
                  fillType: previewConstruction.defaultFillType || "HART 10",
                  segments: Array.from({
                    length: Math.max(1, previewConstruction.defaultPanesCount || 3),
                  }).map(() => ({
                    widthMm: Math.round(
                      (previewConstruction.defaultWidthMm || 2880) /
                        Math.max(1, previewConstruction.defaultPanesCount || 3)
                    ),
                    heightMm: previewConstruction.defaultHeightMm || 2300,
                    fill: previewConstruction.defaultFillType || "HART 10",
                  })),
                }}
              />
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs shrink-0">
              <div className="text-[11px] text-slate-500">
                Podgląd techniczny CAD w skali z automatycznym wymiarowaniem i kontrolą powiększenia.
              </div>
              <button
                type="button"
                onClick={() => setPreviewConstruction(null)}
                className="btn primary"
                style={{ padding: "6px 16px", fontSize: 12 }}
              >
                Zamknij podgląd
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
