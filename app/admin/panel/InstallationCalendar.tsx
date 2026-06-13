"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import plLocale from "@fullcalendar/core/locales/pl";
import type { EventClickArg, EventDropArg, EventContentArg } from "@fullcalendar/core";

const STATUS_COLORS: Record<string, string> = {
  lead: "#50253F",
  inquiry: "#50253F",
  measurement: "#3E5224",
  offer: "#50253F",
  contract: "#50253F",
  production: "#164555",
  installation: "#533F04",
  complaint: "#533F04",
  completed: "#37471F",
};

const MONTH_NAMES = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

const DEFAULT_START_HOUR = 8;
const EVENT_DURATION_HOURS = 2;

type OrderItem = {
  _id: string;
  completionDate: number;
  status: string;
  clientId: string;
  clientName: string;
  installationStart?: number;
  name?: string;
  customText?: string;
};

function minsToDate(baseDate: number, mins: number): Date {
  const d = new Date(baseDate);
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d;
}

function dateToMins(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export default function InstallationCalendar() {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const updateOrder = useMutation(api.orders.update);

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7;

  const gridStart = new Date(year, month, 1 - startDow);
  const gridEnd = new Date(year, month, 1 - startDow + 41);

  const orders = useQuery(api.orders.listByCompletionDateRange, {
    startDate: gridStart.getTime(),
    endDate: gridEnd.getTime(),
  });

  const events = useMemo(() => {
    if (!orders) return [];
    return orders.map((o) => {
      const startMins = o.installationStart ?? DEFAULT_START_HOUR * 60;
      const start = minsToDate(o.completionDate, startMins);
      const end = minsToDate(o.completionDate, startMins + EVENT_DURATION_HOURS * 60);
      const statusColor = STATUS_COLORS[o.status] ?? "#64748b";

      return {
        id: o._id,
        title: o.clientName,
        start,
        end,
        backgroundColor: `${statusColor}20`,
        borderColor: statusColor,
        textColor: "var(--text)",
        extendedProps: {
          clientId: o.clientId,
          orderId: o._id,
          status: o.status,
          clientName: o.clientName,
          orderName: o.name,
          customText: o.customText,
        },
      };
    });
  }, [orders]);

  const handleEventClick = (info: EventClickArg) => {
    const { clientId, orderId } = info.event.extendedProps;
    router.push(`/admin/klient/${clientId}/zlecenie/${orderId}`);
  };

  const handleEventDrop = async (info: EventDropArg) => {
    const orderId = info.event.id;
    const newStart = info.event.start;
    if (!newStart) return;

    const startMins = dateToMins(newStart);

    await updateOrder({
      orderId: orderId as any,
      installationStart: startMins,
    });
  };

  const renderEventContent = (arg: EventContentArg) => {
    const { clientName, orderName, status, customText } = arg.event.extendedProps;
    const statusColor = STATUS_COLORS[status as string] ?? "#64748b";

    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "2px 6px 3px",
        fontSize: 11,
        lineHeight: 1.3,
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          color: "var(--text-strong)",
          fontFamily: "monospace",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          lineHeight: 1.25,
        }}>
          {orderName ?? "—"}
        </div>
        <div style={{
          fontSize: 10,
          color: "var(--text-mute)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          lineHeight: 1.3,
        }}>
          {clientName}
        </div>
        {customText && (
          <span style={{
            fontSize: 10,
            fontWeight: 500,
            color: "var(--text-dim)",
            background: "var(--panel-2)",
            borderRadius: 3,
            padding: "1px 5px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            alignSelf: "flex-start",
            maxWidth: "100%",
            lineHeight: 1.5,
          }}>
            {customText}
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        maxHeight: "calc(100vh - 200px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--line)", background: "var(--card)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={() => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); }} className="btn btn-xs" style={{ fontSize: 16, padding: "6px 10px", lineHeight: 1 }}>‹</button>
          <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", minWidth: 180, textAlign: "center" }}>{MONTH_NAMES[month]} {year}</span>
          <button onClick={() => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); }} className="btn btn-xs" style={{ fontSize: 16, padding: "6px 10px", lineHeight: 1 }}>›</button>
        </div>
        <button onClick={() => { const t = new Date(); setYear(t.getFullYear()); setMonth(t.getMonth()); }} className="btn btn-xs" style={{ fontSize: 12, padding: "6px 14px" }}>Dzisiaj</button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "16px" }}>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale={plLocale}
          headerToolbar={false}
          events={events}
          editable={true}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          eventContent={renderEventContent}
          height="auto"
          dayMaxEvents={3}
          eventTimeFormat={{
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }}
          slotMinTime="06:00:00"
          slotMaxTime="20:00:00"
          allDaySlot={false}
          nowIndicator={true}
          eventDisplay="block"
          eventClassNames="fc-event-custom"
        />
      </div>

      {orders === undefined && <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>Ładowanie...</div>}
    </div>
  );
}
