"use client";

import React, { useMemo } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import plLocale from "@fullcalendar/core/locales/pl";
import type { EventInput } from "@fullcalendar/core";

export interface ScheduleItem {
  id: string;
  type: "montaz" | "serwis" | "wlasne";
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

interface MobileWeekCalendarProps {
  items: ScheduleItem[];
  onEventClick?: (item: ScheduleItem) => void;
}

export default function MobileWeekCalendar({ items, onEventClick }: MobileWeekCalendarProps) {
  const events = useMemo<EventInput[]>(() => {
    return items.map((item) => {
      let color = "#3b82f6"; // blue
      if (item.type === "montaz") color = "#10b981"; // emerald
      if (item.type === "serwis") color = "#a855f7"; // purple

      const d = new Date(item.date);
      let endD = new Date(d.getTime() + 60 * 60 * 1000); // domyślnie +1h
      if (item.endDate) {
        endD = new Date(item.endDate);
      } else if (item.serviceDateEnd) {
        endD = new Date(item.serviceDateEnd);
      } else if (item.timeStr === "Cały dzień") {
        endD = new Date(d);
        endD.setHours(23, 59, 59, 999);
      }

      return {
        id: item.id,
        title: item.title || "Wydarzenie",
        start: d,
        end: endD,
        allDay: item.timeStr === "Cały dzień",
        backgroundColor: color,
        borderColor: color,
        extendedProps: { item },
      };
    });
  }, [items]);

  return (
    <div className="w-full h-full bg-white rounded-xl shadow-xs overflow-hidden p-2">
      <style>{`
        .fc-theme-standard td, .fc-theme-standard th {
          border-color: #f1f5f9;
        }
        .fc .fc-col-header-cell-cushion {
          padding: 4px 2px;
          color: #475569;
          font-size: 11px;
          text-transform: uppercase;
        }
        .fc-timegrid-slot-label-cushion {
          color: #94a3b8;
          font-size: 11px;
        }
        .fc-event {
          border-radius: 4px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.1);
          border: none;
          padding: 2px;
        }
        .fc-event-main {
          font-size: 9px;
          font-weight: 600;
          line-height: 1.1;
          overflow: hidden;
        }
        .fc-toolbar-title {
          font-size: 14px !important;
          font-weight: 700 !important;
          color: #334155;
        }
        .fc-button-primary {
          background-color: #f8fafc !important;
          border-color: #e2e8f0 !important;
          color: #64748b !important;
          text-transform: capitalize !important;
          padding: 2px 6px !important;
          font-size: 12px !important;
        }
        .fc-button-primary:not(:disabled).fc-button-active,
        .fc-button-primary:not(:disabled):active {
          background-color: #e2e8f0 !important;
          color: #334155 !important;
        }
        .fc-toolbar {
          margin-bottom: 6px !important;
        }
        /* Hide scrollbars for the calendar container on mobile */
        .fc-scroller::-webkit-scrollbar {
          width: 0px;
          height: 0px;
        }
      `}</style>
      <FullCalendar
        plugins={[timeGridPlugin]}
        initialView="timeGridWeek"
        locales={[plLocale]}
        locale="pl"
        headerToolbar={{
          left: "prev,next",
          center: "title",
          right: "today"
        }}
        events={events}
        allDaySlot={true}
        slotMinTime="06:00:00"
        slotMaxTime="22:00:00"
        expandRows={true}
        height="100%"
        nowIndicator={true}
        eventClick={(info) => {
          if (onEventClick) {
            onEventClick(info.event.extendedProps.item as ScheduleItem);
          }
        }}
        windowResize={(arg) => {
          arg.view.calendar.updateSize();
        }}
      />
    </div>
  );
}
