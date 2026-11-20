"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import toast from "react-hot-toast";
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  ListPlus,
  Trash2,
} from "lucide-react";
import SideDrawer from "./SideDrawer";

type StageKey = "kitting" | "production" | "installation";

const STAGE_META: Record<
  StageKey,
  { label: string; color: string; bg: string; border: string; startField: string; endField: string }
> = {
  kitting: {
    label: "Kompletacja",
    color: "#0284c7",
    bg: "rgba(2, 132, 199, 0.14)",
    border: "rgba(2, 132, 199, 0.45)",
    startField: "completionStartDate",
    endField: "completionEndDate",
  },
  production: {
    label: "Produkcja",
    color: "#7c3aed",
    bg: "rgba(124, 58, 237, 0.14)",
    border: "rgba(124, 58, 237, 0.45)",
    startField: "productionStartDate",
    endField: "productionEndDate",
  },
  installation: {
    label: "Montaż",
    color: "#059669",
    bg: "rgba(5, 150, 105, 0.14)",
    border: "rgba(5, 150, 105, 0.45)",
    startField: "installationPhaseStartDate",
    endField: "installationPhaseEndDate",
  },
};

function formatPlDate(ts?: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function diffDays(a: number, b: number): number {
  return Math.round((b - a) / 86_400_000);
}

interface StageTasksDrawerProps {
  open: boolean;
  onClose: () => void;
  order: {
    _id: Id<"orders">;
    name: string;
    clientId: Id<"clients">;
    clientName: string;
    investmentCity?: string;
    installationTeamName?: string;
    stageKey: StageKey;
    completionStartDate?: number;
    completionEndDate?: number;
    productionStartDate?: number;
    productionEndDate?: number;
    installationPhaseStartDate?: number;
    installationPhaseEndDate?: number;
  } | null;
  stageKey: StageKey | null;
}

export default function StageTasksDrawer({
  open,
  onClose,
  order,
  stageKey,
}: StageTasksDrawerProps) {
  const stage = stageKey ? STAGE_META[stageKey] : STAGE_META.kitting;
  const allTasks = useQuery(
    api.orderTasks.listByOrder,
    order ? { orderId: order._id } : "skip",
  );
  const taskTemplates = useQuery(api.taskTemplates.list) ?? [];

  const createTask = useMutation(api.orderTasks.create);
  const updateTask = useMutation(api.orderTasks.update);
  const removeTask = useMutation(api.orderTasks.remove);
  const applyDefaultChecklist = useMutation(api.orderTasks.applyDefaultStageChecklist);
  const applyTemplate = useMutation(api.taskTemplates.applyToOrder);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [applyingDefault, setApplyingDefault] = useState(false);
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);

  // Filtruj zadania dla tego etapu (lub zadania ogólne, jeśli to aktywny etap zlecenia)
  const stageTasks =
    order && stageKey
      ? (allTasks ?? []).filter((t) => {
          if (t.stageKey) return t.stageKey === stageKey;
          // Jeśli zadanie nie ma przypisanego etapu, wyświetl je w aktywnym etapie zlecenia
          return stageKey === order.stageKey;
        })
      : [];

  const totalCount = stageTasks.length;
  const doneCount = stageTasks.filter((t) => t.status === "done").length;
  const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // Daty etapu na osi czasu
  const rawStart = order
    ? (order[stage.startField as keyof typeof order] as number | undefined)
    : undefined;
  const rawEnd = order
    ? (order[stage.endField as keyof typeof order] as number | undefined)
    : undefined;
  const hasDates = Boolean(rawStart && rawEnd);
  const spanDays = hasDates ? Math.max(1, diffDays(rawStart!, rawEnd!) + 1) : null;
  const isCurrentOrderStage = Boolean(order && stageKey && order.stageKey === stageKey);

  const handleAddTask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!order || !stageKey) return;
    const title = newTaskTitle.trim();
    if (!title || adding) return;
    setAdding(true);
    try {
      await createTask({
        orderId: order._id,
        stageKey,
        title,
        status: "todo",
      });
      setNewTaskTitle("");
      toast.success("Dodano zadanie");
    } catch (err) {
      console.error(err);
      toast.error("Błąd podczas dodawania zadania");
    } finally {
      setAdding(false);
    }
  };

  const handleToggleTask = async (taskId: Id<"orderTasks">, currentStatus: string) => {
    const nextStatus = currentStatus === "done" ? "todo" : "done";
    try {
      await updateTask({
        taskId,
        status: nextStatus,
      });
    } catch (err) {
      console.error(err);
      toast.error("Błąd aktualizacji zadania");
    }
  };

  const handleDeleteTask = async (taskId: Id<"orderTasks">) => {
    try {
      await removeTask({ taskId });
      toast.success("Usunięto zadanie");
    } catch (err) {
      console.error(err);
      toast.error("Błąd usuwania zadania");
    }
  };

  const handleApplyDefaultChecklist = async () => {
    if (!order || !stageKey) return;
    setApplyingDefault(true);
    try {
      await applyDefaultChecklist({
        orderId: order._id,
        stageKey,
      });
      toast.success(`Załadowano listę kontrolną dla: ${stage.label}`);
    } catch (err) {
      console.error(err);
      toast.error("Błąd ładowania listy kontrolnej");
    } finally {
      setApplyingDefault(false);
    }
  };

  const handleApplyCustomTemplate = async (templateId: Id<"taskTemplates">) => {
    if (!order) return;
    setTemplateDropdownOpen(false);
    try {
      await applyTemplate({ templateId, orderId: order._id });
      toast.success("Zastosowano szablon");
    } catch (err) {
      console.error(err);
      toast.error("Błąd stosowania szablonu");
    }
  };

  return (
    <SideDrawer
      open={open && Boolean(order && stageKey)}
      onClose={onClose}
      width={480}
      title={
        order && stageKey ? (
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: stage.color }}
            />
            <span>Zadania etapu: {stage.label}</span>
            {isCurrentOrderStage && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 tracking-wide uppercase">
                W trakcie
              </span>
            )}
          </div>
        ) : null
      }
    >
      {order && stageKey && (
      <div className="flex flex-col h-full overflow-y-auto p-5 space-y-5">
        {/* Order Info Card */}
        <div className="p-3.5 rounded-xl border bg-slate-50/70 border-slate-200/80 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <Link
                href={`/admin/klient/${order.clientId}/zlecenie/${order._id}`}
                className="text-sm font-bold hover:underline inline-flex items-center gap-1.5"
                style={{ color: "var(--text-strong)" }}
              >
                {order.name}
                <ExternalLink size={12} className="opacity-60" />
              </Link>
              <div className="text-xs text-slate-500 mt-0.5">
                {order.clientName}
                {order.investmentCity ? ` • ${order.investmentCity}` : ""}
                {order.installationTeamName ? ` • ${order.installationTeamName}` : ""}
              </div>
            </div>

            <span
              className="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0"
              style={{
                background: stage.bg,
                color: stage.color,
                border: `1px solid ${stage.border}`,
              }}
            >
              {stage.label}
            </span>
          </div>

          {/* Timeline Dates row */}
          <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-slate-600">
              <Calendar size={13} className="text-slate-400" />
              {hasDates ? (
                <span className="font-medium">
                  {formatPlDate(rawStart)} – {formatPlDate(rawEnd)} ({spanDays} dni)
                </span>
              ) : (
                <span className="italic text-slate-400">Brak ustalonego terminu</span>
              )}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span style={{ color: "var(--text-strong)" }}>Postęp etapu</span>
            <span className="text-slate-500">
              {doneCount} / {totalCount} ({progressPercent}%)
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progressPercent}%`,
                background: stage.color,
              }}
            />
          </div>
        </div>

        {/* Actions bar: Add template & default checklist */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={applyingDefault}
              onClick={handleApplyDefaultChecklist}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
            >
              <ListPlus size={13} className="text-slate-500" />
              {applyingDefault ? "Wgrywanie…" : "Wgraj checklistę etapu"}
            </button>

            {taskTemplates.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setTemplateDropdownOpen((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                >
                  Szablony ({taskTemplates.length})
                </button>
                {templateDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setTemplateDropdownOpen(false)}
                    />
                    <div className="absolute left-0 top-full mt-1 z-50 w-56 rounded-lg border bg-white shadow-xl py-1 text-xs border-slate-200">
                      <div className="px-3 py-1 font-bold text-[10px] text-slate-400 uppercase tracking-wider">
                        Wybierz szablon
                      </div>
                      {taskTemplates.map((tpl) => (
                        <button
                          key={tpl._id}
                          type="button"
                          onClick={() => handleApplyCustomTemplate(tpl._id)}
                          className="w-full px-3 py-1.5 text-left hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                        >
                          <span className="font-medium text-slate-700 truncate">{tpl.name}</span>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {tpl.items.length} zadań
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick Add Task Form */}
        <form onSubmit={handleAddTask} className="flex items-center gap-2">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder={`+ Dodaj zadanie dla etapu ${stage.label}...`}
            className="flex-1 px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-sky-500 border-slate-200"
            disabled={adding}
          />
          <button
            type="submit"
            disabled={!newTaskTitle.trim() || adding}
            className="px-3 py-2 text-xs font-bold rounded-lg text-white transition-opacity disabled:opacity-40 cursor-pointer"
            style={{ background: stage.color }}
          >
            Dodaj
          </button>
        </form>

        {/* Tasks List */}
        <div className="space-y-1.5 pt-1">
          {stageTasks.length === 0 ? (
            <div className="text-center py-8 px-4 rounded-xl border border-dashed border-slate-200 space-y-2">
              <CheckCircle2 size={24} className="mx-auto text-slate-300" />
              <p className="text-xs font-medium text-slate-600">
                Brak zadań dla etapu {stage.label}
              </p>
              <p className="text-[11px] text-slate-400">
                Kliknij „Wgraj checklistę etapu” powyżej lub dodaj własne zadanie.
              </p>
            </div>
          ) : (
            stageTasks.map((t) => {
              const isDone = t.status === "done";

              return (
                <div
                  key={t._id}
                  className={`group flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                    isDone
                      ? "bg-slate-50/60 border-slate-200/60 opacity-75"
                      : "bg-white border-slate-200 hover:border-slate-300 shadow-xs"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => handleToggleTask(t._id, t.status)}
                      className={`w-4 h-4 rounded flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                        isDone
                          ? "bg-emerald-500 text-white"
                          : "border border-slate-300 hover:border-emerald-500"
                      }`}
                    >
                      {isDone && <Check size={11} className="stroke-[3]" />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <span
                        className={`text-xs select-none block truncate ${
                          isDone
                            ? "line-through text-slate-400 font-normal"
                            : "text-slate-800 font-medium"
                        }`}
                      >
                        {t.title}
                      </span>
                      {t.dueDate && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                          <Clock size={10} />
                          <span>Termin: {formatPlDate(t.dueDate)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteTask(t._id)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600 transition-opacity cursor-pointer shrink-0"
                    title="Usuń zadanie"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
      )}
    </SideDrawer>
  );
}
