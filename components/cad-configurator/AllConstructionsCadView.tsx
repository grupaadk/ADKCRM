"use client";

import React, { useState, useRef, useEffect } from "react";
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
} from "lucide-react";

interface AllConstructionsCadViewProps {
  offer?: OfferData;
  items: CadConstructionItem[];
  opportunity?: OpportunityData | null;
  onSelectPosition: (itemId: string) => void;
  onBackToOffer: () => void;
  onAddNewPosition: () => void;
}

export function AllConstructionsCadView({
  items,
  onSelectPosition,
  onBackToOffer,
  onAddNewPosition,
}: AllConstructionsCadViewProps) {
  const [zoom, setZoom] = useState(1);
  const [showDimensions, setShowDimensions] = useState(true);
  const [displayMode, setDisplayMode] = useState<"sheet" | "grid">("sheet");
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

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

  // ── Obliczenia układu dla Wspólnego Arkusza CAD ("sheet") ──
  // Wszystkie konstrukcje zestawione obok siebie w jednej linii na wspólnym poziomie posadzki
  const rows: CadConstructionItem[][] = [items];

  const gapX = 520; // odstęp poziomy między konstrukcjami na arkuszu (w mm skali rysunku)
  const gapY = 580; // odstęp pionowy między rzędami konstrukcji
  const sheetPadX = 240;
  const sheetPadTop = 380;
  const sheetPadBottom = 140;

  // Wyznaczamy wymiary każdego wiersza, aby wyrównać konstrukcje do wspólnego poziomu posadzki ±0.00
  const rowMetrics = rows.map((rowItems) => {
    const rowWidth =
      rowItems.reduce((acc, it) => acc + Math.max(it.widthMm || 2880, 400), 0) +
      Math.max(0, rowItems.length - 1) * gapX;
    const maxHeight = Math.max(
      ...rowItems.map((it) => Math.max(it.heightMm || 2300, 400))
    );
    return { rowWidth, maxHeight };
  });

  const maxRowWidth = Math.max(...rowMetrics.map((m) => m.rowWidth), 2400);
  const totalRowsHeight =
    rowMetrics.reduce((acc, m) => acc + m.maxHeight, 0) +
    Math.max(0, rowMetrics.length - 1) * gapY;

  const sheetWidth = maxRowWidth + sheetPadX * 2;
  const sheetHeight = totalRowsHeight + sheetPadTop + sheetPadBottom;
  const frameThickness = 50;

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
              {rows.map((rowItems, rowIndex) => {
                const previousRowsHeight = rowMetrics
                  .slice(0, rowIndex)
                  .reduce((acc, m) => acc + m.maxHeight + gapY, 0);
                const currentRowMaxHeight = rowMetrics[rowIndex].maxHeight;
                const floorY =
                  sheetPadTop + previousRowsHeight + currentRowMaxHeight;

                // Wyśrodkowanie rzędu w poziomie na arkuszu
                const currentRowWidth = rowMetrics[rowIndex].rowWidth;
                let cursorX = (sheetWidth - currentRowWidth) / 2;

                return (
                  <g key={`row-${rowIndex}`}>
                    {/* Ciągła linia poziomu posadzki ±0.00 dla rzędu */}
                    <line
                      x1={Math.max(80, cursorX - 160)}
                      y1={floorY + 4}
                      x2={Math.min(
                        sheetWidth - 80,
                        cursorX + currentRowWidth + 160
                      )}
                      y2={floorY + 4}
                      stroke="#0e7490"
                      strokeWidth="3"
                      strokeDasharray="18 10"
                      strokeOpacity="0.55"
                    />
                    <text
                      x={Math.max(90, cursorX - 150)}
                      y={floorY + 48}
                      fill="#0e7490"
                      fontSize="36"
                      fontWeight="700"
                    >
                      ±0.00 POZIOM POSADZKI
                    </text>

                    {rowItems.map((item) => {
                      const width = Math.max(item.widthMm || 2880, 400);
                      const height = Math.max(item.heightMm || 2300, 400);
                      const panes = Math.max(item.panesCount || 3, 1);
                      const fill = item.fillType || "HART 10";
                      const color = item.color || "RAL 7016MAT";
                      const isHovered = hoveredItemId === item._id;

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

                      // Wyrównanie dolnej krawędzi konstrukcji do wspólnej posadzki (floorY)
                      const originX = cursorX;
                      const originY = floorY - height;
                      cursorX += width + gapX;

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
                          onClick={() => onSelectPosition(item._id)}
                        >
                          {/* Podświetlenie interaktywne po najechaniu */}
                          {isHovered && (
                            <rect
                              x={originX - 70}
                              y={originY - 300}
                              width={width + 240}
                              height={height + 360}
                              rx="20"
                              fill="#0e7490"
                              fillOpacity="0.04"
                              stroke="#0e7490"
                              strokeWidth="4"
                              strokeDasharray="12 8"
                            />
                          )}

                          {/* Etykieta nagłówkowa pozycji nad wymiarami */}
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
                              {(item.shortName || item.name).slice(0, 38)}
                            </text>
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

                          {isTriangle ? (
                            <>
                              {/* Cienka czerwona linia obrysu zewnętrznego */}
                              <polygon
                                points={`${originX - 2},${originY - 2} ${originX + width + 2},${originY + height + 2} ${originX - 2},${originY + height + 2}`}
                                fill="none"
                                stroke="#dc2626"
                                strokeWidth="2.5"
                              />

                              {/* Aluminiowy profil dolny poziomy (PROFIL H) */}
                              <rect
                                x={originX}
                                y={originY + height - frameThickness}
                                width={width}
                                height={frameThickness}
                                fill="#29323d"
                                stroke="#1e242b"
                                strokeWidth="2"
                              />
                              <text
                                x={originX + width / 2}
                                y={originY + height - 17}
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
                                y={originY}
                                width={frameThickness}
                                height={height - frameThickness}
                                fill="#29323d"
                                stroke="#1e242b"
                                strokeWidth="2"
                              />

                              {/* Górna belka skośna (KROKIEW) */}
                              <polygon
                                points={`
                                  ${originX},${originY}
                                  ${originX + width},${originY + height}
                                  ${originX + width},${originY + height - 40}
                                  ${originX},${originY - 50}
                                `}
                                fill="#84cc16"
                                stroke="#4d7c0f"
                                strokeWidth="2"
                              />
                              <polygon
                                points={`
                                  ${originX + 15},${originY + 12}
                                  ${originX + width - 10},${originY + height}
                                  ${originX + width - 30},${originY + height}
                                  ${originX + frameThickness},${originY + frameThickness + 10}
                                `}
                                fill="#29323d"
                                stroke="#1e242b"
                                strokeWidth="1.5"
                              />
                              <g
                                transform={`translate(${originX + width * 0.46}, ${originY + height * 0.46 - 22}) rotate(${slopeAngleDeg})`}
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

                              {/* Wypełnienie szklane trójkąta */}
                              <polygon
                                points={`
                                  ${originX + frameThickness + 8},${originY + frameThickness + 30}
                                  ${originX + width - 45},${originY + height - frameThickness - 8}
                                  ${originX + frameThickness + 8},${originY + height - frameThickness - 8}
                                `}
                                fill="#ffffff"
                                stroke="#38bdf8"
                                strokeWidth="2"
                              />

                              {/* Odblaski szkła */}
                              <line
                                x1={originX + frameThickness + 40}
                                y1={originY + height * 0.65}
                                x2={originX + width * 0.45}
                                y2={originY + height * 0.45}
                                stroke="#38bdf8"
                                strokeWidth="2.5"
                                strokeOpacity="0.4"
                              />

                              {/* Parametry wewnątrz trójkąta */}
                              <text
                                x={originX + width * 0.35}
                                y={originY + height * 0.72}
                                fill="#0b1220"
                                fontSize="42"
                                fontWeight="900"
                                textAnchor="middle"
                              >
                                {fill}
                              </text>
                              <text
                                x={originX + width * 0.35}
                                y={originY + height * 0.72 + 45}
                                fill="#0e7490"
                                fontSize="28"
                                fontWeight="800"
                                textAnchor="middle"
                              >
                                Spadek dachu: {slopeAngleDeg}° · Krokiew: {hypotenuseMm} mm
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
                                  {segments.map((seg, idx) => {
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
              const slopeAngleDeg = Math.round(Math.atan2(height, width) * (180 / Math.PI) * 10) / 10;
              const hypotenuseMm = Math.round(Math.sqrt(width * width + height * height));

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

              const padLeft = 120;
              const padRight = 180;
              const padTop = 200;
              const padBottom = 60;
              const vbW = width + padLeft + padRight;
              const vbH = height + padTop + padBottom;

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

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-[#334155] font-mono text-[11px] font-bold">
                        {item.quantity} szt.
                      </span>
                      <span className="px-2.5 py-1 rounded-md bg-[#f0fdff] group-hover:bg-[#4ABBC3] text-[#0e7490] group-hover:text-white border border-[#a5f3fc] text-[11px] font-semibold flex items-center gap-1 transition-colors">
                        <Edit3 size={12} />
                        <span>Edytuj CAD</span>
                      </span>
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
                            points={`${padLeft - 2},${padTop - 2} ${padLeft + width + 2},${padTop + height + 2} ${padLeft - 2},${padTop + height + 2}`}
                            fill="none"
                            stroke="#dc2626"
                            strokeWidth="2"
                          />
                          {/* Dolny profil H */}
                          <rect
                            x={padLeft}
                            y={padTop + height - frameThickness}
                            width={width}
                            height={frameThickness}
                            fill="#29323d"
                            stroke="#1e242b"
                            strokeWidth="1.5"
                          />
                          <text
                            x={padLeft + width / 2}
                            y={padTop + height - 17}
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
                            y={padTop}
                            width={frameThickness}
                            height={height - frameThickness}
                            fill="#29323d"
                            stroke="#1e242b"
                            strokeWidth="1.5"
                          />
                          {/* Belka skośna (KROKIEW) */}
                          <polygon
                            points={`
                              ${padLeft},${padTop}
                              ${padLeft + width},${padTop + height}
                              ${padLeft + width},${padTop + height - 40}
                              ${padLeft},${padTop - 50}
                            `}
                            fill="#84cc16"
                            stroke="#4d7c0f"
                            strokeWidth="2"
                          />
                          <polygon
                            points={`
                              ${padLeft + 15},${padTop + 12}
                              ${padLeft + width - 10},${padTop + height}
                              ${padLeft + width - 30},${padTop + height}
                              ${padLeft + frameThickness},${padTop + frameThickness + 10}
                            `}
                            fill="#29323d"
                            stroke="#1e242b"
                            strokeWidth="1.5"
                          />
                          <g
                            transform={`translate(${padLeft + width * 0.46}, ${padTop + height * 0.46 - 22}) rotate(${slopeAngleDeg})`}
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
                          {/* Szkło */}
                          <polygon
                            points={`
                              ${padLeft + frameThickness + 8},${padTop + frameThickness + 30}
                              ${padLeft + width - 45},${padTop + height - frameThickness - 8}
                              ${padLeft + frameThickness + 8},${padTop + height - frameThickness - 8}
                            `}
                            fill="#ffffff"
                            stroke="#38bdf8"
                            strokeWidth="2"
                          />
                          <line
                            x1={padLeft + frameThickness + 40}
                            y1={padTop + height * 0.65}
                            x2={padLeft + width * 0.45}
                            y2={padTop + height * 0.45}
                            stroke="#38bdf8"
                            strokeWidth="2.5"
                            strokeOpacity="0.4"
                          />
                          <text
                            x={padLeft + width * 0.35}
                            y={padTop + height * 0.72}
                            fill="#0b1220"
                            fontSize="42"
                            fontWeight="900"
                            textAnchor="middle"
                          >
                            {fill}
                          </text>
                          <text
                            x={padLeft + width * 0.35}
                            y={padTop + height * 0.72 + 45}
                            fill="#0e7490"
                            fontSize="26"
                            fontWeight="800"
                            textAnchor="middle"
                          >
                            Spadek: {slopeAngleDeg}° · Krokiew: {hypotenuseMm} mm
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
    </div>
  );
}
