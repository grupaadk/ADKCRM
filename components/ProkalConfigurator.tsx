"use client";

import { useState, useMemo } from "react";
import {
  calculateProkal,
  type ProkalCalculationInput,
  type ProkalCalculationResult,
} from "@/lib/prokalEngine";
import {
  Maximize2,
  Grid,
  FileSpreadsheet,
  Check,
  AlertTriangle,
  Plus,
  Trash2,
  Copy,
  RefreshCw,
  Building2,
  ChevronUp,
} from "lucide-react";

export interface ProkalPositionData {
  id: string;
  name: string;
  quantity: number;
  input: ProkalCalculationInput;
  result: ProkalCalculationResult;
  notes?: string;
}

export interface ProkalClientInfo {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  investmentAddress?: string;
  orderNumber?: string;
  projectNumber?: string;
}

export interface ProkalConfiguratorProps {
  initialPositions?: ProkalPositionData[];
  onSavePositions: (positions: ProkalPositionData[]) => void;
  isSaving?: boolean;
  clientInfo?: ProkalClientInfo;
}

function ProkalCard({
  title,
  children,
  className = "",
  headerRight,
  icon: Icon,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  headerRight?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-3 shadow-2xs flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
        <div className="flex items-center gap-1.5">
          {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
            {title}
          </span>
        </div>
        {headerRight}
      </div>
      {children}
    </div>
  );
}

export function ProkalConfigurator({
  initialPositions,
  onSavePositions,
  isSaving = false,
}: ProkalConfiguratorProps) {
  // Lista pozycji w wycenie/zleceniu
  const [positions, setPositions] = useState<ProkalPositionData[]>(() => {
    if (initialPositions && initialPositions.length > 0) {
      return initialPositions;
    }
    // Domyślna pozycja wzorcowa ze screena PROKAL: B=2880, H=2300, 3-torowy, HART 10
    const defaultInput: ProkalCalculationInput = {
      systemKey: "SLIDING_3_TRACK",
      name: "System całoszklany 3-torowy (B=2 880, H=2 300)",
      widthMm: 2880,
      heightMm: 2300,
      tracksCount: 3,
      sashesCount: 3,
      slidingDirection: "LEFT",
      color: "RAL 7016MAT",
      glassCode: "HART 10",
      includeInterlockGaskets: true,
      includeLock: false,
      includeHandles: true,
      handlesQuantity: 2,
    };
    const defaultResult = calculateProkal(defaultInput);
    return [
      {
        id: "pos-1",
        name: "System całoszklany 3-torowy (B=2 880, H=2 300)",
        quantity: 1,
        input: defaultInput,
        result: defaultResult,
        notes: "Kolor profili: RAL 7016MAT - Szary Kolor okuć: Wypełnienia: HART 10",
      },
    ];
  });

  // Tryb widoku: "order" (Szczegóły obliczeń zlecenia [ZLECENIE]) lub indeks numeryczny konstrukcji (0, 1, 2...)
  const [activeTabMode, setActiveTabMode] = useState<"order" | number>("order");
  const [activePositionIndex, setActivePositionIndex] = useState(0);
  const activePosition = positions[activePositionIndex] || positions[0];

  const [showGrid, setShowGrid] = useState(true);
  const [isAddDropdownOpen, setIsAddDropdownOpen] = useState(false);

  const [orderName, setOrderName] = useState("Oferta konstrukcji całoszklanych");
  const [orderDescription, setOrderDescription] = useState("Systemy przesuwne bezramowe z wypełnieniem HART 10");
  const [orderDiscountPercent] = useState(0);
  const [orderAdditionalDiscountPercent] = useState(0);
  const [pricingScope, setPricingScope] = useState("A+B) Konstrukcja + malowanie");
  const [priceDisplayMode, setPriceDisplayMode] = useState<"NETTO" | "BRUTTO">("NETTO");

  // Aktywne parametry edytowanej pozycji
  const currentInput = activePosition?.input || {
    widthMm: 2880,
    heightMm: 2300,
    tracksCount: 3,
    sashesCount: 3,
    color: "RAL 7016MAT",
    glassCode: "HART 10",
  };

  // Aktualizacja aktywnej pozycji
  const handleUpdateInput = (patch: Partial<ProkalCalculationInput>) => {
    if (positions.length === 0 || !positions[activePositionIndex]) return;

    const updatedInput: ProkalCalculationInput = {
      ...currentInput,
      ...patch,
    };

    // Automatyczna korekta liczby skrzydeł przy zmianie torów jeśli użytkownik nie wymusił innej
    if (patch.tracksCount && !patch.sashesCount) {
      updatedInput.sashesCount = patch.tracksCount;
    }

    // Automatyczna nazwa wg schematu PROKAL
    const generatedName = `System całoszklany ${updatedInput.tracksCount}-torowy (B=${updatedInput.widthMm.toLocaleString("pl-PL")}, H=${updatedInput.heightMm.toLocaleString("pl-PL")})`;
    if (!patch.name && (!currentInput.name || currentInput.name.startsWith("System całoszklany"))) {
      updatedInput.name = generatedName;
    }

    const newResult = calculateProkal(updatedInput);

    setPositions((prev) => {
      const copy = [...prev];
      copy[activePositionIndex] = {
        ...copy[activePositionIndex],
        name: updatedInput.name || generatedName,
        input: updatedInput,
        result: newResult,
        notes: `Kolor profili: ${updatedInput.color} | Wypełnienia: ${updatedInput.glassCode}`,
      };
      return copy;
    });
  };

  // Dodanie nowej pozycji
  const handleAddPosition = (tracks: number = 3) => {
    const newIdx = positions.length + 1;
    const newInput: ProkalCalculationInput = {
      systemKey: `SLIDING_${tracks}_TRACK`,
      name: `System całoszklany ${tracks}-torowy`,
      widthMm: tracks === 2 ? 2200 : tracks === 4 ? 3800 : 2880,
      heightMm: 2300,
      tracksCount: tracks,
      sashesCount: tracks,
      color: currentInput.color || "RAL 7016MAT",
      glassCode: currentInput.glassCode || "HART 10",
      includeInterlockGaskets: true,
      includeHandles: true,
    };
    const newResult = calculateProkal(newInput);
    const newPos: ProkalPositionData = {
      id: `pos-${newIdx}`,
      name: `${newIdx} System całoszklany ${tracks}`,
      quantity: 1,
      input: newInput,
      result: newResult,
      notes: `Kolor profili: ${newInput.color} | Wypełnienia: ${newInput.glassCode}`,
    };

    setPositions((prev) => [...prev, newPos]);
    setActivePositionIndex(positions.length);
    setActiveTabMode(positions.length);
  };

  // Duplikowanie pozycji
  const handleDuplicatePosition = (idx: number) => {
    const target = positions[idx];
    if (!target) return;
    const duplicated: ProkalPositionData = {
      ...target,
      id: `${target.id}-copy-${positions.length + 1}`,
      name: `${target.name} (Kopia)`,
    };
    setPositions((prev) => [...prev, duplicated]);
    setActivePositionIndex(positions.length);
    setActiveTabMode(positions.length);
  };

  // Usuwanie pozycji - możliwość usunięcia wszystkich pozycji
  const handleDeletePosition = (idx: number) => {
    const remaining = positions.filter((_, i) => i !== idx);
    setPositions(remaining);

    if (remaining.length === 0) {
      setActivePositionIndex(0);
      setActiveTabMode("order");
    } else if (activePositionIndex >= remaining.length) {
      const nextIdx = remaining.length - 1;
      setActivePositionIndex(nextIdx);
      if (typeof activeTabMode === "number") {
        setActiveTabMode(nextIdx);
      }
    } else if (typeof activeTabMode === "number" && activeTabMode === idx) {
      const nextIdx = Math.min(activePositionIndex, remaining.length - 1);
      setActivePositionIndex(nextIdx);
      setActiveTabMode(nextIdx);
    }
  };

  // Zapis do nadrzędnego formularza szansy
  const handleSaveAll = () => {
    onSavePositions(positions);
  };

  // Podsumowanie całego zlecenia/wyceny
  const orderSummary = useMemo(() => {
    const totalCost = positions.reduce((acc, p) => acc + p.result.totalCostNet * p.quantity, 0);
    const totalPrice = positions.reduce((acc, p) => acc + p.result.totalPriceNet * p.quantity, 0);
    const totalWeight = positions.reduce((acc, p) => acc + p.result.totalWeightKg * p.quantity, 0);
    const totalArea = positions.reduce((acc, p) => acc + p.result.totalGlassAreaSqM * p.quantity, 0);
    const profit = totalPrice - totalCost;
    const margin = totalPrice > 0 ? Math.round((profit / totalPrice) * 100) : 0;
    return {
      totalCost,
      totalPrice,
      totalWeight: Number(totalWeight.toFixed(1)),
      totalArea: Number(totalArea.toFixed(2)),
      profit,
      margin,
      positionsCount: positions.length,
    };
  }, [positions]);

  // Szczegółowe metryki zlecenia dla ekranu [ZLECENIE]
  const detailedMetrics = useMemo(() => {
    const totalConstructions = positions.reduce((acc, p) => acc + p.quantity, 0);
    const totalFrames = totalConstructions;
    const totalSashes = positions.reduce((acc, p) => acc + (p.input.sashesCount || p.input.tracksCount || 3) * p.quantity, 0);
    const totalGlasses = totalSashes;
    const totalGlassArea = positions.reduce((acc, p) => acc + p.result.totalGlassAreaSqM * p.quantity, 0);
    const totalPerimeterM = positions.reduce((acc, p) => acc + (2 * (p.input.widthMm + p.input.heightMm) / 1000) * p.quantity, 0);
    const totalLinearM = positions.reduce((acc, p) => acc + ((p.input.widthMm * 2 + p.input.heightMm * 2) / 1000) * p.quantity, 0);
    const totalWeightKg = positions.reduce((acc, p) => acc + p.result.totalWeightKg * p.quantity, 0);

    const profilesCost = positions.reduce((acc, p) => acc + p.result.profilesCostNet * p.quantity, 0);
    const glassCost = positions.reduce((acc, p) => acc + p.result.glassCostNet * p.quantity, 0);
    const hardwareCost = positions.reduce((acc, p) => acc + p.result.hardwareCostNet * p.quantity, 0);
    const laborCost = positions.reduce((acc, p) => acc + p.result.laborCostNet * p.quantity, 0);
    const totalCostNet = profilesCost + glassCost + hardwareCost + laborCost;
    const basePriceNet = positions.reduce((acc, p) => acc + p.result.totalPriceNet * p.quantity, 0);

    const discountMultiplier = Math.max(0, 1 - (orderDiscountPercent + orderAdditionalDiscountPercent) / 100);
    const finalPriceNet = Math.round(basePriceNet * discountMultiplier);
    const finalPriceGross = Math.round(finalPriceNet * 1.23);

    return {
      totalConstructions,
      totalFrames,
      totalSashes,
      totalGlasses,
      totalGlassArea: Number(totalGlassArea.toFixed(2)),
      totalPerimeterM: Number(totalPerimeterM.toFixed(2)),
      totalLinearM: Number(totalLinearM.toFixed(2)),
      totalWeightKg: Number(totalWeightKg.toFixed(1)),
      profilesCost,
      glassCost,
      hardwareCost,
      laborCost,
      totalCostNet,
      basePriceNet,
      finalPriceNet,
      finalPriceGross,
    };
  }, [positions, orderDiscountPercent, orderAdditionalDiscountPercent]);

  const activeResult = activePosition?.result;

  const renderThumbnailsColumn = () => (
    <div className="bg-slate-50/70 border-l border-slate-200 p-3 flex flex-col gap-2.5 overflow-y-auto max-h-[740px]">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
          Oferta ({positions.length})
        </span>
        <button
          type="button"
          onClick={() => handleAddPosition(3)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
        >
          <Plus size={12} />
          Dodaj
        </button>
      </div>

      {/* Karty miniatur pozycji */}
      <div className="flex flex-col gap-2">
        {positions.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400 bg-slate-100/60 rounded-xl border border-dashed border-slate-200">
            Brak konstrukcji w ofercie
          </div>
        ) : (
          positions.map((pos, idx) => {
            const isActive = idx === activePositionIndex && activeTabMode !== "order";
            const isSelectedInOrder = idx === activePositionIndex && activeTabMode === "order";
            return (
              <div
                key={pos.id}
                onClick={() => {
                  setActivePositionIndex(idx);
                  setActiveTabMode(idx);
                }}
                className={`bg-white rounded-xl p-2.5 cursor-pointer transition-all ${
                  isActive
                    ? "border-2 border-teal-600 ring-2 ring-teal-500/15 shadow-xs"
                    : isSelectedInOrder
                    ? "border-2 border-teal-500 shadow-2xs"
                    : "border border-slate-200 hover:border-slate-300 shadow-2xs"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs font-bold truncate max-w-[140px] ${
                    isActive ? "text-teal-700" : isSelectedInOrder ? "text-teal-600" : "text-slate-800"
                  }`}>
                    {idx + 1}. {pos.name}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                    {pos.quantity} szt.
                  </span>
                </div>

                {/* Miniaturka CAD pozycji */}
                <div className="h-12 bg-slate-900 border border-slate-700 rounded-lg flex items-center justify-around px-1 py-0.5 mb-2">
                  {Array.from({ length: pos.input.tracksCount || 3 }).map((_, sIdx) => (
                    <div
                      key={sIdx}
                      className="flex-1 h-[88%] mx-0.5 bg-teal-500/50 border border-teal-400/80 rounded-xs"
                    />
                  ))}
                </div>

                {/* Szczegóły i akcje */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-700 font-mono">
                    {(pos.result.totalPriceNet * pos.quantity).toLocaleString("pl-PL")} zł
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDuplicatePosition(idx);
                      }}
                      title="Duplikuj"
                      className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 cursor-pointer"
                    >
                      <Copy size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePosition(idx);
                      }}
                      title="Usuń"
                      className="p-1 text-rose-400 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col bg-slate-50/50 border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
      {/* ── 1. GÓRNY PASEK TYTUŁOWY I NARZĘDZIOWY ── */}
      <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="font-bold text-[11px] tracking-wider uppercase bg-teal-50 text-teal-700 border border-teal-200 px-2.5 py-1 rounded-md">
            PROKAL 4930
          </span>
          <div>
            <div className="text-sm font-bold text-slate-900">
              Konstrukcje i wyceny całoszklane
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              {activeTabMode === "order" || positions.length === 0
                ? "Szczegóły kalkulacji [OFERTA]"
                : `Pozycja ${activePositionIndex + 1}/${positions.length}: ${activePosition?.name}`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {positions.length > 0 && (
            activeTabMode === "order" ? (
              <button
                type="button"
                onClick={() => setActiveTabMode(activePositionIndex)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <Maximize2 size={13} />
                Rysunek CAD [{activePositionIndex + 1}] &rarr;
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTabMode("order")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <FileSpreadsheet size={13} />
                &larr; Szczegóły [OFERTA]
              </button>
            )
          )}

          <div className="text-xs text-slate-500 font-medium hidden sm:flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <span>Łącznie:</span>
            <strong className="text-teal-700 font-bold text-sm">
              {orderSummary.totalPrice.toLocaleString("pl-PL")} zł netto
            </strong>
          </div>

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check size={14} />
            {isSaving ? "Zapisywanie..." : "Zapisz wycenę"}
          </button>
        </div>
      </div>

      {/* Pasek narzędzi akcji */}
      <div className="bg-slate-50/80 border-b border-slate-200 px-5 py-2 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Maximize2 size={13} className="text-teal-600" />
            Rysunek CAD konstrukcji
          </span>
          <div className="w-px h-4 bg-slate-300 mx-1" />
          <button
            type="button"
            onClick={() => setShowGrid(!showGrid)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              showGrid
                ? "bg-teal-50 border-teal-200 text-teal-700"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Grid size={13} />
            Siatka CAD: {showGrid ? "WŁ" : "WYŁ"}
          </button>
        </div>
      </div>

      {/* ── 2. GŁÓWNY UKŁAD ROBOCZY: [OFERTA] (Szczegóły obliczeń) lub CAD dla pozycji ── */}
      {activeTabMode === "order" || positions.length === 0 ? (
        <div className="grid grid-cols-[1fr_280px] min-h-[640px] bg-slate-50/40 gap-3 p-3 overflow-x-auto">
          {/* ══ KOLUMNA GŁÓWNA: OFERTA ORAZ CENY I RABATY NA KONSTRUKCJE ══ */}
          <div className="flex flex-col gap-3 overflow-y-auto max-h-[740px]">
            {/* Box OFERTA */}
            <ProkalCard title="OFERTA" icon={Building2}>
              <div className="flex flex-col gap-2">
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 block mb-0.5">Nazwa oferty:</span>
                  <input
                    type="text"
                    value={orderName}
                    onChange={(e) => setOrderName(e.target.value)}
                    className="w-full px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 block mb-0.5">Opis oferty:</span>
                  <input
                    type="text"
                    value={orderDescription}
                    onChange={(e) => setOrderDescription(e.target.value)}
                    className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
              </div>
            </ProkalCard>

            {/* Podsumowanie finansowe oferty: Koszt wytworzenia, Cena klienta netto, Zysk, Marża */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-2xs">
                <span className="text-[11px] font-medium text-slate-500 block">Koszt wytworzenia:</span>
                <span className="text-base font-bold text-slate-900 font-mono block mt-0.5">
                  {Math.round(orderSummary.totalCost).toLocaleString("pl-PL")} zł
                </span>
                <span className="text-[10px] text-slate-400">suma kosztów netto</span>
              </div>

              <div className="bg-teal-50/60 border border-teal-200/80 rounded-xl p-3 shadow-2xs">
                <span className="text-[11px] font-medium text-teal-700 block">Cena klienta netto:</span>
                <span className="text-base font-bold text-teal-900 font-mono block mt-0.5">
                  {Math.round(detailedMetrics.finalPriceNet).toLocaleString("pl-PL")} zł
                </span>
                <span className="text-[10px] text-teal-600/80">
                  {orderDiscountPercent > 0 ? `rabat ${orderDiscountPercent}%` : "cena katalogowa"}
                </span>
              </div>

              <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3 shadow-2xs">
                <span className="text-[11px] font-medium text-emerald-700 block">Zysk:</span>
                <span className="text-base font-bold text-emerald-800 font-mono block mt-0.5">
                  {Math.round(detailedMetrics.finalPriceNet - orderSummary.totalCost).toLocaleString("pl-PL")} zł
                </span>
                <span className="text-[10px] text-emerald-600/80">zysk handlowy</span>
              </div>

              <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-3 shadow-2xs">
                <span className="text-[11px] font-medium text-blue-700 block">Marża:</span>
                <span className="text-base font-bold text-blue-900 font-mono block mt-0.5">
                  {detailedMetrics.finalPriceNet > 0
                    ? Math.round(((detailedMetrics.finalPriceNet - orderSummary.totalCost) / detailedMetrics.finalPriceNet) * 100)
                    : 0}%
                </span>
                <span className="text-[10px] text-blue-600/80">marża handlowa</span>
              </div>
            </div>

            {/* Box CENY I RABATY NA KONSTRUKCJE */}
            <ProkalCard title="CENY I RABATY NA KONSTRUKCJE" icon={FileSpreadsheet}>
              <div className="flex flex-col gap-2.5">
                {/* Pasek kontrolny nad tabelą */}
                <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <select
                      value={pricingScope}
                      onChange={(e) => setPricingScope(e.target.value)}
                      className="text-xs px-2 py-1 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700"
                    >
                      <option>A+B) Konstrukcja + malowanie</option>
                      <option>A) Tylko konstrukcja</option>
                      <option>B) Konstrukcja + montaż</option>
                    </select>

                    <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                      <label className="inline-flex items-center gap-1 cursor-pointer font-medium">
                        <input
                          type="radio"
                          name="priceDisplay"
                          checked={priceDisplayMode === "NETTO"}
                          onChange={() => setPriceDisplayMode("NETTO")}
                          className="accent-teal-600"
                        />
                        Netto
                      </label>
                      <label className="inline-flex items-center gap-1 cursor-pointer font-medium">
                        <input
                          type="radio"
                          name="priceDisplay"
                          checked={priceDisplayMode === "BRUTTO"}
                          onChange={() => setPriceDisplayMode("BRUTTO")}
                          className="accent-teal-600"
                        />
                        Brutto
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleUpdateInput({})}
                      disabled={positions.length === 0}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 text-xs font-semibold shadow-2xs inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw size={11} /> Przelicz
                    </button>
                    {positions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTabMode(activePositionIndex);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-2xs cursor-pointer"
                      >
                        Rysunek &rarr;
                      </button>
                    )}
                  </div>
                </div>

                {/* Tabela konstrukcji */}
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs border-collapse min-w-[420px]">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 text-left text-[11px] font-semibold border-b border-slate-200">
                        <th className="py-2 px-2.5">Konstrukcja</th>
                        <th className="py-2 px-2">Wymiary</th>
                        <th className="py-2 px-2 text-center">Ilość</th>
                        <th className="py-2 px-2 text-right">Cena / szt.</th>
                        <th className="py-2 px-2 text-center">Rabaty</th>
                        <th className="py-2 px-2.5 text-right">Po rabacie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                            Brak konstrukcji w ofercie. Użyj przycisku <span className="font-semibold text-teal-600">+ Nowa</span> poniżej, aby dodać konstrukcję.
                          </td>
                        </tr>
                      ) : (
                        positions.map((pos, idx) => {
                        const isPosActive = idx === activePositionIndex;
                        const unitPrice = priceDisplayMode === "NETTO" ? pos.result.totalPriceNet : pos.result.totalPriceNet * 1.23;
                        const rowTotal = unitPrice * pos.quantity;

                        return (
                          <tr
                            key={pos.id}
                            onClick={() => {
                              setActivePositionIndex(idx);
                            }}
                            onDoubleClick={() => {
                              setActivePositionIndex(idx);
                              setActiveTabMode(idx);
                            }}
                            className={`cursor-pointer transition-colors border-b border-slate-100 ${
                              isPosActive
                                ? "bg-teal-50/70 text-teal-950 font-semibold"
                                : "hover:bg-slate-50/70 text-slate-800"
                            }`}
                            title="Kliknij dwukrotnie, aby otworzyć rysunek CAD tej konstrukcji"
                          >
                            <td className="py-2 px-2.5 font-semibold max-w-[180px] truncate">
                              {idx + 1}. {pos.name}
                            </td>
                            <td className="py-2 px-2 text-slate-500 whitespace-nowrap">
                              {pos.input.widthMm}x{pos.input.heightMm}
                            </td>
                            <td className="py-2 px-2 text-center font-bold">
                              {pos.quantity}
                            </td>
                            <td className="py-2 px-2 text-right font-mono">
                              {unitPrice.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-2 px-2 text-center text-slate-500">
                              {orderDiscountPercent > 0 ? `${orderDiscountPercent}%` : "0,0%"}
                            </td>
                            <td className="py-2 px-2.5 text-right font-bold font-mono text-slate-900">
                              {rowTotal.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                    <tfoot>
                      <tr className="bg-slate-900 text-white font-bold text-xs">
                        <td className="py-2.5 px-2.5">RAZEM: [PLN]</td>
                        <td className="py-2.5 px-2"></td>
                        <td className="py-2.5 px-2 text-center text-slate-200">{detailedMetrics.totalConstructions}</td>
                        <td className="py-2.5 px-2 text-right font-mono text-slate-200">
                          {(priceDisplayMode === "NETTO" ? detailedMetrics.basePriceNet : detailedMetrics.basePriceNet * 1.23).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-2 text-center text-slate-300">
                          {orderDiscountPercent > 0 ? `${orderDiscountPercent}%` : "0,0%"}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono text-sm text-teal-300">
                          {(priceDisplayMode === "NETTO" ? detailedMetrics.finalPriceNet : detailedMetrics.finalPriceGross).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </ProkalCard>
          </div>


          {/* ══ KOLUMNA 4: PIONOWA LISTA MINIATUR WSZYSTKICH KONSTRUKCJI ══ */}
          {renderThumbnailsColumn()}
        </div>
      ) : (
        <div className="grid grid-cols-[300px_1fr_240px] min-h-[580px] bg-white">
          {/* ── LEWA KOLUMNA: PARAMETRY POZYCJI ── */}
          <div className="border-r border-slate-200 p-4 flex flex-col gap-3.5 bg-slate-50/70 overflow-y-auto max-h-[740px]">
            {/* Header pozycji */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Pozycja {activePositionIndex + 1}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">Ilość:</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={activePosition?.quantity || 1}
                  onChange={(e) => {
                    const qty = Math.max(1, parseInt(e.target.value) || 1);
                    setPositions((prev) => {
                      const copy = [...prev];
                      copy[activePositionIndex].quantity = qty;
                      return copy;
                    });
                  }}
                  className="w-12 px-1.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-bold text-center text-slate-900"
                />
              </div>
            </div>

            {/* Nazwa konstrukcji */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nazwa konstrukcji:
              </label>
              <input
                type="text"
                value={currentInput.name || ""}
                onChange={(e) => handleUpdateInput({ name: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>

            {/* Wymiary ramy B i H */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-bold text-slate-800 block mb-2">
                Wymiary ramy [mm]:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Szerokość B:
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step={10}
                      value={currentInput.widthMm}
                      onChange={(e) => handleUpdateInput({ widthMm: parseInt(e.target.value) || 2880 })}
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-900"
                    />
                    <span className="text-[11px] text-slate-400">mm</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Wysokość H:
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step={10}
                      value={currentInput.heightMm}
                      onChange={(e) => handleUpdateInput({ heightMm: parseInt(e.target.value) || 2300 })}
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-900"
                    />
                    <span className="text-[11px] text-slate-400">mm</span>
                  </div>
                </div>
              </div>
            </div>


            {/* Ostrzeżenia techniczne */}
            {activeResult?.technicalWarnings && activeResult.technicalWarnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 text-xs">
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <AlertTriangle size={13} className="text-amber-600" />
                  Uwaga techniczna:
                </div>
                {activeResult.technicalWarnings.map((w, idx) => (
                  <div key={idx} className="text-[11px] leading-tight text-amber-800">{w}</div>
                ))}
              </div>
            )}
          </div>

          {/* ── ŚRODKOWA KOLUMNA: OBSZAR ROBOCZY (RYSUNEK CAD PROKAL) ── */}
          <div className="flex flex-col bg-white relative overflow-hidden flex-1">
            {activeResult && (
              <div
                className="flex-1 p-6 flex flex-col items-center justify-center relative min-h-[480px]"
                style={{
                  background: showGrid
                    ? "radial-gradient(#CBD5E1 1px, transparent 1px) 0 0 / 24px 24px #FAFAFA"
                    : "#FAFAFA",
                }}
              >
                {/* Rysunek wektorowy CAD w stylu PROKAL */}
                <div className="w-full max-w-[680px] relative flex flex-col items-center">
                  {/* 1. Górna linia wymiarowa całkowitej szerokości B (2880) */}
                  <div className="w-full flex flex-col items-center mb-1.5">
                    <div className="text-xs font-bold text-slate-900 mb-0.5">
                      {activeResult.widthMm}
                    </div>
                    {/* Linia ze strzałkami */}
                    <div className="w-full flex items-center">
                      <span className="text-[10px] text-slate-500 mr-[-2px]">&lt;</span>
                      <div className="flex-1 h-px bg-slate-400" />
                      <span className="text-[10px] text-slate-500 ml-[-2px]">&gt;</span>
                    </div>
                  </div>

                  {/* 2. Podział szerokości na segmenty */}
                  <div
                    className="w-full grid mb-2 text-center"
                    style={{
                      gridTemplateColumns: `repeat(${activeResult.sashes.length}, 1fr)`,
                    }}
                  >
                    {activeResult.divisionsMm.map((divMm, idx) => (
                      <div key={idx} className="flex flex-col items-center">
                        <span className="text-[11px] font-semibold text-slate-600">{divMm}</span>
                        <div className="w-full flex items-center">
                          <span className="text-[9px] text-slate-400">&lt;</span>
                          <div className="flex-1 h-px bg-slate-300 border-t border-dashed border-slate-400" />
                          <span className="text-[9px] text-slate-400">&gt;</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 3. Rama konstrukcji i tafle szklane */}
                  <div className="w-full h-[340px] relative border-[8px] border-slate-700 bg-slate-950 rounded-md shadow-md">
                    {/* Etykieta profilu górnego (5448 7016MAT) */}
                    <div className="absolute top-1 left-1/2 transform -translate-x-1/2 text-[10px] font-bold text-white tracking-wider bg-slate-900/80 backdrop-blur-xs px-2 py-0.5 rounded z-10">
                      5448 {currentInput.color.replace("RAL ", "")}
                    </div>

                    {/* Etykieta profilu lewego bocznego */}
                    <div className="absolute left-1 top-1/2 transform -translate-y-1/2 -rotate-90 text-[8.5px] font-bold text-slate-300 tracking-wider whitespace-nowrap z-10">
                      5450 {currentInput.color.replace("RAL ", "")}
                    </div>

                    {/* Etykieta profilu dolnego jezdnego (5450 7016MAT) */}
                    <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 text-[10px] font-bold text-white tracking-wider bg-slate-900/80 backdrop-blur-xs px-2 py-0.5 rounded z-10">
                      5450 {currentInput.color.replace("RAL ", "")}
                    </div>

                    {/* Skrzydła szklane */}
                    <div
                      className="absolute inset-[16px_8px_16px_8px] grid gap-1"
                      style={{
                        gridTemplateColumns: `repeat(${activeResult.sashes.length}, 1fr)`,
                      }}
                    >
                      {activeResult.sashes.map((sash) => (
                        <div
                          key={sash.index}
                          className="border-2 border-teal-400 rounded-xs relative flex flex-col justify-between p-1.5 overflow-hidden shadow-2xs"
                          style={{
                            background: "linear-gradient(180deg, rgba(224, 242, 254, 0.92) 0%, rgba(186, 230, 253, 0.85) 100%)",
                          }}
                        >
                          {/* Metryczka górna tafli szklanej */}
                          <div className="bg-white/95 backdrop-blur-xs p-1.5 rounded-md text-[9px] text-slate-900 border border-teal-100 shadow-2xs">
                            <div className="font-extrabold text-[9.5px]">
                              {sash.widthMm}x{sash.heightMm} &nbsp; {sash.weightKg} kg
                            </div>
                            <div className="text-teal-700 font-bold">
                              {sash.priceNetPerSash.toFixed(2)} zł/szt &nbsp; {sash.priceNetPerSqM.toFixed(2)}/m²
                            </div>
                            <div className="text-slate-500 text-[8.5px]">
                              {sash.thicknessMm.toFixed(1)} mm &nbsp; {sash.areaSqM.toFixed(1)} m²
                            </div>
                          </div>


                          {/* Dolny wskaźnik skrzydła */}
                          <div className="text-center text-[9px] font-bold text-teal-700 z-10">
                            Tor #{sash.trackIndex}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 4. Prawa linia wymiarowa wysokości całkowitej H (2300) */}
                  <div className="absolute -right-10 top-10 bottom-0 flex flex-col items-center justify-center">
                    <div
                      className="text-xs font-bold text-slate-900 mb-1"
                      style={{
                        writingMode: "vertical-rl",
                        transform: "rotate(180deg)",
                      }}
                    >
                      {activeResult.heightMm}
                    </div>
                    <div className="h-[80%] w-px bg-slate-400 relative">
                      <span className="absolute top-0 -left-[3px] text-[9px] text-slate-500">^</span>
                      <span className="absolute bottom-0 -left-[3px] text-[9px] text-slate-500">v</span>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* ── PRAWA KOLUMNA: LISTA POZYCJI W ZLECENIU ── */}
          {renderThumbnailsColumn()}
        </div>
      )}

      {/* ── 3. DOLNY PASEK ZAKŁADEK I PODSUMOWANIA (PROKAL TABS) ── */}
      <div className="bg-white border-t border-slate-200 px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
        {/* Zakładki: [OFERTA] [1] [2] [3]... */}
        <div className="flex items-center gap-1.5">
          {/* Zakładka 0: OFERTA */}
          <button
            type="button"
            onClick={() => setActiveTabMode("order")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTabMode === "order"
                ? "bg-teal-600 text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            <FileSpreadsheet size={13} />
            [OFERTA]
          </button>

          {/* Kolejne zakładki: [1], [2], [3]... */}
          {positions.map((_, pIdx) => {
            const isTabActive = activeTabMode === pIdx;
            return (
              <button
                key={pIdx}
                type="button"
                onClick={() => {
                  setActivePositionIndex(pIdx);
                  setActiveTabMode(pIdx);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer min-w-[34px] text-center ${
                  isTabActive
                    ? "bg-teal-600 text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
                title={`Konstrukcja ${pIdx + 1}: ${positions[pIdx]?.name}`}
              >
                [{pIdx + 1}]
              </button>
            );
          })}

          {/* Przycisk + Nowa z dropdownem w górę */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsAddDropdownOpen((prev) => !prev)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-dashed border-slate-300 hover:border-teal-500 hover:text-teal-600 text-slate-600 cursor-pointer transition-colors flex items-center gap-1"
              title="Dodaj nową konstrukcję"
            >
              <span>+ Nowa</span>
              <ChevronUp
                size={12}
                className={`transition-transform duration-150 ${isAddDropdownOpen ? "rotate-180" : ""}`}
              />
            </button>

            {isAddDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsAddDropdownOpen(false)}
                />
                <div className="absolute bottom-full left-0 mb-1.5 z-40 bg-white rounded-xl border border-slate-200 shadow-lg py-1.5 w-44 animate-in fade-in slide-in-from-bottom-2 duration-150">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-0.5">
                    Wybierz system
                  </div>
                  {[
                    { tracks: 2, label: "2-torowy", tag: null },
                    { tracks: 3, label: "3-torowy", tag: "PROKAL" },
                    { tracks: 4, label: "4-torowy", tag: null },
                    { tracks: 5, label: "5-torowy", tag: null },
                  ].map((sys) => (
                    <button
                      key={sys.tracks}
                      type="button"
                      onClick={() => {
                        handleAddPosition(sys.tracks);
                        setIsAddDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:text-teal-700 hover:bg-teal-50/70 transition-colors flex items-center justify-between font-medium cursor-pointer"
                    >
                      <span>{sys.label}</span>
                      {sys.tag && (
                        <span className="text-[9px] font-bold bg-teal-50 text-teal-700 border border-teal-200 px-1.5 py-0.2 rounded">
                          {sys.tag}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Prawa strona dolnego paska: statystyki */}
        <div className="flex items-center gap-3.5 flex-wrap text-xs text-slate-500">
          <span>
            Konstrukcji: <strong className="text-slate-900">{detailedMetrics.totalConstructions} szt.</strong>
          </span>
          <span>
            Skrzydeł: <strong className="text-slate-900">{detailedMetrics.totalSashes} szt.</strong>
          </span>
          <span>
            Szkło: <strong className="text-slate-900">{detailedMetrics.totalGlassArea} m²</strong>
          </span>
          <span>
            Waga: <strong className="text-slate-900">{detailedMetrics.totalWeightKg} kg</strong>
          </span>
          <span>
            Koszt: <strong className="text-slate-900">{detailedMetrics.totalCostNet.toLocaleString("pl-PL")} zł</strong>
          </span>
          <span className="text-sm font-bold text-teal-700 bg-teal-50 border border-teal-200 px-3 py-1 rounded-lg">
            Wartość oferty: {detailedMetrics.basePriceNet.toLocaleString("pl-PL")} zł netto
          </span>
        </div>
      </div>
    </div>
  );
}
