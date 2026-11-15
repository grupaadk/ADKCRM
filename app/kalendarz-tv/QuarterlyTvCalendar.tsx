"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  classifyTvEventCategory,
  expandEventToDateKeys,
  formatDateKey,
  getMonthGridDays,
  getQuarterMonths,
  TV_WEEKDAYS,
  type TvEventCategory,
} from "@/lib/tvCalendar";

interface TvCalendarEventItem {
  id: string;
  title: string;
  subtitle?: string;
  category: TvEventCategory;
  color: string;
  startDate: number;
  endDate?: number;
  isAllDay: boolean;
  teamName?: string;
  supplierName?: string;
  orderName?: string;
  clientName?: string;
  description?: string;
  eventTypeName?: string;
}

const CATEGORY_CONFIG: Array<{
  key: TvEventCategory;
  label: string;
  defaultColor: string;
}> = [
  { key: "montaz", label: "Montaże", defaultColor: "#3b82f6" },
  { key: "serwis", label: "Serwisy", defaultColor: "#f59e0b" },
  { key: "dostawa", label: "Dostawy", defaultColor: "#10b981" },
  { key: "inne", label: "Pozostałe", defaultColor: "#64748b" },
];

const STORAGE_KEY = "adkcrm_tv_calendar_categories_v1";
const DEFAULT_CATEGORIES: TvEventCategory[] = ["montaz", "serwis", "dostawa"];
const MAX_VISIBLE_PILLS_PER_DAY = 3;

function formatTimeRange(startMs: number, endMs?: number, isAllDay?: boolean): string {
  if (isAllDay) return "Cały dzień";
  const fmt = (ms: number) =>
    new Date(ms).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  if (endMs && endMs > startMs) {
    return `${fmt(startMs)} – ${fmt(endMs)}`;
  }
  return fmt(startMs);
}

export default function QuarterlyTvCalendar() {
  const containerRef = useRef<HTMLDivElement>(null);

  const [now, setNow] = useState<Date>(() => new Date());
  const [baseYear, setBaseYear] = useState<number>(() => new Date().getFullYear());
  const [baseMonth, setBaseMonth] = useState<number>(() => new Date().getMonth());
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [activeCategories, setActiveCategories] = useState<Set<TvEventCategory>>(() => {
    if (typeof window === "undefined") return new Set(DEFAULT_CATEGORIES);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as TvEventCategory[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return new Set(parsed);
        }
      }
    } catch {
      // ignore storage errors
    }
    return new Set(DEFAULT_CATEGORIES);
  });

  const [selectedDayModal, setSelectedDayModal] = useState<{
    dateKey: string;
    label: string;
    events: TvCalendarEventItem[];
  } | null>(null);

  // Zegar na żywo + automatyczne wykrycie zmiany dnia po północy (TV 24/7)
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(activeCategories)));
    } catch {
      // ignore
    }
  }, [activeCategories]);

  const todayKey = formatDateKey(now);
  const months = useMemo(() => getQuarterMonths(baseYear, baseMonth), [baseYear, baseMonth]);

  const rangeStartMs = months[0].startMs;
  const rangeEndMs = months[months.length - 1].endMs;

  const calendarEvents = useQuery(api.calendarEvents.getEvents, {
    startDate: rangeStartMs,
    endDate: rangeEndMs,
  });
  const linkedOrderEvents = useQuery(api.calendarEvents.getLinkedOrderEvents, {
    startDate: rangeStartMs,
    endDate: rangeEndMs,
  });
  const allOrders = useQuery(api.orders.listForPicker);
  const allUsers = useQuery(api.users.listAllActive);
  const installationTeamsRaw = useQuery(api.installationTeams.listActive);
  const installationTeams = useMemo(() => installationTeamsRaw ?? [], [installationTeamsRaw]);

  const eventsByDateKey = useMemo(() => {
    const map = new Map<string, TvCalendarEventItem[]>();
    const userColorMap = new Map(
      (allUsers ?? [])
        .filter((u) => Boolean(u.color))
        .map((u) => [u._id, u.color as string]),
    );
    const teamMap = new Map(installationTeams.map((t) => [t._id, t]));
    const orderMap = new Map((allOrders ?? []).map((o) => [o._id, o]));

    const pushToDays = (item: TvCalendarEventItem) => {
      if (!activeCategories.has(item.category)) return;
      const keys = expandEventToDateKeys(item.startDate, item.endDate, rangeStartMs, rangeEndMs);
      for (const key of keys) {
        const list = map.get(key);
        if (list) {
          list.push(item);
        } else {
          map.set(key, [item]);
        }
      }
    };

    if (calendarEvents) {
      for (const e of calendarEvents) {
        if (e.isPrivate) continue;
        const linkedOrder = e.orderId ? orderMap.get(e.orderId) : undefined;
        const teamId =
          e.installationTeamId ??
          (linkedOrder as { installationTeamId?: string } | undefined)?.installationTeamId;
        const team = teamId ? teamMap.get(teamId as (typeof installationTeams)[number]["_id"]) : undefined;
        const supplierId = e.eventType?.linkedSupplierId;
        const category = classifyTvEventCategory({
          eventTypeName: e.eventType?.name,
          supplierId,
          installationTeamId: teamId,
        });

        let assignedColor: string | undefined;
        for (const uid of e.assignedUserIds ?? []) {
          const col = userColorMap.get(uid);
          if (col) {
            assignedColor = col;
            break;
          }
        }

        const clientName = (linkedOrder as { clientName?: string | null } | undefined)?.clientName ?? undefined;
        const orderName = (linkedOrder as { name?: string | null } | undefined)?.name ?? undefined;
        const color = team?.color ?? assignedColor ?? e.eventType?.color ?? "#64748b";

        pushToDays({
          id: e._id,
          title: clientName || e.title,
          subtitle: orderName && clientName ? orderName : e.title !== clientName ? e.title : undefined,
          category,
          color,
          startDate: e.startDate,
          endDate: e.endDate,
          isAllDay: e.isAllDay,
          teamName: team?.name,
          orderName,
          clientName,
          description: e.description,
          eventTypeName: e.eventType?.name,
        });
      }
    }

    if (linkedOrderEvents) {
      for (const le of linkedOrderEvents) {
        const category = classifyTvEventCategory({
          field: le.field,
          eventTypeName: le.eventTypeName,
          supplierId: le.supplierId,
          installationTeamId: le.installationTeamId,
        });

        const assignedUserIds = le.assignedUserIds ?? (le.assignedUserId ? [le.assignedUserId] : []);
        let assignedColor: string | undefined;
        for (const uid of assignedUserIds) {
          const col = userColorMap.get(uid as NonNullable<typeof allUsers>[number]["_id"]);
          if (col) {
            assignedColor = col;
            break;
          }
        }

        const color = le.installationTeamColor ?? assignedColor ?? le.color ?? "#3b82f6";
        const displayTitle = le.clientName || le.orderName || "Zlecenie";
        const subParts = [le.orderName, le.installationTeamName || le.supplierName].filter(Boolean);

        pushToDays({
          id: le.id,
          title: displayTitle,
          subtitle: subParts.length > 0 ? subParts.join(" · ") : undefined,
          category,
          color,
          startDate: le.startDate,
          endDate: (le as { endDate?: number }).endDate,
          isAllDay: !le.hasTime,
          teamName: le.installationTeamName,
          supplierName: le.supplierName,
          orderName: le.orderName,
          clientName: le.clientName,
          description: le.customText || le.serviceName,
          eventTypeName: le.eventTypeName,
        });
      }
    }

    for (const [, list] of map) {
      list.sort((a, b) => a.startDate - b.startDate || a.title.localeCompare(b.title, "pl"));
    }

    return map;
  }, [
    calendarEvents,
    linkedOrderEvents,
    allOrders,
    allUsers,
    installationTeams,
    activeCategories,
    rangeStartMs,
    rangeEndMs,
  ]);

  function toggleCategory(cat: TvEventCategory) {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }

  function shiftMonths(delta: number) {
    const next = new Date(baseYear, baseMonth + delta, 1);
    setBaseYear(next.getFullYear());
    setBaseMonth(next.getMonth());
  }

  function resetToCurrent() {
    const current = new Date();
    setBaseYear(current.getFullYear());
    setBaseMonth(current.getMonth());
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await (containerRef.current ?? document.documentElement).requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen API can be blocked by browser policy
    }
  }

  const periodLabel = `${months[0].label} – ${months[3].label}`;
  const liveClockStr = now.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  const liveDateStr = now.toLocaleDateString("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const isLoading = calendarEvents === undefined || linkedOrderEvents === undefined;

  return (
    <div
      ref={containerRef}
      className="h-screen w-screen overflow-hidden flex flex-col p-3 gap-2.5 select-none"
      style={{ background: "var(--background)", color: "var(--text-strong)" }}
    >
      {/* Górny pasek TV */}
      <header
        className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2 rounded-xl border shrink-0"
        style={{ background: "var(--panel)", borderColor: "var(--line)" }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => shiftMonths(-1)}
              className="rounded-lg border px-2.5 py-1 text-xs font-semibold hover:opacity-80 cursor-pointer"
              style={{ background: "var(--panel-2)", borderColor: "var(--line)" }}
              title="Poprzedni miesiąc"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={resetToCurrent}
              className="rounded-lg border px-2.5 py-1 text-xs font-semibold hover:opacity-80 cursor-pointer"
              style={{ background: "var(--panel-2)", borderColor: "var(--line)" }}
            >
              Bieżący okres
            </button>
            <button
              type="button"
              onClick={() => shiftMonths(1)}
              className="rounded-lg border px-2.5 py-1 text-xs font-semibold hover:opacity-80 cursor-pointer"
              style={{ background: "var(--panel-2)", borderColor: "var(--line)" }}
              title="Następny miesiąc"
            >
              ›
            </button>
          </div>
          <h1 className="text-sm sm:text-base font-bold tracking-tight" style={{ color: "var(--text-strong)" }}>
            {periodLabel}
          </h1>
          {isLoading && (
            <span className="text-xs px-2 py-0.5 rounded" style={{ color: "var(--text-muted)" }}>
              Ładowanie…
            </span>
          )}
        </div>

        {/* Filtry kategorii */}
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORY_CONFIG.map((cat) => {
            const active = activeCategories.has(cat.key);
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => toggleCategory(cat.key)}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-opacity cursor-pointer"
                style={{
                  background: active ? `${cat.defaultColor}20` : "var(--panel-2)",
                  color: active ? "var(--text-strong)" : "var(--text-muted)",
                  border: `1px solid ${active ? cat.defaultColor : "var(--line)"}`,
                  opacity: active ? 1 : 0.65,
                }}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ background: cat.defaultColor }}
                />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Zegar na żywo + akcje */}
        <div className="flex items-center gap-3">
          {installationTeams.length > 0 && (
            <div className="hidden xl:flex items-center gap-2 pr-2 border-r" style={{ borderColor: "var(--line)" }}>
              {installationTeams.slice(0, 6).map((team) => (
                <span
                  key={team._id}
                  className="inline-flex items-center gap-1 text-[11px] font-medium"
                  style={{ color: "var(--text-muted)" }}
                >
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm"
                    style={{ background: team.color || "#3b82f6" }}
                  />
                  {team.name}
                </span>
              ))}
            </div>
          )}

          <div className="text-right leading-tight">
            <div className="text-sm font-bold tabular-nums" style={{ color: "var(--text-strong)" }}>
              {liveClockStr}
            </div>
            <div className="text-[10px] capitalize" style={{ color: "var(--text-muted)" }}>
              {liveDateStr}
            </div>
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-lg border px-2.5 py-1 text-xs font-semibold hover:opacity-80 cursor-pointer"
            style={{ background: "var(--panel-2)", borderColor: "var(--line)" }}
          >
            {isFullscreen ? "Wyjdź z pełnego ekranu" : "Pełny ekran"}
          </button>

          <Link
            href="/admin/kalendarz"
            className="rounded-lg border px-2.5 py-1 text-xs font-semibold hover:opacity-80"
            style={{ background: "var(--panel-2)", borderColor: "var(--line)", color: "var(--text-strong)" }}
          >
            Kalendarz CRM
          </Link>
        </div>
      </header>

      {/* Siatka 2x2: 4 kolejne miesiące */}
      <main className="grid grid-cols-1 md:grid-cols-2 md:grid-rows-2 gap-3 flex-1 min-h-0">
        {months.map((m) => {
          const days = getMonthGridDays(m.year, m.month);
          const weeksCount = days.length / 7;
          let monthEventsCount = 0;
          for (const d of days) {
            if (d.inMonth) {
              monthEventsCount += eventsByDateKey.get(d.dateKey)?.length ?? 0;
            }
          }

          return (
            <section
              key={`${m.year}-${m.month}`}
              className="flex flex-col min-h-0 rounded-xl border overflow-hidden"
              style={{ background: "var(--panel)", borderColor: "var(--line)" }}
            >
              {/* Nagłówek miesiąca */}
              <div
                className="flex items-center justify-between px-3 py-1.5 border-b shrink-0"
                style={{ background: "var(--panel-2)", borderColor: "var(--line)" }}
              >
                <h2 className="text-sm font-bold tracking-tight" style={{ color: "var(--text-strong)" }}>
                  {m.label}
                </h2>
                <span
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "var(--background)", color: "var(--text-muted)" }}
                >
                  {monthEventsCount} wpisów
                </span>
              </div>

              {/* Dni tygodnia */}
              <div
                className="grid grid-cols-7 border-b shrink-0"
                style={{ borderColor: "var(--line)", background: "var(--panel-2)" }}
              >
                {TV_WEEKDAYS.map((wd, idx) => (
                  <div
                    key={wd}
                    className="text-center text-[11px] font-semibold py-1"
                    style={{
                      color: idx >= 5 ? "var(--text-muted)" : "var(--text-strong)",
                    }}
                  >
                    {wd}
                  </div>
                ))}
              </div>

              {/* Siatka dni */}
              <div
                className="grid grid-cols-7 flex-1 min-h-0"
                style={{ gridTemplateRows: `repeat(${weeksCount}, minmax(0, 1fr))` }}
              >
                {days.map((cell) => {
                  const dayEvents = cell.inMonth ? eventsByDateKey.get(cell.dateKey) ?? [] : [];
                  const isToday = cell.dateKey === todayKey;
                  const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_PILLS_PER_DAY);
                  const hiddenCount = Math.max(0, dayEvents.length - MAX_VISIBLE_PILLS_PER_DAY);

                  return (
                    <div
                      key={cell.dateKey}
                      onClick={() => {
                        if (!cell.inMonth || dayEvents.length === 0) return;
                        setSelectedDayModal({
                          dateKey: cell.dateKey,
                          label: cell.date.toLocaleDateString("pl-PL", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          }),
                          events: dayEvents,
                        });
                      }}
                      className={`border-r border-b p-1 flex flex-col gap-0.5 min-h-0 overflow-hidden ${
                        dayEvents.length > 0 && cell.inMonth ? "cursor-pointer hover:brightness-95" : ""
                      }`}
                      style={{
                        borderColor: "var(--line)",
                        background: !cell.inMonth
                          ? "var(--background)"
                          : isToday
                          ? "color-mix(in srgb, var(--accent) 10%, var(--panel))"
                          : cell.isWeekend
                          ? "var(--panel-2)"
                          : "var(--panel)",
                        opacity: cell.inMonth ? 1 : 0.35,
                        boxShadow: isToday ? "inset 0 0 0 2px var(--accent)" : undefined,
                      }}
                    >
                      <div className="flex items-center justify-between shrink-0">
                        <span
                          className={`text-[11px] font-bold leading-none px-1 py-0.5 rounded ${
                            isToday ? "text-white" : ""
                          }`}
                          style={{
                            background: isToday ? "var(--accent)" : "transparent",
                            color: isToday
                              ? "#ffffff"
                              : cell.isWeekend
                              ? "var(--text-muted)"
                              : "var(--text-strong)",
                          }}
                        >
                          {cell.dayNumber}
                        </span>
                        {hiddenCount > 0 && (
                          <span
                            className="text-[10px] font-bold px-1 rounded"
                            style={{ color: "var(--accent)" }}
                          >
                            +{hiddenCount}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col gap-0.5 min-h-0 overflow-hidden">
                        {visibleEvents.map((ev) => (
                          <div
                            key={`${cell.dateKey}-${ev.id}`}
                            title={`${ev.title}${ev.subtitle ? ` (${ev.subtitle})` : ""}`}
                            className="truncate rounded px-1 py-[1px] text-[10.5px] font-semibold leading-tight"
                            style={{
                              background: `${ev.color}22`,
                              borderLeft: `3px solid ${ev.color}`,
                              color: "var(--text-strong)",
                            }}
                          >
                            {ev.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>

      {/* Modal szczegółów dnia po kliknięciu */}
      {selectedDayModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectedDayModal(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl border p-4 shadow-xl max-h-[80vh] flex flex-col gap-3"
            style={{ background: "var(--panel)", borderColor: "var(--line)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--line)" }}>
              <h3 className="text-base font-bold capitalize" style={{ color: "var(--text-strong)" }}>
                {selectedDayModal.label}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedDayModal(null)}
                className="rounded px-2 py-0.5 text-sm font-bold hover:opacity-75 cursor-pointer"
                style={{ color: "var(--text-muted)" }}
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto pr-1">
              {selectedDayModal.events.map((ev) => (
                <div
                  key={ev.id}
                  className="rounded-lg border p-2.5 flex flex-col gap-1"
                  style={{
                    background: "var(--panel-2)",
                    borderColor: "var(--line)",
                    borderLeft: `4px solid ${ev.color}`,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold" style={{ color: "var(--text-strong)" }}>
                      {ev.title}
                    </span>
                    <span className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
                      {formatTimeRange(ev.startDate, ev.endDate, ev.isAllDay)}
                    </span>
                  </div>
                  {ev.subtitle && (
                    <div className="text-xs font-medium" style={{ color: "var(--text-strong)" }}>
                      {ev.subtitle}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {ev.eventTypeName && <span>Typ: {ev.eventTypeName}</span>}
                    {ev.teamName && <span>Ekipa: {ev.teamName}</span>}
                    {ev.supplierName && <span>Dostawca: {ev.supplierName}</span>}
                  </div>
                  {ev.description && (
                    <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {ev.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
