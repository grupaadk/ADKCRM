"use client";

import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import plLocale from "@fullcalendar/core/locales/pl";
import type { EventClickArg, EventDropArg, EventContentArg } from "@fullcalendar/core";
import type { DateClickArg } from "@fullcalendar/interaction";
import type { Id } from "@/convex/_generated/dataModel";

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
  assignedUserColor?: string;
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
  const [view, setView] = useState<"dayGridMonth" | "timeGridWeek">("dayGridMonth");
  const updateOrder = useMutation(api.orders.update);

  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [orderSearch, setOrderSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const allOrders = useQuery(api.orders.listForPicker);

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
      const borderColor = o.assignedUserColor ?? statusColor;

      return {
        id: o._id,
        title: o.clientName,
        start,
        end,
        backgroundColor: `${borderColor}20`,
        borderColor,
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
    window.open(`/admin/klient/${clientId}/zlecenie/${orderId}`, "_blank");
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

  const handleDateClick = (info: DateClickArg) => {
    setSelectedDate(info.date);
    setSelectedOrderId(null);
    setOrderSearch("");
    setDateModalOpen(true);
  };

  const filteredOrders = useMemo(() => {
    if (!allOrders) return [];
    const term = orderSearch.toLowerCase();
    if (!term) return allOrders.slice(0, 20);
    return allOrders.filter((o) =>
      (o.name ?? "").toLowerCase().includes(term) ||
      o.clientName.toLowerCase().includes(term) ||
      (o.customText ?? "").toLowerCase().includes(term)
    ).slice(0, 20);
  }, [allOrders, orderSearch]);

  const handleAssignDate = async () => {
    if (!selectedOrderId || !selectedDate) return;
    const startMins = dateToMins(selectedDate);
    await updateOrder({
      orderId: selectedOrderId as Id<"orders">,
      completionDate: selectedDate.getTime() - (selectedDate.getTime() % 86400000),
      installationStart: startMins,
    });
    setDateModalOpen(false);
    setSelectedOrderId(null);
    setSelectedDate(null);
  };

  const fmtDateTime = (d: Date) => {
    const day = d.getDate().toString().padStart(2, "0");
    const mon = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear();
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    return `${day}.${mon}.${year} ${h}:${m}`;
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
        flex: 1,
        overflow: "hidden",
        minHeight: 0,
      }}
    >
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 20px",
        borderBottom: "1px solid var(--line)",
        background: "var(--card)",
        borderRadius: "12px 12px 0 0",
        position: "sticky",
        top: 0,
        zIndex: 10,
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={() => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); }} className="btn btn-xs" style={{ fontSize: 16, padding: "6px 10px", lineHeight: 1 }}>‹</button>
          <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", minWidth: 180, textAlign: "center" }}>{MONTH_NAMES[month]} {year}</span>
          <button onClick={() => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); }} className="btn btn-xs" style={{ fontSize: 16, padding: "6px 10px", lineHeight: 1 }}>›</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", background: "var(--panel-2)", borderRadius: 6, padding: 2 }}>
            <button
              onClick={() => setView("dayGridMonth")}
              className="btn btn-xs"
              style={{
                fontSize: 12,
                padding: "5px 12px",
                borderRadius: 4,
                background: view === "dayGridMonth" ? "var(--accent)" : "transparent",
                color: view === "dayGridMonth" ? "#fff" : "var(--text)",
                border: "none",
              }}
            >
              Miesiąc
            </button>
            <button
              onClick={() => setView("timeGridWeek")}
              className="btn btn-xs"
              style={{
                fontSize: 12,
                padding: "5px 12px",
                borderRadius: 4,
                background: view === "timeGridWeek" ? "var(--accent)" : "transparent",
                color: view === "timeGridWeek" ? "#fff" : "var(--text)",
                border: "none",
              }}
            >
              Tydzień
            </button>
          </div>
          <button onClick={() => { const t = new Date(); setYear(t.getFullYear()); setMonth(t.getMonth()); }} className="btn btn-xs" style={{ fontSize: 12, padding: "6px 14px" }}>Dzisiaj</button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <FullCalendar
          key={view}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={view}
          locale={plLocale}
          headerToolbar={false}
          events={events}
          editable={true}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          dateClick={handleDateClick}
          eventContent={renderEventContent}
          height="100%"
          expandRows={true}
          dayMaxEvents={3}
          eventTimeFormat={{
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }}
          slotDuration={view === "timeGridWeek" ? "01:00:00" : "00:30:00"}
          slotMinTime={view === "timeGridWeek" ? "07:00:00" : "06:00:00"}
          slotMaxTime={view === "timeGridWeek" ? "16:01:00" : "20:00:00"}
          allDaySlot={false}
          nowIndicator={true}
          eventDisplay="block"
          eventClassNames="fc-event-custom"
        />
      </div>

      {orders === undefined && <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>Ładowanie...</div>}

      {dateModalOpen && selectedDate && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }} onClick={() => setDateModalOpen(false)} />
          <div style={{
            position: "relative",
            width: "100%",
            maxWidth: 480,
            maxHeight: "80vh",
            background: "#fff",
            borderRadius: 12,
            border: "1px solid var(--line)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-strong)" }}>Przypisz zlecenie</div>
                <div style={{ fontSize: 12, color: "var(--text-mute)", marginTop: 2 }}>{fmtDateTime(selectedDate)}</div>
              </div>
              <button onClick={() => setDateModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-mute)", padding: 4 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--line)" }}>
              <input
                type="text"
                placeholder="Szukaj zlecenia lub klienta..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                autoFocus
                style={{
                  width: "100%",
                  fontSize: 13,
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--line)",
                  background: "#fff",
                  color: "var(--text-strong)",
                  fontFamily: "inherit",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
              {filteredOrders.map((o) => (
                <button
                  key={o._id}
                  onClick={() => setSelectedOrderId(o._id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    width: "100%",
                    padding: "10px 20px",
                    background: selectedOrderId === o._id ? "var(--accent-soft)" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    borderBottom: "1px solid var(--line)",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => { if (selectedOrderId !== o._id) e.currentTarget.style.background = "var(--panel-2)"; }}
                  onMouseLeave={(e) => { if (selectedOrderId !== o._id) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: selectedOrderId === o._id ? "var(--accent)" : "var(--line)",
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)", fontFamily: "monospace" }}>{o.name ?? "—"}</div>
                    <div style={{ fontSize: 12, color: "var(--text-mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.clientName}</div>
                  </div>
                  {o.customText && (
                    <span style={{ fontSize: 10, color: "var(--text-dim)", background: "var(--panel-2)", borderRadius: 3, padding: "1px 6px", whiteSpace: "nowrap" }}>{o.customText}</span>
                  )}
                </button>
              ))}
              {filteredOrders.length === 0 && (
                <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: "var(--text-mute)" }}>Brak zleceń</div>
              )}
            </div>

            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setDateModalOpen(false)} className="btn btn-xs" style={{ fontSize: 13, padding: "7px 16px" }}>Anuluj</button>
              <button
                onClick={handleAssignDate}
                disabled={!selectedOrderId}
                className="btn primary btn-xs"
                style={{ fontSize: 13, padding: "7px 16px", opacity: selectedOrderId ? 1 : 0.5 }}
              >
                Przypisz
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
