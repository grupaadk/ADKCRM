"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import toast from "react-hot-toast";
import StageTasksDrawer from "@/components/StageTasksDrawer";
import {
  ArrowLeft,
  Calendar,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Diamond,
  ExternalLink,
  ListChecks,
  Maximize2,
  Minimize2,
  Plus,
  Search,
  Trash2,
  Tv,
  Users,
  X,
} from "lucide-react";

const MS_PER_DAY = 86_400_000;
const LEFT_PANEL_WIDTH = 260;

type StageKey = "kitting" | "installation";
type ZoomLevel = "day" | "week" | "month";

const STAGE_ORDER: Record<StageKey, number> = {
  kitting: 0,
  installation: 1,
};

const ZOOM_DAY_WIDTH: Record<ZoomLevel, number> = {
  day: 44,
  week: 26,
  month: 18,
};

const STAGES: Array<{
  key: StageKey;
  label: string;
  color: string;
  bg: string;
  border: string;
  startField: "completionStartDate" | "installationPhaseStartDate";
  endField: "completionEndDate" | "installationPhaseEndDate";
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
  installationTeamColor?: string;
  completionStartDate?: number;
  completionEndDate?: number;
  productionStartDate?: number;
  productionEndDate?: number;
  installationPhaseStartDate?: number;
  installationPhaseEndDate?: number;
  stageProgress?: Record<StageKey, { done: number; total: number }>;
  assignees?: Array<{
    id: Id<"users">;
    name: string | null;
    color?: string;
  }>;
}

interface DragState {
  orderId: Id<"orders">;
  stageKey: StageKey;
  mode: "move" | "resize-start" | "resize-end";
  startX: number;
  deltaPx: number;
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

export default function ScheduleGantt({
  tvMode = false,
}: {
  tvMode?: boolean;
} = {}) {
  const orders = useQuery(api.orders.listForSchedule) as ScheduleOrder[] | undefined;
  const updateOrder = useMutation(api.orders.update);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [liveNow, setLiveNow] = useState<Date>(() => new Date());

  useEffect(() => {
    if (!tvMode) return;
    const timer = setInterval(() => {
      setLiveNow(new Date());
    }, 30_000);
    return () => clearInterval(timer);
  }, [tvMode]);

  useEffect(() => {
    if (!tvMode) return;
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [tvMode]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        const target = containerRef.current ?? document.documentElement;
        await target.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const liveClockStr = useMemo(
    () =>
      liveNow.toLocaleTimeString("pl-PL", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [liveNow],
  );
  const liveDateStr = useMemo(
    () =>
      liveNow.toLocaleDateString("pl-PL", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }),
    [liveNow],
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState<StageKey | "all">("all");
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [teamFilterMenu, setTeamFilterMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userFilterMenu, setUserFilterMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
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
  const [pendingDates, setPendingDates] = useState<
    Record<string, { start: number; end: number }>
  >({});
  const [hoveredBar, setHoveredBar] = useState<{
    order: ScheduleOrder;
    stage: (typeof STAGES)[number];
    start: number;
    end?: number;
    x: number;
    y: number;
  } | null>(null);
  const [placingStage, setPlacingStage] = useState<{
    order: ScheduleOrder;
    stageKey: StageKey;
    hoverDayTs: number | null;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    order: ScheduleOrder;
    stage: (typeof STAGES)[number];
    x: number;
    y: number;
  } | null>(null);
  const [addStageMenu, setAddStageMenu] = useState<{
    order: ScheduleOrder;
    stages: Array<(typeof STAGES)[number]>;
    x: number;
    y: number;
  } | null>(null);

  const [isPanning, setIsPanning] = useState(false);

  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const panRef = useRef<{ startX: number; startScrollLeft: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const addStageMenuRef = useRef<HTMLDivElement | null>(null);
  const userFilterMenuRef = useRef<HTMLDivElement | null>(null);
  const teamFilterMenuRef = useRef<HTMLDivElement | null>(null);

  const handleTimelinePanStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest("[data-stage-bar]")) return;
      const el = timelineScrollRef.current;
      if (!el) return;
      e.preventDefault();
      setContextMenu(null);
      setAddStageMenu(null);
      setHoveredBar(null);
      panRef.current = {
        startX: e.clientX,
        startScrollLeft: el.scrollLeft,
      };
      setIsPanning(true);
    },
    [],
  );

  useEffect(() => {
    if (!isPanning) return;

    const handlePointerMove = (e: PointerEvent) => {
      const pan = panRef.current;
      const el = timelineScrollRef.current;
      if (!pan || !el) return;
      el.scrollLeft = pan.startScrollLeft - (e.clientX - pan.startX);
    };

    const handlePointerUp = () => {
      panRef.current = null;
      setIsPanning(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [isPanning]);

  useEffect(() => {
    if (!contextMenu && !addStageMenu && !userFilterMenu && !teamFilterMenu) return;

    const handlePointerDownOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (contextMenuRef.current && contextMenuRef.current.contains(target)) {
        return;
      }
      if (addStageMenuRef.current && addStageMenuRef.current.contains(target)) {
        return;
      }
      if (userFilterMenuRef.current && userFilterMenuRef.current.contains(target)) {
        return;
      }
      if (teamFilterMenuRef.current && teamFilterMenuRef.current.contains(target)) {
        return;
      }
      setContextMenu(null);
      setAddStageMenu(null);
      setUserFilterMenu(null);
      setTeamFilterMenu(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextMenu(null);
        setAddStageMenu(null);
        setUserFilterMenu(null);
        setTeamFilterMenu(null);
      }
    };
    const handleClose = () => {
      setContextMenu(null);
      setAddStageMenu(null);
      setUserFilterMenu(null);
      setTeamFilterMenu(null);
    };

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
  }, [contextMenu, addStageMenu, userFilterMenu, teamFilterMenu]);

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
  const totalDays = zoom === "month" ? 150 : zoom === "week" ? 90 : 75;
  const todayTs = useMemo(() => normalizeDayStart(liveNow.getTime()), [liveNow]);
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
    const map = new Map<string, { id: string; name: string; color?: string }>();
    for (const o of orders) {
      if (o.installationTeamId && o.installationTeamName) {
        const id = String(o.installationTeamId);
        if (!map.has(id)) {
          map.set(id, {
            id,
            name: o.installationTeamName,
            color: o.installationTeamColor,
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "pl"),
    );
  }, [orders]);

  const hasUnassignedTeamOrders = useMemo(() => {
    if (!orders) return false;
    return orders.some((o) => !o.installationTeamId);
  }, [orders]);

  const toggleTeamFilter = useCallback((teamId: string) => {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId)
        ? prev.filter((id) => id !== teamId)
        : [...prev, teamId],
    );
  }, []);

  const availableUsers = useMemo(() => {
    if (!orders) return [];
    const map = new Map<string, { id: string; name: string; color?: string }>();
    for (const o of orders) {
      for (const a of o.assignees ?? []) {
        const id = String(a.id);
        if (!map.has(id)) {
          map.set(id, {
            id,
            name: a.name?.trim() || "Użytkownik",
            color: a.color,
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "pl"),
    );
  }, [orders]);

  const hasUnassignedOrders = useMemo(() => {
    if (!orders) return false;
    return orders.some((o) => !o.assignees || o.assignees.length === 0);
  }, [orders]);

  const toggleUserFilter = useCallback((userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  }, []);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    const q = searchTerm.trim().toLowerCase();
    return orders.filter((o) => {
      if (stageFilter !== "all") {
        const stageMeta = STAGE_BY_KEY[stageFilter];
        const hasStageBar = Boolean(
          o[stageMeta.startField] || o[stageMeta.endField],
        );
        if (!hasStageBar && o.stageKey !== stageFilter) return false;
      }
      if (selectedTeamIds.length > 0) {
        const tid = o.installationTeamId ? String(o.installationTeamId) : null;
        if (!tid) {
          if (!selectedTeamIds.includes("__none__")) return false;
        } else if (!selectedTeamIds.includes(tid)) {
          return false;
        }
      }
      if (selectedUserIds.length > 0) {
        const ids = (o.assignees ?? []).map((a) => String(a.id));
        if (ids.length === 0) {
          if (!selectedUserIds.includes("__none__")) return false;
        } else if (!ids.some((id) => selectedUserIds.includes(id))) {
          return false;
        }
      }
      if (q) {
        const hay = `${o.customText ?? ""} ${o.name} ${o.clientName} ${o.investmentCity}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, stageFilter, selectedTeamIds, selectedUserIds, searchTerm]);

  const hasActiveFilters =
    Boolean(searchTerm.trim()) ||
    stageFilter !== "all" ||
    selectedTeamIds.length > 0 ||
    selectedUserIds.length > 0;

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
      const deltaPx = e.clientX - curr.startX;
      const deltaDays = Math.round(deltaPx / dayWidth);
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
        prev
          ? {
              ...prev,
              deltaPx,
              previewStart: nextStart,
              previewEnd: nextEnd,
            }
          : null,
      );
    };

    const handlePointerUp = async () => {
      const curr = dragRef.current;
      if (!curr) {
        setDragState(null);
        return;
      }

      const wasClick =
        Math.abs(curr.deltaPx) < 4 &&
        curr.previewStart === curr.origStart &&
        curr.previewEnd === curr.origEnd;

      if (wasClick) {
        setDragState(null);
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

      if (curr.previewStart === curr.origStart && curr.previewEnd === curr.origEnd) {
        setDragState(null);
        return;
      }

      const pendingKey = `${curr.orderId}-${curr.stageKey}`;
      setPendingDates((prev) => ({
        ...prev,
        [pendingKey]: { start: curr.previewStart, end: curr.previewEnd },
      }));
      setDragState(null);

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
      } finally {
        setPendingDates((prev) => {
          if (!(pendingKey in prev)) return prev;
          const next = { ...prev };
          delete next[pendingKey];
          return next;
        });
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [isDragging, dayWidth, updateOrder, orders]);

  const todayOffsetDays = diffDays(windowStartTs, todayTs);
  const timelineWidth = totalDays * dayWidth;

  useEffect(() => {
    if (!placingStage) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlacingStage(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [placingStage]);

  const handlePlaceStageBar = useCallback(
    async (order: ScheduleOrder, stageKey: StageKey, startDayTs: number) => {
      const stage = STAGE_BY_KEY[stageKey];
      const defaultDays = stageKey === "kitting" ? 3 : 2;
      const startTs = normalizeDayStart(startDayTs);
      const endTs = normalizeDayStart(addDays(startTs, defaultDays - 1));
      const pendingKey = `${order._id}-${stageKey}`;

      setPlacingStage(null);
      setPendingDates((prev) => ({
        ...prev,
        [pendingKey]: { start: startTs, end: endTs },
      }));

      try {
        await updateOrder({
          orderId: order._id,
          [stage.startField]: startTs,
          [stage.endField]: endTs,
        });
        toast.success(
          `Dodano: ${stage.label} (${formatPlDate(startTs)} – ${formatPlDate(endTs)})`,
        );
      } catch (err) {
        console.error(err);
        toast.error("Nie udało się zapisać terminu.");
      } finally {
        setPendingDates((prev) => {
          if (!(pendingKey in prev)) return prev;
          const next = { ...prev };
          delete next[pendingKey];
          return next;
        });
      }
    },
    [updateOrder],
  );

  const renderConnectors = (order: ScheduleOrder) => {
    const connectors: React.ReactNode[] = [];

    for (let i = 0; i < STAGES.length - 1; i++) {
      const stageA = STAGES[i];
      const stageB = STAGES[i + 1];

      const isDraggingA =
        dragState?.orderId === order._id && dragState.stageKey === stageA.key;
      const pendingA = pendingDates[`${order._id}-${stageA.key}`];
      const rawStartA = isDraggingA
        ? dragState.previewStart
        : (pendingA?.start ?? order[stageA.startField]);
      const rawEndA = isDraggingA
        ? dragState.previewEnd
        : (pendingA?.end ?? order[stageA.endField]);

      const isDraggingB =
        dragState?.orderId === order._id && dragState.stageKey === stageB.key;
      const pendingB = pendingDates[`${order._id}-${stageB.key}`];
      const rawStartB = isDraggingB
        ? dragState.previewStart
        : (pendingB?.start ?? order[stageB.startField]);
      const rawEndB = isDraggingB
        ? dragState.previewEnd
        : (pendingB?.end ?? order[stageB.endField]);

      if (!rawStartA && !rawEndA) continue;
      if (!rawStartB && !rawEndB) continue;

      const startNormA = normalizeDayStart(rawStartA ?? rawEndA!);
      const endNormA = normalizeDayStart(rawEndA ?? startNormA);
      const spanDaysA = Math.max(1, diffDays(startNormA, endNormA) + 1);
      let rightA = (diffDays(windowStartTs, startNormA) + spanDaysA) * dayWidth;
      if (isDraggingA) {
        const origSpanA = Math.max(
          1,
          diffDays(dragState.origStart, dragState.origEnd) + 1,
        );
        const origLeftA = diffDays(windowStartTs, dragState.origStart) * dayWidth;
        const origWidthA = Math.max(dayWidth, origSpanA * dayWidth);
        if (dragState.mode === "move") {
          rightA = origLeftA + dragState.deltaPx + origWidthA;
        } else if (dragState.mode === "resize-end") {
          rightA = origLeftA + Math.max(dayWidth, origWidthA + dragState.deltaPx);
        } else {
          rightA = origLeftA + origWidthA;
        }
      }

      const startNormB = normalizeDayStart(rawStartB ?? rawEndB!);
      let leftB = diffDays(windowStartTs, startNormB) * dayWidth;
      if (isDraggingB) {
        const origSpanB = Math.max(
          1,
          diffDays(dragState.origStart, dragState.origEnd) + 1,
        );
        const origLeftB = diffDays(windowStartTs, dragState.origStart) * dayWidth;
        const origRightB = origLeftB + Math.max(dayWidth, origSpanB * dayWidth);
        if (dragState.mode === "move") {
          leftB = origLeftB + dragState.deltaPx;
        } else if (dragState.mode === "resize-start") {
          leftB = Math.min(origLeftB + dragState.deltaPx, origRightB - dayWidth);
        } else {
          leftB = origLeftB;
        }
      }

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
    const pending = pendingDates[`${order._id}-${stage.key}`];

    const rawStart = isDraggingThis
      ? dragState.previewStart
      : (pending?.start ?? order[stage.startField]);
    const rawEnd = isDraggingThis
      ? dragState.previewEnd
      : (pending?.end ?? order[stage.endField]);

    if (!rawStart && !rawEnd) {
      return null;
    }

    const startNorm = normalizeDayStart(rawStart ?? rawEnd!);
    const hasExplicitEnd = Boolean(rawEnd);
    const endNorm = normalizeDayStart(rawEnd ?? startNorm);
    const spanDays = Math.max(1, diffDays(startNorm, endNorm) + 1);

    let leftPx = diffDays(windowStartTs, startNorm) * dayWidth;
    let widthPx = Math.max(dayWidth, spanDays * dayWidth);

    if (isDraggingThis) {
      const origSpanDays = Math.max(
        1,
        diffDays(dragState.origStart, dragState.origEnd) + 1,
      );
      const origLeftPx = diffDays(windowStartTs, dragState.origStart) * dayWidth;
      const origWidthPx = Math.max(dayWidth, origSpanDays * dayWidth);
      if (dragState.mode === "move") {
        leftPx = origLeftPx + dragState.deltaPx;
        widthPx = origWidthPx;
      } else if (dragState.mode === "resize-start") {
        const origRightPx = origLeftPx + origWidthPx;
        leftPx = Math.min(origLeftPx + dragState.deltaPx, origRightPx - dayWidth);
        widthPx = origRightPx - leftPx;
      } else {
        leftPx = origLeftPx;
        widthPx = Math.max(dayWidth, origWidthPx + dragState.deltaPx);
      }
    }

    if (leftPx + widthPx < 0 || leftPx > timelineWidth) {
      return null;
    }

    const stageIdx = STAGE_ORDER[stage.key];
    const isDone = stageIdx < currentStageIdx;
    const isCurrent = stageIdx === currentStageIdx;
    const barBackground =
      stage.key === "installation" && order.installationTeamColor
        ? order.installationTeamColor
        : stage.color;

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
              deltaPx: 0,
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
          className={`group absolute z-10 rounded-lg text-white text-[11px] font-semibold flex items-center shadow-sm cursor-grab active:cursor-grabbing select-none overflow-hidden ${
            isDraggingThis
              ? "transition-none z-20 shadow-lg"
              : "transition-[left,width,box-shadow,opacity] duration-150 ease-out"
          } ${isCurrent ? "ring-2 ring-white/90 shadow-md" : ""}`}
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
                deltaPx: 0,
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
                deltaPx: 0,
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
            className={`absolute z-10 rounded-full bg-slate-200 border border-slate-300/70 overflow-hidden cursor-pointer ${
              isDraggingThis
                ? "transition-none"
                : "transition-[left,width] duration-150 ease-out"
            }`}
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
      ref={containerRef}
      className={`flex flex-col h-full overflow-hidden ${
        tvMode ? "rounded-none border-0" : "rounded-xl border"
      }`}
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

          {/* Stage / Status Filter Pills */}
          <div className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg bg-slate-100/80 border border-slate-200/70">
            <span className="text-slate-400 font-medium px-1">Status:</span>
            {STAGES.map((st, idx) => {
              const isSelected = stageFilter === st.key;
              const isDimmed = stageFilter !== "all" && !isSelected;
              return (
                <React.Fragment key={st.key}>
                  {idx > 0 && <span className="text-slate-300 select-none">➔</span>}
                  <button
                    type="button"
                    onClick={() =>
                      setStageFilter((prev) => (prev === st.key ? "all" : st.key))
                    }
                    title={
                      isSelected
                        ? `Wyłącz filtr: ${st.label}`
                        : `Pokaż tylko: ${st.label}`
                    }
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? "shadow-xs"
                        : isDimmed
                        ? "opacity-50 hover:opacity-100 hover:bg-white/70"
                        : "hover:bg-white/80"
                    }`}
                    style={{
                      background: isSelected ? st.color : "transparent",
                      color: isSelected ? "#ffffff" : st.color,
                    }}
                  >
                    <Diamond size={9} className="fill-current shrink-0" />
                    <span>{st.label}</span>
                  </button>
                </React.Fragment>
              );
            })}
            {stageFilter !== "all" && (
              <button
                type="button"
                onClick={() => setStageFilter("all")}
                className="p-0.5 ml-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-colors cursor-pointer"
                title="Pokaż wszystkie statusy"
              >
                <X size={11} />
              </button>
            )}
          </div>
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
                width: 165,
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

          {/* Team multiselect filter */}
          {(availableTeams.length > 0 || hasUnassignedTeamOrders) && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setContextMenu(null);
                  setAddStageMenu(null);
                  setUserFilterMenu(null);
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTeamFilterMenu((prev) =>
                    prev ? null : { x: rect.left, y: rect.bottom + 6 },
                  );
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  selectedTeamIds.length > 0
                    ? "bg-slate-900 text-white border-slate-900 hover:bg-slate-800"
                    : "hover:bg-slate-100"
                }`}
                style={
                  selectedTeamIds.length > 0
                    ? undefined
                    : {
                        borderColor: "var(--line)",
                        background: "var(--background, #f8fafc)",
                        color: "var(--text-strong)",
                      }
                }
                title="Filtruj po ekipie montażowej"
              >
                {selectedTeamIds.length > 0 ? (
                  <>
                    <span className="flex items-center -space-x-1">
                      {selectedTeamIds.slice(0, 3).map((tid) => {
                        const t = availableTeams.find((at) => at.id === tid);
                        return (
                          <span
                            key={tid}
                            className="w-2 h-2 rounded-full ring-1 ring-slate-900"
                            style={{ background: t?.color ?? "#94a3b8" }}
                          />
                        );
                      })}
                    </span>
                    <span className="max-w-[110px] truncate">
                      {selectedTeamIds.length === 1
                        ? selectedTeamIds[0] === "__none__"
                          ? "Bez ekipy"
                          : availableTeams.find(
                              (t) => t.id === selectedTeamIds[0],
                            )?.name ?? "1 ekipa"
                        : `Ekipy (${selectedTeamIds.length})`}
                    </span>
                  </>
                ) : (
                  <span>Wszystkie ekipy</span>
                )}
                <ChevronDown
                  size={12}
                  className={`shrink-0 transition-transform ${
                    teamFilterMenu ? "rotate-180" : ""
                  }`}
                />
              </button>

              {selectedTeamIds.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTeamIds([]);
                  }}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Wyczyść filtr ekip"
                >
                  <X size={12} />
                </button>
              )}
            </div>
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

          {!tvMode ? (
            <a
              href="/harmonogram-tv"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border hover:bg-slate-50 transition-colors"
              style={{
                borderColor: "var(--line)",
                background: "var(--background, #f8fafc)",
                color: "var(--text-strong)",
              }}
              title="Otwórz pełnoekranowy widok harmonogramu na telewizor"
            >
              <Tv size={13} />
              <span>Widok TV</span>
            </a>
          ) : (
            <div
              className="inline-flex items-center gap-2.5 pl-2.5 border-l"
              style={{ borderColor: "var(--line)" }}
            >
              <div className="text-right leading-tight">
                <div
                  className="text-xs font-bold tabular-nums"
                  style={{ color: "var(--text-strong)" }}
                >
                  {liveClockStr}
                </div>
                <div
                  className="text-[10px] capitalize"
                  style={{ color: "var(--text-mute)" }}
                >
                  {liveDateStr}
                </div>
              </div>

              <button
                type="button"
                onClick={() => void toggleFullscreen()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border hover:bg-slate-50 transition-colors cursor-pointer"
                style={{
                  borderColor: "var(--line)",
                  background: "var(--background, #f8fafc)",
                  color: "var(--text-strong)",
                }}
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 size={13} />
                    <span>Wyjdź</span>
                  </>
                ) : (
                  <>
                    <Maximize2 size={13} />
                    <span>Pełny ekran</span>
                  </>
                )}
              </button>

              {!isFullscreen && (
                <Link
                  href="/admin/harmonogram"
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg border hover:bg-slate-50 transition-colors"
                  style={{
                    borderColor: "var(--line)",
                    color: "var(--text-mute)",
                  }}
                  title="Powrót do panelu CRM"
                >
                  <ArrowLeft size={13} />
                  <span>CRM</span>
                </Link>
              )}
            </div>
          )}
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
            Widok uwzględnia wyłącznie zlecenia w realizacji (Kompletacja, Montaż).
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setStageFilter("all");
                setSelectedTeamIds([]);
                setSelectedUserIds([]);
              }}
              className="mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Wyczyść filtry
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Synchronized vertical scroll container */}
          <div
            ref={timelineScrollRef}
            className={`flex-1 overflow-auto relative ${isPanning ? "cursor-grabbing select-none" : ""}`}
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
                  className="sticky left-0 z-30 shrink-0 px-3.5 py-2 border-r flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wider shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]"
                  style={{
                    width: LEFT_PANEL_WIDTH,
                    borderColor: "var(--line, #e5e7eb)",
                    background: "#ffffff",
                    color: "var(--text-mute)",
                  }}
                >
                  <span className="truncate">Zlecenie / Klient</span>
                  {(availableUsers.length > 0 || hasUnassignedOrders) && (
                    <div className="flex items-center gap-1 shrink-0 normal-case tracking-normal">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setContextMenu(null);
                          setAddStageMenu(null);
                          const rect = e.currentTarget.getBoundingClientRect();
                          setUserFilterMenu((prev) =>
                            prev ? null : { x: rect.left, y: rect.bottom + 6 },
                          );
                        }}
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10.5px] font-semibold transition-colors cursor-pointer ${
                          selectedUserIds.length > 0
                            ? "bg-slate-900 text-white border-slate-900 hover:bg-slate-800"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                        title="Filtruj po przypisanym opiekunie"
                      >
                        {selectedUserIds.length > 0 ? (
                          <>
                            <span className="flex items-center -space-x-1">
                              {selectedUserIds.slice(0, 3).map((uid) => {
                                const u = availableUsers.find((au) => au.id === uid);
                                return (
                                  <span
                                    key={uid}
                                    className="w-2 h-2 rounded-full ring-1 ring-slate-900"
                                    style={{
                                      background: u?.color ?? "#94a3b8",
                                    }}
                                  />
                                );
                              })}
                            </span>
                            <span className="max-w-[70px] truncate">
                              {selectedUserIds.length === 1
                                ? selectedUserIds[0] === "__none__"
                                  ? "Bez os."
                                  : availableUsers.find(
                                      (u) => u.id === selectedUserIds[0],
                                    )?.name.split(" ")[0] ?? "1 os."
                                : `${selectedUserIds.length} os.`}
                            </span>
                          </>
                        ) : (
                          <>
                            <Users size={11} className="shrink-0" />
                            <span>Opiekun</span>
                          </>
                        )}
                        <ChevronDown
                          size={11}
                          className={`shrink-0 transition-transform ${
                            userFilterMenu ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      {selectedUserIds.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUserIds([]);
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Wyczyść filtr opiekuna"
                        >
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Timeline Header */}
                <div
                  style={{ width: timelineWidth }}
                  onPointerDown={handleTimelinePanStart}
                  className={`flex flex-col shrink-0 select-none ${
                    isPanning ? "cursor-grabbing" : "cursor-grab"
                  }`}
                >
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
                          className={`shrink-0 py-1 text-center border-r leading-tight select-none tabular-nums ${
                            zoom === "month" ? "text-[9px]" : "text-[10px]"
                          }`}
                        >
                          <div className={zoom === "month" ? "font-semibold" : "font-bold"}>
                            {d.getDate()}
                          </div>
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
                  const unscheduledStages = STAGES.filter(
                    (st) => !order[st.startField] || !order[st.endField],
                  );
                  const assigneeColors = (order.assignees ?? [])
                    .map((a) => a.color)
                    .filter((c): c is string => Boolean(c));
                  const assigneeNames = (order.assignees ?? [])
                    .map((a) => a.name)
                    .filter((n): n is string => Boolean(n))
                    .join(", ");
                  const userStripeBg =
                    assigneeColors.length > 1
                      ? `linear-gradient(to bottom, ${assigneeColors
                          .map((c, i) => {
                            const step = 100 / assigneeColors.length;
                            return `${c} ${i * step}%, ${c} ${(i + 1) * step}%`;
                          })
                          .join(", ")})`
                      : assigneeColors[0];

                  const isPlacingThisRow = placingStage?.order._id === order._id;
                  const isDimmedByPlacement = Boolean(placingStage && !isPlacingThisRow);

                  return (
                    <div
                      key={order._id}
                      className={`border-b transition-opacity duration-150 ${
                        isDimmedByPlacement
                          ? "opacity-45"
                          : isPlacingThisRow
                          ? "bg-sky-50/40"
                          : "hover:bg-slate-50/50"
                      }`}
                      style={{ borderColor: "var(--line, #e5e7eb)" }}
                    >
                      <div
                        className="flex"
                        style={{
                          minHeight: 58,
                          background: isPlacingThisRow
                            ? placingStage?.stageKey === "installation"
                              ? "rgba(5, 150, 105, 0.04)"
                              : "rgba(2, 132, 199, 0.04)"
                            : "var(--card, #fff)",
                        }}
                      >
                        {/* Left sticky cell */}
                        <div
                          className="sticky left-0 z-20 shrink-0 pl-4 pr-2.5 py-2 border-r flex items-center justify-between gap-2 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]"
                          style={{
                            width: LEFT_PANEL_WIDTH,
                            borderColor: "var(--line, #e5e7eb)",
                            background: "#ffffff",
                          }}
                        >
                          {userStripeBg && (
                            <div
                              className="absolute left-0 top-0 bottom-0 w-1.5"
                              style={{ background: userStripeBg }}
                              title={assigneeNames || undefined}
                            />
                          )}
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

                          {unscheduledStages.length > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setContextMenu(null);
                                if (isPlacingThisRow) {
                                  setPlacingStage(null);
                                  return;
                                }
                                if (unscheduledStages.length === 1) {
                                  setAddStageMenu(null);
                                  setPlacingStage({
                                    order,
                                    stageKey: unscheduledStages[0].key,
                                    hoverDayTs: null,
                                  });
                                  return;
                                }
                                const rect = e.currentTarget.getBoundingClientRect();
                                setAddStageMenu((prev) =>
                                  prev?.order._id === order._id
                                    ? null
                                    : {
                                        order,
                                        stages: unscheduledStages,
                                        x: rect.right + 6,
                                        y: rect.top,
                                      },
                                );
                              }}
                              title={
                                isPlacingThisRow
                                  ? "Anuluj umieszczanie etapu (Esc)"
                                  : unscheduledStages.length === 1
                                  ? `Umieść na osi: ${unscheduledStages[0].label}`
                                  : "Dodaj etap na oś czasu"
                              }
                              className={`w-6 h-6 shrink-0 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
                                isPlacingThisRow
                                  ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
                                  : "border-slate-200/90 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800 hover:border-slate-300"
                              }`}
                            >
                              {isPlacingThisRow ? <X size={13} /> : <Plus size={13} />}
                            </button>
                          )}
                        </div>

                        {/* Right timeline cell */}
                        <div
                          style={{
                            width: timelineWidth,
                            height: 58,
                          }}
                          onPointerDown={(e) => {
                            if (isPlacingThisRow && placingStage) {
                              e.stopPropagation();
                              if (e.button !== 0) {
                                setPlacingStage(null);
                                return;
                              }
                              const rect = e.currentTarget.getBoundingClientRect();
                              const dayIdx = Math.floor(
                                (e.clientX - rect.left) / dayWidth,
                              );
                              if (dayIdx >= 0 && dayIdx < totalDays) {
                                void handlePlaceStageBar(
                                  order,
                                  placingStage.stageKey,
                                  addDays(windowStartTs, dayIdx),
                                );
                              }
                              return;
                            }
                            handleTimelinePanStart(e);
                          }}
                          onPointerMove={(e) => {
                            if (!isPlacingThisRow) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            const dayIdx = Math.floor(
                              (e.clientX - rect.left) / dayWidth,
                            );
                            if (dayIdx >= 0 && dayIdx < totalDays) {
                              const nextTs = addDays(windowStartTs, dayIdx);
                              setPlacingStage((prev) =>
                                prev && prev.hoverDayTs !== nextTs
                                  ? { ...prev, hoverDayTs: nextTs }
                                  : prev,
                              );
                            }
                          }}
                          onPointerLeave={() => {
                            if (!isPlacingThisRow) return;
                            setPlacingStage((prev) =>
                              prev ? { ...prev, hoverDayTs: null } : null,
                            );
                          }}
                          onContextMenu={(e) => {
                            if (isPlacingThisRow) {
                              e.preventDefault();
                              setPlacingStage(null);
                            }
                          }}
                          className={`relative shrink-0 select-none ${
                            isPlacingThisRow
                              ? "cursor-crosshair"
                              : isPanning
                              ? "cursor-grabbing"
                              : "cursor-grab"
                          }`}
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
                          {stageFilter === "all" && renderConnectors(order)}

                          {/* Milestone bars */}
                          {STAGES.filter(
                            (stage) =>
                              stageFilter === "all" || stage.key === stageFilter,
                          ).map((stage) =>
                            renderStageBar(order, stage, currentStageIdx),
                          )}

                          {/* Ghost preview bar during placement mode */}
                          {isPlacingThisRow &&
                            placingStage &&
                            placingStage.hoverDayTs !== null &&
                            (() => {
                              const ghostStage = STAGE_BY_KEY[placingStage.stageKey];
                              const ghostDays =
                                placingStage.stageKey === "kitting" ? 3 : 2;
                              const ghostLeftPx =
                                diffDays(windowStartTs, placingStage.hoverDayTs) *
                                dayWidth;
                              const ghostWidthPx = Math.max(
                                dayWidth,
                                ghostDays * dayWidth,
                              );
                              const ghostColor =
                                placingStage.stageKey === "installation" &&
                                order.installationTeamColor
                                  ? order.installationTeamColor
                                  : ghostStage.color;
                              const ghostEndTs = addDays(
                                placingStage.hoverDayTs,
                                ghostDays - 1,
                              );
                              const shortStart = new Date(
                                placingStage.hoverDayTs,
                              ).toLocaleDateString("pl-PL", {
                                day: "2-digit",
                                month: "2-digit",
                              });
                              const shortEnd = new Date(
                                ghostEndTs,
                              ).toLocaleDateString("pl-PL", {
                                day: "2-digit",
                                month: "2-digit",
                              });
                              return (
                                <div
                                  style={{
                                    left: ghostLeftPx,
                                    width: ghostWidthPx,
                                    top: 8,
                                    height: 32,
                                    background: `${ghostColor}30`,
                                    border: `2px dashed ${ghostColor}`,
                                    color: ghostColor,
                                  }}
                                  className="absolute z-30 rounded-lg px-2.5 flex items-center gap-1.5 text-[11px] font-bold pointer-events-none select-none overflow-hidden shadow-xs"
                                >
                                  <span className="truncate">
                                    {ghostStage.label} ({ghostDays}d)
                                  </span>
                                  <span className="text-[10px] font-mono opacity-85 shrink-0">
                                    {shortStart}–{shortEnd}
                                  </span>
                                </div>
                              );
                            })()}
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
      {hoveredBar && !dragState && !contextMenu && !isPanning && (
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

      {/* Add Stage Popover Menu (from mini '+' CTA in left column) */}
      {addStageMenu && (
        <div
          ref={addStageMenuRef}
          role="menu"
          style={{
            left:
              typeof window !== "undefined"
                ? Math.min(addStageMenu.x, window.innerWidth - 216)
                : addStageMenu.x,
            top:
              typeof window !== "undefined"
                ? Math.min(addStageMenu.y, window.innerHeight - 130)
                : addStageMenu.y,
          }}
          className="fixed z-50 min-w-[200px] rounded-xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.24),0_2px_6px_rgba(15,23,42,0.08)] p-1 text-[12.5px] text-slate-700 select-none"
        >
          <div className="px-2.5 py-1 text-[11px] font-medium text-slate-400">
            Dodaj etap na oś
          </div>
          <div className="my-1 border-t border-slate-200/80" />
          {addStageMenu.stages.map((st) => {
            const defaultDays = st.key === "kitting" ? 3 : 2;
            return (
              <button
                key={st.key}
                type="button"
                role="menuitem"
                onClick={() => {
                  const targetOrder = addStageMenu.order;
                  setAddStageMenu(null);
                  setPlacingStage({
                    order: targetOrder,
                    stageKey: st.key,
                    hoverDayTs: null,
                  });
                }}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-slate-100 active:bg-slate-200/70 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2 font-medium">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: st.color }}
                  />
                  <span>{st.label}</span>
                </span>
                <span className="text-[11px] text-slate-400 tabular-nums">
                  {defaultDays} dni
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* User Filter Popover Menu (from CTA in ZLECENIE / KLIENT header) */}
      {userFilterMenu && (
        <div
          ref={userFilterMenuRef}
          role="menu"
          style={{
            left:
              typeof window !== "undefined"
                ? Math.min(userFilterMenu.x, window.innerWidth - 240)
                : userFilterMenu.x,
            top:
              typeof window !== "undefined"
                ? Math.min(userFilterMenu.y, window.innerHeight - 280)
                : userFilterMenu.y,
          }}
          className="fixed z-50 min-w-[224px] max-w-[260px] rounded-xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.24),0_2px_6px_rgba(15,23,42,0.08)] p-1.5 text-xs text-slate-700 select-none"
        >
          <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-medium text-slate-400">
            <span>Filtruj po opiekunie</span>
            {selectedUserIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedUserIds([])}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                Wyczyść
              </button>
            )}
          </div>
          <div className="my-1 border-t border-slate-200/80" />
          <div className="max-h-60 overflow-y-auto space-y-0.5">
            {availableUsers.map((u) => {
              const isSelected = selectedUserIds.includes(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={isSelected}
                  onClick={() => toggleUserFilter(u.id)}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-slate-900 text-white font-semibold"
                      : "text-slate-700 font-medium hover:bg-slate-100"
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-black/10"
                      style={{ background: u.color ?? "#94a3b8" }}
                    />
                    <span className="truncate">{u.name}</span>
                  </span>
                  {isSelected && (
                    <Check size={13} className="stroke-[2.5] shrink-0" />
                  )}
                </button>
              );
            })}

            {hasUnassignedOrders && (
              <>
                {availableUsers.length > 0 && (
                  <div className="my-1 border-t border-slate-100" />
                )}
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={selectedUserIds.includes("__none__")}
                  onClick={() => toggleUserFilter("__none__")}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                    selectedUserIds.includes("__none__")
                      ? "bg-slate-900 text-white font-semibold"
                      : "text-slate-500 font-medium hover:bg-slate-100 hover:text-slate-800"
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0 truncate">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-dashed border-slate-400" />
                    <span className="truncate">Bez przypisanego</span>
                  </span>
                  {selectedUserIds.includes("__none__") && (
                    <Check size={13} className="stroke-[2.5] shrink-0" />
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Team Multiselect Filter Popover Menu */}
      {teamFilterMenu && (
        <div
          ref={teamFilterMenuRef}
          role="menu"
          style={{
            left:
              typeof window !== "undefined"
                ? Math.min(teamFilterMenu.x, window.innerWidth - 240)
                : teamFilterMenu.x,
            top:
              typeof window !== "undefined"
                ? Math.min(teamFilterMenu.y, window.innerHeight - 280)
                : teamFilterMenu.y,
          }}
          className="fixed z-50 min-w-[224px] max-w-[260px] rounded-xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.24),0_2px_6px_rgba(15,23,42,0.08)] p-1.5 text-xs text-slate-700 select-none"
        >
          <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-medium text-slate-400">
            <span>Filtruj po ekipie</span>
            {selectedTeamIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedTeamIds([])}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                Wyczyść
              </button>
            )}
          </div>
          <div className="my-1 border-t border-slate-200/80" />
          <div className="max-h-60 overflow-y-auto space-y-0.5">
            {availableTeams.map((t) => {
              const isSelected = selectedTeamIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={isSelected}
                  onClick={() => toggleTeamFilter(t.id)}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-slate-900 text-white font-semibold"
                      : "text-slate-700 font-medium hover:bg-slate-100"
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-black/10"
                      style={{ background: t.color ?? "#059669" }}
                    />
                    <span className="truncate">{t.name}</span>
                  </span>
                  {isSelected && (
                    <Check size={13} className="stroke-[2.5] shrink-0" />
                  )}
                </button>
              );
            })}

            {hasUnassignedTeamOrders && (
              <>
                {availableTeams.length > 0 && (
                  <div className="my-1 border-t border-slate-100" />
                )}
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={selectedTeamIds.includes("__none__")}
                  onClick={() => toggleTeamFilter("__none__")}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                    selectedTeamIds.includes("__none__")
                      ? "bg-slate-900 text-white font-semibold"
                      : "text-slate-500 font-medium hover:bg-slate-100 hover:text-slate-800"
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0 truncate">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-dashed border-slate-400" />
                    <span className="truncate">Bez ekipy</span>
                  </span>
                  {selectedTeamIds.includes("__none__") && (
                    <Check size={13} className="stroke-[2.5] shrink-0" />
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Placement Mode Floating Helper Pill */}
      {placingStage && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-slate-900/95 text-white text-xs shadow-xl border border-white/10 backdrop-blur-md">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{
              background:
                placingStage.stageKey === "installation" &&
                placingStage.order.installationTeamColor
                  ? placingStage.order.installationTeamColor
                  : STAGE_BY_KEY[placingStage.stageKey].color,
            }}
          />
          <span>
            Kliknij dzień w wierszu{" "}
            <strong className="font-semibold">
              {placingStage.order.customText?.trim() || placingStage.order.name}
            </strong>
            , aby umieścić:{" "}
            <strong className="font-semibold">
              {STAGE_BY_KEY[placingStage.stageKey].label}
            </strong>
          </span>
          <button
            type="button"
            onClick={() => setPlacingStage(null)}
            className="ml-1 px-2 py-0.5 rounded-full bg-white/15 hover:bg-white/25 text-[11px] font-semibold transition-colors cursor-pointer"
          >
            Anuluj (Esc)
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
