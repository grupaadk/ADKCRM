"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { uColor, uInitials } from "@/lib/userColor";
import SideDrawer from "@/components/SideDrawer";
import { ExternalLink, Trash2, Send, ChevronDown, UserPlus, Check, X, Search, Flame } from "lucide-react";

const STATUSES = [
  { key: "todo" as const, label: "Do zrobienia", accent: "#64748b", bg: "#f8fafc" },
  { key: "in_progress" as const, label: "W trakcie", accent: "#2563eb", bg: "#eff6ff" },
  { key: "done" as const, label: "Gotowe", accent: "#16a34a", bg: "#f0fdf4" },
];
type StatusKey = (typeof STATUSES)[number]["key"];

type AssignUser = { _id: Id<"users">; displayName?: string | null; login?: string | null; color?: string };

function fmtDateTime(ts: number) {
  return new Date(ts).toLocaleString("pl-PL", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function TaskDrawer({
  taskId,
  onClose,
}: {
  taskId: Id<"orderTasks"> | null;
  onClose: () => void;
}) {
  // Zachowaj ostatnie id podczas animacji zamykania, by treść nie znikała
  // (setState w renderze — dozwolony wzorzec, aktualizuje się tylko przy zmianie).
  const [shownId, setShownId] = useState<Id<"orderTasks"> | null>(taskId);
  if (taskId && taskId !== shownId) setShownId(taskId);

  const task = useQuery(api.dashboardTasks.getOne, shownId ? { taskId: shownId } : "skip");
  const comments = useQuery(api.taskComments.listByTask, shownId ? { taskId: shownId } : "skip");
  const me = useQuery(api.users.me);
  const users = (useQuery(api.users.listAssignable) ?? []) as AssignUser[];

  const updateTask = useMutation(api.orderTasks.update);
  const removeTask = useMutation(api.orderTasks.remove);
  const addComment = useMutation(api.taskComments.add);
  const removeComment = useMutation(api.taskComments.remove);

  const router = useRouter();

  const [title, setTitle] = useState("");
  const [titleForId, setTitleForId] = useState<Id<"orderTasks"> | null>(null);
  const [newComment, setNewComment] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const assignRef = useRef<HTMLDivElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Zmienne dla zadań ogólnych (przypisywanie do zlecenia/szansy)
  const isGeneral = task?.source === "general";
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  const [assignType, setAssignType] = useState<"order" | "opportunity">("order");
  const [assignSearch, setAssignSearch] = useState("");

  const ordersData = useQuery(api.orders.listForPicker, isGeneral ? {} : "skip");
  const oppsData = useQuery(api.salesOpportunities.listForPicker, isGeneral ? {} : "skip");

  const filteredOrders = useMemo(() => {
    if (!ordersData) return [];
    if (!assignSearch.trim()) return ordersData;
    const term = assignSearch.toLowerCase();
    return ordersData.filter(o => o.clientName.toLowerCase().includes(term) || (o.customText || "").toLowerCase().includes(term));
  }, [ordersData, assignSearch]);

  const filteredOpps = useMemo(() => {
    if (!oppsData) return [];
    if (!assignSearch.trim()) return oppsData;
    const term = assignSearch.toLowerCase();
    return oppsData.filter(o => o.clientName.toLowerCase().includes(term) || (o.customText || "").toLowerCase().includes(term));
  }, [oppsData, assignSearch]);

  // Reset edytowanego tytułu i potwierdzenia usuwania przy zmianie zadania
  // (setState w renderze — dozwolony wzorzec).
  if (task && task._id !== titleForId) {
    setTitleForId(task._id);
    setTitle(task.title);
    setConfirmDelete(false);
  }

  useEffect(() => {
    if (!assignOpen) return;
    const h = (e: MouseEvent) => {
      if (assignRef.current && !assignRef.current.contains(e.target as Node)) setAssignOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [assignOpen]);

  function saveTitle() {
    if (!shownId || !task) return;
    const t = title.trim();
    if (t && t !== task.title) void updateTask({ taskId: shownId, title: t });
    else setTitle(task.title);
  }

  function setStatus(status: StatusKey) {
    if (shownId) void updateTask({ taskId: shownId, status });
  }

  function setDue(value: string) {
    if (!shownId) return;
    if (value) void updateTask({ taskId: shownId, dueDate: new Date(value).getTime() });
    else void updateTask({ taskId: shownId, clearDueDate: true });
  }

  function setAssignees(ids: Id<"users">[]) {
    if (!shownId) return;
    if (ids.length > 0) void updateTask({ taskId: shownId, assignedUserIds: ids });
    else void updateTask({ taskId: shownId, clearAssignee: true });
  }

  function deleteTask() {
    if (!shownId) return;
    void removeTask({ taskId: shownId });
    setConfirmDelete(false);
    onClose();
  }

  function submitComment() {
    const body = newComment.trim();
    if (!body || !shownId) return;
    void addComment({ taskId: shownId, body });
    setNewComment("");
  }

  const dueStr = task?.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : "";
  const isOpportunity = task?.source === "opportunity";
  const openHref = task
    ? isOpportunity
      ? `/admin/szansa/${task.opportunityId}`
      : `/admin/klient/${task.clientId}/zlecenie/${task.orderId}?tab=szczegoly`
    : "#";
  const openLabel = isOpportunity ? "Otwórz szansę" : "Otwórz zlecenie";
  const contextLabel = isOpportunity ? "Szansa sprzedaży" : "Zlecenie";
  const contextTitle = isOpportunity ? "Szansa sprzedaży" : (task?.orderName ?? "Zlecenie");
  const isAdmin = me?.role === "admin";

  return (
    <SideDrawer
      open={taskId !== null}
      onClose={onClose}
      title="Szczegóły zadania"
      width={480}
      footer={
        task ? (
          confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="flex-1 text-sm font-medium text-gray-700">
                Usunąć zadanie? Tej operacji nie można cofnąć.
              </span>
              <button
                onClick={() => setConfirmDelete(false)}
                className="shrink-0 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Anuluj
              </button>
              <button
                onClick={deleteTask}
                className="flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                <Trash2 className="size-4" /> Usuń
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {openHref !== "#" && (
                <button
                  onClick={() => router.push(openHref)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-md bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                  <ExternalLink className="size-4" /> {openLabel}
                </button>
              )}
              <button
                onClick={() => setConfirmDelete(true)}
                title="Usuń zadanie"
                className="flex shrink-0 items-center justify-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <Trash2 className="size-4" /> Usuń
              </button>
            </div>
          )
        ) : null
      }
    >
      {!task ? (
        <div className="p-6 text-sm text-gray-400">Ładowanie…</div>
      ) : (
        <div className="flex flex-col">
          {/* kontekst zlecenia / szansy */}
          {isGeneral ? (
            <div className="border-b border-gray-100 bg-gray-50/60 px-5 py-4">
              {!showAssignPicker ? (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Zadanie ogólne</div>
                    <div className="text-xs text-gray-500 mt-0.5">Brak powiązania z klientem</div>
                  </div>
                  <button
                    onClick={() => setShowAssignPicker(true)}
                    className="flex shrink-0 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <UserPlus className="size-3.5" /> Przypisz
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Przypisz zadanie do:</div>
                    <button onClick={() => setShowAssignPicker(false)} className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600 transition-colors">
                      <X className="size-3.5" />
                    </button>
                  </div>
                  
                  <div className="flex gap-1.5 mb-3">
                {([
                  { key: "order" as const, label: "Zlecenie" },
                  { key: "opportunity" as const, label: "Szansa sprzedaży" },
                ]).map((t) => (
                  <button
                    key={t.key}
                    onClick={() => { setAssignType(t.key); setAssignSearch(""); }}
                    className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                      assignType === t.key
                        ? "bg-gray-200 text-gray-900"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  placeholder="Szukaj klienta…"
                  className="w-full rounded-md border border-gray-200 py-2 pl-8 pr-3 text-sm outline-none focus:border-gray-400 bg-white"
                />
              </div>

              {assignType === "order" ? (
                <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                  {filteredOrders.length === 0 && <div className="text-xs text-gray-400">Brak zleceń.</div>}
                  {filteredOrders.map(o => (
                    <button
                      key={o._id}
                      onClick={() => updateTask({ taskId: shownId!, orderId: o._id })}
                      className="flex w-full flex-col items-start rounded-md border border-gray-100 bg-white px-3 py-2 text-left hover:border-gray-300 hover:bg-gray-50"
                    >
                      <span className="flex w-full items-center gap-2">
                        <span className="truncate text-[13px] font-medium text-gray-900">{o.clientName}</span>
                        {o.customText && <span className="chip-custom shrink-0">{o.customText}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                  {filteredOpps.length === 0 && <div className="text-xs text-gray-400">Brak szans.</div>}
                  {filteredOpps.map(o => (
                    <button
                      key={o._id}
                      onClick={() => updateTask({ taskId: shownId!, opportunityId: o._id })}
                      className="flex w-full flex-col items-start rounded-md border border-gray-100 bg-white px-3 py-2 text-left hover:border-gray-300 hover:bg-gray-50"
                    >
                      <span className="flex w-full items-center gap-2">
                        <span className="truncate text-[13px] font-medium text-gray-900">{o.clientName}</span>
                        {o.customText && <span className="chip-custom shrink-0">{o.customText}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
                </>
              )}
            </div>
          ) : (
            <div className="border-b border-gray-100 bg-gray-50/60 px-5 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{contextLabel}</div>
              <div className="mt-0.5 text-sm font-semibold text-gray-900">{contextTitle}</div>
              <div className="text-xs text-gray-500">{task.clientName}</div>
              {task.customText && (
                <div className="mt-1.5">
                  <span className="chip-custom">{task.customText}</span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-5 px-5 py-4">
            {/* tytuł */}
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Zadanie
              </label>
              <textarea
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); }
                }}
                rows={2}
                className="w-full resize-none rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400"
              />
            </div>

            {/* status */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Status
              </label>
              <div className="flex gap-1.5">
                {STATUSES.map((s) => {
                  const active = task.status === s.key;
                  return (
                    <button
                      key={s.key}
                      onClick={() => setStatus(s.key)}
                      className="flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors"
                      style={
                        active
                          ? { borderColor: s.accent, background: s.bg, color: s.accent }
                          : { borderColor: "#e5e7eb", background: "#fff", color: "#6b7280" }
                      }
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* priorytet */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Priorytet
              </label>
              <button
                onClick={() => {
                  if (task.priority === "high") void updateTask({ taskId: task._id, clearPriority: true });
                  else void updateTask({ taskId: task._id, priority: "high" });
                }}
                className={`flex items-center justify-center gap-1.5 w-full rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  task.priority === "high"
                    ? "border-orange-500 bg-orange-50 text-orange-600"
                    : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                <Flame className={`size-4 ${task.priority === "high" ? "fill-orange-500 text-orange-500" : ""}`} />
                Wysoki priorytet
              </button>
            </div>

            {/* termin + osoba */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Termin
                </label>
                <input
                  type="date"
                  value={dueStr}
                  onChange={(e) => setDue(e.target.value)}
                  className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-900 outline-none focus:border-gray-400"
                />
              </div>
              <div ref={assignRef} className="relative">
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Przypisane
                </label>
                <button
                  onClick={() => setAssignOpen((v) => !v)}
                  className="flex w-full items-center gap-2 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                >
                  {(() => {
                    const assignees = task.assignees ?? (task.assignedUserId ? [{ id: task.assignedUserId, name: task.assignedUserName, color: task.assignedUserColor }] : []);
                    if (assignees.length === 0) {
                      return (
                        <>
                          <UserPlus className="size-4 shrink-0 text-gray-400" />
                          <span className="flex-1 truncate text-left">Nieprzypisane</span>
                        </>
                      );
                    }
                    if (assignees.length === 1) {
                      const u = assignees[0];
                      return (
                        <>
                          <span
                            className="flex size-5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
                            style={{ background: u.color ?? uColor(u.id) }}
                          >
                            {uInitials(u.name ?? "?")}
                          </span>
                          <span className="flex-1 truncate text-left">{u.name ?? "?"}</span>
                        </>
                      );
                    }
                    return (
                      <>
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[8px] font-bold text-gray-600">
                          {assignees.length}
                        </span>
                        <span className="flex-1 truncate text-left">{assignees.length} osoby</span>
                      </>
                    );
                  })()}
                  <ChevronDown className="size-3.5 shrink-0 text-gray-400" />
                </button>
                {assignOpen && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                    <button
                      onClick={() => { setAssignees([]); setAssignOpen(false); }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
                    >
                      <span className="flex size-5 items-center justify-center rounded-full border border-dashed border-gray-300">
                        <X className="size-3 text-gray-400" />
                      </span>
                      Nie przypisano
                    </button>
                    {users.map((u) => {
                      const name = u.displayName ?? u.login ?? "";
                      const assignees = task.assignees ?? (task.assignedUserId ? [{ id: task.assignedUserId }] : []);
                      const ids = assignees.map(a => a.id);
                      const sel = ids.includes(u._id);
                      return (
                        <button
                          key={u._id}
                          onClick={() => {
                            if (ids.includes(u._id)) {
                              setAssignees(ids.filter(id => id !== u._id));
                            } else {
                              setAssignees([...ids, u._id]);
                            }
                          }}
                          className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs ${sel ? "bg-gray-50 text-gray-900 font-medium" : "text-gray-700 hover:bg-gray-50"}`}
                        >
                          <span
                            className="flex size-5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
                            style={{ background: u.color ?? uColor(u._id) }}
                          >
                            {uInitials(name)}
                          </span>
                          <span className="flex-1 truncate text-left">{name}</span>
                          {sel && <Check className="size-3.5 text-blue-600" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* komentarze */}
          <div className="border-t border-gray-100 px-5 py-4">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Komentarze {comments && comments.length > 0 ? `(${comments.length})` : ""}
            </div>

            <div className="space-y-3">
              {comments === undefined && <div className="text-xs text-gray-400">Ładowanie…</div>}
              {comments && comments.length === 0 && (
                <div className="text-xs text-gray-400">Brak komentarzy. Dodaj pierwszy poniżej.</div>
              )}
              {comments?.map((c) => {
                const canDelete = me && (c.authorId === me._id || isAdmin);
                return (
                  <div key={c._id} className="group flex gap-2.5">
                    <span
                      className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                      style={{ background: c.authorColor ?? uColor(c.authorId) }}
                      title={c.authorName}
                    >
                      {uInitials(c.authorName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-800">{c.authorName}</span>
                        <span className="text-[10.5px] text-gray-400">{fmtDateTime(c.createdAt)}</span>
                        {canDelete && (
                          <button
                            onClick={() => void removeComment({ commentId: c._id })}
                            title="Usuń komentarz"
                            className="ml-auto rounded p-0.5 text-gray-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-snug text-gray-700">
                        {c.body}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* dodaj komentarz */}
            <div className="mt-4 flex items-end gap-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(); }
                }}
                placeholder="Napisz komentarz…"
                rows={2}
                className="flex-1 resize-none rounded-md border border-gray-200 px-3 py-2 text-[13px] text-gray-900 outline-none focus:border-gray-400"
              />
              <button
                onClick={submitComment}
                disabled={!newComment.trim()}
                className="flex size-9 shrink-0 items-center justify-center rounded-md bg-gray-900 text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
                title="Wyślij (Enter)"
              >
                <Send className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </SideDrawer>
  );
}
