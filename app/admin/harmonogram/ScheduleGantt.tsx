"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import toast from "react-hot-toast";
import {
  Calendar,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

const MS_PER_DAY = 86_400_000;

type StageKey = "kitting" | "production" | "installation";
type ZoomLevel = "day" | "week" | "month";

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
    color: "#14b8a6",
    bg: "rgba(20, 184, 166, 0.16)",
    border: "rgba(20, 184, 166, 0.50)",
    startField: "installationPhaseStartDate",
    endField: "installationPhaseEndDate",
  },
];

const STAGE_BY_KEY = Object.fromEntries(STAGES.map((s) => [s.key, s])) as Record<
  StageKey,
  (typeof STAGES)[number]
>;

interface ScheduleOrder {
  _id: Id<"orders">;
  clientId: Id<"clients">;
  name: string;
  clientName: string;
  investmentCity: string;
  services: string[];
  status: string;
  statusLabel: string;
  stageKey: StageKey;
  statusChangedAt: number;
  installationTeamId?: Id<"installationTeams">;
  installationTeamName?: string;
  installationTeamColor?: string;
  completionStartDate?: number;
  completionEndDate?: number;
  productionStartDate?: number;
  productionEndDate?: number;
  installationPhaseStartDate?: number;
  installationPhaseEndDate?: number;
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
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function diffDays(startTs: number, endTs: number): number {
  return Math.round((normalizeDayStart(endTs) - normalizeDayStart(startTs)) / MS_PER_DAY);
}

function tsToDateInput(ts?: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateInputToTs(str: string): number | undefined {
  if (!str) return undefined;
  const [y, m, d] = str.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

function formatPlDate(ts?: number): string {
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

  const [selectedStages, setSelectedStages] = useState<Set<StageKey>>(
    () => new Set<StageKey>(["kitting", "production", "installation"]),
  );
  const [onlyUnscheduled, setOnlyUnscheduled] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [zoom, setZoom] = useState<ZoomLevel>("day");
  const [windowStartTs, setWindowStartTs] = useState<number>(() =>
    addDays(normalizeDayStart(Date.now()), -14),
  );
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(() => new Set());
  const [editingTarget, setEditingTarget] = useState<{
    order: ScheduleOrder;
    focusStage?: StageKey;
  } | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoveredBar, setHoveredBar] = useState<{
    order: ScheduleOrder;
    stage: (typeof STAGES)[number];
    start: number;
    end?: number;
    x: number;
    y: number;
  } | null>(null);

  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);

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
      if (!selectedStages.has(o.stageKey)) return false;
      if (teamFilter !== "all" && o.installationTeamId !== teamFilter) return false;
      if (onlyUnscheduled) {
        const currentStage = STAGE_BY_KEY[o.stageKey];
        const hasStart = Boolean(o[currentStage.startField]);
        const hasEnd = Boolean(o[currentStage.endField]);
        if (hasStart && hasEnd) return false;
      }
      if (q) {
        const hay = `${o.name} ${o.clientName} ${o.investmentCity}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, selectedStages, teamFilter, onlyUnscheduled, searchTerm]);

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
  }, [isDragging, dayWidth, updateOrder]);

  const toggleStageFilter = (key: StageKey) => {
    setSelectedStages((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleExpandedOrder = (id: string) => {
    setExpandedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const todayOffsetDays = diffDays(windowStartTs, todayTs);
  const timelineWidth = totalDays * dayWidth;

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

          {/* Stage pills */}
          <div className="flex items-center gap-1.5">
            {STAGES.map((stage) => {
              const active = selectedStages.has(stage.key);
              return (
                <button
                  key={stage.key}
                  type="button"
                  onClick={() => toggleStageFilter(stage.key)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer"
                  style={{
                    background: active ? stage.bg : "transparent",
                    color: active ? stage.color : "var(--text-mute)",
                    border: `1.5px solid ${active ? stage.color : "var(--line)"}`,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: active ? stage.color : "var(--text-mute)" }}
                  />
                  {stage.label}
                </button>
              );
            })}
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

      {/* Main Split-Pane Gantt */}
      {orders === undefined ? (
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
            Widok uwzględnia wyłącznie zlecenia w statusach Kompletacja, Produkcja oraz Montaż.
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
            <div style={{ minWidth: 320 + timelineWidth }} className="flex flex-col">
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
                  className="sticky left-0 z-30 shrink-0 w-[320px] px-4 py-2 border-r flex items-center justify-between text-[11px] font-bold uppercase tracking-wider"
                  style={{
                    borderColor: "var(--line, #e5e7eb)",
                    background: "var(--panel, #fff)",
                    color: "var(--text-mute)",
                  }}
                >
                  <span>Zlecenie / Klient</span>
                  <span>Etapy</span>
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
                      left: 320 + todayOffsetDays * dayWidth + Math.floor(dayWidth / 2),
                      width: 2,
                      background: "rgba(239, 68, 68, 0.55)",
                    }}
                  />
                )}

                {filteredOrders.map((order) => {
                  const isExpanded = expandedOrderIds.has(order._id);
                  const activeStageMeta = STAGE_BY_KEY[order.stageKey];
                  const subRows = isExpanded ? STAGES : [null];

                  return (
                    <div
                      key={order._id}
                      className="border-b"
                      style={{ borderColor: "var(--line, #e5e7eb)" }}
                    >
                      {subRows.map((subStage) => {
                        const stagesToRender = subStage ? [subStage] : STAGES;
                        const rowHeight = subStage ? 36 : 52;

                        return (
                          <div
                            key={subStage ? subStage.key : "compact"}
                            className="flex"
                            style={{ minHeight: rowHeight }}
                          >
                            {/* Left sticky cell */}
                            <div
                              className="sticky left-0 z-10 shrink-0 w-[320px] px-3 py-1.5 border-r flex items-center justify-between gap-2"
                              style={{
                                borderColor: "var(--line, #e5e7eb)",
                                background: subStage ? "#fafbfc" : "var(--card, #fff)",
                              }}
                            >
                              {!subStage ? (
                                <>
                                  <div className="flex items-start gap-1.5 min-w-0 flex-1">
                                    <button
                                      type="button"
                                      onClick={() => toggleExpandedOrder(order._id)}
                                      className="mt-0.5 p-0.5 rounded hover:bg-slate-100 cursor-pointer shrink-0"
                                      title={isExpanded ? "Zwiń etapy" : "Rozwiń 3 etapy"}
                                    >
                                      <ChevronDown
                                        size={13}
                                        className={`transition-transform ${isExpanded ? "" : "-rotate-90"}`}
                                      />
                                    </button>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5">
                                        <Link
                                          href={`/admin/klient/${order.clientId}/zlecenie/${order._id}`}
                                          className="text-xs font-bold hover:underline truncate inline-flex items-center gap-1"
                                          style={{ color: "var(--text-strong)" }}
                                        >
                                          {order.name}
                                          <ExternalLink size={10} className="opacity-50 shrink-0" />
                                        </Link>
                                        <span
                                          className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full shrink-0"
                                          style={{
                                            background: activeStageMeta.bg,
                                            color: activeStageMeta.color,
                                            border: `1px solid ${activeStageMeta.border}`,
                                          }}
                                        >
                                          {order.statusLabel}
                                        </span>
                                      </div>
                                      <div
                                        className="text-[11px] truncate"
                                        style={{ color: "var(--text-mute)" }}
                                      >
                                        {order.clientName}
                                        {order.investmentCity ? ` • ${order.investmentCity}` : ""}
                                        {order.installationTeamName
                                          ? ` • ${order.installationTeamName}`
                                          : ""}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    {STAGES.map((st) => {
                                      const hasStart = Boolean(order[st.startField]);
                                      const hasEnd = Boolean(order[st.endField]);
                                      const isPlanned = hasStart && hasEnd;
                                      const shortLetter = st.key === "kitting" ? "K" : st.key === "production" ? "P" : "M";
                                      const tooltip = isPlanned
                                        ? `${st.label}: ${formatPlDate(order[st.startField])} – ${formatPlDate(order[st.endField])}`
                                        : `Zaplanuj ${st.label}`;

                                      return (
                                        <button
                                          key={st.key}
                                          type="button"
                                          title={tooltip}
                                          onClick={() =>
                                            setEditingTarget({ order, focusStage: st.key })
                                          }
                                          className="h-6 min-w-[24px] px-1.5 rounded text-[10px] font-bold transition-opacity hover:opacity-85 cursor-pointer inline-flex items-center justify-center"
                                          style={{
                                            background: isPlanned ? st.bg : "transparent",
                                            color: st.color,
                                            border: `1px ${isPlanned ? "solid" : "dashed"} ${st.border}`,
                                          }}
                                        >
                                          {isPlanned ? shortLetter : `+${shortLetter}`}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="pl-6 flex items-center gap-2 text-[11px] min-w-0">
                                    <span
                                      className="w-2 h-2 rounded-full shrink-0"
                                      style={{ background: subStage.color }}
                                    />
                                    <span className="font-medium truncate" style={{ color: "var(--text)" }}>
                                      {subStage.label}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingTarget({ order, focusStage: subStage.key })
                                    }
                                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded hover:bg-slate-100 cursor-pointer shrink-0"
                                    style={{ color: subStage.color }}
                                  >
                                    {order[subStage.startField] && order[subStage.endField]
                                      ? "Zmień"
                                      : "+ Zaplanuj"}
                                  </button>
                                </>
                              )}
                            </div>

                            {/* Right timeline cell */}
                            <div
                              style={{
                                width: timelineWidth,
                                height: rowHeight,
                                background: subStage ? "#fafbfc" : "var(--card, #fff)",
                              }}
                              className="relative shrink-0"
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

                              {/* Bars */}
                              {stagesToRender.map((stage) => {
                                const isDraggingThis =
                                  dragState?.orderId === order._id &&
                                  dragState.stageKey === stage.key;

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

                                return (
                                  <div
                                    key={stage.key}
                                    onPointerDown={(e) => {
                                      if ((e.target as HTMLElement).dataset.resizeHandle) return;
                                      e.preventDefault();
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
                                      top: subStage ? 6 : 11,
                                      height: subStage ? 24 : 30,
                                      background: stage.color,
                                      borderStyle: hasExplicitEnd ? "solid" : "dashed",
                                      borderWidth: hasExplicitEnd ? 0 : 1.5,
                                      borderColor: "#fff",
                                      opacity: isDraggingThis ? 0.85 : 1,
                                    }}
                                    className="group absolute z-10 rounded-md text-white text-[11px] font-semibold flex items-center px-2 shadow-sm cursor-grab active:cursor-grabbing select-none overflow-hidden"
                                  >
                                    {/* Left resize handle */}
                                    <div
                                      data-resize-handle="left"
                                      onPointerDown={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
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
                                      className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/30"
                                    />

                                    <span className="truncate pointer-events-none">
                                      {hasExplicitEnd
                                        ? `${stage.label} (${spanDays}d)`
                                        : `${stage.label} • ustaw koniec`}
                                    </span>

                                    {/* Right resize handle */}
                                    <div
                                      data-resize-handle="right"
                                      onPointerDown={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
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
                                      className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/30"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hover Tooltip */}
      {hoveredBar && !dragState && (
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
            {hoveredBar.order.name} • {hoveredBar.stage.label}
          </div>
          <div className="text-[11px] opacity-85">{hoveredBar.order.clientName}</div>
          <div className="text-[11px] mt-1 font-mono">
            {formatPlDate(hoveredBar.start)} – {formatPlDate(hoveredBar.end)}
            {hoveredBar.end
              ? ` (${Math.max(1, diffDays(hoveredBar.start, hoveredBar.end) + 1)} dni)`
              : " (brak daty końca)"}
          </div>
        </div>
      )}

      {/* Stage Dates Edit Modal */}
      {editingTarget && (
        <StageDatesModal
          order={editingTarget.order}
          focusStage={editingTarget.focusStage}
          onClose={() => setEditingTarget(null)}
          onSave={async (patch) => {
            await updateOrder({
              orderId: editingTarget.order._id,
              ...patch,
            });
            toast.success("Zapisano daty etapów");
            setEditingTarget(null);
          }}
        />
      )}
    </div>
  );
}

function StageDatesModal({
  order,
  focusStage,
  onClose,
  onSave,
}: {
  order: ScheduleOrder;
  focusStage?: StageKey;
  onClose: () => void;
  onSave: (patch: {
    completionStartDate: number | null;
    completionEndDate: number | null;
    productionStartDate: number | null;
    productionEndDate: number | null;
    installationPhaseStartDate: number | null;
    installationPhaseEndDate: number | null;
  }) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, string>>({
    completionStartDate: tsToDateInput(order.completionStartDate),
    completionEndDate: tsToDateInput(order.completionEndDate),
    productionStartDate: tsToDateInput(order.productionStartDate),
    productionEndDate: tsToDateInput(order.productionEndDate),
    installationPhaseStartDate: tsToDateInput(order.installationPhaseStartDate),
    installationPhaseEndDate: tsToDateInput(order.installationPhaseEndDate),
  });
  const [saving, setSaving] = useState(false);

  const applyPreset = (
    startField: string,
    endField: string,
    daysCount: number,
  ) => {
    const baseTs = dateInputToTs(values[startField]) ?? normalizeDayStart(Date.now());
    const endTs = addDays(baseTs, daysCount - 1);
    setValues((prev) => ({
      ...prev,
      [startField]: tsToDateInput(baseTs),
      [endField]: tsToDateInput(endTs),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    for (const stage of STAGES) {
      const s = dateInputToTs(values[stage.startField]);
      const end = dateInputToTs(values[stage.endField]);
      if (s !== undefined && end !== undefined && end < s) {
        toast.error(`${stage.label}: data końca nie może być wcześniejsza niż data początku.`);
        return;
      }
    }
    setSaving(true);
    try {
      await onSave({
        completionStartDate: dateInputToTs(values.completionStartDate) ?? null,
        completionEndDate: dateInputToTs(values.completionEndDate) ?? null,
        productionStartDate: dateInputToTs(values.productionStartDate) ?? null,
        productionEndDate: dateInputToTs(values.productionEndDate) ?? null,
        installationPhaseStartDate: dateInputToTs(values.installationPhaseStartDate) ?? null,
        installationPhaseEndDate: dateInputToTs(values.installationPhaseEndDate) ?? null,
      });
    } catch (err) {
      console.error(err);
      toast.error("Błąd zapisu dat.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-xl border p-5 shadow-xl space-y-4"
        style={{ background: "var(--card, #fff)", borderColor: "var(--line, #e5e7eb)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold" style={{ color: "var(--text-strong)" }}>
              Daty etapów — {order.name}
            </h2>
            <p className="text-xs" style={{ color: "var(--text-mute)" }}>
              {order.clientName}
              {order.investmentCity ? ` • ${order.investmentCity}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-slate-100 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          {STAGES.map((stage) => {
            const isFocused = focusStage === stage.key;
            return (
              <div
                key={stage.key}
                className="rounded-lg border p-3 space-y-2"
                style={{
                  borderColor: isFocused ? stage.color : "var(--line)",
                  background: isFocused ? stage.bg : "var(--background, #f8fafc)",
                }}
              >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: stage.color }}
                  />
                  <span className="text-xs font-bold" style={{ color: "var(--text-strong)" }}>
                    {stage.label}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {[3, 7, 14].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => applyPreset(stage.startField, stage.endField, d)}
                      className="px-1.5 py-0.5 text-[10px] font-semibold rounded border hover:bg-white cursor-pointer"
                      style={{ borderColor: "var(--line)", color: "var(--text-mute)" }}
                    >
                      +{d}d
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setValues((prev) => ({
                        ...prev,
                        [stage.startField]: "",
                        [stage.endField]: "",
                      }))
                    }
                    className="px-1.5 py-0.5 text-[10px] font-semibold rounded border hover:bg-white cursor-pointer"
                    style={{ borderColor: "var(--line)", color: "#dc2626" }}
                  >
                    Wyczyść
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] font-medium" style={{ color: "var(--text-mute)" }}>
                  Początek
                  <input
                    type="date"
                    autoFocus={focusStage === stage.key}
                    value={values[stage.startField]}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [stage.startField]: e.target.value }))
                    }
                    className="mt-1 w-full rounded-md border px-2.5 py-1.5 text-xs bg-white"
                    style={{ borderColor: "var(--line)", color: "var(--text-strong)" }}
                  />
                </label>
                <label className="text-[11px] font-medium" style={{ color: "var(--text-mute)" }}>
                  Koniec
                  <input
                    type="date"
                    value={values[stage.endField]}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [stage.endField]: e.target.value }))
                    }
                    className="mt-1 w-full rounded-md border px-2.5 py-1.5 text-xs bg-white"
                    style={{ borderColor: "var(--line)", color: "var(--text-strong)" }}
                  />
                </label>
              </div>
            </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer"
            style={{ borderColor: "var(--line)", color: "var(--text-strong)" }}
          >
            Anuluj
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn primary px-4 py-1.5 text-xs font-semibold rounded-lg cursor-pointer"
          >
            {saving ? "Zapisywanie…" : "Zapisz daty"}
          </button>
        </div>
      </form>
    </div>
  );
}
