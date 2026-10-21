"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { CadConstructionItem, CadSegment } from "./CadCanvas";
import { OfferData, OpportunityData } from "./OfferSummaryTab";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Ruler,
  Layers,
  ArrowLeft,
  LayoutGrid,
  FileSpreadsheet,
  Plus,
  Edit3,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Rows,
  X,
  MoveVertical,
} from "lucide-react";

interface AllConstructionsCadViewProps {
  offer?: OfferData;
  items: CadConstructionItem[];
  opportunity?: OpportunityData | null;
  onSelectPosition: (itemId: string) => void;
  onBackToOffer: () => void;
  onAddNewPosition: () => void;
  onUpdatePlacement?: (
    itemId: string,
    placement: {
      placedAboveItemId?: string | null;
      placedBelowItemId?: string | null;
      rowIndex?: number | null;
    }
  ) => void;
}

export function AllConstructionsCadView({
  items,
  onSelectPosition,
  onBackToOffer,
  onAddNewPosition,
  onUpdatePlacement,
}: AllConstructionsCadViewProps) {
  const [zoom, setZoom] = useState(1);
  const [showDimensions, setShowDimensions] = useState(true);
  const [displayMode, setDisplayMode] = useState<"sheet" | "grid">("sheet");
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  // Lokalne nadpisania położenia dla natychmiastowej responsywności UI (optimistic updates)
  const [localPlacements, setLocalPlacements] = useState<
    Record<
      string,
      {
        placedAboveItemId?: string | null;
        placedBelowItemId?: string | null;
        rowIndex?: number | null;
      }
    >
  >({});

  // Stan otwartego menu rozwijanego po kliknięciu LPM na konstrukcję
  const [activeDropdown, setActiveDropdown] = useState<{
    itemId: string;
    x: number;
    y: number;
  } | null>(null);

  const viewportRef = useRef<HTMLDivElement | null>(null);

  // Obsługa przybliżania i oddalania za pomocą Ctrl + Scroll myszki
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const step = e.deltaY < 0 ? 0.12 : -0.12;
        setZoom((prev) =>
          Math.min(4, Math.max(0.4, Math.round((prev + step) * 100) / 100))
        );
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, [displayMode]);

  const totalQuantity = items.reduce((acc, it) => acc + (it.quantity || 1), 0);
  const totalAreaM2 =
    Math.round(
      items.reduce(
        (acc, it) =>
          acc +
          ((it.widthMm || 2880) * (it.heightMm || 2300) * (it.quantity || 1)) /
            1_000_000,
        0
      ) * 100
    ) / 100;

  // Funkcja zmiany położenia konstrukcji (umieszczenie nad inną, pod inną lub w rzędzie poniżej)
  const handleSetPlacement = (
    targetItemId: string,
    placement: {
      placedAboveItemId?: string | null;
      placedBelowItemId?: string | null;
      rowIndex?: number | null;
    }
  ) => {
    // Optymistyczna natychmiastowa aktualizacja w lokalnym stanie
    setLocalPlacements((prev) => ({
      ...prev,
      [targetItemId]: {
        ...prev[targetItemId],
        ...placement,
      },
    }));

    if (onUpdatePlacement) {
      onUpdatePlacement(targetItemId, placement);
    }
    setActiveDropdown(null);
  };

  // ── Obliczenia układu dla Wspólnego Arkusza CAD ("sheet") ──
  // Obsługa układania konstrukcji pionowo (jedna nad drugą np. trójkąt nad drzwiami) oraz w rzędach (jedna pod drugą)
  const gapX = 520; // odstęp poziomy między konstrukcjami/stosami na arkuszu
  const gapY = 640; // odstęp pionowy między rzędami konstrukcji
  const sheetPadX = 260;
  const sheetPadTop = 400;
  const sheetPadBottom = 160;

  interface ColumnStack {
    rootItem: CadConstructionItem;
    stackedItems: CadConstructionItem[]; // elementy od dołu do góry (index 0 to podstawa na posadzce)
    stackWidth: number;
    stackHeight: number;
  }

  interface RenderRow {
    rowIndex: number;
    stacks: ColumnStack[];
    rowWidth: number;
    maxStackHeight: number;
  }

  const computedRows: RenderRow[] = useMemo(() => {
    const effectiveItems = items.map((it) => {
      const override = localPlacements[it._id];
      if (!override) return it;
      return {
        ...it,
        placedAboveItemId:
          override.placedAboveItemId !== undefined
            ? override.placedAboveItemId ?? undefined
            : it.placedAboveItemId,
        placedBelowItemId:
          override.placedBelowItemId !== undefined
            ? override.placedBelowItemId ?? undefined
            : it.placedBelowItemId,
        rowIndex:
          override.rowIndex !== undefined
            ? override.rowIndex ?? 0
            : it.rowIndex ?? 0,
      };
    });

    const rowMap = new Map<number, CadConstructionItem[]>();
    effectiveItems.forEach((it) => {
      const r = Math.max(0, it.rowIndex ?? 0);
      if (!rowMap.has(r)) rowMap.set(r, []);
      rowMap.get(r)!.push(it);
    });

    const sortedRowIndices = Array.from(rowMap.keys()).sort((a, b) => a - b);
    if (sortedRowIndices.length === 0) sortedRowIndices.push(0);

    return sortedRowIndices.map((rIdx) => {
      const rowItems = rowMap.get(rIdx) || [];

      // Budowanie relacji rodzic -> dziecko (placedAboveItemId: dziecko leży NAD rodzicem)
      const childrenMap = new Map<string, CadConstructionItem>();
      const isChild = new Set<string>();

      rowItems.forEach((it) => {
        if (it.placedAboveItemId && it.placedAboveItemId !== it._id) {
          const parent = rowItems.find((p) => p._id === it.placedAboveItemId);
          if (parent) {
            childrenMap.set(parent._id, it);
            isChild.add(it._id);
          }
        }
      });

      // Budowanie kolumn / stosów
      const stacks: ColumnStack[] = [];
      rowItems.forEach((it) => {
        if (!isChild.has(it._id)) {
          const stacked: CadConstructionItem[] = [it];
          const visited = new Set<string>([it._id]);
          let curr = it;
          while (childrenMap.has(curr._id)) {
            const next = childrenMap.get(curr._id)!;
            if (visited.has(next._id)) break; // zapobieganie cyklom
            visited.add(next._id);
            stacked.push(next);
            curr = next;
          }

          const stackWidth = Math.max(
            ...stacked.map((s) => Math.max(s.widthMm || 2880, 400))
          );
          const stackHeight = stacked.reduce(
            (sum, s) => sum + Math.max(s.heightMm || 2300, 400),
            0
          );

          stacks.push({
            rootItem: it,
            stackedItems: stacked,
            stackWidth,
            stackHeight,
          });
        }
      });

      const rowWidth =
        stacks.reduce((acc, st) => acc + st.stackWidth, 0) +
        Math.max(0, stacks.length - 1) * gapX;
      const maxStackHeight = Math.max(
        ...stacks.map((st) => st.stackHeight),
        1200
      );

      return {
        rowIndex: rIdx,
        stacks,
        rowWidth,
        maxStackHeight,
      };
    });
  }, [items, localPlacements]);

  const maxRowWidth = Math.max(
    ...computedRows.map((r) => r.rowWidth),
    2400
  );
  const totalRowsHeight =
    computedRows.reduce((acc, r) => acc + r.maxStackHeight, 0) +
    Math.max(0, computedRows.length - 1) * gapY;

  const sheetWidth = maxRowWidth + sheetPadX * 2;
  const sheetHeight = totalRowsHeight + sheetPadTop + sheetPadBottom;
  const frameThickness = 50;

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col bg-[#f1f5f9] select-none overflow-hidden">
        <div className="h-11 bg-white border-b border-[#e3e7ee] px-4 flex items-center justify-between z-10 shadow-2xs shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToOffer}
              className="px-2.5 py-1 rounded-md text-xs font-semibold text-[#4b5563] hover:text-[#0b1220] hover:bg-slate-100 border border-[#e2e8f0] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft size={13} />
              <span>Wróć do oferty</span>
            </button>
            <div className="flex items-center gap-2 text-xs font-bold text-[#0b1220]">
              <Layers size={15} className="text-[#4ABBC3]" />
              <span>Widok zbiorczy CAD</span>
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white border border-[#e2e8f0] shadow-xs flex items-center justify-center text-[#4ABBC3] mb-3">
            <Layers size={26} />
          </div>
          <h3 className="text-sm font-bold text-[#0b1220] mb-1">
            Brak konstrukcji w ofercie
          </h3>
          <p className="text-xs text-[#64748b] max-w-sm mb-4">
            Dodaj przynajmniej jedną konstrukcję do oferty, aby wyświetlić zbiorczy arkusz rysunkowy CAD.
          </p>
          <button
            type="button"
            onClick={onAddNewPosition}
            className="btn primary"
            style={{ padding: "8px 14px", fontSize: 12 }}
          >
            <Plus size={14} />
            <span>Dodaj konstrukcję do oferty</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 flex flex-col h-full min-w-0 min-h-0 bg-[#f1f5f9] select-none overflow-hidden">
      {/* ── Top CAD Controls Bar ── */}
      <div className="min-h-11 py-1.5 bg-white border-b border-[#e3e7ee] px-4 flex flex-wrap items-center justify-between gap-2 z-10 shadow-2xs shrink-0">
        {/* Left: Back + Title + Summary Pills */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={onBackToOffer}
            className="px-2.5 py-1 rounded-md text-xs font-semibold text-[#334155] hover:text-[#0b1220] bg-[#f8fafc] hover:bg-[#e2e8f0]/60 border border-[#cbd5e1] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft size={13} />
            <span>Podsumowanie oferty</span>
          </button>

          <div className="h-4 w-px bg-[#e3e7ee] hidden sm:block" />

          <div className="flex items-center gap-2 text-xs font-bold text-[#0b1220]">
            <Layers size={15} className="text-[#4ABBC3]" />
            <span>Wszystkie konstrukcje CAD</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#f0fdff] text-[#0e7490] border border-[#a5f3fc]">
              {items.length}{" "}
              {items.length === 1
                ? "pozycja"
                : items.length < 5
                  ? "pozycje"
                  : "pozycji"}{" "}
              ({totalQuantity} szt.)
            </span>
            <span className="text-[#64748b] font-mono font-normal hidden lg:inline">
              · Powierzchnia całkowita: <strong className="text-[#0b1220]">{totalAreaM2} m²</strong>
            </span>
          </div>
        </div>

        {/* Right: Mode Switcher, Columns, Dimensions, Zoom */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Mode Switcher: Wspólny arkusz vs Siatka */}
          <div className="inline-flex items-center rounded-md bg-[#f1f5f9] p-0.5 border border-[#cbd5e1]">
            <button
              type="button"
              onClick={() => setDisplayMode("sheet")}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                displayMode === "sheet"
                  ? "bg-white text-[#0e7490] shadow-2xs"
                  : "text-[#64748b] hover:text-[#0b1220]"
              }`}
              title="Wszystkie konstrukcje na jednym wspólnym arkuszu rysunkowym CAD"
            >
              <FileSpreadsheet size={12} />
              <span>Wspólny arkusz CAD</span>
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode("grid")}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                displayMode === "grid"
                  ? "bg-white text-[#0e7490] shadow-2xs"
                  : "text-[#64748b] hover:text-[#0b1220]"
              }`}
              title="Siatka osobnych kart CAD dla każdej pozycji"
            >
              <LayoutGrid size={12} />
              <span>Siatka kart</span>
            </button>
          </div>

          {/* Toggle Wymiary */}
          <button
            type="button"
            onClick={() => setShowDimensions((v) => !v)}
            title="Włącz / Wyłącz linie wymiarowe"
            className={`p-1.5 rounded text-xs flex items-center gap-1 border transition-colors cursor-pointer ${
              showDimensions
                ? "bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd]"
                : "bg-white text-[#7c8597] border-[#d4dae3]"
            }`}
          >
            <Ruler size={13} />
            <span className="hidden sm:inline">Wymiary</span>
          </button>

          {displayMode === "sheet" && (
            <>
              <div className="h-4 w-px bg-[#e3e7ee] mx-0.5" />

              <span
                className="hidden xl:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono text-[#64748b] bg-slate-100 border border-[#e2e8f0]"
                title="Przytrzymaj klawisz Ctrl i kręć kółkiem myszy, aby przybliżać lub oddalać widok CAD"
              >
                Ctrl + Scroll
              </span>

              <button
                type="button"
                onClick={() =>
                  setZoom((z) => Math.max(0.4, Math.round((z - 0.15) * 100) / 100))
                }
                title="Oddal (Zoom out / Ctrl + Scroll w dół)"
                className="p-1.5 rounded bg-white text-[#4b5563] hover:text-[#0b1220] border border-[#d4dae3] cursor-pointer"
              >
                <ZoomOut size={13} />
              </button>
              <span className="text-[11px] font-mono text-[#0b1220] min-w-[42px] text-center font-bold">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() =>
                  setZoom((z) => Math.min(4, Math.round((z + 0.15) * 100) / 100))
                }
                title="Przybliż (Zoom in / Ctrl + Scroll w górę)"
                className="p-1.5 rounded bg-white text-[#4b5563] hover:text-[#0b1220] border border-[#d4dae3] cursor-pointer"
              >
                <ZoomIn size={13} />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                title="Dopasuj do ekranu (100%)"
                className="p-1.5 rounded bg-white text-[#4b5563] hover:text-[#0b1220] border border-[#d4dae3] cursor-pointer"
              >
                <Maximize2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Main Content Area ── */}
      {displayMode === "sheet" ? (
        /* ── TRYB 1: WSPÓLNY ARKUSZ RYSUNKOWY CAD (Wszystkie konstrukcje na jednym rysunku SVG) ── */
        <div
          ref={viewportRef}
          className="relative flex-1 min-h-0 min-w-0 overflow-auto p-2 sm:p-4 bg-slate-100/70"
        >
          <div
            style={{
              width: `${Math.round(zoom * 100)}%`,
              height: `${Math.round(zoom * 100)}%`,
              minWidth: `${Math.round(zoom * 100)}%`,
              minHeight: `${Math.round(zoom * 100)}%`,
            }}
            className="flex items-center justify-center m-auto select-none"
          >
            <svg
              viewBox={`0 0 ${sheetWidth} ${sheetHeight}`}
              preserveAspectRatio="xMidYMid meet"
              className="w-full h-full block rounded-lg shadow-sm"
              style={{
                width: "100%",
                height: "100%",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              }}
            >
              <defs>
                <marker
                  id="multiCadArrowStart"
                  viewBox="0 0 16 16"
                  refX="2"
                  refY="8"
                  markerWidth="16"
                  markerHeight="16"
                  orient="auto"
                >
                  <path d="M 16 2 L 2 8 L 16 14 z" fill="#0b1220" />
                </marker>
                <marker
                  id="multiCadArrowEnd"
                  viewBox="0 0 16 16"
                  refX="14"
                  refY="8"
                  markerWidth="16"
                  markerHeight="16"
                  orient="auto"
                >
                  <path d="M 0 2 L 14 8 L 0 14 z" fill="#0b1220" />
                </marker>
              </defs>

              {/* Czyste białe tło arkusza CAD */}
              <rect
                x="0"
                y="0"
                width={sheetWidth}
                height={sheetHeight}
                fill="#ffffff"
              />
              <rect
                x="0"
                y="0"
                width={sheetWidth}
                height={sheetHeight}
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="2"
              />

              {/* Renderowanie rzędów i konstrukcji */}
              {computedRows.map((renderRow, rowIndex) => {
                const previousRowsHeight = computedRows
                  .slice(0, rowIndex)
                  .reduce((acc, r) => acc + r.maxStackHeight + gapY, 0);
                const currentRowMaxHeight = renderRow.maxStackHeight;
                const floorY =
                  sheetPadTop + previousRowsHeight + currentRowMaxHeight;

                // Wyśrodkowanie rzędu w poziomie na arkuszu
                const currentRowWidth = renderRow.rowWidth;
                let stackCursorX = (sheetWidth - currentRowWidth) / 2;

                return (
                  <g key={`row-${renderRow.rowIndex}`}>
                    {/* Ciągła linia poziomu posadzki ±0.00 dla rzędu */}
                    <line
                      x1={Math.max(80, stackCursorX - 160)}
                      y1={floorY + 4}
                      x2={Math.min(
                        sheetWidth - 80,
                        stackCursorX + currentRowWidth + 160
                      )}
                      y2={floorY + 4}
                      stroke="#0e7490"
                      strokeWidth="3"
                      strokeDasharray="18 10"
                      strokeOpacity="0.55"
                    />
                    <text
                      x={Math.max(90, stackCursorX - 150)}
                      y={floorY + 48}
                      fill="#0e7490"
                      fontSize="36"
                      fontWeight="700"
                    >
                      {computedRows.length > 1
                        ? `RZĄD ${renderRow.rowIndex + 1} — ±0.00 POZIOM POSADZKI`
                        : `±0.00 POZIOM POSADZKI`}
                    </text>

                    {renderRow.stacks.map((stack, stackIndex) => {
                      const currentStackX = stackCursorX;
                      stackCursorX += stack.stackWidth + gapX;
                      let currentBaseY = floorY;

                      return (
                        <g key={`stack-${stack.rootItem._id}-${stackIndex}`}>
                          {stack.stackedItems.map((item, itemIdxInStack) => {
                            const width = Math.max(item.widthMm || 2880, 400);
                            const height = Math.max(item.heightMm || 2300, 400);
                            const panes = Math.max(item.panesCount || 3, 1);
                            const fill = item.fillType || "HART 10";
                            const color = item.color || "RAL 7016MAT";
                            const isHovered = hoveredItemId === item._id;

                            const hasItemAbove =
                              itemIdxInStack < stack.stackedItems.length - 1;
                            const isStackedAbove = itemIdxInStack > 0;

                            const originX =
                              currentStackX + (stack.stackWidth - width) / 2;
                            const originY = currentBaseY - height;
                            currentBaseY = originY;

                            const isTriangle =
                              item.name.toLowerCase().includes("trójką") ||
                              Boolean(item.shortName && item.shortName.toLowerCase().includes("trójką")) ||
                              Boolean(
                                item.systemName &&
                                  (item.systemName.toLowerCase().includes("krokiew") ||
                                    item.systemName.toLowerCase().includes("profil h"))
                              );

                            const slopeAngleDeg = Math.round(Math.atan2(height, width) * (180 / Math.PI) * 10) / 10;
                            const hypotenuseMm = Math.round(Math.sqrt(width * width + height * height));

                            // Precyzyjne obliczenia geometrii trójkąta (do zabudowy tarasu pod krokwie)
                            const tBot = 45; // wysokość dolnego PROFIL H
                            const tKrok = 50; // grubość belki krokwi dachowej
                            const tLeft = 45; // grubość pionowego słupka przyściennego
                            const tSub = 30; // grubość listwy montażowej podkrokwiowej

                            const yFloorPos = originY + height;
                            const yProfTop = yFloorPos - tBot;
                            const yKrokLeftTop = originY;
                            const yKrokLeftBot = originY + tKrok;
                            const yKrokRightBot = yProfTop;
                            const yKrokRightTop = Math.max(originY + 10, yProfTop - tKrok);

                            const yInnerTop = yKrokLeftBot + tSub;
                            const yInnerBot = yProfTop;
                            const xInnerLeft = originX + tLeft;
                            const xInnerRight = originX + width;

                            const mInner = Math.max(0.001, (yInnerBot - yInnerTop) / Math.max(1, xInnerRight - xInnerLeft));
                            const krokiewAngleDeg = Math.round(Math.atan2(yKrokRightTop - yKrokLeftTop, width) * (180 / Math.PI) * 10) / 10;
                            const krokiewLenMm = Math.round(Math.sqrt(width * width + (yKrokRightTop - yKrokLeftTop) * (yKrokRightTop - yKrokLeftTop)));

                            const gMargin = 14; // szczelina montażowa szyby
                            const xGlassLeft = xInnerLeft + gMargin;
                            const yGlassBot = yInnerBot - gMargin;
                            const yGlassTop = yInnerTop + mInner * (xGlassLeft - xInnerLeft) + gMargin;
                            const xGlassRight = Math.round(
                              Math.min(
                                originX + width - 40,
                                Math.max(xGlassLeft + 50, xInnerLeft + (yGlassBot - gMargin - yInnerTop) / mInner)
                              )
                            );

                            const paneWidth = Math.round(width / panes);
                            const segments: CadSegment[] =
                              item.segments && item.segments.length === panes
                                ? item.segments
                                : Array.from({ length: panes }).map((_, i) => ({
                                    widthMm:
                                      i === panes - 1
                                        ? width - paneWidth * (panes - 1)
                                        : paneWidth,
                                    heightMm: height - 103,
                                  }));

                            return (
                              <g
                                key={item._id}
                                className="cursor-pointer"
                                onMouseEnter={() => setHoveredItemId(item._id)}
                                onMouseLeave={() => setHoveredItemId(null)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveDropdown({
                                    itemId: item._id,
                                    x: e.clientX,
                                    y: e.clientY,
                                  });
                                }}
                              >
                                {/* Podświetlenie interaktywne po najechaniu */}
                                {isHovered && (
                                  <rect
                                    x={originX - 70}
                                    y={originY - (hasItemAbove ? 20 : 300)}
                                    width={width + 240}
                                    height={height + (hasItemAbove ? 40 : 360)}
                                    rx="20"
                                    fill="#0e7490"
                                    fillOpacity="0.04"
                                    stroke="#0e7490"
                                    strokeWidth="4"
                                    strokeDasharray="12 8"
                                  />
                                )}

                                {/* Etykieta nagłówkowa pozycji */}
                                {!hasItemAbove ? (
                                  <g transform={`translate(${originX}, ${originY - 265})`}>
                                    <rect
                                      x="0"
                                      y="0"
                                      width={Math.max(width, 900)}
                                      height="82"
                                      rx="10"
                                      fill={isHovered ? "#0e7490" : "#0b1220"}
                                    />
                                    <text
                                      x="24"
                                      y="54"
                                      fill="#4ABBC3"
                                      fontSize="42"
                                      fontWeight="900"
                                    >
                                      [ POZ. {item.positionIndex} ]
                                    </text>
                                    <text
                                      x="280"
                                      y="54"
                                      fill="#ffffff"
                                      fontSize="38"
                                      fontWeight="700"
                                    >
                                      {(item.shortName || item.name).slice(0, 32)}
                                    </text>
                                    {isStackedAbove && (
                                      <text
                                        x="650"
                                        y="54"
                                        fill="#34d399"
                                        fontSize="32"
                                        fontWeight="800"
                                      >
                                        ▲ NAD POZ. {stack.stackedItems[itemIdxInStack - 1].positionIndex}
                                      </text>
                                    )}
                                    <text
                                      x={Math.max(width, 900) - 24}
                                      y="54"
                                      fill="#a5f3fc"
                                      fontSize="36"
                                      fontWeight="800"
                                      textAnchor="end"
                                    >
                                      {item.quantity} szt. · {fill} · {color}
                                    </text>
                                  </g>
                                ) : (
                                  <g transform={`translate(${originX + 16}, ${originY + 16})`}>
                                    <rect
                                      x="0"
                                      y="0"
                                      width={Math.min(width - 32, 800)}
                                      height="62"
                                      rx="10"
                                      fill="#0b1220"
                                      fillOpacity="0.88"
                                    />
                                    <text
                                      x="20"
                                      y="42"
                                      fill="#4ABBC3"
                                      fontSize="34"
                                      fontWeight="900"
                                    >
                                      [ POZ. {item.positionIndex} ]
                                    </text>
                                    <text
                                      x="230"
                                      y="42"
                                      fill="#ffffff"
                                      fontSize="30"
                                      fontWeight="700"
                                    >
                                      {(item.shortName || item.name).slice(0, 30)}
                                    </text>
                                  </g>
                                )}

                          {isTriangle ? (
                            <>
                              {/* Cienka czerwona linia obrysu zewnętrznego */}
                              <polygon
                                points={`
                                  ${originX - 2},${yKrokLeftTop - 2}
                                  ${originX + width + 2},${yKrokRightTop - 2}
                                  ${originX + width + 2},${yFloorPos + 2}
                                  ${originX - 2},${yFloorPos + 2}
                                `}
                                fill="none"
                                stroke="#dc2626"
                                strokeWidth="2.5"
                              />

                              {/* Aluminiowy profil dolny poziomy (PROFIL H) */}
                              <rect
                                x={originX}
                                y={yProfTop}
                                width={width}
                                height={tBot}
                                fill="#29323d"
                                stroke="#1e242b"
                                strokeWidth="2"
                              />
                              <text
                                x={originX + width / 2}
                                y={yProfTop + tBot / 2 + 7}
                                fill="#ffffff"
                                fontSize="24"
                                fontWeight="900"
                                textAnchor="middle"
                                letterSpacing="4px"
                              >
                                PROFIL H
                              </text>

                              {/* Lewy pionowy profil przyścienny */}
                              <rect
                                x={originX}
                                y={yKrokLeftBot}
                                width={tLeft}
                                height={yProfTop - yKrokLeftBot}
                                fill="#29323d"
                                stroke="#1e242b"
                                strokeWidth="2"
                              />

                              {/* Górna belka skośna (KROKIEW) */}
                              <polygon
                                points={`
                                  ${originX},${yKrokLeftTop}
                                  ${originX + width},${yKrokRightTop}
                                  ${originX + width},${yKrokRightBot}
                                  ${originX},${yKrokLeftBot}
                                `}
                                fill="#84cc16"
                                stroke="#4d7c0f"
                                strokeWidth="2"
                              />
                              <g
                                transform={`translate(${originX + width * 0.48}, ${(yKrokLeftTop + yKrokRightTop) / 2 + tKrok / 2 + 5}) rotate(${krokiewAngleDeg})`}
                              >
                                <text
                                  x="0"
                                  y="0"
                                  fill="#0b1220"
                                  fontSize="30"
                                  fontWeight="900"
                                  textAnchor="middle"
                                  letterSpacing="4px"
                                >
                                  KROKIEW
                                </text>
                              </g>

                              {/* Podkrokiew / listwa montażowa ramy */}
                              <polygon
                                points={`
                                  ${originX},${yKrokLeftBot}
                                  ${originX + width},${yKrokRightBot}
                                  ${originX + tLeft},${yInnerTop}
                                `}
                                fill="#29323d"
                                stroke="#1e242b"
                                strokeWidth="1.5"
                              />

                              {/* Wypełnienie szklane trójkąta */}
                              <polygon
                                points={`
                                  ${xGlassLeft},${yGlassTop}
                                  ${xGlassRight},${yGlassBot}
                                  ${xGlassLeft},${yGlassBot}
                                `}
                                fill="#ffffff"
                                stroke="#38bdf8"
                                strokeWidth="2"
                              />

                              {/* Odblaski szkła */}
                              <line
                                x1={xGlassLeft + 40}
                                y1={yGlassBot - 30}
                                x2={xGlassLeft + (xGlassRight - xGlassLeft) * 0.35}
                                y2={yGlassTop + (yGlassBot - yGlassTop) * 0.35}
                                stroke="#38bdf8"
                                strokeWidth="2.5"
                                strokeOpacity="0.4"
                              />

                              {/* Parametry wewnątrz trójkąta */}
                              <text
                                x={originX + width * 0.35}
                                y={yGlassBot - 60}
                                fill="#0b1220"
                                fontSize="42"
                                fontWeight="900"
                                textAnchor="middle"
                              >
                                {fill}
                              </text>
                              <text
                                x={originX + width * 0.35}
                                y={yGlassBot - 20}
                                fill="#0e7490"
                                fontSize="28"
                                fontWeight="800"
                                textAnchor="middle"
                              >
                                Spadek dachu: {krokiewAngleDeg}° · Krokiew: {krokiewLenMm} mm
                              </text>
                            </>
                          ) : (
                            <>
                              {/* Cienka czerwona linia obrysu zewnętrznego Prokal */}
                              <rect
                                x={originX - 2}
                                y={originY - 2}
                                width={width + 4}
                                height={height + 4}
                                fill="none"
                                stroke="#dc2626"
                                strokeWidth="2.5"
                              />

                              {/* Aluminiowa ościeżnica / Rama główna */}
                              <rect
                                x={originX}
                                y={originY}
                                width={width}
                                height={height}
                                fill="#29323d"
                                stroke="#1e242b"
                                strokeWidth="2"
                              />

                              {/* Światło konstrukcji */}
                              <rect
                                x={originX + frameThickness}
                                y={originY + frameThickness}
                                width={width - frameThickness * 2}
                                height={height - frameThickness * 2}
                                fill="#ffffff"
                                stroke="#1e242b"
                                strokeWidth="1.5"
                              />

                              {/* Narożne cięcia ukośne (45°) */}
                              <line
                                x1={originX}
                                y1={originY}
                                x2={originX + frameThickness}
                                y2={originY + frameThickness}
                                stroke="#475569"
                                strokeWidth="1.5"
                              />
                              <line
                                x1={originX + width}
                                y1={originY}
                                x2={originX + width - frameThickness}
                                y2={originY + frameThickness}
                                stroke="#475569"
                                strokeWidth="1.5"
                              />
                              <line
                                x1={originX}
                                y1={originY + height}
                                x2={originX + frameThickness}
                                y2={originY + height - frameThickness}
                                stroke="#475569"
                                strokeWidth="1.5"
                              />
                              <line
                                x1={originX + width}
                                y1={originY + height}
                                x2={originX + width - frameThickness}
                                y2={originY + height - frameThickness}
                                stroke="#475569"
                                strokeWidth="1.5"
                              />

                              {/* Kwatery szklane */}
                              {segments.map((seg, idx) => {
                                const openingW = width - frameThickness * 2;
                                const openingH = height - frameThickness * 2;
                                const segW = openingW / panes;
                                const segX = originX + frameThickness + idx * segW;
                                const segY = originY + frameThickness;
                                const centerX = segX + segW / 2;
                                const glassW = Math.round(segW - 10);
                                const glassH = Math.round(openingH - 12);

                                return (
                                  <g key={idx}>
                                    <rect
                                      x={segX + 2}
                                      y={segY + 2}
                                      width={segW - 4}
                                      height={openingH - 4}
                                      fill="#ffffff"
                                      stroke="#e2e8f0"
                                      strokeWidth="1.5"
                                    />
                                    {idx > 0 && (
                                      <line
                                        x1={segX}
                                        y1={segY}
                                        x2={segX}
                                        y2={segY + openingH}
                                        stroke="#dc2626"
                                        strokeWidth="2.5"
                                      />
                                    )}
                                    <line
                                      x1={segX + 24}
                                      y1={segY + openingH - 50}
                                      x2={segX + segW - 24}
                                      y2={segY + 50}
                                      stroke="#38bdf8"
                                      strokeWidth="2"
                                      strokeOpacity="0.25"
                                    />
                                    <text
                                      x={centerX}
                                      y={segY + 72}
                                      fill="#0b1220"
                                      fontSize={Math.min(
                                        44,
                                        Math.max(28, Math.round(segW / 14))
                                      )}
                                      fontWeight="800"
                                      textAnchor="middle"
                                    >
                                      {glassW} × {glassH} mm
                                    </text>
                                  </g>
                                );
                              })}
                            </>
                          )}

                          {/* Linie wymiarowe */}
                          {showDimensions && (
                            <g>
                              {isTriangle ? (
                                <>
                                  {/* DÓŁ: Całkowity wymiar szerokości B */}
                                  <g>
                                    <line
                                      x1={originX}
                                      y1={originY + height + 5}
                                      x2={originX}
                                      y2={originY + height + 75}
                                      stroke="#64748b"
                                      strokeWidth="2"
                                      strokeDasharray="6 6"
                                    />
                                    <line
                                      x1={originX + width}
                                      y1={originY + height + 5}
                                      x2={originX + width}
                                      y2={originY + height + 75}
                                      stroke="#64748b"
                                      strokeWidth="2"
                                      strokeDasharray="6 6"
                                    />
                                    <line
                                      x1={originX}
                                      y1={originY + height + 60}
                                      x2={originX + width}
                                      y2={originY + height + 60}
                                      stroke="#0b1220"
                                      strokeWidth="3.5"
                                      markerStart="url(#multiCadArrowStart)"
                                      markerEnd="url(#multiCadArrowEnd)"
                                    />
                                    <text
                                      x={originX + width / 2}
                                      y={originY + height + 105}
                                      fill="#0b1220"
                                      fontSize="50"
                                      fontWeight="900"
                                      textAnchor="middle"
                                    >
                                      B = {width}
                                    </text>
                                  </g>

                                  {/* LEWO: Całkowity wymiar wysokości H */}
                                  <g>
                                    <line
                                      x1={originX - 5}
                                      y1={originY}
                                      x2={originX - 75}
                                      y2={originY}
                                      stroke="#64748b"
                                      strokeWidth="2"
                                      strokeDasharray="6 6"
                                    />
                                    <line
                                      x1={originX - 5}
                                      y1={originY + height}
                                      x2={originX - 75}
                                      y2={originY + height}
                                      stroke="#64748b"
                                      strokeWidth="2"
                                      strokeDasharray="6 6"
                                    />
                                    <line
                                      x1={originX - 60}
                                      y1={originY}
                                      x2={originX - 60}
                                      y2={originY + height}
                                      stroke="#0b1220"
                                      strokeWidth="3.5"
                                      markerStart="url(#multiCadArrowStart)"
                                      markerEnd="url(#multiCadArrowEnd)"
                                    />
                                    <text
                                      x={originX - 90}
                                      y={originY + height / 2}
                                      fill="#0b1220"
                                      fontSize="50"
                                      fontWeight="900"
                                      textAnchor="middle"
                                      transform={`rotate(-90, ${originX - 90}, ${originY + height / 2})`}
                                    >
                                      H = {height}
                                    </text>
                                  </g>

                                  {/* UKOŚNY WYMIAR KROKWI */}
                                  <g
                                    transform={`translate(${originX + width * 0.52}, ${originY + height * 0.52 - 60}) rotate(${slopeAngleDeg})`}
                                  >
                                    <text
                                      x="0"
                                      y="0"
                                      fill="#15803d"
                                      fontSize="38"
                                      fontWeight="900"
                                      textAnchor="middle"
                                    >
                                      L = {hypotenuseMm} mm (∠ {slopeAngleDeg}°)
                                    </text>
                                  </g>
                                </>
                              ) : (
                                <>
                                  {/* Wymiary poszczególnych kwater */}
                                  {!hasItemAbove &&
                                    segments.map((seg, idx) => {
                                      const segStartX = originX + (idx * width) / panes;
                                      const segEndX =
                                        originX + ((idx + 1) * width) / panes;
                                      const dimY = originY - 60;

                                      return (
                                        <g key={idx}>
                                          <line
                                            x1={segStartX}
                                            y1={originY - 5}
                                            x2={segStartX}
                                            y2={dimY - 14}
                                            stroke="#64748b"
                                            strokeWidth="2"
                                            strokeDasharray="6 6"
                                          />
                                          <line
                                            x1={segEndX}
                                            y1={originY - 5}
                                            x2={segEndX}
                                            y2={dimY - 14}
                                            stroke="#64748b"
                                            strokeWidth="2"
                                            strokeDasharray="6 6"
                                          />
                                          <line
                                            x1={segStartX}
                                            y1={dimY}
                                            x2={segEndX}
                                            y2={dimY}
                                            stroke="#0b1220"
                                            strokeWidth="3"
                                            markerStart="url(#multiCadArrowStart)"
                                            markerEnd="url(#multiCadArrowEnd)"
                                          />
                                          <text
                                            x={(segStartX + segEndX) / 2}
                                            y={dimY - 12}
                                            fill="#0b1220"
                                            fontSize="42"
                                            fontWeight="800"
                                            textAnchor="middle"
                                          >
                                            {seg.widthMm}
                                          </text>
                                        </g>
                                      );
                                    })}

                                  {/* Całkowita szerokość */}
                                  {!hasItemAbove && (
                                    <g>
                                      <line
                                        x1={originX}
                                        y1={originY - 5}
                                        x2={originX}
                                        y2={originY - 155}
                                        stroke="#64748b"
                                        strokeWidth="2.5"
                                        strokeDasharray="6 6"
                                      />
                                      <line
                                        x1={originX + width}
                                        y1={originY - 5}
                                        x2={originX + width}
                                        y2={originY - 155}
                                        stroke="#64748b"
                                        strokeWidth="2.5"
                                        strokeDasharray="6 6"
                                      />
                                      <line
                                        x1={originX}
                                        y1={originY - 140}
                                        x2={originX + width}
                                        y2={originY - 140}
                                        stroke="#0b1220"
                                        strokeWidth="3.5"
                                        markerStart="url(#multiCadArrowStart)"
                                        markerEnd="url(#multiCadArrowEnd)"
                                      />
                                      <text
                                        x={originX + width / 2}
                                        y={originY - 152}
                                        fill="#0b1220"
                                        fontSize="50"
                                        fontWeight="900"
                                        textAnchor="middle"
                                      >
                                        {width}
                                      </text>
                                    </g>
                                  )}

                                  {/* Całkowita wysokość */}
                                  <g>
                                    <line
                                      x1={originX + width + 5}
                                      y1={originY}
                                      x2={originX + width + 105}
                                      y2={originY}
                                      stroke="#64748b"
                                      strokeWidth="2.5"
                                      strokeDasharray="6 6"
                                    />
                                    <line
                                      x1={originX + width + 5}
                                      y1={originY + height}
                                      x2={originX + width + 105}
                                      y2={originY + height}
                                      stroke="#64748b"
                                      strokeWidth="2.5"
                                      strokeDasharray="6 6"
                                    />
                                    <line
                                      x1={originX + width + 90}
                                      y1={originY}
                                      x2={originX + width + 90}
                                      y2={originY + height}
                                      stroke="#0b1220"
                                      strokeWidth="3.5"
                                      markerStart="url(#multiCadArrowStart)"
                                      markerEnd="url(#multiCadArrowEnd)"
                                    />
                                    <text
                                      x={originX + width + 125}
                                      y={originY + height / 2}
                                      fill="#0b1220"
                                      fontSize="50"
                                      fontWeight="900"
                                      textAnchor="middle"
                                      transform={`rotate(90, ${originX + width + 125}, ${originY + height / 2})`}
                                    >
                                      {height}
                                    </text>
                                  </g>
                                </>
                              )}
                            </g>
                          )}
                        </g>
                      );
                    })}

                    {/* Całkowita wysokość stosu (jeśli nałożono konstrukcje na siebie) */}
                    {showDimensions && stack.stackedItems.length > 1 && (
                      <g>
                        <line
                          x1={currentStackX - 120}
                          y1={floorY}
                          x2={currentStackX - 120}
                          y2={floorY - stack.stackHeight}
                          stroke="#0e7490"
                          strokeWidth="3.5"
                          markerStart="url(#multiCadArrowStart)"
                          markerEnd="url(#multiCadArrowEnd)"
                        />
                        <text
                          x={currentStackX - 155}
                          y={floorY - stack.stackHeight / 2}
                          fill="#0e7490"
                          fontSize="46"
                          fontWeight="900"
                          textAnchor="middle"
                          transform={`rotate(-90, ${currentStackX - 155}, ${floorY - stack.stackHeight / 2})`}
                        >
                          H_CAŁK = {stack.stackHeight}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
            </svg>
          </div>
        </div>
      ) : (
        /* ── TRYB 2: SIATKA KART CAD (Każda konstrukcja w czytelnej karcie z rysunkiem CAD) ── */
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-[1600px] mx-auto">
            {items.map((item) => {
              const width = Math.max(item.widthMm || 2880, 400);
              const height = Math.max(item.heightMm || 2300, 400);
              const panes = Math.max(item.panesCount || 3, 1);
              const fill = item.fillType || "HART 10";
              const color = item.color || "RAL 7016MAT";
              const paneWidth = Math.round(width / panes);

              const isTriangle =
                item.name.toLowerCase().includes("trójką") ||
                Boolean(item.shortName && item.shortName.toLowerCase().includes("trójką")) ||
                Boolean(
                  item.systemName &&
                    (item.systemName.toLowerCase().includes("krokiew") ||
                      item.systemName.toLowerCase().includes("profil h"))
                );

              const padLeft = 120;
              const padRight = 180;
              const padTop = 200;
              const padBottom = 60;
              const vbW = width + padLeft + padRight;
              const vbH = height + padTop + padBottom;

              const tBot = 45;
              const tKrok = 50;
              const tLeft = 45;
              const tSub = 30;

              const yFloorPosCard = padTop + height;
              const yProfTopCard = yFloorPosCard - tBot;
              const yKrokLeftTopCard = padTop;
              const yKrokLeftBotCard = padTop + tKrok;
              const yKrokRightBotCard = yProfTopCard;
              const yKrokRightTopCard = Math.max(padTop + 10, yProfTopCard - tKrok);

              const yInnerTopCard = yKrokLeftBotCard + tSub;
              const yInnerBotCard = yProfTopCard;
              const xInnerLeftCard = padLeft + tLeft;
              const xInnerRightCard = padLeft + width;

              const mInnerCard = Math.max(0.001, (yInnerBotCard - yInnerTopCard) / Math.max(1, xInnerRightCard - xInnerLeftCard));
              const krokiewAngleDegCard = Math.round(Math.atan2(yKrokRightTopCard - yKrokLeftTopCard, width) * (180 / Math.PI) * 10) / 10;
              const krokiewLenMmCard = Math.round(Math.sqrt(width * width + (yKrokRightTopCard - yKrokLeftTopCard) * (yKrokRightTopCard - yKrokLeftTopCard)));

              const gMarginCard = 14;
              const xGlassLeftCard = xInnerLeftCard + gMarginCard;
              const yGlassBotCard = yInnerBotCard - gMarginCard;
              const yGlassTopCard = yInnerTopCard + mInnerCard * (xGlassLeftCard - xInnerLeftCard) + gMarginCard;
              const xGlassRightCard = Math.round(
                Math.min(
                  padLeft + width - 40,
                  Math.max(xGlassLeftCard + 50, xInnerLeftCard + (yGlassBotCard - gMarginCard - yInnerTopCard) / mInnerCard)
                )
              );

              const segments: CadSegment[] =
                item.segments && item.segments.length === panes
                  ? item.segments
                  : Array.from({ length: panes }).map((_, i) => ({
                      widthMm:
                        i === panes - 1
                          ? width - paneWidth * (panes - 1)
                          : paneWidth,
                      heightMm: height - 103,
                    }));

              return (
                <div
                  key={item._id}
                  onClick={() => onSelectPosition(item._id)}
                  className="group bg-white rounded-xl border border-[#e2e8f0] hover:border-[#4ABBC3] shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col cursor-pointer"
                >
                  {/* Nagłówek karty pozycji */}
                  <div className="px-4 py-3 border-b border-[#e2e8f0] bg-[#fafbfd] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-[#0b1220] text-[#4ABBC3] shrink-0">
                        Poz. {item.positionIndex}
                      </span>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-[#0b1220] truncate">
                          {item.name}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-[#64748b] font-mono">
                          <span>
                            {width} × {height} mm
                          </span>
                          <span>·</span>
                          <span>{isTriangle ? "Trójkąt dachowy" : `${panes}-torowy`}</span>
                          <span>·</span>
                          <span>{fill}</span>
                          <span>·</span>
                          <span>{color}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-[#334155] font-mono text-[11px] font-bold">
                        {item.quantity} szt.
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDropdown({
                            itemId: item._id,
                            x: e.clientX,
                            y: e.clientY,
                          });
                        }}
                        className="px-2.5 py-1 rounded-md bg-white hover:bg-[#e0f2fe] text-[#0e7490] border border-[#cbd5e1] hover:border-[#38bdf8] text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Zmień położenie tej konstrukcji (umieść nad, pod lub w rzędzie poniżej)"
                      >
                        <MoveVertical size={12} />
                        <span>Położenie</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPosition(item._id);
                        }}
                        className="px-2.5 py-1 rounded-md bg-[#f0fdff] hover:bg-[#4ABBC3] text-[#0e7490] hover:text-white border border-[#a5f3fc] text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Edytuj tę konstrukcję w konfiguratorze CAD"
                      >
                        <Edit3 size={12} />
                        <span>Edytuj CAD</span>
                      </button>
                    </div>
                  </div>

                  {/* Mini-viewport CAD */}
                  <div className="h-[320px] p-3 bg-slate-50/60 flex items-center justify-center">
                    <svg
                      viewBox={`0 0 ${vbW} ${vbH}`}
                      preserveAspectRatio="xMidYMid meet"
                      className="w-full h-full block bg-white rounded border border-[#e2e8f0]"
                      style={{
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      }}
                    >
                      {isTriangle ? (
                        <g>
                          {/* Czerwony obrys */}
                          <polygon
                            points={`
                              ${padLeft - 2},${yKrokLeftTopCard - 2}
                              ${padLeft + width + 2},${yKrokRightTopCard - 2}
                              ${padLeft + width + 2},${yFloorPosCard + 2}
                              ${padLeft - 2},${yFloorPosCard + 2}
                            `}
                            fill="none"
                            stroke="#dc2626"
                            strokeWidth="2"
                          />
                          {/* Dolny profil H */}
                          <rect
                            x={padLeft}
                            y={yProfTopCard}
                            width={width}
                            height={tBot}
                            fill="#29323d"
                            stroke="#1e242b"
                            strokeWidth="1.5"
                          />
                          <text
                            x={padLeft + width / 2}
                            y={yProfTopCard + tBot / 2 + 7}
                            fill="#ffffff"
                            fontSize="22"
                            fontWeight="900"
                            textAnchor="middle"
                            letterSpacing="4px"
                          >
                            PROFIL H
                          </text>
                          {/* Lewy pionowy słupek */}
                          <rect
                            x={padLeft}
                            y={yKrokLeftBotCard}
                            width={tLeft}
                            height={yProfTopCard - yKrokLeftBotCard}
                            fill="#29323d"
                            stroke="#1e242b"
                            strokeWidth="1.5"
                          />
                          {/* Belka skośna (KROKIEW) */}
                          <polygon
                            points={`
                              ${padLeft},${yKrokLeftTopCard}
                              ${padLeft + width},${yKrokRightTopCard}
                              ${padLeft + width},${yKrokRightBotCard}
                              ${padLeft},${yKrokLeftBotCard}
                            `}
                            fill="#84cc16"
                            stroke="#4d7c0f"
                            strokeWidth="2"
                          />
                          <g
                            transform={`translate(${padLeft + width * 0.48}, ${(yKrokLeftTopCard + yKrokRightTopCard) / 2 + tKrok / 2 + 5}) rotate(${krokiewAngleDegCard})`}
                          >
                            <text
                              x="0"
                              y="0"
                              fill="#0b1220"
                              fontSize="30"
                              fontWeight="900"
                              textAnchor="middle"
                              letterSpacing="4px"
                            >
                              KROKIEW
                            </text>
                          </g>
                          {/* Podkrokiew / listwa montażowa ramy */}
                          <polygon
                            points={`
                              ${padLeft},${yKrokLeftBotCard}
                              ${padLeft + width},${yKrokRightBotCard}
                              ${padLeft + tLeft},${yInnerTopCard}
                            `}
                            fill="#29323d"
                            stroke="#1e242b"
                            strokeWidth="1.5"
                          />
                          {/* Szkło */}
                          <polygon
                            points={`
                              ${xGlassLeftCard},${yGlassTopCard}
                              ${xGlassRightCard},${yGlassBotCard}
                              ${xGlassLeftCard},${yGlassBotCard}
                            `}
                            fill="#ffffff"
                            stroke="#38bdf8"
                            strokeWidth="2"
                          />
                          <line
                            x1={xGlassLeftCard + 40}
                            y1={yGlassBotCard - 30}
                            x2={xGlassLeftCard + (xGlassRightCard - xGlassLeftCard) * 0.35}
                            y2={yGlassTopCard + (yGlassBotCard - yGlassTopCard) * 0.35}
                            stroke="#38bdf8"
                            strokeWidth="2.5"
                            strokeOpacity="0.4"
                          />
                          <text
                            x={padLeft + width * 0.35}
                            y={yGlassBotCard - 60}
                            fill="#0b1220"
                            fontSize="42"
                            fontWeight="900"
                            textAnchor="middle"
                          >
                            {fill}
                          </text>
                          <text
                            x={padLeft + width * 0.35}
                            y={yGlassBotCard - 20}
                            fill="#0e7490"
                            fontSize="26"
                            fontWeight="800"
                            textAnchor="middle"
                          >
                            Spadek: {krokiewAngleDegCard}° · Krokiew: {krokiewLenMmCard} mm
                          </text>

                          {showDimensions && (
                            <g>
                              <line
                                x1={padLeft}
                                y1={padTop - 130}
                                x2={padLeft + width}
                                y2={padTop - 130}
                                stroke="#0b1220"
                                strokeWidth="3.5"
                              />
                              <text
                                x={padLeft + width / 2}
                                y={padTop - 142}
                                fill="#0b1220"
                                fontSize="50"
                                fontWeight="900"
                                textAnchor="middle"
                              >
                                {width}
                              </text>
                              <line
                                x1={padLeft + width + 80}
                                y1={padTop}
                                x2={padLeft + width + 80}
                                y2={padTop + height}
                                stroke="#0b1220"
                                strokeWidth="3.5"
                              />
                              <text
                                x={padLeft + width + 115}
                                y={padTop + height / 2}
                                fill="#0b1220"
                                fontSize="50"
                                fontWeight="900"
                                textAnchor="middle"
                                transform={`rotate(90, ${padLeft + width + 115}, ${padTop + height / 2})`}
                              >
                                {height}
                              </text>
                            </g>
                          )}
                        </g>
                      ) : (
                        <g>
                          <rect
                            x={padLeft - 2}
                            y={padTop - 2}
                            width={width + 4}
                            height={height + 4}
                            fill="none"
                            stroke="#dc2626"
                            strokeWidth="2"
                          />
                          <rect
                            x={padLeft}
                            y={padTop}
                            width={width}
                            height={height}
                            fill="#29323d"
                            stroke="#1e242b"
                            strokeWidth="1.5"
                          />
                          <rect
                            x={padLeft + frameThickness}
                            y={padTop + frameThickness}
                            width={width - frameThickness * 2}
                            height={height - frameThickness * 2}
                            fill="#ffffff"
                            stroke="#1e242b"
                            strokeWidth="1.5"
                          />

                          {segments.map((seg, idx) => {
                            const openingW = width - frameThickness * 2;
                            const openingH = height - frameThickness * 2;
                            const segW = openingW / panes;
                            const segX = padLeft + frameThickness + idx * segW;
                            const segY = padTop + frameThickness;
                            const centerX = segX + segW / 2;
                            const glassW = Math.round(segW - 10);
                            const glassH = Math.round(openingH - 12);

                            return (
                              <g key={idx}>
                                <rect
                                  x={segX + 2}
                                  y={segY + 2}
                                  width={segW - 4}
                                  height={openingH - 4}
                                  fill="#ffffff"
                                  stroke="#e2e8f0"
                                  strokeWidth="1.5"
                                />
                                {idx > 0 && (
                                  <line
                                    x1={segX}
                                    y1={segY}
                                    x2={segX}
                                    y2={segY + openingH}
                                    stroke="#dc2626"
                                    strokeWidth="2"
                                  />
                                )}
                                <line
                                  x1={segX + 24}
                                  y1={segY + openingH - 50}
                                  x2={segX + segW - 24}
                                  y2={segY + 50}
                                  stroke="#38bdf8"
                                  strokeWidth="1.5"
                                  strokeOpacity="0.25"
                                />
                                <text
                                  x={centerX}
                                  y={segY + 64}
                                  fill="#0b1220"
                                  fontSize={Math.min(
                                    44,
                                    Math.max(28, Math.round(segW / 14))
                                  )}
                                  fontWeight="800"
                                  textAnchor="middle"
                                >
                                  {glassW} × {glassH} mm
                                </text>
                              </g>
                            );
                          })}

                          {showDimensions && (
                            <g>
                              {segments.map((seg, idx) => {
                                const segStartX = padLeft + (idx * width) / panes;
                                const segEndX =
                                  padLeft + ((idx + 1) * width) / panes;
                                const dimY = padTop - 55;
                                return (
                                  <g key={idx}>
                                    <line
                                      x1={segStartX}
                                      y1={dimY}
                                      x2={segEndX}
                                      y2={dimY}
                                      stroke="#0b1220"
                                      strokeWidth="3"
                                    />
                                    <text
                                      x={(segStartX + segEndX) / 2}
                                      y={dimY - 12}
                                      fill="#0b1220"
                                      fontSize="42"
                                      fontWeight="800"
                                      textAnchor="middle"
                                    >
                                      {seg.widthMm}
                                    </text>
                                  </g>
                                );
                              })}
                              <line
                                x1={padLeft}
                                y1={padTop - 130}
                                x2={padLeft + width}
                                y2={padTop - 130}
                                stroke="#0b1220"
                                strokeWidth="3.5"
                              />
                              <text
                                x={padLeft + width / 2}
                                y={padTop - 142}
                                fill="#0b1220"
                                fontSize="50"
                                fontWeight="900"
                                textAnchor="middle"
                              >
                                {width}
                              </text>
                              <line
                                x1={padLeft + width + 80}
                                y1={padTop}
                                x2={padLeft + width + 80}
                                y2={padTop + height}
                                stroke="#0b1220"
                                strokeWidth="3.5"
                              />
                              <text
                                x={padLeft + width + 115}
                                y={padTop + height / 2}
                                fill="#0b1220"
                                fontSize="50"
                                fontWeight="900"
                                textAnchor="middle"
                                transform={`rotate(90, ${padLeft + width + 115}, ${padTop + height / 2})`}
                              >
                                {height}
                              </text>
                            </g>
                          )}
                        </g>
                      )}
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Menu rozwijane położenia konstrukcji (LPM na konstrukcję) ── */}
      {activeDropdown && (() => {
        const activeItem = items.find((it) => it._id === activeDropdown.itemId);
        if (!activeItem) return null;

        const effectiveTarget = {
          ...activeItem,
          ...(localPlacements[activeItem._id] || {}),
        };

        const popoverX =
          typeof window !== "undefined"
            ? Math.min(window.innerWidth - 365, Math.max(16, activeDropdown.x - 20))
            : 200;
        const popoverY =
          typeof window !== "undefined"
            ? Math.min(window.innerHeight - 520, Math.max(16, activeDropdown.y - 20))
            : 200;

        // Inne pozycje w ofercie
        const otherItems = items.filter((it) => it._id !== activeItem._id);

        // Wyznaczenie dostępnych rzędów
        const maxRowIndex = Math.max(
          0,
          ...items.map(
            (it) => localPlacements[it._id]?.rowIndex ?? it.rowIndex ?? 0
          )
        );
        const availableRows = Array.from(
          { length: maxRowIndex + 1 },
          (_, i) => i
        );

        // Element bazowy pod tą konstrukcją
        const placedAboveTarget = otherItems.find(
          (it) => it._id === effectiveTarget.placedAboveItemId
        );

        return (
          <div
            className="fixed inset-0 z-50 bg-[#0b1220]/30 backdrop-blur-[1px] flex"
            onClick={() => setActiveDropdown(null)}
          >
            <div
              style={{
                position: "fixed",
                left: `${popoverX}px`,
                top: `${popoverY}px`,
                maxHeight: "calc(100vh - 40px)",
              }}
              className="bg-white rounded-xl shadow-2xl border border-[#cbd5e1] w-[350px] p-4 z-50 text-[#0b1220] overflow-y-auto animate-in fade-in zoom-in-95 duration-100 space-y-3.5"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Nagłówek popovera */}
              <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-[#f1f5f9]">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#0b1220] text-[#4ABBC3]">
                      POZ. {activeItem.positionIndex}
                    </span>
                    <span className="text-[11px] font-mono text-[#64748b]">
                      {activeItem.widthMm} × {activeItem.heightMm} mm
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-[#0b1220] truncate">
                    {activeItem.shortName || activeItem.name}
                  </h4>
                  <div className="text-[11px] font-medium text-[#0e7490]">
                    {placedAboveTarget ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <ArrowUp size={11} />
                        <span className="truncate">
                          Nad: Poz. {placedAboveTarget.positionIndex} (
                          {placedAboveTarget.shortName || placedAboveTarget.name}
                          )
                        </span>
                      </span>
                    ) : (effectiveTarget.rowIndex ?? 0) > 0 ? (
                      <span className="inline-flex items-center gap-1 text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        <Rows size={11} />
                        <span>Rząd {(effectiveTarget.rowIndex ?? 0) + 1} (poniżej)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        Poziom posadzki ±0.00
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveDropdown(null)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Zamknij"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Opcja 1: Umieść NAD inną konstrukcją */}
              {otherItems.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                    <ArrowUp size={12} className="text-emerald-600" />
                    <span>Umieść NAD inną konstrukcją</span>
                  </label>
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                    {otherItems.map((other) => {
                      const isCurrentAbove =
                        effectiveTarget.placedAboveItemId === other._id;
                      return (
                        <button
                          key={`above-${other._id}`}
                          type="button"
                          onClick={() =>
                            handleSetPlacement(activeItem._id, {
                              placedAboveItemId: other._id,
                              placedBelowItemId: null,
                              rowIndex: other.rowIndex ?? 0,
                            })
                          }
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center justify-between transition-colors cursor-pointer ${
                            isCurrentAbove
                              ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-bold"
                              : "bg-slate-50/70 hover:bg-[#f0fdff] border-slate-200 hover:border-[#4ABBC3] text-slate-800"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <ArrowUp
                              size={12}
                              className={
                                isCurrentAbove
                                  ? "text-emerald-600"
                                  : "text-slate-400"
                              }
                            />
                            <span className="truncate">
                              <strong>Poz. {other.positionIndex}</strong>:{" "}
                              {other.shortName || other.name}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500 shrink-0 ml-2">
                            {other.widthMm}×{other.heightMm}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Opcja 2: Umieść POD inną konstrukcją */}
              {otherItems.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                    <ArrowDown size={12} className="text-indigo-600" />
                    <span>Umieść POD inną konstrukcją</span>
                  </label>
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                    {otherItems.map((other) => (
                      <button
                        key={`below-${other._id}`}
                        type="button"
                        onClick={() => {
                          handleSetPlacement(other._id, {
                            placedAboveItemId: activeItem._id,
                            placedBelowItemId: null,
                            rowIndex: activeItem.rowIndex ?? 0,
                          });
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-50/70 hover:bg-[#f0fdff] border border-slate-200 hover:border-[#4ABBC3] text-slate-800 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <ArrowDown size={12} className="text-indigo-500" />
                          <span className="truncate">
                            Pod: <strong>Poz. {other.positionIndex}</strong> (
                            {other.shortName || other.name})
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 shrink-0 ml-2">
                          {other.widthMm}×{other.heightMm}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Opcja 3: Rzędy konstrukcji (jedna niżej pod inną) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                  <Rows size={12} className="text-[#0e7490]" />
                  <span>Rząd na rysunku CAD (jedna pod drugą)</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {availableRows.map((rIdx) => {
                    const isCurrentRow =
                      !effectiveTarget.placedAboveItemId &&
                      (effectiveTarget.rowIndex ?? 0) === rIdx;
                    return (
                      <button
                        key={`row-${rIdx}`}
                        type="button"
                        onClick={() =>
                          handleSetPlacement(activeItem._id, {
                            placedAboveItemId: null,
                            placedBelowItemId: null,
                            rowIndex: rIdx,
                          })
                        }
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border text-center transition-colors cursor-pointer ${
                          isCurrentRow
                            ? "bg-[#0b1220] text-white border-[#0b1220] font-bold"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {rIdx === 0
                          ? "Rząd 1 (Główny)"
                          : `Rząd ${rIdx + 1} (Poniżej)`}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() =>
                      handleSetPlacement(activeItem._id, {
                        placedAboveItemId: null,
                        placedBelowItemId: null,
                        rowIndex: maxRowIndex + 1,
                      })
                    }
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#f0fdff] hover:bg-[#e0f2fe] text-[#0e7490] border border-[#a5f3fc] text-center transition-colors cursor-pointer col-span-2 flex items-center justify-center gap-1"
                  >
                    <Plus size={12} />
                    <span>Nowy rząd poniżej (Rząd {maxRowIndex + 2})</span>
                  </button>
                </div>
              </div>

              {/* Opcja 4: Reset do poziomu posadzki */}
              {(effectiveTarget.placedAboveItemId ||
                (effectiveTarget.rowIndex ?? 0) > 0) && (
                <button
                  type="button"
                  onClick={() =>
                    handleSetPlacement(activeItem._id, {
                      placedAboveItemId: null,
                      placedBelowItemId: null,
                      rowIndex: 0,
                    })
                  }
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <RotateCcw size={12} className="text-slate-500" />
                  <span>Przywróć na poziom posadzki (obok innych)</span>
                </button>
              )}

              {/* Opcja 5: Przejdź do edycji w CAD */}
              <div className="pt-2 border-t border-[#f1f5f9]">
                <button
                  type="button"
                  onClick={() => {
                    setActiveDropdown(null);
                    onSelectPosition(activeItem._id);
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-[#0b1220] hover:bg-[#1e293b] text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Edit3 size={13} className="text-[#4ABBC3]" />
                  <span>Edytuj tę konstrukcję w CAD</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
