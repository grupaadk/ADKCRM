"use client";

import { useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import plLocale from "@fullcalendar/core/locales/pl";
import type { EventClickArg, EventDropArg, EventContentArg, DatesSetArg } from "@fullcalendar/core";
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
const EVENT_DURATION_HOURS = 1;

function minsToDate(baseDate: number, mins: number): Date {
  const d = new Date(baseDate);
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d;
}

function dateToMins(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function localMidnight(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0).getTime();
}

function fmtWeekRange(start: Date, end: Date): string {
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()} – ${end.getDate()} ${MONTH_NAMES[start.getMonth()]} ${end.getFullYear()}`;
  }
  return `${start.getDate()} ${MONTH_NAMES[start.getMonth()]} – ${end.getDate()} ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()}`;
}

export default function InstallationCalendar() {
  const calendarRef = useRef<FullCalendar>(null);
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [weekRange, setWeekRange] = useState<{ start: Date; end: Date } | null>(null);
  const [view, setView] = useState<"dayGridMonth" | "timeGridWeek">("dayGridMonth");
  const [visibleRange, setVisibleRange] = useState<{ start: Date; end: Date }>({
    start: new Date(year, month, 1),
    end: new Date(year, month + 1, 0),
  });
  const updateOrder = useMutation(api.orders.update);

  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [orderSearch, setOrderSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const allOrders = useQuery(api.orders.listForPicker);

  const orders = useQuery(api.orders.listByCompletionDateRange, {
    startDate: visibleRange.start.getTime(),
    endDate: visibleRange.end.getTime(),
  });

  const events = useMemo(() => {
    if (!orders) return [];
    return orders.map((o) => {
      const startMins = o.installationStart ?? DEFAULT_START_HOUR * 60;
      const start = minsToDate(o.completionDate, startMins);
      const end = minsToDate(o.completionDate, startMins + EVENT_DURATION_HOURS * 60);

      return {
        id: o._id,
        title: o.clientName,
        start,
        end,
        backgroundColor: "transparent",
        borderColor: "transparent",
        textColor: "var(--text)",
        extendedProps: {
          clientId: o.clientId,
          orderId: o._id,
          status: o.status,
          clientName: o.clientName,
          orderName: o.name,
          customText: o.customText,
          investmentCity: o.investmentCity,
          assignedUserName: o.assignedUserName,
          assignedUserColor: o.assignedUserColor,
        },
      };
    });
  }, [orders]);

  // BUG FIX: zapisuje zarówno nową datę dnia (completionDate) jak i godzinę (installationStart)
  // dzięki temu drag & drop między dniami w widoku tygodniowym działa poprawnie.
  const handleEventDrop = async (info: EventDropArg) => {
    const orderId = info.event.id;
    const newStart = info.event.start;
    if (!newStart) return;

    await updateOrder({
      orderId: orderId as Id<"orders">,
      completionDate: localMidnight(newStart),
      installationStart: dateToMins(newStart),
    });
  };

  const handleEventClick = (info: EventClickArg) => {
    const { clientId, orderId } = info.event.extendedProps;
    window.open(`/admin/klient/${clientId}/zlecenie/${orderId}`, "_blank");
  };

  const handleDateClick = (info: DateClickArg) => {
    setSelectedDate(info.date);
    setSelectedOrderId(null);
    setOrderSearch("");
    setDateModalOpen(true);
  };

  const handleDatesSet = (info: DatesSetArg) => {
    setVisibleRange({ start: info.start, end: info.end });
    setYear(info.view.currentStart.getFullYear());
    setMonth(info.view.currentStart.getMonth());
    if (info.view.type === "timeGridWeek") {
      // end from FC is exclusive (next Monday), display up to Sunday
      const displayEnd = new Date(info.end.getTime() - 1);
      setWeekRange({ start: info.view.currentStart, end: displayEnd });
    } else {
      setWeekRange(null);
    }
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
    await updateOrder({
      orderId: selectedOrderId as Id<"orders">,
      completionDate: localMidnight(selectedDate),
      installationStart: dateToMins(selectedDate),
    });
    setDateModalOpen(false);
    setSelectedOrderId(null);
    setSelectedDate(null);
  };

  const fmtDateTime = (d: Date) => {
    const day = d.getDate().toString().padStart(2, "0");
    const mon = (d.getMonth() + 1).toString().padStart(2, "0");
    const yr = d.getFullYear();
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    return `${day}.${mon}.${yr} ${h}:${m}`;
  };

  const renderEventContent = (arg: EventContentArg) => {
    const {
      clientName, orderName, status, customText,
      investmentCity, assignedUserName, assignedUserColor,
    } = arg.event.extendedProps as {
      clientName: string;
      orderName?: string;
      status: string;
      customText?: string;
      investmentCity?: string;
      assignedUserName?: string;
      assignedUserColor?: string;
    };

    const accentColor = assignedUserColor ?? STATUS_COLORS[status] ?? "#64748b";

    const eventStart = arg.event.start;
    const timeStr = eventStart
      ? `${eventStart.getHours().toString().padStart(2, "0")}:${eventStart.getMinutes().toString().padStart(2, "0")}`
      : null;

    return (
      <div style={{
        display: "flex",
        flexDirection: "row",
        // Bez overflow:hidden — pozwala lewy pasek być w pełni widoczny
        borderRadius: 6,
        background: "var(--panel)",
        border: "1px solid var(--line)",
        boxShadow: "none",
        minWidth: 0,
        width: "100%",
        cursor: "pointer",
      }}>
        {/* Lewy pasek koloru użytkownika / statusu */}
        <div style={{
          width: 5,
          minWidth: 5,
          flexShrink: 0,
          background: accentColor,
          borderRadius: "5px 0 0 5px",
          alignSelf: "stretch",
        }} />

        {/* Treść karty */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          padding: "4px 7px 5px",
          minWidth: 0,
          flex: 1,
          overflow: "hidden",
        }}>
          {/* Wiersz: godzina + nr zlecenia + customText */}
          <div style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 5,
            minWidth: 0,
            flexWrap: "nowrap",
          }}>
            {timeStr && (
              <span style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#fff",
                background: accentColor,
                borderRadius: 4,
                padding: "2px 6px",
                flexShrink: 0,
                letterSpacing: "0.02em",
                lineHeight: 1.4,
                marginTop: 1,
              }}>
                {timeStr}
              </span>
            )}
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: 3,
              minWidth: 0,
              flexShrink: 1,
            }}>
              <div style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--text-strong)",
                fontFamily: "monospace",
                lineHeight: 1.25,
                wordBreak: "break-word",
              }}>
                {orderName ?? "—"}
              </div>
              {customText && (
                <div style={{ display: "flex" }}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: "var(--text-mute)",
                    background: "var(--panel-2)",
                    border: "1px solid var(--line)",
                    borderRadius: 4,
                    padding: "1px 5px",
                    lineHeight: 1.4,
                    wordBreak: "break-word",
                  }}>
                    {customText}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Klient */}
          <div style={{
            fontSize: 11,
            color: "var(--text-mute)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            lineHeight: 1.3,
            marginTop: 1,
          }}>
            {clientName}
          </div>

          {/* Miasto */}
          {investmentCity && (
            <div style={{
              fontSize: 11,
              color: "var(--text-mute)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              lineHeight: 1.3,
              opacity: 0.85,
            }}>
              📍 {investmentCity}
            </div>
          )}

          {/* Chipa: pracownik */}
          {assignedUserName && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2 }}>
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                color: accentColor,
                background: `${accentColor}22`,
                border: `1px solid ${accentColor}44`,
                borderRadius: 4,
                padding: "1px 6px",
                whiteSpace: "nowrap",
                lineHeight: 1.4,
              }}>
                {assignedUserName}
              </span>
            </div>
          )}
        </div>
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
      {/* Toolbar */}
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
        flexWrap: "wrap",
        gap: 8,
      }}>
        {/* Nawigacja miesiąca/tygodnia */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => calendarRef.current?.getApi().prev()}
            className="btn btn-xs"
            style={{ fontSize: 16, padding: "5px 10px", lineHeight: 1 }}
          >
            ‹
          </button>
          <span style={{
            fontSize: 17,
            fontWeight: 700,
            color: "var(--text-strong)",
            minWidth: 180,
            textAlign: "center",
          }}>
            {weekRange
              ? fmtWeekRange(weekRange.start, weekRange.end)
              : `${MONTH_NAMES[month]} ${year}`}
          </span>
          <button
            onClick={() => calendarRef.current?.getApi().next()}
            className="btn btn-xs"
            style={{ fontSize: 16, padding: "5px 10px", lineHeight: 1 }}
          >
            ›
          </button>
        </div>

        {/* Przełącznik widoku + Dzisiaj */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            display: "flex",
            background: "var(--panel-2)",
            borderRadius: 6,
            padding: 2,
          }}>
            {(["dayGridMonth", "timeGridWeek"] as const).map((v) => (
              <button
                key={v}
                onClick={() => {
                  setView(v);
                  setTimeout(() => calendarRef.current?.getApi().changeView(v), 0);
                }}
                className="btn btn-xs"
                style={{
                  fontSize: 12,
                  padding: "5px 12px",
                  borderRadius: 4,
                  background: view === v ? "var(--accent)" : "transparent",
                  color: view === v ? "#fff" : "var(--text)",
                  border: "none",
                  fontWeight: view === v ? 600 : 400,
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                {v === "dayGridMonth" ? "Miesiąc" : "Tydzień"}
              </button>
            ))}
          </div>
          <button
            onClick={() => calendarRef.current?.getApi().today()}
            className="btn btn-xs"
            style={{ fontSize: 12, padding: "5px 14px" }}
          >
            Dzisiaj
          </button>
        </div>
      </div>

      {/* Kalendarz — FullCalendar ZAWSZE zamontowany, żeby nawigacja nie resetowała widoku */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative" }}>
        <FullCalendar
          ref={calendarRef}
          key={view}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={view}
          locale={plLocale}
          headerToolbar={false}
          events={events}
          editable={true}
          eventDurationEditable={false}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          dateClick={handleDateClick}
          datesSet={handleDatesSet}
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
          slotMinTime="07:00:00"
          slotMaxTime="18:00:00"
          allDaySlot={false}
          nowIndicator={true}
          eventDisplay="block"
          eventClassNames={["fc-event-custom"]}
        />
        {/* Wskaźnik ładowania — nie odmontowuje kalendarza */}
        {orders === undefined && (
          <div style={{
            position: "absolute", bottom: 12, right: 16,
            fontSize: 11, color: "var(--text-mute)",
            background: "var(--panel)", border: "1px solid var(--line)",
            borderRadius: 6, padding: "4px 10px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
            pointerEvents: "none",
          }}>
            Ładowanie…
          </div>
        )}
      </div>

      {/* Modal: przypisz zlecenie do daty */}
      {dateModalOpen && selectedDate && createPortal(
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          {/* Backdrop */}
          <div
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
            onClick={() => setDateModalOpen(false)}
          />

          {/* Panel */}
          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 480,
              maxHeight: "80vh",
              background: "var(--panel)",
              borderRadius: 12,
              border: "1px solid var(--line)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Nagłówek */}
            <div style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--line)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-strong)" }}>
                  Przypisz zlecenie
                </div>
                <div style={{ fontSize: 12, color: "var(--text-mute)", marginTop: 2 }}>
                  {fmtDateTime(selectedDate)}
                </div>
              </div>
              <button
                onClick={() => setDateModalOpen(false)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--text-mute)", padding: 6, borderRadius: 6,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--panel-2)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Wyszukiwarka */}
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
              <input
                type="text"
                placeholder="Szukaj zlecenia lub klienta…"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                autoFocus
                style={{
                  width: "100%",
                  fontSize: 13,
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--line)",
                  background: "var(--panel-2)",
                  color: "var(--text-strong)",
                  fontFamily: "inherit",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Lista zleceń */}
            <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
              {filteredOrders.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: "var(--text-mute)" }}>
                  Brak zleceń
                </div>
              ) : (
                filteredOrders.map((o) => {
                  const selected = selectedOrderId === o._id;
                  return (
                    <button
                      key={o._id}
                      onClick={() => setSelectedOrderId(o._id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        width: "100%",
                        padding: "10px 20px",
                        background: selected ? `var(--accent)11` : "transparent",
                        border: "none",
                        borderBottom: "1px solid var(--line)",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "background 0.1s",
                        borderLeft: selected ? "3px solid var(--accent)" : "3px solid transparent",
                      }}
                      onMouseEnter={(e) => {
                        if (!selected) (e.currentTarget as HTMLButtonElement).style.background = "var(--panel-2)";
                      }}
                      onMouseLeave={(e) => {
                        if (!selected) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                      }}
                    >
                      <div style={{
                        width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                        background: selected ? "var(--accent)" : "var(--line)",
                        transition: "background 0.1s",
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13, fontWeight: 600,
                          color: "var(--text-strong)", fontFamily: "monospace",
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        }}>
                          {o.name ?? "—"}
                        </div>
                        <div style={{
                          fontSize: 12, color: "var(--text-mute)",
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        }}>
                          {o.clientName}
                        </div>
                      </div>
                      {o.customText && (
                        <span style={{
                          fontSize: 10, color: "var(--text-mute)",
                          background: "var(--panel-2)", border: "1px solid var(--line)",
                          borderRadius: 3, padding: "1px 6px", whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}>
                          {o.customText}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Stopka */}
            <div style={{
              padding: "12px 20px",
              borderTop: "1px solid var(--line)",
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              flexShrink: 0,
            }}>
              <button
                onClick={() => setDateModalOpen(false)}
                className="btn btn-xs"
                style={{ fontSize: 13, padding: "7px 16px" }}
              >
                Anuluj
              </button>
              <button
                onClick={handleAssignDate}
                disabled={!selectedOrderId}
                className="btn primary btn-xs"
                style={{ fontSize: 13, padding: "7px 16px", opacity: selectedOrderId ? 1 : 0.45 }}
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
