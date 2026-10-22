"use client";

import React, { useState, useRef, useEffect, useMemo, useLayoutEffect } from "react";
import toast from "react-hot-toast";
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
  X,
  Check,
  Move,
  Grid,
  Focus,
  Grid3X3,
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
  onReorderPositions?: (orderedItemIds: string[]) => void;
  onUpdateDimensions?: (
    itemId: string,
    patch: {
      widthMm?: number;
      heightMm?: number;
    }
  ) => void;
}

export function AllConstructionsCadView({
  items,
  onSelectPosition,
  onBackToOffer,
  onAddNewPosition,
  onUpdatePlacement,
  onReorderPositions,
  onUpdateDimensions,
}: AllConstructionsCadViewProps) {
  const [zoom, setZoom] = useState(1);
  const [showDimensions, setShowDimensions] = useState(true);
  const [displayMode, setDisplayMode] = useState<"sheet" | "grid">("sheet");
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [hoveredDimKey, setHoveredDimKey] = useState<string | null>(null);

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

  // Lokalne nadpisanie kolejności pozycji dla natychmiastowej responsywności UI
  const [localItemOrder, setLocalItemOrder] = useState<string[] | null>(null);

  // Stan przeciągania konstrukcji na wspólnym arkuszu CAD (drag & drop)
  const [dragState, setDragState] = useState<{
    itemId: string;
    clientX: number;
    clientY: number;
    svgX: number;
    svgY: number;
  } | null>(null);

  type DropTarget =
    | {
        type: "above";
        targetItemId: string;
        targetName: string;
        targetPosIndex: number;
        rowIndex: number;
      }
    | {
        type: "slot";
        rowIndex: number;
        slotIndex: number;
        insertDescription: string;
      }
    | {
        type: "new-row";
        rowIndex: number;
      };

  const [activeDropTarget, setActiveDropTarget] = useState<DropTarget | null>(null);
  const activeDropTargetRef = useRef<DropTarget | null>(null);

  const pointerDownRef = useRef<{
    itemId: string;
    startX: number;
    startY: number;
    isDragging: boolean;
  } | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Lokalne nadpisania wymiarów (0 ms opóźnienia na rysunku CAD)
  const [localDimensions, setLocalDimensions] = useState<
    Record<string, { widthMm?: number; heightMm?: number }>
  >({});

  // Stan otwartego edytora wymiaru bezpośrednio na rzucie CAD
  const [activeDimEdit, setActiveDimEdit] = useState<{
    itemId: string;
    target?: "width" | "height" | "segment" | "pane_width";
    mode?: "width" | "height" | "pane_width";
    segmentIndex?: number;
    paneIndex?: number;
    value?: string;
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

  // Obsługa przybliżania i oddalania (Scroll) wycentrowana na pozycji kursora myszy (jak w AutoCAD / Revit / Figma)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // Jeśli użytkownik wykonuje poziome przewijanie touchpadem bez klawisza modyfikującego,
      // pozwól na naturalny scroll
      if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaX) > 0 && Math.abs(e.deltaX) >= Math.abs(e.deltaY)) {
        return;
      }

      e.preventDefault();
      const viewport = viewportRef.current;
      const content = contentRef.current;
      if (!viewport || !content) return;

      const contentRect = content.getBoundingClientRect();
      if (contentRect.width > 0 && contentRect.height > 0) {
        // Precyzyjna pozycja kursora wewnątrz rysunku CAD (0.0 do 1.0)
        const ratioX = (e.clientX - contentRect.left) / contentRect.width;
        const ratioY = (e.clientY - contentRect.top) / contentRect.height;
        zoomOriginRef.current = {
          cursorClientX: e.clientX,
          cursorClientY: e.clientY,
          ratioX,
          ratioY,
        };
      }

      // Płynne, proporcjonalne skalowanie geometryczne (jak w AutoCAD / Figma)
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      setZoom((prev) =>
        Math.min(5, Math.max(0.15, Math.round(prev * factor * 100) / 100))
      );
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, [displayMode]);

  // Natychmiastowe przeliczenie przesunięcia scrolla przed narysowaniem klatki,
  // aby punkt pod kursorem pozostał idealnie w tym samym miejscu na ekranie
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

  // Przesuwanie widoku (PAN) środkowym przyciskiem myszy (scroll click), Alt+LPM, Ctrl+LPM lub przeciągnięciem wolnego pola roboczego (jak w AutoCAD)
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onMouseDown = (e: MouseEvent) => {
      // Ignoruj interaktywne elementy (np. edycja wymiarów, przyciski akcji)
      if (
        (e.target as HTMLElement)?.closest?.(
          "input, button, select, textarea, .cad-dim-interactive"
        )
      ) {
        return;
      }

      const isPanTrigger =
        e.button === 1 ||
        (e.button === 0 && (e.ctrlKey || e.metaKey || e.altKey)) ||
        (e.button === 0 && !pointerDownRef.current);

      if (isPanTrigger) {
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

    const onMouseUp = () => {
      if (panStartRef.current) {
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
  };

  // ── Obliczenia układu dla Wspólnego Arkusza CAD ("sheet") ──
  // Obsługa układania konstrukcji pionowo (jedna nad drugą np. trójkąt nad drzwiami) oraz w rzędach (jedna pod drugą)
  // Duży, swobodny obszar roboczy CAD (Model Space) z wielometrowymi marginesami i siatką techniczną
  const [workspacePreset, setWorkspacePreset] = useState<"standard" | "large" | "extra">("large");
  const [showCadGrid, setShowCadGrid] = useState<boolean>(true);

  const { minWorkspaceW, minWorkspaceH, sheetPadX, sheetPadTop, sheetPadBottom } = useMemo(() => {
    switch (workspacePreset) {
      case "standard":
        return {
          minWorkspaceW: 10000,
          minWorkspaceH: 6000,
          sheetPadX: 2000,
          sheetPadTop: 1400,
          sheetPadBottom: 1400,
        };
      case "extra":
        return {
          minWorkspaceW: 22000,
          minWorkspaceH: 12000,
          sheetPadX: 4000,
          sheetPadTop: 2400,
          sheetPadBottom: 2400,
        };
      case "large":
      default:
        return {
          minWorkspaceW: 14000,
          minWorkspaceH: 8500,
          sheetPadX: 2800,
          sheetPadTop: 1800,
          sheetPadBottom: 1800,
        };
    }
  }, [workspacePreset]);

  const gapX = 520; // odstęp poziomy między konstrukcjami/stosami na arkuszu
  const gapY = 640; // odstęp pionowy między rzędami konstrukcji

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

  const effectiveItems: CadConstructionItem[] = useMemo(() => {
    let baseList = [...items];
    if (localItemOrder && localItemOrder.length === items.length) {
      const map = new Map(items.map((it) => [it._id, it]));
      const reordered: CadConstructionItem[] = [];
      localItemOrder.forEach((id, idx) => {
        const found = map.get(id);
        if (found) {
          reordered.push({
            ...found,
            positionIndex: idx + 1,
          });
        }
      });
      if (reordered.length === items.length) {
        baseList = reordered;
      }
    }

    return baseList.map((it) => {
      const override = localPlacements[it._id];
      const dimOverride = localDimensions[it._id];
      if (!override && !dimOverride) return it;
      const nextWidth = dimOverride?.widthMm ?? it.widthMm;
      const nextHeight = dimOverride?.heightMm ?? it.heightMm;
      const panes = Math.max(1, it.panesCount || 3);
      const paneW = Math.round(nextWidth / panes);
      const nextSegments =
        dimOverride?.widthMm !== undefined || dimOverride?.heightMm !== undefined
          ? Array.from({ length: panes }).map((_, i) => ({
              widthMm: i === panes - 1 ? nextWidth - paneW * (panes - 1) : paneW,
              heightMm: nextHeight - 103,
              fill: it.fillType || "HART 10",
            }))
          : it.segments;
      return {
        ...it,
        widthMm: nextWidth,
        heightMm: nextHeight,
        segments: nextSegments,
        placedAboveItemId:
          override?.placedAboveItemId !== undefined
            ? override.placedAboveItemId ?? undefined
            : it.placedAboveItemId,
        placedBelowItemId:
          override?.placedBelowItemId !== undefined
            ? override.placedBelowItemId ?? undefined
            : it.placedBelowItemId,
        rowIndex:
          override?.rowIndex !== undefined
            ? override.rowIndex ?? 0
            : it.rowIndex ?? 0,
      };
    });
  }, [items, localItemOrder, localPlacements, localDimensions]);

  const openDimEditor = (
    e: React.MouseEvent,
    item: CadConstructionItem,
    target: "width" | "height" | "segment" | "pane_width",
    segmentIndex?: number
  ) => {
    e.stopPropagation();
    const w = Math.max(item.widthMm || 2880, 300);
    const h = Math.max(item.heightMm || 2300, 200);
    const panes = Math.max(item.panesCount || 3, 1);
    const paneW = Math.round(w / panes);
    const initialVal =
      target === "width"
        ? w
        : target === "height"
        ? h
        : item.segments?.[segmentIndex ?? 0]?.widthMm || paneW;
    const mode =
      target === "segment" || target === "pane_width" ? "pane_width" : target;
    const valStr = String(initialVal);
    setDraftDimValue(valStr);
    setActiveDimEdit({
      itemId: item._id,
      target,
      mode,
      segmentIndex,
      paneIndex: segmentIndex,
      value: valStr,
      x: e.clientX,
      y: e.clientY,
    });
    setTimeout(() => {
      dimInputRef.current?.focus();
      dimInputRef.current?.select();
    }, 10);
  };

  const handleApplyDimension = (customVal?: string) => {
    if (!activeDimEdit) return;
    const item = effectiveItems.find((it) => it._id === activeDimEdit.itemId);
    if (!item) return;

    const valToUse = customVal ?? activeDimEdit.value ?? draftDimValue;
    const parsed = parseInt(valToUse, 10);
    if (isNaN(parsed) || parsed < 200) return;

    const panes = Math.max(item.panesCount || 3, 1);
    let patch: { widthMm?: number; heightMm?: number } = {};

    const mode = activeDimEdit.mode || activeDimEdit.target;
    if (mode === "width") {
      patch = { widthMm: Math.min(15000, Math.max(300, parsed)) };
    } else if (mode === "height") {
      patch = { heightMm: Math.min(10000, Math.max(200, parsed)) };
    } else if (mode === "segment" || mode === "pane_width") {
      const nextSegW = Math.min(5000, Math.max(200, parsed));
      patch = { widthMm: Math.min(15000, Math.max(300, nextSegW * panes)) };
    }

    setLocalDimensions((prev) => ({
      ...prev,
      [item._id]: {
        ...prev[item._id],
        ...patch,
      },
    }));

    if (onUpdateDimensions) {
      onUpdateDimensions(item._id, patch);
    }
    setActiveDimEdit(null);
  };

  const computedRows: RenderRow[] = useMemo(() => {
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
  }, [effectiveItems]);

  const maxRowWidth = Math.max(
    ...computedRows.map((r) => r.rowWidth),
    2400
  );
  const totalRowsHeight =
    computedRows.reduce((acc, r) => acc + r.maxStackHeight, 0) +
    Math.max(0, computedRows.length - 1) * gapY;

  const sheetWidth = Math.max(minWorkspaceW, maxRowWidth + sheetPadX * 2);
  const sheetHeight = Math.max(minWorkspaceH, totalRowsHeight + sheetPadTop + sheetPadBottom);
  const frameThickness = 50;

  const handleFitToConstructions = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const targetZoom = Math.min(
      3,
      Math.max(
        0.5,
        Math.round((sheetWidth / Math.max(maxRowWidth + 2400, 3200)) * 100) / 100
      )
    );
    setZoom(targetZoom);
    setTimeout(() => {
      if (viewportRef.current) {
        viewportRef.current.scrollLeft =
          (viewportRef.current.scrollWidth - viewportRef.current.clientWidth) / 2;
        viewportRef.current.scrollTop =
          (viewportRef.current.scrollHeight - viewportRef.current.clientHeight) / 2;
      }
    }, 20);
  };

  const getSvgCoordinates = (
    clientX: number,
    clientY: number
  ): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const transformed = pt.matrixTransform(ctm.inverse());
    return { x: transformed.x, y: transformed.y };
  };

  // ── Wyznaczenie geometrii elementów i slotów na arkuszu do Drag & Drop ──
  const sheetGeometry = useMemo(() => {
    interface ItemBox {
      itemId: string;
      item: CadConstructionItem;
      originX: number;
      originY: number;
      width: number;
      height: number;
      rowIndex: number;
      stackIndex: number;
      isRoot: boolean;
    }

    interface RowInfo {
      rowIndex: number;
      floorY: number;
      maxStackHeight: number;
      rowWidth: number;
      startX: number;
      slots: {
        slotIndex: number;
        centerX: number;
        label: string;
      }[];
    }

    const itemBoxes: ItemBox[] = [];
    const rowInfos: RowInfo[] = [];

    computedRows.forEach((renderRow, rowIndex) => {
      const previousRowsHeight = computedRows
        .slice(0, rowIndex)
        .reduce((acc, r) => acc + r.maxStackHeight + gapY, 0);
      const currentRowMaxHeight = renderRow.maxStackHeight;
      const floorY = sheetPadTop + previousRowsHeight + currentRowMaxHeight;
      const currentRowWidth = renderRow.rowWidth;
      const startX = (sheetWidth - currentRowWidth) / 2;

      let stackCursorX = startX;
      const stackBounds: { left: number; right: number; rootId: string }[] = [];

      renderRow.stacks.forEach((stack, stackIndex) => {
        const currentStackX = stackCursorX;
        const stackLeft = currentStackX;
        const stackRight = currentStackX + stack.stackWidth;
        stackBounds.push({
          left: stackLeft,
          right: stackRight,
          rootId: stack.rootItem._id,
        });
        stackCursorX += stack.stackWidth + gapX;

        let currentBaseY = floorY;
        stack.stackedItems.forEach((item, itemIdxInStack) => {
          const width = Math.max(item.widthMm || 2880, 400);
          const height = Math.max(item.heightMm || 2300, 400);
          const originX = currentStackX + (stack.stackWidth - width) / 2;
          const originY = currentBaseY - height;
          currentBaseY = originY;

          itemBoxes.push({
            itemId: item._id,
            item,
            originX,
            originY,
            width,
            height,
            rowIndex: renderRow.rowIndex,
            stackIndex,
            isRoot: itemIdxInStack === 0,
          });
        });
      });

      // Wyznaczenie slotów wstawienia pomiędzy kolumnami
      const slots: RowInfo["slots"] = [];
      if (stackBounds.length === 0) {
        slots.push({
          slotIndex: 0,
          centerX: sheetWidth / 2,
          label: "Początek rzędu",
        });
      } else {
        // Przed pierwszą kolumną
        slots.push({
          slotIndex: 0,
          centerX: Math.max(160, stackBounds[0].left - gapX / 2),
          label: "Przesuń na początek",
        });
        // Pomiędzy kolumnami
        for (let i = 0; i < stackBounds.length - 1; i++) {
          const midX = (stackBounds[i].right + stackBounds[i + 1].left) / 2;
          slots.push({
            slotIndex: i + 1,
            centerX: midX,
            label: `Między kolumną ${i + 1} a ${i + 2}`,
          });
        }
        // Za ostatnią kolumną
        const last = stackBounds[stackBounds.length - 1];
        slots.push({
          slotIndex: stackBounds.length,
          centerX: Math.min(sheetWidth - 160, last.right + gapX / 2),
          label: "Przesuń na koniec",
        });
      }

      rowInfos.push({
        rowIndex: renderRow.rowIndex,
        floorY,
        maxStackHeight: currentRowMaxHeight,
        rowWidth: currentRowWidth,
        startX,
        slots,
      });
    });

    return { itemBoxes, rowInfos };
  }, [computedRows, sheetWidth, gapX, gapY, sheetPadTop]);

  const computeAndSetActiveDropTarget = (
    draggedId: string,
    svgX: number,
    svgY: number
  ) => {
    const { itemBoxes, rowInfos } = sheetGeometry;
    const updateActiveTarget = (target: DropTarget | null) => {
      activeDropTargetRef.current = target;
      setActiveDropTarget(target);
    };

    if (rowInfos.length === 0) {
      updateActiveTarget(null);
      return;
    }

    // 1. Zbiór ID, nad którymi NIE można upuścić (żeby uniknąć cykli i upuszczenia nad samym sobą)
    const invalidAboveIds = new Set<string>([draggedId]);
    let added = true;
    while (added) {
      added = false;
      effectiveItems.forEach((it) => {
        if (
          it.placedAboveItemId &&
          invalidAboveIds.has(it.placedAboveItemId) &&
          !invalidAboveIds.has(it._id)
        ) {
          invalidAboveIds.add(it._id);
          added = true;
        }
      });
    }

    // 2. Sprawdź, czy kursor znajduje się nad jakąś konstrukcją (strefa górna 60% wysokości lub lekko ponad nią)
    const hoveredItemBox = itemBoxes.find((box) => {
      if (invalidAboveIds.has(box.itemId)) return false;
      const marginX = 80;
      const isXInside =
        svgX >= box.originX - marginX && svgX <= box.originX + box.width + marginX;
      // Strefa nad konstrukcją (od 260px powyżej dachu do 55% jej wysokości)
      const isYAbove =
        svgY >= box.originY - 260 && svgY <= box.originY + box.height * 0.55;
      return isXInside && isYAbove;
    });

    if (hoveredItemBox) {
      updateActiveTarget({
        type: "above",
        targetItemId: hoveredItemBox.itemId,
        targetName: hoveredItemBox.item.shortName || hoveredItemBox.item.name,
        targetPosIndex: hoveredItemBox.item.positionIndex,
        rowIndex: hoveredItemBox.rowIndex,
      });
      return;
    }

    // 3. Sprawdź, czy kursor znajduje się poniżej najniższego poziomu posadzki (strefa "Nowy rząd poniżej")
    const maxFloorY = Math.max(...rowInfos.map((r) => r.floorY));
    if (svgY > maxFloorY + 90) {
      const maxRowIndex = Math.max(
        0,
        ...effectiveItems.map((it) => it.rowIndex ?? 0)
      );
      updateActiveTarget({
        type: "new-row",
        rowIndex: maxRowIndex + 1,
      });
      return;
    }

    // 4. W przeciwnym razie znajdź najbliższy rząd posadzki i najbliższy slot wstawienia
    let closestRow = rowInfos[0];
    let minRowDist = Math.abs(svgY - closestRow.floorY);
    for (let i = 1; i < rowInfos.length; i++) {
      const dist = Math.abs(svgY - rowInfos[i].floorY);
      if (dist < minRowDist) {
        minRowDist = dist;
        closestRow = rowInfos[i];
      }
    }

    let closestSlot = closestRow.slots[0];
    let minSlotDist = Math.abs(svgX - closestSlot.centerX);
    for (let i = 1; i < closestRow.slots.length; i++) {
      const dist = Math.abs(svgX - closestRow.slots[i].centerX);
      if (dist < minSlotDist) {
        minSlotDist = dist;
        closestSlot = closestRow.slots[i];
      }
    }

    updateActiveTarget({
      type: "slot",
      rowIndex: closestRow.rowIndex,
      slotIndex: closestSlot.slotIndex,
      insertDescription: closestSlot.label,
    });
  };

  const executeDrop = (draggedId: string, target: DropTarget) => {
    const draggedItem = items.find((it) => it._id === draggedId);
    if (!draggedItem) return;

    if (target.type === "above") {
      handleSetPlacement(draggedId, {
        placedAboveItemId: target.targetItemId,
        placedBelowItemId: null,
        rowIndex: target.rowIndex,
      });
      toast.success(`Umieszczono nad Poz. ${target.targetPosIndex}`);
    } else if (target.type === "new-row") {
      handleSetPlacement(draggedId, {
        placedAboveItemId: null,
        placedBelowItemId: null,
        rowIndex: target.rowIndex,
      });
      toast.success(`Przeniesiono do nowego rzędu ${target.rowIndex + 1}`);
    } else if (target.type === "slot") {
      // 1. Zdejmij konstrukcję na posadzkę w docelowym rzędzie
      handleSetPlacement(draggedId, {
        placedAboveItemId: null,
        placedBelowItemId: null,
        rowIndex: target.rowIndex,
      });

      // 2. Przelicz kolejność pozycji na arkuszu
      const targetRow = computedRows.find((r) => r.rowIndex === target.rowIndex);
      const existingRoots = targetRow
        ? targetRow.stacks
            .map((st) => st.rootItem._id)
            .filter((id) => id !== draggedId)
        : [];

      const clampedSlot = Math.max(
        0,
        Math.min(target.slotIndex, existingRoots.length)
      );
      existingRoots.splice(clampedSlot, 0, draggedId);

      // Budujemy ostateczną kolejność wszystkich elementów
      const finalOrderedIds: string[] = [];
      const processedIds = new Set<string>();

      const allRowIndices = Array.from(
        new Set([...computedRows.map((r) => r.rowIndex), target.rowIndex])
      ).sort((a, b) => a - b);

      allRowIndices.forEach((rIdx) => {
        const rootsForThisRow =
          rIdx === target.rowIndex
            ? existingRoots
            : (computedRows
                .find((r) => r.rowIndex === rIdx)
                ?.stacks.map((st) => st.rootItem._id)
                .filter((id) => id !== draggedId) || []);

        rootsForThisRow.forEach((rootId) => {
          if (!processedIds.has(rootId)) {
            finalOrderedIds.push(rootId);
            processedIds.add(rootId);
          }
          const stack = computedRows
            .flatMap((r) => r.stacks)
            .find((st) => st.rootItem._id === rootId);
          if (stack) {
            stack.stackedItems.forEach((child) => {
              if (
                child._id !== rootId &&
                child._id !== draggedId &&
                !processedIds.has(child._id)
              ) {
                finalOrderedIds.push(child._id);
                processedIds.add(child._id);
              }
            });
          }
        });
      });

      items.forEach((it) => {
        if (!processedIds.has(it._id)) {
          finalOrderedIds.push(it._id);
          processedIds.add(it._id);
        }
      });

      setLocalItemOrder(finalOrderedIds);
      if (onReorderPositions) {
        onReorderPositions(finalOrderedIds);
      }
      toast.success("Zmieniono pozycję konstrukcji na arkuszu");
    }
  };

  const handlePointerDownOnItem = (
    e: React.PointerEvent,
    item: CadConstructionItem
  ) => {
    // Reaguj tylko na lewy przycisk myszy / dotyk (button === 0) i bez klawisza Alt (Alt służy do PANowania)
    if (e.button !== 0 || e.altKey || e.ctrlKey || e.metaKey) return;

    // Ignoruj, jeśli kliknięto w linie wymiarowe
    if ((e.target as HTMLElement | SVGElement).closest?.(".cad-dim-interactive")) {
      return;
    }

    e.stopPropagation();
    pointerDownRef.current = {
      itemId: item._id,
      startX: e.clientX,
      startY: e.clientY,
      isDragging: false,
    };
  };

  const computeTargetRef = useRef(computeAndSetActiveDropTarget);
  const executeDropRef = useRef(executeDrop);

  useEffect(() => {
    computeTargetRef.current = computeAndSetActiveDropTarget;
    executeDropRef.current = executeDrop;
  });

  // Obsługa przeciągania na poziomie całego okna (Window pointer events)
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!pointerDownRef.current) return;
      const pd = pointerDownRef.current;

      if (!pd.isDragging) {
        const dist = Math.hypot(e.clientX - pd.startX, e.clientY - pd.startY);
        if (dist > 6) {
          pd.isDragging = true;
          const svgCoords = getSvgCoordinates(e.clientX, e.clientY);
          setDragState({
            itemId: pd.itemId,
            clientX: e.clientX,
            clientY: e.clientY,
            svgX: svgCoords?.x ?? 0,
            svgY: svgCoords?.y ?? 0,
          });
          setActiveDimEdit(null);
        }
      } else {
        const svgCoords = getSvgCoordinates(e.clientX, e.clientY);
        const svgX = svgCoords?.x ?? 0;
        const svgY = svgCoords?.y ?? 0;
        setDragState({
          itemId: pd.itemId,
          clientX: e.clientX,
          clientY: e.clientY,
          svgX,
          svgY,
        });
        computeTargetRef.current(pd.itemId, svgX, svgY);
      }
    };

    const handlePointerUp = () => {
      if (!pointerDownRef.current) return;
      const pd = pointerDownRef.current;
      pointerDownRef.current = null;

      if (pd.isDragging) {
        const target = activeDropTargetRef.current;
        if (target) {
          executeDropRef.current(pd.itemId, target);
        }
        setDragState(null);
        setActiveDropTarget(null);
        activeDropTargetRef.current = null;
      } else {
        // Zwykłe kliknięcie – bezpośrednio przejdź do edycji tej pozycji w CAD
        onSelectPosition(pd.itemId);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && pointerDownRef.current?.isDragging) {
        pointerDownRef.current = null;
        setDragState(null);
        setActiveDropTarget(null);
        activeDropTargetRef.current = null;
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

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
              {/* Toggle Siatka CAD */}
              <button
                type="button"
                onClick={() => setShowCadGrid((v) => !v)}
                title="Włącz / Wyłącz siatkę techniczną CAD (100mm / 500mm / 1000mm)"
                className={`p-1.5 rounded text-xs flex items-center gap-1 border transition-colors cursor-pointer ${
                  showCadGrid
                    ? "bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd]"
                    : "bg-white text-[#7c8597] border-[#d4dae3]"
                }`}
              >
                <Grid size={13} />
                <span className="hidden sm:inline">Siatka CAD</span>
              </button>

              <div className="h-4 w-px bg-[#e3e7ee] mx-0.5" />

              {/* Wybór wielkości obszaru roboczego CAD (Model Space) */}
              <div className="flex items-center gap-1 bg-slate-100 rounded p-0.5 border border-[#cbd5e1]">
                <span
                  className="text-[10px] text-[#475569] font-medium px-1 flex items-center gap-1"
                  title="Rozmiar wirtualnej przestrzeni roboczej CAD"
                >
                  <Grid3X3 size={11} className="text-[#0e7490]" />
                  <span className="hidden md:inline">Obszar:</span>
                </span>
                {(
                  [
                    { key: "standard", label: "10m", title: "Standardowy obszar roboczy (10 × 6 m)" },
                    { key: "large", label: "14m", title: "Duży obszar roboczy CAD (14 × 8.5 m)" },
                    { key: "extra", label: "22m", title: "Bardzo duży obszar CAD (22 × 12 m)" },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setWorkspacePreset(p.key)}
                    title={p.title}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                      workspacePreset === p.key
                        ? "bg-white text-[#0e7490] shadow-2xs"
                        : "text-[#64748b] hover:text-[#0b1220]"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="h-4 w-px bg-[#e3e7ee] mx-0.5" />

              {/* Przycisk Dopasuj do konstrukcji */}
              <button
                type="button"
                onClick={handleFitToConstructions}
                title="Dopasuj widok i wyśrodkuj konstrukcje w oknie"
                className="px-2 py-1 rounded bg-white text-[#0e7490] hover:bg-[#f0fdff] border border-[#a5f3fc] text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
              >
                <Focus size={12} />
                <span className="hidden md:inline">Dopasuj</span>
              </button>

              <span
                className="hidden xl:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono text-[#64748b] bg-slate-100 border border-[#e2e8f0]"
                title="Scroll = Płynny Zoom, LPM na wolnym polu lub Scroll-click = Przesuwanie (Łapka)"
              >
                Scroll: Zoom · Przeciągnij tło: Łapka
              </span>

              <button
                type="button"
                onClick={() =>
                  setZoom((z) => Math.max(0.15, Math.round((z - 0.15) * 100) / 100))
                }
                title="Oddal (Zoom out)"
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
                  setZoom((z) => Math.min(5, Math.round((z + 0.15) * 100) / 100))
                }
                title="Przybliż (Zoom in)"
                className="p-1.5 rounded bg-white text-[#4b5563] hover:text-[#0b1220] border border-[#d4dae3] cursor-pointer"
              >
                <ZoomIn size={13} />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                title="Widok 100% całego obszaru roboczego CAD"
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
          className={`relative flex-1 min-h-0 min-w-0 overflow-auto p-4 sm:p-8 bg-slate-200/80 ${
            dragState || isPanning
              ? "cursor-grabbing select-none"
              : "cursor-grab select-none"
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
              ref={svgRef}
              viewBox={`0 0 ${sheetWidth} ${sheetHeight}`}
              preserveAspectRatio="xMidYMid meet"
              className="block"
              style={{
                width: "100%",
                height: "100%",
                maxWidth: "100%",
                maxHeight: "100%",
                aspectRatio: `${sheetWidth} / ${sheetHeight}`,
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                cursor: dragState || isPanning ? "grabbing" : "grab",
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

                {/* Precyzyjna siatka inżynierska CAD (100mm, 500mm, 1000mm) */}
                <pattern
                  id="cadGrid100"
                  width="100"
                  height="100"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 100 0 L 0 0 0 100"
                    fill="none"
                    stroke="#f1f5f9"
                    strokeWidth="1"
                  />
                </pattern>
                <pattern
                  id="cadGrid500"
                  width="500"
                  height="500"
                  patternUnits="userSpaceOnUse"
                >
                  <rect width="500" height="500" fill="url(#cadGrid100)" />
                  <path
                    d="M 500 0 L 0 0 0 500"
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="1.5"
                    strokeOpacity="0.85"
                  />
                </pattern>
                <pattern
                  id="cadGrid1000"
                  width="1000"
                  height="1000"
                  patternUnits="userSpaceOnUse"
                >
                  <rect width="1000" height="1000" fill="url(#cadGrid500)" />
                  <path
                    d="M 1000 0 L 0 0 0 1000"
                    fill="none"
                    stroke="#cbd5e1"
                    strokeWidth="2.5"
                    strokeOpacity="0.75"
                  />
                </pattern>
              </defs>

              {/* Czyste białe tło wielkiego arkusza / przestrzeni roboczej CAD */}
              <rect
                x="0"
                y="0"
                width={sheetWidth}
                height={sheetHeight}
                fill="#ffffff"
                style={{
                  cursor: dragState
                    ? "grabbing"
                    : isPanning
                    ? "grabbing"
                    : "grab",
                }}
              />

              {/* Siatka techniczna CAD */}
              {showCadGrid && (
                <rect
                  x="0"
                  y="0"
                  width={sheetWidth}
                  height={sheetHeight}
                  fill="url(#cadGrid1000)"
                  pointerEvents="none"
                />
              )}

              {/* Ramka zewnętrzna przestrzeni roboczej CAD */}
              <rect
                x="0"
                y="0"
                width={sheetWidth}
                height={sheetHeight}
                fill="none"
                stroke="#94a3b8"
                strokeWidth="3"
                strokeDasharray="24 16"
              />

              {/* Wskaźnik układu współrzędnych CAD (WCS / UCS) w lewym dolnym rogu */}
              <g
                transform={`translate(180, ${sheetHeight - 180})`}
                pointerEvents="none"
                opacity={0.7}
              >
                <line
                  x1="0"
                  y1="0"
                  x2="150"
                  y2="0"
                  stroke="#ef4444"
                  strokeWidth="5"
                  markerEnd="url(#multiCadArrowEnd)"
                />
                <text
                  x="175"
                  y="12"
                  fill="#ef4444"
                  fontSize="36"
                  fontWeight="900"
                >
                  X
                </text>
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="-150"
                  stroke="#10b981"
                  strokeWidth="5"
                  markerEnd="url(#multiCadArrowEnd)"
                />
                <text
                  x="-6"
                  y="-175"
                  fill="#10b981"
                  fontSize="36"
                  fontWeight="900"
                  textAnchor="middle"
                >
                  Y
                </text>
                <circle cx="0" cy="0" r="8" fill="#0b1220" />
                <text
                  x="0"
                  y="55"
                  fill="#64748b"
                  fontSize="26"
                  fontWeight="800"
                  letterSpacing="2px"
                >
                  CAD MODEL SPACE [mm] · {workspacePreset.toUpperCase()}
                </text>
              </g>

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

                const floorStartX = Math.max(120, stackCursorX - 1800);
                const floorEndX = Math.min(
                  sheetWidth - 120,
                  stackCursorX + currentRowWidth + 1800
                );

                return (
                  <g key={`row-${renderRow.rowIndex}`}>
                    {/* Ciągła linia poziomu posadzki ±0.00 dla rzędu rozciągnięta w przestrzeni CAD */}
                    <line
                      x1={floorStartX}
                      y1={floorY + 4}
                      x2={floorEndX}
                      y2={floorY + 4}
                      stroke="#0e7490"
                      strokeWidth="3.5"
                      strokeDasharray="24 12"
                      strokeOpacity="0.75"
                    />
                    {/* Geodezyjny / architektoniczny znak rzędnej poziomu posadzki */}
                    <path
                      d={`M ${floorStartX} ${floorY + 4} l 28 -28 l -56 0 z`}
                      fill="#0e7490"
                      opacity="0.85"
                    />
                    <text
                      x={floorStartX + 40}
                      y={floorY - 6}
                      fill="#0e7490"
                      fontSize="34"
                      fontWeight="800"
                    >
                      {computedRows.length > 1
                        ? `RZĄD ${renderRow.rowIndex + 1} — ±0.00 POZIOM POSADZKI`
                        : `±0.00 POZIOM POSADZKI`}
                    </text>

                    {renderRow.stacks.map((stack, stackIndex) => {
                      const currentStackX = stackCursorX;
                      stackCursorX += stack.stackWidth + gapX;
                      let currentBaseY = floorY;
                      const stackRightX = currentStackX + stack.stackWidth;
                      const heightDimX = stackRightX + 90;

                      return (
                        <g key={`stack-${stack.rootItem._id}-${stackIndex}`}>
                          {stack.stackedItems.map((item, itemIdxInStack) => {
                            const width = Math.max(item.widthMm || 2880, 400);
                            const height = Math.max(item.heightMm || 2300, 400);
                            const panes = Math.max(item.panesCount || 3, 1);
                            const fill = item.fillType || "HART 10";
                            const isHovered = hoveredItemId === item._id;

                            const hasItemAbove =
                              itemIdxInStack < stack.stackedItems.length - 1;

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

                            const isTriangleRight =
                              isTriangle &&
                              (item.name.toLowerCase().includes("praw") ||
                                Boolean(item.shortName && item.shortName.toLowerCase().includes("praw")));

                            const slopeAngleDeg = Math.round(Math.atan2(height, width) * (180 / Math.PI) * 10) / 10;
                            const hypotenuseMm = Math.round(Math.sqrt(width * width + height * height));

                            // Precyzyjne obliczenia geometrii trójkąta (do zabudowy tarasu pod krokwie)
                            const tBot = 45; // wysokość dolnego PROFIL H
                            const tKrok = 50; // grubość belki krokwi dachowej
                            const tLeft = 45; // grubość pionowego słupka przyściennego
                            const tSub = 30; // grubość listwy montażowej podkrokwiowej

                            const yFloorPos = originY + height;
                            const yProfTop = yFloorPos - tBot;

                            const yKrokLeftTop = isTriangleRight ? Math.max(originY + 10, yProfTop - tKrok) : originY;
                            const yKrokLeftBot = isTriangleRight ? yProfTop : originY + tKrok;
                            const yKrokRightBot = isTriangleRight ? originY + tKrok : yProfTop;
                            const yKrokRightTop = isTriangleRight ? originY : Math.max(originY + 10, yProfTop - tKrok);

                            const yInnerTop = (isTriangleRight ? yKrokRightBot : yKrokLeftBot) + tSub;
                            const yInnerBot = yProfTop;
                            const xInnerLeft = originX + (isTriangleRight ? 0 : tLeft);
                            const xInnerRight = originX + width - (isTriangleRight ? tLeft : 0);

                            const mInner = Math.max(0.001, (yInnerBot - yInnerTop) / Math.max(1, xInnerRight - xInnerLeft));

                            const gMargin = 14; // szczelina montażowa szyby
                            const yGlassBot = yInnerBot - gMargin;
                            const yGlassTop = yInnerTop + gMargin;

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
                                className={
                                  dragState?.itemId === item._id || isPanning
                                    ? "cursor-grabbing select-none"
                                    : "cursor-grab select-none"
                                }
                                onMouseEnter={() => setHoveredItemId(item._id)}
                                onMouseLeave={() => setHoveredItemId(null)}
                                onPointerDown={(e) => handlePointerDownOnItem(e, item)}
                                opacity={dragState?.itemId === item._id ? 0.35 : 1}
                              >
                                {/* Podświetlenie interaktywne po najechaniu */}
                                {isHovered && (
                                  <rect
                                    x={originX - 70}
                                    y={originY - (hasItemAbove ? 20 : 220)}
                                    width={width + 240}
                                    height={height + (hasItemAbove ? 40 : 280)}
                                    rx="20"
                                    fill="#0e7490"
                                    fillOpacity="0.04"
                                    stroke="#0e7490"
                                    strokeWidth="4"
                                    strokeDasharray="12 8"
                                  />
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

                              {/* Górna belka skośna ramy */}
                              <polygon
                                points={`
                                  ${originX},${yKrokLeftTop}
                                  ${originX + width},${yKrokRightTop}
                                  ${originX + width},${yKrokRightBot}
                                  ${originX},${yKrokLeftBot}
                                `}
                                fill="#29323d"
                                stroke="#1e242b"
                                strokeWidth="2"
                              />

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

                              {/* Wypełnienie szklane trójkąta (odbicie lustrzane) */}
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



                              {/* Parametry wewnątrz trójkąta */}
                              <text
                                x={originX + width * (isTriangleRight ? 0.65 : 0.35)}
                                y={yGlassBot - 35}
                                fill="#0b1220"
                                fontSize="42"
                                fontWeight="900"
                                textAnchor="middle"
                              >
                                {fill}
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
                                      className="cursor-pointer hover:fill-[#0284c7]"
                                      onClick={(e) =>
                                        openDimEditor(e, item, "width")
                                      }
                                    >
                                      {glassW} × {glassH} mm
                                    </text>
                                  </g>
                                );
                              })}
                            </>
                          )}

                          {/* Linie wymiarowe (interaktywne kliknięcie zmienia wymiar) */}
                          {showDimensions && (
                            <g>
                              {isTriangle ? (
                                <>
                                  {/* Całkowity wymiar szerokości B */}
                                  <g
                                    className="cursor-pointer"
                                    onMouseEnter={() =>
                                      setHoveredDimKey(`${item._id}-width`)
                                    }
                                    onMouseLeave={() => setHoveredDimKey(null)}
                                    onClick={(e) =>
                                      openDimEditor(e, item, "width")
                                    }
                                  >
                                    {itemIdxInStack > 0 ? (
                                      // Gdy trójkąt stoi na innej konstrukcji: wymiar szerokości nad trójkątem
                                      <>
                                        <line
                                          x1={originX}
                                          y1={originY + height}
                                          x2={originX}
                                          y2={originY - 95}
                                          stroke="#64748b"
                                          strokeWidth="2"
                                          strokeDasharray="6 6"
                                        />
                                        <line
                                          x1={originX + width}
                                          y1={originY + height}
                                          x2={originX + width}
                                          y2={originY - 95}
                                          stroke="#64748b"
                                          strokeWidth="2"
                                          strokeDasharray="6 6"
                                        />
                                        <line
                                          x1={originX}
                                          y1={originY - 80}
                                          x2={originX + width}
                                          y2={originY - 80}
                                          stroke={
                                            hoveredDimKey === `${item._id}-width` ||
                                            (activeDimEdit?.itemId === item._id &&
                                              activeDimEdit?.mode === "width")
                                              ? "#0284c7"
                                              : "#0b1220"
                                          }
                                          strokeWidth={
                                            hoveredDimKey === `${item._id}-width` ||
                                            (activeDimEdit?.itemId === item._id &&
                                              activeDimEdit?.mode === "width")
                                              ? "5"
                                              : "3.5"
                                          }
                                          markerStart="url(#multiCadArrowStart)"
                                          markerEnd="url(#multiCadArrowEnd)"
                                        />
                                        <rect
                                          x={originX + width / 2 - 150}
                                          y={originY - 136}
                                          width={300}
                                          height={54}
                                          rx="10"
                                          fill={
                                            hoveredDimKey === `${item._id}-width` ||
                                            (activeDimEdit?.itemId === item._id &&
                                              activeDimEdit?.mode === "width")
                                              ? "#e0f2fe"
                                              : "#ffffff"
                                          }
                                          fillOpacity="0.95"
                                          stroke={
                                            hoveredDimKey === `${item._id}-width` ||
                                            (activeDimEdit?.itemId === item._id &&
                                              activeDimEdit?.mode === "width")
                                              ? "#0284c7"
                                              : "#cbd5e1"
                                          }
                                          strokeWidth={
                                            hoveredDimKey === `${item._id}-width` ||
                                            (activeDimEdit?.itemId === item._id &&
                                              activeDimEdit?.mode === "width")
                                              ? "2.5"
                                              : "1.5"
                                          }
                                        />
                                        <text
                                          x={originX + width / 2}
                                          y={originY - 96}
                                          fill={
                                            hoveredDimKey === `${item._id}-width` ||
                                            (activeDimEdit?.itemId === item._id &&
                                              activeDimEdit?.mode === "width")
                                              ? "#0369a1"
                                              : "#0b1220"
                                          }
                                          fontSize="46"
                                          fontWeight="900"
                                          textAnchor="middle"
                                        >
                                          B = {width}
                                        </text>
                                      </>
                                    ) : (
                                      // Gdy trójkąt stoi bezpośrednio na posadzce: wymiar szerokości na dole
                                      <>
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
                                          stroke={
                                            hoveredDimKey === `${item._id}-width` ||
                                            (activeDimEdit?.itemId === item._id &&
                                              activeDimEdit?.mode === "width")
                                              ? "#0284c7"
                                              : "#0b1220"
                                          }
                                          strokeWidth={
                                            hoveredDimKey === `${item._id}-width` ||
                                            (activeDimEdit?.itemId === item._id &&
                                              activeDimEdit?.mode === "width")
                                              ? "5"
                                              : "3.5"
                                          }
                                          markerStart="url(#multiCadArrowStart)"
                                          markerEnd="url(#multiCadArrowEnd)"
                                        />
                                        <rect
                                          x={originX + width / 2 - 150}
                                          y={originY + height + 66}
                                          width={300}
                                          height={54}
                                          rx="10"
                                          fill={
                                            hoveredDimKey === `${item._id}-width` ||
                                            (activeDimEdit?.itemId === item._id &&
                                              activeDimEdit?.mode === "width")
                                              ? "#e0f2fe"
                                              : "#ffffff"
                                          }
                                          fillOpacity="0.95"
                                          stroke={
                                            hoveredDimKey === `${item._id}-width` ||
                                            (activeDimEdit?.itemId === item._id &&
                                              activeDimEdit?.mode === "width")
                                              ? "#0284c7"
                                              : "#cbd5e1"
                                          }
                                          strokeWidth={
                                            hoveredDimKey === `${item._id}-width` ||
                                            (activeDimEdit?.itemId === item._id &&
                                              activeDimEdit?.mode === "width")
                                              ? "2.5"
                                              : "1.5"
                                          }
                                        />
                                        <text
                                          x={originX + width / 2}
                                          y={originY + height + 105}
                                          fill={
                                            hoveredDimKey === `${item._id}-width` ||
                                            (activeDimEdit?.itemId === item._id &&
                                              activeDimEdit?.mode === "width")
                                              ? "#0369a1"
                                              : "#0b1220"
                                          }
                                          fontSize="46"
                                          fontWeight="900"
                                          textAnchor="middle"
                                        >
                                          B = {width}
                                        </text>
                                      </>
                                    )}
                                  </g>

                                  {/* Całkowity wymiar wysokości H (przy słupku przyściennym) */}
                                  <g
                                    className="cursor-pointer"
                                    onMouseEnter={() =>
                                      setHoveredDimKey(`${item._id}-height`)
                                    }
                                    onMouseLeave={() => setHoveredDimKey(null)}
                                    onClick={(e) =>
                                      openDimEditor(e, item, "height")
                                    }
                                  >
                                    <line
                                      x1={isTriangleRight ? originX + width + 5 : originX - 5}
                                      y1={originY}
                                      x2={isTriangleRight ? heightDimX + 25 : originX - 75}
                                      y2={originY}
                                      stroke="#64748b"
                                      strokeWidth="2"
                                      strokeDasharray="6 6"
                                    />
                                    <line
                                      x1={isTriangleRight ? originX + width + 5 : originX - 5}
                                      y1={originY + height}
                                      x2={isTriangleRight ? heightDimX + 25 : originX - 75}
                                      y2={originY + height}
                                      stroke="#64748b"
                                      strokeWidth="2"
                                      strokeDasharray="6 6"
                                    />
                                    <line
                                      x1={isTriangleRight ? heightDimX : originX - 60}
                                      y1={originY}
                                      x2={isTriangleRight ? heightDimX : originX - 60}
                                      y2={originY + height}
                                      stroke={
                                        hoveredDimKey === `${item._id}-height` ||
                                        (activeDimEdit?.itemId === item._id &&
                                          activeDimEdit?.mode === "height")
                                          ? "#0284c7"
                                          : "#0b1220"
                                      }
                                      strokeWidth={
                                        hoveredDimKey === `${item._id}-height` ||
                                        (activeDimEdit?.itemId === item._id &&
                                          activeDimEdit?.mode === "height")
                                          ? "5"
                                          : "3.5"
                                      }
                                      markerStart="url(#multiCadArrowStart)"
                                      markerEnd="url(#multiCadArrowEnd)"
                                    />
                                    <g
                                      transform={
                                        isTriangleRight
                                          ? `translate(${heightDimX + 40}, ${originY + height / 2}) rotate(90)`
                                          : `translate(${originX - 96}, ${originY + height / 2}) rotate(-90)`
                                      }
                                    >
                                      <rect
                                        x={-150}
                                        y={-38}
                                        width={300}
                                        height={54}
                                        rx="10"
                                        fill={
                                          hoveredDimKey === `${item._id}-height` ||
                                          (activeDimEdit?.itemId === item._id &&
                                            activeDimEdit?.mode === "height")
                                            ? "#e0f2fe"
                                            : "#ffffff"
                                        }
                                        fillOpacity="0.95"
                                        stroke={
                                          hoveredDimKey === `${item._id}-height` ||
                                          (activeDimEdit?.itemId === item._id &&
                                            activeDimEdit?.mode === "height")
                                            ? "#0284c7"
                                            : "#cbd5e1"
                                        }
                                        strokeWidth={
                                          hoveredDimKey === `${item._id}-height` ||
                                          (activeDimEdit?.itemId === item._id &&
                                            activeDimEdit?.mode === "height")
                                            ? "2.5"
                                            : "1.5"
                                        }
                                      />
                                      <text
                                        x={0}
                                        y={4}
                                        fill={
                                          hoveredDimKey === `${item._id}-height` ||
                                          (activeDimEdit?.itemId === item._id &&
                                            activeDimEdit?.mode === "height")
                                            ? "#0369a1"
                                            : "#0b1220"
                                        }
                                        fontSize="46"
                                        fontWeight="900"
                                        textAnchor="middle"
                                      >
                                        H = {height}
                                      </text>
                                    </g>
                                  </g>

                                  {/* UKOŚNY WYMIAR BELKI SKOŚNEJ */}
                                  {(() => {
                                    const midBeamX = originX + width / 2;
                                    const midBeamY = (yKrokLeftTop + yKrokRightTop) / 2;
                                    const hypotenuseAngleDeg = isTriangleRight ? -slopeAngleDeg : slopeAngleDeg;
                                    return (
                                      <g
                                        transform={`translate(${midBeamX}, ${midBeamY}) rotate(${hypotenuseAngleDeg})`}
                                      >
                                        <rect
                                          x={-190}
                                          y={-62}
                                          width={380}
                                          height={46}
                                          rx="8"
                                          fill="#ffffff"
                                          fillOpacity="0.95"
                                          stroke="#cbd5e1"
                                          strokeWidth="1.5"
                                        />
                                        <text
                                          x={0}
                                          y={-39}
                                          fill="#0e7490"
                                          fontSize="32"
                                          fontWeight="900"
                                          textAnchor="middle"
                                          dominantBaseline="central"
                                        >
                                          L = {hypotenuseMm} mm (∠ {slopeAngleDeg}°)
                                        </text>
                                      </g>
                                    );
                                  })()}
                                </>
                              ) : (
                                <>
                                  {/* Wymiary poszczególnych kwater (gdy na samej górze lub pojedyncza) */}
                                  {!hasItemAbove &&
                                    segments.map((seg, idx) => {
                                      const segStartX = originX + (idx * width) / panes;
                                      const segEndX =
                                        originX + ((idx + 1) * width) / panes;
                                      const dimY = originY - 60;
                                      const segKey = `${item._id}-seg-${idx}`;
                                      const isSegActive =
                                        hoveredDimKey === segKey ||
                                        (activeDimEdit?.itemId === item._id &&
                                          activeDimEdit?.mode === "pane_width" &&
                                          activeDimEdit?.paneIndex === idx);

                                      return (
                                        <g
                                          key={idx}
                                          className="cursor-pointer"
                                          onMouseEnter={() =>
                                            setHoveredDimKey(segKey)
                                          }
                                          onMouseLeave={() =>
                                            setHoveredDimKey(null)
                                          }
                                          onClick={(e) =>
                                            openDimEditor(
                                              e,
                                              item,
                                              "pane_width",
                                              idx
                                            )
                                          }
                                        >
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
                                            stroke={
                                              isSegActive ? "#0284c7" : "#0b1220"
                                            }
                                            strokeWidth={isSegActive ? "4.5" : "3"}
                                            markerStart="url(#multiCadArrowStart)"
                                            markerEnd="url(#multiCadArrowEnd)"
                                          />
                                          <rect
                                            x={(segStartX + segEndX) / 2 - 80}
                                            y={dimY - 54}
                                            width={160}
                                            height={46}
                                            rx="8"
                                            fill={
                                              isSegActive ? "#e0f2fe" : "#ffffff"
                                            }
                                            fillOpacity="0.95"
                                            stroke={
                                              isSegActive ? "#0284c7" : "#cbd5e1"
                                            }
                                            strokeWidth={isSegActive ? "2" : "1"}
                                          />
                                          <text
                                            x={(segStartX + segEndX) / 2}
                                            y={dimY - 18}
                                            fill={
                                              isSegActive ? "#0369a1" : "#0b1220"
                                            }
                                            fontSize="40"
                                            fontWeight="800"
                                            textAnchor="middle"
                                          >
                                            {seg.widthMm}
                                          </text>
                                        </g>
                                      );
                                    })}

                                  {/* Wymiary poszczególnych kwater dla konstrukcji dolnej (pod posadzką, aby nie kolidowały z konstrukcją powyżej) */}
                                  {hasItemAbove && itemIdxInStack === 0 &&
                                    segments.map((seg, idx) => {
                                      const segStartX = originX + (idx * width) / panes;
                                      const segEndX =
                                        originX + ((idx + 1) * width) / panes;
                                      const dimY = floorY + 70;
                                      const segKey = `${item._id}-seg-${idx}`;
                                      const isSegActive =
                                        hoveredDimKey === segKey ||
                                        (activeDimEdit?.itemId === item._id &&
                                          activeDimEdit?.mode === "pane_width" &&
                                          activeDimEdit?.paneIndex === idx);

                                      return (
                                        <g
                                          key={`bottom-seg-${idx}`}
                                          className="cursor-pointer"
                                          onMouseEnter={() =>
                                            setHoveredDimKey(segKey)
                                          }
                                          onMouseLeave={() =>
                                            setHoveredDimKey(null)
                                          }
                                          onClick={(e) =>
                                            openDimEditor(
                                              e,
                                              item,
                                              "pane_width",
                                              idx
                                            )
                                          }
                                        >
                                          <line
                                            x1={segStartX}
                                            y1={floorY + 4}
                                            x2={segStartX}
                                            y2={dimY + 16}
                                            stroke="#64748b"
                                            strokeWidth="2"
                                            strokeDasharray="6 6"
                                          />
                                          <line
                                            x1={segEndX}
                                            y1={floorY + 4}
                                            x2={segEndX}
                                            y2={dimY + 16}
                                            stroke="#64748b"
                                            strokeWidth="2"
                                            strokeDasharray="6 6"
                                          />
                                          <line
                                            x1={segStartX}
                                            y1={dimY}
                                            x2={segEndX}
                                            y2={dimY}
                                            stroke={
                                              isSegActive ? "#0284c7" : "#0b1220"
                                            }
                                            strokeWidth={isSegActive ? "4.5" : "3"}
                                            markerStart="url(#multiCadArrowStart)"
                                            markerEnd="url(#multiCadArrowEnd)"
                                          />
                                          <rect
                                            x={(segStartX + segEndX) / 2 - 80}
                                            y={dimY + 8}
                                            width={160}
                                            height={46}
                                            rx="8"
                                            fill={
                                              isSegActive ? "#e0f2fe" : "#ffffff"
                                            }
                                            fillOpacity="0.95"
                                            stroke={
                                              isSegActive ? "#0284c7" : "#cbd5e1"
                                            }
                                            strokeWidth={isSegActive ? "2" : "1"}
                                          />
                                          <text
                                            x={(segStartX + segEndX) / 2}
                                            y={dimY + 44}
                                            fill={
                                              isSegActive ? "#0369a1" : "#0b1220"
                                            }
                                            fontSize="40"
                                            fontWeight="800"
                                            textAnchor="middle"
                                          >
                                            {seg.widthMm}
                                          </text>
                                        </g>
                                      );
                                    })}

                                  {/* Całkowita szerokość na górze (gdy na samej górze lub pojedyncza) */}
                                  {!hasItemAbove && (
                                    <g
                                      className="cursor-pointer"
                                      onMouseEnter={() =>
                                        setHoveredDimKey(`${item._id}-width`)
                                      }
                                      onMouseLeave={() => setHoveredDimKey(null)}
                                      onClick={(e) =>
                                        openDimEditor(e, item, "width")
                                      }
                                    >
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
                                        stroke={
                                          hoveredDimKey === `${item._id}-width` ||
                                          (activeDimEdit?.itemId === item._id &&
                                            activeDimEdit?.mode === "width")
                                            ? "#0284c7"
                                            : "#0b1220"
                                        }
                                        strokeWidth={
                                          hoveredDimKey === `${item._id}-width` ||
                                          (activeDimEdit?.itemId === item._id &&
                                            activeDimEdit?.mode === "width")
                                            ? "5"
                                            : "3.5"
                                        }
                                        markerStart="url(#multiCadArrowStart)"
                                        markerEnd="url(#multiCadArrowEnd)"
                                      />
                                      <rect
                                        x={originX + width / 2 - 110}
                                        y={originY - 196}
                                        width={220}
                                        height={54}
                                        rx="10"
                                        fill={
                                          hoveredDimKey === `${item._id}-width` ||
                                          (activeDimEdit?.itemId === item._id &&
                                            activeDimEdit?.mode === "width")
                                            ? "#e0f2fe"
                                            : "#ffffff"
                                        }
                                        fillOpacity="0.95"
                                        stroke={
                                          hoveredDimKey === `${item._id}-width` ||
                                          (activeDimEdit?.itemId === item._id &&
                                            activeDimEdit?.mode === "width")
                                            ? "#0284c7"
                                            : "#cbd5e1"
                                        }
                                        strokeWidth={
                                          hoveredDimKey === `${item._id}-width` ||
                                          (activeDimEdit?.itemId === item._id &&
                                            activeDimEdit?.mode === "width")
                                            ? "2.5"
                                            : "1.5"
                                        }
                                      />
                                      <text
                                        x={originX + width / 2}
                                        y={originY - 154}
                                        fill={
                                          hoveredDimKey === `${item._id}-width` ||
                                          (activeDimEdit?.itemId === item._id &&
                                            activeDimEdit?.mode === "width")
                                          ? "#0369a1"
                                          : "#0b1220"
                                        }
                                        fontSize="48"
                                        fontWeight="900"
                                        textAnchor="middle"
                                      >
                                        {width}
                                      </text>
                                    </g>
                                  )}

                                  {/* Całkowita szerokość na dole pod posadzką (dla konstrukcji dolnej gdy ma inną nad sobą) */}
                                  {hasItemAbove && itemIdxInStack === 0 && (
                                    <g
                                      className="cursor-pointer"
                                      onMouseEnter={() =>
                                        setHoveredDimKey(`${item._id}-width`)
                                      }
                                      onMouseLeave={() => setHoveredDimKey(null)}
                                      onClick={(e) =>
                                        openDimEditor(e, item, "width")
                                      }
                                    >
                                      <line
                                        x1={originX}
                                        y1={floorY + 4}
                                        x2={originX}
                                        y2={floorY + 185}
                                        stroke="#64748b"
                                        strokeWidth="2.5"
                                        strokeDasharray="6 6"
                                      />
                                      <line
                                        x1={originX + width}
                                        y1={floorY + 4}
                                        x2={originX + width}
                                        y2={floorY + 185}
                                        stroke="#64748b"
                                        strokeWidth="2.5"
                                        strokeDasharray="6 6"
                                      />
                                      <line
                                        x1={originX}
                                        y1={floorY + 165}
                                        x2={originX + width}
                                        y2={floorY + 165}
                                        stroke={
                                          hoveredDimKey === `${item._id}-width` ||
                                          (activeDimEdit?.itemId === item._id &&
                                            activeDimEdit?.mode === "width")
                                            ? "#0284c7"
                                            : "#0b1220"
                                        }
                                        strokeWidth={
                                          hoveredDimKey === `${item._id}-width` ||
                                          (activeDimEdit?.itemId === item._id &&
                                            activeDimEdit?.mode === "width")
                                            ? "5"
                                            : "3.5"
                                        }
                                        markerStart="url(#multiCadArrowStart)"
                                        markerEnd="url(#multiCadArrowEnd)"
                                      />
                                      <rect
                                        x={originX + width / 2 - 110}
                                        y={floorY + 173}
                                        width={220}
                                        height={54}
                                        rx="10"
                                        fill={
                                          hoveredDimKey === `${item._id}-width` ||
                                          (activeDimEdit?.itemId === item._id &&
                                            activeDimEdit?.mode === "width")
                                            ? "#e0f2fe"
                                            : "#ffffff"
                                        }
                                        fillOpacity="0.95"
                                        stroke={
                                          hoveredDimKey === `${item._id}-width` ||
                                          (activeDimEdit?.itemId === item._id &&
                                            activeDimEdit?.mode === "width")
                                            ? "#0284c7"
                                            : "#cbd5e1"
                                        }
                                        strokeWidth={
                                          hoveredDimKey === `${item._id}-width` ||
                                          (activeDimEdit?.itemId === item._id &&
                                            activeDimEdit?.mode === "width")
                                            ? "2.5"
                                            : "1.5"
                                        }
                                      />
                                      <text
                                        x={originX + width / 2}
                                        y={floorY + 215}
                                        fill={
                                          hoveredDimKey === `${item._id}-width` ||
                                          (activeDimEdit?.itemId === item._id &&
                                            activeDimEdit?.mode === "width")
                                          ? "#0369a1"
                                          : "#0b1220"
                                        }
                                        fontSize="48"
                                        fontWeight="900"
                                        textAnchor="middle"
                                      >
                                        {width}
                                      </text>
                                    </g>
                                  )}

                                  {/* Całkowita wysokość wyrównana w linii całego stosu (heightDimX) */}
                                  <g
                                    className="cursor-pointer"
                                    onMouseEnter={() =>
                                      setHoveredDimKey(`${item._id}-height`)
                                    }
                                    onMouseLeave={() => setHoveredDimKey(null)}
                                    onClick={(e) =>
                                      openDimEditor(e, item, "height")
                                    }
                                  >
                                    <line
                                      x1={originX + width + 5}
                                      y1={originY}
                                      x2={heightDimX + 25}
                                      y2={originY}
                                      stroke="#64748b"
                                      strokeWidth="2.5"
                                      strokeDasharray="6 6"
                                    />
                                    <line
                                      x1={originX + width + 5}
                                      y1={originY + height}
                                      x2={heightDimX + 25}
                                      y2={originY + height}
                                      stroke="#64748b"
                                      strokeWidth="2.5"
                                      strokeDasharray="6 6"
                                    />
                                    <line
                                      x1={heightDimX}
                                      y1={originY}
                                      x2={heightDimX}
                                      y2={originY + height}
                                      stroke={
                                        hoveredDimKey === `${item._id}-height` ||
                                        (activeDimEdit?.itemId === item._id &&
                                          activeDimEdit?.mode === "height")
                                          ? "#0284c7"
                                          : "#0b1220"
                                      }
                                      strokeWidth={
                                        hoveredDimKey === `${item._id}-height` ||
                                        (activeDimEdit?.itemId === item._id &&
                                          activeDimEdit?.mode === "height")
                                          ? "5"
                                          : "3.5"
                                      }
                                      markerStart="url(#multiCadArrowStart)"
                                      markerEnd="url(#multiCadArrowEnd)"
                                    />
                                    <g
                                      transform={`translate(${heightDimX + 40}, ${originY + height / 2}) rotate(90)`}
                                    >
                                      <rect
                                        x={-110}
                                        y={-38}
                                        width={220}
                                        height={54}
                                        rx="10"
                                        fill={
                                          hoveredDimKey === `${item._id}-height` ||
                                          (activeDimEdit?.itemId === item._id &&
                                            activeDimEdit?.mode === "height")
                                            ? "#e0f2fe"
                                            : "#ffffff"
                                        }
                                        fillOpacity="0.95"
                                        stroke={
                                          hoveredDimKey === `${item._id}-height` ||
                                          (activeDimEdit?.itemId === item._id &&
                                            activeDimEdit?.mode === "height")
                                            ? "#0284c7"
                                            : "#cbd5e1"
                                        }
                                        strokeWidth={
                                          hoveredDimKey === `${item._id}-height` ||
                                          (activeDimEdit?.itemId === item._id &&
                                            activeDimEdit?.mode === "height")
                                            ? "2.5"
                                            : "1.5"
                                        }
                                      />
                                      <text
                                        x={0}
                                        y={4}
                                        fill={
                                          hoveredDimKey === `${item._id}-height` ||
                                          (activeDimEdit?.itemId === item._id &&
                                            activeDimEdit?.mode === "height")
                                            ? "#0369a1"
                                            : "#0b1220"
                                        }
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
                      );
                    })}


                  </g>
                );
              })}
            </g>
          );
        })}

              {/* ── Wizualizacje slotów upuszczenia (Drag & Drop targets) ── */}
              {dragState && (() => {
                const draggedItem = effectiveItems.find(
                  (it) => it._id === dragState.itemId
                );
                if (!draggedItem) return null;

                return (
                  <g
                    id="cad-drag-and-drop-targets"
                    className="pointer-events-none select-none"
                  >
                    {/* 1. Sloty pomiędzy kolumnami i na końcach rzędów */}
                    {sheetGeometry.rowInfos.map((rInfo) => (
                      <g key={`drop-row-${rInfo.rowIndex}`}>
                        {rInfo.slots.map((slot) => {
                          const isTarget =
                            activeDropTarget?.type === "slot" &&
                            activeDropTarget.rowIndex === rInfo.rowIndex &&
                            activeDropTarget.slotIndex === slot.slotIndex;

                          const slotX = slot.centerX;
                          const topY = rInfo.floorY - rInfo.maxStackHeight - 60;
                          const barH = rInfo.maxStackHeight + 60;

                          return (
                            <g key={`slot-${rInfo.rowIndex}-${slot.slotIndex}`}>
                              {/* Linia slotu */}
                              <line
                                x1={slotX}
                                y1={topY}
                                x2={slotX}
                                y2={rInfo.floorY}
                                stroke={isTarget ? "#4ABBC3" : "#cbd5e1"}
                                strokeWidth={isTarget ? "6" : "2.5"}
                                strokeDasharray={isTarget ? "none" : "8 8"}
                                strokeOpacity={isTarget ? 0.95 : 0.45}
                              />

                              {/* Aktywne podświetlenie wybranego slotu */}
                              {isTarget && (
                                <g>
                                  {/* Poświata slotu */}
                                  <rect
                                    x={slotX - 24}
                                    y={topY}
                                    width="48"
                                    height={barH}
                                    rx="12"
                                    fill="#4ABBC3"
                                    fillOpacity="0.2"
                                  />

                                  {/* Sylwetka podglądu konstrukcji na posadzce */}
                                  <rect
                                    x={slotX - (draggedItem.widthMm || 2880) / 2}
                                    y={rInfo.floorY - (draggedItem.heightMm || 2300)}
                                    width={draggedItem.widthMm || 2880}
                                    height={draggedItem.heightMm || 2300}
                                    rx="10"
                                    fill="#0e7490"
                                    fillOpacity="0.1"
                                    stroke="#4ABBC3"
                                    strokeWidth="4"
                                    strokeDasharray="14 8"
                                  />

                                  {/* Znacznik UPUŚĆ TUTAJ */}
                                  <g
                                    transform={`translate(${slotX}, ${
                                      rInfo.floorY - barH / 2
                                    })`}
                                  >
                                    <rect
                                      x="-200"
                                      y="-40"
                                      width="400"
                                      height="80"
                                      rx="18"
                                      fill="#0e7490"
                                      stroke="#4ABBC3"
                                      strokeWidth="3.5"
                                    />
                                    <text
                                      x="0"
                                      y="12"
                                      fill="#ffffff"
                                      fontSize="30"
                                      fontWeight="900"
                                      textAnchor="middle"
                                      letterSpacing="1px"
                                    >
                                      ↓ UPUŚĆ TUTAJ
                                    </text>
                                  </g>
                                </g>
                              )}

                              {/* Dysk wskaźnika slotu, gdy nie jest najechany */}
                              {!isTarget && (
                                <g
                                  transform={`translate(${slotX}, ${
                                    rInfo.floorY - barH / 2
                                  })`}
                                >
                                  <circle
                                    cx="0"
                                    cy="0"
                                    r="22"
                                    fill="#f8fafc"
                                    stroke="#94a3b8"
                                    strokeWidth="2.5"
                                    strokeDasharray="5 5"
                                  />
                                  <text
                                    x="0"
                                    y="8"
                                    fill="#64748b"
                                    fontSize="24"
                                    fontWeight="900"
                                    textAnchor="middle"
                                  >
                                    +
                                  </text>
                                </g>
                              )}
                            </g>
                          );
                        })}
                      </g>
                    ))}

                    {/* 2. Cel: Umieszczenie NAD inną konstrukcją */}
                    {activeDropTarget?.type === "above" && (() => {
                      const targetBox = sheetGeometry.itemBoxes.find(
                        (b) => b.itemId === activeDropTarget.targetItemId
                      );
                      if (!targetBox) return null;

                      const w = draggedItem.widthMm || 2880;
                      const h = draggedItem.heightMm || 2300;
                      const aboveX = targetBox.originX + (targetBox.width - w) / 2;
                      const aboveY = targetBox.originY - h;

                      return (
                        <g>
                          {/* Podświetlenie docelowej konstrukcji bazowej pod spodem */}
                          <rect
                            x={targetBox.originX - 14}
                            y={targetBox.originY - 14}
                            width={targetBox.width + 28}
                            height={targetBox.height + 28}
                            rx="14"
                            fill="#0e7490"
                            fillOpacity="0.08"
                            stroke="#10b981"
                            strokeWidth="5"
                            strokeDasharray="16 10"
                          />

                          {/* Sylwetka nowej konstrukcji nad nią */}
                          <rect
                            x={aboveX}
                            y={aboveY}
                            width={w}
                            height={h}
                            rx="12"
                            fill="#10b981"
                            fillOpacity="0.14"
                            stroke="#10b981"
                            strokeWidth="4.5"
                            strokeDasharray="14 8"
                          />

                          {/* Etykieta potwierdzenia */}
                          <g
                            transform={`translate(${
                              targetBox.originX + targetBox.width / 2
                            }, ${aboveY + h / 2})`}
                          >
                            <rect
                              x="-340"
                              y="-44"
                              width="680"
                              height="88"
                              rx="20"
                              fill="#065f46"
                              stroke="#34d399"
                              strokeWidth="4"
                            />
                            <text
                              x="0"
                              y="12"
                              fill="#ffffff"
                              fontSize="28"
                              fontWeight="900"
                              textAnchor="middle"
                              letterSpacing="1px"
                            >
                              ▲ UPUŚĆ: UMIEŚĆ NAD POZ. {activeDropTarget.targetPosIndex}
                            </text>
                          </g>
                        </g>
                      );
                    })()}

                    {/* 3. Cel: Nowy rząd poniżej */}
                    {(() => {
                      const maxFloorY = Math.max(
                        ...sheetGeometry.rowInfos.map((r) => r.floorY),
                        sheetPadTop + 1000
                      );
                      const isTarget = activeDropTarget?.type === "new-row";
                      const newRowY = maxFloorY + 120;
                      const newRowW = Math.max(sheetWidth - 200, 1600);
                      const newRowX = (sheetWidth - newRowW) / 2;

                      return (
                        <g>
                          <rect
                            x={newRowX}
                            y={newRowY}
                            width={newRowW}
                            height="160"
                            rx="20"
                            fill={isTarget ? "#0e7490" : "#f8fafc"}
                            fillOpacity={isTarget ? 0.16 : 0.6}
                            stroke={isTarget ? "#4ABBC3" : "#cbd5e1"}
                            strokeWidth={isTarget ? "4.5" : "2"}
                            strokeDasharray={isTarget ? "16 8" : "12 8"}
                          />
                          <text
                            x={sheetWidth / 2}
                            y={newRowY + 95}
                            fill={isTarget ? "#0e7490" : "#64748b"}
                            fontSize="34"
                            fontWeight="900"
                            textAnchor="middle"
                            letterSpacing="2px"
                          >
                            {isTarget
                              ? "+ UPUŚĆ TUTAJ, ABY UTWORZYĆ NOWY RZĄD PONIŻEJ"
                              : "+ PRZECIĄGNIJ TUTAJ, ABY UTWORZYĆ NOWY RZĄD PONIŻEJ"}
                          </text>
                        </g>
                      );
                    })()}
                  </g>
                );
              })()}
            </svg>
          </div>
        </div>
      ) : (
        /* ── TRYB 2: SIATKA KART CAD (Każda konstrukcja w czytelnej karcie z rysunkiem CAD) ── */
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-[1600px] mx-auto">
            {effectiveItems.map((item) => {
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

              const isTriangleRightCard =
                isTriangle &&
                (item.name.toLowerCase().includes("praw") ||
                  Boolean(item.shortName && item.shortName.toLowerCase().includes("praw")));

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

              const yKrokLeftTopCard = isTriangleRightCard ? Math.max(padTop + 10, yProfTopCard - tKrok) : padTop;
              const yKrokLeftBotCard = isTriangleRightCard ? yProfTopCard : padTop + tKrok;
              const yKrokRightBotCard = isTriangleRightCard ? padTop + tKrok : yProfTopCard;
              const yKrokRightTopCard = isTriangleRightCard ? padTop : Math.max(padTop + 10, yProfTopCard - tKrok);

              const yInnerTopCard = (isTriangleRightCard ? yKrokRightBotCard : yKrokLeftBotCard) + tSub;
              const yInnerBotCard = yProfTopCard;
              const xInnerLeftCard = padLeft + (isTriangleRightCard ? 0 : tLeft);
              const xInnerRightCard = padLeft + width - (isTriangleRightCard ? tLeft : 0);

              const mInnerCard = Math.max(0.001, (yInnerBotCard - yInnerTopCard) / Math.max(1, xInnerRightCard - xInnerLeftCard));

              const gMarginCard = 14;
              const yGlassBotCard = yInnerBotCard - gMarginCard;
              const yGlassTopCard = yInnerTopCard + gMarginCard;

              const xGlassLeftCard = isTriangleRightCard
                ? Math.round(Math.max(padLeft + 40, (padLeft + width - tLeft - gMarginCard) - (yGlassBotCard - yGlassTopCard) / mInnerCard))
                : xInnerLeftCard + gMarginCard;
              const xGlassRightCard = isTriangleRightCard
                ? padLeft + width - tLeft - gMarginCard
                : Math.round(
                    Math.min(
                      padLeft + width - 40,
                      Math.max(xInnerLeftCard + gMarginCard + 50, xInnerLeftCard + (yGlassBotCard - gMarginCard - yInnerTopCard) / mInnerCard)
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
                          <button
                            type="button"
                            onClick={(e) => openDimEditor(e, item, "width")}
                            className="px-1.5 py-0.5 rounded bg-sky-50 hover:bg-sky-100 text-[#0284c7] border border-sky-200 font-bold transition-colors cursor-pointer"
                            title="Kliknij, aby zmienić wymiar konstrukcji"
                          >
                            {width} × {height} mm
                          </button>
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
                          {/* Pionowy słupek przyścienny */}
                          <rect
                            x={isTriangleRightCard ? padLeft + width - tLeft : padLeft}
                            y={isTriangleRightCard ? yKrokRightBotCard : yKrokLeftBotCard}
                            width={tLeft}
                            height={yProfTopCard - (isTriangleRightCard ? yKrokRightBotCard : yKrokLeftBotCard)}
                            fill="#29323d"
                            stroke="#1e242b"
                            strokeWidth="1.5"
                          />
                          {/* Belka skośna ramy */}
                          <polygon
                            points={`
                              ${padLeft},${yKrokLeftTopCard}
                              ${padLeft + width},${yKrokRightTopCard}
                              ${padLeft + width},${yKrokRightBotCard}
                              ${padLeft},${yKrokLeftBotCard}
                            `}
                            fill="#29323d"
                            stroke="#1e242b"
                            strokeWidth="2"
                          />
                          {/* Podkrokiew / listwa montażowa ramy */}
                          <polygon
                            points={
                              isTriangleRightCard
                                ? `${padLeft},${yKrokLeftBotCard} ${padLeft + width},${yKrokRightBotCard} ${padLeft + width - tLeft},${yInnerTopCard}`
                                : `${padLeft},${yKrokLeftBotCard} ${padLeft + width},${yKrokRightBotCard} ${padLeft + tLeft},${yInnerTopCard}`
                            }
                            fill="#29323d"
                            stroke="#1e242b"
                            strokeWidth="1.5"
                          />
                          {/* Szkło */}
                          <polygon
                            points={
                              isTriangleRightCard
                                ? `
                                  ${xGlassRightCard},${yGlassTopCard}
                                  ${xGlassRightCard},${yGlassBotCard}
                                  ${xGlassLeftCard},${yGlassBotCard}
                                `
                                : `
                                  ${xGlassLeftCard},${yGlassTopCard}
                                  ${xGlassRightCard},${yGlassBotCard}
                                  ${xGlassLeftCard},${yGlassBotCard}
                                `
                            }
                            fill="#ffffff"
                            stroke="#38bdf8"
                            strokeWidth="2"
                          />

                          <text
                            x={padLeft + width * (isTriangleRightCard ? 0.65 : 0.35)}
                            y={yGlassBotCard - 35}
                            fill="#0b1220"
                            fontSize="42"
                            fontWeight="900"
                            textAnchor="middle"
                          >
                            {fill}
                          </text>

                          {showDimensions && (
                            <g>
                              <g
                                className="cursor-pointer"
                                onClick={(e) => openDimEditor(e, item, "width")}
                              >
                                <line
                                  x1={padLeft}
                                  y1={padTop - 130}
                                  x2={padLeft + width}
                                  y2={padTop - 130}
                                  stroke="#0b1220"
                                  strokeWidth="3.5"
                                />
                                <rect
                                  x={padLeft + width / 2 - 110}
                                  y={padTop - 186}
                                  width={220}
                                  height={54}
                                  rx="10"
                                  fill="#ffffff"
                                  stroke="#cbd5e1"
                                  strokeWidth="1.5"
                                />
                                <text
                                  x={padLeft + width / 2}
                                  y={padTop - 144}
                                  fill="#0b1220"
                                  fontSize="48"
                                  fontWeight="900"
                                  textAnchor="middle"
                                >
                                  {width}
                                </text>
                              </g>
                              <g
                                className="cursor-pointer"
                                onClick={(e) => openDimEditor(e, item, "height")}
                              >
                                <line
                                  x1={padLeft + width + 80}
                                  y1={padTop}
                                  x2={padLeft + width + 80}
                                  y2={padTop + height}
                                  stroke="#0b1220"
                                  strokeWidth="3.5"
                                />
                                <g
                                  transform={`translate(${padLeft + width + 115}, ${padTop + height / 2}) rotate(90)`}
                                >
                                  <rect
                                    x={-110}
                                    y={-38}
                                    width={220}
                                    height={54}
                                    rx="10"
                                    fill="#ffffff"
                                    stroke="#cbd5e1"
                                    strokeWidth="1.5"
                                  />
                                  <text
                                    x={0}
                                    y={4}
                                    fill="#0b1220"
                                    fontSize="48"
                                    fontWeight="900"
                                    textAnchor="middle"
                                  >
                                    {height}
                                  </text>
                                </g>
                              </g>
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
                                  className="cursor-pointer hover:fill-[#0284c7]"
                                  onClick={(e) =>
                                    openDimEditor(e, item, "width")
                                  }
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
                                  <g
                                    key={idx}
                                    className="cursor-pointer"
                                    onClick={(e) =>
                                      openDimEditor(e, item, "pane_width", idx)
                                    }
                                  >
                                    <line
                                      x1={segStartX}
                                      y1={dimY}
                                      x2={segEndX}
                                      y2={dimY}
                                      stroke="#0b1220"
                                      strokeWidth="3"
                                    />
                                    <rect
                                      x={(segStartX + segEndX) / 2 - 80}
                                      y={dimY - 52}
                                      width={160}
                                      height={44}
                                      rx="8"
                                      fill="#ffffff"
                                      stroke="#cbd5e1"
                                      strokeWidth="1"
                                    />
                                    <text
                                      x={(segStartX + segEndX) / 2}
                                      y={dimY - 16}
                                      fill="#0b1220"
                                      fontSize="40"
                                      fontWeight="800"
                                      textAnchor="middle"
                                    >
                                      {seg.widthMm}
                                    </text>
                                  </g>
                                );
                              })}
                              <g
                                className="cursor-pointer"
                                onClick={(e) => openDimEditor(e, item, "width")}
                              >
                                <line
                                  x1={padLeft}
                                  y1={padTop - 130}
                                  x2={padLeft + width}
                                  y2={padTop - 130}
                                  stroke="#0b1220"
                                  strokeWidth="3.5"
                                />
                                <rect
                                  x={padLeft + width / 2 - 110}
                                  y={padTop - 186}
                                  width={220}
                                  height={54}
                                  rx="10"
                                  fill="#ffffff"
                                  stroke="#cbd5e1"
                                  strokeWidth="1.5"
                                />
                                <text
                                  x={padLeft + width / 2}
                                  y={padTop - 144}
                                  fill="#0b1220"
                                  fontSize="48"
                                  fontWeight="900"
                                  textAnchor="middle"
                                >
                                  {width}
                                </text>
                              </g>
                              <g
                                className="cursor-pointer"
                                onClick={(e) => openDimEditor(e, item, "height")}
                              >
                                <line
                                  x1={padLeft + width + 80}
                                  y1={padTop}
                                  x2={padLeft + width + 80}
                                  y2={padTop + height}
                                  stroke="#0b1220"
                                  strokeWidth="3.5"
                                />
                                <g
                                  transform={`translate(${padLeft + width + 115}, ${padTop + height / 2}) rotate(90)`}
                                >
                                  <rect
                                    x={-110}
                                    y={-38}
                                    width={220}
                                    height={54}
                                    rx="10"
                                    fill="#ffffff"
                                    stroke="#cbd5e1"
                                    strokeWidth="1.5"
                                  />
                                  <text
                                    x={0}
                                    y={4}
                                    fill="#0b1220"
                                    fontSize="48"
                                    fontWeight="900"
                                    textAnchor="middle"
                                  >
                                    {height}
                                  </text>
                                </g>
                              </g>
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



      {/* ── Pływający edytor wymiaru CAD (Dynamic Input po kliknięciu wymiaru) ── */}
      {activeDimEdit && (() => {
        const targetItem = effectiveItems.find(
          (it) => it._id === activeDimEdit.itemId
        );
        if (!targetItem) return null;

        const targetPanes = Math.max(targetItem.panesCount || 3, 1);
        const targetWidth = Math.max(targetItem.widthMm || 2880, 400);
        const targetHeight = Math.max(targetItem.heightMm || 2300, 400);

        const popX =
          typeof window !== "undefined"
            ? Math.min(window.innerWidth - 290, Math.max(16, activeDimEdit.x - 135))
            : 200;
        const popY =
          typeof window !== "undefined"
            ? Math.min(window.innerHeight - 230, Math.max(16, activeDimEdit.y + 12))
            : 200;

        const parsedPreview = Math.round(Number(activeDimEdit.value));
        const isValidPreview =
          Number.isFinite(parsedPreview) && parsedPreview > 0;
        const previewTotalWidth =
          activeDimEdit.mode === "pane_width" && isValidPreview
            ? Math.min(12000, Math.max(400, parsedPreview * targetPanes))
            : activeDimEdit.mode === "width" && isValidPreview
            ? Math.min(12000, Math.max(400, parsedPreview))
            : targetWidth;

        return (
          <div
            className="fixed inset-0 z-50 bg-[#0b1220]/15 backdrop-blur-[0.5px]"
            onClick={() => setActiveDimEdit(null)}
          >
            <div
              style={{
                position: "fixed",
                left: `${popX}px`,
                top: `${popY}px`,
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-[270px] bg-white rounded-xl shadow-2xl border-2 border-[#0284c7] p-3 text-[#0b1220] animate-in fade-in zoom-in-95 duration-100 space-y-2.5"
            >
              {/* Nagłówek */}
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#0b1220] text-[#4ABBC3] shrink-0">
                    Poz. {targetItem.positionIndex}
                  </span>
                  <span className="text-xs font-bold text-slate-900 truncate">
                    {activeDimEdit.mode === "width"
                      ? "Szerokość całkowita (B)"
                      : activeDimEdit.mode === "height"
                      ? "Wysokość całkowita (H)"
                      : `Szerokość skrzydła na torze #${(activeDimEdit.paneIndex ?? 0) + 1}`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDimEdit(null)}
                  className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors cursor-pointer shrink-0"
                  title="Zamknij (Esc)"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Pole wprowadzania */}
              <div>
                <div className="relative flex items-center">
                  <input
                    ref={dimInputRef}
                    type="number"
                    min={150}
                    max={12000}
                    step={10}
                    value={activeDimEdit.value ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDraftDimValue(val);
                      setActiveDimEdit((prev) =>
                        prev ? { ...prev, value: val } : null
                      );
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleApplyDimension(activeDimEdit.value);
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setActiveDimEdit(null);
                      }
                    }}
                    className="w-full px-3 py-2 pr-12 rounded-lg border-2 border-sky-400 bg-sky-50/40 text-base font-mono font-black text-slate-900 focus:outline-none focus:border-[#0284c7] focus:bg-white transition-colors"
                  />
                  <span className="absolute right-3 text-xs font-mono font-bold text-slate-400 pointer-events-none">
                    mm
                  </span>
                </div>

                {/* Szybka korekta krokowa */}
                <div className="flex items-center justify-between gap-1 mt-1.5">
                  {[-100, -10, 10, 100].map((delta) => (
                    <button
                      key={delta}
                      type="button"
                      onClick={() => {
                        const cur =
                          Number(activeDimEdit.value) ||
                          (activeDimEdit.mode === "height"
                            ? targetHeight
                            : targetWidth);
                        const nextVal = Math.max(150, cur + delta);
                        setActiveDimEdit((prev) =>
                          prev ? { ...prev, value: String(nextVal) } : null
                        );
                        dimInputRef.current?.focus();
                      }}
                      className="flex-1 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[11px] font-mono font-bold text-slate-700 transition-colors cursor-pointer"
                    >
                      {delta > 0 ? `+${delta}` : delta}
                    </button>
                  ))}
                </div>
              </div>

              {/* Podgląd przeliczenia */}
              <div className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 flex items-center justify-between font-mono">
                {activeDimEdit.mode === "pane_width" ? (
                  <>
                    <span>Nowa szer. całk. ({targetPanes} tory):</span>
                    <span className="font-bold text-slate-900">
                      {previewTotalWidth} mm
                    </span>
                  </>
                ) : activeDimEdit.mode === "width" ? (
                  <>
                    <span>Szer. 1 toru ({targetPanes}x):</span>
                    <span className="font-bold text-slate-900">
                      ~{Math.round(previewTotalWidth / targetPanes)} mm
                    </span>
                  </>
                ) : (
                  <>
                    <span>Wysokość światła:</span>
                    <span className="font-bold text-slate-900">
                      {Math.max(
                        200,
                        (isValidPreview ? parsedPreview : targetHeight) - 100
                      )}{" "}
                      mm
                    </span>
                  </>
                )}
              </div>

              {/* Przełącznik B / H */}
              <div className="flex items-center gap-1 pt-0.5">
                <button
                  type="button"
                  onClick={() =>
                    setActiveDimEdit((prev) =>
                      prev
                        ? {
                            ...prev,
                            mode: "width",
                            value: String(targetWidth),
                            paneIndex: undefined,
                          }
                        : null
                    )
                  }
                  className={`flex-1 py-1 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                    activeDimEdit.mode === "width"
                      ? "bg-sky-100 text-[#0284c7] border border-sky-300"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Szerokość B ({targetWidth})
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveDimEdit((prev) =>
                      prev
                        ? {
                            ...prev,
                            mode: "height",
                            value: String(targetHeight),
                            paneIndex: undefined,
                          }
                        : null
                    )
                  }
                  className={`flex-1 py-1 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                    activeDimEdit.mode === "height"
                      ? "bg-sky-100 text-[#0284c7] border border-sky-300"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Wysokość H ({targetHeight})
                </button>
              </div>

              {/* Przyciski akcji */}
              <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveDimEdit(null)}
                  className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyDimension(activeDimEdit.value)}
                  className="flex-1 py-1.5 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-xs"
                >
                  <Check size={13} />
                  <span>Zastosuj</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Pływający podgląd przeciąganej konstrukcji (Drag ghost badge) ── */}
      {dragState && (() => {
        const draggedItem = items.find((it) => it._id === dragState.itemId);
        if (!draggedItem) return null;
        return (
          <div
            style={{
              position: "fixed",
              left: `${dragState.clientX + 16}px`,
              top: `${dragState.clientY + 16}px`,
              pointerEvents: "none",
              zIndex: 9999,
            }}
            className="bg-[#0b1220]/95 backdrop-blur-md text-white border-2 border-[#4ABBC3] rounded-xl px-3.5 py-2.5 shadow-2xl flex items-center gap-3 text-xs animate-in fade-in zoom-in-95 duration-75 select-none"
          >
            <div className="w-7 h-7 rounded-lg bg-[#4ABBC3]/20 flex items-center justify-center text-[#4ABBC3] shrink-0">
              <Move size={15} />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 font-bold">
                <span className="text-[#4ABBC3] font-mono">
                  Poz. {draggedItem.positionIndex}
                </span>
                <span className="truncate max-w-[180px]">
                  {draggedItem.shortName || draggedItem.name}
                </span>
              </div>
              <div className="text-[11px] text-slate-300 font-mono flex items-center gap-1.5 mt-0.5">
                <span>
                  {draggedItem.widthMm} × {draggedItem.heightMm} mm
                </span>
                {activeDropTarget?.type === "above" && (
                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                    ▲ Nad Poz. {activeDropTarget.targetPosIndex}
                  </span>
                )}
                {activeDropTarget?.type === "slot" && (
                  <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40">
                    ↓ {activeDropTarget.insertDescription}
                  </span>
                )}
                {activeDropTarget?.type === "new-row" && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                    + Nowy rząd poniżej
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
