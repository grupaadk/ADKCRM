"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";

const DAY_LABELS = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nie"];

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

function isToday(d: Date) {
  const t = new Date();
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
}

function minsToTimeStr(mins: number | undefined) {
  if (mins == null) return "";
  const h = Math.floor(mins / 60).toString().padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

type OrderItem = {
  _id: string;
  completionDate: number;
  status: string;
  clientId: string;
  clientName: string;
  services: string[];
  name?: string;
  installationStart?: number;
  installationEnd?: number;
};

export default function InstallationCalendar() {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const updateOrder = useMutation(api.orders.update);

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();

  const gridStart = new Date(year, month, 1 - startDow);
  const gridEnd = new Date(year, month, 1 - startDow + 41);

  const orders = useQuery(api.orders.listByCompletionDateRange, {
    startDate: gridStart.getTime(),
    endDate: gridEnd.getTime(),
  });

  const ordersByDate = useMemo(() => {
    if (!orders) return new Map<string, OrderItem[]>();
    const map = new Map<string, OrderItem[]>();
    for (const o of orders) {
      const key = new Date(o.completionDate).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    }
    return map;
  }, [orders]);

  function goPrev() {
    if (month === 0) { setYear(year - 1); setMonth(11); }
    else { setMonth(month - 1); }
  }

  function goNext() {
    if (month === 11) { setYear(year + 1); setMonth(0); }
    else { setMonth(month + 1); }
  }

  function goToday() {
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth());
  }

  const cells = useMemo(() => {
    const result: { day: number; date: Date; otherMonth: boolean }[] = [];
    let d = 1;
    for (let i = 0; i < 42; i++) {
      if (i < startDow) {
        const prevMonthLast = new Date(year, month, 0).getDate();
        const dayNum = prevMonthLast - startDow + i + 1;
        result.push({ day: dayNum, date: new Date(year, month - 1, dayNum), otherMonth: true });
      } else if (d <= totalDays) {
        result.push({ day: d, date: new Date(year, month, d), otherMonth: false });
        d++;
      } else {
        const dayNum = d - totalDays;
        result.push({ day: dayNum, date: new Date(year, month + 1, dayNum), otherMonth: true });
        d++;
      }
    }
    return result;
  }, [year, month, startDow, totalDays]);

  const handleDragStart = useCallback((e: React.DragEvent, orderId: string) => {
    e.dataTransfer.setData("text/plain", orderId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIdx(idx);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverIdx(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, cell: typeof cells[0]) => {
    e.preventDefault();
    setDragOverIdx(null);
    const orderId = e.dataTransfer.getData("text/plain");
    if (!orderId) return;
    const midnight = new Date(cell.date.getFullYear(), cell.date.getMonth(), cell.date.getDate()).getTime();
    await updateOrder({ orderId: orderId as any, completionDate: midnight });
  }, [updateOrder]);

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: 12,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={goPrev} className="btn btn-xs" style={{ fontSize: 14, padding: "4px 8px", lineHeight: 1 }}>‹</button>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-strong)" }}>
            {MONTH_NAMES[month]} {year}
          </span>
          <button onClick={goNext} className="btn btn-xs" style={{ fontSize: 14, padding: "4px 8px", lineHeight: 1 }}>›</button>
        </div>
        <button onClick={goToday} className="btn btn-xs" style={{ fontSize: 11 }}>Dzisiaj</button>
      </div>

      {/* Day headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--line)" }}>
        {DAY_LABELS.map((label) => (
          <div key={label} style={{ padding: "8px 12px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textAlign: "center", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {label}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", flex: 1, minHeight: 0 }}>
        {cells.map((cell, idx) => {
          const dateKey = cell.date.toDateString();
          const dayOrders = ordersByDate.get(dateKey) ?? [];
          const isTodayCell = isToday(cell.date);
          const isOver = dragOverIdx === idx;

          return (
            <div
              key={idx}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, cell)}
              style={{
                minHeight: 90,
                borderRight: idx % 7 !== 6 ? "1px solid var(--line)" : "none",
                borderBottom: idx < 35 ? "1px solid var(--line)" : "none",
                padding: 4,
                background: isOver
                  ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                  : isTodayCell
                    ? "color-mix(in srgb, var(--accent) 6%, transparent)"
                    : cell.otherMonth
                      ? "var(--panel)"
                      : undefined,
                display: "flex",
                flexDirection: "column",
                gap: 2,
                position: "relative",
                transition: "background 0.15s",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: isTodayCell ? 700 : 500,
                  color: isTodayCell ? "#fff" : cell.otherMonth ? "var(--text-muted)" : "var(--text-strong)",
                  padding: "2px 4px",
                  borderRadius: 999,
                  background: isTodayCell ? "var(--accent)" : "transparent",
                  width: "fit-content",
                  lineHeight: "16px",
                  minWidth: 20,
                  textAlign: "center",
                  marginBottom: 2,
                }}
              >
                {cell.day}
              </span>
              {dayOrders.slice(0, 3).map((o) => {
                const timeLabel = minsToTimeStr(o.installationStart)
                  + (o.installationEnd ? `–${minsToTimeStr(o.installationEnd)}` : "");
                return (
                  <div
                    key={o._id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, o._id)}
                    onClick={() => router.push(`/admin/klient/${o.clientId}/zlecenie/${o._id}`)}
                    style={{
                      fontSize: 10.5,
                      padding: "2px 6px",
                      borderRadius: 4,
                      cursor: "grab",
                      background: "var(--panel)",
                      borderLeft: `3px solid ${STATUS_COLORS[o.status] ?? "#888"}`,
                      color: "var(--text-strong)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      lineHeight: "18px",
                      transition: "background 0.15s, opacity 0.15s",
                    }}
                    onMouseEnter={(e) => { if (dragOverIdx == null) e.currentTarget.style.background = "var(--line)"; }}
                    onMouseLeave={(e) => { if (dragOverIdx == null) e.currentTarget.style.background = "var(--panel)"; }}
                  >
                    {timeLabel ? `${timeLabel} ${o.clientName}` : o.clientName}
                  </div>
                );
              })}
              {dayOrders.length > 3 && (
                <span style={{ fontSize: 10, color: "var(--text-muted)", paddingLeft: 4 }}>
                  +{dayOrders.length - 3} więcej
                </span>
              )}
            </div>
          );
        })}
      </div>

      {orders === undefined && (
        <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
          Ładowanie...
        </div>
      )}
    </div>
  );
}
