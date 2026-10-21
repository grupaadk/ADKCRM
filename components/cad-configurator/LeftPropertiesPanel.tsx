"use client";

import React from "react";
import { CadConstructionItem } from "./CadCanvas";
import {
  Settings2,
  DollarSign,
  Ruler,
} from "lucide-react";

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
  const profit = price - cost;
  const marginPct = price > 0 ? Math.round((profit / price) * 100) : 0;

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
            <span className="text-[10px] text-[#7c8597] font-mono">
              {Math.round(((item.widthMm || 0) * (item.heightMm || 0)) / 10000) / 100} m²
            </span>
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
                    onChange({ widthMm: Math.min(12000, val) });
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
                    onChange({ heightMm: Math.min(6000, val) });
                  }
                }}
                className="w-full bg-white border border-[#d4dae3] rounded-md px-2.5 py-1 text-[#0b1220] font-mono font-bold focus:border-[#4ABBC3] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-[#7c8597] mb-1">
              Liczba kwater / torów
            </label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5, 6].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  disabled={readOnly}
                  onClick={() => onChange({ panesCount: cnt })}
                  className={`flex-1 py-1 rounded text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                    (item.panesCount || 3) === cnt
                      ? "bg-[#0b1220] text-[#4ABBC3]"
                      : "bg-white hover:bg-slate-100 text-slate-700 border border-[#d4dae3]"
                  }`}
                >
                  {cnt}
                </button>
              ))}
            </div>
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

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-medium text-[#7c8597] mb-1">
                Cena netto (PLN)
              </label>
              <input
                type="number"
                step={50}
                min={0}
                disabled={readOnly}
                value={item.priceNet || 0}
                onChange={(e) =>
                  onChange({ priceNet: Math.max(0, parseFloat(e.target.value) || 0) })
                }
                className="w-full bg-white border border-[#d4dae3] rounded-md px-2.5 py-1 text-[#0b1220] font-mono font-bold focus:border-[#4ABBC3] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-medium text-[#7c8597] mb-1">
                Koszt netto (PLN)
              </label>
              <input
                type="number"
                step={50}
                min={0}
                disabled={readOnly}
                value={item.costNet || 0}
                onChange={(e) =>
                  onChange({ costNet: Math.max(0, parseFloat(e.target.value) || 0) })
                }
                className="w-full bg-white border border-[#d4dae3] rounded-md px-2.5 py-1 text-[#0b1220] font-mono focus:border-[#4ABBC3] focus:outline-none"
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
