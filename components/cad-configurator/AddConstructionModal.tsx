"use client";

import React, { useState, useMemo } from "react";
import { ConstructionTemplate } from "./BottomTabsBar";
import {
  Layers,
  X,
  Search,
  Check,
  ChevronRight,
} from "lucide-react";

interface AddConstructionModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: ConstructionTemplate[];
  onSelectTemplate: (templateId?: string) => void;
}

export function AddConstructionModal({
  isOpen,
  onClose,
  templates,
  onSelectTemplate,
}: AddConstructionModalProps) {
  const [search, setSearch] = useState("");

  const filteredTemplates = useMemo(() => {
    if (!search.trim()) return templates;
    const q = search.trim().toLowerCase();
    return templates.filter((tpl) => {
      const matchName = tpl.name.toLowerCase().includes(q);
      const matchCode = tpl.code.toLowerCase().includes(q);
      const matchCategory = tpl.category?.toLowerCase().includes(q);
      const matchSystem = tpl.defaultSystem?.toLowerCase().includes(q);
      const matchFill = tpl.defaultFillType?.toLowerCase().includes(q);
      return matchName || matchCode || matchCategory || matchSystem || matchFill;
    });
  }, [templates, search]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#0b1220]/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-[#e3e7ee] overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e3e7ee] flex items-center justify-between bg-[#f8fafc] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-[rgba(74,187,195,0.12)] text-[#0e7490] rounded-md border border-[rgba(74,187,195,0.3)]">
              <Layers size={18} className="text-[#4ABBC3]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0b1220]">
                Dodaj konstrukcję do oferty
              </h3>
              <p className="text-[11px] text-[#7c8597]">
                Wybierz gotową konstrukcję z bazy szablonów lub utwórz pozycję parametryczną
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#7c8597] hover:text-[#0b1220] rounded-md hover:bg-[#e8ecf2] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Wyszukiwarka szablonów */}
        <div className="px-6 py-3 border-b border-[#e3e7ee] bg-white shrink-0">
          <div className="relative flex items-center">
            <Search
              size={15}
              className="absolute left-3 text-[#7c8597] pointer-events-none"
            />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj konstrukcji po nazwie, kodzie, systemie lub szkle..."
              className="w-full bg-[#f8fafc] hover:bg-white focus:bg-white border border-[#d4dae3] focus:border-[#4ABBC3] rounded-lg pl-9 pr-8 py-2 text-xs text-[#0b1220] focus:ring-2 focus:ring-[#4ABBC3]/20 focus:outline-none transition-all placeholder:text-[#94a3b8]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 text-[#94a3b8] hover:text-[#0b1220] p-0.5 rounded transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between text-[10px] text-[#7c8597] mt-1.5 px-1 font-mono">
            <span>Dostępne szablony: {filteredTemplates.length} z {templates.length}</span>
            {search && (
              <span className="text-[#0e7490] font-semibold">
                Filtrowanie: &quot;{search}&quot;
              </span>
            )}
          </div>
        </div>

        {/* Scrollable List of Templates */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2">
          {filteredTemplates.length === 0 ? (
            <div className="panel p-8 text-center text-xs text-[#7c8597] space-y-2">
              <p className="font-semibold text-[#0b1220]">
                {templates.length === 0
                  ? "Brak zdefiniowanych szablonów w bazie konstrukcji."
                  : `Brak wyników dla zapytania: "${search}"`}
              </p>
              <p className="text-[11px]">
                {templates.length === 0
                  ? "Możesz przejść do Ustawienia → Baza konstrukcji CAD i dodać nowe szablony."
                  : "Spróbuj wpisać inny kod, system lub wyczyść pole wyszukiwania."}
              </p>
            </div>
          ) : (
            filteredTemplates.map((tpl) => {
              const panes = Math.max(1, tpl.defaultPanesCount || 3);
              const width = tpl.defaultWidthMm || 2880;
              const height = tpl.defaultHeightMm || 2300;

              return (
                <div
                  key={tpl._id}
                  onClick={() => {
                    onSelectTemplate(tpl._id);
                    onClose();
                  }}
                  className="group bg-white hover:bg-[#fafbfd] border border-[#e3e7ee] hover:border-[#4ABBC3] rounded-lg p-3 transition-all cursor-pointer flex items-center justify-between gap-4 shadow-2xs hover:shadow-xs"
                >
                  {/* Left: Compact CAD Miniature */}
                  <div className="w-24 h-16 bg-white rounded border border-[#cbd5e1] flex items-center justify-center p-1 shrink-0 group-hover:border-[#4ABBC3] transition-colors shadow-2xs">
                    <svg
                      viewBox="0 0 140 70"
                      className="w-full h-full"
                      preserveAspectRatio="xMidYMid meet"
                    >
                      <rect
                        x="2"
                        y="2"
                        width="136"
                        height="66"
                        fill="none"
                        stroke="#dc2626"
                        strokeWidth="1"
                      />
                      <rect
                        x="3"
                        y="3"
                        width="134"
                        height="64"
                        fill="#29323d"
                        stroke="#1e242b"
                        strokeWidth="1"
                      />
                      <rect
                        x="7"
                        y="7"
                        width="126"
                        height="56"
                        fill="#ffffff"
                      />
                      {Array.from({ length: panes }).map((_, i) => {
                        const pw = 126 / panes;
                        const px = 7 + i * pw;
                        const cx = px + pw / 2;
                        return (
                          <g key={i}>
                            <rect
                              key={i}
                              x={px + 0.5}
                              y="7.5"
                              width={pw - 1}
                              height="55"
                              fill="#ffffff"
                              stroke="#e2e8f0"
                              strokeWidth="0.5"
                            />
                            {i > 0 && (
                              <line
                                x1={px}
                                y1="7"
                                x2={px}
                                y2="63"
                                stroke="#dc2626"
                                strokeWidth="1"
                              />
                            )}
                            <text
                              x={cx}
                              y="35"
                              transform={`rotate(90, ${cx}, 35)`}
                              fill="#1e293b"
                              fontSize={Math.min(9, Math.max(5, pw / 3.2))}
                              fontWeight="800"
                              letterSpacing="1px"
                              textAnchor="middle"
                              dominantBaseline="central"
                            >
                              {tpl.defaultFillType || "HART 10"}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  {/* Center: Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono font-bold text-[#0e7490] bg-[rgba(74,187,195,0.12)] border border-[rgba(74,187,195,0.25)] px-1.5 py-0.2 rounded shrink-0">
                        {tpl.code}
                      </span>
                      <h4 className="font-bold text-xs text-[#0b1220] group-hover:text-[#0e7490] transition-colors truncate">
                        {tpl.name}
                      </h4>
                      {tpl.category && (
                        <span className="text-[10px] text-[#7c8597] bg-[#f1f5f9] px-1.5 py-0.2 rounded shrink-0 hidden sm:inline">
                          {tpl.category}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[11px] font-mono text-[#4b5563]">
                      <span>
                        Wymiary: <strong className="text-[#0b1220]">{width} × {height} mm</strong> ({panes} kwatery)
                      </span>
                      <span>
                        System: <strong className="text-[#0b1220]">{tpl.defaultSystem || "PROCURAL"}</strong>
                      </span>
                      <span>
                        Szkło: <strong className="text-[#0e7490]">{tpl.defaultFillType || "HART 10"}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Right: Select Action */}
                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      type="button"
                      className="btn primary flex items-center gap-1 group-hover:bg-[#35a3ab]"
                      style={{ padding: "5px 12px", fontSize: 12 }}
                    >
                      <Check size={13} />
                      <span className="hidden sm:inline">Wybierz</span>
                      <ChevronRight size={13} className="sm:hidden" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
