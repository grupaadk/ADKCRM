"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { CadCanvas, CadConstructionItem } from "./CadCanvas";
import {
  Ruler,
  Layers,
  Save,
  X,
  Sliders,
  Palette,
  DollarSign,
} from "lucide-react";

export type CategoryDoc = Doc<"constructionCategories">;
export type ConstructionDoc = Doc<"constructions">;

export interface GlassSystemPreset {
  id: string;
  tracks: number;
  widthMm: number;
  heightMm: number;
  label: string;
  sublabel: string;
}

export const GLASS_SYSTEM_PRESETS: GlassSystemPreset[] = [
  { id: "2t-194", tracks: 2, widthMm: 1940, heightMm: 2300, label: "System 2-torowy", sublabel: "194 cm / wys. 230 cm" },
  { id: "3t-241", tracks: 3, widthMm: 2410, heightMm: 2300, label: "System 3-torowy", sublabel: "241 cm / wys. 230 cm" },
  { id: "3t-290", tracks: 3, widthMm: 2900, heightMm: 2300, label: "System 3-torowy", sublabel: "290 cm / wys. 230 cm" },
  { id: "4t-337", tracks: 4, widthMm: 3370, heightMm: 2300, label: "System 4-torowy", sublabel: "337 cm / wys. 230 cm" },
  { id: "4t-386", tracks: 4, widthMm: 3860, heightMm: 2300, label: "System 4-torowy", sublabel: "386 cm / wys. 230 cm" },
  { id: "5t-433", tracks: 5, widthMm: 4330, heightMm: 2300, label: "System 5-torowy", sublabel: "433 cm / wys. 230 cm" },
  { id: "5t-482", tracks: 5, widthMm: 4820, heightMm: 2300, label: "System 5-torowy", sublabel: "482 cm / wys. 230 cm" },
  { id: "6t-529", tracks: 6, widthMm: 5290, heightMm: 2300, label: "System 6-torowy", sublabel: "529 cm / wys. 230 cm" },
  { id: "6t-578", tracks: 6, widthMm: 5780, heightMm: 2300, label: "System 6-torowy", sublabel: "578 cm / wys. 230 cm" },
];

interface CadConstructionDesignerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
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
  }) => Promise<void>;
  initialData?: ConstructionDoc | null;
  categories: CategoryDoc[] | undefined;
}

export function CadConstructionDesignerModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  categories,
}: CadConstructionDesignerModalProps) {
  const isEditing = Boolean(initialData?._id);

  // Form State - podstawowe parametry konstrukcji CAD
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [categoryName, setCategoryName] = useState("");
  const [description, setDescription] = useState("");
  const [widthMm, setWidthMm] = useState(2880);
  const [heightMm, setHeightMm] = useState(2300);
  const [panesCount, setPanesCount] = useState(3);
  const [priceNet, setPriceNet] = useState<number | "">("");

  // Wartości domyślne / zachowywane w tle dla zgodności z modelem danych
  const [systemName, setSystemName] = useState("");
  const [color, setColor] = useState("RAL 7016MAT");
  const [fillType, setFillType] = useState("HART 10");
  const [warning, setWarning] = useState("");

  const [saving, setSaving] = useState(false);

  // Inicjalizacja danych po otwarciu
  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setName(initialData.name || "");
      setCode(initialData.code || "");
      setCategoryId(initialData.categoryId || "");
      setCategoryName(initialData.category || "");
      setDescription(initialData.description || "");
      setWidthMm(initialData.defaultWidthMm || 2880);
      setHeightMm(initialData.defaultHeightMm || 2300);
      setPanesCount(initialData.defaultPanesCount || 3);
      setPriceNet(initialData.defaultPriceNet !== undefined ? initialData.defaultPriceNet : "");
      setSystemName(initialData.defaultSystem || "");
      setColor(initialData.defaultColor || "RAL 7016MAT");
      setFillType(initialData.defaultFillType || "HART 10");
      setWarning(initialData.defaultWarning || "");
    } else {
      const defaultCat = categories?.find((c) => c.isActive) || categories?.[0];
      const isDefaultGlass = (defaultCat?.name || "Systemy szklane").trim().toLowerCase().includes("szklan");
      setName("");
      setCode("");
      setCategoryId(defaultCat?._id || "");
      setCategoryName(defaultCat?.name || "Systemy szklane");
      setDescription("");
      setWidthMm(isDefaultGlass ? 2410 : 2000);
      setHeightMm(2300);
      setPanesCount(isDefaultGlass ? 3 : 1);
      setPriceNet("");
      setSystemName("");
      setColor("RAL 7016MAT");
      setFillType("HART 10");
      setWarning("");
    }
  }, [isOpen, initialData, categories]);

  // Czy wybrana kategoria to "Systemy szklane"
  const isGlassCategory = useMemo(() => {
    const raw = (categoryName || categories?.find((c) => c._id === categoryId)?.name || "").trim().toLowerCase();
    return raw.includes("szklan");
  }, [categoryName, categoryId, categories]);

  // Synchronizacja nazwy kategorii po zmianie wybranego ID
  const handleCategorySelect = (id: string) => {
    setCategoryId(id);
    const cat = categories?.find((c) => c._id === id);
    if (cat) {
      setCategoryName(cat.name);
      const isGlass = cat.name.trim().toLowerCase().includes("szklan");
      if (isGlass) {
        if (panesCount < 2) {
          setPanesCount(3);
          setWidthMm(2410);
          setHeightMm(2300);
        }
      } else {
        setPanesCount(1);
      }
    }
  };

  // Automatyczny kod konstrukcji na podstawie wymiarów i kwater
  const generateCode = () => {
    setCode(`CAD-${panesCount}T-${widthMm}x${heightMm}`);
  };

  // Wskaźniki techniczne
  const areaM2 = Math.round((widthMm * heightMm * 0.000001) * 100) / 100;
  const singlePaneWidthMm = Math.round(widthMm / Math.max(1, panesCount));

  // Konstrukcja dla podglądu na żywo w CadCanvas
  const liveCadItem: CadConstructionItem = useMemo(() => {
    const panes = Math.max(1, panesCount);
    return {
      _id: initialData?._id || "temp-designer-preview",
      positionIndex: 1,
      name: name || "Nowa konstrukcja CAD",
      shortName: code || "CAD",
      description: description || undefined,
      warning: warning || undefined,
      color: color || "RAL 7016MAT",
      systemName: systemName || undefined,
      quantity: 1,
      widthMm: Math.max(400, widthMm),
      heightMm: Math.max(400, heightMm),
      panesCount: panes,
      fillType: fillType || "HART 10",
      priceNet: typeof priceNet === "number" ? priceNet : (parseFloat(priceNet as string) || 4500),
      costNet: 2800,
      segments: Array.from({ length: panes }).map((_, i) => ({
        widthMm: i === panes - 1 ? widthMm - singlePaneWidthMm * (panes - 1) : singlePaneWidthMm,
        heightMm: Math.max(200, heightMm - 103),
        fill: fillType || "HART 10",
        weightKg: Math.round((singlePaneWidthMm * heightMm * 0.000001 * 25) * 10) / 10,
        profileTop: `5448 ${color}`,
        profileBottom: `5450 ${color}`,
        profileLeft: `5450 ${color}`,
        profileRight: `5450 ${color}`,
      })),
    };
  }, [
    initialData?._id,
    name,
    code,
    description,
    warning,
    color,
    systemName,
    widthMm,
    heightMm,
    panesCount,
    fillType,
    priceNet,
    singlePaneWidthMm,
  ]);

  // Obsługa zapisu
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    let finalCode = code.trim().toUpperCase();
    if (!finalCode) {
      finalCode = `CAD-${panesCount}T-${widthMm}x${heightMm}`;
    }

    setSaving(true);
    try {
      await onSave({
        id: initialData?._id,
        name: name.trim(),
        code: finalCode,
        categoryId: categoryId ? (categoryId as Id<"constructionCategories">) : undefined,
        category: categoryName.trim() || undefined,
        description: description.trim(),
        defaultSystem: systemName.trim() || undefined,
        defaultColor: color.trim() || "RAL 7016MAT",
        defaultWidthMm: widthMm,
        defaultHeightMm: heightMm,
        defaultPanesCount: panesCount,
        defaultFillType: fillType.trim() || "HART 10",
        defaultWarning: warning.trim(),
        defaultPriceNet:
          typeof priceNet === "number"
            ? priceNet
            : priceNet !== ""
            ? parseFloat(priceNet)
            : undefined,
      });
      onClose();
    } catch (err) {
      console.error("Błąd podczas zapisywania szablonu konstrukcji:", err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[94vh] max-h-[94vh] border border-slate-200 overflow-hidden flex flex-col">
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* TOP HEADER: Status, Tytuł, Akcje Zapisu                                */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <div className="h-14 px-5 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center text-white shadow-sm shadow-cyan-600/30">
              <Ruler size={19} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">
                  {isEditing ? "Edytor konstrukcji CAD" : "Kreator konstrukcji CAD"}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    isEditing
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  }`}
                >
                  {isEditing ? "Edycja szablonu" : "Nowy szablon"}
                </span>
                {code && (
                  <span className="font-mono text-[11px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                    {code}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                <span>{name || "Konfiguracja geometrii i parametrów konstrukcji"}</span>
                {fillType && (
                  <>
                    <span>·</span>
                    <span className="font-mono text-cyan-700 font-medium">{fillType}</span>
                  </>
                )}
                {color && (
                  <>
                    <span>·</span>
                    <span className="font-mono text-slate-600">{color}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="btn ghost"
              style={{ padding: "7px 14px", fontSize: 12 }}
            >
              Anuluj
            </button>
            <button
              type="button"
              disabled={saving || !name.trim()}
              onClick={handleSubmit}
              className="btn primary flex items-center gap-1.5"
              style={{ padding: "7px 18px", fontSize: 12 }}
            >
              <Save size={14} />
              <span>{saving ? "Zapisywanie..." : isEditing ? "Zapisz zmiany w CAD" : "Zapisz do bazy szablonów"}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors ml-1"
              title="Zamknij (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* MAIN BODY: Split-view (Lewy panel parametrów + Płótno CAD)            */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden bg-slate-100">
          {/* LEWY PANEL KONTROLNY: Parametry Geometrii CAD */}
          <div className="w-full md:w-[420px] bg-white border-r border-slate-200 flex flex-col shrink-0 h-full overflow-hidden">
            {/* Nagłówek panelu bocznego */}
            <div className="h-10 bg-slate-50 border-b border-slate-200 px-4 flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Sliders size={13} className="text-cyan-600" /> Parametry konstrukcji CAD
              </span>
              <span className="font-mono text-[10px] text-slate-500">
                {widthMm} × {heightMm} mm
              </span>
            </div>

            {/* Zawartość formularza parametrów */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {/* Identyfikacja szablonu */}
              <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Nazwa konstrukcji *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="np. System całoszklany 3-torowy"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 font-medium focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Kod / Symbol
                      </label>
                      <button
                        type="button"
                        onClick={generateCode}
                        className="text-[10px] text-cyan-600 hover:text-cyan-800 font-semibold"
                        title="Wygeneruj automatyczny kod z parametrów"
                      >
                        Auto
                      </button>
                    </div>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="np. SZKLO-3T"
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono font-bold uppercase focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Kategoria
                    </label>
                    <select
                      value={categoryId}
                      onChange={(e) => handleCategorySelect(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-slate-900 font-medium focus:outline-none focus:border-cyan-500"
                    >
                      {categories?.map((cat) => (
                        <option key={cat._id} value={cat._id}>
                          {cat.name} {cat.code ? `(${cat.code})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Cena netto konstrukcji */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <DollarSign size={11} className="text-cyan-600" /> Cena netto konstrukcji
                    </label>
                    {priceNet !== "" && (
                      <span className="font-mono text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                        {Number(priceNet).toLocaleString("pl-PL")} zł netto
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      step={50}
                      value={priceNet}
                      onChange={(e) =>
                        setPriceNet(e.target.value === "" ? "" : Math.max(0, parseFloat(e.target.value) || 0))
                      }
                      placeholder="np. 4500"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 font-mono font-bold focus:outline-none focus:border-cyan-500 text-xs pr-18"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-[11px] pointer-events-none">
                      zł netto
                    </span>
                  </div>
                </div>
              </div>

              {/* Ilość torów systemu - widoczne TYLKO gdy kategoria to "Systemy szklane" */}
              {isGlassCategory && (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Layers size={13} className="text-cyan-600" /> Ilość torów systemu
                    </label>
                    <span className="font-mono text-[11px] font-bold text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                      System {panesCount}-torowy
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-500">
                    Wybierz system — szerokość i wysokość uzupełnią się automatycznie:
                  </p>

                  {/* Kafelki wyboru wariantów torowych */}
                  <div className="grid grid-cols-1 gap-1.5 max-h-60 overflow-y-auto pr-0.5">
                    {GLASS_SYSTEM_PRESETS.map((preset) => {
                      const isSelected =
                        panesCount === preset.tracks &&
                        widthMm === preset.widthMm &&
                        heightMm === preset.heightMm;

                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setPanesCount(preset.tracks);
                            setWidthMm(preset.widthMm);
                            setHeightMm(preset.heightMm);
                          }}
                          className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                            isSelected
                              ? "bg-cyan-50/90 border-cyan-500 shadow-xs ring-1 ring-cyan-500/30"
                              : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`w-6 h-6 rounded-md flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                                isSelected
                                  ? "bg-cyan-600 text-white"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {preset.tracks}T
                            </span>
                            <div className="min-w-0">
                              <span
                                className={`font-bold text-xs block ${
                                  isSelected ? "text-cyan-950 font-bold" : "text-slate-800"
                                }`}
                              >
                                {preset.label}
                              </span>
                              <span className="text-[11px] font-mono text-slate-500">
                                {preset.sublabel}
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-1.5">
                            <span className="font-mono font-semibold text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {preset.widthMm} × {preset.heightMm} mm
                            </span>
                            {isSelected && (
                              <span className="w-2 h-2 rounded-full bg-cyan-600 shrink-0" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Parametry skrzydła wyliczone */}
                  <div className="bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between font-mono text-[11px] mt-1">
                    <span className="text-slate-500 font-sans">Szerokość 1 skrzydła:</span>
                    <span className="font-bold text-slate-900">~{singlePaneWidthMm} mm</span>
                  </div>
                </div>
              )}

              {/* Wymiary gabarytowe */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Ruler size={13} className="text-cyan-600" /> Wymiary całkowite [mm]
                  </span>
                  <span className="font-mono text-[10px] text-cyan-700 font-bold bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                    {widthMm} × {heightMm} mm
                  </span>
                </div>

                {/* Szerokość całkowita */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-700">Szerokość całkowita (W)</label>
                    <span className="font-mono font-bold text-slate-900">{widthMm} mm</span>
                  </div>
                  <input
                    type="number"
                    min={400}
                    max={15000}
                    step={10}
                    value={widthMm}
                    onChange={(e) => setWidthMm(Math.max(400, parseInt(e.target.value) || 400))}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 font-mono font-bold focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Wysokość całkowita */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-700">Wysokość całkowita (H)</label>
                    <span className="font-mono font-bold text-slate-900">{heightMm} mm</span>
                  </div>
                  <input
                    type="number"
                    min={400}
                    max={4500}
                    step={10}
                    value={heightMm}
                    onChange={(e) => setHeightMm(Math.max(400, parseInt(e.target.value) || 400))}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 font-mono font-bold focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Specyfikacja materiałowa: Szklenie i Kolorystyka */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Palette size={13} className="text-cyan-600" /> Szklenie i Kolorystyka profili
                </span>

                {/* Szklenie / Wypełnienie */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Szklenie / Wypełnienie
                    </label>
                    {fillType && (
                      <span className="font-mono text-[10px] text-cyan-700 font-bold">
                        {fillType}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={fillType}
                    onChange={(e) => setFillType(e.target.value)}
                    placeholder="np. HART 10, VSG 44.2, PAKIET 4/16/4..."
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-medium focus:outline-none focus:border-cyan-500 text-xs"
                  />
                </div>

                {/* Kolor profili */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Kolor profili (RAL)
                    </label>
                    {color && (
                      <span className="font-mono text-[10px] text-cyan-700 font-bold">
                        {color}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="np. RAL 7016MAT, RAL 9005MAT, RAL 9016..."
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono font-medium focus:outline-none focus:border-cyan-500 text-xs"
                  />
                </div>
              </div>

              {/* Opis techniczny */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Opis techniczny szablonu
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Krótki opis przeznaczenia, montażu i parametrów"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-700 text-xs focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>
            </div>

            {/* Stopka lewego panelu ze statystykami */}
            <div className="h-12 bg-slate-50 border-t border-slate-200 px-4 flex items-center justify-between text-[11px] shrink-0 font-mono">
              <span className="text-slate-500 font-sans">Powierzchnia:</span>
              <span className="font-bold text-slate-800">{areaM2} m²</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500 font-sans">Cena:</span>
              <span className="font-bold text-emerald-700">
                {priceNet !== "" ? `${Number(priceNet).toLocaleString("pl-PL")} zł` : "—"}
              </span>
              {isGlassCategory && (
                <>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-500 font-sans">Tory:</span>
                  <span className="font-bold text-slate-800">{panesCount}T</span>
                </>
              )}
            </div>
          </div>

          {/* PRAWA STRONA: PŁÓTNO CAD NA ŻYWO (CadCanvas) */}
          <div className="flex-1 min-w-0 min-h-0 bg-slate-100 flex flex-col relative overflow-hidden">
            {/* Informacja na górze podglądu CAD */}
            <div className="h-9 bg-white/80 backdrop-blur-xs border-b border-slate-200 px-4 flex items-center justify-between text-xs font-sans shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold text-slate-700">Rysunek CAD na żywo</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500 text-[11px]">
                  Aktualizuje się automatycznie wraz ze zmianą wymiarów i kwater
                </span>
              </div>
              <div className="font-mono text-[11px] text-slate-600">
                Skala: 1:{Math.round(Math.max(widthMm, heightMm) / 400)}
              </div>
            </div>

            {/* Płótno CAD */}
            <div className="flex-1 min-h-0 relative overflow-hidden flex flex-col">
              <CadCanvas
                key={`${widthMm}-${heightMm}-${panesCount}`}
                item={liveCadItem}
                initialZoom={1}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
