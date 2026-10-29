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
  ArrowLeft,
  ArrowRight,
  FileText,
  Calculator,
} from "lucide-react";
import { calculateGlassSystemPricing } from "@/lib/glassPricing";

export type CategoryDoc = Doc<"constructionCategories">;
export type ConstructionDoc = Doc<"constructions">;

export interface GlassSystemPreset {
  id: string;
  tracks: number;
  widthMm: number;
  heightMm: number;
  label: string;
  sublabel: string;
  systemCostNet?: number;
  brushesCostNet?: number;
  handlesCostNet?: number;
}

export const GLASS_SYSTEM_PRESETS: GlassSystemPreset[] = [
  { id: "2t-194", tracks: 2, widthMm: 1940, heightMm: 2300, label: "System 2-torowy", sublabel: "194 cm / wys. 230 cm", systemCostNet: 1572, brushesCostNet: 65, handlesCostNet: 57 },
  { id: "3t-241", tracks: 3, widthMm: 2410, heightMm: 2300, label: "System 3-torowy", sublabel: "241 cm / wys. 230 cm", systemCostNet: 2470, brushesCostNet: 89, handlesCostNet: 81 },
  { id: "3t-290", tracks: 3, widthMm: 2900, heightMm: 2300, label: "System 3-torowy", sublabel: "290 cm / wys. 230 cm", systemCostNet: 2470, brushesCostNet: 89, handlesCostNet: 81 },
  { id: "4t-337", tracks: 4, widthMm: 3370, heightMm: 2300, label: "System 4-torowy", sublabel: "337 cm / wys. 230 cm", systemCostNet: 3367, brushesCostNet: 122, handlesCostNet: 114 },
  { id: "4t-386", tracks: 4, widthMm: 3860, heightMm: 2300, label: "System 4-torowy", sublabel: "386 cm / wys. 230 cm", systemCostNet: 3367, brushesCostNet: 122, handlesCostNet: 114 },
  { id: "5t-433", tracks: 5, widthMm: 4330, heightMm: 2300, label: "System 5-torowy", sublabel: "433 cm / wys. 230 cm", systemCostNet: 4265, brushesCostNet: 154, handlesCostNet: 138 },
  { id: "5t-482", tracks: 5, widthMm: 4820, heightMm: 2300, label: "System 5-torowy", sublabel: "482 cm / wys. 230 cm", systemCostNet: 4265, brushesCostNet: 154, handlesCostNet: 138 },
  { id: "6t-529", tracks: 6, widthMm: 5290, heightMm: 2300, label: "System 6-torowy", sublabel: "529 cm / wys. 230 cm", systemCostNet: 5325, brushesCostNet: 187, handlesCostNet: 163 },
  { id: "6t-578", tracks: 6, widthMm: 5780, heightMm: 2300, label: "System 6-torowy", sublabel: "578 cm / wys. 230 cm", systemCostNet: 5325, brushesCostNet: 187, handlesCostNet: 163 },
];

interface CadConstructionDesignerModalProps {
  isOpen?: boolean;
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
    defaultWidthMm?: number;
    defaultHeightMm?: number;
    defaultPanesCount?: number;
    defaultFillType?: string;
    defaultWarning?: string;
    defaultPriceNet?: number;
    materialCostNet?: number;
    brushesCostNet?: number;
    handlesCostNet?: number;
    materialMarkupType?: "percent" | "amount";
    materialMarkupValue?: number;
    materialPriceNet?: number;
    installationUnit?: "m2" | "mb" | "fixed";
    installationUnitRate?: number;
    installationCostNet?: number;
    installationMarkupType?: "percent" | "amount";
    installationMarkupValue?: number;
    installationPriceNet?: number;
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

  // Aktywna zakładka panelu bocznego (Parametry CAD vs Cennik i marża)
  const [activeSidebarTab, setActiveSidebarTab] = useState<"params" | "pricing">("params");

  // Form State - podstawowe parametry konstrukcji CAD
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [categoryName, setCategoryName] = useState("");
  const [hasDescription, setHasDescription] = useState(false);
  const [description, setDescription] = useState("");
  const [hasDimensions, setHasDimensions] = useState(true);
  const [widthMm, setWidthMm] = useState(2880);
  const [heightMm, setHeightMm] = useState(2300);
  const [hasTracks, setHasTracks] = useState(true);
  const [panesCount, setPanesCount] = useState<number | null>(3);

  // Wskaźniki wymiarowe
  const areaM2 = Math.round(widthMm * heightMm * 0.000001 * 100) / 100;
  const widthMb = Math.round((widthMm / 1000) * 100) / 100;

  // Filar 1: Koszt i narzut na materiał
  const [materialCostNet, setMaterialCostNet] = useState<number | "">("");
  const [brushesCostNet, setBrushesCostNet] = useState<number | "">("");
  const [handlesCostNet, setHandlesCostNet] = useState<number | "">("");
  const [materialMarkupType, setMaterialMarkupType] = useState<"percent" | "amount">("percent");
  const [materialMarkupValue, setMaterialMarkupValue] = useState<number | "">("");

  // Filar 2: Jednostka, stawka, koszt i narzut na montaż
  const [installationUnit, setInstallationUnit] = useState<"m2" | "mb" | "fixed">("m2");
  const [installationUnitRate, setInstallationUnitRate] = useState<number | "">("");
  const [installationCostNet, setInstallationCostNet] = useState<number | "">("");
  const [installationMarkupType, setInstallationMarkupType] = useState<"percent" | "amount">("percent");
  const [installationMarkupValue, setInstallationMarkupValue] = useState<number | "">("");

  // Wartości domyślne / zachowywane w tle dla zgodności z modelem danych
  const [systemName, setSystemName] = useState("");
  const [hasGlassAndColor, setHasGlassAndColor] = useState(true);
  const [color, setColor] = useState("RAL 7016MAT");
  const [fillType, setFillType] = useState("HART 10");
  const [warning, setWarning] = useState("");

  const [saving, setSaving] = useState(false);

  // Pomocnik kalkulacji ceny jednostkowej pozycji (koszt + narzut)
  const calcItemPrice = (cost: number | "", type: "percent" | "amount", markup: number | ""): number => {
    if (cost === "" || cost === 0) return 0;
    if (markup === "" || markup === 0) return typeof cost === "number" ? cost : 0;
    if (type === "percent") {
      return Math.round(cost * (1 + markup / 100));
    }
    return Math.round(cost + markup);
  };

  const numBaseMatCost = typeof materialCostNet === "number" ? materialCostNet : 0;
  const numBrushesCost = typeof brushesCostNet === "number" ? brushesCostNet : 0;
  const numHandlesCost = typeof handlesCostNet === "number" ? handlesCostNet : 0;
  const totalMaterialCost = numBaseMatCost + numBrushesCost + numHandlesCost;

  const computedMaterialPrice = useMemo(
    () => calcItemPrice(totalMaterialCost > 0 ? totalMaterialCost : materialCostNet, materialMarkupType, materialMarkupValue),
    [totalMaterialCost, materialCostNet, materialMarkupType, materialMarkupValue]
  );

  const computedInstallationCost = useMemo(() => {
    if (installationUnit === "m2") {
      if (typeof installationUnitRate !== "number" || installationUnitRate <= 0) return 0;
      return Math.round(installationUnitRate * areaM2);
    }
    if (installationUnit === "mb") {
      if (typeof installationUnitRate !== "number" || installationUnitRate <= 0) return 0;
      return Math.round(installationUnitRate * (widthMm / 1000));
    }
    return typeof installationCostNet === "number" ? installationCostNet : 0;
  }, [installationUnit, installationUnitRate, installationCostNet, areaM2, widthMm]);

  const computedClientInstallationUnitRate = useMemo(() => {
    if (installationUnit === "fixed" || typeof installationUnitRate !== "number" || installationUnitRate <= 0) return 0;
    const markupVal = typeof installationMarkupValue === "number" ? installationMarkupValue : 0;
    if (installationMarkupType === "percent") {
      return Math.round(installationUnitRate * (1 + markupVal / 100));
    }
    return Math.round(installationUnitRate + markupVal);
  }, [installationUnit, installationUnitRate, installationMarkupType, installationMarkupValue]);

  const computedInstallationPrice = useMemo(() => {
    if (installationUnit === "m2") {
      if (typeof installationUnitRate !== "number" || installationUnitRate <= 0) return 0;
      return Math.round(computedClientInstallationUnitRate * areaM2);
    }
    if (installationUnit === "mb") {
      if (typeof installationUnitRate !== "number" || installationUnitRate <= 0) return 0;
      return Math.round(computedClientInstallationUnitRate * (widthMm / 1000));
    }
    return calcItemPrice(computedInstallationCost, installationMarkupType, installationMarkupValue);
  }, [
    installationUnit,
    installationUnitRate,
    computedClientInstallationUnitRate,
    areaM2,
    widthMm,
    computedInstallationCost,
    installationMarkupType,
    installationMarkupValue,
  ]);

  // Liczbowe wartości kosztów, cen i rentowności materiału
  const numMatCost = totalMaterialCost > 0 ? totalMaterialCost : (typeof materialCostNet === "number" ? materialCostNet : 0);
  const numMatPrice = computedMaterialPrice;
  const materialProfit = numMatPrice - numMatCost;
  const materialMarginPercent = numMatPrice > 0 ? Math.round((materialProfit / numMatPrice) * 100) : 0;

  // Liczbowe wartości kosztów, cen i rentowności montażu
  const numInstCost = computedInstallationCost;
  const numInstPrice = computedInstallationPrice;
  const installationProfit = numInstPrice - numInstCost;
  const installationMarginPercent = numInstPrice > 0 ? Math.round((installationProfit / numInstPrice) * 100) : 0;

  // Łączne wartości pozycji (handlowiec)
  const totalCost = numMatCost + numInstCost;
  const totalPrice = numMatPrice + numInstPrice;
  const totalProfit = totalPrice - totalCost;
  const totalMarginPercent = totalPrice > 0 ? Math.round((totalProfit / totalPrice) * 100) : 0;

  // Inicjalizacja danych po otwarciu
  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setName(initialData.name || "");
      setCode(initialData.code || "");
      setCategoryId(initialData.categoryId || "");
      setCategoryName(initialData.category || "");

      const hasDefDesc = Boolean(initialData.description && initialData.description.trim().length > 0);
      setHasDescription(hasDefDesc);
      setDescription(initialData.description || "");

      const hasDefDims =
        initialData.defaultWidthMm !== undefined &&
        initialData.defaultWidthMm !== null &&
        initialData.defaultHeightMm !== undefined &&
        initialData.defaultHeightMm !== null;
      setHasDimensions(hasDefDims);
      setWidthMm(initialData.defaultWidthMm || 2880);
      setHeightMm(initialData.defaultHeightMm || 2300);

      const hasDefPanes =
        initialData.defaultPanesCount !== undefined &&
        initialData.defaultPanesCount !== null &&
        initialData.defaultPanesCount > 0;
      setHasTracks(hasDefPanes);
      setPanesCount(hasDefPanes ? initialData.defaultPanesCount! : null);

      // Filar 1: Materiał
      const matCost =
        initialData.materialCostNet !== undefined && initialData.materialCostNet !== null
          ? initialData.materialCostNet
          : "";
      setMaterialCostNet(matCost);
      const brushes =
        initialData.brushesCostNet !== undefined && initialData.brushesCostNet !== null
          ? initialData.brushesCostNet
          : "";
      setBrushesCostNet(brushes);
      const handles =
        initialData.handlesCostNet !== undefined && initialData.handlesCostNet !== null
          ? initialData.handlesCostNet
          : "";
      setHandlesCostNet(handles);
      const matType = initialData.materialMarkupType || "percent";
      setMaterialMarkupType(matType);
      const matMarkup =
        initialData.materialMarkupValue !== undefined && initialData.materialMarkupValue !== null
          ? initialData.materialMarkupValue
          : "";
      setMaterialMarkupValue(matMarkup);

      // Filar 2: Montaż
      const isGlass =
        (initialData.category && initialData.category.toLowerCase().includes("szklan")) ||
        (categoryName && categoryName.toLowerCase().includes("szklan"));
      const defaultUnit = isGlass ? "mb" : "m2";
      const instUnit =
        (initialData.installationUnit as "m2" | "mb" | "fixed") ||
        (initialData.installationUnitRate
          ? defaultUnit
          : initialData.installationCostNet
          ? "fixed"
          : defaultUnit);
      setInstallationUnit(instUnit);
      const instRate =
        initialData.installationUnitRate !== undefined && initialData.installationUnitRate !== null
          ? initialData.installationUnitRate
          : "";
      setInstallationUnitRate(instRate);
      const instCost =
        initialData.installationCostNet !== undefined && initialData.installationCostNet !== null
          ? initialData.installationCostNet
          : "";
      setInstallationCostNet(instCost);
      const instType = initialData.installationMarkupType || "percent";
      setInstallationMarkupType(instType);
      const instMarkup =
        initialData.installationMarkupValue !== undefined && initialData.installationMarkupValue !== null
          ? initialData.installationMarkupValue
          : "";
      setInstallationMarkupValue(instMarkup);

      setSystemName(initialData.defaultSystem || "");

      const hasDefGlassAndColor = Boolean(
        (initialData.defaultColor && initialData.defaultColor.trim().length > 0) ||
        (initialData.defaultFillType && initialData.defaultFillType.trim().length > 0)
      );
      setHasGlassAndColor(hasDefGlassAndColor);
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
      setHasDescription(false);
      setDescription("");
      setHasDimensions(true);
      setWidthMm(isDefaultGlass ? 2410 : 2000);
      setHeightMm(2300);
      setHasTracks(isDefaultGlass);
      setPanesCount(isDefaultGlass ? 3 : null);
      setMaterialCostNet("");
      setMaterialMarkupType("percent");
      setMaterialMarkupValue("");
      setInstallationUnit("m2");
      setInstallationUnitRate("");
      setInstallationCostNet("");
      setInstallationMarkupType("percent");
      setInstallationMarkupValue("");
      setSystemName("");
      setHasGlassAndColor(true);
      setColor("RAL 7016MAT");
      setFillType("HART 10");
      setWarning("");
    }
  }, [isOpen, initialData, categories]);

  const toggleHasTracks = (enabled: boolean) => {
    setHasTracks(enabled);
    if (!enabled) {
      setPanesCount(null);
    } else {
      setPanesCount(3);
    }
  };

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
    }
  };

  // Automatyczny kod konstrukcji na podstawie wymiarów i torów
  const generateCode = () => {
    const parts = ["CAD"];
    if (hasTracks && panesCount) {
      parts.push(`${panesCount}T`);
    }
    if (hasDimensions) {
      parts.push(`${widthMm}x${heightMm}`);
    }
    setCode(parts.length > 1 ? parts.join("-") : "CAD-PROJEKT");
  };

  // Wskaźniki techniczne
  const singlePaneWidthMm = hasTracks && panesCount && panesCount > 0 ? Math.round(widthMm / panesCount) : widthMm;

  // Konstrukcja dla podglądu na żywo w CadCanvas
  const liveCadItem: CadConstructionItem = useMemo(() => {
    const panes = hasTracks && panesCount && panesCount > 0 ? panesCount : 1;
    return {
      _id: initialData?._id || "temp-designer-preview",
      positionIndex: 1,
      name: name || "Nowa konstrukcja CAD",
      shortName: code || "CAD",
      description: hasDescription && description.trim() ? description.trim() : undefined,
      warning: warning || undefined,
      color: hasGlassAndColor && color.trim() ? color.trim() : "RAL 7016MAT",
      systemName: systemName || undefined,
      quantity: 1,
      widthMm: Math.max(400, widthMm),
      heightMm: Math.max(400, heightMm),
      panesCount: panes,
      fillType: hasGlassAndColor && fillType.trim() ? fillType.trim() : "HART 10",
      priceNet: totalPrice,
      costNet: totalCost,
      segments: Array.from({ length: panes }).map((_, i) => ({
        widthMm: i === panes - 1 ? widthMm - singlePaneWidthMm * (panes - 1) : singlePaneWidthMm,
        heightMm: Math.max(200, heightMm - 103),
        fill: hasGlassAndColor && fillType.trim() ? fillType.trim() : "HART 10",
        weightKg: Math.round((singlePaneWidthMm * heightMm * 0.000001 * 25) * 10) / 10,
        profileTop: `5448 ${color || "RAL 7016MAT"}`,
        profileBottom: `5450 ${color || "RAL 7016MAT"}`,
        profileLeft: `5450 ${color || "RAL 7016MAT"}`,
        profileRight: `5450 ${color || "RAL 7016MAT"}`,
      })),
    };
  }, [
    initialData?._id,
    name,
    code,
    hasDescription,
    description,
    warning,
    hasGlassAndColor,
    color,
    systemName,
    widthMm,
    heightMm,
    hasTracks,
    panesCount,
    fillType,
    totalPrice,
    totalCost,
    singlePaneWidthMm,
  ]);

  // Obsługa zapisu
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    let finalCode = code.trim().toUpperCase();
    if (!finalCode) {
      const parts = ["CAD"];
      if (hasTracks && panesCount) {
        parts.push(`${panesCount}T`);
      }
      if (hasDimensions) {
        parts.push(`${widthMm}x${heightMm}`);
      }
      finalCode = parts.length > 1 ? parts.join("-") : "CAD-PROJEKT";
    }

    const combinedPrice = computedMaterialPrice + computedInstallationPrice;

    setSaving(true);
    try {
      await onSave({
        id: initialData?._id,
        name: name.trim(),
        code: finalCode,
        categoryId: categoryId ? (categoryId as Id<"constructionCategories">) : undefined,
        category: categoryName.trim() || undefined,
        description: hasDescription && description.trim() ? description.trim() : undefined,
        defaultSystem: systemName.trim() || undefined,
        defaultColor: hasGlassAndColor && color.trim() ? color.trim() : undefined,
        defaultWidthMm: hasDimensions ? widthMm : undefined,
        defaultHeightMm: hasDimensions ? heightMm : undefined,
        defaultPanesCount: hasTracks && panesCount ? panesCount : undefined,
        defaultFillType: hasGlassAndColor && fillType.trim() ? fillType.trim() : undefined,
        defaultWarning: warning.trim() || undefined,
        defaultPriceNet: combinedPrice > 0 ? combinedPrice : undefined,
        materialCostNet: typeof materialCostNet === "number" ? materialCostNet : undefined,
        brushesCostNet: typeof brushesCostNet === "number" ? brushesCostNet : undefined,
        handlesCostNet: typeof handlesCostNet === "number" ? handlesCostNet : undefined,
        materialMarkupType: materialCostNet !== "" ? materialMarkupType : undefined,
        materialMarkupValue: typeof materialMarkupValue === "number" ? materialMarkupValue : undefined,
        materialPriceNet: computedMaterialPrice > 0 ? computedMaterialPrice : undefined,
        installationUnit: installationUnit,
        installationUnitRate: typeof installationUnitRate === "number" ? installationUnitRate : undefined,
        installationCostNet: computedInstallationCost > 0 ? computedInstallationCost : undefined,
        installationMarkupType: computedInstallationCost > 0 ? installationMarkupType : undefined,
        installationMarkupValue: typeof installationMarkupValue === "number" ? installationMarkupValue : undefined,
        installationPriceNet: computedInstallationPrice > 0 ? computedInstallationPrice : undefined,
      });
      onClose();
    } catch (err) {
      console.error("Błąd podczas zapisywania szablonu konstrukcji:", err);
    } finally {
      setSaving(false);
    }
  };

  if (isOpen !== undefined && !isOpen) return null;

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-210px)] min-h-[680px]">
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TOP HEADER: Status, Tytuł, Akcje Zapisu                                */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="h-14 px-5 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 -ml-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Wróć do listy konstrukcji"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center text-white shadow-xs shadow-cyan-600/30">
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
            {/* Przełącznik zakładek panelu bocznego: Parametry CAD vs Cennik i marża */}
            <div className="h-11 bg-slate-50 border-b border-slate-200 px-3 flex items-center justify-between shrink-0 gap-2">
              <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-200/80 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveSidebarTab("params")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all cursor-pointer ${
                    activeSidebarTab === "params"
                      ? "bg-white text-slate-900 shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Sliders size={13} className={activeSidebarTab === "params" ? "text-cyan-600" : "text-slate-500"} />
                  <span>Parametry CAD</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSidebarTab("pricing")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all cursor-pointer ${
                    activeSidebarTab === "pricing"
                      ? "bg-white text-slate-900 shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <DollarSign size={13} className={activeSidebarTab === "pricing" ? "text-cyan-600" : "text-slate-500"} />
                  <span>Cennik i marża</span>
                  {totalPrice > 0 && (
                    <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold ml-0.5">
                      {totalPrice.toLocaleString("pl-PL")} zł
                    </span>
                  )}
                </button>
              </div>

              <span className="font-mono text-[10px] text-slate-500">
                {hasDimensions ? `${widthMm} × ${heightMm}` : "—"}
              </span>
            </div>

            {/* Zawartość formularza parametrów */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {activeSidebarTab === "params" ? (
                <>
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
              </div>

              {/* Kafel szybkiego przejścia do cennika i marży */}
              <div
                onClick={() => setActiveSidebarTab("pricing")}
                className="bg-emerald-50/70 hover:bg-emerald-50/90 border border-emerald-200 rounded-xl p-3 flex items-center justify-between cursor-pointer transition-colors shadow-2xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                    <DollarSign size={16} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-emerald-950 block uppercase tracking-wider">
                      Cennik pozycji CAD
                    </span>
                    {totalPrice > 0 ? (
                      <div className="flex items-center gap-1.5 text-[11px] font-mono flex-wrap">
                        <span className="text-slate-700">
                          Mat: <strong className="text-slate-900">{numMatPrice > 0 ? `${numMatPrice.toLocaleString("pl-PL")} zł` : "—"}</strong>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-700">
                          Montaż: <strong className="text-slate-900">{numInstPrice > 0 ? `${numInstPrice.toLocaleString("pl-PL")} zł` : "—"}</strong>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="font-bold text-emerald-700">
                          Razem: {totalPrice.toLocaleString("pl-PL")} zł
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-500 font-medium">
                        Brak cen — kliknij, aby ustawić materiał i montaż
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 shrink-0 ml-2">
                  <span>Cennik</span>
                  <ArrowRight size={13} />
                </div>
              </div>
              {/* Liczba torów w szablonie (opcjonalny blok) */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5 transition-all">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={hasTracks}
                      onClick={() => toggleHasTracks(!hasTracks)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        hasTracks ? "bg-cyan-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          hasTracks ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                    <label
                      onClick={() => toggleHasTracks(!hasTracks)}
                      className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 cursor-pointer select-none"
                    >
                      <Layers size={13} className="text-cyan-600" /> Liczba torów
                      <span className="text-[10px] text-slate-400 font-normal lowercase">(opcjonalnie)</span>
                    </label>
                  </div>

                  {hasTracks && panesCount ? (
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded border text-cyan-800 bg-cyan-50 border-cyan-200">
                      {panesCount} {panesCount === 1 ? "tor" : panesCount < 5 ? "tory" : "torów"}
                    </span>
                  ) : null}
                </div>

                {!hasTracks ? (
                  <p className="text-[10px] text-slate-500">
                    Konstrukcja nie posiada torów jezdnych (np. fix, trójkąt, zadaszenie). Włącz przełącznik powyżej, jeśli ta konstrukcja ma posiadać tory.
                  </p>
                ) : (
                  <>
                    <p className="text-[10px] text-slate-500">
                      Ustaw domyślną liczbę torów dla tej konstrukcji przesuwnej:
                    </p>

                    {/* Przyciski szybkiego wyboru liczby torów */}
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => setPanesCount(cnt)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer border ${
                            panesCount === cnt
                              ? "bg-cyan-600 text-white border-cyan-700 shadow-xs ring-2 ring-cyan-500/20"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                          }`}
                        >
                          {cnt}T
                        </button>
                      ))}
                    </div>

                    {/* Parametry skrzydła wyliczone */}
                    <div className="bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between font-mono text-[11px] mt-1">
                      <span className="text-slate-500 font-sans">Szerokość 1 skrzydła na torze:</span>
                      <span className="font-bold text-slate-900">~{singlePaneWidthMm} mm</span>
                    </div>

                    {/* Warianty gotowych systemów szklanych */}
                    {isGlassCategory && (
                      <div className="pt-2 border-t border-slate-200 space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                          Lub wybierz gotowy wariant wymiarowy:
                        </span>
                        <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-0.5">
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
                                  setHasDimensions(true);
                                  if (preset.systemCostNet !== undefined) {
                                    setMaterialCostNet(preset.systemCostNet);
                                  }
                                  if (preset.brushesCostNet !== undefined) {
                                    setBrushesCostNet(preset.brushesCostNet);
                                  }
                                  if (preset.handlesCostNet !== undefined) {
                                    setHandlesCostNet(preset.handlesCostNet);
                                  }
                                  setMaterialMarkupType("percent");
                                  setMaterialMarkupValue(52);
                                  // Systemy szklane w Excelu montaż mają rozliczany z metrów bieżących (250 zł/mb ekipa, 300 zł/mb klient)
                                  setInstallationUnit("mb");
                                  setInstallationUnitRate(250);
                                  setInstallationMarkupType("percent");
                                  setInstallationMarkupValue(20);
                                }}
                                className={`w-full text-left p-2 rounded-lg border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                                  isSelected
                                    ? "bg-cyan-50/90 border-cyan-500 shadow-xs ring-1 ring-cyan-500/30"
                                    : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80"
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={`w-5 h-5 rounded flex items-center justify-center font-mono font-bold text-[10px] shrink-0 ${
                                      isSelected
                                        ? "bg-cyan-600 text-white"
                                        : "bg-slate-100 text-slate-700"
                                    }`}
                                  >
                                    {preset.tracks}T
                                  </span>
                                  <div className="min-w-0">
                                    <span
                                      className={`font-bold text-[11px] block ${
                                        isSelected ? "text-cyan-950 font-bold" : "text-slate-800"
                                      }`}
                                    >
                                      {preset.label}
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-500">
                                      {preset.sublabel}
                                    </span>
                                  </div>
                                </div>

                                <div className="shrink-0 flex items-center gap-1.5">
                                  <span className="font-mono font-semibold text-[10px] text-slate-500 bg-slate-100 px-1 py-0.5 rounded">
                                    {preset.widthMm} × {preset.heightMm} mm
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Wymiary gabarytowe (opcjonalny blok) */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5 transition-all">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={hasDimensions}
                      onClick={() => setHasDimensions(!hasDimensions)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        hasDimensions ? "bg-cyan-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          hasDimensions ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                    <label
                      onClick={() => setHasDimensions(!hasDimensions)}
                      className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 cursor-pointer select-none"
                    >
                      <Ruler size={13} className="text-cyan-600" /> Wymiary całkowite [mm]
                      <span className="text-[10px] text-slate-400 font-normal lowercase">(opcjonalnie)</span>
                    </label>
                  </div>

                  {hasDimensions ? (
                    <span className="font-mono text-[10px] text-cyan-700 font-bold bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                      {widthMm} × {heightMm} mm
                    </span>
                  ) : null}
                </div>

                {!hasDimensions ? (
                  <p className="text-[10px] text-slate-500">
                    Konstrukcja nie posiada narzuconych wymiarów gabarytowych. Włącz przełącznik powyżej, jeśli ta konstrukcja ma posiadać domyślne wymiary.
                  </p>
                ) : (
                  <div className="space-y-3 pt-1">
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
                )}
              </div>

              {/* Specyfikacja materiałowa: Szklenie i Kolorystyka (opcjonalny blok) */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5 transition-all">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={hasGlassAndColor}
                      onClick={() => setHasGlassAndColor(!hasGlassAndColor)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        hasGlassAndColor ? "bg-cyan-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          hasGlassAndColor ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                    <label
                      onClick={() => setHasGlassAndColor(!hasGlassAndColor)}
                      className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 cursor-pointer select-none"
                    >
                      <Palette size={13} className="text-cyan-600" /> Szklenie i Kolorystyka profili
                      <span className="text-[10px] text-slate-400 font-normal lowercase">(opcjonalnie)</span>
                    </label>
                  </div>

                  {hasGlassAndColor && (fillType || color) ? (
                    <span className="font-mono text-[10px] text-cyan-700 font-bold bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200 truncate max-w-[170px]">
                      {[fillType, color].filter(Boolean).join(" • ")}
                    </span>
                  ) : null}
                </div>

                {!hasGlassAndColor ? (
                  <p className="text-[10px] text-slate-500">
                    Brak domyślnego szklenia i koloru. Włącz przełącznik powyżej, jeśli chcesz zdefiniować domyślne wypełnienie oraz kod RAL dla tej konstrukcji.
                  </p>
                ) : (
                  <div className="space-y-3 pt-1">
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
                )}
              </div>

              {/* Opis techniczny szablonu (opcjonalny blok) */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5 transition-all">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={hasDescription}
                      onClick={() => setHasDescription(!hasDescription)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        hasDescription ? "bg-cyan-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          hasDescription ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                    <label
                      onClick={() => setHasDescription(!hasDescription)}
                      className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 cursor-pointer select-none"
                    >
                      <FileText size={13} className="text-cyan-600" /> Opis techniczny szablonu
                      <span className="text-[10px] text-slate-400 font-normal lowercase">(opcjonalnie)</span>
                    </label>
                  </div>
                </div>

                {!hasDescription ? (
                  <p className="text-[10px] text-slate-500">
                    Brak opisu technicznego. Włącz przełącznik powyżej, jeśli chcesz dodać szczegółowe notatki, wytyczne montażowe lub specyfikację szablonu.
                  </p>
                ) : (
                  <div className="pt-1">
                    <textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Krótki opis przeznaczenia, montażu i parametrów"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-700 text-xs focus:outline-none focus:border-cyan-500 resize-none"
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ══════════════════════════════════════════════════════════════════════ */
            /* DEDYKOWANY OSOBNY WIDOK: CENNIK I KALKULACJA MARŻY                    */
            /* ══════════════════════════════════════════════════════════════════════ */
            <div className="space-y-3.5 animate-in fade-in duration-150">
              {/* Karta kontekstowa konstrukcji */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <span className="text-xs font-bold text-slate-800 block truncate">
                    {name || "Nowa konstrukcja CAD"}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium truncate block">
                    {categoryName || "Brak kategorii"} · {hasDimensions ? `${widthMm} × ${heightMm} mm` : "Wymiary dowolne"}
                    {hasTracks && panesCount ? ` · ${panesCount}T` : ""}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSidebarTab("params")}
                  className="text-[10px] font-semibold text-cyan-600 hover:text-cyan-800 flex items-center gap-0.5 shrink-0 cursor-pointer"
                >
                  <span>Parametry</span>
                  <ArrowRight size={11} />
                </button>
              </div>

              {/* Przelicz z kalkulatora szkła (Excel) */}
              {isGlassCategory && (
                <button
                  type="button"
                  onClick={() => {
                    const calc = calculateGlassSystemPricing(widthMm, heightMm);
                    setMaterialCostNet(calc.systemCostNet);
                    setBrushesCostNet(calc.brushesCostNet);
                    setHandlesCostNet(calc.handlesCostNet);
                    setMaterialMarkupType("percent");
                    setMaterialMarkupValue(52);
                    setInstallationUnit("mb");
                    setInstallationUnitRate(250);
                    setInstallationMarkupType("percent");
                    setInstallationMarkupValue(20);
                  }}
                  className="w-full text-center text-xs font-semibold text-cyan-800 hover:text-cyan-950 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 py-2 px-3 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                  title="Wczytaj automatycznie koszty i ceny z oficjalnego kalkulatora szkła (Excel)"
                >
                  <Calculator size={14} className="text-cyan-600" />
                  <span>Przelicz z kalkulatora szkła (Excel)</span>
                </button>
              )}

              {/* 1. KOSZT I NARZUT NA MATERIAŁ */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-cyan-100 text-cyan-800 flex items-center justify-center text-[10px] font-bold">1</span>
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800 block">
                        Materiał
                      </span>
                      <span className="text-[9px] text-slate-400">Konstrukcja, profile, szklenie, akcesoria</span>
                    </div>
                  </div>
                  {computedMaterialPrice > 0 ? (
                    <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      Cena: <strong className="text-slate-900">{computedMaterialPrice.toLocaleString("pl-PL")} zł</strong>
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium">Brak ceny</span>
                  )}
                </div>

                {/* Koszt bazowy + Narzut */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <div className="h-6 flex items-center mb-1">
                      <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                        Koszt materiału
                      </label>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        step={50}
                        value={materialCostNet}
                        onChange={(e) => {
                          const val = e.target.value === "" ? "" : Math.max(0, parseFloat(e.target.value) || 0);
                          setMaterialCostNet(val);
                        }}
                        placeholder="0"
                        className="w-full h-8 bg-slate-50 border border-slate-300 rounded-lg px-2.5 text-slate-900 font-mono font-bold focus:outline-none focus:border-cyan-500 text-xs pr-7"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-[10px] pointer-events-none">
                        zł
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="h-6 flex items-center justify-between mb-1">
                      <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider truncate mr-1">
                        Narzut na materiał
                      </label>
                      <div className="inline-flex rounded border border-slate-200 overflow-hidden bg-slate-100 text-[9px] font-bold shrink-0">
                        <button
                          type="button"
                          onClick={() => setMaterialMarkupType("percent")}
                          className={`px-1.5 py-0.5 transition-colors cursor-pointer ${
                            materialMarkupType === "percent" ? "bg-cyan-600 text-white" : "text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          %
                        </button>
                        <button
                          type="button"
                          onClick={() => setMaterialMarkupType("amount")}
                          className={`px-1.5 py-0.5 transition-colors cursor-pointer ${
                            materialMarkupType === "amount" ? "bg-cyan-600 text-white" : "text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          zł
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        step={materialMarkupType === "percent" ? 5 : 50}
                        value={materialMarkupValue}
                        onChange={(e) => {
                          const val = e.target.value === "" ? "" : Math.max(0, parseFloat(e.target.value) || 0);
                          setMaterialMarkupValue(val);
                        }}
                        placeholder="0"
                        className="w-full h-8 bg-slate-50 border border-slate-300 rounded-lg px-2.5 text-slate-900 font-mono font-bold focus:outline-none focus:border-cyan-500 text-xs pr-7"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-[10px] pointer-events-none">
                        {materialMarkupType === "percent" ? "%" : "zł"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dodatki szklarskie: Szczotki kpl i Uchwyty kpl */}
                <div className="pt-2.5 border-t border-slate-100 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                      Akcesoria szklarskie (szczotki i uchwyty)
                    </label>
                    {(numBrushesCost > 0 || numHandlesCost > 0) && (
                      <span className="text-[10px] font-mono text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200">
                        Suma materiału: {totalMaterialCost.toLocaleString("pl-PL")} zł
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[9px] text-slate-500 font-medium mb-1">
                        Szczotki kpl
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          step={5}
                          value={brushesCostNet}
                          onChange={(e) => {
                            const val = e.target.value === "" ? "" : Math.max(0, parseFloat(e.target.value) || 0);
                            setBrushesCostNet(val);
                          }}
                          placeholder="0"
                          className="w-full h-8 bg-slate-50 border border-slate-300 rounded-lg px-2.5 text-slate-900 font-mono font-bold focus:outline-none focus:border-cyan-500 text-xs pr-7"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-[10px] pointer-events-none">
                          zł
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] text-slate-500 font-medium mb-1">
                        Uchwyty kpl
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          step={5}
                          value={handlesCostNet}
                          onChange={(e) => {
                            const val = e.target.value === "" ? "" : Math.max(0, parseFloat(e.target.value) || 0);
                            setHandlesCostNet(val);
                          }}
                          placeholder="0"
                          className="w-full h-8 bg-slate-50 border border-slate-300 rounded-lg px-2.5 text-slate-900 font-mono font-bold focus:outline-none focus:border-cyan-500 text-xs pr-7"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-[10px] pointer-events-none">
                          zł
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. KOSZT I NARZUT NA MONTAŻ */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-cyan-100 text-cyan-800 flex items-center justify-center text-[10px] font-bold">2</span>
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800 block">
                        Montaż
                      </span>
                      <span className="text-[9px] text-slate-400">Robocizna, transport, ekipa montażowa</span>
                    </div>
                  </div>
                  {computedInstallationPrice > 0 ? (
                    <div className="text-right">
                      <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 inline-block">
                        Cena: <strong className="text-slate-900">{computedInstallationPrice.toLocaleString("pl-PL")} zł</strong>
                      </span>
                      {installationUnit !== "fixed" && typeof installationUnitRate === "number" && installationUnitRate > 0 && (
                        <span className="text-[9px] text-slate-400 font-mono block mt-0.5">
                          stawka klienta: {computedClientInstallationUnitRate > 0 ? computedClientInstallationUnitRate : installationUnitRate} zł/{installationUnit} (koszt: {installationUnitRate} zł/{installationUnit})
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium">Brak ceny</span>
                  )}
                </div>

                {/* Wybór jednostki miary montażu: m2 | mb | fixed */}
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 flex items-center justify-between gap-1.5">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider shrink-0">
                    Rozliczenie:
                  </span>
                  <div className="inline-flex rounded-md border border-slate-200 p-0.5 bg-white text-[10px] font-bold shrink-0">
                    <button
                      type="button"
                      onClick={() => setInstallationUnit("m2")}
                      className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                        installationUnit === "m2"
                          ? "bg-cyan-600 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                      title="Kalkulacja wg powierzchni w m²"
                    >
                      m²
                    </button>
                    <button
                      type="button"
                      onClick={() => setInstallationUnit("mb")}
                      className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                        installationUnit === "mb"
                          ? "bg-cyan-600 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                      title="Kalkulacja wg szerokości w mb"
                    >
                      mb
                    </button>
                    <button
                      type="button"
                      onClick={() => setInstallationUnit("fixed")}
                      className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                        installationUnit === "fixed"
                          ? "bg-cyan-600 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                      title="Stała kwota bez przeliczania"
                    >
                      Ryczałt
                    </button>
                  </div>
                </div>

                {/* Koszt bazowy + Narzut */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <div className="h-6 flex items-center justify-between mb-1">
                      <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider truncate">
                        {installationUnit === "m2"
                          ? "Stawka za m²"
                          : installationUnit === "mb"
                          ? "Stawka za mb"
                          : "Koszt montażu"}
                      </label>
                      {installationUnit === "m2" && (
                        <span className="text-[9px] font-mono text-slate-400">
                          {areaM2} m²
                        </span>
                      )}
                      {installationUnit === "mb" && (
                        <span className="text-[9px] font-mono text-slate-400">
                          {widthMb} mb
                        </span>
                      )}
                    </div>
                    {installationUnit === "fixed" ? (
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          step={50}
                          value={installationCostNet}
                          onChange={(e) => {
                            const val = e.target.value === "" ? "" : Math.max(0, parseFloat(e.target.value) || 0);
                            setInstallationCostNet(val);
                          }}
                          placeholder="0"
                          className="w-full h-8 bg-slate-50 border border-slate-300 rounded-lg px-2.5 text-slate-900 font-mono font-bold focus:outline-none focus:border-cyan-500 text-xs pr-7"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-[10px] pointer-events-none">
                          zł
                        </span>
                      </div>
                    ) : (
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          step={10}
                          value={installationUnitRate}
                          onChange={(e) => {
                            const val = e.target.value === "" ? "" : Math.max(0, parseFloat(e.target.value) || 0);
                            setInstallationUnitRate(val);
                          }}
                          placeholder="0"
                          className="w-full h-8 bg-slate-50 border border-slate-300 rounded-lg px-2.5 text-slate-900 font-mono font-bold focus:outline-none focus:border-cyan-500 text-xs pr-12"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-[10px] pointer-events-none">
                          {installationUnit === "m2" ? "zł/m²" : "zł/mb"}
                        </span>
                      </div>
                    )}
                    {/* Pomocnicze wyliczenie */}
                    {installationUnit === "m2" && typeof installationUnitRate === "number" && installationUnitRate > 0 && (
                      <div className="text-[9px] text-slate-500 font-mono mt-1 truncate">
                        {areaM2} m² × {installationUnitRate} zł = <strong>{numInstCost.toLocaleString("pl-PL")} zł</strong>
                      </div>
                    )}
                    {installationUnit === "mb" && typeof installationUnitRate === "number" && installationUnitRate > 0 && (
                      <div className="text-[9px] text-slate-500 font-mono mt-1 truncate">
                        {widthMb} mb × {installationUnitRate} zł = <strong>{numInstCost.toLocaleString("pl-PL")} zł</strong>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="h-6 flex items-center justify-between mb-1">
                      <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider truncate mr-1">
                        Narzut na montaż
                      </label>
                      <div className="inline-flex rounded border border-slate-200 overflow-hidden bg-slate-100 text-[9px] font-bold shrink-0">
                        <button
                          type="button"
                          onClick={() => setInstallationMarkupType("percent")}
                          className={`px-1.5 py-0.5 transition-colors cursor-pointer ${
                            installationMarkupType === "percent" ? "bg-cyan-600 text-white" : "text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          %
                        </button>
                        <button
                          type="button"
                          onClick={() => setInstallationMarkupType("amount")}
                          className={`px-1.5 py-0.5 transition-colors cursor-pointer ${
                            installationMarkupType === "amount" ? "bg-cyan-600 text-white" : "text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          zł
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        step={installationMarkupType === "percent" ? 5 : 50}
                        value={installationMarkupValue}
                        onChange={(e) => {
                          const val = e.target.value === "" ? "" : Math.max(0, parseFloat(e.target.value) || 0);
                          setInstallationMarkupValue(val);
                        }}
                        placeholder="0"
                        className="w-full h-8 bg-slate-50 border border-slate-300 rounded-lg px-2.5 text-slate-900 font-mono font-bold focus:outline-none focus:border-cyan-500 text-xs pr-7"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-[10px] pointer-events-none">
                        {installationMarkupType === "percent"
                          ? "%"
                          : installationUnit === "m2"
                          ? "zł/m²"
                          : installationUnit === "mb"
                          ? "zł/mb"
                          : "zł"}
                      </span>
                    </div>
                    {/* Pomocnicze wyliczenie stawki klienta */}
                    {installationUnit !== "fixed" && typeof installationUnitRate === "number" && installationUnitRate > 0 && (
                      <div className="text-[9px] text-slate-500 font-mono mt-1 truncate">
                        Cena dla klienta: <strong>{computedClientInstallationUnitRate} {installationUnit === "m2" ? "zł/m²" : "zł/mb"}</strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. PODSUMOWANIE */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                    Podsumowanie
                  </span>
                  {totalPrice > 0 && (
                    <span className="text-[10px] font-mono text-slate-500">
                      Brutto (23%): <strong className="text-slate-900">{Math.round(totalPrice * 1.23).toLocaleString("pl-PL")} zł</strong>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-center font-mono">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                    <span className="text-slate-400 block font-sans text-[9px] uppercase font-semibold">Cena łączna netto</span>
                    <span className="text-sm font-bold text-emerald-700 block">
                      {totalPrice > 0 ? `${totalPrice.toLocaleString("pl-PL")} zł` : "—"}
                    </span>
                    <span className="text-[9px] text-slate-400 font-sans block mt-0.5 truncate">
                      Mat: {numMatPrice.toLocaleString("pl-PL")} zł + Montaż: {numInstPrice.toLocaleString("pl-PL")} zł
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                    <span className="text-slate-400 block font-sans text-[9px] uppercase font-semibold">Koszt łączny</span>
                    <span className="text-sm font-bold text-slate-700 block">
                      {totalCost > 0 ? `${totalCost.toLocaleString("pl-PL")} zł` : "—"}
                    </span>
                    <span className="text-[9px] text-slate-400 font-sans block mt-0.5 truncate">
                      Mat: {numMatCost.toLocaleString("pl-PL")} zł + Montaż: {numInstCost.toLocaleString("pl-PL")} zł
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                    <span className="text-slate-400 block font-sans text-[9px] uppercase font-semibold">Zysk łączny</span>
                    <span className={`text-sm font-bold block ${totalProfit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                      {totalProfit >= 0 ? `+${totalProfit.toLocaleString("pl-PL")} zł` : `${totalProfit.toLocaleString("pl-PL")} zł`}
                    </span>
                    <span className="text-[9px] text-slate-400 font-sans block mt-0.5 truncate">
                      Zysk mat: {materialProfit.toLocaleString("pl-PL")} zł · montaż: {installationProfit.toLocaleString("pl-PL")} zł
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                    <span className="text-slate-400 block font-sans text-[9px] uppercase font-semibold">Marża łączna</span>
                    <span className={`text-sm font-bold block ${totalMarginPercent >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                      {totalMarginPercent}%
                    </span>
                    <span className="text-[9px] text-slate-400 font-sans block mt-0.5 truncate">
                      Marża mat: {materialMarginPercent}% · montaż: {installationMarginPercent}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

            {/* Stopka lewego panelu ze statystykami */}
            <div className="py-2 px-3.5 bg-slate-50 border-t border-slate-200 flex flex-col justify-center gap-1 shrink-0">
              {/* Linia 1: Parametry techniczne i koszt bazowy */}
              <div className="flex items-center justify-between text-[10px] text-slate-500 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <span className="whitespace-nowrap">
                    Pow:{" "}
                    <strong className="font-mono text-slate-800 font-semibold">
                      {hasDimensions ? `${areaM2}\u00A0m²` : "—"}
                    </strong>
                  </span>
                  {isGlassCategory && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="whitespace-nowrap">
                        Tory:{" "}
                        <strong className="font-mono text-slate-800 font-semibold">
                          {hasTracks && panesCount ? `${panesCount}T` : "Brak"}
                        </strong>
                      </span>
                    </>
                  )}
                </div>
                {totalCost > 0 && (
                  <span className="text-slate-400 whitespace-nowrap">
                    Koszt:{" "}
                    <strong className="font-mono text-slate-600 font-medium">
                      {totalCost.toLocaleString("pl-PL")}&nbsp;zł
                    </strong>
                  </span>
                )}
              </div>

              {/* Linia 2: Wycena handlowa (Materiał, Montaż, Razem) */}
              <div className="flex items-center justify-between text-[11px] whitespace-nowrap pt-1 border-t border-slate-200/60">
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="whitespace-nowrap">
                    Mat:{" "}
                    <strong className="font-mono text-slate-900 font-bold">
                      {numMatPrice > 0 ? `${numMatPrice.toLocaleString("pl-PL")}\u00A0zł` : "—"}
                    </strong>
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="whitespace-nowrap">
                    Montaż:{" "}
                    <strong className="font-mono text-slate-900 font-bold">
                      {numInstPrice > 0 ? `${numInstPrice.toLocaleString("pl-PL")}\u00A0zł` : "—"}
                    </strong>
                  </span>
                </div>
                <div className="whitespace-nowrap">
                  <span className="text-[10px] text-slate-400 font-sans uppercase font-bold mr-1">
                    Razem:
                  </span>
                  <span className="font-mono font-bold text-emerald-700 text-xs">
                    {totalPrice > 0 ? `${totalPrice.toLocaleString("pl-PL")}\u00A0zł` : "—"}
                  </span>
                </div>
              </div>
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
                  Aktualizuje się automatycznie wraz ze zmianą wymiarów i torów
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
                onChange={(patch) => {
                  if (patch.widthMm !== undefined) setWidthMm(patch.widthMm);
                  if (patch.heightMm !== undefined) setHeightMm(patch.heightMm);
                  if (patch.panesCount !== undefined) setPanesCount(patch.panesCount);
                }}
              />
            </div>
          </div>
        </div>
      </div>
  );
}

export const CadConstructionEditor = CadConstructionDesignerModal;
export type { CadConstructionDesignerModalProps as CadConstructionEditorProps };
