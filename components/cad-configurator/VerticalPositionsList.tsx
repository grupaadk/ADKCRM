"use client";

import React from "react";
import { CadConstructionItem } from "./CadCanvas";
import {
  Layers,
  Copy,
  Trash2,
  Plus,
  CheckCircle2,
} from "lucide-react";

interface VerticalPositionsListProps {
  items: CadConstructionItem[];
  activeItemId: string | null;
  onSelectItem: (id: string) => void;
  onDuplicateItem?: (id: string) => void;
  onDeleteItem?: (id: string) => void;
  onAddNew?: () => void;
  readOnly?: boolean;
}

export function VerticalPositionsList({
  items,
  activeItemId,
  onSelectItem,
  onDuplicateItem,
  onDeleteItem,
  onAddNew,
  readOnly = false,
}: VerticalPositionsListProps) {
  return (
    <aside className="w-72 bg-white border-l border-[#e3e7ee] flex flex-col h-full text-[#1f2937] select-none overflow-hidden shrink-0">
      {/* Header */}
      <div className="h-10 bg-[#f8fafc] border-b border-[#e3e7ee] px-3 flex items-center justify-between text-xs font-bold text-[#0b1220]">
        <span className="flex items-center gap-1.5 text-[#0e7490]">
          <Layers size={14} className="text-[#4ABBC3]" /> Pozycje w ofercie ({items.length})
        </span>
        {onAddNew && !readOnly && (
          <button
            type="button"
            onClick={onAddNew}
            title="Dodaj nową pozycję"
            className="p-1 rounded bg-white hover:bg-slate-50 text-[#0e7490] border border-[#d4dae3] shadow-2xs transition-colors"
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      {/* List of Positions */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {items.length === 0 ? (
          <div className="text-center py-10 px-4 text-[#7c8597] text-xs">
            Brak pozycji w ofercie. Użyj przycisku &quot;+ Dodaj konstrukcję&quot; na dolnym pasku.
          </div>
        ) : (
          items.map((it) => {
            const isActive = it._id === activeItemId;
            const panes = Math.max(1, it.panesCount || 3);
            const price = it.priceNet || 0;
            const isTriangle =
              it.name.toLowerCase().includes("trójką") ||
              Boolean(it.shortName && it.shortName.toLowerCase().includes("trójką")) ||
              Boolean(
                it.systemName &&
                  (it.systemName.toLowerCase().includes("krokiew") ||
                    it.systemName.toLowerCase().includes("profil h"))
              );

            const isTriangleRight =
              isTriangle &&
              ((it.name || "").toLowerCase().includes("praw") ||
                Boolean(it.shortName && it.shortName.toLowerCase().includes("praw")));

            return (
              <div
                key={it._id}
                onClick={() => onSelectItem(it._id)}
                className={`relative group rounded-lg p-2.5 transition-all cursor-pointer border ${
                  isActive
                    ? "bg-[rgba(74,187,195,0.08)] border-[#4ABBC3] shadow-xs ring-1 ring-[#4ABBC3]"
                    : "bg-white border-[#e3e7ee] hover:border-[#b9c2d0] hover:bg-[#fafbfd]"
                }`}
              >
                {/* Header row of card */}
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`w-5 h-5 rounded flex items-center justify-center text-[11px] font-mono font-bold shrink-0 ${
                        isActive
                          ? "bg-[#4ABBC3] text-white"
                          : "bg-[#f3f5f8] text-[#4b5563] border border-[#d4dae3]"
                      }`}
                    >
                      {it.positionIndex}
                    </span>
                    <span
                      className={`text-xs font-semibold truncate ${
                        isActive ? "text-[#0e7490]" : "text-[#0b1220]"
                      }`}
                      title={it.name}
                    >
                      {it.name}
                    </span>
                  </div>

                  {isActive && (
                    <CheckCircle2 size={13} className="text-[#4ABBC3] shrink-0" />
                  )}
                </div>

                {/* Miniature CAD preview exactly matching screenshot */}
                <div className="relative h-20 bg-white rounded border border-[#cbd5e1] mb-2 overflow-hidden flex flex-col items-center justify-center p-1.5 shadow-2xs">
                  <svg
                    viewBox="0 0 120 62"
                    className="w-full h-full"
                    preserveAspectRatio="xMidYMid meet"
                  >
                    {isTriangle ? (
                      <g>
                        {/* Czerwony obrys trójkąta */}
                        <polygon
                          points={isTriangleRight ? "4,46 116,8 116,58 4,58" : "4,8 116,46 116,58 4,58"}
                          fill="none"
                          stroke="#dc2626"
                          strokeWidth="0.8"
                        />
                        {/* Dolny profil H */}
                        <rect
                          x="5"
                          y="52"
                          width="110"
                          height="5.5"
                          fill="#29323d"
                          stroke="#1e242b"
                          strokeWidth="0.5"
                        />
                        <text
                          x="60"
                          y="56"
                          fill="#ffffff"
                          fontSize="3.4"
                          fontWeight="900"
                          textAnchor="middle"
                          letterSpacing="0.8px"
                        >
                          PROFIL H
                        </text>
                        {/* Słup przyścienny (wysoki bok) */}
                        <rect
                          x={isTriangleRight ? "110" : "5"}
                          y="13"
                          width="5"
                          height="39"
                          fill="#29323d"
                          stroke="#1e242b"
                          strokeWidth="0.5"
                        />
                        {/* Belka skośna */}
                        <polygon
                          points={isTriangleRight ? "115,9 5,47 5,52 115,14" : "5,9 115,47 115,52 5,14"}
                          fill="#29323d"
                          stroke="#1e242b"
                          strokeWidth="0.8"
                        />
                        {/* Szkło */}
                        <polygon
                          points={isTriangleRight ? "108,19 14,50 108,50" : "12,19 106,50 12,50"}
                          fill="#ffffff"
                          stroke="#38bdf8"
                          strokeWidth="0.8"
                        />
                        <text
                          x={isTriangleRight ? "80" : "40"}
                          y="43"
                          fill="#0b1220"
                          fontSize="6"
                          fontWeight="800"
                          textAnchor="middle"
                        >
                          {it.fillType || "HART 10"}
                        </text>
                      </g>
                    ) : (
                      <>
                        {/* Thin red perimeter */}
                        <rect
                          x="2"
                          y="2"
                          width="116"
                          height="58"
                          fill="none"
                          stroke="#dc2626"
                          strokeWidth="0.8"
                        />
                        {/* Dark frame */}
                        <rect
                          x="3"
                          y="3"
                          width="114"
                          height="56"
                          fill="#29323d"
                          stroke="#1e242b"
                          strokeWidth="0.8"
                        />
                        {/* Opening */}
                        <rect
                          x="6"
                          y="6"
                          width="108"
                          height="50"
                          fill="#ffffff"
                        />
                        {/* Glass Panes */}
                        {Array.from({ length: panes }).map((_, i) => {
                          const pw = 108 / panes;
                          const px = 6 + i * pw;
                          const cx = px + pw / 2;
                          return (
                        <g key={i}>
                          <rect
                            x={px + 0.5}
                            y="6.5"
                            width={pw - 1}
                            height="49"
                            fill="#ffffff"
                            stroke="#e2e8f0"
                            strokeWidth="0.5"
                          />
                          {i > 0 && (
                            <line
                              x1={px}
                              y1="6"
                              x2={px}
                              y2="56"
                              stroke="#dc2626"
                              strokeWidth="0.8"
                            />
                          )}
                          <text
                            x={cx}
                            y="31"
                            transform={`rotate(90, ${cx}, 31)`}
                            fill="#1e293b"
                            fontSize={Math.min(9, Math.max(5, pw / 3))}
                            fontWeight="800"
                            letterSpacing="1px"
                            textAnchor="middle"
                            dominantBaseline="central"
                          >
                            {it.fillType || "HART 10"}
                          </text>
                        </g>
                      );
                    })}
                  </>
                )}
              </svg>
            </div>

                {/* Dimension & System info */}
                <div className="flex items-center justify-between text-[11px] font-mono text-[#7c8597] mb-1">
                  <div className="flex items-center gap-1.5">
                    <span>
                      {it.widthMm} × {it.heightMm} mm
                    </span>
                  </div>
                  <span>{it.quantity} szt.</span>
                </div>

                {/* Bottom Row: Price & Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-[#e3e7ee] text-xs">
                  <span className="font-mono font-bold text-[#0e7490]">
                    {price.toLocaleString("pl-PL")} zł{" "}
                    <span className="text-[10px] text-[#7c8597] font-normal">netto</span>
                  </span>

                  {!readOnly && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {onDuplicateItem && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDuplicateItem(it._id);
                          }}
                          title="Duplikuj tę pozycję"
                          className="p-1 rounded text-[#7c8597] hover:text-[#0b1220] hover:bg-[#f3f5f8]"
                        >
                          <Copy size={12} />
                        </button>
                      )}
                      {onDeleteItem && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteItem(it._id);
                          }}
                          title="Usuń tę pozycję"
                          className="p-1 rounded text-[#dc2626] hover:text-[#b91c1c] hover:bg-[#fee2e2]"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
