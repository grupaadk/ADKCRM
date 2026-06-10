"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { DashboardTask } from "@/convex/dashboardTasks";
import type { Id } from "@/convex/_generated/dataModel";
import { ExternalLink, Plus, Clock, CalendarDays } from "lucide-react";
import TaskDrawer from "@/components/TaskDrawer";
import AddTaskDrawer from "@/components/AddTaskDrawer";

/* ── stałe kolumn kanbanu (zgodne z kanbanem w zleceniu) ── */
const KANBAN_COLS = [
  { key: "todo" as const, label: "Do zrobienia", accent: "#64748b", headerBg: "#f8fafc", colBg: "#f8fafc", border: "#e2e8f0" },
  { key: "in_progress" as const, label: "W trakcie", accent: "#2563eb", headerBg: "#eff6ff", colBg: "#f5f9ff", border: "#bfdbfe" },
  { key: "done" as const, label: "Gotowe", accent: "#16a34a", headerBg: "#f0fdf4", colBg: "#f7fdf9", border: "#bbf7d0" },
];
type StatusKey = (typeof KANBAN_COLS)[number]["key"];

const DONE_LIMIT = 10;

/* ── typ zadania (źródło): zlecenie vs szansa sprzedaży ── */
const TASK_TYPE_META = {
  order:       { label: "Zlecenie", openLabel: "Otwórz zlecenie", color: "#2563eb" },
  opportunity: { label: "Szansa",   openLabel: "Otwórz szansę",   color: "#b45309" },
} as const;
type TaskType = keyof typeof TASK_TYPE_META;

function TypeBadge({ type }: { type: TaskType }) {
  const meta = TASK_TYPE_META[type];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ background: `${meta.color}14`, color: meta.color }}
      title={meta.label}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}

/* ── kolory / inicjały userów ── */
const U_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#ef4444", "#06b6d4", "#84cc16"];
function uColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return U_COLORS[h % U_COLORS.length];
}
function uInitials(name: string) {
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

/* ── daty ── */
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

type FilterValue = "all" | "unassigned" | Id<"users">;

export default function DashboardClient() {
  const me = useQuery(api.users.me);
  const isAdmin = me?.role === "admin";

  const [filter, setFilter] = useState<FilterValue>("all");
  const [showAllDone, setShowAllDone] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<Id<"orderTasks"> | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<StatusKey | null>(null);

  // Zwykły user dostaje tylko swoje (serwer ignoruje filter); admin filtruje.
  const tasks = useQuery(
    api.dashboardTasks.list,
    isAdmin ? { filter } : {},
  );
  const users = useQuery(api.users.listAllActive);
  const updateTask = useMutation(api.orderTasks.update);

  const today = startOfToday();
  const tomorrow = today + 24 * 60 * 60 * 1000;

  const { byStatus, overdueCount, todayCount } = useMemo(() => {
    const grouped: Record<StatusKey, DashboardTask[]> = { todo: [], in_progress: [], done: [] };
    let overdue = 0;
    let due = 0;
    for (const t of tasks ?? []) {
      grouped[t.status].push(t);
      if (t.status !== "done" && t.dueDate != null) {
        if (t.dueDate < today) overdue++;
        else if (t.dueDate < tomorrow) due++;
      }
    }
    const sortByDue = (a: DashboardTask, b: DashboardTask) => {
      if (a.dueDate == null && b.dueDate == null) return 0;
      if (a.dueDate == null) return 1;
      if (b.dueDate == null) return -1;
      return a.dueDate - b.dueDate;
    };
    grouped.todo.sort(sortByDue);
    grouped.in_progress.sort(sortByDue);
    grouped.done.sort((a, b) => (b.dueDate ?? 0) - (a.dueDate ?? 0));
    return { byStatus: grouped, overdueCount: overdue, todayCount: due };
  }, [tasks, today, tomorrow]);

  const greetingName = me?.displayName ?? me?.login ?? "";
  const loading = tasks === undefined || me === undefined;

  const draggedTask = dragId ? (tasks ?? []).find((t) => t._id === dragId) ?? null : null;

  function handleDrop(status: StatusKey) {
    setDragOverCol(null);
    if (!dragId) return;
    const task = (tasks ?? []).find((t) => t._id === dragId);
    setDragId(null);
    if (!task || task.status === status) return;
    void updateTask({ taskId: task._id as Id<"orderTasks">, status });
  }

  return (
    <div>
      {/* ── Nagłówek powitalny ── */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Cześć{greetingName ? `, ${greetingName}` : ""}! 👋
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {isAdmin && filter === "all"
                ? "Oto lista zadań zespołu."
                : "Oto Twoja lista zadań."}
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-gray-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              <Plus className="size-4" /> Dodaj zadanie
            </button>
          )}
        </div>

        {/* liczniki zaległe / na dziś */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {overdueCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">
              <Clock className="size-3.5" /> {overdueCount} zaległe
            </span>
          )}
          {todayCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
              <CalendarDays className="size-3.5" /> {todayCount} na dziś
            </span>
          )}
          {overdueCount === 0 && todayCount === 0 && !loading && (
            <span className="text-xs text-gray-400">Brak pilnych terminów. 🎉</span>
          )}
        </div>
      </div>

      {/* ── Filtr admina ── */}
      {isAdmin && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <FilterChip label="Wszyscy" active={filter === "all"} onClick={() => setFilter("all")} />
          <FilterChip label="Nieprzypisane" active={filter === "unassigned"} onClick={() => setFilter("unassigned")} />
          <div className="mx-1 h-5 w-px bg-gray-200" />
          {(users ?? []).map((u) => {
            const name = u.displayName ?? u.login ?? "";
            const active = filter === u._id;
            const color = u.color ?? uColor(u._id);
            return (
              <button
                key={u._id}
                onClick={() => setFilter(u._id)}
                title={name}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium transition-colors ${
                  active ? "border-transparent bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span
                  className="flex size-5 items-center justify-center rounded-full text-[8.5px] font-bold text-white"
                  style={{ background: color }}
                >
                  {uInitials(name)}
                </span>
                {name}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Kanban ── */}
      {loading ? (
        <div className="py-20 text-center text-sm text-gray-400">Ładowanie zadań…</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {KANBAN_COLS.map((col) => {
            const colTasks = byStatus[col.key];
            const isDone = col.key === "done";
            const visible = isDone && !showAllDone ? colTasks.slice(0, DONE_LIMIT) : colTasks;
            const hiddenCount = isDone ? colTasks.length - visible.length : 0;
            // cel upuszczenia: przeciągamy kartę nad tę kolumnę i nie jest to jej obecny status
            const isDropTarget =
              draggedTask != null && dragOverCol === col.key && draggedTask.status !== col.key;
            return (
              <div
                key={col.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragOverCol !== col.key) setDragOverCol(col.key);
                }}
                onDragLeave={(e) => {
                  // ignoruj przejścia między dziećmi tej samej kolumny
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverCol((c) => (c === col.key ? null : c));
                  }
                }}
                onDrop={() => handleDrop(col.key)}
                className="flex flex-col rounded-xl border transition-all duration-150"
                style={{
                  background: isDropTarget ? col.headerBg : col.colBg,
                  borderColor: isDropTarget ? col.accent : col.border,
                  boxShadow: isDropTarget ? `0 0 0 2px ${col.accent}55` : undefined,
                }}
              >
                {/* nagłówek kolumny */}
                <div
                  className="flex items-center justify-between rounded-t-xl border-b px-3 py-2.5"
                  style={{ background: col.headerBg, borderColor: col.border }}
                >
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: col.accent }} />
                    <span className="text-[13px] font-semibold text-gray-700">{col.label}</span>
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-500 ring-1 ring-inset ring-gray-200">
                    {colTasks.length}
                  </span>
                </div>

                {/* karty */}
                <div className="flex flex-1 flex-col gap-2 p-2.5" style={{ minHeight: 120 }}>
                  {visible.length === 0 && (
                    <div className="py-8 text-center text-xs text-gray-400">Brak zadań</div>
                  )}
                  {visible.map((task) => (
                    <TaskCard
                      key={task._id}
                      task={task}
                      today={today}
                      tomorrow={tomorrow}
                      showAssignee={isAdmin}
                      onOpen={() => setOpenTaskId(task._id as Id<"orderTasks">)}
                      onDragStart={() => setDragId(task._id)}
                      onDragEnd={() => setDragId(null)}
                      dragging={dragId === task._id}
                    />
                  ))}
                  {isDone && hiddenCount > 0 && (
                    <button
                      onClick={() => setShowAllDone(true)}
                      className="mt-1 rounded-md py-1.5 text-xs font-medium text-gray-500 hover:bg-white hover:text-gray-700"
                    >
                      Pokaż więcej ({hiddenCount})
                    </button>
                  )}
                  {isDone && showAllDone && colTasks.length > DONE_LIMIT && (
                    <button
                      onClick={() => setShowAllDone(false)}
                      className="mt-1 rounded-md py-1.5 text-xs font-medium text-gray-500 hover:bg-white hover:text-gray-700"
                    >
                      Zwiń
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Panel szczegółów (wysuwany z prawej) ── */}
      <TaskDrawer taskId={openTaskId} onClose={() => setOpenTaskId(null)} />

      {/* ── Panel dodawania zadania (admin) ── */}
      {isAdmin && <AddTaskDrawer open={addOpen} onClose={() => setAddOpen(false)} />}
    </div>
  );
}

/* ── chip filtra ── */
function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active ? "border-transparent bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );
}

/* ── badge terminu ── */
function DueBadge({ ts, today, tomorrow, done }: { ts: number; today: number; tomorrow: number; done: boolean }) {
  const overdue = !done && ts < today;
  const isToday = !done && ts >= today && ts < tomorrow;
  const cls = overdue
    ? "bg-red-50 text-red-700 ring-red-200"
    : isToday
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : "bg-gray-50 text-gray-500 ring-gray-200";
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-semibold ring-1 ring-inset ${cls}`}>
      <Clock className="size-3" />
      {overdue ? "Po terminie · " : isToday ? "Dziś · " : ""}
      {fmtDate(ts)}
    </span>
  );
}

/* ── badge przypisanej osoby ── */
function AssigneeBadge({ task }: { task: DashboardTask }) {
  if (!task.assignedUserId) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-[10.5px] font-medium text-gray-400"
        title="Nieprzypisane"
      >
        Nieprzypisane
      </span>
    );
  }
  const name = task.assignedUserName ?? "?";
  const color = task.assignedUserColor ?? uColor(task.assignedUserId);
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
      style={{ background: `${color}1f`, color }}
      title={name}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="truncate">{name}</span>
    </span>
  );
}

/* ── karta zadania ── */
function TaskCard({
  task,
  today,
  tomorrow,
  showAssignee,
  onOpen,
  onDragStart,
  onDragEnd,
  dragging,
}: {
  task: DashboardTask;
  today: number;
  tomorrow: number;
  showAssignee: boolean;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  dragging: boolean;
}) {
  const router = useRouter();

  // Typ zadania (źródło) — brak = zlecenie
  const taskType: TaskType = task.source === "opportunity" ? "opportunity" : "order";
  const typeMeta = TASK_TYPE_META[taskType];

  // Link "otwórz" + tytuł kontekstu zależnie od źródła
  const openHref =
    taskType === "opportunity"
      ? `/admin/szansa/${task.opportunityId}`
      : `/admin/klient/${task.clientId}/zlecenie/${task.orderId}?tab=szczegoly`;
  const contextTitle =
    taskType === "opportunity" ? "Szansa sprzedaży" : (task.orderName ?? "Zlecenie");

  // Akcent koloru przypisanej osoby (jak kafelki w /admin/panel)
  const userColor = task.assignedUserId
    ? task.assignedUserColor ?? uColor(task.assignedUserId)
    : null;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className={`group rounded-lg border border-gray-200 bg-white p-2.5 shadow-sm transition-all duration-150 hover:shadow-md cursor-grab active:cursor-grabbing ${
        dragging ? "rotate-1 scale-[0.97] opacity-50 shadow-md ring-2 ring-gray-300" : ""
      }`}
      style={userColor ? { borderLeft: `5px solid ${userColor}` } : undefined}
    >
      {/* kontekst zlecenia + CTA do zlecenia */}
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-semibold text-gray-900">
            {contextTitle}
          </div>
          <div className="truncate text-[10.5px] text-gray-400">{task.clientName}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(openHref);
            }}
            title={typeMeta.openLabel}
            className="rounded p-1 text-gray-400 opacity-0 transition-opacity hover:bg-gray-100 hover:text-gray-700 group-hover:opacity-100"
          >
            <ExternalLink className="size-3.5" />
          </button>
          <TypeBadge type={taskType} />
        </div>
      </div>

      {/* tekst własny zlecenia */}
      {task.customText && (
        <div className="mb-1.5">
          <span className="chip-custom" style={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}>
            {task.customText}
          </span>
        </div>
      )}

      {/* tytuł zadania */}
      <div className="text-[13px] leading-snug text-gray-800">{task.title}</div>

      {/* stopka: termin + awatar */}
      {(task.dueDate != null || showAssignee) && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <div>
            {task.dueDate != null && (
              <DueBadge ts={task.dueDate} today={today} tomorrow={tomorrow} done={task.status === "done"} />
            )}
          </div>
          {showAssignee && (
            <div className="min-w-0">
              <AssigneeBadge task={task} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
