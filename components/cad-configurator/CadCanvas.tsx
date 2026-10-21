"use client";

import React, { useState, useRef, useEffect } from "react";
import { ZoomIn, ZoomOut, Maximize2, Ruler, Layers } from "lucide-react";

export interface CadSegment {
  widthMm: number;
  heightMm: number;
  fill?: string;
  weightKg?: number;
  profileTop?: string;
  profileBottom?: string;
  profileLeft?: string;
  profileRight?: string;
}

export interface CadConstructionItem {
  _id: string;
  positionIndex: number;
  name: string;
  shortName?: string;
  description?: string;
  notes?: string;
  warning?: string;
  color?: string;
  systemName?: string;
  quantity: number;
  widthMm: number;
  heightMm: number;
  panesCount: number;
  fillType?: string;
  priceNet?: number;
  costNet?: number;
  segments?: CadSegment[];
  placedAboveItemId?: string;
  placedBelowItemId?: string;
  rowIndex?: number;
}

interface CadCanvasProps {
  item: CadConstructionItem;
  readOnly?: boolean;
  initialZoom?: number;
}

export function CadCanvas({ item, initialZoom = 1 }: CadCanvasProps) {
  const [zoom, setZoom] = useState(initialZoom);
  const [showDimensions, setShowDimensions] = useState(true);
  const viewportRef = useRef<HTMLDivElement | null>(null);

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
  }, []);

  const width = Math.max(item.widthMm || 2880, 400);
  const height = Math.max(item.heightMm || 2300, 400);
  const panes = Math.max(item.panesCount || 3, 1);
  const fill = item.fillType || "HART 10";
  const color = item.color || "RAL 7016MAT";

  const isTriangle =
    item.name.toLowerCase().includes("trójką") ||
    Boolean(item.shortName && item.shortName.toLowerCase().includes("trójką")) ||
    Boolean(
      item.systemName &&
        (item.systemName.toLowerCase().includes("krokiew") ||
          item.systemName.toLowerCase().includes("profil h"))
    );

  // Obliczenia wymiarów kwater
  const paneWidth = Math.round(width / panes);
  const segments: CadSegment[] =
    item.segments && item.segments.length === panes
      ? item.segments
      : Array.from({ length: panes }).map((_, i) => ({
          widthMm:
            i === panes - 1 ? width - paneWidth * (panes - 1) : paneWidth,
          heightMm: height - 103,
          fill,
          weightKg:
            Math.round((width / panes) * height * 0.000001 * 25 * 10) / 10,
          profileTop: `5448 ${color}`,
          profileBottom: `5450 ${color}`,
          profileLeft: `5450 ${color}`,
          profileRight: `5450 ${color}`,
        }));

  // Precyzyjne, przestronne marginesy dla czytelnego wymiarowania architektonicznego
  const padLeft = 140;
  const padRight = 200;
  const padTop = 220;
  const padBottom = 60;

  const originX = padLeft;
  const originY = padTop;

  const viewBoxWidth = width + padLeft + padRight;
  const viewBoxHeight = height + padTop + padBottom;

  // Profil ramy w mm
  const frameThickness = 50;

  // Precyzyjne obliczenia geometrii trójkąta (do zabudowy tarasu pod krokwie)
  const tBot = 45; // wysokość dolnego PROFIL H
  const tKrok = 50; // grubość belki krokwi dachowej
  const tLeft = 45; // grubość pionowego słupka przyściennego
  const tSub = 30; // grubość listwy montażowej podkrokwiowej

  const yFloor = originY + height;
  const yProfTop = yFloor - tBot;
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

  return (
    <div className="relative flex-1 flex flex-col h-full min-w-0 min-h-0 bg-[#f1f5f9] select-none overflow-hidden">
      {/* Top CAD Controls Bar - Czysty pasek z kontrolkami widoku */}
      <div className="h-10 bg-white border-b border-[#e3e7ee] px-4 flex items-center justify-between z-10 shadow-2xs shrink-0">
        <div className="flex items-center gap-2 text-xs font-bold text-[#0b1220]">
          <Layers size={15} className="text-[#4ABBC3]" />
          <span>Rysunek CAD</span>
          <span className="text-[#7c8597] font-normal hidden sm:inline">
            · {width} × {height} mm ({panes} {panes === 1 ? "kwatera" : panes < 5 ? "kwatery" : "kwater"})
          </span>
        </div>

        {/* CAD Viewport Controls */}
        <div className="flex items-center gap-1.5">

          <button
            type="button"
            onClick={() => setShowDimensions((v) => !v)}
            title="Włącz / Wyłącz linie wymiarowe"
            className={`p-1.5 rounded text-xs flex items-center gap-1 border transition-colors ${
              showDimensions
                ? "bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd]"
                : "bg-white text-[#7c8597] border-[#d4dae3]"
            }`}
          >
            <Ruler size={13} />
            <span className="hidden sm:inline">Wymiary</span>
          </button>

          <div className="h-4 w-px bg-[#e3e7ee] mx-1" />

          <span
            className="hidden xl:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono text-[#64748b] bg-slate-100 border border-[#e2e8f0]"
            title="Przytrzymaj klawisz Ctrl i kręć kółkiem myszy, aby przybliżać lub oddalać widok CAD"
          >
            Ctrl + Scroll
          </span>

          <button
            type="button"
            onClick={() =>
              setZoom((z) => Math.max(0.4, Math.round((z - 0.1) * 100) / 100))
            }
            title="Oddal (Zoom out / Ctrl + Scroll w dół)"
            className="p-1.5 rounded bg-white text-[#4b5563] hover:text-[#0b1220] border border-[#d4dae3]"
          >
            <ZoomOut size={13} />
          </button>
          <span className="text-[11px] font-mono text-[#0b1220] min-w-[42px] text-center font-bold">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() =>
              setZoom((z) => Math.min(4, Math.round((z + 0.1) * 100) / 100))
            }
            title="Przybliż (Zoom in / Ctrl + Scroll w górę)"
            className="p-1.5 rounded bg-white text-[#4b5563] hover:text-[#0b1220] border border-[#d4dae3]"
          >
            <ZoomIn size={13} />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            title="Dopasuj do ekranu (100%)"
            className="p-1.5 rounded bg-white text-[#4b5563] hover:text-[#0b1220] border border-[#d4dae3]"
          >
            <Maximize2 size={13} />
          </button>
        </div>
      </div>

      {/* Main CAD Viewport Area - Automatyczne pełne dopasowanie do kontenera + obsługa scrollowania i Ctrl+Scroll */}
      <div
        ref={viewportRef}
        className="relative flex-1 min-h-0 min-w-0 overflow-auto p-2 sm:p-4 bg-slate-100/60"
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
            viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
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
              {/* Sharp, bold engineering dimension arrows in pure dark charcoal #0b1220 */}
              <marker
                id="cadArrowStart"
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
                id="cadArrowEnd"
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

            {/* Solid White Sheet Background */}
            <rect
              x="0"
              y="0"
              width={viewBoxWidth}
              height={viewBoxHeight}
              fill="#ffffff"
            />
            <rect
              x="0"
              y="0"
              width={viewBoxWidth}
              height={viewBoxHeight}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="2"
            />

            {/* ─── CONSTRUCTION DRAWING ─── */}
            <g id="construction">
              {isTriangle ? (
                <>
                  {/* Cienka czerwona linia obrysu zewnętrznego */}
                  <polygon
                    points={`
                      ${originX - 2},${yKrokLeftTop - 2}
                      ${originX + width + 2},${yKrokRightTop - 2}
                      ${originX + width + 2},${yFloor + 2}
                      ${originX - 2},${yFloor + 2}
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
                    fontSize="22"
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
                  {/* Etykieta KROKIEW wzdłuż belki */}
                  <g
                    transform={`translate(${originX + width * 0.48}, ${(yKrokLeftTop + yKrokRightTop) / 2 + tKrok / 2 + 5}) rotate(${krokiewAngleDeg})`}
                  >
                    <text
                      x="0"
                      y="0"
                      fill="#0b1220"
                      fontSize="24"
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

                  {/* Wypełnienie szklane trójkąta (precyzyjna szyba) */}
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

                  {/* Odblaski szkła (zawsze wewnątrz kwatery) */}
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
                  {/* Cienka czerwona linia obrysu zewnętrznego (charakterystyczna dla CAD/Prokal) */}
                  <rect
                    x={originX - 2}
                    y={originY - 2}
                    width={width + 4}
                    height={height + 4}
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="2"
                  />

                  {/* Aluminiowa ościeżnica / Rama główna (RAL 7016) */}
                  <rect
                    x={originX}
                    y={originY}
                    width={width}
                    height={height}
                    fill="#29323d"
                    stroke="#1e242b"
                    strokeWidth="1.5"
                  />

                  {/* Wnętrze ramy (światło konstrukcji) */}
                  <rect
                    x={originX + frameThickness}
                    y={originY + frameThickness}
                    width={width - frameThickness * 2}
                    height={height - frameThickness * 2}
                    fill="#ffffff"
                    stroke="#1e242b"
                    strokeWidth="1.5"
                  />

                  {/* Narożne cięcia ukośne (miter joints 45°) */}
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

                  {/* Kwatery / Skrzydła szklane */}
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
                      <g key={idx} id={`cad-pane-${idx}`}>
                        {/* Tło kwatery szklanej (czyste białe) */}
                        <rect
                          x={segX + 2}
                          y={segY + 2}
                          width={segW - 4}
                          height={openingH - 4}
                          fill="#ffffff"
                          stroke="#e2e8f0"
                          strokeWidth="1.5"
                        />

                        {/* Pionowa czerwona linia podziału / zachodzenia skrzydeł */}
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

                        {/* Półprzezroczysty subtelny odblask szkła */}
                        <line
                          x1={segX + 24}
                          y1={segY + openingH - 50}
                          x2={segX + segW - 24}
                          y2={segY + 50}
                          stroke="#38bdf8"
                          strokeWidth="1.5"
                          strokeOpacity="0.25"
                        />

                        {/* Wymiar kwatery u góry szkła */}
                        <text
                          x={centerX}
                          y={segY + 64}
                          fill="#0b1220"
                          fontSize={Math.min(
                            46,
                            Math.max(30, Math.round(segW / 14)),
                          )}
                          fontWeight="800"
                          textAnchor="middle"
                          letterSpacing="0.5px"
                        >
                          {glassW} × {glassH} mm
                        </text>
                      </g>
                    );
                  })}
                </>
              )}

              {/* ─── LINIE WYMIAROWE (Architektoniczne czarne CAD, duże i wyraźne) ─── */}
              {showDimensions && (
                <g id="dimensionChains">
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
                          markerStart="url(#cadArrowStart)"
                          markerEnd="url(#cadArrowEnd)"
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
                          markerStart="url(#cadArrowStart)"
                          markerEnd="url(#cadArrowEnd)"
                        />
                        <text
                          x={originX - 85}
                          y={originY + height / 2}
                          fill="#0b1220"
                          fontSize="50"
                          fontWeight="900"
                          textAnchor="middle"
                          transform={`rotate(-90, ${originX - 85}, ${originY + height / 2})`}
                        >
                          H = {height}
                        </text>
                      </g>
                    </>
                  ) : (
                    <>
                      {/* GÓRA: Wymiary poszczególnych kwater (np. 960 | 960 | 960) */}
                      {segments.map((seg, idx) => {
                        const segStartX = originX + (idx * width) / panes;
                        const segEndX = originX + ((idx + 1) * width) / panes;
                        const dimY = originY - 60;

                        return (
                          <g key={idx}>
                            {/* Linie pomocnicze (świadkowe przerywane) */}
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

                            {/* Główna linia wymiaru ze strzałkami */}
                            <line
                              x1={segStartX}
                              y1={dimY}
                              x2={segEndX}
                              y2={dimY}
                              stroke="#0b1220"
                              strokeWidth="3"
                              markerStart="url(#cadArrowStart)"
                              markerEnd="url(#cadArrowEnd)"
                            />

                            {/* Wartość wymiaru nad linią - duży, czytelny font */}
                            <text
                              x={(segStartX + segEndX) / 2}
                              y={dimY - 12}
                              fill="#0b1220"
                              fontSize="44"
                              fontWeight="800"
                              textAnchor="middle"
                            >
                              {seg.widthMm}
                            </text>
                          </g>
                        );
                      })}

                      {/* GÓRA: Całkowity wymiar szerokości (np. 2880) */}
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
                          markerStart="url(#cadArrowStart)"
                          markerEnd="url(#cadArrowEnd)"
                        />
                        <text
                          x={originX + width / 2}
                          y={originY - 152}
                          fill="#0b1220"
                          fontSize="52"
                          fontWeight="900"
                          textAnchor="middle"
                        >
                          {width}
                        </text>
                      </g>

                      {/* PRAWO: Całkowity wymiar wysokości (np. 2300) */}
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
                          markerStart="url(#cadArrowStart)"
                          markerEnd="url(#cadArrowEnd)"
                        />
                        <text
                          x={originX + width + 120}
                          y={originY + height / 2}
                          fill="#0b1220"
                          fontSize="52"
                          fontWeight="900"
                          textAnchor="middle"
                          transform={`rotate(90, ${originX + width + 120}, ${originY + height / 2})`}
                        >
                          {height}
                        </text>
                      </g>
                    </>
                  )}
                </g>
              )}
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
