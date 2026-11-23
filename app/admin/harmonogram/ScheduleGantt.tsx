"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import toast from "react-hot-toast";
import StageTasksDrawer from "@/components/StageTasksDrawer";
import {
  Calendar,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  Diamond,
  ExternalLink,
  ListChecks,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";

const MS_PER_DAY = 86_400_000;
const LEFT_PANEL_WIDTH = 340;

type StageKey = "kitting" | "production" | "installation";
type ZoomLevel = "day" | "week" | "month";

const STAGE_ORDER: Record<StageKey, number> = {
  kitting: 0,
  production: 1,
  installation: 2,
};

const ZOOM_DAY_WIDTH: Record<ZoomLevel, number> = {
  day: 44,
  week: 24,
  month: 12,
};

const STAGES: Array<{
  key: StageKey;
  label: string;
  color: string;
  bg: string;
  border: string;
  startField: "completionStartDate" | "productionStartDate" | "installationPhaseStartDate";
  endField: "completionEndDate" | "productionEndDate" | "installationPhaseEndDate";
}> = [
  {
    key: "kitting",
    label: "Kompletacja",
    color: "#0284c7",
    bg: "rgba(2, 132, 199, 0.14)",
    border: "rgba(2, 132, 199, 0.45)",
    startField: "completionStartDate",
    endField: "completionEndDate",
  },
  {
    key: "production",
    label: "Produkcja",
    color: "#7c3aed",
    bg: "rgba(124, 58, 237, 0.14)",
    border: "rgba(124, 58, 237, 0.45)",
    startField: "productionStartDate",
    endField: "productionEndDate",
  },
  {
    key: "installation",
    label: "Montaż",
    color: "#059669",
    bg: "rgba(5, 150, 105, 0.14)",
    border: "rgba(5, 150, 105, 0.45)",
    startField: "installationPhaseStartDate",
    endField: "installationPhaseEndDate",
  },
];

const STAGE_BY_KEY = STAGES.reduce(
  (acc, s) => {
    acc[s.key] = s;
    return acc;
  },
  {} as Record<StageKey, (typeof STAGES)[number]>,
);

interface ScheduleOrder {
  _id: Id<"orders">;
  name: string;
  customText?: string;
  orderNumber?: string;
  status: string;
  statusLabel: string;
  stageKey: StageKey;
  clientId: Id<"clients">;
  clientName: string;
  investmentCity?: string;
  installationTeamId?: Id<"installationTeams">;
  installationTeamName?: string;
  completionStartDate?: number;
  completionEndDate?: number;
  productionStartDate?: number;
  productionEndDate?: number;
  installationPhaseStartDate?: number;
  installationPhaseEndDate?: number;
  stageProgress?: Record<StageKey, { done: number; total: number }>;
}

interface DragState {
  orderId: Id<"orders">;
  stageKey: StageKey;
  mode: "move" | "resize-start" | "resize-end";
  startX: number;
  origStart: number;
  origEnd: number;
  previewStart: number;
  previewEnd: number;
}

function normalizeDayStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function addDays(ts: number, days: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

function diffDays(a: number, b: number): number {
  return Math.round((b - a) / MS_PER_DAY);
}

function formatPlDate(ts?: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const WEEKDAY_SHORT = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "Sb"];

export default function ScheduleGantt() {
  const orders = useQuery(api.orders.listForSchedule) as ScheduleOrder[] | undefined;
  const updateOrder = useMutation(api.orders.update);

  const [onlyUnscheduled, setOnlyUnscheduled] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [zoom, setZoom] = useState<ZoomLevel>("day");
  const [windowStartTs, setWindowStartTs] = useState<number>(() =>
    addDays(normalizeDayStart(Date.now()), -14),
  );
  const [selectedStageTarget, setSelectedStageTarget] = useState<{
    order: ScheduleOrder;
    stageKey: StageKey;
  } | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoveredBar, setHoveredBar] = useState<{
    order: ScheduleOrder;
    stage: (typeof STAGES)[number];
    start: number;
    end?: number;
    x: number;
    y: number;
  } | null>(null);
  const [recentlyCreatedKey, setRecentlyCreatedKey] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    order: ScheduleOrder;
    stage: (typeof STAGES)[number];
    x: number;
    y: number;
  } | null>(null);

  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!contextMenu) return;

    const handlePointerDownOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && contextMenuRef.current.contains(e.target as Node)) {
        return;
      }
      setContextMenu(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    const handleClose = () => setContextMenu(null);

    window.addEventListener("mousedown", handlePointerDownOutside);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleClose);
    const scrollEl = timelineScrollRef.current;
    scrollEl?.addEventListener("scroll", handleClose, { passive: true });
    return () => {
      window.removeEventListener("mousedown", handlePointerDownOutside);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleClose);
      scrollEl?.removeEventListener("scroll", handleClose);
    };
  }, [contextMenu]);

  const handleDeleteStageBar = useCallback(
    async (order: ScheduleOrder, stage: (typeof STAGES)[number]) => {
      setContextMenu(null);
      setHoveredBar(null);
      try {
        await updateOrder({
          orderId: order._id,
          [stage.startField]: null,
          [stage.endField]: null,
        });
        toast.success(`Usunięto termin etapu: ${stage.label}`);
      } catch (err) {
        console.error(err);
        toast.error("Nie udało się usunąć terminu etapu.");
      }
    },
    [updateOrder],
  );

  const currentSelectedOrder = useMemo(() => {
    if (!selectedStageTarget) return null;
    return (
      orders?.find((o) => o._id === selectedStageTarget.order._id) ??
      selectedStageTarget.order
    );
  }, [orders, selectedStageTarget]);

  useEffect(() => {
    dragRef.current = dragState;
  }, [dragState]);

  const dayWidth = ZOOM_DAY_WIDTH[zoom];
  const totalDays = zoom === "month" ? 120 : zoom === "week" ? 90 : 75;
  const [todayTs] = useState<number>(() => normalizeDayStart(Date.now()));
  const isDragging = dragState !== null;

  const days = useMemo(() => {
    return Array.from({ length: totalDays }, (_, i) => addDays(windowStartTs, i));
  }, [windowStartTs, totalDays]);

  const monthGroups = useMemo(() => {
    const groups: Array<{ label: string; count: number; key: string }> = [];
    for (const dTs of days) {
      const d = new Date(dTs);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = d.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
      const last = groups[groups.length - 1];
      if (last && last.key === key) {
        last.count += 1;
      } else {
        groups.push({ key, label, count: 1 });
      }
    }
    return groups;
  }, [days]);

  const availableTeams = useMemo(() => {
    if (!orders) return [];
    const map = new Map<string, string>();
    for (const o of orders) {
      if (o.installationTeamId && o.installationTeamName) {
        map.set(o.installationTeamId, o.installationTeamName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    const q = searchTerm.trim().toLowerCase();
    return orders.filter((o) => {
      if (teamFilter !== "all" && o.installationTeamId !== teamFilter) return false;
      if (onlyUnscheduled) {
        const isFullyScheduled =
          Boolean(o.completionStartDate && o.completionEndDate) &&
          Boolean(o.productionStartDate && o.productionEndDate) &&
          Boolean(o.installationPhaseStartDate && o.installationPhaseEndDate);
        if (isFullyScheduled) return false;
      }
      if (q) {
        const hay = `${o.customText ?? ""} ${o.name} ${o.clientName} ${o.investmentCity}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, teamFilter, onlyUnscheduled, searchTerm]);

  const scrollToToday = useCallback(() => {
    const el = timelineScrollRef.current;
    if (!el) return;
    const offsetDays = diffDays(windowStartTs, todayTs);
    if (offsetDays < 0 || offsetDays > totalDays - 5) {
      setWindowStartTs(addDays(todayTs, -14));
      requestAnimationFrame(() => {
        if (timelineScrollRef.current) {
          timelineScrollRef.current.scrollLeft = Math.max(0, 10 * dayWidth);
        }
      });
      return;
    }
    el.scrollTo({
      left: Math.max(0, (offsetDays - 4) * dayWidth),
      behavior: "smooth",
    });
  }, [windowStartTs, todayTs, totalDays, dayWidth]);

  useEffect(() => {
    if (!orders) return;
    const el = timelineScrollRef.current;
    if (!el) return;
    const offsetDays = diffDays(windowStartTs, todayTs);
    if (offsetDays >= 0 && offsetDays < totalDays) {
      el.scrollLeft = Math.max(0, (offsetDays - 4) * dayWidth);
    }
  }, [Boolean(orders)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const curr = dragRef.current;
      if (!curr) return;
      const deltaDays = Math.round((e.clientX - curr.startX) / dayWidth);
      let nextStart = curr.origStart;
      let nextEnd = curr.origEnd;

      if (curr.mode === "move") {
        nextStart = addDays(curr.origStart, deltaDays);
        nextEnd = addDays(curr.origEnd, deltaDays);
      } else if (curr.mode === "resize-start") {
        nextStart = Math.min(addDays(curr.origStart, deltaDays), curr.origEnd);
      } else if (curr.mode === "resize-end") {
        nextEnd = Math.max(addDays(curr.origEnd, deltaDays), curr.origStart);
      }

      setDragState((prev) =>
        prev ? { ...prev, previewStart: nextStart, previewEnd: nextEnd } : null,
      );
    };

    const handlePointerUp = async () => {
      const curr = dragRef.current;
      setDragState(null);
      if (!curr) return;
      if (curr.previewStart === curr.origStart && curr.previewEnd === curr.origEnd) {
        const clickedOrder = orders?.find((o) => o._id === curr.orderId);
        if (clickedOrder) {
          setSelectedStageTarget({
            order: clickedOrder,
            stageKey: curr.stageKey,
          });
          setIsDrawerOpen(true);
        }
        return;
      }

      const stage = STAGE_BY_KEY[curr.stageKey];
      try {
        await updateOrder({
          orderId: curr.orderId,
          [stage.startField]: curr.previewStart,
          [stage.endField]: curr.previewEnd,
        });
        toast.success(`Zapisano termin: ${stage.label}`);
      } catch (err) {
        console.error(err);
        toast.error("Nie udało się zapisać terminu.");
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDragging, dayWidth, updateOrder, orders]);

  const todayOffsetDays = diffDays(windowStartTs, todayTs);
  const timelineWidth = totalDays * dayWidth;

  const handleCreateStageBar = async (
    order: ScheduleOrder,
    stageKey: StageKey,
    preferredStartTs?: number,
  ) => {
    const stage = STAGE_BY_KEY[stageKey];
    const defaultDays = stageKey === "production" ? 5 : stageKey === "kitting" ? 3 : 2;

    let startTs: number;
    if (preferredStartTs) {
      startTs = normalizeDayStart(preferredStartTs);
    } else if (stageKey === "production" && order.completionEndDate) {
      startTs = normalizeDayStart(addDays(order.completionEndDate, 1));
    } else if (
      stageKey === "installation" &&
      (order.productionEndDate || order.completionEndDate)
    ) {
      const prevEnd = order.productionEndDate ?? order.completionEndDate!;
      startTs = normalizeDayStart(addDays(prevEnd, 1));
    } else {
      startTs = todayTs;
    }

    const endTs = normalizeDayStart(addDays(startTs, defaultDays - 1));

    // Przewiń oś czasu do nowo utworzonego obiektu
    const offsetDays = diffDays(windowStartTs, startTs);
    if (timelineScrollRef.current) {
      if (offsetDays < 0 || offsetDays > totalDays - 5) {
        setWindowStartTs(addDays(startTs, -7));
        requestAnimationFrame(() => {
          if (timelineScrollRef.current) {
            timelineScrollRef.current.scrollLeft = 7 * dayWidth;
          }
        });
      } else {
        timelineScrollRef.current.scrollTo({
          left: Math.max(0, (offsetDays - 3) * dayWidth),
          behavior: "smooth",
        });
      }
    }

    setRecentlyCreatedKey(`${order._id}-${stageKey}`);
    setTimeout(() => setRecentlyCreatedKey(null), 2500);

    try {
      await updateOrder({
        orderId: order._id,
        [stage.startField]: startTs,
        [stage.endField]: endTs,
      });
      toast.success(
        `Zaplanowano kamień milowy: ${stage.label} (${defaultDays} dni). Możesz przeciągać i rozciągać pasek na osi czasu.`,
      );
    } catch (err) {
      console.error(err);
      toast.error("Nie udało się zapisać terminu.");
    }
  };

  const renderConnectors = (order: ScheduleOrder) => {
    const connectors: React.ReactNode[] = [];

    for (let i = 0; i < STAGES.length - 1; i++) {
      const stageA = STAGES[i];
      const stageB = STAGES[i + 1];

      const isDraggingA =
        dragState?.orderId === order._id && dragState.stageKey === stageA.key;
      const rawStartA = isDraggingA
        ? dragState.previewStart
        : order[stageA.startField];
      const rawEndA = isDraggingA ? dragState.previewEnd : order[stageA.endField];

      const isDraggingB =
        dragState?.orderId === order._id && dragState.stageKey === stageB.key;
      const rawStartB = isDraggingB
        ? dragState.previewStart
        : order[stageB.startField];
      const rawEndB = isDraggingB ? dragState.previewEnd : order[stageB.endField];

      if (!rawStartA && !rawEndA) continue;
      if (!rawStartB && !rawEndB) continue;

      const startNormA = normalizeDayStart(rawStartA ?? rawEndA!);
      const endNormA = normalizeDayStart(rawEndA ?? startNormA);
      const spanDaysA = Math.max(1, diffDays(startNormA, endNormA) + 1);
      const rightA = (diffDays(windowStartTs, startNormA) + spanDaysA) * dayWidth;

      const startNormB = normalizeDayStart(rawStartB ?? rawEndB!);
      const leftB = diffDays(windowStartTs, startNormB) * dayWidth;

      if (leftB > rightA) {
        const gapWidth = leftB - rightA;
        if (rightA + gapWidth > 0 && rightA < timelineWidth) {
          connectors.push(
            <div
              key={`conn-${stageA.key}-${stageB.key}`}
              style={{
                left: rightA,
                width: gapWidth,
                top: 23,
              }}
              className="absolute pointer-events-none flex items-center z-0"
            >
              <div className="flex-1 border-t-2 border-dashed border-slate-300 dark:border-slate-600" />
              <div className="w-0 h-0 border-t-[3.5px] border-b-[3.5px] border-l-[5px] border-t-transparent border-b-transparent border-l-slate-400 shrink-0 -ml-1" />
            </div>,
          );
        }
      }
    }

    return connectors;
  };

  const renderStageBar = (
    order: ScheduleOrder,
    stage: (typeof STAGES)[number],
    currentStageIdx: number,
  ) => {
    const isDraggingThis =
      dragState?.orderId === order._id && dragState.stageKey === stage.key;

    const rawStart = isDraggingThis
      ? dragState.previewStart
      : order[stage.startField];
    const rawEnd = isDraggingThis
      ? dragState.previewEnd
      : order[stage.endField];

    if (!rawStart && !rawEnd) {
      return null;
    }

    const startNorm = normalizeDayStart(rawStart ?? rawEnd!);
    const hasExplicitEnd = Boolean(rawEnd);
    const endNorm = normalizeDayStart(rawEnd ?? startNorm);
    const spanDays = Math.max(1, diffDays(startNorm, endNorm) + 1);

    const leftPx = diffDays(windowStartTs, startNorm) * dayWidth;
    const widthPx = Math.max(dayWidth, spanDays * dayWidth);

    if (leftPx + widthPx < 0 || leftPx > timelineWidth) {
      return null;
    }

    const stageIdx = STAGE_ORDER[stage.key];
    const isDone = stageIdx < currentStageIdx;
    const isCurrent = stageIdx === currentStageIdx;
    const isRecent = recentlyCreatedKey === `${order._id}-${stage.key}`;
    const barBackground = stage.color;

    const progress = order.stageProgress?.[stage.key];
    const hasChecklist = Boolean(progress && progress.total > 0);
    const progressPct = hasChecklist
      ? Math.round((progress!.done / progress!.total) * 100)
      : 0;

    return (
      <React.Fragment key={stage.key}>
        <div
          data-stage-bar="true"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            if ((e.target as HTMLElement).dataset.resizeHandle) return;
            e.preventDefault();
            setContextMenu(null);
            setDragState({
              orderId: order._id,
              stageKey: stage.key,
              mode: "move",
              startX: e.clientX,
              origStart: startNorm,
              origEnd: endNorm,
              previewStart: startNorm,
              previewEnd: endNorm,
            });
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setHoveredBar(null);
            setContextMenu({
              order,
              stage,
              x: e.clientX,
              y: e.clientY,
            });
          }}
          onMouseEnter={(e) =>
            setHoveredBar({
              order,
              stage,
              start: startNorm,
              end: hasExplicitEnd ? endNorm : undefined,
              x: e.clientX,
              y: e.clientY,
            })
          }
          onMouseMove={(e) =>
            setHoveredBar((prev) =>
              prev ? { ...prev, x: e.clientX, y: e.clientY } : null,
            )
          }
          onMouseLeave={() => setHoveredBar(null)}
          style={{
            left: leftPx,
            width: widthPx,
            top: 8,
            height: 32,
            background: barBackground,
            borderStyle: hasExplicitEnd ? "solid" : "dashed",
            borderWidth: hasExplicitEnd ? 0 : 1.5,
            borderColor: "#fff",
            opacity: isDraggingThis ? 0.85 : 1,
          }}
          className={`group absolute z-10 rounded-lg text-white text-[11px] font-semibold flex items-center shadow-sm cursor-grab active:cursor-grabbing select-none overflow-hidden transition-all ${
            isRecent
              ? "ring-2 ring-white ring-offset-2 ring-offset-cyan-500 shadow-lg animate-pulse"
              : isCurrent
              ? "ring-2 ring-white/90 shadow-md"
              : ""
          }`}
        >
          {/* Left resize handle */}
          <div
            data-resize-handle="left"
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.stopPropagation();
              e.preventDefault();
              setContextMenu(null);
              setDragState({
                orderId: order._id,
                stageKey: stage.key,
                mode: "resize-start",
                startX: e.clientX,
                origStart: startNorm,
                origEnd: endNorm,
                previewStart: startNorm,
                previewEnd: endNorm,
              });
            }}
            className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center bg-black/15 hover:bg-black/35 group-hover:opacity-100 opacity-60 transition-opacity z-10"
            title="Przeciągnij, aby zmienić początek"
          >
            <div className="w-0.5 h-3.5 bg-white/80 rounded-full pointer-events-none" />
          </div>

          {/* Milestone Icon and Label */}
          <div className="flex items-center gap-1.5 truncate pointer-events-none px-3 font-medium">
            {isDone ? (
              <Check size={12} className="stroke-[3] shrink-0 text-white/90" />
            ) : isCurrent ? (
              <span className="w-2 h-2 rounded-full bg-white shrink-0 animate-pulse shadow-sm" />
            ) : (
              <Diamond size={11} className="fill-white/30 shrink-0" />
            )}

            <span className="truncate">
              {hasExplicitEnd
                ? `${stage.label} (${spanDays}d)`
                : `${stage.label} • ustaw koniec`}
            </span>

            {hasChecklist && (
              <span className="text-[9.5px] font-bold px-1.5 py-0.2 bg-black/25 rounded tracking-wide shrink-0 tabular-nums">
                {progress!.done}/{progress!.total}
              </span>
            )}

            {isCurrent && (
              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-white/25 rounded tracking-wide shrink-0 hidden sm:inline-block">
                W TRAKCIE
              </span>
            )}
          </div>

          {/* Right resize handle */}
          <div
            data-resize-handle="right"
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.stopPropagation();
              e.preventDefault();
              setContextMenu(null);
              setDragState({
                orderId: order._id,
                stageKey: stage.key,
                mode: "resize-end",
                startX: e.clientX,
                origStart: startNorm,
                origEnd: endNorm,
                previewStart: startNorm,
                previewEnd: endNorm,
              });
            }}
            className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center bg-black/15 hover:bg-black/35 group-hover:opacity-100 opacity-60 transition-opacity"
            title="Przeciągnij, aby zmienić koniec (czas trwania)"
          >
            <div className="w-0.5 h-3.5 bg-white/80 rounded-full pointer-events-none" />
          </div>
        </div>

        {/* Dedicated high-contrast Checklist Progress Bar directly below Gantt bar */}
        {hasChecklist && (
          <div
            data-stage-bar="true"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedStageTarget({
                order,
                stageKey: stage.key,
              });
              setIsDrawerOpen(true);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setHoveredBar(null);
              setContextMenu({
                order,
                stage,
                x: e.clientX,
                y: e.clientY,
              });
            }}
            onMouseEnter={(e) =>
              setHoveredBar({
                order,
                stage,
                start: startNorm,
                end: hasExplicitEnd ? endNorm : undefined,
                x: e.clientX,
                y: e.clientY,
              })
            }
            onMouseMove={(e) =>
              setHoveredBar((prev) =>
                prev ? { ...prev, x: e.clientX, y: e.clientY } : null,
              )
            }
            onMouseLeave={() => setHoveredBar(null)}
            style={{
              left: leftPx,
              width: widthPx,
              top: 44,
              height: 6,
              opacity: isDraggingThis ? 0.85 : 1,
            }}
            className="absolute z-10 rounded-full bg-slate-200 border border-slate-300/70 overflow-hidden cursor-pointer"
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progressPct}%`,
                minWidth: progressPct > 0 ? 4 : 0,
                background: progressPct === 100 ? "#16a34a" : barBackground,
              }}
            />
          </div>
        )}
      </React.Fragment>
    );
  };

  return (
    <div
      className="flex flex-col h-full rounded-xl overflow-hidden border"
      style={{ background: "var(--card, #fff)", borderColor: "var(--line, #e5e7eb)" }}
    >
      {/* Toolbar */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b"
        style={{ borderColor: "var(--line, #e5e7eb)", background: "var(--panel, #fff)" }}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 pr-2 border-r" style={{ borderColor: "var(--line)" }}>
            <CalendarRange size={18} style={{ color: "var(--brand, #4ABBC3)" }} />
            <h1 className="text-sm font-bold" style={{ color: "var(--text-strong)" }}>
              Harmonogram
            </h1>
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "var(--panel-2, #f1f5f9)", color: "var(--text-mute)" }}
            >
              {filteredOrders.length}
            </span>
          </div>

          {/* Milestone Legend (Etapy jako kamienie milowe) */}
          <div className="flex items-center gap-2 text-[11px] px-2.5 py-1 rounded-lg bg-slate-100/70 border border-slate-200/60">
            <span className="text-slate-400 font-medium">Etapy:</span>
            {STAGES.map((st, idx) => (
              <React.Fragment key={st.key}>
                {idx > 0 && <span className="text-slate-300">➔</span>}
                <div className="flex items-center gap-1 font-semibold" style={{ color: st.color }}>
                  <Diamond size={9} className="fill-current" />
                  <span>{st.label}</span>
                </div>
              </React.Fragment>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setOnlyUnscheduled((v) => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer"
            style={{
              background: onlyUnscheduled ? "rgba(245, 158, 11, 0.14)" : "transparent",
              color: onlyUnscheduled ? "#b45309" : "var(--text-mute)",
              border: `1px solid ${onlyUnscheduled ? "rgba(245, 158, 11, 0.45)" : "var(--line)"}`,
            }}
          >
            <SlidersHorizontal size={12} />
            Bez pełnych dat
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-mute)" }}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Szukaj zlecenia, klienta..."
              className="pl-7 pr-7 py-1 text-xs rounded-lg border focus:outline-none"
              style={{
                borderColor: "var(--line)",
                background: "var(--background, #f8fafc)",
                color: "var(--text-strong)",
                width: 190,
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
                style={{ color: "var(--text-mute)" }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Team filter */}
          {availableTeams.length > 0 && (
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="px-2.5 py-1 text-xs rounded-lg border focus:outline-none cursor-pointer"
              style={{
                borderColor: "var(--line)",
                background: "var(--background, #f8fafc)",
                color: "var(--text-strong)",
              }}
            >
              <option value="all">Wszystkie ekipy</option>
              {availableTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}

          {/* Zoom */}
          <div
            className="inline-flex rounded-lg border p-0.5"
            style={{ borderColor: "var(--line)", background: "var(--background, #f8fafc)" }}
          >
            {(
              [
                { id: "day", label: "Dzień" },
                { id: "week", label: "Tydzień" },
                { id: "month", label: "Miesiąc" },
              ] as const
            ).map((z) => (
              <button
                key={z.id}
                type="button"
                onClick={() => setZoom(z.id)}
                className="px-2.5 py-0.5 text-xs font-medium rounded-md transition-colors cursor-pointer"
                style={{
                  background: zoom === z.id ? "#fff" : "transparent",
                  color: zoom === z.id ? "var(--text-strong)" : "var(--text-mute)",
                  boxShadow: zoom === z.id ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {z.label}
              </button>
            ))}
          </div>

          {/* Time navigation */}
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => setWindowStartTs((ts) => addDays(ts, -14))}
              className="p-1 rounded-md border hover:bg-slate-50 cursor-pointer"
              style={{ borderColor: "var(--line)" }}
              title="Poprzednie 2 tygodnie"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              onClick={scrollToToday}
              className="px-2.5 py-1 text-xs font-semibold rounded-md border hover:bg-slate-50 cursor-pointer"
              style={{ borderColor: "var(--line)", color: "var(--text-strong)" }}
            >
              Dziś
            </button>
            <button
              type="button"
              onClick={() => setWindowStartTs((ts) => addDays(ts, 14))}
              className="p-1 rounded-md border hover:bg-slate-50 cursor-pointer"
              style={{ borderColor: "var(--line)" }}
              title="Następne 2 tygodnie"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {!orders ? (
        <div className="flex-1 flex items-center justify-center text-xs" style={{ color: "var(--text-mute)" }}>
          Ładowanie harmonogramu…
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center p-8">
          <Calendar size={28} style={{ color: "var(--text-mute)", opacity: 0.4 }} />
          <p className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>
            Brak zleceń spełniających kryteria
          </p>
          <p className="text-xs" style={{ color: "var(--text-mute)" }}>
            Widok uwzględnia wyłącznie zlecenia w realizacji (Kompletacja, Produkcja, Montaż).
          </p>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Synchronized vertical scroll container */}
          <div
            ref={timelineScrollRef}
            className="flex-1 overflow-auto relative"
            style={{ background: "var(--background, #f8fafc)" }}
          >
            <div style={{ minWidth: LEFT_PANEL_WIDTH + timelineWidth }} className="flex flex-col">
              {/* Sticky Header */}
              <div
                className="sticky top-0 z-20 flex border-b"
                style={{
                  borderColor: "var(--line, #e5e7eb)",
                  background: "var(--panel, #fff)",
                }}
              >
                {/* Sticky top-left corner */}
                <div
                  className="sticky left-0 z-30 shrink-0 w-[340px] px-3.5 py-2 border-r flex items-center justify-between text-[11px] font-bold uppercase tracking-wider shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]"
                  style={{
                    borderColor: "var(--line, #e5e7eb)",
                    background: "#ffffff",
                    color: "var(--text-mute)",
                  }}
                >
                  <span>Zlecenie / Klient</span>
                  <span className="text-[10px] text-slate-400 normal-case font-semibold">
                    Etapy (K ➔ P ➔ M)
                  </span>
                </div>

                {/* Timeline Header */}
                <div style={{ width: timelineWidth }} className="flex flex-col shrink-0">
                  {/* Months row */}
                  <div className="flex border-b" style={{ borderColor: "var(--line)" }}>
                    {monthGroups.map((mg) => (
                      <div
                        key={mg.key}
                        style={{ width: mg.count * dayWidth, borderColor: "var(--line)" }}
                        className="px-2 py-1 text-[11px] font-bold capitalize border-r truncate"
                      >
                        {mg.label}
                      </div>
                    ))}
                  </div>
                  {/* Days row */}
                  <div className="flex">
                    {days.map((dTs) => {
                      const d = new Date(dTs);
                      const dow = d.getDay();
                      const isWeekend = dow === 0 || dow === 6;
                      const isToday = dTs === todayTs;
                      return (
                        <div
                          key={dTs}
                          style={{
                            width: dayWidth,
                            borderColor: "var(--line)",
                            background: isToday
                              ? "rgba(74, 187, 195, 0.16)"
                              : isWeekend
                              ? "rgba(148, 163, 184, 0.10)"
                              : "transparent",
                            color: isToday ? "#0e7490" : isWeekend ? "var(--text-mute)" : "var(--text)",
                          }}
                          className="shrink-0 py-1 text-center border-r text-[10px] leading-tight select-none"
                        >
                          <div className="font-bold">{d.getDate()}</div>
                          {zoom === "day" && (
                            <div className="text-[9px] opacity-75">{WEEKDAY_SHORT[dow]}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Order Rows */}
              <div className="relative">
                {/* Today vertical line */}
                {todayOffsetDays >= 0 && todayOffsetDays < totalDays && (
                  <div
                    className="pointer-events-none absolute top-0 bottom-0 z-10"
                    style={{
                      left: LEFT_PANEL_WIDTH + todayOffsetDays * dayWidth + Math.floor(dayWidth / 2),
                      width: 2,
                      background: "rgba(239, 68, 68, 0.55)",
                    }}
                  />
                )}

                {filteredOrders.map((order) => {
                  const currentStageIdx = STAGE_ORDER[order.stageKey] ?? 0;

                  return (
                    <div
                      key={order._id}
                      className="border-b transition-colors hover:bg-slate-50/50"
                      style={{ borderColor: "var(--line, #e5e7eb)" }}
                    >
                      <div
                        className="flex"
                        style={{
                          minHeight: 58,
                          background: "var(--card, #fff)",
                        }}
                      >
                        {/* Left sticky cell */}
                        <div
                          className="sticky left-0 z-20 shrink-0 w-[340px] px-3.5 py-2 border-r flex items-center justify-between gap-2.5 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]"
                          style={{
                            borderColor: "var(--line, #e5e7eb)",
                            background: "#ffffff",
                          }}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <Link
                                href={`/admin/klient/${order.clientId}/zlecenie/${order._id}`}
                                className="text-xs font-bold hover:underline truncate inline-flex items-center gap-1"
                                style={{ color: "var(--text-strong)" }}
                                title={order.customText?.trim() || order.name}
                              >
                                <span className="truncate">
                                  {order.customText?.trim() || order.name}
                                </span>
                                <ExternalLink size={10} className="opacity-50 shrink-0" />
                              </Link>
                            </div>
                            <div
                              className="text-[11px] truncate mt-0.5"
                              style={{ color: "var(--text-mute)" }}
                            >
                              {order.customText?.trim() ? `${order.name} • ` : ""}
                              {order.clientName}
                              {order.investmentCity ? ` • ${order.investmentCity}` : ""}
                              {order.installationTeamName
                                ? ` • ${order.installationTeamName}`
                                : ""}
                            </div>
                          </div>

                          {/* Milestone Stepper */}
                          <div className="flex items-center gap-0.5 shrink-0 bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/70">
                            {STAGES.map((st, idx) => {
                              const isPlanned = Boolean(
                                order[st.startField] && order[st.endField],
                              );
                              const stageIdx = STAGE_ORDER[st.key];
                              const isDone = stageIdx < currentStageIdx;
                              const isActive = stageIdx === currentStageIdx;
                              const shortLetter =
                                st.key === "kitting"
                                  ? "K"
                                  : st.key === "production"
                                  ? "P"
                                  : "M";

                              const tooltip = isPlanned
                                ? `${st.label}: ${formatPlDate(order[st.startField])} – ${formatPlDate(order[st.endField])} (${isActive ? "W TRAKCIE" : isDone ? "UKOŃCZONE" : "ZAPLANOWANE"})`
                                : `Zaplanuj ${st.label} (kliknij, aby umieścić na osi czasu)`;

                              return (
                                <React.Fragment key={st.key}>
                                  {idx > 0 && (
                                    <span className="text-[9px] text-slate-300 select-none">
                                      ›
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    title={tooltip}
                                    onClick={() => {
                                      if (isPlanned) {
                                        const s = order[st.startField];
                                        if (s && timelineScrollRef.current) {
                                          const offsetDays = diffDays(windowStartTs, s);
                                          timelineScrollRef.current.scrollTo({
                                            left: Math.max(
                                              0,
                                              (offsetDays - 3) * dayWidth,
                                            ),
                                            behavior: "smooth",
                                          });
                                        }
                                        setRecentlyCreatedKey(
                                          `${order._id}-${st.key}`,
                                        );
                                        setTimeout(
                                          () => setRecentlyCreatedKey(null),
                                          1500,
                                        );
                                        setSelectedStageTarget({
                                          order,
                                          stageKey: st.key,
                                        });
                                        setIsDrawerOpen(true);
                                      } else {
                                        void handleCreateStageBar(order, st.key);
                                      }
                                    }}
                                    className={`h-6 px-1.5 rounded text-[10px] font-bold cursor-pointer transition-all inline-flex items-center gap-1 ${
                                      isActive
                                        ? "shadow-sm ring-1"
                                        : ""
                                    }`}
                                    style={{
                                      background: isPlanned
                                        ? isActive
                                          ? st.color
                                          : st.bg
                                        : "transparent",
                                      color: isPlanned
                                        ? isActive
                                          ? "#ffffff"
                                          : st.color
                                        : "var(--text-mute)",
                                      borderColor: st.border,
                                      boxShadow: isActive
                                        ? `0 0 0 1px ${st.color}`
                                        : "none",
                                    }}
                                  >
                                    {isDone ? (
                                      <Check size={10} className="stroke-[3]" />
                                    ) : isActive ? (
                                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                    ) : null}
                                    <span>
                                      {isPlanned ? shortLetter : `+${shortLetter}`}
                                    </span>
                                  </button>
                                </React.Fragment>
                              );
                            })}
                          </div>
                        </div>

                        {/* Right timeline cell */}
                        <div
                          style={{
                            width: timelineWidth,
                            height: 58,
                          }}
                          className="relative shrink-0 cursor-pointer"
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest("[data-stage-bar]")) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            const clickX = e.clientX - rect.left;
                            const clickedDayIndex = Math.floor(clickX / dayWidth);
                            if (clickedDayIndex >= 0 && clickedDayIndex < totalDays) {
                              const clickedTs = addDays(windowStartTs, clickedDayIndex);
                              const nextUnscheduled = STAGES.find(
                                (st) => !order[st.startField] || !order[st.endField],
                              );
                              if (nextUnscheduled) {
                                void handleCreateStageBar(
                                  order,
                                  nextUnscheduled.key,
                                  clickedTs,
                                );
                              }
                            }
                          }}
                        >
                          {/* Day gridlines */}
                          <div className="absolute inset-0 flex pointer-events-none">
                            {days.map((dTs) => {
                              const dow = new Date(dTs).getDay();
                              const isWeekend = dow === 0 || dow === 6;
                              return (
                                <div
                                  key={dTs}
                                  style={{
                                    width: dayWidth,
                                    borderColor: "rgba(226, 232, 240, 0.7)",
                                    background: isWeekend
                                      ? "rgba(148, 163, 184, 0.06)"
                                      : "transparent",
                                  }}
                                  className="h-full border-r shrink-0"
                                />
                              );
                            })}
                          </div>

                          {/* Dependency connector lines between milestones */}
                          {renderConnectors(order)}

                          {/* Milestone bars */}
                          {STAGES.map((stage) =>
                            renderStageBar(order, stage, currentStageIdx),
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hover Tooltip */}
      {hoveredBar && !dragState && !contextMenu && (
        <div
          className="fixed z-50 pointer-events-none rounded-lg px-3 py-2 text-xs shadow-lg border"
          style={{
            left: hoveredBar.x + 12,
            top: hoveredBar.y + 12,
            background: "#0f172a",
            color: "#f8fafc",
            borderColor: "rgba(255,255,255,0.12)",
          }}
        >
          <div className="font-bold">
            {hoveredBar.order.customText?.trim() || hoveredBar.order.name} • {hoveredBar.stage.label}
          </div>
          <div className="text-[11px] opacity-85">
            {hoveredBar.order.customText?.trim() ? `${hoveredBar.order.name} • ` : ""}
            {hoveredBar.order.clientName}
          </div>
          <div className="text-[11px] mt-1 font-mono">
            {formatPlDate(hoveredBar.start)} – {formatPlDate(hoveredBar.end)}
            {hoveredBar.end
              ? ` (${Math.max(1, diffDays(hoveredBar.start, hoveredBar.end) + 1)} dni)`
              : " (brak daty końca)"}
          </div>
          {(() => {
            const p = hoveredBar.order.stageProgress?.[hoveredBar.stage.key];
            if (!p || p.total === 0) return null;
            const pct = Math.round((p.done / p.total) * 100);
            return (
              <div className="text-[11px] mt-1 text-emerald-300 font-medium">
                Checklista: {p.done}/{p.total} ({pct}%)
              </div>
            );
          })()}
        </div>
      )}

      {/* Native-style System Context Menu (Right-click on stage bar) */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          role="menu"
          onContextMenu={(e) => e.preventDefault()}
          style={{
            left:
              typeof window !== "undefined"
                ? Math.min(contextMenu.x, window.innerWidth - 228)
                : contextMenu.x,
            top:
              typeof window !== "undefined"
                ? Math.min(contextMenu.y, window.innerHeight - 136)
                : contextMenu.y,
          }}
          className="fixed z-50 min-w-[212px] rounded-xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.24),0_2px_6px_rgba(15,23,42,0.08)] p-1 text-[12.5px] text-slate-700 select-none"
        >
          <div className="px-2.5 py-1.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-400 truncate max-w-[230px]">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: contextMenu.stage.color }}
            />
            <span className="truncate">
              {contextMenu.order.customText?.trim() || contextMenu.order.name} •{" "}
              {contextMenu.stage.label}
            </span>
          </div>

          <div className="my-1 border-t border-slate-200/80" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setSelectedStageTarget({
                order: contextMenu.order,
                stageKey: contextMenu.stage.key,
              });
              setIsDrawerOpen(true);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-slate-100 active:bg-slate-200/70 transition-colors cursor-pointer"
          >
            <ListChecks size={14} className="text-slate-500 shrink-0" />
            <span>Otwórz checklistę etapu</span>
          </button>

          <div className="my-1 border-t border-slate-200/80" />

          <button
            type="button"
            role="menuitem"
            onClick={() =>
              void handleDeleteStageBar(contextMenu.order, contextMenu.stage)
            }
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left font-medium text-rose-600 hover:bg-rose-50 active:bg-rose-100/80 transition-colors cursor-pointer"
          >
            <Trash2 size={14} className="shrink-0" />
            <span>Usuń z osi czasu</span>
          </button>
        </div>
      )}

      {/* Stage Tasks Slide-over Drawer (always mounted for smooth slide animation) */}
      <StageTasksDrawer
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        order={currentSelectedOrder}
        stageKey={selectedStageTarget?.stageKey ?? null}
      />
    </div>
  );
}
