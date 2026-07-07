"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import multiMonthPlugin from "@fullcalendar/multimonth";
import interactionPlugin from "@fullcalendar/interaction";
import plLocale from "@fullcalendar/core/locales/pl";
import type { EventClickArg, EventDropArg, EventContentArg, DatesSetArg } from "@fullcalendar/core";
import type { DateClickArg } from "@fullcalendar/interaction";
import type { Id } from "@/convex/_generated/dataModel";
import { useStatuses } from "@/components/StatusLabelsContext";

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

// Polska odmiana: 1 montaż, 2–4 montaże, 5+ montaży
function montazLabel(n: number): string {
  if (n === 1) return "montaż";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "montaże";
  return "montaży";
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
  const [view, setView] = useState<"multiMonth4" | "dayGridMonth" | "timeGridWeek">("multiMonth4");
  const [visibleRange, setVisibleRange] = useState<{ start: Date; end: Date }>({
    start: new Date(year, month, 1),
    end: new Date(year, month + 1, 0),
  });
  const updateOrder = useMutation(api.orders.update);

  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [orderSearch, setOrderSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [fullScreenOpen, setFullScreenOpen] = useState(false);
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    title: string;
    content: React.ReactNode;
  }>({ visible: false, x: 0, y: 0, title: "", content: null });

  const statuses = useStatuses();
  const statusColorByKey = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of statuses) m[s.key] = s.color;
    return m;
  }, [statuses]);

  const allOrders = useQuery(api.orders.listForPicker);
  const currentUser = useQuery(api.users.me);
  const allUsers = useQuery(api.users.listAllActive);
  const [activeUserFilters, setActiveUserFilters] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentUser?._id) return;
    const key = `montaz_user_filter_${currentUser._id}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) {
          setTimeout(() => setActiveUserFilters(new Set(arr)), 0);
        }
      }
    } catch {}
  }, [currentUser?._id]);

  const toggleUserFilter = (id: string) => {
    setActiveUserFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (currentUser?._id) {
        localStorage.setItem(`montaz_user_filter_${currentUser._id}`, JSON.stringify([...next]));
      }
      return next;
    });
  };

  const orders = useQuery(api.orders.listByCompletionDateRange, {
    startDate: visibleRange.start.getTime(),
    endDate: visibleRange.end.getTime(),
  });

  const events = useMemo(() => {
    if (!orders) return [];
    const filtered = activeUserFilters.size === 0
      ? orders
      : orders.filter((o) => {
          const uid = o.assignedUserId as string | undefined;
          if (!uid) return activeUserFilters.has("__none__");
          return activeUserFilters.has(uid);
        });
    return filtered.map((o) => {
      const startMins = o.installationStartDate ?? DEFAULT_START_HOUR * 60;
      const start = minsToDate(o.projectEndDate, startMins);
      const end = minsToDate(o.projectEndDate, startMins + EVENT_DURATION_HOURS * 60);

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
          assignedUserId: o.assignedUserId,
          assignedUserName: o.assignedUserName,
          assignedUserColor: o.assignedUserColor,
        },
      };
    });
  }, [orders, activeUserFilters]);

  // BUG FIX: zapisuje zarówno nową datę dnia (completionDate) jak i godzinę (installationStart)
  // dzięki temu drag & drop między dniami w widoku tygodniowym działa poprawnie.
  const handleEventDrop = async (info: EventDropArg) => {
    const orderId = info.event.id;
    const newStart = info.event.start;
    if (!newStart) return;

    await updateOrder({
      orderId: orderId as Id<"orders">,
      projectEndDate: localMidnight(newStart),
      installationStartDate: dateToMins(newStart),
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

  // Ile montaży jest już zaplanowanych na wybrany dzień (z widocznego zakresu)
  const dayMontazCount = useMemo(() => {
    if (!selectedDate || !orders) return 0;
    const dayStart = localMidnight(selectedDate);
    return orders.filter((o) => localMidnight(new Date(o.projectEndDate)) === dayStart).length;
  }, [selectedDate, orders]);

  const handleAssignDate = async () => {
    if (!selectedOrderId || !selectedDate) return;
    await updateOrder({
      orderId: selectedOrderId as Id<"orders">,
      projectEndDate: localMidnight(selectedDate),
      installationStartDate: dateToMins(selectedDate),
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

    const accentColor = assignedUserColor ?? statusColorByKey[status] ?? "#64748b";

    const eventStart = arg.event.start;
    const timeStr = eventStart
      ? `${eventStart.getHours().toString().padStart(2, "0")}:${eventStart.getMinutes().toString().padStart(2, "0")}`
      : null;

    const isQuarterView = arg.view.type === "multiMonth4";

    if (isQuarterView) {
      const tooltipContent = (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {timeStr && (
              <span style={{
                fontSize: 11,
                fontWeight: 800,
                color: "#fff",
                background: accentColor,
                borderRadius: 4,
                padding: "2px 6px",
              }}>
                {timeStr}
              </span>
            )}
            <span style={{ fontWeight: 700 }}>{orderName ?? clientName}</span>
          </div>
          {customText && (
            <span style={{ fontSize: 11, color: "var(--text-mute)" }}>{customText}</span>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-mute)" }}>
            {investmentCity && <span>{investmentCity}</span>}
            {investmentCity && assignedUserName && <span>•</span>}
            {assignedUserName && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, color: accentColor, fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: accentColor }} />
                {assignedUserName}
              </span>
            )}
          </div>
        </div>
      );

      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            borderRadius: 2,
            background: accentColor,
            padding: "0px 2px",
            fontSize: 7,
            fontWeight: 600,
            color: "#fff",
            overflow: "hidden",
            whiteSpace: "nowrap",
            cursor: "pointer",
            lineHeight: 1.2,
            maxHeight: "14px",
          }}
          onMouseEnter={(e) => setTooltip({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            title: orderName ?? clientName,
            content: tooltipContent,
          })}
          onMouseMove={(e) => setTooltip((t) => ({ ...t, x: e.clientX, y: e.clientY }))}
          onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
        >
          {timeStr && <span style={{ fontWeight: 700 }}>{timeStr}</span>}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{orderName ?? clientName}</span>
        </div>
      );
    }

    return (
      <div
        className="calendar-event-card"
        style={{
          display: "flex",
          flexDirection: "row",
          borderRadius: 8,
          background: "var(--panel)",
          border: "1px solid var(--line)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          minWidth: 0,
          width: "100%",
          cursor: "pointer",
          transition: "all 0.15s ease",
        }}
      >
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
        gap: 12,
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
          {orders !== undefined && (
            <span
              title="Liczba montaży widocznych po uwzględnieniu filtrów"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-mute)",
                background: "var(--panel-2)",
                border: "1px solid var(--line)",
                borderRadius: 20,
                padding: "3px 10px",
                whiteSpace: "nowrap",
              }}
            >
              {events.length} {montazLabel(events.length)}
            </span>
          )}
        </div>

        {/* Przełącznik widoku + Dzisiaj */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            display: "flex",
            background: "var(--panel-2)",
            borderRadius: 8,
            padding: 3,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}>
            {(["multiMonth4", "dayGridMonth", "timeGridWeek"] as const).map((v) => (
              <button
                key={v}
                onClick={() => {
                  setView(v);
                  setTimeout(() => calendarRef.current?.getApi().changeView(v), 0);
                }}
                className={`btn btn-xs calendar-view-btn ${view === v ? "active" : ""}`}
                style={{
                  fontSize: 12,
                  padding: "6px 14px",
                  borderRadius: 5,
                  background: view === v ? "var(--accent)" : "transparent",
                  color: view === v ? "#fff" : "var(--text)",
                  border: "none",
                  fontWeight: view === v ? 600 : 500,
                  transition: "all 0.15s ease",
                  margin: "0 1px",
                }}>
                  {v === "multiMonth4" ? "Kwartał" : v === "dayGridMonth" ? "Miesiąc" : "Tydzień"}
              </button>
            ))}
          </div>
          <button
            onClick={() => calendarRef.current?.getApi().today()}
            className="btn btn-xs"
            style={{ fontSize: 12, padding: "6px 14px", borderRadius: 6 }}
          >
            Dzisiaj
          </button>
          {view === "multiMonth4" && (
            <button
              onClick={() => setFullScreenOpen(true)}
              className="btn btn-xs"
              style={{ fontSize: 12, padding: "6px 14px", borderRadius: 6 }}
              title="Pełny ekran"
            >
              ⛶
            </button>
          )}
        </div>
      </div>

      {/* User filter chips */}
      {allUsers && (
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          padding: "8px 20px",
          borderBottom: "1px solid var(--line)",
          background: "var(--card)",
        }}>
          {[...allUsers]
            .sort((a, b) => {
              if (a._id === currentUser?._id) return -1;
              if (b._id === currentUser?._id) return 1;
              return 0;
            })
            .map((user) => {
              const name = user.displayName ?? user.login ?? "?";
              const isMe = user._id === currentUser?._id;
              const active = activeUserFilters.has(user._id as string);
              return (
                <button
                  key={user._id}
                  onClick={() => toggleUserFilter(user._id as string)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "4px 10px",
                    borderRadius: 20,
                    fontSize: 11.5,
                    background: active ? `${user.color ?? "#64748b"}22` : "var(--panel)",
                    color: active ? (user.color ?? "var(--accent)") : "var(--text-mute)",
                    border: `1.5px solid ${active ? (user.color ?? "var(--accent)") : "var(--line)"}`,
                    fontWeight: active ? 600 : 500,
                    cursor: "pointer",
                    transition: "all 0.12s",
                    fontFamily: "inherit",
                  }}
                >
                  <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: user.color ? (active ? user.color : `${user.color}80`) : (active ? "#64748b" : "#64748b40"),
                    flexShrink: 0,
                  }} />
                  {name}{isMe ? " (Ty)" : ""}
                </button>
              );
            })}
          <button
            onClick={() => toggleUserFilter("__none__")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 10px",
              borderRadius: 20,
              fontSize: 11.5,
              background: activeUserFilters.has("__none__") ? "var(--panel-3)" : "var(--panel)",
              color: activeUserFilters.has("__none__") ? "var(--text-strong)" : "var(--text-mute)",
              border: `1.5px solid ${activeUserFilters.has("__none__") ? "var(--text-mute)" : "var(--line)"}`,
              fontWeight: activeUserFilters.has("__none__") ? 600 : 500,
              cursor: "pointer",
              transition: "all 0.12s",
              fontFamily: "inherit",
            }}
          >
            <span style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              flexShrink: 0,
              border: `1.5px dashed ${activeUserFilters.has("__none__") ? "var(--text-strong)" : "var(--text-mute)"}`,
            }} />
            Bez przypisania
          </button>
        </div>
      )}

      {/* Kalendarz — FullCalendar ZAWSZE zamontowany, żeby nawigacja nie resetowała widoku */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative" }}>
        <FullCalendar
          ref={calendarRef}
          key={view}
          plugins={[dayGridPlugin, timeGridPlugin, multiMonthPlugin, interactionPlugin]}
          initialView={view}
          views={{
            multiMonth4: {
              type: "multiMonth",
              duration: { months: 4 },
              multiMonthMaxColumns: 2,
              dayMaxEvents: 99,
              dayMaxEventRows: 99,
              fixedWeekCount: true,
            },
          }}
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
          dayMaxEvents={view === "multiMonth4" ? 99 : 3}
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

      {/* Tooltip dla widoku kwartalnego */}
      {tooltip.visible && createPortal(
        <div style={{
          position: "fixed",
          left: tooltip.x + 12,
          top: tooltip.y + 12,
          zIndex: 100,
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: 8,
          padding: "10px 12px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          fontSize: 12,
          color: "var(--text)",
          maxWidth: 260,
          pointerEvents: "none",
        }}>
          {tooltip.content}
        </div>,
        document.body
      )}

      {/* Full screen kwartalny widok */}
      {fullScreenOpen && createPortal(
        <div className="fc-fullscreen-calendar" style={{
          position: "fixed",
          inset: 0,
          zIndex: 60,
          display: "flex",
          flexDirection: "column",
          background: "var(--background)",
        }}>
          {/* Toolbar */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 20px",
            borderBottom: "1px solid var(--line)",
            background: "var(--card)",
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{
                fontSize: 17,
                fontWeight: 700,
                color: "var(--text-strong)",
              }}>
                Widok kwartalny — pełny ekran
              </span>
            </div>
            <button
              onClick={() => setFullScreenOpen(false)}
              className="btn btn-xs"
              style={{ fontSize: 12, padding: "6px 14px", borderRadius: 6 }}
            >
              ✕ Zamknij
            </button>
          </div>

          {/* User filter chips */}
          {allUsers && (
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              padding: "8px 20px",
              borderBottom: "1px solid var(--line)",
              background: "var(--card)",
              flexShrink: 0,
            }}>
              {[...allUsers]
                .sort((a, b) => {
                  if (a._id === currentUser?._id) return -1;
                  if (b._id === currentUser?._id) return 1;
                  return 0;
                })
                .map((user) => {
                  const name = user.displayName ?? user.login ?? "?";
                  const isMe = user._id === currentUser?._id;
                  const active = activeUserFilters.has(user._id as string);
                  return (
                    <button
                      key={user._id}
                      onClick={() => toggleUserFilter(user._id as string)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "4px 10px",
                        borderRadius: 20,
                        fontSize: 11.5,
                        background: active ? `${user.color ?? "#64748b"}22` : "var(--panel)",
                        color: active ? (user.color ?? "var(--accent)") : "var(--text-mute)",
                        border: `1.5px solid ${active ? (user.color ?? "var(--accent)") : "var(--line)"}`,
                        fontWeight: active ? 600 : 500,
                        cursor: "pointer",
                        transition: "all 0.12s",
                        fontFamily: "inherit",
                      }}
                    >
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: user.color ? (active ? user.color : `${user.color}80`) : (active ? "#64748b" : "#64748b40"),
                        flexShrink: 0,
                      }} />
                      {name}{isMe ? " (Ty)" : ""}
                    </button>
                  );
                })}
              <button
                onClick={() => toggleUserFilter("__none__")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  borderRadius: 20,
                  fontSize: 11.5,
                  background: activeUserFilters.has("__none__") ? "var(--panel-3)" : "var(--panel)",
                  color: activeUserFilters.has("__none__") ? "var(--text-strong)" : "var(--text-mute)",
                  border: `1.5px solid ${activeUserFilters.has("__none__") ? "var(--text-mute)" : "var(--line)"}`,
                  fontWeight: activeUserFilters.has("__none__") ? 600 : 500,
                  cursor: "pointer",
                  transition: "all 0.12s",
                  fontFamily: "inherit",
                }}
              >
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  flexShrink: 0,
                  border: `1.5px dashed ${activeUserFilters.has("__none__") ? "var(--text-strong)" : "var(--text-mute)"}`,
                }} />
                Bez przypisania
              </button>
            </div>
          )}

          {/* Kalendarz full screen */}
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <FullCalendar
              ref={calendarRef}
              key="fullscreen"
              plugins={[dayGridPlugin, timeGridPlugin, multiMonthPlugin, interactionPlugin]}
              initialView="multiMonth4"
              views={{
                multiMonth4: {
                  type: "multiMonth",
                  duration: { months: 4 },
                  multiMonthMaxColumns: 2,
                  dayMaxEvents: 99,
                  dayMaxEventRows: 99,
                  fixedWeekCount: true,
                },
              }}
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
              dayMaxEvents={99}
              eventTimeFormat={{
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }}
              allDaySlot={false}
              nowIndicator={true}
              eventDisplay="block"
              eventClassNames={["fc-event-custom"]}
            />
          </div>
        </div>,
        document.body
      )}

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
                {dayMontazCount > 0 && (
                  <div style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    marginTop: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#92600a",
                    background: "#fbe7c2",
                    border: "1px solid #f0cd8a",
                    borderRadius: 6,
                    padding: "3px 8px",
                  }}>
                    ⚠ Na ten dzień {dayMontazCount === 1 ? "jest już" : "są już"} {dayMontazCount} {montazLabel(dayMontazCount)}
                  </div>
                )}
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
