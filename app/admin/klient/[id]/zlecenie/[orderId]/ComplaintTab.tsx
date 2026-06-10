"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import TaskKanban from "@/components/TaskKanban";

type ComplaintTabProps = {
  orderId: Id<"orders">;
  clientId: Id<"clients">;
  complaintStartDate: number | null;
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(ts: number) {
  return new Date(ts).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(startTs: number, endTs: number) {
  const days = Math.floor((endTs - startTs) / (1000 * 60 * 60 * 24));
  if (days === 0) return "< 1 dzień";
  if (days === 1) return "1 dzień";
  return `${days} dni`;
}

export default function ComplaintTab({ orderId, clientId, complaintStartDate }: ComplaintTabProps) {
  const me = useQuery(api.users.me);
  const complaint = useQuery(api.complaints.getByOrderId, { orderId });

  const createComplaint = useMutation(api.complaints.create);
  const updateStatus = useMutation(api.complaints.updateStatus);
  const addEntry = useMutation(api.complaints.addEntry);
  const toggleEntry = useMutation(api.complaints.toggleEntry);
  const deleteEntry = useMutation(api.complaints.deleteEntry);

  const [creating, setCreating] = useState(false);
  const [newText, setNewText] = useState("");
  const [adding, setAdding] = useState(false);

  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [complaint?.entries?.length]);

  if (complaint === undefined) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-slate-400">
        Ładowanie...
      </div>
    );
  }

  async function handleCreate() {
    setCreating(true);
    try {
      await createComplaint({
        orderId,
        clientId,
        startDate: complaintStartDate ?? Date.now(),
        createdBy: me?.displayName ?? me?.login ?? "unknown",
      });
    } finally {
      setCreating(false);
    }
  }

  async function handleStatusToggle() {
    if (!complaint) return;
    const newStatus = complaint.status === "w_toku" ? "zakonczona" : "w_toku";
    await updateStatus({ complaintId: complaint._id, status: newStatus });
  }

  async function handleAdd() {
    if (!complaint || !newText.trim()) return;
    setAdding(true);
    try {
      await addEntry({
        complaintId: complaint._id,
        text: newText.trim(),
        createdBy: me?.displayName ?? me?.login ?? "unknown",
        type: "note",
      });
      setNewText("");
    } finally {
      setAdding(false);
    }
  }

  if (!complaint) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50">
          <svg className="h-8 w-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-700">Reklamacja nie została jeszcze zarejestrowana</p>
          <p className="mt-1 text-sm text-slate-400">Kliknij poniżej, aby otworzyć sprawę reklamacyjną</p>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="rounded-xl bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700 disabled:opacity-50"
        >
          {creating ? "Tworzenie..." : "Zgłoś reklamację"}
        </button>
      </div>
    );
  }

  const isCompleted = complaint.status === "zakonczona";
  const now = Date.now();
  const durationDays = formatDuration(complaint.startDate, isCompleted ? (complaint.endDate ?? now) : now);
  const entries = complaint.entries ?? [];

  // Legacy data — stare notatki i zadania (jeśli istnieją)
  const legacyNotes = complaint.notes ?? [];
  const legacyTodos = complaint.todos ?? [];
  const hasLegacy = legacyNotes.length > 0 || legacyTodos.length > 0 || !!complaint.description;

  return (
    <div className="space-y-6">
      {/* Lista zadań — kanban */}
      <TaskKanban complaintId={complaint._id} />

      {/* Status + czas */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Status reklamacji</h2>
          <button
            onClick={handleStatusToggle}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors ${
              isCompleted
                ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            {isCompleted ? "Wznów reklamację" : "Oznacz jako zakończoną"}
          </button>
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-100">
          <div className="px-6 py-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                isCompleted ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isCompleted ? "bg-green-500" : "bg-orange-500"}`} />
                {isCompleted ? "Zakończono" : "W toku"}
              </span>
            </div>
          </div>
          <div className="px-6 py-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Zgłoszono</div>
            <div className="mt-1.5 text-sm font-semibold text-slate-700">{formatDate(complaint.startDate)}</div>
          </div>
          <div className="px-6 py-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {isCompleted ? "Czas realizacji" : "Trwa już"}
            </div>
            <div className="mt-1.5 text-sm font-semibold text-slate-700">{durationDays}</div>
            {isCompleted && complaint.endDate && (
              <div className="mt-0.5 text-xs text-slate-400">Zakończono: {formatDate(complaint.endDate)}</div>
            )}
          </div>
        </div>
      </div>

      {/* Notatki i zadania — unified feed */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            Notatki
          </h2>
        </div>

        <div className="flex flex-col gap-4 p-6">
          {/* Legacy data */}
          {hasLegacy && (
            <div className="space-y-2">
              {complaint.description && (
                <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-500">Poprzedni opis</div>
                  <p className="text-sm text-amber-800 whitespace-pre-wrap">{complaint.description}</p>
                </div>
              )}
              {legacyNotes.map((note) => (
                <div key={note.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="mb-1 text-xs text-slate-400">{formatDateTime(note.createdAt)}</div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.text}</p>
                </div>
              ))}
              {legacyTodos.map((todo) => (
                <div key={todo.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
                    todo.completed ? "border-green-500 bg-green-500" : "border-slate-300"
                  }`}>
                    {todo.completed && (
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className={`text-sm ${todo.completed ? "text-slate-400 line-through" : "text-slate-700"}`}>
                    {todo.text}
                  </span>
                </div>
              ))}
              {entries.length > 0 && (
                <div className="flex items-center gap-3 py-1">
                  <div className="h-px flex-1 bg-slate-100" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Nowe wpisy</span>
                  <div className="h-px flex-1 bg-slate-100" />
                </div>
              )}
            </div>
          )}

          {/* Feed */}
          {entries.length === 0 && !hasLegacy ? (
            <p className="py-6 text-center text-sm text-slate-400">
              Brak notatek. Dodaj pierwszą notatkę poniżej.
            </p>
          ) : (
            <div className="max-h-[28rem] overflow-y-auto space-y-2 pr-1">
              {entries.map((entry) => (
                <div key={entry.id} className="group flex items-start gap-3">
                  {/* Checkbox dla todo */}
                  {entry.type === "todo" ? (
                    <button
                      onClick={() => toggleEntry({ complaintId: complaint._id, entryId: entry.id })}
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                        entry.completed
                          ? "border-green-500 bg-green-500 text-white"
                          : "border-slate-300 bg-white hover:border-slate-400"
                      }`}
                    >
                      {entry.completed && (
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ) : (
                    <div className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                  )}

                  {/* Treść */}
                  <div className="flex-1 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-400">{formatDateTime(entry.createdAt)}</span>
                      <button
                        onClick={() => deleteEntry({ complaintId: complaint._id, entryId: entry.id })}
                        className="opacity-0 group-hover:opacity-100 text-slate-300 transition-opacity hover:text-red-500"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <p className={`text-sm whitespace-pre-wrap ${
                      entry.type === "todo" && entry.completed
                        ? "text-slate-400 line-through"
                        : "text-slate-700"
                    }`}>
                      {entry.text}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={listEndRef} />
            </div>
          )}

          {/* Input */}
          <div className="border-t border-slate-100 pt-4">
            <div className="flex gap-2">
              <textarea
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                placeholder="Dodaj notatkę... (Enter aby zapisać)"
                rows={2}
                className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <button
                onClick={handleAdd}
                disabled={!newText.trim() || adding}
                className="self-end rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-40"
              >
                Dodaj
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
