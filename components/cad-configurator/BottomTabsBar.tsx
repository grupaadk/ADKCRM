"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { CadConstructionItem } from "./CadCanvas";
import {
  FileText,
  Layers,
  Loader2,
  ChevronLeft,
  ChevronRight,
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
  templates?: ConstructionTemplate[];
  onSelectTab: (tabId: "offer" | "all-cad" | string) => void;
  onOpenAddModal?: () => void;
  onAddConstruction?: (templateId?: string) => void;
  onGenerateOffer?: () => void;
  isGeneratingOffer?: boolean;
  readOnly?: boolean;
}

export function BottomTabsBar({
  activeTab,
  items,
  onSelectTab,
  onGenerateOffer,
  isGeneratingOffer = false,
  readOnly = false,
}: BottomTabsBarProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [checkScroll, items.length]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const activeEl = container.querySelector(
      `[data-tab-id="${activeTab}"]`
    ) as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
    const t = setTimeout(checkScroll, 300);
    return () => clearTimeout(t);
  }, [activeTab, checkScroll]);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    if (e.deltaY !== 0) {
      el.scrollLeft += e.deltaY;
    }
  };

  const scrollByAmount = (offset: number) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollBy({ left: offset, behavior: "smooth" });
  };

  return (
    <div className="h-12 bg-white border-t border-[#e3e7ee] px-3 flex items-center justify-between text-xs font-sans select-none z-20 shadow-xs relative w-full min-w-0 overflow-hidden">
      {/* Scrollable Tabs row */}
      <div className="flex-1 min-w-0 relative flex items-center mr-2">
        {/* Left scroll chevron button */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollByAmount(-220)}
            title="Przewiń zakładki w lewo"
            className="absolute left-0 z-20 h-7 w-6 bg-white/95 hover:bg-white border border-[#d4dae3] rounded-r-md flex items-center justify-center text-[#4b5563] hover:text-[#0b1220] shadow-xs cursor-pointer transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
        )}

        {/* Scrollable tabs container */}
        <div
          ref={scrollContainerRef}
          onWheel={handleWheel}
          onScroll={checkScroll}
          className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar scroll-smooth"
        >
          {/* 1. Zawsze obecna zakładka [ OFERTA ] */}
          <button
            type="button"
            data-tab-id="offer"
            onClick={() => onSelectTab("offer")}
            className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer ${
              activeTab === "offer"
                ? "bg-[#4ABBC3] text-white ring-2 ring-[#4ABBC3]/30"
                : "bg-[#f3f5f8] text-[#1f2937] hover:bg-[#e8ecf2] border border-[#d4dae3]"
            }`}
          >
            <FileText
              size={13}
              className={activeTab === "offer" ? "text-white" : "text-[#4ABBC3]"}
            />
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
              data-tab-id="all-cad"
              onClick={() => onSelectTab("all-cad")}
              title="Widok wszystkich konstrukcji w ofercie na wspólnym arkuszu CAD"
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer ${
                activeTab === "all-cad"
                  ? "bg-[#0b1220] text-white ring-2 ring-[#0b1220]/25"
                  : "bg-[#f3f5f8] text-[#1f2937] hover:bg-[#e8ecf2] border border-[#d4dae3]"
              }`}
            >
              <Layers
                size={13}
                className={activeTab === "all-cad" ? "text-[#4ABBC3]" : "text-[#0e7490]"}
              />
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
                data-tab-id={it._id}
                onClick={() => onSelectTab(it._id)}
                title={`${it.name} (${it.widthMm}x${it.heightMm}mm)`}
                className={`px-3.5 py-1.5 rounded-md text-xs font-mono font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
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

        {/* Right scroll chevron button */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollByAmount(220)}
            title="Przewiń zakładki w prawo"
            className="absolute right-0 z-20 h-7 w-6 bg-white/95 hover:bg-white border border-[#d4dae3] rounded-l-md flex items-center justify-center text-[#4b5563] hover:text-[#0b1220] shadow-xs cursor-pointer transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      {/* Right side: CTA do generowania oferty & Status indicator */}
      <div className="flex items-center gap-2 shrink-0 pl-2 bg-white border-l border-[#e3e7ee]/60 z-10">
        {!readOnly && (
          <button
            type="button"
            disabled={isGeneratingOffer}
            onClick={onGenerateOffer}
            title="Wygeneruj ofertę w PDF (szablon Google Docs) i zapisz w folderze 'Oferty - wysłane do Klienta'"
            className="px-3 py-1.5 rounded-md text-xs font-semibold bg-[#4ABBC3] hover:bg-[#35a3ab] disabled:opacity-60 text-white flex items-center gap-1.5 transition-colors shadow-2xs shrink-0 cursor-pointer"
          >
            {isGeneratingOffer ? (
              <Loader2 size={13} className="animate-spin text-white" />
            ) : (
              <FileText size={13} strokeWidth={2.2} />
            )}
            <span className="hidden sm:inline">{isGeneratingOffer ? "Generowanie..." : "Generuj ofertę"}</span>
            <span className="sm:hidden">{isGeneratingOffer ? "..." : "Generuj"}</span>
          </button>
        )}

        {/* Right status indicator in bottom bar */}
        <div className="hidden lg:flex items-center gap-2 text-[11px] text-[#7c8597] font-mono shrink-0 pl-2 border-l border-[#e3e7ee]/60">
          <span className="w-2 h-2 rounded-full bg-[#10b981]" />
          <span>ADK CAD Studio</span>
        </div>
      </div>
    </div>
  );
}
