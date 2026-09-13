"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Play,
  Square,
  Plus,
  CheckCircle2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Clock,
  Timer,
  PlusCircle,
  X,
} from "lucide-react";

function formatMsToTime(ms: number): string {
  if (!ms || ms <= 0) return "0m";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function formatLiveTicker(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

export function ITTimeTrackerWidget() {
  const tasks = useQuery(api.itTimeTracker.getTasks, { includeCompleted: false }) ?? [];
  const createTask = useMutation(api.itTimeTracker.createTask);
  const startTimer = useMutation(api.itTimeTracker.startTimer);
  const stopTimer = useMutation(api.itTimeTracker.stopTimer);
  const addManualTime = useMutation(api.itTimeTracker.addManualTime);
  const toggleCompleted = useMutation(api.itTimeTracker.toggleCompleted);
  const deleteTask = useMutation(api.itTimeTracker.deleteTask);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [manualTimeTaskId, setManualTimeTaskId] = useState<Id<"itTimeTrackerTasks"> | null>(null);
  const [manualMinutes, setManualMinutes] = useState("30");
  const [now, setNow] = useState<number>(() => Date.now());

  // Ticker timer update every second
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const runningTask = tasks.find((t) => t.status === "running");

  const handleCreate = async (startImmediately: boolean) => {
    if (!newTaskTitle.trim()) return;
    await createTask({
      title: newTaskTitle.trim(),
      startImmediately,
    });
    setNewTaskTitle("");
  };

  const handleAddManualTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTimeTaskId) return;
    const mins = parseInt(manualMinutes, 10);
    if (isNaN(mins) || mins <= 0) return;
    await addManualTime({ id: manualTimeTaskId, minutesToAdd: mins });
    setManualTimeTaskId(null);
    setManualMinutes("30");
  };

  // Prezentujemy domyślnie pierwsze 3 zadania
  const visibleTasks = isExpanded ? tasks : tasks.slice(0, 3);
  const hiddenCount = Math.max(0, tasks.length - 3);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5 mb-6 space-y-4">
      {/* Nagłówek i form dodawania */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-teal-500/10 text-[#4dbdc6] flex items-center justify-center font-bold">
            <Timer className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              Tracker Czasu Pracy IT
              {runningTask && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 animate-pulse">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Mierzenie czasu w toku
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500">
              Wpisz tytuł i rozpocznij stoper lub dodaj czas ręcznie
            </p>
          </div>
        </div>

        {/* Input z przyciskami Start & Dodaj */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Tytuł zadania..."
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleCreate(true);
              }
            }}
            className="flex-1 sm:w-64 px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#4dbdc6] focus:outline-none bg-slate-50/50"
          />
          <button
            type="button"
            onClick={() => handleCreate(true)}
            disabled={!newTaskTitle.trim()}
            className="px-3.5 py-2 text-xs font-bold rounded-xl bg-[#4dbdc6] hover:bg-[#3baab3] text-white transition flex items-center gap-1.5 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
          >
            <Play className="size-3.5 fill-current" />
            Start
          </button>
          <button
            type="button"
            onClick={() => handleCreate(false)}
            disabled={!newTaskTitle.trim()}
            className="px-3 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="size-3.5" />
            Dodaj
          </button>
        </div>
      </div>

      {/* Modal / Formularz ręcznego dodawania czasu */}
      {manualTimeTaskId && (
        <form
          onSubmit={handleAddManualTime}
          className="p-3 bg-teal-50/60 border border-teal-200 rounded-xl flex items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-[#4dbdc6]" />
            <span className="font-semibold text-slate-700">Dodaj czas ręcznie (w minutach):</span>
            <input
              type="number"
              min="1"
              max="1440"
              value={manualMinutes}
              onChange={(e) => setManualMinutes(e.target.value)}
              className="w-20 px-2 py-1 bg-white border border-teal-300 rounded-lg font-bold text-center text-slate-800"
            />
            <span className="text-slate-500 font-medium">minut</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="submit"
              className="px-3 py-1 bg-[#4dbdc6] hover:bg-[#3baab3] text-white font-bold rounded-lg transition"
            >
              Zapisz
            </button>
            <button
              type="button"
              onClick={() => setManualTimeTaskId(null)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="size-4" />
            </button>
          </div>
        </form>
      )}

      {/* Lista 3 pierwszych zadań (lub rozwinięta) */}
      {tasks.length === 0 ? (
        <div className="py-6 text-center text-slate-400 text-xs italic bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
          Brak aktywnych zadań w trackerze czasu. Wpisz tytuł powyżej i kliknij Start.
        </div>
      ) : (
        <div className="space-y-2">
          {visibleTasks.map((t) => {
            const isRunning = t.status === "running";
            const currentSessionMs = isRunning && t.lastStartedAt ? Math.max(0, now - t.lastStartedAt) : 0;
            const displayTotalMs = t.totalDurationMs + currentSessionMs;

            return (
              <div
                key={t._id}
                className={`p-3 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isRunning
                    ? "border-[#4dbdc6] bg-[#4dbdc6]/5 shadow-xs"
                    : "border-slate-200/80 bg-white hover:bg-slate-50/60"
                }`}
              >
                {/* Informacja o zadaniu */}
                <div className="flex items-center gap-3 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleCompleted({ id: t._id })}
                    className="text-slate-300 hover:text-emerald-600 transition shrink-0"
                    title="Oznacz jako ukończone"
                  >
                    <CheckCircle2 className="size-5" />
                  </button>

                  <div className="overflow-hidden">
                    <div className="font-bold text-xs text-slate-800 truncate" title={t.title}>
                      {t.title}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>Całkowity czas: <strong className="text-slate-700">{formatMsToTime(displayTotalMs)}</strong></span>
                      {isRunning && (
                        <span className="font-mono text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                          ⏱ {formatLiveTicker(currentSessionMs)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Przyciski sterowania */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => setManualTimeTaskId(manualTimeTaskId === t._id ? null : t._id)}
                    className="px-2 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition flex items-center gap-1"
                    title="Dodaj minuty ręcznie"
                  >
                    <PlusCircle className="size-3.5" />
                    + Czas
                  </button>

                  {isRunning ? (
                    <button
                      type="button"
                      onClick={() => stopTimer({ id: t._id })}
                      className="px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-xs transition flex items-center gap-1.5"
                    >
                      <Square className="size-3.5 fill-current" />
                      Pauza
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startTimer({ id: t._id })}
                      className="px-3 py-1.5 text-xs font-bold bg-[#4dbdc6] hover:bg-[#3baab3] text-white rounded-lg shadow-xs transition flex items-center gap-1.5"
                    >
                      <Play className="size-3.5 fill-current" />
                      Start
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => deleteTask({ id: t._id })}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Usuń zadanie z trackera"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Przycisk rozwijania pełnej listy */}
      {hiddenCount > 0 && !isExpanded && (
        <div className="text-center pt-1">
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="text-xs font-bold text-[#4dbdc6] hover:underline inline-flex items-center gap-1"
          >
            Pokaż pozostałe zadania ({hiddenCount})
            <ChevronDown className="size-4" />
          </button>
        </div>
      )}

      {isExpanded && tasks.length > 3 && (
        <div className="text-center pt-1">
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="text-xs font-bold text-slate-500 hover:underline inline-flex items-center gap-1"
          >
            Zwiń listę do 3 zadań
            <ChevronUp className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
