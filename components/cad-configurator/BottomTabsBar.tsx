"use client";

import React from "react";
import { CadConstructionItem } from "./CadCanvas";
import {
  FileText,
  Layers,
  Plus,
} from "lucide-react";

export interface ConstructionTemplate {
  _id: string;
  name: string;
  code: string;
  category?: string;
  defaultWidthMm?: number;
  defaultHeightMm?: number;
  defaultPanesCount?: number;
  defaultSystem?: string;
  defaultColor?: string;
  defaultFillType?: string;
  defaultPriceNet?: number;
}

interface BottomTabsBarProps {
  activeTab: "offer" | "all-cad" | string; // 'offer', 'all-cad' lub ID pozycji
  items: CadConstructionItem[];
  templates: ConstructionTemplate[];
  onSelectTab: (tabId: "offer" | "all-cad" | string) => void;
  onOpenAddModal: () => void;
  onAddConstruction?: (templateId?: string) => void;
  readOnly?: boolean;
}

export function BottomTabsBar({
  activeTab,
  items,
  templates,
  onSelectTab,
  onOpenAddModal,
  readOnly = false,
}: BottomTabsBarProps) {
  return (
    <div className="h-12 bg-white border-t border-[#e3e7ee] px-3 flex items-center justify-between text-xs font-sans select-none z-20 shadow-xs relative">
      {/* Scrollable Tabs & Add Button row */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Scrollable tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-[calc(100vw-340px)] shrink-0">
          {/* 1. Zawsze obecna zakładka [ OFERTA ] */}
          <button
            type="button"
            onClick={() => onSelectTab("offer")}
            className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer ${
              activeTab === "offer"
                ? "bg-[#4ABBC3] text-white ring-2 ring-[#4ABBC3]/30"
                : "bg-[#f3f5f8] text-[#1f2937] hover:bg-[#e8ecf2] border border-[#d4dae3]"
            }`}
          >
            <FileText size={13} className={activeTab === "offer" ? "text-white" : "text-[#4ABBC3]"} />
            <span>OFERTA</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === "offer"
                  ? "bg-white/20 text-white"
                  : "bg-white text-[#4b5563] border border-[#d4dae3]"
              }`}
            >
              {items.length}
            </span>
          </button>

          {/* 2. Zakładka [ WSZYSTKIE CAD ] - widok zbiorczy wszystkich konstrukcji */}
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => onSelectTab("all-cad")}
              title="Widok wszystkich konstrukcji w ofercie na wspólnym arkuszu CAD"
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer ${
                activeTab === "all-cad"
                  ? "bg-[#0b1220] text-white ring-2 ring-[#0b1220]/25"
                  : "bg-[#f3f5f8] text-[#1f2937] hover:bg-[#e8ecf2] border border-[#d4dae3]"
              }`}
            >
              <Layers size={13} className={activeTab === "all-cad" ? "text-[#4ABBC3]" : "text-[#0e7490]"} />
              <span>WSZYSTKIE CAD</span>
            </button>
          )}

          {/* Separator */}
          <div className="h-5 w-px bg-[#e3e7ee] mx-1 shrink-0" />

          {/* Dynamic Numbered Tabs: [ 1 ], [ 2 ], [ 3 ]... */}
          {items.map((it) => {
            const isActive = activeTab === it._id;
            return (
              <button
                key={it._id}
                type="button"
                onClick={() => onSelectTab(it._id)}
                title={`${it.name} (${it.widthMm}x${it.heightMm}mm)`}
                className={`px-3.5 py-1.5 rounded-md text-xs font-mono font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  isActive
                    ? "bg-[#0e7490] text-white shadow-xs ring-2 ring-[#0e7490]/30"
                    : "bg-white text-[#4b5563] hover:text-[#0b1220] hover:bg-[#f8fafc] border border-[#d4dae3]"
                }`}
              >
                <span className="text-[11px] font-bold">[ {it.positionIndex} ]</span>
                <span className="hidden md:inline font-sans font-normal text-[11px] truncate max-w-[130px]">
                  {it.shortName || it.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* + Dodaj konstrukcję button (OUTSIDE of overflow container so it is NEVER clipped) */}
        {!readOnly && (
          <button
            type="button"
            onClick={onOpenAddModal}
            title="Wybierz konstrukcję z bazy (dostępne szablony)"
            className="px-3 py-1.5 rounded-md text-xs font-semibold bg-[#4ABBC3] hover:bg-[#35a3ab] text-white flex items-center gap-1.5 transition-colors shadow-2xs shrink-0 cursor-pointer"
          >
            <Plus size={13} strokeWidth={2.5} />
            <span>Dodaj konstrukcję</span>
            {templates.length > 0 && (
              <span className="bg-white/20 text-white text-[10px] px-1.5 rounded-full font-mono font-bold">
                {templates.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Right status indicator in bottom bar */}
      <div className="hidden lg:flex items-center gap-2 text-[11px] text-[#7c8597] font-mono shrink-0 pl-3">
        <span className="w-2 h-2 rounded-full bg-[#10b981]" />
        <span>ADK CAD Studio</span>
      </div>
    </div>
  );
}
