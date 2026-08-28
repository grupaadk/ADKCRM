"use client";

import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Wrench, Sparkles, Check } from "lucide-react";

interface ScheduleItem {
  id: string;
  type: "montaz" | "serwis";
  title: string;
  date: number;
  startDate?: number;
  endDate?: number;
  timeStr?: string;
  serviceDateEnd?: number;
  status: string;
  clientName: string;
  phone?: string;
  email?: string;
  address: string;
  comment?: string;
}

interface MobileMonthCalendarProps {
  items: ScheduleItem[];
  filter: "upcoming" | "all" | "completed";
  search: string;
  onEventClick: (item: ScheduleItem) => void;
}

const DAY_NAMES = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"];

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Returns array of Date objects for a given month grid (Mon-Sun, padded with prev/next month days) */
function buildMonthGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  // 0=Sun,1=Mon…6=Sat → convert so Mon=0
  const startDow = (firstDay.getDay() + 6) % 7; // shift so Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const grid: Date[] = [];
  // Pad with prev month days
  for (let i = startDow - 1; i >= 0; i--) {
    grid.push(new Date(year, month, -i));
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    grid.push(new Date(year, month, d));
  }
  // Pad to complete last week
  while (grid.length % 7 !== 0) {
    grid.push(new Date(year, month + 1, grid.length - daysInMonth - startDow + 1));
  }
  return grid;
}

const MONTH_NAMES = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

export default function MobileMonthCalendar({
  items,
  filter,
  search,
  onEventClick,
}: MobileMonthCalendarProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  // Filter items based on filter/search props
  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      const isMontaz = item.type === "montaz";
      const isDone = isMontaz
        ? item.status === "completed"
        : item.status === "rozwiazana" || item.status === "zamknieta" || item.status === "zakonczona";

      if (filter === "upcoming" && isDone) return false;
      if (filter === "completed" && !isDone) return false;

      if (search.trim()) {
        const term = search.toLowerCase();
        if (
          !item.title.toLowerCase().includes(term) &&
          !item.clientName.toLowerCase().includes(term) &&
          !item.address.toLowerCase().includes(term) &&
          !(item.phone ?? "").includes(term)
        )
          return false;
      }
      return true;
    });
  }, [items, filter, search]);

  // Build a map: dateKey → items[]
  const itemsByDate = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const item of visibleItems) {
      const d = new Date(item.date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [visibleItems]);

  function dateKey(d: Date) {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
    setSelectedDate(null);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
    setSelectedDate(null);
  }
  function goToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDate(today);
  }

  const selectedItems = selectedDate ? (itemsByDate.get(dateKey(selectedDate)) ?? []) : [];

  return (
    <div className="flex flex-col gap-3">
      {/* ── Header ─────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-3 rounded-2xl border shadow-xs"
        style={{ background: "var(--panel)", borderColor: "var(--line)" }}
      >
        <button
          onClick={prevMonth}
          className="p-2 rounded-xl btn ghost cursor-pointer"
          aria-label="Poprzedni miesiąc"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <p className="text-base font-extrabold strong tracking-tight">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </p>
          <p className="text-[10px] dim mt-0.5">
            {visibleItems.filter(i => {
              const d = new Date(i.date);
              return d.getMonth() === viewMonth && d.getFullYear() === viewYear;
            }).length} zleceń w miesiącu
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={goToday}
            className="px-2.5 py-1.5 rounded-xl btn ghost text-xs font-bold cursor-pointer"
          >
            Dziś
          </button>
          <button
            onClick={nextMonth}
            className="p-2 rounded-xl btn ghost cursor-pointer"
            aria-label="Następny miesiąc"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Calendar Grid ──────────────────────────────── */}
      <div
        className="rounded-2xl border shadow-xs overflow-hidden"
        style={{ background: "var(--panel)", borderColor: "var(--line)" }}
      >
        {/* Day-name header */}
        <div className="grid grid-cols-7 border-b" style={{ borderColor: "var(--line)" }}>
          {DAY_NAMES.map((name, i) => (
            <div
              key={name}
              className={`py-2 text-center text-[10px] font-bold uppercase tracking-wide ${
                i >= 5 ? "text-rose-400" : "dim"
              }`}
            >
              {name}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {Array.from({ length: grid.length / 7 }, (_, weekIdx) => (
          <div
            key={weekIdx}
            className="grid grid-cols-7"
            style={{ borderTop: weekIdx > 0 ? "1px solid var(--line)" : undefined }}
          >
            {grid.slice(weekIdx * 7, weekIdx * 7 + 7).map((day, dayIdx) => {
              const isCurrentMonth = day.getMonth() === viewMonth;
              const isToday = isSameDay(day, today);
              const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
              const dayItems = itemsByDate.get(dateKey(day)) ?? [];
              const hasItems = dayItems.length > 0;
              const isWeekend = dayIdx >= 5;

              // Count types
              const montazCount = dayItems.filter(i => i.type === "montaz").length;
              const serwisCount = dayItems.filter(i => i.type === "serwis").length;
              const doneCount = dayItems.filter(i => {
                const isM = i.type === "montaz";
                return isM ? i.status === "completed" : (i.status === "rozwiazana" || i.status === "zamknieta" || i.status === "zakonczona");
              }).length;

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setSelectedDate(isSelected ? null : day)}
                  style={
                    dayIdx < 6
                      ? { borderRight: "1px solid var(--line)" }
                      : undefined
                  }
                  className={`
                    relative flex flex-col items-center min-h-[72px] sm:min-h-[90px] p-1 pt-1.5 gap-0.5 transition-colors cursor-pointer text-left
                    ${isSelected ? "bg-blue-50 ring-2 ring-inset ring-blue-400" : ""}
                    ${!isSelected && hasItems && isCurrentMonth ? "hover:bg-slate-50" : ""}
                    ${!isCurrentMonth ? "opacity-30" : ""}
                  `}
                >
                  {/* Day number */}
                  <span
                    className={`
                      w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-bold leading-none flex-shrink-0
                      ${isToday ? "bg-blue-600 text-white shadow" : isWeekend && isCurrentMonth ? "text-rose-500" : "strong"}
                    `}
                  >
                    {day.getDate()}
                  </span>

                  {/* Event chips */}
                  {isCurrentMonth && hasItems && (
                    <div className="flex flex-col gap-0.5 w-full mt-0.5">
                      {montazCount > 0 && (
                        <div className="flex items-center gap-0.5 w-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                          <span className="text-[9px] font-bold text-blue-700 leading-none truncate">
                            {montazCount > 1 ? `${montazCount}×` : ""} Montaż
                          </span>
                        </div>
                      )}
                      {serwisCount > 0 && (
                        <div className="flex items-center gap-0.5 w-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                          <span className="text-[9px] font-bold text-amber-700 leading-none truncate">
                            {serwisCount > 1 ? `${serwisCount}×` : ""} Serwis
                          </span>
                        </div>
                      )}
                      {doneCount > 0 && doneCount === dayItems.length && (
                        <div className="flex items-center gap-0.5 w-full">
                          <Check className="w-2.5 h-2.5 text-emerald-500 flex-shrink-0" />
                          <span className="text-[9px] font-bold text-emerald-600 leading-none">Wykonano</span>
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Day Detail Panel ───────────────────────────── */}
      {selectedDate && (
        <div
          className="rounded-2xl border shadow-xs overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
          style={{ background: "var(--panel)", borderColor: "var(--line)" }}
        >
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--line)" }}>
            <p className="font-bold strong text-sm">
              {selectedDate.toLocaleDateString("pl-PL", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
            <span className="pill">
              {selectedItems.length} zlec.
            </span>
          </div>

          {selectedItems.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-semibold dim">Brak zleceń w tym dniu</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--line)" }}>
              {selectedItems.map((item) => {
                const isMontaz = item.type === "montaz";
                const isDone = isMontaz
                  ? item.status === "completed"
                  : item.status === "rozwiazana" || item.status === "zamknieta" || item.status === "zakonczona";

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onEventClick(item)}
                    className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    {/* Color strip */}
                    <div
                      className={`w-1 rounded-full self-stretch flex-shrink-0 ${
                        isDone ? "bg-emerald-400" : isMontaz ? "bg-blue-500" : "bg-amber-500"
                      }`}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {isMontaz ? (
                          <Wrench className="w-3 h-3 text-blue-500 flex-shrink-0" />
                        ) : (
                          <Sparkles className="w-3 h-3 text-amber-500 flex-shrink-0" />
                        )}
                        <span className={`text-xs font-bold truncate ${isDone ? "line-through text-slate-400" : "strong"}`}>
                          {item.title}
                        </span>
                      </div>
                      <p className="text-[11px] dim truncate">{item.clientName}</p>
                      {item.timeStr && (
                        <p className="text-[10px] text-blue-600 font-semibold mt-0.5">{item.timeStr}</p>
                      )}
                    </div>

                    {isDone && (
                      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
