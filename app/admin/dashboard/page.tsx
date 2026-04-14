"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

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

export default function DashboardPage() {
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

      {/* === LINE CHART: Wskaźnik konwersji === */}
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
    </div>
  );
}
