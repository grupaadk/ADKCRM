"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";

const STATUS_LABELS: Record<string, string> = {
  lead: "Lead",
  inquiry: "Oferta wysłana",
  measurement: "Do pomiarów",
  offer: "Oferta po pomiarze",
  contract: "Umowa",
  production: "Produkcja",
  installation: "Montaż",
  completed: "Zakończone",
  warranty: "Gwarancja",
};

const STATUS_COLORS: Record<string, string> = {
  lead: "bg-gray-400",
  inquiry: "bg-blue-400",
  measurement: "bg-yellow-400",
  offer: "bg-orange-400",
  contract: "bg-green-400",
  production: "bg-purple-400",
  installation: "bg-indigo-400",
  completed: "bg-emerald-400",
  warranty: "bg-red-400",
};

const STATUS_BADGE_COLORS: Record<string, string> = {
  lead: "bg-gray-100 text-gray-700",
  inquiry: "bg-blue-100 text-blue-700",
  measurement: "bg-yellow-100 text-yellow-800",
  offer: "bg-orange-100 text-orange-700",
  contract: "bg-green-100 text-green-700",
  production: "bg-purple-100 text-purple-700",
  installation: "bg-indigo-100 text-indigo-700",
  completed: "bg-emerald-100 text-emerald-700",
  warranty: "bg-red-100 text-red-700",
};

const EVENT_LABELS: Record<string, string> = {
  created: "Utworzono klienta",
  status_changed: "Zmiana statusu",
  document_generated: "Wygenerowano dokument",
  document_removed: "Usunięto dokument",
  data_updated: "Zaktualizowano dane",
  folder_created: "Utworzono folder",
  warranty_card_added: "Dodano kartę gwarancyjną",
};

// --- Dane przykładowe ---
const MONTHLY_REVENUE = [
  { month: "Maj '24", wyceny: 18, wartosc: 112000, zrealizowane: 68000 },
  { month: "Cze '24", wyceny: 22, wartosc: 143000, zrealizowane: 89000 },
  { month: "Lip '24", wyceny: 19, wartosc: 128000, zrealizowane: 76000 },
  { month: "Sie '24", wyceny: 25, wartosc: 167000, zrealizowane: 105000 },
  { month: "Wrz '24", wyceny: 30, wartosc: 198000, zrealizowane: 134000 },
  { month: "Paź '24", wyceny: 28, wartosc: 185000, zrealizowane: 121000 },
  { month: "Lis '24", wyceny: 21, wartosc: 139000, zrealizowane: 94000 },
  { month: "Gru '24", wyceny: 17, wartosc: 104000, zrealizowane: 72000 },
  { month: "Sty '25", wyceny: 24, wartosc: 156000, zrealizowane: 98000 },
  { month: "Lut '25", wyceny: 27, wartosc: 174000, zrealizowane: 112000 },
  { month: "Mar '25", wyceny: 33, wartosc: 214000, zrealizowane: 145000 },
  { month: "Kwi '25", wyceny: 31, wartosc: 201000, zrealizowane: 138000 },
];

const SERVICES_PIE = [
  { name: "Okna", value: 38, color: "#3b82f6" },
  { name: "Drzwi", value: 22, color: "#10b981" },
  { name: "Bramy", value: 14, color: "#f59e0b" },
  { name: "Zabudowa tarasu", value: 12, color: "#8b5cf6" },
  { name: "Konstr. aluminiowa", value: 8, color: "#ef4444" },
  { name: "Sys. przeciwsłon.", value: 6, color: "#06b6d4" },
];

const STATUS_PIE = [
  { name: "Lead", value: 12, color: "#9ca3af" },
  { name: "Oferta wysłana", value: 8, color: "#60a5fa" },
  { name: "Do pomiarów", value: 6, color: "#fbbf24" },
  { name: "Oferta po pomiarze", value: 9, color: "#fb923c" },
  { name: "Umowa", value: 5, color: "#4ade80" },
  { name: "Produkcja", value: 4, color: "#a78bfa" },
  { name: "Montaż", value: 3, color: "#818cf8" },
  { name: "Zakończone", value: 11, color: "#34d399" },
];

const CONVERSION_DATA = [
  { month: "Wrz '24", wskaznik: 42 },
  { month: "Paź '24", wskaznik: 45 },
  { month: "Lis '24", wskaznik: 48 },
  { month: "Gru '24", wskaznik: 44 },
  { month: "Sty '25", wskaznik: 51 },
  { month: "Lut '25", wskaznik: 53 },
  { month: "Mar '25", wskaznik: 56 },
  { month: "Kwi '25", wskaznik: 58 },
];

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(v);
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${accent ?? "text-slate-900"}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-2 h-4 w-24 rounded bg-gray-200" />
      <div className="h-8 w-16 rounded bg-gray-200" />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-base font-semibold text-slate-800">{children}</h2>
  );
}

const CustomTooltipCurrency = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg text-sm">
      <p className="mb-1 font-semibold text-slate-700">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" && p.name.toLowerCase().includes("wartość") ? formatCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

const CustomTooltipPercent = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg text-sm">
      <p className="mb-1 font-semibold text-slate-700">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value}%
        </p>
      ))}
    </div>
  );
};

const RADIAN = Math.PI / 180;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderCustomizedLabel = (props: any) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props as {
    cx: number;
    cy: number;
    midAngle: number;
    innerRadius: number;
    outerRadius: number;
    percent: number;
  };
  if (percent < 0.06) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      fontWeight={600}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function DashboardPage() {
  const stats = useQuery(api.dashboard.getStats);
  const recentEvents = useQuery(api.dashboard.getRecentEvents);

  const totalWyceny = MONTHLY_REVENUE.reduce((s, m) => s + m.wyceny, 0);
  const totalWartosc = MONTHLY_REVENUE.reduce((s, m) => s + m.wartosc, 0);
  const totalZrealizowane = MONTHLY_REVENUE.reduce(
    (s, m) => s + m.zrealizowane,
    0,
  );
  const avgWycena = Math.round(totalWartosc / totalWyceny);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-slate-500">
          Podsumowanie systemu CRM — dane przykładowe za ostatnie 12 miesięcy.
        </p>
      </div>

      {/* === KPI CARDS === */}
      <div>
        <SectionTitle>Kluczowe wskaźniki (ostatnie 12 mies.)</SectionTitle>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Łączna liczba wycen"
            value={totalWyceny}
            sub="ostatnie 12 miesięcy"
            accent="text-slate-900"
          />
          <StatCard
            label="Wartość pipeline"
            value={formatCurrency(totalWartosc)}
            sub="suma wszystkich wycen"
            accent="text-blue-600"
          />
          <StatCard
            label="Zrealizowane"
            value={formatCurrency(totalZrealizowane)}
            sub={`${Math.round((totalZrealizowane / totalWartosc) * 100)}% wartości wycen`}
            accent="text-emerald-600"
          />
          <StatCard
            label="Śr. wartość wyceny"
            value={formatCurrency(avgWycena)}
            sub="na zlecenie"
            accent="text-slate-900"
          />
        </div>
      </div>

      {/* === LINE CHART: Wyceny i wartość === */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <SectionTitle>Wyceny i przychody — ostatnie 12 miesięcy</SectionTitle>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={MONTHLY_REVENUE}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatCurrency(v)}
              width={85}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <Tooltip content={<CustomTooltipCurrency />} />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="wartosc"
              name="Wartość wycen (PLN)"
              stroke="#3b82f6"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#3b82f6" }}
              activeDot={{ r: 6 }}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="zrealizowane"
              name="Zrealizowane (PLN)"
              stroke="#10b981"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#10b981" }}
              activeDot={{ r: 6 }}
              strokeDasharray="5 3"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="wyceny"
              name="Liczba wycen"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ r: 3, fill: "#f59e0b" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* === LINE CHART: Wskaźnik konwersji + PIE: usługi === */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Wskaźnik konwersji */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <SectionTitle>Wskaźnik konwersji wycen (%)</SectionTitle>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={CONVERSION_DATA}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[30, 70]}
                tick={{ fontSize: 10, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
                width={40}
              />
              <Tooltip content={<CustomTooltipPercent />} />
              <Line
                type="monotone"
                dataKey="wskaznik"
                name="Konwersja"
                stroke="#8b5cf6"
                strokeWidth={2.5}
                dot={{ r: 5, fill: "#8b5cf6" }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-2 text-xs text-slate-400 text-center">
            Trend wzrostowy — +16 pp. w ciągu 8 miesięcy
          </p>
        </div>

        {/* Pie: udział usług */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <SectionTitle>Udział usług w wycenach</SectionTitle>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="55%" height={220}>
              <PieChart>
                <Pie
                  data={SERVICES_PIE}
                  cx="50%"
                  cy="50%"
                  outerRadius={95}
                  dataKey="value"
                  labelLine={false}
                  label={renderCustomizedLabel}
                >
                  {SERVICES_PIE.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => [`${v}%`, "Udział"]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {SERVICES_PIE.map((s) => (
                <div key={s.name} className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-xs text-slate-600">{s.name}</span>
                  <span className="ml-auto text-xs font-semibold text-slate-800">
                    {s.value}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* === PIE: Status pipeline + Bar chart === */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pie: status pipeline */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <SectionTitle>Pipeline wg statusu (przykład)</SectionTitle>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="55%" height={220}>
              <PieChart>
                <Pie
                  data={STATUS_PIE}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={90}
                  dataKey="value"
                  labelLine={false}
                >
                  {STATUS_PIE.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [v, "Liczba"]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5">
              {STATUS_PIE.map((s) => (
                <div key={s.name} className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-xs text-slate-600">{s.name}</span>
                  <span className="ml-auto text-xs font-semibold text-slate-800">
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bar chart: from real data */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <SectionTitle>Zlecenia wg statusu (dane live)</SectionTitle>
          {stats === undefined ? (
            <div className="flex h-40 items-center justify-center text-sm text-slate-400">
              Ładowanie…
            </div>
          ) : (
            <div className="space-y-2.5">
              {Object.entries(stats.byStatus).map(([status, rawCount]) => {
                const count = rawCount as number;
                const maxCount = Math.max(
                  ...(Object.values(stats.byStatus) as number[]),
                  1,
                );
                const widthPercent = Math.round((count / maxCount) * 100);

                return (
                  <div key={status} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 text-right text-xs text-slate-500">
                      {STATUS_LABELS[status] ?? status}
                    </span>
                    <div className="flex-1">
                      <div
                        className={`h-6 rounded ${STATUS_COLORS[status] ?? "bg-gray-400"} flex items-center transition-all`}
                        style={{
                          width:
                            count > 0
                              ? `${Math.max(widthPercent, 4)}%`
                              : "2px",
                        }}
                      >
                        {count > 0 && (
                          <span className="px-2 text-xs font-semibold text-white">
                            {count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* === SUMMARY KPI row === */}
      {stats !== undefined && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Łącznie klientów" value={stats.total} />
          <StatCard
            label="Nowi w tym tygodniu"
            value={stats.newThisWeek}
            accent="text-blue-600"
          />
          <StatCard
            label="Wygenerowane dokumenty"
            value={stats.documentsEnabledCount}
            accent="text-purple-600"
          />
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Statusy aktywne</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {Object.entries(stats.byStatus)
                .filter(([, count]) => (count as number) > 0)
                .map(([status, count]) => (
                  <span
                    key={status}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_COLORS[status] ?? "bg-gray-100 text-gray-700"}`}
                  >
                    {STATUS_LABELS[status] ?? status}: {count as number}
                  </span>
                ))}
              {Object.values(stats.byStatus).every((c) => (c as number) === 0) && (
                <span className="text-xs text-slate-400">Brak zleceń</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* === RECENT EVENTS === */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <SectionTitle>Ostatnia aktywność</SectionTitle>
        {recentEvents === undefined ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex animate-pulse items-start gap-3">
                <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-gray-200" />
                <div className="flex-1">
                  <div className="mb-1 h-4 w-3/4 rounded bg-gray-200" />
                  <div className="h-3 w-1/3 rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        ) : recentEvents.length === 0 ? (
          <p className="text-sm text-slate-500">Brak aktywności.</p>
        ) : (
          <div className="space-y-3">
            {recentEvents.map(
              (event: {
                _id: string;
                _creationTime: number;
                type: string;
                details: unknown;
                performedBy: string;
                clientName?: string;
              }) => {
                const date = new Date(event._creationTime);
                const timeStr = date.toLocaleDateString("pl-PL", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                let detail = "";
                if (event.type === "status_changed" && event.details) {
                  const d = event.details as { from?: string; to?: string };
                  detail = ` (${STATUS_LABELS[d.from ?? ""] ?? d.from} → ${STATUS_LABELS[d.to ?? ""] ?? d.to})`;
                }
                if (event.type === "document_generated" && event.details) {
                  const d = event.details as { documentType?: string };
                  detail = ` (${d.documentType})`;
                }

                return (
                  <div
                    key={event._id}
                    className="flex items-start gap-3 border-b border-gray-100 pb-3 last:border-b-0 last:pb-0"
                  >
                    <div className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-800">
                        <span className="font-medium">{event.clientName}</span>
                        {" — "}
                        {EVENT_LABELS[event.type] ?? event.type}
                        {detail}
                      </p>
                      <p className="text-xs text-slate-400">{timeStr}</p>
                    </div>
                  </div>
                );
              },
            )}
          </div>
        )}
      </div>
    </div>
  );
}
