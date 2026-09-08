"use client";

import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { DashboardTask } from "@/convex/dashboardTasks";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Plus,
  Clock,
  CalendarDays,
  CalendarPlus,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Flame,
  Check,
  Archive,
  ArchiveRestore,
  ShoppingBag,
  ArrowLeft,
  ExternalLink,
  X,
  RefreshCw,
  MoveRight,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import TaskDrawer from "@/components/TaskDrawer";
import AddTaskDrawer from "@/components/AddTaskDrawer";

/* ─────────── stałe / typy ─────────── */

const DONE_LIMIT = 10;

const COL_SHORT: Record<string, string> = {
  monday: "Pn",
  tuesday: "Wt",
  wednesday: "Śr",
  thursday: "Cz",
  friday: "Pt",
  this_week: "Tydz",
  next_week: "Nast",
  todo_list: "Todo",
};

function colShortName(col: { systemType?: string | null; title: string }) {
  if (col.systemType && COL_SHORT[col.systemType]) return COL_SHORT[col.systemType];
  return col.title.length > 5 ? col.title.slice(0, 4) + "." : col.title;
}

const TASK_TYPE_META = {
  order:       { label: "Zlecenie",         openLabel: "Otwórz zlecenie",    color: "#2563eb" },
  opportunity: { label: "Szansa sprzedaży", openLabel: "Otwórz szansę",     color: "#b45309" },
  complaint:   { label: "Reklamacja",       openLabel: "Otwórz reklamację",  color: "#ea580c" },
  general:     { label: "Zadanie",          openLabel: "Otwórz zadanie",     color: "#64748b" },
} as const;
type TaskType = keyof typeof TASK_TYPE_META;
type FilterValue = "all" | "unassigned" | Id<"users">;

/* ─────────── helpers ─────────── */

const U_COLORS = ["#3b82f6","#8b5cf6","#ec4899","#f59e0b","#10b981","#ef4444","#06b6d4","#84cc16"];
function uColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return U_COLORS[h % U_COLORS.length];
}
function uInitials(name: string) {
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/* ─────────── TypeBadge ─────────── */

function TypeBadge({ type }: { type: TaskType }) {
  const meta = TASK_TYPE_META[type];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ background: `${meta.color}14`, color: meta.color }}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}

/* ─────────── AssigneeBadge ─────────── */

function AssigneeBadge({ task }: { task: DashboardTask }) {
  const assignees = task.assignees ?? (task.assignedUserId ? [{ id: task.assignedUserId, name: task.assignedUserName, color: task.assignedUserColor }] : []);
  if (assignees.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-[10.5px] font-medium text-gray-400">
        Nieprzypisane
      </span>
    );
  }
  return (
    <div className="flex -space-x-1.5">
      {assignees.map((a, i) => {
        const name = a.name ?? "?";
        const color = a.color ?? uColor(a.id);
        return (
          <span
            key={a.id}
            className="flex size-6 items-center justify-center rounded-full text-[10px] font-bold text-white border-2 border-white shadow-sm ring-1 ring-black/5"
            style={{ background: color, zIndex: assignees.length - i }}
            title={name}
          >
            {uInitials(name)}
          </span>
        );
      })}
    </div>
  );
}

/* ─────────── MobileTaskCard ─────────── */

function MobileTaskCard({
  task,
  showAssignee,
  onOpen,
  onMove,
}: {
  task: DashboardTask;
  showAssignee: boolean;
  onOpen: () => void;
  onMove: () => void;
}) {
  const router = useRouter();
  const updateTask = useMutation(api.orderTasks.update);
  const createCalendarEvent = useMutation(api.calendarEvents.createEvent);

  const taskType: TaskType =
    task.source === "general" ? "general" :
    task.source === "opportunity" ? "opportunity" :
    task.source === "complaint" ? "complaint" :
    "order";
  const typeMeta = TASK_TYPE_META[taskType];

  const openHref =
    taskType === "opportunity"
      ? `/admin/szansa/${task.opportunityId}`
      : taskType === "complaint"
        ? `/admin/klient/${task.clientId}/zlecenie/${task.orderId}?tab=reklamacja`
        : taskType === "order"
          ? `/admin/klient/${task.clientId}/zlecenie/${task.orderId}?tab=szczegoly`
          : "#";

  const contextTitle =
    taskType === "opportunity" ? "Szansa sprzedaży" :
    taskType === "complaint" ? (task.orderName ?? "Reklamacja") :
    taskType === "general" ? "Zadanie ogólne" :
    (task.orderName ?? "Zlecenie");

  const [daysLabel, setDaysLabel] = useState<string | null>(null);
  const [daysColor, setDaysColor] = useState<"slate" | "amber" | "red">("slate");

  useEffect(() => {
    if (!task.columnChangedAt) { setDaysLabel(null); return; }
    const diffDays = Math.floor((Date.now() - task.columnChangedAt) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) { setDaysLabel("dzisiaj"); setDaysColor("slate"); }
    else if (diffDays === 1) { setDaysLabel("1 dzień"); setDaysColor("slate"); }
    else {
      setDaysLabel(`${diffDays} dni`);
      setDaysColor(diffDays >= 7 ? "red" : diffDays >= 3 ? "amber" : "slate");
    }
  }, [task.columnChangedAt]);

  const assignees = task.assignees ?? (task.assignedUserId ? [{ id: task.assignedUserId, name: task.assignedUserName, color: task.assignedUserColor }] : []);
  const colors = assignees.map(a => a.color ?? uColor(a.id)).filter(Boolean) as string[];
  const hasMultipleColors = colors.length > 1;
  const singleColor = colors.length === 1 ? colors[0] : undefined;
  let gradientStr = "";
  if (hasMultipleColors) {
    const step = 100 / colors.length;
    const stops = colors.map((c, i) => `${c} ${i * step}%, ${c} ${(i + 1) * step}%`);
    gradientStr = `linear-gradient(to bottom, ${stops.join(", ")})`;
  }

  return (
    <div
      onClick={onOpen}
      className="relative overflow-hidden rounded-xl border border-[#4abbc340] bg-white shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
      style={{ padding: `12px 12px 12px ${(singleColor || hasMultipleColors) ? 17 : 12}px` }}
    >
      {/* Color bar */}
      {(singleColor || hasMultipleColors) && (
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 5,
          background: hasMultipleColors ? gradientStr : singleColor, zIndex: 1,
        }} />
      )}

      {/* Header */}
      <div className="mb-1.5 flex items-start justify-between gap-2 relative z-10">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-semibold text-gray-800">{contextTitle}</div>
          <div className="truncate text-[10.5px] text-gray-400">{task.clientName}</div>
        </div>
        <TypeBadge type={taskType} />
      </div>

      {/* Custom text */}
      {task.customText && (
        <div className="mb-1.5 truncate text-[11px] text-gray-500 italic">{task.customText}</div>
      )}

      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {task.labels.map((l) => (
            <span
              key={l.id}
              className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-white shadow-sm"
              style={{ backgroundColor: l.color }}
            >
              {l.title}
            </span>
          ))}
        </div>
      )}

      {/* Title */}
      <div className="mb-3 line-clamp-3 text-[13.5px] font-medium leading-snug text-gray-900">
        {task.title}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 relative z-10">
        <div className="flex items-center gap-2 min-w-0">
          {daysLabel && (
            <span
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium border ${
                daysColor === "red" ? "bg-red-50 text-red-600 border-red-200/50" :
                daysColor === "amber" ? "bg-amber-50 text-amber-600 border-amber-200/50" :
                "bg-slate-50 text-slate-500 border-slate-200/40"
              }`}
            >
              <Clock className="size-3" />
              {daysLabel}
            </span>
          )}
          {showAssignee && <AssigneeBadge task={task} />}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => void updateTask({ taskId: task._id as Id<"orderTasks">, status: "done" })}
            title="Zrealizuj"
            className="rounded-full p-2 text-gray-400 hover:bg-green-50 hover:text-green-600 active:scale-90 transition-all"
          >
            <Check className="size-4" />
          </button>

          <button
            onClick={() => {
              if (task.priority === "high") void updateTask({ taskId: task._id as Id<"orderTasks">, clearPriority: true });
              else void updateTask({ taskId: task._id as Id<"orderTasks">, priority: "high" });
            }}
            title={task.priority === "high" ? "Usuń priorytet" : "Wysoki priorytet"}
            className={`rounded-full p-2 transition-all active:scale-90 ${task.priority === "high" ? "text-red-500" : "text-gray-400"}`}
          >
            <Flame className="size-4" fill={task.priority === "high" ? "#f97316" : "none"} />
          </button>

          <button
            onClick={() => {
              const targetDate = task.dueDate ? new Date(task.dueDate) : new Date();
              const start = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 6, 0, 0, 0).getTime();
              const end = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 7, 0, 0, 0).getTime();
              void createCalendarEvent({
                eventTypeId: "wlasne_default_id" as Id<"calendarEventTypes">,
                title: task.title,
                startDate: start,
                endDate: end,
                isAllDay: false,
                isPrivate: false,
                orderId: task.orderId as Id<"orders"> | undefined,
                clientId: task.clientId as Id<"clients"> | undefined,
                assignedUserIds: task.assignedUserId ? [task.assignedUserId as Id<"users">] : undefined,
                labelIds: task.labelIds as Id<"taskLabels">[] | undefined,
              });
              void updateTask({ taskId: task._id as Id<"orderTasks">, addedToCalendar: true });
              toast.success("Dodano do kalendarza");
            }}
            title="Dodaj do kalendarza"
            className={`rounded-full p-2 transition-all active:scale-90 ${
              task.addedToCalendar ? "text-indigo-500" : "text-gray-400"
            }`}
          >
            <CalendarPlus className="size-4" />
          </button>

          <button
            onClick={onMove}
            title="Przenieś"
            className="rounded-full p-2 text-gray-400 hover:bg-[#4abbc3]/10 hover:text-[#4abbc3] active:scale-90 transition-all"
          >
            <MoveRight className="size-4" />
          </button>

          {openHref !== "#" && (
            <button
              onClick={() => router.push(openHref)}
              title={typeMeta.openLabel}
              className="rounded-full p-2 text-gray-400 hover:text-gray-700 active:scale-90 transition-all"
            >
              <ExternalLink className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────── MobileBagRow ─────────── */

function MobileBagRow({ task, onOpen }: { task: DashboardTask; onOpen: () => void }) {
  const updateTask = useMutation(api.orderTasks.update);
  return (
    <div
      onClick={onOpen}
      className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white/70 px-3 py-2.5 active:bg-gray-50 transition-colors"
    >
      <Check className="size-4 shrink-0 text-green-500" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-gray-500 line-through">{task.title}</div>
        <div className="truncate text-[10px] text-gray-400">{task.clientName}</div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); void updateTask({ taskId: task._id as Id<"orderTasks">, archived: true }); }}
        title="Archiwizuj"
        className="shrink-0 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 active:scale-90 transition-all"
      >
        <Archive className="size-4" />
      </button>
    </div>
  );
}

/* ─────────── MoveColumnPicker ─────────── */

function MoveColumnPicker({
  columns,
  currentColId,
  onMove,
  onClose,
}: {
  columns: { _id: string; title: string; color?: string | null }[];
  currentColId: string | null;
  onMove: (colId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/30" onClick={onClose}>
      <div
        className="rounded-t-2xl bg-white shadow-2xl border-t border-gray-200 pb-[env(safe-area-inset-bottom,0px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-900">Przenieś do kolumny</span>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex flex-col gap-1 p-3 max-h-80 overflow-y-auto">
          {columns.map((col) => (
            <button
              key={col._id}
              onClick={() => { onMove(col._id); onClose(); }}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-left transition-colors active:scale-[0.98] ${
                currentColId === col._id
                  ? "bg-[#4abbc3]/10 text-[#4abbc3]"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: col.color ?? "#4abbc3" }}
              />
              {col.title}
              {currentColId === col._id && (
                <span className="ml-auto text-xs text-[#4abbc3] font-semibold">Bieżąca</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────── MobileArchiveView ─────────── */

function MobileArchiveView({ tasks, loading, onOpen }: { tasks: DashboardTask[]; loading: boolean; onOpen: (id: Id<"orderTasks">) => void }) {
  const updateTask = useMutation(api.orderTasks.update);
  if (loading) {
    return <div className="flex items-center justify-center py-20"><RefreshCw className="size-6 text-[#4abbc3] animate-spin" /></div>;
  }
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <Archive className="size-10 text-gray-300" />
        <p className="text-sm text-gray-400">Archiwum jest puste.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {tasks.map((task) => {
        const taskType: TaskType =
          task.source === "general" ? "general" :
          task.source === "opportunity" ? "opportunity" :
          task.source === "complaint" ? "complaint" :
          "order";
        return (
          <div key={task._id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
            <TypeBadge type={taskType} />
            <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onOpen(task._id as Id<"orderTasks">)}>
              <div className="truncate text-sm font-medium text-gray-700">{task.title}</div>
              <div className="truncate text-xs text-gray-400">{task.clientName}</div>
            </div>
            <button
              onClick={() => void updateTask({ taskId: task._id as Id<"orderTasks">, archived: false })}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 active:scale-95 transition-all"
            >
              <ArchiveRestore className="size-3.5" /> Przywróć
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────── Główny komponent ─────────── */

export default function MobileDashboard() {
  const me = useQuery(api.users.me);
  const isAdmin = me?.role === "admin";
  const canAddTasks = me?.role === "admin" || me?.role === "sales";

  const [filter, setFilter] = useState<FilterValue>("all");
  const [selectedColIndex, setSelectedColIndex] = useState(0);
  const [openTaskId, setOpenTaskId] = useState<Id<"orderTasks"> | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [openBags, setOpenBags] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<"board" | "archive">("board");
  const [moveTaskId, setMoveTaskId] = useState<string | null>(null);
  const [showAllDone, setShowAllDone] = useState(false);
  const [showFilterPicker, setShowFilterPicker] = useState(false);

  const taskColumns = useQuery(api.taskColumns.list) ?? [];
  const tasks = useQuery(api.dashboardTasks.list, isAdmin ? { filter } : {});
  const users = useQuery(api.users.listAllActive);
  const updateTask = useMutation(api.orderTasks.update);

  const loading = me === undefined || tasks === undefined;

  const today = startOfToday();
  const tomorrow = today + 24 * 60 * 60 * 1000;

  /* ── grupowanie zadań ── */
  const { byColumn, bagByColumn, archivedTasks, overdueCount, todayCount } = useMemo(() => {
    const groupedCol: Record<string, DashboardTask[]> = {};
    const bagCol: Record<string, DashboardTask[]> = {};
    const archived: DashboardTask[] = [];
    const sysColIds: Record<string, string> = {};

    for (const col of taskColumns) {
      groupedCol[col._id] = [];
      bagCol[col._id] = [];
      if (col.systemType) sysColIds[col.systemType] = col._id;
    }
    groupedCol["unassigned"] = [];
    bagCol["unassigned"] = [];

    let overdue = 0;
    let due = 0;

    const now = new Date();
    const mondayThisWeek = new Date(now);
    mondayThisWeek.setHours(0, 0, 0, 0);
    const day = mondayThisWeek.getDay();
    const diff = mondayThisWeek.getDate() - day + (day === 0 ? -6 : 1);
    mondayThisWeek.setDate(diff);
    const mTs = mondayThisWeek.getTime();
    const dTs = (days: number) => mTs + days * 24 * 60 * 60 * 1000;
    const tue = dTs(1), wed = dTs(2), thu = dTs(3), fri = dTs(4), sat = dTs(5), nextMon = dTs(7), nextNextMon = dTs(14);

    const resolveKey = (t: DashboardTask): string => {
      if (t.columnId && groupedCol[t.columnId]) return t.columnId;
      if (!t.dueDate) return sysColIds["todo_list"] ?? "unassigned";
      const ts = t.dueDate;
      let id: string | undefined;
      if (ts >= mTs && ts < tue) id = sysColIds["monday"];
      else if (ts >= tue && ts < wed) id = sysColIds["tuesday"];
      else if (ts >= wed && ts < thu) id = sysColIds["wednesday"];
      else if (ts >= thu && ts < fri) id = sysColIds["thursday"];
      else if (ts >= fri && ts < sat) id = sysColIds["friday"];
      else if (ts >= mTs && ts < nextMon) id = sysColIds["this_week"];
      else if (ts >= nextMon && ts < nextNextMon) id = sysColIds["next_week"];
      else id = sysColIds["todo_list"];
      return id && groupedCol[id] ? id : "unassigned";
    };

    for (const t of tasks ?? []) {
      if (t.archived) { archived.push(t); continue; }
      if (t.status !== "done" && t.dueDate != null) {
        if (t.dueDate < today) overdue++;
        else if (t.dueDate < tomorrow) due++;
      }
      const key = resolveKey(t);
      if (t.status === "done") bagCol[key].push(t);
      else groupedCol[key].push(t);
    }

    const sortByDue = (a: DashboardTask, b: DashboardTask) => {
      if (a.priority === "high" && b.priority !== "high") return -1;
      if (a.priority !== "high" && b.priority === "high") return 1;
      const now2 = Date.now();
      const aOlder = a.columnChangedAt ? (now2 - a.columnChangedAt > 1000 * 60 * 60 * 24) : false;
      const bOlder = b.columnChangedAt ? (now2 - b.columnChangedAt > 1000 * 60 * 60 * 24) : false;
      if (aOlder && !bOlder) return -1;
      if (!aOlder && bOlder) return 1;
      if (a.position !== undefined && b.position !== undefined) return a.position - b.position;
      if (a.position !== undefined) return -1;
      if (b.position !== undefined) return 1;
      if (a.dueDate == null && b.dueDate == null) return 0;
      if (a.dueDate == null) return 1;
      if (b.dueDate == null) return -1;
      return a.dueDate - b.dueDate;
    };

    for (const key in groupedCol) groupedCol[key].sort(sortByDue);
    for (const key in bagCol) bagCol[key].sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
    archived.sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0));

    return { byColumn: groupedCol, bagByColumn: bagCol, archivedTasks: archived, overdueCount: overdue, todayCount: due };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, today, tomorrow, taskColumns]);

  /* ── aktywna kolumna ── */
  const validIndex = Math.min(selectedColIndex, Math.max(0, taskColumns.length - 1));
  const currentCol = taskColumns[validIndex] ?? null;
  const currentColId = currentCol?._id ?? null;

  /* ── swipe ── */
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 50) return;
    if (dx < 0 && validIndex < taskColumns.length - 1) setSelectedColIndex(validIndex + 1);
    if (dx > 0 && validIndex > 0) setSelectedColIndex(validIndex - 1);
  }, [validIndex, taskColumns.length]);

  /* ── przenoszenie zadania ── */
  async function handleMove(taskId: string, targetColId: string) {
    const targetCol = taskColumns.find(c => c._id === targetColId);
    const systemType = targetCol?.systemType;
    const now = new Date();
    const mondayThisWeek = new Date(now);
    mondayThisWeek.setHours(0, 0, 0, 0);
    const day = mondayThisWeek.getDay();
    const diffD = mondayThisWeek.getDate() - day + (day === 0 ? -6 : 1);
    mondayThisWeek.setDate(diffD);
    const mTs = mondayThisWeek.getTime();
    const dTs = (days: number) => mTs + days * 24 * 60 * 60 * 1000;

    let patch: { dueDate?: number; clearDueDate?: boolean; columnId?: Id<"taskColumns">; clearColumnId?: boolean } = {};
    if (systemType) {
      if (systemType === "todo_list") patch = { clearDueDate: true, clearColumnId: true };
      else if (systemType === "monday") patch = { dueDate: mTs, clearColumnId: true };
      else if (systemType === "tuesday") patch = { dueDate: dTs(1), clearColumnId: true };
      else if (systemType === "wednesday") patch = { dueDate: dTs(2), clearColumnId: true };
      else if (systemType === "thursday") patch = { dueDate: dTs(3), clearColumnId: true };
      else if (systemType === "friday") patch = { dueDate: dTs(4), clearColumnId: true };
      else if (systemType === "this_week") patch = { dueDate: dTs(5), clearColumnId: true };
      else if (systemType === "next_week") patch = { dueDate: dTs(7), clearColumnId: true };
    } else {
      patch = { columnId: targetColId as Id<"taskColumns"> };
    }
    await updateTask({ taskId: taskId as Id<"orderTasks">, ...patch });
    toast.success("Zadanie przeniesione");
  }

  /* ── kolumna przenoszanego zadania ── */
  const moveCurColId = moveTaskId
    ? (() => {
        for (const col of taskColumns) {
          if ((byColumn[col._id] ?? []).some(t => t._id === moveTaskId)) return col._id;
          if ((bagByColumn[col._id] ?? []).some(t => t._id === moveTaskId)) return col._id;
        }
        return null;
      })()
    : null;

  const colTasks = currentColId ? (byColumn[currentColId] ?? []) : [];
  const colBag = currentColId ? (bagByColumn[currentColId] ?? []) : [];
  const isLastCol = validIndex === taskColumns.length - 1;
  const visibleTasks = isLastCol && !showAllDone ? colTasks.slice(0, DONE_LIMIT) : colTasks;
  const hiddenCount = isLastCol ? colTasks.length - visibleTasks.length : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="size-6 text-[#4abbc3] animate-spin" />
      </div>
    );
  }

  /* ── filter label ── */
  const filterLabel = useMemo(() => {
    if (filter === "all") return "Wszyscy";
    if (filter === "unassigned") return "Nieprzypisane";
    const u = (users ?? []).find((u) => u._id === filter);
    return u?.displayName ?? u?.login ?? "Użytkownik";
  }, [filter, users]);

  const filterUser = useMemo(() => {
    if (filter === "all" || filter === "unassigned") return null;
    return (users ?? []).find((u) => u._id === filter) ?? null;
  }, [filter, users]);

  return (
    <div className="flex flex-col min-h-0 relative -mx-4 -mt-4">

      {/* ── Sticky Header Zone ── */}
      <div className="sticky top-0 z-20 bg-slate-50">
        {/* Row 1: Title / filter / badges */}
        <div className="px-4 pt-3 pb-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {view === "archive" ? (
              <>
                <button
                  onClick={() => setView("board")}
                  className="flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-700 active:bg-gray-200 transition-colors"
                >
                  <ArrowLeft className="size-3" /> Wróć
                </button>
                <span className="text-sm font-bold text-gray-900">Archiwum</span>
              </>
            ) : (
              <h1 className="text-sm font-bold text-gray-900 shrink-0">Zadania</h1>
            )}

            {/* Admin filter button (compact) */}
            {isAdmin && view === "board" && (
              <button
                onClick={() => setShowFilterPicker(true)}
                className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-600 active:bg-gray-50 transition-colors shadow-sm min-w-0"
              >
                {filterUser ? (
                  <span
                    className="flex size-4 shrink-0 items-center justify-center rounded-full text-[7px] font-bold text-white"
                    style={{ background: filterUser.color ?? uColor(filterUser._id) }}
                  >
                    {uInitials(filterUser.displayName ?? filterUser.login ?? "")}
                  </span>
                ) : (
                  <Users className="size-3 shrink-0" />
                )}
                <span className="truncate max-w-[80px]">{filterLabel}</span>
                <ChevronDown className="size-2.5 shrink-0 text-gray-400" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {view === "board" && (
              <>
                {overdueCount > 0 && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 ring-1 ring-inset ring-red-200">
                    <Clock className="size-2.5" /> {overdueCount}
                  </span>
                )}
                {todayCount > 0 && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                    <CalendarDays className="size-2.5" /> {todayCount}
                  </span>
                )}
                <button
                  onClick={() => setView("archive")}
                  className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-600 active:bg-gray-50 transition-colors shadow-sm"
                >
                  <Archive className="size-3" />
                  {archivedTasks.length > 0 ? `${archivedTasks.length}` : ""}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Row 2: Column grid */}
        {view === "board" && taskColumns.length > 0 && (
          <div className="px-3 pb-2">
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${taskColumns.length}, 1fr)` }}>
              {taskColumns.map((col, idx) => {
                const count = (byColumn[col._id] ?? []).length;
                const isActive = idx === validIndex;
                const colColor = col.color ?? "#4abbc3";
                return (
                  <button
                    key={col._id}
                    onClick={() => setSelectedColIndex(idx)}
                    className={`flex flex-col items-center justify-center rounded-lg py-1.5 text-center transition-all active:scale-95 ${
                      isActive
                        ? "text-white shadow-sm"
                        : "bg-gray-100 text-gray-500"
                    }`}
                    style={isActive ? { background: colColor } : undefined}
                  >
                    <span className="text-[10px] font-bold leading-tight">{colShortName(col)}</span>
                    <span
                      className={`mt-0.5 inline-flex size-4 items-center justify-center rounded-full text-[9px] font-bold ${
                        isActive ? "bg-white/25 text-white" : "bg-gray-200/80 text-gray-600"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Separator */}
        <div className="h-px bg-gray-200/60" />
      </div>

      {/* ── Scrollable Content ── */}
      <div className="px-4 pt-3 pb-4">

        {/* Archiwum */}
        {view === "archive" && (
          <MobileArchiveView
            tasks={archivedTasks}
            loading={loading}
            onOpen={(id) => setOpenTaskId(id)}
          />
        )}

        {/* Board - task cards */}
        {view === "board" && taskColumns.length > 0 && (
          <div
            className="flex flex-col gap-2.5"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {visibleTasks.length === 0 && colBag.length === 0 && (
              <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
                Brak zadań w tej kolumnie
              </div>
            )}

            {visibleTasks.map((task) => (
              <MobileTaskCard
                key={task._id}
                task={task}
                showAssignee={canAddTasks}
                onOpen={() => setOpenTaskId(task._id as Id<"orderTasks">)}
                onMove={() => setMoveTaskId(task._id)}
              />
            ))}

            {isLastCol && hiddenCount > 0 && (
              <button
                onClick={() => setShowAllDone(true)}
                className="rounded-xl border border-gray-200 py-2.5 text-xs font-medium text-gray-500"
              >
                Pokaż więcej ({hiddenCount})
              </button>
            )}
            {isLastCol && showAllDone && colTasks.length > DONE_LIMIT && (
              <button
                onClick={() => setShowAllDone(false)}
                className="rounded-xl border border-gray-200 py-2.5 text-xs font-medium text-gray-500"
              >
                Zwiń
              </button>
            )}

            {/* Worek */}
            {currentColId && (
              <div className="mt-1 border-t border-dashed border-gray-200 pt-2">
                <button
                  onClick={() => setOpenBags(s => ({ ...s, [currentColId]: !s[currentColId] }))}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold text-gray-500 active:bg-gray-50"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <ShoppingBag className="size-3.5" />
                    Worek ({colBag.length})
                  </span>
                  <ChevronRight className={`size-3.5 transition-transform ${openBags[currentColId] ? "rotate-90" : ""}`} />
                </button>
                {openBags[currentColId] && (
                  <div className="mt-1 flex flex-col gap-1.5">
                    {colBag.length === 0 ? (
                      <div className="py-3 text-center text-xs text-gray-400">Brak zrealizowanych</div>
                    ) : (
                      colBag.map(task => (
                        <MobileBagRow
                          key={task._id}
                          task={task}
                          onOpen={() => setOpenTaskId(task._id as Id<"orderTasks">)}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* FAB */}
      {canAddTasks && view === "board" && (
        <button
          onClick={() => setAddOpen(true)}
          className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] right-4 z-40 flex size-14 items-center justify-center rounded-full bg-[#4abbc3] text-white shadow-lg shadow-[#4abbc3]/40 active:scale-90 transition-all"
          title="Dodaj zadanie"
        >
          <Plus className="size-6" />
        </button>
      )}

      {/* Drawery */}
      <TaskDrawer taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
      {canAddTasks && (
        <AddTaskDrawer
          open={addOpen}
          onClose={() => setAddOpen(false)}
          initialTargetType="order"
          initialColumnId={currentColId}
        />
      )}

      {/* Move Picker */}
      {moveTaskId && (
        <MoveColumnPicker
          columns={taskColumns}
          currentColId={moveCurColId}
          onMove={(colId) => void handleMove(moveTaskId, colId)}
          onClose={() => setMoveTaskId(null)}
        />
      )}

      {/* Filter Picker Bottom Sheet */}
      {showFilterPicker && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]"
            onClick={() => setShowFilterPicker(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl pb-[env(safe-area-inset-bottom,0px)] animate-in slide-in-from-bottom duration-200 max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-bold text-gray-900">Filtruj po osobie</span>
              <button
                onClick={() => setShowFilterPicker(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {/* Wszyscy */}
              <button
                onClick={() => { setFilter("all"); setShowFilterPicker(false); }}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                  filter === "all" ? "bg-gray-50" : "hover:bg-gray-50"
                }`}
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-gray-200 text-gray-600">
                  <Users className="size-4" />
                </span>
                <span className="flex-1 text-sm font-medium text-gray-900">Wszyscy</span>
                {filter === "all" && <Check className="size-4 text-[#4abbc3]" />}
              </button>
              {/* Nieprzypisane */}
              <button
                onClick={() => { setFilter("unassigned"); setShowFilterPicker(false); }}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                  filter === "unassigned" ? "bg-gray-50" : "hover:bg-gray-50"
                }`}
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-gray-200 text-gray-600">
                  <X className="size-4" />
                </span>
                <span className="flex-1 text-sm font-medium text-gray-900">Nieprzypisane</span>
                {filter === "unassigned" && <Check className="size-4 text-[#4abbc3]" />}
              </button>
              <div className="mx-4 h-px bg-gray-100" />
              {/* Users */}
              {(users ?? []).map((u) => {
                const name = u.displayName ?? u.login ?? "";
                const active = filter === u._id;
                const color = u.color ?? uColor(u._id);
                return (
                  <button
                    key={u._id}
                    onClick={() => { setFilter(u._id); setShowFilterPicker(false); }}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                      active ? "bg-gray-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <span
                      className="flex size-8 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ background: color }}
                    >
                      {uInitials(name)}
                    </span>
                    <span className="flex-1 text-sm font-medium text-gray-900">{name}</span>
                    {active && <Check className="size-4 text-[#4abbc3]" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
