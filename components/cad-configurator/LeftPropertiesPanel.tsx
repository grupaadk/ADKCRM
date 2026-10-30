"use client";

import React from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { CadConstructionItem } from "./CadCanvas";
import {
  Settings2,
  DollarSign,
  Ruler,
  Palette,
  Check,
  Calculator,
} from "lucide-react";
import {
  isGlassSystemConstruction,
  checkIsStandard,
  calculateGlassSystemPricing,
} from "@/lib/glassPricing";
import {
  matchPricingRange,
  DEFAULT_TRIANGLE_PRICING_RANGES,
} from "@/lib/pricingRanges";

interface LeftPropertiesPanelProps {
  item: CadConstructionItem;
  onChange: (patch: Partial<CadConstructionItem>) => void;
  readOnly?: boolean;
}

export function LeftPropertiesPanel({
  item,
  onChange,
  readOnly = false,
}: LeftPropertiesPanelProps) {
  const price = item.priceNet || 0;
  const cost = item.costNet || 0;
  const instPrice = item.installationPriceNet || 0;
  const instCost = item.installationCostNet || 0;
  const matPrice =
    item.materialPriceNet !== undefined
      ? item.materialPriceNet
      : Math.max(0, price - instPrice);
  const matCost =
    item.materialCostNet !== undefined
      ? item.materialCostNet
      : Math.max(0, cost - instCost);

  const profit = price - cost;
  const marginPct = price > 0 ? Math.round((profit / price) * 100) : 0;

  const template = useQuery(
    api.constructions.get,
    item.constructionId ? { id: item.constructionId as Id<"constructions"> } : "skip"
  );

  const isTriangle =
    item.name.toLowerCase().includes("trójką") ||
    Boolean(item.shortName && item.shortName.toLowerCase().includes("trójką"));

  const effectivePricingRanges =
    template?.pricingRanges && template.pricingRanges.length > 0
      ? template.pricingRanges
      : isTriangle
      ? DEFAULT_TRIANGLE_PRICING_RANGES
      : null;

  const matchedRange = effectivePricingRanges
    ? matchPricingRange(effectivePricingRanges, item.widthMm)
    : null;

  const isGlass = isGlassSystemConstruction({
    name: item.name,
    shortName: item.shortName,
    systemName: item.systemName,
    fillType: item.fillType,
  });

  const standardInfo = isGlass
    ? checkIsStandard(
        Math.round((item.widthMm || 0) / 10),
        Math.round((item.heightMm || 0) / 10)
      )
    : null;

  return (
    <aside className="w-80 bg-white border-r border-[#e3e7ee] flex flex-col h-full text-[#1f2937] select-none overflow-hidden shrink-0">
      {/* Header */}
      <div className="h-10 bg-[#f8fafc] border-b border-[#e3e7ee] px-4 flex items-center justify-between text-xs font-bold text-[#0b1220]">
        <span className="flex items-center gap-1.5 text-[#0e7490]">
          <Settings2 size={14} className="text-[#4ABBC3]" /> Parametry konstrukcji #{item.positionIndex}
        </span>
        <span className="text-[11px] font-mono text-[#7c8597]">
          Pozycja {item.positionIndex}
        </span>
      </div>

      {/* Scrollable Form Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans">
        {/* Pozycja & Ilość */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#7c8597] mb-1">
              Nr pozycji
            </label>
            <div className="bg-[#f3f5f8] border border-[#e3e7ee] rounded-md px-2.5 py-1.5 font-mono font-bold text-[#0e7490]">
              #{item.positionIndex}
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#7c8597] mb-1">
              Ilość (szt.)
            </label>
            <input
              type="number"
              min={1}
              disabled={readOnly}
              value={item.quantity}
              onChange={(e) =>
                onChange({ quantity: Math.max(1, parseInt(e.target.value) || 1) })
              }
              className="w-full bg-white border border-[#d4dae3] rounded-md px-2.5 py-1.5 text-[#0b1220] font-mono focus:border-[#4ABBC3] focus:ring-2 focus:ring-[#4ABBC3]/20 focus:outline-none"
            />
          </div>
        </div>

        {/* Nazwa konstrukcji */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#7c8597] mb-1">
            Nazwa konstrukcji
          </label>
          <input
            type="text"
            disabled={readOnly}
            value={item.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="w-full bg-white border border-[#d4dae3] rounded-md px-2.5 py-1.5 text-[#0b1220] font-medium focus:border-[#4ABBC3] focus:ring-2 focus:ring-[#4ABBC3]/20 focus:outline-none text-xs"
            placeholder="np. System całoszklany 3-torowy"
          />
        </div>

        {/* Sekcja: Wymiary i podział CAD */}
        <div className="bg-[#f8fafc] p-3 rounded-lg border border-[#e3e7ee] space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[#0e7490] font-bold text-[11px] uppercase tracking-wide">
              <Ruler size={13} className="text-[#4ABBC3]" /> Wymiary CAD
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#7c8597] font-mono">
                {Math.round(((item.widthMm || 0) * (item.heightMm || 0)) / 10000) / 100} m²
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-medium text-[#7c8597] mb-1">
                Szerokość B (mm)
              </label>
              <input
                type="number"
                step={10}
                min={300}
                max={12000}
                disabled={readOnly}
                value={item.widthMm || 2880}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!Number.isNaN(val) && val >= 300) {
                    const nextW = Math.min(12000, val);
                    if (isGlass) {
                      const calc = calculateGlassSystemPricing(nextW, item.heightMm || 2300);
                      onChange({
                        widthMm: nextW,
                        materialCostNet: calc.materialCostNet,
                        brushesCostNet: calc.brushesCostNet,
                        handlesCostNet: calc.handlesCostNet,
                        materialPriceNet: calc.materialPriceNet,
                        installationCostNet: calc.installationCostNet,
                        installationPriceNet: calc.installationPriceNet,
                        priceNet: calc.priceNet,
                        costNet: calc.costNet,
                        isStandard: calc.isStandard,
                        pricingTier: calc.pricingTier,
                        standardWidthCm: calc.standardWidthCm,
                      });
                    } else if (effectivePricingRanges) {
                      const range = matchPricingRange(effectivePricingRanges, nextW);
                      if (range) {
                        let curInstPrice = item.installationPriceNet ?? template?.installationPriceNet ?? 0;
                        let curInstCost = item.installationCostNet ?? template?.installationCostNet ?? 0;
                        if (template?.installationUnit === "mb") {
                          const rateCost = template.installationUnitRate ?? 200;
                          const rateClient =
                            template.installationMarkupType === "percent"
                              ? Math.round(rateCost * (1 + (template.installationMarkupValue || 0) / 100))
                              : rateCost + (template.installationMarkupValue || 50);
                          curInstCost = Math.round((nextW / 1000) * rateCost);
                          curInstPrice = Math.round((nextW / 1000) * rateClient);
                        }
                        const mCost = range.costNet ?? range.priceNet;
                        const mPrice =
                          range.priceNet && range.priceNet !== range.costNet
                            ? range.priceNet
                            : (template?.materialMarkupType === "percent"
                                ? Math.round(mCost * (1 + (template.materialMarkupValue || 0) / 100))
                                : mCost + (template?.materialMarkupValue || 0));

                        onChange({
                          widthMm: nextW,
                          materialPriceNet: mPrice,
                          materialCostNet: mCost,
                          installationCostNet: curInstCost,
                          installationPriceNet: curInstPrice,
                          priceNet: mPrice + curInstPrice,
                          costNet: mCost + curInstCost,
                          pricingTier: range.label || `${range.minWidthMm}-${range.maxWidthMm} mm`,
                        });
                      } else {
                        onChange({ widthMm: nextW });
                      }
                    } else {
                      onChange({ widthMm: nextW });
                    }
                  }
                }}
                className="w-full bg-white border border-[#d4dae3] rounded-md px-2.5 py-1 text-[#0b1220] font-mono font-bold focus:border-[#4ABBC3] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-medium text-[#7c8597] mb-1">
                Wysokość H (mm)
              </label>
              <input
                type="number"
                step={10}
                min={300}
                max={6000}
                disabled={readOnly}
                value={item.heightMm || 2300}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!Number.isNaN(val) && val >= 300) {
                    const nextH = Math.min(6000, val);
                    if (isGlass) {
                      const calc = calculateGlassSystemPricing(item.widthMm || 2880, nextH);
                      onChange({
                        heightMm: nextH,
                        materialCostNet: calc.materialCostNet,
                        brushesCostNet: calc.brushesCostNet,
                        handlesCostNet: calc.handlesCostNet,
                        materialPriceNet: calc.materialPriceNet,
                        installationCostNet: calc.installationCostNet,
                        installationPriceNet: calc.installationPriceNet,
                        priceNet: calc.priceNet,
                        costNet: calc.costNet,
                        isStandard: calc.isStandard,
                        pricingTier: calc.pricingTier,
                        standardWidthCm: calc.standardWidthCm,
                      });
                    } else {
                      onChange({ heightMm: nextH });
                    }
                  }
                }}
                className="w-full bg-white border border-[#d4dae3] rounded-md px-2.5 py-1 text-[#0b1220] font-mono font-bold focus:border-[#4ABBC3] focus:outline-none"
              />
            </div>
          </div>

          {isTriangle ? (
            <div>
              <label className="block text-[10px] font-medium text-[#7c8597] mb-1">
                Typ konstrukcji
              </label>
              <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#f1f5f9] border border-[#d4dae3] rounded-md text-xs font-sans">
                <span className="font-bold text-[#0b1220]">
                  Trójkąt podkrokwiowy (stały)
                </span>
                <span className="text-[10px] font-sans text-[#64748b] bg-white px-1.5 py-0.5 rounded border border-[#e2e8f0]">
                  Bez torów
                </span>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-[10px] font-medium text-[#7c8597] mb-1">
                Liczba torów
              </label>
              <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#f1f5f9] border border-[#d4dae3] rounded-md text-xs font-mono">
                <span className="font-bold text-[#0b1220]">
                  {item.panesCount || 3}T (
                  {(item.panesCount || 3) === 1
                    ? "1 tor"
                    : (item.panesCount || 3) < 5
                    ? `${item.panesCount || 3} tory`
                    : `${item.panesCount || 3} torów`}
                  )
                </span>
                <span className="text-[10px] font-sans text-[#64748b] bg-white px-1.5 py-0.5 rounded border border-[#e2e8f0]">
                  Wg szablonu CAD
                </span>
              </div>
            </div>
          )}

          {standardInfo && (
            <div className="flex items-center justify-between pt-2 border-t border-[#e3e7ee]">
              <span className="text-[10px] text-[#7c8597] font-medium">Standard wyceny:</span>
              {standardInfo.isStandard ? (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200"
                  title="Wymiar standardowy (wysokość ze skokiem co 5 cm, szerokość modułowa)"
                >
                  <Check size={10} strokeWidth={2.5} />
                  STANDARD ({standardInfo.standardWidthCm})
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200"
                  title={standardInfo.reason}
                >
                  NIESTANDARD ({standardInfo.standardWidthCm})
                </span>
              )}
            </div>
          )}

          {matchedRange && (
            <div className="flex items-center justify-between pt-2 border-t border-[#e3e7ee]">
              <span className="text-[10px] text-[#7c8597] font-medium">Zakres B (tory):</span>
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#e0f9fe] text-[#0e7490] border border-[#bae6fd]"
                title={`Próg dla B=${item.widthMm || 0} mm: ${matchedRange.minWidthMm}–${matchedRange.maxWidthMm} mm (Koszt: ${matchedRange.costNet} zł, Cena z narzutem: ${matchedRange.priceNet} zł)`}
              >
                {matchedRange.label || `${matchedRange.maxWidthMm} mm`} (koszt: {matchedRange.costNet} zł)
              </span>
            </div>
          )}
        </div>

        {/* Sekcja: Kolor i Wypełnienie */}
        <div className="bg-[#f8fafc] p-3 rounded-lg border border-[#e3e7ee] space-y-3">
          <div className="flex items-center gap-1.5 text-[#0e7490] font-bold text-[11px] uppercase tracking-wide">
            <Palette size={13} className="text-[#4ABBC3]" /> Kolor i Wypełnienie
          </div>

          {/* Kolor profili */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-medium text-[#7c8597]">
                Kolor profili (RAL)
              </label>
              {item.color && (
                <span className="font-mono text-[10px] text-[#0e7490] font-bold">
                  {item.color}
                </span>
              )}
            </div>
            <input
              type="text"
              disabled={readOnly}
              value={item.color || ""}
              onChange={(e) => onChange({ color: e.target.value })}
              placeholder="np. RAL 7016MAT"
              className="w-full bg-white border border-[#d4dae3] rounded-md px-2.5 py-1.5 text-[#0b1220] font-mono text-xs focus:border-[#4ABBC3] focus:ring-2 focus:ring-[#4ABBC3]/20 focus:outline-none"
            />
            {!readOnly && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {["RAL 7016MAT", "RAL 9005MAT", "RAL 9016", "RAL 7021"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onChange({ color: c })}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors border cursor-pointer ${
                      (item.color || "RAL 7016MAT") === c
                        ? "bg-[#e0f9fe] border-[#4ABBC3] text-[#0e7490] font-bold"
                        : "bg-white border-[#e2e8f0] text-[#64748b] hover:border-[#cbd5e1]"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Wypełnienie */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-medium text-[#7c8597]">
                Wypełnienie (szkło / panel)
              </label>
              {item.fillType && (
                <span className="font-mono text-[10px] text-[#0e7490] font-bold">
                  {item.fillType}
                </span>
              )}
            </div>
            <input
              type="text"
              disabled={readOnly}
              value={item.fillType || ""}
              onChange={(e) => onChange({ fillType: e.target.value })}
              placeholder="np. HART 10"
              className="w-full bg-white border border-[#d4dae3] rounded-md px-2.5 py-1.5 text-[#0b1220] font-mono text-xs focus:border-[#4ABBC3] focus:ring-2 focus:ring-[#4ABBC3]/20 focus:outline-none"
            />
            {!readOnly && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {["HART 10", "HART 8", "VSG 44.2", "Poliwęglan 16mm"].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => onChange({ fillType: f })}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors border cursor-pointer ${
                      (item.fillType || "HART 10") === f
                        ? "bg-[#e0f9fe] border-[#4ABBC3] text-[#0e7490] font-bold"
                        : "bg-white border-[#e2e8f0] text-[#64748b] hover:border-[#cbd5e1]"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Opis / Skrót */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#7c8597] mb-1">
            Opis techniczny
          </label>
          <textarea
            rows={2}
            disabled={readOnly}
            value={item.description || ""}
            onChange={(e) => onChange({ description: e.target.value })}
            className="w-full bg-white border border-[#d4dae3] rounded-md px-2.5 py-1.5 text-[#4b5563] focus:border-[#4ABBC3] focus:ring-2 focus:ring-[#4ABBC3]/20 focus:outline-none resize-none text-xs"
            placeholder="np. Przesuwna zabudowa tarasowa"
          />
        </div>

        {/* Sekcja: Finanse pozycji */}
        <div className="bg-[#f8fafc] p-3 rounded-lg border border-[#e3e7ee] space-y-3">
          <div className="flex items-center gap-1.5 text-[#0e7490] font-bold text-[11px] uppercase tracking-wide">
            <DollarSign size={13} className="text-[#4ABBC3]" /> Finanse pozycji
          </div>

          {/* Filar 1: Materiał */}
          <div className="bg-white p-2.5 rounded-md border border-[#e3e7ee] space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 block">
              1. Materiał
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] font-medium text-[#7c8597] mb-0.5">
                  Koszt materiału
                </label>
                <input
                  type="number"
                  step={50}
                  min={0}
                  disabled={readOnly}
                  value={matCost}
                  onChange={(e) => {
                    const newMatCost = Math.max(0, parseFloat(e.target.value) || 0);
                    onChange({
                      materialCostNet: newMatCost,
                      costNet: newMatCost + instCost,
                    });
                  }}
                  className="w-full bg-white border border-[#d4dae3] rounded px-2 py-1 text-xs text-[#0b1220] font-mono focus:border-[#4ABBC3] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[9px] font-medium text-[#7c8597] mb-0.5">
                  Cena materiału
                </label>
                <input
                  type="number"
                  step={50}
                  min={0}
                  disabled={readOnly}
                  value={matPrice}
                  onChange={(e) => {
                    const newMatPrice = Math.max(0, parseFloat(e.target.value) || 0);
                    onChange({
                      materialPriceNet: newMatPrice,
                      priceNet: newMatPrice + instPrice,
                    });
                  }}
                  className="w-full bg-white border border-[#d4dae3] rounded px-2 py-1 text-xs text-[#0e7490] font-mono font-bold focus:border-[#4ABBC3] focus:outline-none"
                />
              </div>
            </div>

            {/* Szczotki i Uchwyty kpl */}
            <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-100">
              <div>
                <label className="block text-[9px] font-medium text-[#7c8597] mb-0.5">
                  Szczotki kpl (zł)
                </label>
                <input
                  type="number"
                  min={0}
                  step={5}
                  disabled={readOnly}
                  value={item.brushesCostNet || ""}
                  onChange={(e) => {
                    const newBrushes = Math.max(0, parseFloat(e.target.value) || 0);
                    const oldBrushes = item.brushesCostNet || 0;
                    const diff = newBrushes - oldBrushes;
                    const newMatCost = Math.max(0, matCost + diff);
                    onChange({
                      brushesCostNet: newBrushes,
                      materialCostNet: newMatCost,
                      costNet: newMatCost + instCost,
                    });
                  }}
                  placeholder="0"
                  className="w-full bg-white border border-[#d4dae3] rounded px-2 py-1 text-xs text-[#0b1220] font-mono focus:border-[#4ABBC3] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[9px] font-medium text-[#7c8597] mb-0.5">
                  Uchwyty kpl (zł)
                </label>
                <input
                  type="number"
                  min={0}
                  step={5}
                  disabled={readOnly}
                  value={item.handlesCostNet || ""}
                  onChange={(e) => {
                    const newHandles = Math.max(0, parseFloat(e.target.value) || 0);
                    const oldHandles = item.handlesCostNet || 0;
                    const diff = newHandles - oldHandles;
                    const newMatCost = Math.max(0, matCost + diff);
                    onChange({
                      handlesCostNet: newHandles,
                      materialCostNet: newMatCost,
                      costNet: newMatCost + instCost,
                    });
                  }}
                  placeholder="0"
                  className="w-full bg-white border border-[#d4dae3] rounded px-2 py-1 text-xs text-[#0b1220] font-mono focus:border-[#4ABBC3] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Filar 2: Montaż */}
          <div className="bg-white p-2.5 rounded-md border border-[#e3e7ee] space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 block">
              2. Montaż
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] font-medium text-[#7c8597] mb-0.5">
                  Koszt montażu
                </label>
                <input
                  type="number"
                  step={50}
                  min={0}
                  disabled={readOnly}
                  value={instCost}
                  onChange={(e) => {
                    const newInstCost = Math.max(0, parseFloat(e.target.value) || 0);
                    onChange({
                      installationCostNet: newInstCost,
                      costNet: matCost + newInstCost,
                    });
                  }}
                  className="w-full bg-white border border-[#d4dae3] rounded px-2 py-1 text-xs text-[#0b1220] font-mono focus:border-[#4ABBC3] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[9px] font-medium text-[#7c8597] mb-0.5">
                  Cena montażu
                </label>
                <input
                  type="number"
                  step={50}
                  min={0}
                  disabled={readOnly}
                  value={instPrice}
                  onChange={(e) => {
                    const newInstPrice = Math.max(0, parseFloat(e.target.value) || 0);
                    onChange({
                      installationPriceNet: newInstPrice,
                      priceNet: matPrice + newInstPrice,
                    });
                  }}
                  className="w-full bg-white border border-[#d4dae3] rounded px-2 py-1 text-xs text-[#0e7490] font-mono font-bold focus:border-[#4ABBC3] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Łączna cena i koszt */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#e3e7ee]">
            <div>
              <label className="block text-[10px] font-bold text-[#0b1220] mb-1">
                Cena łączna netto
              </label>
              <input
                type="number"
                step={50}
                min={0}
                disabled={readOnly}
                value={price}
                onChange={(e) => {
                  const newPrice = Math.max(0, parseFloat(e.target.value) || 0);
                  onChange({
                    priceNet: newPrice,
                    materialPriceNet: Math.max(0, newPrice - instPrice),
                  });
                }}
                className="w-full bg-[#f1f5f9] border border-[#d4dae3] rounded-md px-2.5 py-1 text-[#0b1220] font-mono font-extrabold focus:border-[#4ABBC3] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#0b1220] mb-1">
                Koszt łączny netto
              </label>
              <input
                type="number"
                step={50}
                min={0}
                disabled={readOnly}
                value={cost}
                onChange={(e) => {
                  const newCost = Math.max(0, parseFloat(e.target.value) || 0);
                  onChange({
                    costNet: newCost,
                    materialCostNet: Math.max(0, newCost - instCost),
                  });
                }}
                className="w-full bg-[#f1f5f9] border border-[#d4dae3] rounded-md px-2.5 py-1 text-[#0b1220] font-mono focus:border-[#4ABBC3] focus:outline-none"
              />
            </div>
          </div>

          {/* Wyliczona marża i zysk */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#e3e7ee] text-[11px] font-mono">
            <div>
              <span className="text-[#7c8597] block text-[9px] uppercase font-bold">Zysk netto:</span>
              <span className={profit >= 0 ? "text-[#16a34a] font-bold" : "text-[#dc2626] font-bold"}>
                {profit.toLocaleString("pl-PL")} zł
              </span>
            </div>
            <div>
              <span className="text-[#7c8597] block text-[9px] uppercase font-bold">Marża:</span>
              <span className={marginPct >= 20 ? "text-[#16a34a] font-bold" : "text-[#d97706] font-bold"}>
                {marginPct}%
              </span>
            </div>
          </div>

          {isGlass && !readOnly && (
            <button
              type="button"
              onClick={() => {
                const calc = calculateGlassSystemPricing(
                  item.widthMm || 2880,
                  item.heightMm || 2300
                );
                onChange({
                  materialCostNet: calc.materialCostNet,
                  brushesCostNet: calc.brushesCostNet,
                  handlesCostNet: calc.handlesCostNet,
                  materialPriceNet: calc.materialPriceNet,
                  installationCostNet: calc.installationCostNet,
                  installationPriceNet: calc.installationPriceNet,
                  priceNet: calc.priceNet,
                  costNet: calc.costNet,
                  panesCount: calc.panesCount,
                  isStandard: calc.isStandard,
                  pricingTier: calc.pricingTier,
                  standardWidthCm: calc.standardWidthCm,
                });
              }}
              className="w-full text-center text-[11px] font-semibold text-[#0e7490] hover:text-[#085366] bg-[#f0fdfa] hover:bg-[#ccfbf1] border border-[#99f6e4] py-1.5 rounded transition-colors flex items-center justify-center gap-1.5"
              title="Przelicz automatycznie koszty i ceny wg formuł z kalkulatora szkła (Excel)"
            >
              <Calculator size={13} className="text-[#0e7490]" />
              <span>Przelicz z kalkulatora szkła (Excel)</span>
            </button>
          )}
        </div>

        {/* Uwagi konstrukcyjne */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#7c8597] mb-1">
            Uwagi montażowe / produkcyjne
          </label>
          <textarea
            rows={2}
            disabled={readOnly}
            value={item.notes || ""}
            onChange={(e) => onChange({ notes: e.target.value })}
            className="w-full bg-white border border-[#d4dae3] rounded-md px-2.5 py-1.5 text-[#4b5563] focus:border-[#4ABBC3] focus:outline-none resize-none text-xs"
            placeholder="Dodatkowe uwagi dla produkcji i montażu"
          />
        </div>
      </div>
    </aside>
  );
}
