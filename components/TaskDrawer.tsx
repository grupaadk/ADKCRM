"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { uColor, uInitials } from "@/lib/userColor";
import SideDrawer from "@/components/SideDrawer";
import { ExternalLink, Trash2, Send, ChevronDown, UserPlus, Check, X } from "lucide-react";

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

  // Reset edytowanego tytułu przy zmianie zadania (setState w renderze — dozwolone).
  if (task && task._id !== titleForId) {
    setTitleForId(task._id);
    setTitle(task.title);
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

  function setAssignee(id: Id<"users"> | null) {
    if (!shownId) return;
    if (id) void updateTask({ taskId: shownId, assignedUserId: id });
    else void updateTask({ taskId: shownId, clearAssignee: true });
    setAssignOpen(false);
  }

  function deleteTask() {
    if (!shownId) return;
    if (!window.confirm("Usunąć to zadanie? Tej operacji nie można cofnąć.")) return;
    void removeTask({ taskId: shownId });
    onClose();
  }

  function submitComment() {
    const body = newComment.trim();
    if (!body || !shownId) return;
    void addComment({ taskId: shownId, body });
    setNewComment("");
  }

  const dueStr = task?.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : "";
  const orderHref = task ? `/admin/klient/${task.clientId}/zlecenie/${task.orderId}?tab=szczegoly` : "#";
  const isAdmin = me?.role === "admin";

  return (
    <SideDrawer
      open={taskId !== null}
      onClose={onClose}
      title="Szczegóły zadania"
      width={480}
      footer={
        task ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(orderHref)}
              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              <ExternalLink className="size-4" /> Otwórz zlecenie
            </button>
            <button
              onClick={deleteTask}
              title="Usuń zadanie"
              className="flex shrink-0 items-center justify-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 className="size-4" /> Usuń
            </button>
          </div>
        ) : null
      }
    >
      {!task ? (
        <div className="p-6 text-sm text-gray-400">Ładowanie…</div>
      ) : (
        <div className="flex flex-col">
          {/* kontekst zlecenia */}
          <div className="border-b border-gray-100 bg-gray-50/60 px-5 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Zlecenie</div>
            <div className="mt-0.5 text-sm font-semibold text-gray-900">{task.orderName ?? "Zlecenie"}</div>
            <div className="text-xs text-gray-500">{task.clientName}</div>
            {task.customText && (
              <div className="mt-1.5">
                <span className="chip-custom">{task.customText}</span>
              </div>
            )}
          </div>

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
                  {task.assignedUserId ? (
                    <span
                      className="flex size-5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
                      style={{ background: task.assignedUserColor ?? uColor(task.assignedUserId) }}
                    >
                      {uInitials(task.assignedUserName ?? "?")}
                    </span>
                  ) : (
                    <UserPlus className="size-4 shrink-0 text-gray-400" />
                  )}
                  <span className="flex-1 truncate text-left">{task.assignedUserName ?? "Nieprzypisane"}</span>
                  <ChevronDown className="size-3.5 shrink-0 text-gray-400" />
                </button>
                {assignOpen && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                    <button
                      onClick={() => setAssignee(null)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
                    >
                      <span className="flex size-5 items-center justify-center rounded-full border border-dashed border-gray-300">
                        <X className="size-3 text-gray-400" />
                      </span>
                      Nie przypisano
                    </button>
                    {users.map((u) => {
                      const name = u.displayName ?? u.login ?? "";
                      const sel = task.assignedUserId === u._id;
                      return (
                        <button
                          key={u._id}
                          onClick={() => setAssignee(u._id)}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          <span
                            className="flex size-5 items-center justify-center rounded-full text-[8px] font-bold text-white"
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
