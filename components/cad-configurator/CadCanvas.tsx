"use client";

import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { ZoomIn, ZoomOut, Maximize2, Ruler, Layers, Check, X } from "lucide-react";

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
  onChange?: (patch: Partial<CadConstructionItem>) => void;
}

export function CadCanvas({
  item,
  readOnly = false,
  initialZoom = 1,
  onChange,
}: CadCanvasProps) {
  const [zoom, setZoom] = useState(initialZoom);
  const [showDimensions, setShowDimensions] = useState(true);
  const [hoveredDim, setHoveredDim] = useState<string | null>(null);

  // Optymistyczne nadpisanie wymiarów dla natychmiastowego przerysowania (0 ms opóźnienia)
  const [localDim, setLocalDim] = useState<{
    itemId: string;
    widthMm?: number;
    heightMm?: number;
  } | null>(null);

  // Stan edytowanego wymiaru na rzucie CAD
  const [activeDimEdit, setActiveDimEdit] = useState<{
    target: "width" | "height" | "segment";
    segmentIndex?: number;
    x: number;
    y: number;
  } | null>(null);
  const [draftDimValue, setDraftDimValue] = useState<string>("");
  const dimInputRef = useRef<HTMLInputElement | null>(null);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const zoomOriginRef = useRef<{
    cursorClientX: number;
    cursorClientY: number;
    ratioX: number;
    ratioY: number;
  } | null>(null);

  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{
    x: number;
    y: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);

  const canEditDimensions = !readOnly && Boolean(onChange);

  // Obsługa przybliżania i oddalania (Ctrl/Cmd + Scroll) wycentrowana na pozycji kursora myszy (jak w AutoCAD)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const viewport = viewportRef.current;
        const content = contentRef.current;
        if (!viewport || !content) return;

        const contentRect = content.getBoundingClientRect();
        if (contentRect.width > 0 && contentRect.height > 0) {
          const ratioX = (e.clientX - contentRect.left) / contentRect.width;
          const ratioY = (e.clientY - contentRect.top) / contentRect.height;
          zoomOriginRef.current = {
            cursorClientX: e.clientX,
            cursorClientY: e.clientY,
            ratioX,
            ratioY,
          };
        }

        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        setZoom((prev) =>
          Math.min(5, Math.max(0.3, Math.round(prev * factor * 100) / 100))
        );
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, []);

  // Natychmiastowe wyrównanie przesunięcia scrolla po zmianie zoomu
  useLayoutEffect(() => {
    if (!zoomOriginRef.current) return;
    const { cursorClientX, cursorClientY, ratioX, ratioY } =
      zoomOriginRef.current;
    zoomOriginRef.current = null;

    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const newContentRect = content.getBoundingClientRect();
    const currentPointX = newContentRect.left + ratioX * newContentRect.width;
    const currentPointY = newContentRect.top + ratioY * newContentRect.height;

    const deltaX = currentPointX - cursorClientX;
    const deltaY = currentPointY - cursorClientY;

    viewport.scrollLeft += deltaX;
    viewport.scrollTop += deltaY;
  }, [zoom]);

  // Przesuwanie widoku (PAN) środkowym przyciskiem myszy (scroll click) lub Alt+LPM
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        e.preventDefault();
        setIsPanning(true);
        panStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          scrollLeft: viewport.scrollLeft,
          scrollTop: viewport.scrollTop,
        };
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!panStartRef.current || !viewportRef.current) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      viewportRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
      viewportRef.current.scrollTop = panStartRef.current.scrollTop - dy;
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        setIsPanning(false);
        panStartRef.current = null;
      }
    };

    viewport.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      viewport.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const effectiveWidthMm =
    localDim && localDim.itemId === item._id && localDim.widthMm !== undefined
      ? localDim.widthMm
      : item.widthMm;
  const effectiveHeightMm =
    localDim && localDim.itemId === item._id && localDim.heightMm !== undefined
      ? localDim.heightMm
      : item.heightMm;

  const width = Math.max(effectiveWidthMm || 2880, 300);
  const height = Math.max(effectiveHeightMm || 2300, 200);
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

  const isTriangleRight =
    isTriangle &&
    (item.name.toLowerCase().includes("praw") ||
      Boolean(item.shortName && item.shortName.toLowerCase().includes("praw")));

  // Obliczenia wymiarów kwater
  const paneWidth = Math.round(width / panes);
  const segments: CadSegment[] =
    item.segments &&
    item.segments.length === panes &&
    effectiveWidthMm === item.widthMm &&
    effectiveHeightMm === item.heightMm
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

  // Otwieranie edytora wymiaru bezpośrednio na rzucie CAD
  const openDimEditor = (
    e: React.MouseEvent,
    target: "width" | "height" | "segment",
    segmentIndex?: number
  ) => {
    if (!canEditDimensions) return;
    e.stopPropagation();
    const initialVal =
      target === "width"
        ? width
        : target === "height"
        ? height
        : segments[segmentIndex ?? 0]?.widthMm || paneWidth;
    setDraftDimValue(String(initialVal));
    setActiveDimEdit({
      target,
      segmentIndex,
      x: e.clientX,
      y: e.clientY,
    });
    setTimeout(() => {
      dimInputRef.current?.focus();
      dimInputRef.current?.select();
    }, 10);
  };

  // Zapisanie zmienionego wymiaru
  const handleApplyDimension = () => {
    if (!activeDimEdit || !onChange) return;
    const parsed = parseInt(draftDimValue, 10);
    if (isNaN(parsed) || parsed < 200) return;

    if (activeDimEdit.target === "width") {
      const nextW = Math.min(15000, Math.max(300, parsed));
      setLocalDim({
        itemId: item._id,
        widthMm: nextW,
        heightMm: height,
      });
      onChange({ widthMm: nextW });
    } else if (activeDimEdit.target === "height") {
      const nextH = Math.min(10000, Math.max(200, parsed));
      setLocalDim({
        itemId: item._id,
        widthMm: width,
        heightMm: nextH,
      });
      onChange({ heightMm: nextH });
    } else if (activeDimEdit.target === "segment") {
      const nextSegW = Math.min(5000, Math.max(200, parsed));
      const nextTotalW = Math.min(15000, Math.max(300, nextSegW * panes));
      setLocalDim({
        itemId: item._id,
        widthMm: nextTotalW,
        heightMm: height,
      });
      onChange({ widthMm: nextTotalW });
    }
    setActiveDimEdit(null);
  };

  // Precyzyjne, przestronne marginesy dla czytelnego wymiarowania architektonicznego
  const padLeft = 170;
  const padRight = 200;
  const padTop = 220;
  const padBottom = 150;

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

  const yKrokLeftTop = isTriangleRight ? Math.max(originY + 10, yProfTop - tKrok) : originY;
  const yKrokLeftBot = isTriangleRight ? yProfTop : originY + tKrok;
  const yKrokRightBot = isTriangleRight ? originY + tKrok : yProfTop;
  const yKrokRightTop = isTriangleRight ? originY : Math.max(originY + 10, yProfTop - tKrok);

  const yInnerTop = (isTriangleRight ? yKrokRightBot : yKrokLeftBot) + tSub;
  const yInnerBot = yProfTop;
  const xInnerLeft = originX + (isTriangleRight ? 0 : tLeft);
  const xInnerRight = originX + width - (isTriangleRight ? tLeft : 0);

  const mInner = Math.max(0.001, (yInnerBot - yInnerTop) / Math.max(1, xInnerRight - xInnerLeft));
  const krokiewAngleDeg = Math.round(Math.atan2(Math.abs(yKrokRightTop - yKrokLeftTop), width) * (180 / Math.PI) * 10) / 10;
  const krokiewLenMm = Math.round(Math.sqrt(width * width + (yKrokRightTop - yKrokLeftTop) * (yKrokRightTop - yKrokLeftTop)));

  const gMargin = 14; // szczelina montażowa szyby
  const yGlassBot = yInnerBot - gMargin;
  const yGlassTop = yInnerTop + gMargin;

  // Szyba dla trójkąta lewego lub prawego (odbicie lustrzane)
  const xGlassLeft = isTriangleRight
    ? Math.round(Math.max(originX + 40, (originX + width - tLeft - gMargin) - (yGlassBot - yGlassTop) / mInner))
    : xInnerLeft + gMargin;
  const xGlassRight = isTriangleRight
    ? originX + width - tLeft - gMargin
    : Math.round(
        Math.min(
          originX + width - 40,
          Math.max(xInnerLeft + gMargin + 50, xInnerLeft + (yGlassBot - gMargin - yInnerTop) / mInner)
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
            · {width} × {height} mm ({panes} {panes === 1 ? "tor" : panes < 5 ? "tory" : "torów"})
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
        className={`relative flex-1 min-h-0 min-w-0 overflow-auto p-2 sm:p-4 bg-slate-100/60 ${
          isPanning ? "cursor-grabbing select-none" : ""
        }`}
      >
        <div
          ref={contentRef}
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

                  {/* Pionowy profil przyścienny (wysoki bok: po lewej dla LEWEGO, po prawej dla PRAWEGO) */}
                  <rect
                    x={isTriangleRight ? originX + width - tLeft : originX}
                    y={isTriangleRight ? yKrokRightBot : yKrokLeftBot}
                    width={tLeft}
                    height={yProfTop - (isTriangleRight ? yKrokRightBot : yKrokLeftBot)}
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
                    transform={`translate(${originX + width * 0.48}, ${(yKrokLeftTop + yKrokRightTop) / 2 + tKrok / 2 + 5}) rotate(${isTriangleRight ? -krokiewAngleDeg : krokiewAngleDeg})`}
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
                    points={
                      isTriangleRight
                        ? `${originX},${yKrokLeftBot} ${originX + width},${yKrokRightBot} ${originX + width - tLeft},${yInnerTop}`
                        : `${originX},${yKrokLeftBot} ${originX + width},${yKrokRightBot} ${originX + tLeft},${yInnerTop}`
                    }
                    fill="#29323d"
                    stroke="#1e242b"
                    strokeWidth="1.5"
                  />

                  {/* Wypełnienie szklane trójkąta (precyzyjna szyba: odbicie lustrzane) */}
                  <polygon
                    points={
                      isTriangleRight
                        ? `
                          ${xGlassRight},${yGlassTop}
                          ${xGlassRight},${yGlassBot}
                          ${xGlassLeft},${yGlassBot}
                        `
                        : `
                          ${xGlassLeft},${yGlassTop}
                          ${xGlassRight},${yGlassBot}
                          ${xGlassLeft},${yGlassBot}
                        `
                    }
                    fill="#ffffff"
                    stroke="#38bdf8"
                    strokeWidth="2"
                  />

                  {/* Odblaski szkła (zawsze wewnątrz kwatery) */}
                  <line
                    x1={isTriangleRight ? xGlassRight - 40 : xGlassLeft + 40}
                    y1={yGlassBot - 30}
                    x2={
                      isTriangleRight
                        ? xGlassRight - (xGlassRight - xGlassLeft) * 0.35
                        : xGlassLeft + (xGlassRight - xGlassLeft) * 0.35
                    }
                    y2={yGlassTop + (yGlassBot - yGlassTop) * 0.35}
                    stroke="#38bdf8"
                    strokeWidth="2.5"
                    strokeOpacity="0.4"
                  />

                  {/* Parametry wewnątrz trójkąta */}
                  <text
                    x={originX + width * (isTriangleRight ? 0.65 : 0.35)}
                    y={yGlassBot - 60}
                    fill="#0b1220"
                    fontSize="42"
                    fontWeight="900"
                    textAnchor="middle"
                  >
                    {fill}
                  </text>
                  <text
                    x={originX + width * (isTriangleRight ? 0.65 : 0.35)}
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
                        <g
                          className={canEditDimensions ? "cursor-pointer" : ""}
                          onClick={(e) => openDimEditor(e, "segment", idx)}
                        >
                          <title>
                            {canEditDimensions
                              ? "Kliknij, aby zmienić szerokość skrzydła na torze"
                              : undefined}
                          </title>
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
                      </g>
                    );
                  })}
                </>
              )}

              {/* ─── LINIE WYMIAROWE (Interaktywne architektoniczne wymiary CAD) ─── */}
              {showDimensions && (
                <g id="dimensionChains">
                  {isTriangle ? (
                    <>
                      {/* DÓŁ: Całkowity wymiar szerokości B */}
                      <g
                        className={canEditDimensions ? "cursor-pointer" : ""}
                        onMouseEnter={() => setHoveredDim("width")}
                        onMouseLeave={() => setHoveredDim(null)}
                        onClick={(e) => openDimEditor(e, "width")}
                      >
                        <title>
                          {canEditDimensions
                            ? "Kliknij, aby zmienić szerokość B (mm)"
                            : undefined}
                        </title>
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
                          stroke={hoveredDim === "width" ? "#0891b2" : "#0b1220"}
                          strokeWidth="3.5"
                          markerStart="url(#cadArrowStart)"
                          markerEnd="url(#cadArrowEnd)"
                        />
                        {canEditDimensions && (
                          <rect
                            x={originX + width / 2 - 150}
                            y={originY + height + 68}
                            width="300"
                            height="56"
                            rx="12"
                            fill={hoveredDim === "width" ? "#ecfeff" : "#ffffff"}
                            stroke={hoveredDim === "width" ? "#0891b2" : "#cbd5e1"}
                            strokeWidth={hoveredDim === "width" ? "3.5" : "2"}
                          />
                        )}
                        <text
                          x={originX + width / 2}
                          y={originY + height + 112}
                          fill={hoveredDim === "width" ? "#0e7490" : "#0b1220"}
                          fontSize="46"
                          fontWeight="900"
                          textAnchor="middle"
                        >
                          B = {width}
                        </text>
                      </g>

                      {/* Całkowity wymiar wysokości H (przy słupku przyściennym) */}
                      <g
                        className={canEditDimensions ? "cursor-pointer" : ""}
                        onMouseEnter={() => setHoveredDim("height")}
                        onMouseLeave={() => setHoveredDim(null)}
                        onClick={(e) => openDimEditor(e, "height")}
                      >
                        <title>
                          {canEditDimensions
                            ? "Kliknij, aby zmienić wysokość H (mm)"
                            : undefined}
                        </title>
                        <line
                          x1={isTriangleRight ? originX + width + 5 : originX - 5}
                          y1={originY}
                          x2={isTriangleRight ? originX + width + 75 : originX - 75}
                          y2={originY}
                          stroke="#64748b"
                          strokeWidth="2"
                          strokeDasharray="6 6"
                        />
                        <line
                          x1={isTriangleRight ? originX + width + 5 : originX - 5}
                          y1={originY + height}
                          x2={isTriangleRight ? originX + width + 75 : originX - 75}
                          y2={originY + height}
                          stroke="#64748b"
                          strokeWidth="2"
                          strokeDasharray="6 6"
                        />
                        <line
                          x1={isTriangleRight ? originX + width + 60 : originX - 60}
                          y1={originY}
                          x2={isTriangleRight ? originX + width + 60 : originX - 60}
                          y2={originY + height}
                          stroke={hoveredDim === "height" ? "#0891b2" : "#0b1220"}
                          strokeWidth="3.5"
                          markerStart="url(#cadArrowStart)"
                          markerEnd="url(#cadArrowEnd)"
                        />
                        <g
                          transform={
                            isTriangleRight
                              ? `translate(${originX + width + 96}, ${originY + height / 2}) rotate(90)`
                              : `translate(${originX - 96}, ${originY + height / 2}) rotate(-90)`
                          }
                        >
                          {canEditDimensions && (
                            <rect
                              x="-145"
                              y="-38"
                              width="290"
                              height="56"
                              rx="12"
                              fill={hoveredDim === "height" ? "#ecfeff" : "#ffffff"}
                              stroke={hoveredDim === "height" ? "#0891b2" : "#cbd5e1"}
                              strokeWidth={hoveredDim === "height" ? "3.5" : "2"}
                            />
                          )}
                          <text
                            x="0"
                            y="6"
                            fill={hoveredDim === "height" ? "#0e7490" : "#0b1220"}
                            fontSize="46"
                            fontWeight="900"
                            textAnchor="middle"
                          >
                            H = {height}
                          </text>
                        </g>
                      </g>
                    </>
                  ) : (
                    <>
                      {/* GÓRA: Wymiary poszczególnych kwater (np. 960 | 960 | 960) */}
                      {segments.map((seg, idx) => {
                        const segStartX = originX + (idx * width) / panes;
                        const segEndX = originX + ((idx + 1) * width) / panes;
                        const dimY = originY - 60;
                        const dimKey = `seg-${idx}`;
                        const isSegHovered = hoveredDim === dimKey;
                        const segCenterX = (segStartX + segEndX) / 2;

                        return (
                          <g
                            key={idx}
                            className={canEditDimensions ? "cursor-pointer" : ""}
                            onMouseEnter={() => setHoveredDim(dimKey)}
                            onMouseLeave={() => setHoveredDim(null)}
                            onClick={(e) => openDimEditor(e, "segment", idx)}
                          >
                            <title>
                              {canEditDimensions
                                ? `Kliknij, aby zmienić szerokość skrzydła na torze #${idx + 1} (mm)`
                                : undefined}
                            </title>
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
                              stroke={isSegHovered ? "#0891b2" : "#0b1220"}
                              strokeWidth="3"
                              markerStart="url(#cadArrowStart)"
                              markerEnd="url(#cadArrowEnd)"
                            />

                            {canEditDimensions && (
                              <rect
                                x={segCenterX - 85}
                                y={dimY - 52}
                                width="170"
                                height="48"
                                rx="10"
                                fill={isSegHovered ? "#ecfeff" : "#ffffff"}
                                stroke={isSegHovered ? "#0891b2" : "#cbd5e1"}
                                strokeWidth={isSegHovered ? "3" : "1.8"}
                              />
                            )}

                            {/* Wartość wymiaru nad linią */}
                            <text
                              x={segCenterX}
                              y={dimY - 14}
                              fill={isSegHovered ? "#0e7490" : "#0b1220"}
                              fontSize="40"
                              fontWeight="800"
                              textAnchor="middle"
                            >
                              {seg.widthMm}
                            </text>
                          </g>
                        );
                      })}

                      {/* GÓRA: Całkowity wymiar szerokości (np. 2880) */}
                      <g
                        className={canEditDimensions ? "cursor-pointer" : ""}
                        onMouseEnter={() => setHoveredDim("width")}
                        onMouseLeave={() => setHoveredDim(null)}
                        onClick={(e) => openDimEditor(e, "width")}
                      >
                        <title>
                          {canEditDimensions
                            ? "Kliknij, aby zmienić szerokość całkowitą (mm)"
                            : undefined}
                        </title>
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
                          stroke={hoveredDim === "width" ? "#0891b2" : "#0b1220"}
                          strokeWidth="3.5"
                          markerStart="url(#cadArrowStart)"
                          markerEnd="url(#cadArrowEnd)"
                        />
                        {canEditDimensions && (
                          <rect
                            x={originX + width / 2 - 110}
                            y={originY - 196}
                            width="220"
                            height="54"
                            rx="12"
                            fill={hoveredDim === "width" ? "#ecfeff" : "#ffffff"}
                            stroke={hoveredDim === "width" ? "#0891b2" : "#cbd5e1"}
                            strokeWidth={hoveredDim === "width" ? "3.5" : "2"}
                          />
                        )}
                        <text
                          x={originX + width / 2}
                          y={originY - 154}
                          fill={hoveredDim === "width" ? "#0e7490" : "#0b1220"}
                          fontSize="48"
                          fontWeight="900"
                          textAnchor="middle"
                        >
                          {width}
                        </text>
                      </g>

                      {/* PRAWO: Całkowity wymiar wysokości (np. 2300) */}
                      <g
                        className={canEditDimensions ? "cursor-pointer" : ""}
                        onMouseEnter={() => setHoveredDim("height")}
                        onMouseLeave={() => setHoveredDim(null)}
                        onClick={(e) => openDimEditor(e, "height")}
                      >
                        <title>
                          {canEditDimensions
                            ? "Kliknij, aby zmienić wysokość całkowitą (mm)"
                            : undefined}
                        </title>
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
                          stroke={hoveredDim === "height" ? "#0891b2" : "#0b1220"}
                          strokeWidth="3.5"
                          markerStart="url(#cadArrowStart)"
                          markerEnd="url(#cadArrowEnd)"
                        />
                        <g
                          transform={`translate(${originX + width + 126}, ${originY + height / 2}) rotate(90)`}
                        >
                          {canEditDimensions && (
                            <rect
                              x="-110"
                              y="-38"
                              width="220"
                              height="54"
                              rx="12"
                              fill={hoveredDim === "height" ? "#ecfeff" : "#ffffff"}
                              stroke={hoveredDim === "height" ? "#0891b2" : "#cbd5e1"}
                              strokeWidth={hoveredDim === "height" ? "3.5" : "2"}
                            />
                          )}
                          <text
                            x="0"
                            y="6"
                            fill={hoveredDim === "height" ? "#0e7490" : "#0b1220"}
                            fontSize="48"
                            fontWeight="900"
                            textAnchor="middle"
                          >
                            {height}
                          </text>
                        </g>
                      </g>
                    </>
                  )}
                </g>
              )}
            </g>
          </svg>
        </div>
      </div>

      {/* ─── PŁYWAJĄCY EDYTOR WYMIARU CAD (Dynamic Input) ─── */}
      {activeDimEdit && (() => {
        const popX =
          typeof window !== "undefined"
            ? Math.min(window.innerWidth - 275, Math.max(16, activeDimEdit.x - 120))
            : 200;
        const popY =
          typeof window !== "undefined"
            ? Math.min(window.innerHeight - 210, Math.max(16, activeDimEdit.y + 14))
            : 200;

        const parsedNum = parseInt(draftDimValue, 10) || 0;
        const previewTotalW =
          activeDimEdit.target === "segment"
            ? parsedNum * panes
            : activeDimEdit.target === "width"
            ? parsedNum
            : width;
        const previewTotalH =
          activeDimEdit.target === "height" ? parsedNum : height;

        return (
          <div
            className="fixed inset-0 z-50 bg-transparent"
            onClick={() => setActiveDimEdit(null)}
          >
            <div
              style={{
                position: "fixed",
                left: `${popX}px`,
                top: `${popY}px`,
              }}
              className="bg-white rounded-xl shadow-2xl border border-[#4ABBC3] w-[260px] p-3 z-50 text-[#0b1220] animate-in fade-in zoom-in-95 duration-75 space-y-2.5"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Przełącznik trybu wymiaru + zamknięcie */}
              <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-slate-100">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveDimEdit({ ...activeDimEdit, target: "width" });
                      setDraftDimValue(String(width));
                      setTimeout(() => {
                        dimInputRef.current?.focus();
                        dimInputRef.current?.select();
                      }, 10);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                      activeDimEdit.target === "width"
                        ? "bg-[#0b1220] text-[#4ABBC3]"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Szerokość B
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveDimEdit({ ...activeDimEdit, target: "height" });
                      setDraftDimValue(String(height));
                      setTimeout(() => {
                        dimInputRef.current?.focus();
                        dimInputRef.current?.select();
                      }, 10);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                      activeDimEdit.target === "height"
                        ? "bg-[#0b1220] text-[#4ABBC3]"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Wysokość H
                  </button>
                  {activeDimEdit.target === "segment" && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#0b1220] text-[#4ABBC3]">
                      Tor #{(activeDimEdit.segmentIndex ?? 0) + 1}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDimEdit(null)}
                  className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                >
                  <X size={13} />
                </button>
              </div>

              {/* Pole wprowadzania wartości w mm */}
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <input
                    ref={dimInputRef}
                    type="number"
                    min={200}
                    max={15000}
                    step={10}
                    value={draftDimValue}
                    onChange={(e) => setDraftDimValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleApplyDimension();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setActiveDimEdit(null);
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-[#4ABBC3] focus:bg-white rounded-lg pl-2.5 pr-9 py-1.5 font-mono text-sm font-bold text-[#0b1220] focus:outline-none focus:ring-2 focus:ring-[#4ABBC3]/20"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-slate-400 pointer-events-none">
                    mm
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleApplyDimension}
                  title="Zatwierdź wymiar (Enter)"
                  className="px-2.5 py-1.5 rounded-lg bg-[#0b1220] hover:bg-slate-800 text-[#4ABBC3] font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                >
                  <Check size={14} strokeWidth={3} />
                </button>
              </div>

              {/* Szybka korekta krokowa (-100, -10, +10, +100 mm) */}
              <div className="grid grid-cols-4 gap-1">
                {[-100, -10, 10, 100].map((delta) => (
                  <button
                    key={delta}
                    type="button"
                    onClick={() => {
                      const next = Math.max(
                        200,
                        (parseInt(draftDimValue, 10) || 0) + delta
                      );
                      setDraftDimValue(String(next));
                      dimInputRef.current?.focus();
                    }}
                    className="py-1 rounded bg-slate-100 hover:bg-[#f0fdff] hover:text-[#0e7490] hover:border-[#4ABBC3] border border-transparent text-[10px] font-mono font-bold text-slate-600 transition-colors cursor-pointer"
                  >
                    {delta > 0 ? `+${delta}` : delta}
                  </button>
                ))}
              </div>

              {/* Podpowiedź przeliczeniowa na żywo */}
              <div className="text-[10px] font-mono text-slate-500 flex items-center justify-between pt-0.5">
                {isTriangle ? (
                  <span>
                    Kąt:{" "}
                    <strong className="text-slate-700">
                      {Math.round(
                        Math.atan2(
                          Math.max(10, previewTotalH - 95),
                          Math.max(1, previewTotalW)
                        ) *
                          (180 / Math.PI) *
                          10
                      ) / 10}
                      °
                    </strong>
                  </span>
                ) : activeDimEdit.target === "segment" ? (
                  <span>
                    Całość ({panes}T):{" "}
                    <strong className="text-slate-800">{previewTotalW} mm</strong>
                  </span>
                ) : (
                  <span>
                    1 tor:{" "}
                    <strong className="text-slate-800">
                      ~{Math.round(previewTotalW / panes)} mm
                    </strong>
                  </span>
                )}
                <span className="text-[9px] text-slate-400">Enter = zapisz</span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
