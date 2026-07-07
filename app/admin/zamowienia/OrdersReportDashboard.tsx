"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateInput(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function fromDateInput(str: string): number {
  return new Date(str + "T00:00:00").getTime();
}

function toEndOfDay(str: string): number {
  return new Date(str + "T23:59:59.999").getTime();
}

function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const to = toDateInput(now.getTime());
  const from = toDateInput(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  return { from, to };
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 110,
        background: accent ? "var(--accent)" : "var(--panel-2)",
        border: `1px solid ${accent ? "transparent" : "var(--line)"}`,
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 5,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: accent ? "rgba(255,255,255,0.75)" : "var(--text-mute)",
          textTransform: "uppercase",
          letterSpacing: 0.7,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 800,
          color: accent ? "#fff" : "var(--text-strong)",
          lineHeight: 1,
          letterSpacing: -0.5,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: accent ? "rgba(255,255,255,0.6)" : "var(--text-mute)", fontWeight: 500 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ─── Trend Badge ─────────────────────────────────────────────────────────────

function TrendBadge({ delta }: { delta: number | null }) {
  if (delta === null) {
    return (
      <span style={{ fontSize: 11, color: "var(--text-mute)", display: "inline-flex", alignItems: "center", gap: 3 }}>
        <Minus size={12} /> brak danych
      </span>
    );
  }
  const positive = delta > 0;
  const neutral = delta === 0;
  const color = neutral ? "var(--text-mute)" : positive ? "var(--ok)" : "var(--error, #ef4444)";
  const Icon = neutral ? Minus : positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span style={{ fontSize: 11, color, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}>
      <Icon size={12} />
      {neutral ? "bez zmian" : `${positive ? "+" : ""}${delta} pp`}
    </span>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 0", gap: 8, color: "var(--text-mute)" }}>
      <TrendingUp size={28} strokeWidth={1.5} />
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)" }}>Brak danych w wybranym okresie</div>
      <div style={{ fontSize: 12, textAlign: "center", maxWidth: 320 }}>
        Żadna szansa sprzedaży nie dotarła do etapu wysłania oferty w tym przedziale czasu.
      </div>
    </div>
  );
}

// ─── Date Input ──────────────────────────────────────────────────────────────

function DateInput({ value, onChange, min, max }: { value: string; onChange: (v: string) => void; min?: string; max?: string }) {
  return (
    <input
      type="date"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: "5px 10px",
        borderRadius: 8,
        border: "1px solid var(--line)",
        background: "var(--panel-2)",
        fontSize: 12,
        fontWeight: 500,
        fontFamily: "inherit",
        color: "var(--text-strong)",
        outline: "none",
        cursor: "pointer",
      }}
    />
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function OrdersReportDashboard() {
  const defaults = useMemo(() => defaultRange(), []);
  const [fromDate, setFromDate] = useState(defaults.from);
  const [toDate, setToDate] = useState(defaults.to);

  const fromTs = useMemo(() => fromDateInput(fromDate), [fromDate]);
  const toTs = useMemo(() => toEndOfDay(toDate), [toDate]);

  const report = useQuery(api.salesOpportunities.getConversionReport, { fromTs, toTs });

  const isLoading = report === undefined;
  const isEmpty = report !== undefined && report.base === 0;

  const PIE_COLORS = ["var(--accent)", "var(--panel-3, #e8eaed)"];

  const pieData = report
    ? [
        { name: "Przekonwertowane", value: report.converted },
        { name: "Nieprzekonwertowane", value: report.base - report.converted },
      ]
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-strong)" }}>
            Konwersja szans sprzedaży → zlecenia
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-mute)", marginTop: 2 }}>
            Procent szans z wysłaną ofertą, które zostały przekonwertowane na zlecenie.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 11.5, color: "var(--text-mute)", fontWeight: 600 }}>Od</span>
          <DateInput value={fromDate} onChange={setFromDate} max={toDate} />
          <span style={{ fontSize: 11.5, color: "var(--text-mute)", fontWeight: 600 }}>Do</span>
          <DateInput value={toDate} onChange={setToDate} min={fromDate} />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ height: 100, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-mute)", fontSize: 13 }}>
          Ładowanie…
        </div>
      ) : isEmpty ? (
        <EmptyState />
      ) : (
        <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>

          {/* Pie chart */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, flex: "0 0 auto" }}>
            <div style={{ width: 176, height: 176, position: "relative" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={54}
                    outerRadius={78}
                    paddingAngle={report.converted > 0 && report.converted < report.base ? 3 : 0}
                    dataKey="value"
                    startAngle={90}
                    endAngle={-270}
                    strokeWidth={0}
                  >
                    {pieData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--panel, #fff)",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      fontSize: 12,
                      fontFamily: "inherit",
                    }}
                    formatter={(value: number, name: string) => [`${value} szans`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label overlay */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                }}
              >
                <span style={{ fontSize: 22, fontWeight: 800, color: "var(--text-strong)", lineHeight: 1 }}>
                  {report.rate !== null ? `${report.rate}%` : "—"}
                </span>
                <span style={{ fontSize: 9, fontWeight: 700, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 0.8, marginTop: 3 }}>
                  konwersja
                </span>
              </div>
            </div>
            {/* Legend */}
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {[
                { color: "var(--accent)", label: "Przekonwertowane", count: report.converted },
                { color: "var(--panel-3, #e8eaed)", label: "Nieprzekonwertowane", count: report.base - report.converted },
              ].map(({ color, label, count }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--text-mute)", fontWeight: 500 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
                  {label}
                  <span style={{ marginLeft: 2, fontWeight: 700, color: "var(--text-strong)" }}>({count})</span>
                </div>
              ))}
            </div>
          </div>

          {/* Metrics column */}
          <div style={{ flex: 1, minWidth: 280, display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Top 3 cards */}
            <div style={{ display: "flex", gap: 10 }}>
              <MetricCard label="Oferty wysłane" value={report.base} sub="Szanse z etapu inquiry" />
              <MetricCard label="Przekonwertowane" value={report.converted} sub="Stało się zleceniem" accent />
              <MetricCard label="Nie skonwertowane" value={report.base - report.converted} sub="Aktywne lub zarchiwizowane" />
            </div>

            {/* Trend card */}
            <div
              style={{
                background: "var(--panel-2)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: "14px 18px",
                display: "flex",
                gap: 20,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                  <TrendingUp size={11} />
                  Trend vs poprzedni okres
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: "var(--text-strong)" }}>
                    {report.prevRate !== null ? `${report.prevRate}%` : "—"}
                  </span>
                  <TrendBadge delta={report.delta} />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-mute)", marginTop: 4 }}>
                  Poprzedni okres: {report.prevConverted} / {report.prevBase} szans
                </div>
              </div>

              {/* Mini bar comparison */}
              <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Poprz. / Wybrany
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 48 }}>
                  {[
                    { val: report.prevRate ?? 0, color: "var(--line)", label: "Poprzedni" },
                    { val: report.rate ?? 0, color: "var(--accent)", label: "Wybrany" },
                  ].map(({ val, color, label }) => {
                    const maxVal = Math.max(report.rate ?? 0, report.prevRate ?? 0, 1);
                    const h = Math.max(4, (val / maxVal) * 40);
                    return (
                      <div
                        key={label}
                        title={`${label}: ${val}%`}
                        style={{
                          width: 28,
                          height: h,
                          borderRadius: "4px 4px 0 0",
                          background: color,
                          alignSelf: "flex-end",
                          transition: "height 0.4s ease",
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
