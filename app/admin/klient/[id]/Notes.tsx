"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface NotesProps {
  clientId: Id<"clients">;
  orderId?: Id<"orders">;
}

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let h = hash % 360;
  if (h < 0) h += 360;
  return `hsl(${h}, 50%, 45%)`;
}

function userNameColor(user?: { displayName?: string | null; color?: string | null; login?: string | null }) {
  if (user?.color) return user.color;
  const base = user?.displayName ?? user?.login ?? "?";
  return stringToColor(base);
}

function userName(user?: { displayName?: string | null; login?: string | null }) {
  return user?.displayName ?? user?.login ?? "Nieznany";
}

function userInitials(user?: { displayName?: string | null; login?: string | null }) {
  const name = user?.displayName ?? user?.login ?? "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

export default function Notes({ clientId, orderId }: NotesProps) {
  const notesByClient = useQuery(
    api.notes.listByClient,
    orderId ? "skip" : { clientId },
  );
  const notesByOrder = useQuery(
    api.notes.listByOrder,
    orderId ? { orderId } : "skip",
  );
  const notes = orderId ? notesByOrder : notesByClient;
  const allUsers = useQuery(api.users.listForNotes);
  const addNote = useMutation(api.notes.add);
  const removeNote = useMutation(api.notes.remove);

  const userMap = useMemo(() => {
    if (!allUsers) return {};
    const map: Record<string, (typeof allUsers)[number]> = {};
    for (const u of allUsers) {
      if (u.login) map[u.login] = u;
      map[u._id] = u;
    }
    return map;
  }, [allUsers]);

  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSaving(true);
    try {
      await addNote({ clientId, orderId, content });
      setContent("");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(noteId: Id<"clientNotes">) {
    setDeletingId(noteId);
    try {
      await removeNote({ noteId });
    } finally {
      setDeletingId(null);
    }
  }

  const NOTE_TRUNCATE_LENGTH = 120;

  return (
    <div className="space-y-2">
      {/* Compact inline add form */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Dodaj notatke..."
          className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-colors"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              void handleSubmit(e);
            }
          }}
        />
        <button
          type="submit"
          disabled={saving || !content.trim()}
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 p-1.5 text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          title="Dodaj notatke"
        >
          {saving ? (
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          )}
        </button>
      </form>

      {/* Notes list — compact todo-style */}
      {notes === undefined ? (
        <div className="py-4 text-center text-xs text-slate-400">Ladowanie...</div>
      ) : notes.length === 0 ? (
        <div className="py-4 text-center text-xs text-slate-400">
          Brak notatek.
        </div>
      ) : (
        <ul className="space-y-0.5">
          {notes.map((note) => {
            const u = userMap[note.createdBy];
            const isLong = note.content.length > NOTE_TRUNCATE_LENGTH;
            const isExpanded = expandedId === note._id;
            const displayContent = isLong && !isExpanded
              ? note.content.substring(0, NOTE_TRUNCATE_LENGTH) + "..."
              : note.content;

            return (
              <li
                key={note._id}
                className="group flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50"
              >
                {/* User avatar dot */}
                <span
                  className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
                  style={{ background: note.createdByColor ?? userNameColor(u) }}
                  title={userName(u)}
                >
                  {userInitials(u)}
                </span>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm leading-snug text-slate-800 ${isLong ? "cursor-pointer" : ""}`}
                    onClick={isLong ? () => setExpandedId(isExpanded ? null : note._id) : undefined}
                  >
                    {displayContent}
                  </p>
                  <span className="text-[10px] text-slate-400">
                    {userName(u)} · {new Date(note._creationTime).toLocaleString("pl-PL", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {/* Delete button — visible on hover */}
                <button
                  onClick={() => handleDelete(note._id)}
                  disabled={deletingId === note._id}
                  className="mt-0.5 shrink-0 rounded p-1 text-slate-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 disabled:opacity-50"
                  title="Usun notatke"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
