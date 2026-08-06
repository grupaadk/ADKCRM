"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

const WEEKDAY_LABELS = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "Sb"];
const MONTH_LABELS = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

const PILL_WIDTH = 52;
const PILL_GAP = 8;
const SLOT_WIDTH = PILL_WIDTH + PILL_GAP;

function toDayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function isSameDay(a: Date, b: Date) {
  return toDayKey(a) === toDayKey(b);
}

interface DateStripProps {
  selectedDate: Date | null;
  onSelectDate: (date: Date | null) => void;
  markedDates?: number[];
}

export function DateStrip({ selectedDate, onSelectDate, markedDates }: DateStripProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const today = useMemo(() => new Date(), []);
  const year = today.getFullYear();

  const days = useMemo(() => {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    const result: Date[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      result.push(new Date(d));
    }
    return result;
  }, [year]);

  const markedDayKeys = useMemo(() => {
    const set = new Set<string>();
    (markedDates ?? []).forEach((ts) => set.add(toDayKey(new Date(ts))));
    return set;
  }, [markedDates]);

  const [visibleMonth, setVisibleMonth] = useState(() => MONTH_LABELS[today.getMonth()]);

  const updateVisibleMonthFromScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const centerIndex = Math.round((el.scrollLeft + el.clientWidth / 2) / SLOT_WIDTH);
    const day = days[Math.min(Math.max(centerIndex, 0), days.length - 1)];
    if (day) setVisibleMonth(MONTH_LABELS[day.getMonth()]);
  }, [days]);

  const scrollToDate = useCallback(
    (date: Date, behavior: ScrollBehavior = "smooth") => {
      const el = scrollerRef.current;
      if (!el) return;
      const index = days.findIndex((d) => isSameDay(d, date));
      if (index === -1) return;
      const targetLeft = index * SLOT_WIDTH - el.clientWidth / 2 + SLOT_WIDTH / 2;
      el.scrollTo({ left: targetLeft, behavior });
    },
    [days]
  );

  // Center on today (or the selected date) once, on mount.
  useEffect(() => {
    scrollToDate(selectedDate ?? today, "auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollByDays = (count: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: count * SLOT_WIDTH, behavior: "smooth" });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
      <div className="flex items-center justify-between px-3.5 pt-3 pb-2">
        <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
          {visibleMonth} {year}
        </span>
        <div className="flex items-center gap-1.5">
          {selectedDate && (
            <button
              type="button"
              onClick={() => onSelectDate(null)}
              className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg px-2 py-1 transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
              Wyczyść
            </button>
          )}
          <button
            type="button"
            onClick={() => scrollByDays(-7)}
            className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors cursor-pointer"
            aria-label="Poprzedni tydzień"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => scrollByDays(7)}
            className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors cursor-pointer"
            aria-label="Następny tydzień"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        onScroll={updateVisibleMonthFromScroll}
        className="flex gap-2 overflow-x-auto snap-x snap-mandatory scroll-smooth px-3.5 pb-3.5 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {days.map((day) => {
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isToday = isSameDay(day, today);
          const hasItems = markedDayKeys.has(toDayKey(day));

          return (
            <button
              key={toDayKey(day)}
              type="button"
              onClick={() => onSelectDate(isSelected ? null : day)}
              className={`snap-center flex-shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? "bg-[var(--accent)] border-[var(--accent)] text-white shadow-sm"
                  : isToday
                  ? "bg-[var(--accent-soft)] border-[var(--accent-line)] text-[var(--accent)]"
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
              style={{ width: PILL_WIDTH, height: 60 }}
            >
              <span className="text-[10px] font-bold uppercase opacity-70">
                {WEEKDAY_LABELS[day.getDay()]}
              </span>
              <span className="text-base font-extrabold leading-none">{day.getDate()}</span>
              <span
                className={`w-1 h-1 rounded-full ${
                  hasItems ? (isSelected ? "bg-white" : "bg-[var(--accent)]") : "bg-transparent"
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
