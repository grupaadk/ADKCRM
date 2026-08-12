"use client";

import { useRef, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { DashboardTask } from "@/convex/dashboardTasks";
import type { Id } from "@/convex/_generated/dataModel";
import { ExternalLink, Plus, Clock, CalendarDays, CalendarPlus, ChevronRight, ChevronLeft, Lock, Unlock, Flame, Check, Archive, ArchiveRestore, ShoppingBag, ArrowLeft, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import TaskDrawer from "@/components/TaskDrawer";
import AddTaskDrawer from "@/components/AddTaskDrawer";
import ModalPortal from "@/components/ModalPortal";


const DONE_LIMIT = 10;

/* ── typ zadania (źródło): zlecenie, szansa sprzedaży, reklamacja ── */
const TASK_TYPE_META = {
  order:       { label: "Zlecenie",         openLabel: "Otwórz zlecenie", color: "#2563eb" },
  opportunity: { label: "Szansa sprzedaży", openLabel: "Otwórz szansę",  color: "#b45309" },
  complaint:   { label: "Reklamacja",       openLabel: "Otwórz reklamację", color: "#ea580c" },
  general:     { label: "Zadanie",          openLabel: "Otwórz zadanie", color: "#64748b" },
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
  const canAddTasks = me?.role === "admin" || me?.role === "sales";

  const [filter, setFilter] = useState<FilterValue>("all");
  const [showAllDone, setShowAllDone] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<Id<"orderTasks"> | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addDrawerType, setAddDrawerType] = useState<"order" | "opportunity" | "general">("order");
  const [addDrawerColId, setAddDrawerColId] = useState<string | null>(null);
  const [addMenuCol, setAddMenuCol] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [dragColId, setDragColId] = useState<string | null>(null);
  const [dragOverColIndex, setDragOverColIndex] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [addingList, setAddingList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [unlockedColId, setUnlockedColId] = useState<string | null>(null);
  const [view, setView] = useState<"board" | "archive">("board");
  const [openBags, setOpenBags] = useState<Record<string, boolean>>({});
  const taskColumns = useQuery(api.taskColumns.list) ?? [];
  const createColumn = useMutation(api.taskColumns.create);
  const updateColumnOrder = useMutation(api.taskColumns.updateOrder);
  const renameColumn = useMutation(api.taskColumns.rename);
  const removeColumn = useMutation(api.taskColumns.remove);
  const [colTitleDraft, setColTitleDraft] = useState("");
  const [confirmDeleteColId, setConfirmDeleteColId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const commitColTitle = (colId: string) => {
    const col = taskColumns.find((c) => c._id === colId);
    const t = colTitleDraft.trim();
    if (col && t && t !== col.title) {
      void renameColumn({ columnId: colId as Id<"taskColumns">, title: t });
    }
  };

  const closeDeleteConfirm = () => {
    setConfirmDeleteColId(null);
    setDeleteError(null);
    setDeleting(false);
  };

  const confirmDeleteColumn = async () => {
    if (!confirmDeleteColId) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await removeColumn({ columnId: confirmDeleteColId as Id<"taskColumns"> });
      setUnlockedColId(null);
      closeDeleteConfirm();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Nie można usunąć listy zawierającej zadania.");
      setDeleting(false);
    }
  };

  // Zwykły user dostaje tylko swoje (serwer ignoruje filter); admin filtruje.
  const tasks = useQuery(
    api.dashboardTasks.list,
    isAdmin ? { filter } : {},
  );
  const users = useQuery(api.users.listAllActive);
  const updateTask = useMutation(api.orderTasks.update);
  const createTask = useMutation(api.dashboardTasks.adminCreate);

  const [inlineAddCol, setInlineAddCol] = useState<string | null>(null);
  const [inlineAddTitle, setInlineAddTitle] = useState("");
  const [inlineSubmitting, setInlineSubmitting] = useState(false);

  const submitInlineAdd = async (colId: string) => {
    if (!inlineAddTitle.trim() || inlineSubmitting) return;
    setInlineSubmitting(true);
    try {
      await createTask({
        title: inlineAddTitle.trim(),
        status: "todo",
        dueDate: undefined,
        columnId: colId as Id<"taskColumns">,
        assignedUserId: me?._id,
      });

      setInlineAddTitle("");
      setInlineAddCol(null);
    } catch (e) {
      console.error(e);
      alert("Błąd podczas dodawania zadania.");
    } finally {
      setInlineSubmitting(false);
    }
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollRaf = useRef<number | null>(null);
  const scrollVelocity = useRef(0); // aktualna prędkość (px/klatkę)
  const scrollTarget = useRef(0); // docelowa prędkość (0 = wytracanie)
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(true);

  const checkScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setShowLeftScroll(scrollLeft > 0);
    // Margines błędu 2px na floaty w przeglądarkach
    setShowRightScroll(Math.ceil(scrollLeft + clientWidth) < scrollWidth - 2);
  };

  useEffect(() => {
    const handleGlobalClick = () => {
      if (addMenuCol) setAddMenuCol(null);
    };
    if (addMenuCol) {
      document.addEventListener("click", handleGlobalClick);
    }
    return () => document.removeEventListener("click", handleGlobalClick);
  }, [addMenuCol]);

  useEffect(() => {
    // Odczekajmy chwilę, żeby DOM zdążył się narysować po zmianie zadań
    const timer = setTimeout(checkScroll, 150);
    window.addEventListener("resize", checkScroll);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", checkScroll);
    };
  }, [tasks]); // Uruchom po załadowaniu i przeliczeniu

  // Pętla animacji: prędkość płynnie dąży do celu (ease-in przy najechaniu,
  // bezwładne wytracanie po zejściu z przycisku) — zsynchronizowana z ekranem.
  const runScrollLoop = () => {
    const el = scrollContainerRef.current;
    if (!el) {
      scrollRaf.current = null;
      return;
    }
    scrollVelocity.current += (scrollTarget.current - scrollVelocity.current) * 0.12;
    el.scrollLeft += scrollVelocity.current;
    // Zatrzymaj pętlę dopiero gdy praktycznie stoimy i nie ma celu (koniec bezwładności)
    if (scrollTarget.current === 0 && Math.abs(scrollVelocity.current) < 0.15) {
      scrollVelocity.current = 0;
      scrollRaf.current = null;
      return;
    }
    scrollRaf.current = requestAnimationFrame(runScrollLoop);
  };

  const startScrolling = (direction: 'left' | 'right') => {
    const MAX_SPEED = 22; // maksymalna prędkość w px/klatkę
    scrollTarget.current = direction === 'right' ? MAX_SPEED : -MAX_SPEED;
    if (scrollRaf.current == null) {
      scrollRaf.current = requestAnimationFrame(runScrollLoop);
    }
  };

  const stopScrolling = () => {
    // Nie zatrzymujemy gwałtownie — zerujemy cel, a pętla płynnie wyhamuje (momentum).
    scrollTarget.current = 0;
  };

  useEffect(() => {
    return () => {
      if (scrollRaf.current) cancelAnimationFrame(scrollRaf.current);
    };
  }, []);

  const today = startOfToday();
  const tomorrow = today + 24 * 60 * 60 * 1000;

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

    // Wyznacza kolumnę (klucz), do której należy zadanie — po columnId lub po dacie.
    const resolveKey = (t: DashboardTask): string => {
      if (t.columnId && groupedCol[t.columnId]) return t.columnId;
      if (!t.dueDate) return sysColIds["todo_list"] ?? "unassigned";
      const ts = t.dueDate;
      let id;
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
      // Zarchiwizowane — poza tablicą i Workiem, tylko w widoku Archiwum.
      if (t.archived) {
        archived.push(t);
        continue;
      }

      if (t.status !== "done" && t.dueDate != null) {
        if (t.dueDate < today) overdue++;
        else if (t.dueDate < tomorrow) due++;
      }

      const key = resolveKey(t);
      // Zrealizowane trafiają do Worka danej kolumny, reszta zostaje na liście.
      if (t.status === "done") bagCol[key].push(t);
      else groupedCol[key].push(t);
    }

    const sortByDue = (a: DashboardTask, b: DashboardTask) => {
      // 1. Wysoki priorytet ponad wszystko
      if (a.priority === "high" && b.priority !== "high") return -1;
      if (a.priority !== "high" && b.priority === "high") return 1;

      const now = Date.now();
      const aOlder = a.columnChangedAt ? (now - a.columnChangedAt > 1000 * 60 * 60 * 24) : false;
      const bOlder = b.columnChangedAt ? (now - b.columnChangedAt > 1000 * 60 * 60 * 24) : false;
      if (aOlder && !bOlder) return -1;
      if (!aOlder && bOlder) return 1;

      if (a.position !== undefined && b.position !== undefined) {
        return a.position - b.position;
      }
      if (a.position !== undefined) return -1;
      if (b.position !== undefined) return 1;

      if (a.dueDate == null && b.dueDate == null) return 0;
      if (a.dueDate == null) return 1;
      if (b.dueDate == null) return -1;
      return a.dueDate - b.dueDate;
    };

    for (const key in groupedCol) groupedCol[key].sort(sortByDue);
    // Worek: najświeższe zrealizowane na górze.
    for (const key in bagCol) bagCol[key].sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
    archived.sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0));

    return { byColumn: groupedCol, bagByColumn: bagCol, archivedTasks: archived, overdueCount: overdue, todayCount: due };
  }, [tasks, today, tomorrow, taskColumns]);

  const greetingName = me?.displayName ?? me?.login ?? "";
  const loading = me === undefined;

  const draggedTask = dragId ? (tasks ?? []).find((t) => t._id === dragId) ?? null : null;

  async function handleTaskMove(draggedTaskId: string, targetColumnId: string, targetTaskId?: string) {
    setDragId(null);
    setDragOverCol(null);
    setDragOverTaskId(null);
    if (!draggedTaskId) return;

    const task = (tasks ?? []).find((t) => t._id === draggedTaskId);
    if (!task) return;

    const targetCol = taskColumns.find(c => c._id === targetColumnId);
    const systemType = targetCol?.systemType;

    const now = new Date();
    const mondayThisWeek = new Date(now);
    mondayThisWeek.setHours(0, 0, 0, 0);
    const day = mondayThisWeek.getDay();
    const diff = mondayThisWeek.getDate() - day + (day === 0 ? -6 : 1);
    mondayThisWeek.setDate(diff);
    const mTs = mondayThisWeek.getTime();
    const dTs = (days: number) => mTs + days * 24 * 60 * 60 * 1000;

    let newDate: number | undefined = undefined;
    if (systemType === "monday") newDate = mTs;
    else if (systemType === "tuesday") newDate = dTs(1);
    else if (systemType === "wednesday") newDate = dTs(2);
    else if (systemType === "thursday") newDate = dTs(3);
    else if (systemType === "friday") newDate = dTs(4);
    else if (systemType === "this_week") newDate = dTs(5);
    else if (systemType === "next_week") newDate = dTs(7);

    // 1. Wyznacz zmiany dla przenoszonego zadania
    let patch: {
      dueDate?: number;
      clearDueDate?: boolean;
      columnId?: Id<"taskColumns">;
      clearColumnId?: boolean;
    } = {};
    if (systemType) {
      if (systemType === "todo_list") {
        patch = { clearDueDate: true, clearColumnId: true };
      } else {
        patch = { dueDate: newDate, clearColumnId: true };
      }
    } else {
      patch = { columnId: targetColumnId as Id<"taskColumns"> };
    }

    // 2. Określ nową pozycję w kolumnie docelowej
    const colTasks = [...(byColumn[targetColumnId] ?? [])].filter(t => t._id !== draggedTaskId);

    if (targetTaskId) {
      const targetIdx = colTasks.findIndex(t => t._id === targetTaskId);
      if (targetIdx !== -1) {
        colTasks.splice(targetIdx, 0, task);
      } else {
        colTasks.push(task);
      }
    } else {
      colTasks.push(task);
    }

    // Zapisz pozycje w bazie danych
    for (let i = 0; i < colTasks.length; i++) {
      const t = colTasks[i];
      const newPos = i * 1000;
      if (t._id === draggedTaskId) {
        await updateTask({
          taskId: draggedTaskId as Id<"orderTasks">,
          ...patch,
          position: newPos,
        });
      } else if (t.position !== newPos) {
        await updateTask({
          taskId: t._id as Id<"orderTasks">,
          position: newPos,
        });
      }
    }
  }

  function handleColDrop(targetColId: string) {
    setDragOverColIndex(null);
    if (!dragColId || dragColId === targetColId) return;
    const targetCol = taskColumns.find(c => c._id === targetColId);
    if (!targetCol) return;
    void updateColumnOrder({ columnId: dragColId as Id<"taskColumns">, newOrder: targetCol.order });
    setDragColId(null);
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
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setView(view === "archive" ? "board" : "archive")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium transition-colors ${
                view === "archive"
                  ? "bg-gray-900 text-white hover:bg-gray-800"
                  : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {view === "archive" ? <ArrowLeft className="size-4" /> : <Archive className="size-4" />}
              {view === "archive" ? "Wróć do tablicy" : `Archiwum${archivedTasks.length > 0 ? ` (${archivedTasks.length})` : ""}`}
            </button>
            {canAddTasks && view === "board" && (
              <button
                onClick={() => {
                  setAddDrawerType("order");
                  setAddDrawerColId(null);
                  setAddOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                <Plus className="size-4" /> Dodaj zadanie
              </button>
            )}
          </div>
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
      {isAdmin && view === "board" && (
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

      {/* ── Kontrolki Scrollowania ── */}
      {view === "board" && !loading && (showLeftScroll || showRightScroll) && (
        <div className="flex justify-center gap-2 mb-2 w-full">
          <button
            onMouseEnter={() => showLeftScroll && startScrolling('left')}
            onMouseLeave={stopScrolling}
            className={`flex size-9 items-center justify-center rounded-full shadow transition-all ${
              showLeftScroll ? "bg-[#4abbc3] text-white hover:opacity-90 hover:scale-110 cursor-pointer" : "bg-gray-100 text-gray-400 cursor-not-allowed opacity-50"
            }`}
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            onMouseEnter={() => showRightScroll && startScrolling('right')}
            onMouseLeave={stopScrolling}
            className={`flex size-9 items-center justify-center rounded-full shadow transition-all ${
              showRightScroll ? "bg-[#4abbc3] text-white hover:opacity-90 hover:scale-110 cursor-pointer" : "bg-gray-100 text-gray-400 cursor-not-allowed opacity-50"
            }`}
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      )}

      {/* ── Główny Kanban ── */}
      {view === "board" && (loading ? (
        <div className="py-20 text-center text-sm text-gray-400">Ładowanie zadań…</div>
      ) : (
        <div className="relative w-full group">
          <div 
            ref={scrollContainerRef}
            onScroll={checkScroll}
            className="w-full overflow-x-auto pb-4 hide-scrollbar"
          >
            <div className="flex flex-row gap-4 items-stretch" style={{ minWidth: "max-content" }}>
          {taskColumns.map((col) => {
            const colTasks = byColumn[col._id] || [];
            // Ukrywamy część zadań tylko w ostatniej kolumnie jako przykład (jeśli to była kolumna gotowe)
            const isLast = col._id === taskColumns[taskColumns.length - 1]?._id;
            const visible = isLast && !showAllDone ? colTasks.slice(0, DONE_LIMIT) : colTasks;
            const hiddenCount = isLast ? colTasks.length - visible.length : 0;
            const isDropTarget = draggedTask != null && dragOverCol === col._id && draggedTask.columnId !== col._id;
            
            const isColDropTarget = dragColId != null && dragColId !== col._id && dragOverColIndex === col._id;
            
            return (
              <div
                key={col._id}
                draggable={unlockedColId === col._id && dragId === null} // kolumna jest draggowalna tylko po odblokowaniu i gdy nie ciągniemy zadania
                onDragStart={(e) => {
                  if (dragId) {
                    e.preventDefault();
                    return;
                  }
                  // Nie chcemy ciągnąć gdy klikamy w textarea/input
                  if ((e.target as HTMLElement).tagName.toLowerCase() === 'textarea' || (e.target as HTMLElement).tagName.toLowerCase() === 'input' || (e.target as HTMLElement).tagName.toLowerCase() === 'button') {
                    e.preventDefault();
                    return;
                  }
                  setDragColId(col._id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  setDragColId(null);
                  setUnlockedColId(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragColId) {
                    if (dragOverColIndex !== col._id) setDragOverColIndex(col._id);
                  } else {
                    if (dragOverCol !== col._id) setDragOverCol(col._id);
                  }
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    if (dragColId) setDragOverColIndex(null);
                    else setDragOverCol((c) => (c === col._id ? null : c));
                  }
                }}
                onDrop={(e) => {
                  e.stopPropagation();
                  if (dragColId) handleColDrop(col._id);
                  else if (dragId) void handleTaskMove(dragId, col._id);
                }}
                className={`flex flex-col rounded-xl transition-all duration-150 min-w-[18rem] max-w-[18rem] ${dragColId === col._id ? 'opacity-50' : ''}`}
                style={{}}
              >
                {/* nagłówek kolumny */}
                <div
                  className={unlockedColId === col._id ? "cursor-grab active:cursor-grabbing" : ""}
                  style={{
                    padding: "7px 10px", borderRadius: 7,
                    background: "#4abbc3", border: `1px solid #4abbc3`,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    fontSize: 11.5, fontWeight: 700, color: "#ffffff",
                    marginBottom: 8
                  }}
                >
                  {isAdmin && unlockedColId === col._id ? (
                    <input
                      value={colTitleDraft}
                      draggable={false}
                      onChange={(e) => setColTitleDraft(e.target.value)}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onBlur={() => commitColTitle(col._id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { commitColTitle(col._id); (e.target as HTMLInputElement).blur(); }
                        if (e.key === "Escape") { setColTitleDraft(col.title); (e.target as HTMLInputElement).blur(); }
                      }}
                      className="min-w-0 flex-1 rounded border border-white/40 bg-white/20 px-1.5 py-0.5 text-[11.5px] font-bold text-white outline-none placeholder:text-white/60 focus:border-white/80"
                      placeholder="Nazwa listy"
                    />
                  ) : (
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {col.title}
                    </span>
                  )}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isAdmin && unlockedColId === col._id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteError(null);
                          setConfirmDeleteColId(col._id);
                        }}
                        className="rounded p-1 transition-colors hover:bg-white/20"
                        title="Usuń listę"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const willUnlock = unlockedColId !== col._id;
                          setUnlockedColId(willUnlock ? col._id : null);
                          if (willUnlock) setColTitleDraft(col.title);
                        }}
                        className="rounded p-1 transition-colors hover:bg-white/20"
                        title={unlockedColId === col._id ? "Zablokuj przesuwanie listy" : "Odblokuj przesuwanie listy"}
                      >
                        {unlockedColId === col._id ? <Unlock className="size-3.5" /> : <Lock className="size-3.5 opacity-60 hover:opacity-100" />}
                      </button>
                    )}
                    <span style={{
                      background: "rgba(255,255,255,0.22)",
                      borderRadius: 4, padding: "1px 6px",
                      fontSize: 10.5, fontWeight: 700, flexShrink: 0,
                    }}>
                      {colTasks.length}
                    </span>
                  </div>
                </div>

                {/* karty */}
                <div 
                  style={{
                    display: "flex", flexDirection: "column", gap: 6, flexGrow: 1,
                    minHeight: 80, padding: 4, borderRadius: 6,
                    background: isDropTarget ? `#4abbc31A` : isColDropTarget ? `#4abbc31A` : `#4abbc30A`,
                    border: isDropTarget ? `1.5px dashed #4abbc3` : isColDropTarget ? `1.5px dashed #4abbc3` : `1.5px dashed #4abbc340`,
                    transition: "background 0.15s, border 0.15s",
                  }}
                >
                  {/* Dodawanie karty (dropdown) */}
                  {canAddTasks && (
                    <div className="relative mb-2">
                      {addMenuCol === col._id ? (
                        <div className="flex flex-col gap-1 rounded-md border border-gray-200 bg-white p-1 shadow-sm absolute top-full left-0 right-0 z-20 mt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setInlineAddCol(col._id);
                              setInlineAddTitle("");
                              setAddMenuCol(null);
                            }}
                            className="w-full rounded px-2 py-1.5 text-left text-xs font-semibold text-gray-900 hover:bg-gray-100"
                          >
                            Zadanie
                          </button>
                          <div className="my-0.5 h-px bg-gray-100" />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setAddDrawerType("order");
                              setAddDrawerColId(col._id);
                              setAddOpen(true);
                              setAddMenuCol(null);
                            }}
                            className="w-full rounded px-2 py-1.5 text-left text-xs font-medium text-gray-700 hover:bg-gray-100"
                          >
                            Do zlecenia
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setAddDrawerType("opportunity");
                              setAddDrawerColId(col._id);
                              setAddOpen(true);
                              setAddMenuCol(null);
                            }}
                            className="w-full rounded px-2 py-1.5 text-left text-xs font-medium text-gray-700 hover:bg-gray-100"
                          >
                            Do szansy sprzedaży
                          </button>
                        </div>
                      ) : null}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAddMenuCol(addMenuCol === col._id ? null : col._id);
                        }}
                        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-gray-500 hover:bg-black/5 hover:text-gray-700 transition-colors text-left"
                      >
                        <Plus className="size-3.5" />
                        Dodaj kartę
                      </button>
                    </div>
                  )}

                  {/* Inline form for General Task */}
                  {inlineAddCol === col._id && (
                    <div className="mb-3 rounded-md border border-[#4abbc3] bg-white p-2 shadow-sm">
                      <textarea
                        autoFocus
                        rows={2}
                        placeholder="Treść zadania..."
                        className="w-full resize-none text-[13px] outline-none"
                        value={inlineAddTitle}
                        onChange={(e) => setInlineAddTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void submitInlineAdd(col._id);
                          }
                          if (e.key === "Escape") {
                            setInlineAddCol(null);
                          }
                        }}
                      />
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <button
                          onClick={() => setInlineAddCol(null)}
                          className="rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                        >
                          Anuluj
                        </button>
                        <button
                          onClick={() => submitInlineAdd(col._id)}
                          disabled={!inlineAddTitle.trim() || inlineSubmitting}
                          className="rounded bg-[#4abbc3] px-3 py-1 text-xs font-medium text-white hover:bg-[#3ca4ab] transition-colors disabled:opacity-50"
                        >
                          {inlineSubmitting ? "..." : "Dodaj"}
                        </button>
                      </div>
                    </div>
                  )}

                  {visible.length === 0 && (
                    <div className="py-8 text-center text-xs" style={{ color: `${col.color}90` }}>Brak zadań</div>
                  )}
                  {visible.map((task) => (
                    <div
                      key={task._id}
                      className="relative"
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (dragId && dragId !== task._id && dragOverTaskId !== task._id) {
                          setDragOverTaskId(task._id);
                        }
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                          if (dragOverTaskId === task._id) {
                            setDragOverTaskId(null);
                          }
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOverTaskId(null);
                        if (dragId && dragId !== task._id) {
                          void handleTaskMove(dragId, col._id, task._id);
                        }
                      }}
                    >
                      {dragOverTaskId === task._id && dragId !== task._id && (
                        <div className="absolute -top-1.5 left-0 right-0 h-1 bg-[#4abbc3] rounded-full z-10 animate-pulse pointer-events-none" />
                      )}
                      <TaskCard
                        task={task}
                        showAssignee={canAddTasks}
                        onOpen={() => setOpenTaskId(task._id as Id<"orderTasks">)}
                        onDragStart={() => setDragId(task._id)}
                        onDragEnd={() => {
                          setDragId(null);
                          setDragOverTaskId(null);
                        }}
                        dragging={dragId === task._id}
                      />
                    </div>
                  ))}
                  {/* Wskaźnik upuszczenia na koniec listy */}
                  {dragOverCol === col._id && !dragOverTaskId && dragId && !visible.some(t => t._id === dragId) && (
                    <div className="h-10 bg-[#4abbc3]/15 border-2 border-dashed border-[#4abbc3] rounded-lg mt-2 flex items-center justify-center text-xs text-[#4abbc3] font-semibold animate-pulse pointer-events-none">
                      Na koniec listy
                    </div>
                  )}
                  {isLast && hiddenCount > 0 && (
                    <button
                      onClick={() => setShowAllDone(true)}
                      className="mt-1 rounded-md py-1.5 text-xs font-medium text-gray-500 hover:bg-white hover:text-gray-700 transition-colors"
                    >
                      Pokaż więcej ({hiddenCount})
                    </button>
                  )}
                  {isLast && showAllDone && colTasks.length > DONE_LIMIT && (
                    <button
                      onClick={() => setShowAllDone(false)}
                      className="mt-1 rounded-md py-1.5 text-xs font-medium text-gray-500 hover:bg-white hover:text-gray-700 transition-colors"
                    >
                      Zwiń listy
                    </button>
                  )}

                  {/* ── Worek: zrealizowane zadania tej kolumny (zawsze widoczny) ── */}
                  {(() => {
                    const bag = bagByColumn[col._id] ?? [];
                    return (
                      <div className="mt-2 border-t border-dashed border-gray-300 pt-2">
                        <button
                          onClick={() => setOpenBags((s) => ({ ...s, [col._id]: !s[col._id] }))}
                          className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-semibold text-gray-500 hover:bg-black/5 transition-colors"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <ShoppingBag className="size-3.5" />
                            Worek ({bag.length})
                          </span>
                          <ChevronRight className={`size-3.5 transition-transform ${openBags[col._id] ? "rotate-90" : ""}`} />
                        </button>
                        {openBags[col._id] && (
                          <div className="mt-1.5 flex flex-col gap-1.5">
                            {bag.length === 0 ? (
                              <div className="py-2 text-center text-[11px] text-gray-400">Brak zrealizowanych zadań</div>
                            ) : (
                              bag.map((task) => (
                                <BagTaskRow
                                  key={task._id}
                                  task={task}
                                  onOpen={() => setOpenTaskId(task._id as Id<"orderTasks">)}
                                />
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })}

          {/* Dodaj Listę */}
          <div className="min-w-[320px] max-w-[320px]">
            {addingList ? (
              <div className="rounded-xl border bg-white p-2.5 shadow-sm ring-1 ring-slate-200">
                <input
                  autoFocus
                  placeholder="Wprowadź tytuł listy..."
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (newListName.trim()) {
                        void createColumn({ title: newListName.trim(), color: "#64748b" });
                        setNewListName("");
                        setAddingList(false);
                      }
                    } else if (e.key === "Escape") {
                      setAddingList(false);
                      setNewListName("");
                    }
                  }}
                  className="w-full rounded bg-slate-50 px-2.5 py-1.5 text-[13px] outline-none border border-slate-200 focus:border-[#4abbc3]"
                />
                <div className="mt-2 flex gap-1.5">
                  <button
                    onClick={() => {
                      if (newListName.trim()) {
                        void createColumn({ title: newListName.trim(), color: "#64748b" });
                        setNewListName("");
                        setAddingList(false);
                      }
                    }}
                    className="rounded bg-[#4abbc3] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#3ca4ab]"
                  >
                    Dodaj listę
                  </button>
                  <button
                    onClick={() => {
                      setAddingList(false);
                      setNewListName("");
                    }}
                    className="rounded px-2 text-xs font-medium text-gray-500 hover:bg-slate-100"
                  >
                    Anuluj
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingList(true)}
                className="flex w-full items-center gap-2 rounded-xl bg-slate-50/50 px-4 py-3 text-[14px] font-medium text-gray-600 hover:bg-slate-100/80 hover:text-gray-800 transition-colors border border-transparent hover:border-slate-200"
              >
                <Plus className="size-4" />
                Dodaj kolejną listę
              </button>
            )}
          </div>
        </div>
        </div>
      </div>
      ))}

      {/* ── Widok Archiwum ── */}
      {view === "archive" && (
        <ArchiveView
          tasks={archivedTasks}
          loading={loading}
          onOpen={(id) => setOpenTaskId(id)}
        />
      )}

      {/* ── Panel szczegółów (wysuwany z prawej) ── */}
      <TaskDrawer taskId={openTaskId} onClose={() => setOpenTaskId(null)} />

      {/* ── Panel dodawania zadania (admin) ── */}
      {canAddTasks && <AddTaskDrawer open={addOpen} onClose={() => setAddOpen(false)} initialTargetType={addDrawerType} initialColumnId={addDrawerColId} />}

      {/* ── Potwierdzenie usunięcia listy ── */}
      {confirmDeleteColId && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={closeDeleteConfirm}
          >
            <div
              className="relative flex w-full max-w-md flex-col rounded-xl bg-white shadow-2xl ring-1 ring-gray-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 p-5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                  <Trash2 className="size-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-gray-900">Usunąć listę?</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Lista{" "}
                    <span className="font-medium text-gray-700">
                      „{taskColumns.find((c) => c._id === confirmDeleteColId)?.title ?? ""}"
                    </span>{" "}
                    zostanie trwale usunięta. Operacji nie można cofnąć.
                  </p>
                  {deleteError && (
                    <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                      {deleteError}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">
                <button
                  onClick={closeDeleteConfirm}
                  disabled={deleting}
                  className="rounded-md px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  Anuluj
                </button>
                <button
                  onClick={() => void confirmDeleteColumn()}
                  disabled={deleting}
                  className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-60"
                >
                  <Trash2 className="size-4" />
                  {deleting ? "Usuwanie…" : "Usuń listę"}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
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
function _DueBadge({ ts, today, tomorrow, done }: { ts: number; today: number; tomorrow: number; done: boolean }) {
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
  const assignees = task.assignees ?? (task.assignedUserId ? [{ id: task.assignedUserId, name: task.assignedUserName, color: task.assignedUserColor }] : []);
  
  if (assignees.length === 0) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-[10.5px] font-medium text-gray-400"
        title="Nieprzypisane"
      >
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

/* ── karta zadania ── */
function TaskCard({
  task,
  showAssignee,
  onOpen,
  onDragStart,
  onDragEnd,
  dragging,
}: {
  task: DashboardTask;
  showAssignee: boolean;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  dragging: boolean;
}) {
  const router = useRouter();
  const updateTask = useMutation(api.orderTasks.update);
  const createCalendarEvent = useMutation(api.calendarEvents.createEvent);

  // Typ zadania (źródło)
  const taskType: TaskType =
    task.source === "general" ? "general" :
    task.source === "opportunity" ? "opportunity" :
    task.source === "complaint" ? "complaint" :
    "order";
  const typeMeta = TASK_TYPE_META[taskType];

  // Link "otwórz" + tytuł kontekstu zależnie od źródła
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

  const [daysInColumnLabel, setDaysInColumnLabel] = useState<string | null>(null);
  const [daysInColumnColor, setDaysInColumnColor] = useState<string>("slate");

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!task.columnChangedAt) {
        setDaysInColumnLabel(null);
        return;
      }
      const diffMs = Date.now() - task.columnChangedAt;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) {
        setDaysInColumnLabel("na liście: dzisiaj");
        setDaysInColumnColor("slate");
      } else if (diffDays === 1) {
        setDaysInColumnLabel("na liście: 1 dzień");
        setDaysInColumnColor("slate");
      } else {
        setDaysInColumnLabel(`na liście: ${diffDays} dni`);
        if (diffDays >= 7) {
          setDaysInColumnColor("red");
        } else if (diffDays >= 3) {
          setDaysInColumnColor("amber");
        } else {
          setDaysInColumnColor("slate");
        }
      }
    }, 0);
    return () => clearTimeout(timer);
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
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={(e) => {
        e.stopPropagation();
        onDragEnd();
      }}
      onClick={onOpen}
      className={`relative overflow-hidden group rounded-lg border shadow-sm transition-all duration-150 hover:shadow-md cursor-grab active:cursor-grabbing ${
        dragging ? "rotate-1 scale-[0.97] opacity-50 shadow-md ring-2 ring-[#4abbc3]" : ""
      }`}
      style={{ 
        padding: `10px 10px 10px ${(singleColor || hasMultipleColors) ? 15 : 10}px`,
        backgroundColor: '#ffffff',
        borderColor: '#4abbc340'
      }}
    >
      {(singleColor || hasMultipleColors) && (
        <div style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 5,
          background: hasMultipleColors ? gradientStr : singleColor,
          zIndex: 1,
        }} />
      )}
      
      {/* kontekst zlecenia + CTA do zlecenia */}
      <div className="mb-1.5 flex items-start justify-between gap-2 relative z-10">
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
              void updateTask({ taskId: task._id as Id<"orderTasks">, status: "done" });
            }}
            title="Oznacz jako zrealizowane"
            className="rounded p-1 text-gray-400 opacity-100 transition-colors hover:bg-green-50 hover:text-green-600"
          >
            <Check className="size-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (task.priority === "high") void updateTask({ taskId: task._id as Id<"orderTasks">, clearPriority: true });
              else void updateTask({ taskId: task._id as Id<"orderTasks">, priority: "high" });
            }}
            title={task.priority === "high" ? "Usuń wysoki priorytet" : "Oznacz jako wysoki priorytet"}
            className={`rounded p-1 transition-colors ${
              task.priority === "high"
                ? "text-red-500 opacity-100 hover:text-red-600"
                : "text-gray-400 opacity-100 hover:text-gray-600"
            }`}
          >
            <Flame className="size-3.5" fill={task.priority === "high" ? "#f97316" : "none"} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const targetDate = task.dueDate ? new Date(task.dueDate) : new Date();
              const start = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 6, 0, 0, 0).getTime();
              const end = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 7, 0, 0, 0).getTime();
              void createCalendarEvent({
                eventTypeId: "wlasne_default_id" as Id<"calendarEventTypes">,
                title: `Wydarzenie: ${task.clientName || task.title}`,
                startDate: start,
                endDate: end,
                isAllDay: false,
                isPrivate: false,
                orderId: task.orderId as Id<"orders"> | undefined,
                clientId: task.clientId as Id<"clients"> | undefined,
                assignedUserIds: task.assignedUserId ? [task.assignedUserId as Id<"users">] : undefined,
              });
              void updateTask({ taskId: task._id as Id<"orderTasks">, addedToCalendar: true });
              toast.success("Dodano wydarzenie własne do kalendarza");
            }}
            title={task.addedToCalendar ? "Dodano do kalendarza" : "Dodaj wydarzenie do kalendarza (Własne)"}
            className={`rounded p-1 transition-colors ${
              task.addedToCalendar
                ? "bg-indigo-50 text-indigo-600 opacity-100 hover:bg-indigo-100"
                : "text-gray-400 opacity-100 hover:bg-indigo-50 hover:text-indigo-600"
            }`}
          >
            <CalendarPlus className="size-3.5" />
          </button>
          {openHref !== "#" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push(openHref);
              }}
              title={typeMeta.openLabel}
              className="rounded p-1 text-gray-400 opacity-100 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              <ExternalLink className="size-3.5" />
            </button>
          )}
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
      {task.labels && task.labels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1 relative z-10">
          {task.labels.map((l) => (
            <span
              key={l.id}
              className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-white tracking-wide shadow-sm"
              style={{ backgroundColor: l.color }}
              title={l.title}
            >
              {l.title}
            </span>
          ))}
        </div>
      )}

      <div className="mb-2 line-clamp-2 text-sm font-medium leading-snug text-gray-800">
        {task.title}
      </div>

      {/* stopka: awatar i czas w kolumnie */}
      {(daysInColumnLabel || showAssignee) && (
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div>
            {daysInColumnLabel && (
              <span 
                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-[10.5px] border ${
                  daysInColumnColor === "red"
                    ? "bg-red-50 text-red-600 border-red-200/50"
                    : daysInColumnColor === "amber"
                    ? "bg-amber-50 text-amber-600 border-amber-200/50"
                    : "bg-slate-50 text-slate-500 border-slate-200/40"
                }`}
                title={`Czas w tej kolumnie: ${daysInColumnLabel}`}
              >
                <svg 
                  className={`size-3 ${
                    daysInColumnColor === "red"
                      ? "text-red-400"
                      : daysInColumnColor === "amber"
                      ? "text-amber-400"
                      : "text-slate-400"
                  }`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor" 
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span className="tabular-nums">{daysInColumnLabel}</span>
              </span>
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

/* ── Wiersz zrealizowanego zadania w Worku kolumny ── */
function BagTaskRow({ task, onOpen }: { task: DashboardTask; onOpen: () => void }) {
  const updateTask = useMutation(api.orderTasks.update);
  return (
    <div
      onClick={onOpen}
      className="group flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 bg-white/70 px-2 py-1.5 transition-colors hover:bg-white"
    >
      <Check className="size-3.5 shrink-0 text-green-500" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-gray-500 line-through">{task.title}</div>
        <div className="truncate text-[10px] text-gray-400">{task.clientName}</div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          void updateTask({ taskId: task._id as Id<"orderTasks">, archived: true });
        }}
        title="Archiwizuj"
        className="shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
      >
        <Archive className="size-3.5" />
      </button>
    </div>
  );
}

/* ── Widok Archiwum: lista zarchiwizowanych zadań ── */
function ArchiveView({
  tasks,
  loading,
  onOpen,
}: {
  tasks: DashboardTask[];
  loading: boolean;
  onOpen: (id: Id<"orderTasks">) => void;
}) {
  const updateTask = useMutation(api.orderTasks.update);

  if (loading) {
    return <div className="py-20 text-center text-sm text-gray-400">Ładowanie…</div>;
  }
  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 py-20 text-center">
        <Archive className="mx-auto mb-3 size-8 text-gray-300" />
        <p className="text-sm text-gray-400">Archiwum jest puste.</p>
      </div>
    );
  }
  return (
    <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {tasks.map((task) => {
        const taskType: TaskType =
          task.source === "general" ? "general" :
          task.source === "opportunity" ? "opportunity" :
          task.source === "complaint" ? "complaint" :
          "order";
        return (
          <div key={task._id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50">
            <TypeBadge type={taskType} />
            <div
              className="min-w-0 flex-1 cursor-pointer"
              onClick={() => onOpen(task._id as Id<"orderTasks">)}
            >
              <div className="truncate text-sm font-medium text-gray-700">{task.title}</div>
              <div className="truncate text-xs text-gray-400">{task.clientName}</div>
            </div>
            <button
              onClick={() => void updateTask({ taskId: task._id as Id<"orderTasks">, archived: false })}
              title="Przywróć z archiwum"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100"
            >
              <ArchiveRestore className="size-3.5" /> Przywróć
            </button>
          </div>
        );
      })}
    </div>
  );
}
