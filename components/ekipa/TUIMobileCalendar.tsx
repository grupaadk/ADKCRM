"use client";

import React, { useRef, useEffect, useMemo } from "react";
import Calendar from "@toast-ui/calendar";
import "@toast-ui/calendar/dist/toastui-calendar.min.css";
import type { EventObject } from "@toast-ui/calendar";

// Typy zapożyczone z CrewCalendarView dla uproszczenia
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

interface TUIMobileCalendarProps {
  items: ScheduleItem[];
  filter: "upcoming" | "all" | "completed";
  search: string;
  onEventClick: (item: ScheduleItem) => void;
  onEventDateChange: (item: ScheduleItem, newDate: Date) => Promise<void>;
  onToggleEventStatus?: (item: ScheduleItem) => Promise<void>;
}

export default function TUIMobileCalendar({
  items,
  filter,
  search,
  onEventClick,
  onEventDateChange,
}: TUIMobileCalendarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const calendarInstanceRef = useRef<Calendar | null>(null);

  // Mount TUI Calendar directly via vanilla JS library to ensure React 19 compatibility
  useEffect(() => {
    if (!containerRef.current) return;

    const cal = new Calendar(containerRef.current, {
      defaultView: "month",
      useFormPopup: false,
      useDetailPopup: false,
      isReadOnly: false,
      usageStatistics: false,
      week: {
        taskView: false,
        eventView: ["allday", "time"],
        hourStart: 6,
        hourEnd: 17,
      },
      month: {
        isAlways6Weeks: false,
      },
      template: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        timegridDisplayPrimaryTime({ time }: { time: any }) {
          const h = typeof time.getHours === "function" ? time.getHours() : new Date(time).getHours();
          return `${h.toString().padStart(2, "0")}:00`;
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        timegridDisplayTime({ time }: { time: any }) {
          const h = typeof time.getHours === "function" ? time.getHours() : new Date(time).getHours();
          return `${h.toString().padStart(2, "0")}:00`;
        },
      },
    });

    calendarInstanceRef.current = cal;

    return () => {
      cal.destroy();
      calendarInstanceRef.current = null;
    };
  }, []);

  // Zbudujmy eventy TUI na podstawie items
  const events = useMemo<EventObject[]>(() => {
    return items
      .filter((item) => {
        const isMontaz = item.type === "montaz";
        const isDone = isMontaz
          ? item.status === "completed"
          : item.status === "rozwiazana" || item.status === "zamknieta" || item.status === "zakonczona";

        if (filter === "upcoming" && isDone) return false;
        if (filter === "completed" && !isDone) return false;

        if (search.trim()) {
          const term = search.toLowerCase();
          const matchTitle = item.title.toLowerCase().includes(term);
          const matchClient = item.clientName.toLowerCase().includes(term);
          const matchAddress = item.address.toLowerCase().includes(term);
          const matchPhone = (item.phone ?? "").includes(term);
          if (!matchTitle && !matchClient && !matchAddress && !matchPhone) return false;
        }

        return true;
      })
      .map((item) => {
        const isMontaz = item.type === "montaz";
        const isDone = isMontaz
          ? item.status === "completed"
          : item.status === "rozwiazana" || item.status === "zamknieta" || item.status === "zakonczona";

        const start = new Date(item.date);
        let end = new Date(item.date);
        let isAllday = true;
        let category = "allday";

        let timeString = item.timeStr;
        if (!timeString && (start.getHours() !== 0 || start.getMinutes() !== 0)) {
          timeString = `${start.getHours().toString().padStart(2, "0")}:${start.getMinutes().toString().padStart(2, "0")}`;
        }

        if (timeString) {
          const [hh, mm] = timeString.split(":");
          start.setHours(parseInt(hh, 10), parseInt(mm, 10), 0);
          if (item.serviceDateEnd) {
            end = new Date(item.serviceDateEnd);
          } else if (item.endDate) {
            end = new Date(item.endDate);
          } else {
            end = new Date(start.getTime() + 60 * 60 * 1000);
          }
          isAllday = false;
          category = "time";
        }

        let bgColor = isMontaz ? "#3b82f6" : "#f59e0b";
        if (isDone) bgColor = "#10b981";

        return {
          id: item.id,
          calendarId: "1",
          title: item.title,
          start: start.toISOString(),
          end: end.toISOString(),
          isAllday,
          category,
          backgroundColor: bgColor,
          color: "#ffffff",
          raw: { item, isDone },
        };
      });
  }, [items, filter, search]);

  // Sync events with calendar instance
  useEffect(() => {
    const cal = calendarInstanceRef.current;
    if (!cal) return;

    cal.clear();
    if (events.length > 0) {
      cal.createEvents(events);
    }
  }, [events]);

  // Bind event listeners
  useEffect(() => {
    const cal = calendarInstanceRef.current;
    if (!cal) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleClick = (res: any) => {
      const item = res?.event?.raw?.item as ScheduleItem | undefined;
      if (item) {
        onEventClick(item);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleUpdate = async (res: any) => {
      const { event, changes } = res;
      if (changes && changes.start) {
        const startDateObj = changes.start.toDate ? changes.start.toDate() : new Date(changes.start);
        const item = event?.raw?.item as ScheduleItem | undefined;
        if (item) {
          await onEventDateChange(item, startDateObj);
        }
      }
    };

    cal.off("clickEvent");
    cal.off("beforeUpdateEvent");
    cal.on("clickEvent", handleClick);
    cal.on("beforeUpdateEvent", handleUpdate);
  }, [onEventClick, onEventDateChange]);

  const nav = (action: "prev" | "next" | "today") => {
    const cal = calendarInstanceRef.current;
    if (!cal) return;
    if (action === "today") cal.today();
    else if (action === "prev") cal.prev();
    else if (action === "next") cal.next();
  };

  return (
    <div className="flex flex-col h-[700px] w-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-2 p-4 border-b border-slate-200 bg-slate-50">
        <button onClick={() => nav("prev")} className="p-2 border rounded-md hover:bg-slate-100">&lt;</button>
        <button onClick={() => nav("today")} className="px-3 py-2 border rounded-md font-semibold text-sm hover:bg-slate-100">Dziś</button>
        <button onClick={() => nav("next")} className="p-2 border rounded-md hover:bg-slate-100">&gt;</button>
      </div>
      <div className="flex-1 overflow-hidden relative" ref={containerRef} />
    </div>
  );
}
