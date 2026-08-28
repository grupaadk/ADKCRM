"use client";

import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Wrench, Sparkles, CheckCircle2, X } from "lucide-react";

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

const MONTH_NAMES = [
  "Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec",
  "Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień",
];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function buildMonthGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const startDow = (firstDay.getDay() + 6) % 7; // Mon = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: Date[] = [];
  for (let i = startDow - 1; i >= 0; i--) grid.push(new Date(year, month, -i));
  for (let d = 1; d <= daysInMonth; d++) grid.push(new Date(year, month, d));
  while (grid.length % 7 !== 0) grid.push(new Date(year, month + 1, grid.length - daysInMonth - startDow + 1));
  return grid;
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function isDone(item: ScheduleItem) {
  return item.type === "montaz"
    ? item.status === "completed"
    : item.status === "rozwiazana" || item.status === "zamknieta" || item.status === "zakonczona";
}

export default function MobileMonthCalendar({ items, filter, search, onEventClick }: MobileMonthCalendarProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(today);

  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const visibleItems = useMemo(() => items.filter((item) => {
    const done = isDone(item);
    if (filter === "upcoming" && done) return false;
    if (filter === "completed" && !done) return false;
    if (search.trim()) {
      const t = search.toLowerCase();
      if (!item.title.toLowerCase().includes(t) &&
          !item.clientName.toLowerCase().includes(t) &&
          !item.address.toLowerCase().includes(t) &&
          !(item.phone ?? "").includes(t)) return false;
    }
    return true;
  }), [items, filter, search]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const item of visibleItems) {
      const key = dateKey(new Date(item.date));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [visibleItems]);

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

  const thisMonthCount = visibleItems.filter(i => {
    const d = new Date(i.date);
    return d.getMonth() === viewMonth && d.getFullYear() === viewYear;
  }).length;

  const selectedItems = selectedDate ? (itemsByDate.get(dateKey(selectedDate)) ?? []) : [];

  return (
    <div className="flex flex-col gap-3">

      {/* ── Month Header ─────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 px-1">
        <button
          onClick={prevMonth}
          className="w-9 h-9 flex items-center justify-center rounded-xl btn ghost cursor-pointer active:scale-90 transition-transform"
          aria-label="Poprzedni miesiąc"
        >
          <ChevronLeft className="w-5 h-5 dim" />
        </button>

        <button
          onClick={goToday}
          className="flex-1 text-center group cursor-pointer"
        >
          <p className="text-lg font-extrabold strong tracking-tight group-hover:text-[var(--accent)] transition-colors">
            {MONTH_NAMES[viewMonth]} <span className="text-[var(--accent)]">{viewYear}</span>
          </p>
          {thisMonthCount > 0 && (
            <p className="text-[11px] dim mt-0.5">
              {thisMonthCount} {thisMonthCount === 1 ? "zlecenie" : thisMonthCount < 5 ? "zlecenia" : "zleceń"}
            </p>
          )}
        </button>

        <button
          onClick={nextMonth}
          className="w-9 h-9 flex items-center justify-center rounded-xl btn ghost cursor-pointer active:scale-90 transition-transform"
          aria-label="Następny miesiąc"
        >
          <ChevronRight className="w-5 h-5 dim" />
        </button>
      </div>

      {/* ── Calendar Grid ─────────────────────────────────── */}
      <div className="rounded-2xl border overflow-hidden shadow-xs" style={{ background: "var(--panel)", borderColor: "var(--line)" }}>

        {/* Day names row */}
        <div className="grid grid-cols-7" style={{ borderBottom: "1px solid var(--line)", background: "var(--panel-2)" }}>
          {DAY_NAMES.map((name, i) => (
            <div
              key={name}
              className={`py-2.5 text-center text-[10px] font-bold uppercase tracking-widest ${
                i >= 5 ? "text-rose-400" : "text-[var(--text-mute)]"
              }`}
            >
              {name}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {Array.from({ length: grid.length / 7 }, (_, wk) => (
          <div
            key={wk}
            className="grid grid-cols-7"
            style={wk > 0 ? { borderTop: "1px solid var(--line)" } : undefined}
          >
            {grid.slice(wk * 7, wk * 7 + 7).map((day, di) => {
              const inMonth = day.getMonth() === viewMonth;
              const isToday = isSameDay(day, today);
              const isSel = selectedDate ? isSameDay(day, selectedDate) : false;
              const dayItems = itemsByDate.get(dateKey(day)) ?? [];
              const isWeekend = di >= 5;

              const montazCount = dayItems.filter(i => i.type === "montaz").length;
              const serwisCount = dayItems.filter(i => i.type === "serwis").length;
              const allDone = dayItems.length > 0 && dayItems.every(i => isDone(i));
              const hasItems = dayItems.length > 0;

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setSelectedDate(isSel ? null : day)}
                  style={di < 6 ? { borderRight: "1px solid var(--line)" } : undefined}
                  className={[
                    "relative flex flex-col items-center min-h-[68px] sm:min-h-[82px] p-1 pt-1.5 gap-0.5 transition-all duration-150 cursor-pointer select-none focus:outline-none",
                    isSel
                      ? "bg-[var(--accent-soft)] ring-2 ring-inset ring-[var(--accent)]"
                      : isToday && !isSel
                      ? "bg-blue-50/60"
                      : "",
                    !inMonth ? "opacity-25 pointer-events-none" : "",
                    !isSel && inMonth && hasItems ? "active:bg-slate-50" : "",
                  ].filter(Boolean).join(" ")}
                >
                  {/* Day number bubble */}
                  <span
                    className={[
                      "w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-bold leading-none flex-shrink-0 transition-all",
                      isToday
                        ? "bg-[var(--accent)] text-white shadow-md"
                        : isSel
                        ? "bg-[var(--accent)] text-white"
                        : isWeekend && inMonth
                        ? "text-rose-500"
                        : "text-[var(--text-strong)]",
                    ].join(" ")}
                  >
                    {day.getDate()}
                  </span>

                  {/* Event indicators */}
                  {inMonth && hasItems && (
                    <div className="flex flex-col gap-[3px] w-full mt-0.5 px-0.5">
                      {allDone ? (
                        <div className="flex items-center justify-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                        </div>
                      ) : (
                        <>
                          {montazCount > 0 && (
                            <div className="flex items-center gap-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                              <span className="text-[9px] font-bold text-blue-700 leading-none truncate">
                                {montazCount > 1 ? `${montazCount}×` : ""}M
                              </span>
                            </div>
                          )}
                          {serwisCount > 0 && (
                            <div className="flex items-center gap-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                              <span className="text-[9px] font-bold text-amber-700 leading-none truncate">
                                {serwisCount > 1 ? `${serwisCount}×` : ""}S
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Day Detail Panel ───────────────────────────────── */}
      {selectedDate && (
        <div
          className="rounded-2xl border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200"
          style={{ background: "var(--panel)", borderColor: "var(--line)" }}
        >
          {/* Panel header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: "var(--line)", background: "var(--panel-2)" }}
          >
            <div>
              <p className="font-extrabold strong text-sm capitalize">
                {selectedDate.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" })}
              </p>
              {selectedItems.length > 0 && (
                <p className="text-[11px] dim mt-0.5">
                  {selectedItems.length} {selectedItems.length === 1 ? "zlecenie" : "zlecenia/zleceń"}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="w-7 h-7 flex items-center justify-center rounded-full btn ghost cursor-pointer"
              aria-label="Zamknij"
            >
              <X className="w-4 h-4 dim" />
            </button>
          </div>

          {/* Empty state */}
          {selectedItems.length === 0 && (
            <div className="py-10 flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--panel-3)" }}>
                <CheckCircle2 className="w-5 h-5 text-[var(--text-mute)]" />
              </div>
              <p className="text-sm font-semibold dim">Brak zleceń w tym dniu</p>
            </div>
          )}

          {/* Item list */}
          {selectedItems.length > 0 && (
            <div className="divide-y" style={{ borderColor: "var(--line)" }}>
              {selectedItems.map((item) => {
                const done = isDone(item);
                const isMontaz = item.type === "montaz";

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onEventClick(item)}
                    className="w-full text-left px-4 py-3.5 flex items-center gap-3.5 hover:bg-[var(--panel-2)] active:bg-[var(--panel-3)] transition-colors cursor-pointer group"
                  >
                    {/* Type icon */}
                    <div
                      className={[
                        "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-active:scale-95",
                        done
                          ? "bg-emerald-100 text-emerald-600"
                          : isMontaz
                          ? "bg-blue-100 text-blue-600"
                          : "bg-amber-100 text-amber-600",
                      ].join(" ")}
                    >
                      {done ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : isMontaz ? (
                        <Wrench className="w-4 h-4" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${done ? "line-through text-[var(--text-mute)]" : "text-[var(--text-strong)]"}`}>
                        {item.title}
                      </p>
                      <p className="text-[11px] dim truncate mt-0.5">{item.clientName}</p>
                      {item.timeStr && (
                        <span className="inline-flex items-center mt-1 text-[10px] font-bold text-[var(--accent)] bg-[var(--accent-soft)] px-1.5 py-0.5 rounded-md">
                          {item.timeStr}
                        </span>
                      )}
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="w-4 h-4 text-[var(--text-mute)] group-hover:text-[var(--accent)] flex-shrink-0 transition-colors" />
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
