"use client";

import React, { useState, useMemo } from "react";
import { ConstructionTemplate } from "./BottomTabsBar";
import {
  Layers,
  X,
  Search,
  Check,
  Plus,
  Minus,
  Loader2,
} from "lucide-react";

export interface SelectedConstructionEntry {
  templateId: string;
  quantity: number;
}

interface AddConstructionModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: ConstructionTemplate[];
  onSelectTemplate: (templateId?: string) => void;
  onSelectMultipleTemplates?: (entries: SelectedConstructionEntry[]) => Promise<void> | void;
}

export function AddConstructionModal({
  isOpen,
  onClose,
  templates,
  onSelectTemplate,
  onSelectMultipleTemplates,
}: AddConstructionModalProps) {
  const [search, setSearch] = useState("");
  const [selectedMap, setSelectedMap] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

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

  const selectedEntries = useMemo(() => {
    return Object.entries(selectedMap)
      .filter(([, qty]) => qty > 0)
      .map(([templateId, quantity]) => ({ templateId, quantity }));
  }, [selectedMap]);

  const totalPositionsCount = useMemo(
    () => selectedEntries.reduce((acc, e) => acc + e.quantity, 0),
    [selectedEntries]
  );

  const totalSelectedPriceNet = useMemo(() => {
    return selectedEntries.reduce((acc, entry) => {
      const tpl = templates.find((t) => t._id === entry.templateId);
      return acc + (tpl?.defaultPriceNet || 0) * entry.quantity;
    }, 0);
  }, [selectedEntries, templates]);

  if (!isOpen) return null;

  const toggleTemplate = (templateId: string) => {
    setSelectedMap((prev) => {
      const next = { ...prev };
      if (next[templateId]) {
        delete next[templateId];
      } else {
        next[templateId] = 1;
      }
      return next;
    });
  };

  const updateQuantity = (templateId: string, delta: number) => {
    setSelectedMap((prev) => {
      const current = prev[templateId] || 0;
      const nextVal = current + delta;
      const next = { ...prev };
      if (nextVal <= 0) {
        delete next[templateId];
      } else {
        next[templateId] = nextVal;
      }
      return next;
    });
  };

  const handleClose = () => {
    if (submitting) return;
    setSelectedMap({});
    setSearch("");
    onClose();
  };

  const handleConfirmSubmit = async () => {
    if (selectedEntries.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      if (onSelectMultipleTemplates) {
        await onSelectMultipleTemplates(selectedEntries);
      } else {
        for (const entry of selectedEntries) {
          for (let i = 0; i < entry.quantity; i++) {
            onSelectTemplate(entry.templateId);
          }
        }
      }
      setSelectedMap({});
      setSearch("");
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-[#0b1220]/50 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-[#e3e7ee] overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
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
                Zaznacz jedną lub kilka konstrukcji z bazy szablonów, aby dodać je jednocześnie do oferty
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
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
            <span>
              Dostępne szablony: {filteredTemplates.length} z {templates.length}
            </span>
            <div className="flex items-center gap-3">
              {search && (
                <span className="text-[#0e7490] font-semibold">
                  Filtrowanie: &quot;{search}&quot;
                </span>
              )}
              {filteredTemplates.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const allFilteredSelected = filteredTemplates.every(
                      (t) => (selectedMap[t._id] || 0) > 0
                    );
                    if (allFilteredSelected) {
                      setSelectedMap((prev) => {
                        const next = { ...prev };
                        for (const t of filteredTemplates) {
                          delete next[t._id];
                        }
                        return next;
                      });
                    } else {
                      setSelectedMap((prev) => {
                        const next = { ...prev };
                        for (const t of filteredTemplates) {
                          if (!next[t._id]) next[t._id] = 1;
                        }
                        return next;
                      });
                    }
                  }}
                  className="text-[#0e7490] hover:underline font-sans font-semibold cursor-pointer"
                >
                  {filteredTemplates.every((t) => (selectedMap[t._id] || 0) > 0)
                    ? "Odznacz widoczne"
                    : "Zaznacz wszystkie widoczne"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable List of Templates */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2 bg-[#f8fafc]/40">
          {filteredTemplates.length === 0 ? (
            <div className="panel p-8 text-center text-xs text-[#7c8597] space-y-2 bg-white">
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
              const qty = selectedMap[tpl._id] || 0;
              const isSelected = qty > 0;

              return (
                <div
                  key={tpl._id}
                  onClick={() => toggleTemplate(tpl._id)}
                  className={`group rounded-lg p-3 transition-all cursor-pointer flex items-center justify-between gap-3.5 border ${
                    isSelected
                      ? "bg-[#f0fdff] border-[#4ABBC3] ring-2 ring-[#4ABBC3]/20 shadow-xs"
                      : "bg-white hover:bg-[#fafbfd] border-[#e3e7ee] hover:border-[#cbd5e1] shadow-2xs"
                  }`}
                >
                  {/* Checkbox indicator */}
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
                      isSelected
                        ? "bg-[#0e7490] border-[#0e7490] text-white"
                        : "bg-white border-[#cbd5e1] group-hover:border-[#4ABBC3]"
                    }`}
                  >
                    {isSelected && <Check size={13} strokeWidth={3} />}
                  </div>

                  {/* Left: Compact CAD Miniature */}
                  <div
                    className={`w-24 h-16 bg-white rounded border flex items-center justify-center p-1 shrink-0 transition-colors shadow-2xs ${
                      isSelected
                        ? "border-[#4ABBC3]"
                        : "border-[#cbd5e1] group-hover:border-[#4ABBC3]"
                    }`}
                  >
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
                        Wymiary: <strong className="text-[#0b1220]">{width} × {height} mm</strong>
                      </span>
                      {tpl.defaultFillType && (
                        <span>
                          Szkło: <strong className="text-[#0e7490]">{tpl.defaultFillType}</strong>
                        </span>
                      )}
                      {tpl.defaultColor && (
                        <span>
                          Kolor: <strong className="text-[#0b1220]">{tpl.defaultColor}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Price & Quantity / Select Action */}
                  <div
                    className="shrink-0 flex items-center gap-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {tpl.defaultPriceNet !== undefined && tpl.defaultPriceNet !== null ? (
                      <div className="text-right hidden sm:block">
                        <span className="block text-[9px] uppercase font-bold text-[#7c8597]">
                          Cena netto
                        </span>
                        <span className="font-mono font-bold text-xs text-[#0b1220]">
                          {tpl.defaultPriceNet.toLocaleString("pl-PL")} zł
                        </span>
                      </div>
                    ) : null}

                    {isSelected ? (
                      <div className="inline-flex items-center rounded-lg border border-[#4ABBC3] bg-white shadow-2xs overflow-hidden">
                        <button
                          type="button"
                          onClick={() => updateQuantity(tpl._id, -1)}
                          className="p-1.5 text-[#475569] hover:text-[#0b1220] hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Zmniejsz ilość"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="px-2.5 text-xs font-mono font-bold text-[#0e7490] min-w-[28px] text-center">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(tpl._id, 1)}
                          className="p-1.5 text-[#475569] hover:text-[#0b1220] hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Dodaj kolejną sztukę tej konstrukcji"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleTemplate(tpl._id)}
                        className="btn ghost border border-[#d4dae3] hover:border-[#4ABBC3] hover:text-[#0e7490] flex items-center gap-1"
                        style={{ padding: "5px 11px", fontSize: 11.5 }}
                      >
                        <Plus size={13} />
                        <span className="hidden sm:inline">Zaznacz</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sticky Footer with Summary & Bulk Add Action */}
        <div className="px-6 py-3.5 border-t border-[#e3e7ee] bg-[#f8fafc] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 text-xs">
            {totalPositionsCount > 0 ? (
              <>
                <span className="text-[#475569]">
                  Wybrano:{" "}
                  <strong className="text-[#0b1220] font-mono">
                    {totalPositionsCount}{" "}
                    {totalPositionsCount === 1
                      ? "konstrukcję"
                      : totalPositionsCount >= 2 && totalPositionsCount <= 4
                        ? "konstrukcje"
                        : "konstrukcji"}
                  </strong>
                </span>
                {totalSelectedPriceNet > 0 && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className="text-[#475569]">
                      Suma netto:{" "}
                      <strong className="text-[#0e7490] font-mono">
                        {totalSelectedPriceNet.toLocaleString("pl-PL")} zł
                      </strong>
                    </span>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedMap({})}
                  className="text-[11px] text-[#64748b] hover:text-[#dc2626] underline ml-1 cursor-pointer"
                >
                  Wyczyść
                </button>
              </>
            ) : (
              <span className="text-[#7c8597]">
                Kliknij dowolne konstrukcje na liście, aby zaznaczyć je do dodania
              </span>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              disabled={submitting}
              onClick={handleClose}
              className="btn ghost"
              style={{ padding: "6px 12px", fontSize: 12 }}
            >
              Anuluj
            </button>
            <button
              type="button"
              disabled={totalPositionsCount === 0 || submitting}
              onClick={() => void handleConfirmSubmit()}
              className="btn primary"
              style={{ padding: "6px 16px", fontSize: 12 }}
            >
              {submitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
              <span>
                {totalPositionsCount > 0
                  ? `Dodaj do oferty (${totalPositionsCount})`
                  : "Dodaj do oferty"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
