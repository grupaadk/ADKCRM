"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Clock,
  CheckCircle2,
  ListTodo,
  TrendingUp,
  BarChart3,
  Filter,
} from "lucide-react";

function formatMsToHoursAndMinutes(ms: number): string {
  if (!ms || ms <= 0) return "0m";
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatDate(ts: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const MONTH_NAMES = [
  "Styczeń",
  "Luty",
  "Marzec",
  "Kwiecień",
  "Maj",
  "Czerwiec",
  "Lipiec",
  "Sierpień",
  "Wrzesień",
  "Październik",
  "Listopad",
  "Grudzień",
];

export function ITTimeReportsView() {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1; // 1-12

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(currentMonth);

  const reportData = useQuery(api.itTimeTracker.getTimeReports, {
    year: selectedYear,
    month: selectedMonth,
  });

  const availableYears = [currentYear, currentYear - 1, currentYear - 2];

  const handlePresetMonth = (preset: "this-month" | "last-month" | "this-year" | "all") => {
    if (preset === "this-month") {
      setSelectedYear(currentYear);
      setSelectedMonth(currentMonth);
    } else if (preset === "last-month") {
      const prevM = currentMonth === 1 ? 12 : currentMonth - 1;
      const prevY = currentMonth === 1 ? currentYear - 1 : currentYear;
      setSelectedYear(prevY);
      setSelectedMonth(prevM);
    } else if (preset === "this-year") {
      setSelectedYear(currentYear);
      setSelectedMonth(undefined);
    } else if (preset === "all") {
      setSelectedYear(currentYear);
      setSelectedMonth(undefined);
    }
  };

  const summaries = reportData?.taskSummaries ?? [];
  const totalMs = reportData?.totalTimeMs ?? 0;
  const totalTasks = reportData?.totalTasksCount ?? 0;
  const completedTasks = summaries.filter((s) => s.isCompleted).length;
  const avgTimePerTaskMs = totalTasks > 0 ? totalMs / totalTasks : 0;

  return (
    <div className="space-y-6">
      {/* Pasek Filtrów */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-[#4dbdc6]" />
            <h3 className="font-bold text-sm text-slate-800">Filtry Raportowania Czasu</h3>
          </div>

          {/* Szybkie przyciski filtrujące */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <button
              type="button"
              onClick={() => handlePresetMonth("this-month")}
              className={`px-3 py-1.5 rounded-xl font-bold transition ${
                selectedYear === currentYear && selectedMonth === currentMonth
                  ? "bg-[#4dbdc6] text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Ten miesiąc
            </button>
            <button
              type="button"
              onClick={() => handlePresetMonth("last-month")}
              className="px-3 py-1.5 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
            >
              Ostatni miesiąc
            </button>
            <button
              type="button"
              onClick={() => handlePresetMonth("this-year")}
              className={`px-3 py-1.5 rounded-xl font-bold transition ${
                selectedYear === currentYear && selectedMonth === undefined
                  ? "bg-[#4dbdc6] text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Ten rok ({currentYear})
            </button>
          </div>
        </div>

        {/* Wybór Roku i Miesiąca */}
        <div className="flex items-center gap-4 flex-wrap text-xs">
          <div className="flex items-center gap-2">
            <label className="font-bold text-slate-600">Rok:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-800 focus:outline-none focus:border-[#4dbdc6]"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="font-bold text-slate-600">Miesiąc:</label>
            <select
              value={selectedMonth ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedMonth(val ? parseInt(val, 10) : undefined);
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-800 focus:outline-none focus:border-[#4dbdc6]"
            >
              <option value="">Wszystkie miesiące</option>
              {MONTH_NAMES.map((name, idx) => (
                <option key={name} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Karty KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="size-11 rounded-xl bg-teal-50 text-[#4dbdc6] flex items-center justify-center font-bold shrink-0">
            <Clock className="size-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-semibold">Łączny czas</div>
            <div className="text-xl font-extrabold text-slate-800">{formatMsToHoursAndMinutes(totalMs)}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="size-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
            <ListTodo className="size-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-semibold">Realizowane zadania</div>
            <div className="text-xl font-extrabold text-slate-800">{totalTasks}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="size-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
            <CheckCircle2 className="size-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-semibold">Ukończone zadania</div>
            <div className="text-xl font-extrabold text-slate-800">{completedTasks}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="size-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold shrink-0">
            <TrendingUp className="size-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-semibold">Średni czas / zadanie</div>
            <div className="text-xl font-extrabold text-slate-800">{formatMsToHoursAndMinutes(avgTimePerTaskMs)}</div>
          </div>
        </div>
      </div>

      {/* Tabela szczegółów zadań */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
            <BarChart3 className="size-4 text-[#4dbdc6]" />
            Zrealizowane Prace IT ({summaries.length})
          </h3>
        </div>

        {summaries.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs italic">
            Brak zarejestrowanego czasu pracy w wybranym okresie.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200/80">
                <tr>
                  <th className="py-3 px-4">Tytuł Zadania</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Sesje Mierzenia</th>
                  <th className="py-3 px-4">Łączny Czas</th>
                  <th className="py-3 px-4 text-right">Ostatnia Aktywność</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {summaries.map((s) => (
                  <tr key={s.taskId} className="hover:bg-slate-50/50 transition">
                    <td className="py-3 px-4 font-bold text-slate-800">{s.title}</td>
                    <td className="py-3 px-4">
                      {s.isCompleted ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="size-3" /> Ukończone
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                          W trakcie
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-600">{s.sessionsCount} wpis(ów)</td>
                    <td className="py-3 px-4 font-extrabold text-[#4dbdc6]">{formatMsToHoursAndMinutes(s.totalTimeMs)}</td>
                    <td className="py-3 px-4 text-right text-slate-500 font-medium">{formatDate(s.lastTrackedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
