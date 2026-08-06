"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon } from "lucide-react";

const WEEKDAY_LABELS = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "Sb"];
const MONTH_LABELS = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

const PILL_WIDTH = 58;
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
    <div className="panel p-3 shadow-xs rounded-xl" style={{ background: "var(--card)" }}>
      <div className="flex items-center justify-between px-1 pb-2.5">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4" style={{ color: "var(--accent)" }} />
          <span className="text-xs font-bold strong uppercase tracking-wide">
            {visibleMonth} {year}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              onSelectDate(today);
              scrollToDate(today, "smooth");
            }}
            className="btn btn-xs primary"
          >
            Dzisiaj
          </button>
          {selectedDate && !isSameDay(selectedDate, today) && (
            <button
              type="button"
              onClick={() => onSelectDate(null)}
              className="btn btn-xs ghost"
            >
              <X className="w-3 h-3" />
              Wyczyść
            </button>
          )}
          <div className="flex items-center gap-1 border-l pl-2" style={{ borderColor: "var(--line)" }}>
            <button
              type="button"
              onClick={() => scrollByDays(-7)}
              className="btn icon ghost"
              aria-label="Poprzedni tydzień"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => scrollByDays(7)}
              className="btn icon ghost"
              aria-label="Następny tydzień"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollerRef}
        onScroll={updateVisibleMonthFromScroll}
        className="flex gap-2 overflow-x-auto snap-x snap-mandatory scroll-smooth pt-1 pb-1 [&::-webkit-scrollbar]:hidden"
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
              className={`snap-center flex-shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                isSelected
                  ? "shadow-xs scale-105"
                  : isToday
                  ? ""
                  : ""
              }`}
              style={{
                width: PILL_WIDTH,
                height: 60,
                background: isSelected
                  ? "var(--accent)"
                  : isToday
                  ? "var(--accent-soft)"
                  : "var(--panel)",
                borderColor: isSelected
                  ? "var(--accent)"
                  : isToday
                  ? "var(--accent-line)"
                  : "var(--line)",
                color: isSelected
                  ? "#ffffff"
                  : isToday
                  ? "var(--accent)"
                  : "var(--text)",
              }}
            >
              <span className="text-[10px] font-bold uppercase opacity-80 tracking-wider">
                {WEEKDAY_LABELS[day.getDay()]}
              </span>
              <span className="text-base font-extrabold leading-none">{day.getDate()}</span>
              <span
                className={`w-1.5 h-1.5 rounded-full transition-transform ${
                  hasItems
                    ? isSelected
                      ? "bg-white scale-125"
                      : ""
                    : "bg-transparent"
                }`}
                style={{
                  background: hasItems && !isSelected ? "var(--accent)" : undefined,
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
