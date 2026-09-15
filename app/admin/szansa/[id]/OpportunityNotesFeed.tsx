"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { MessageSquare } from "lucide-react";

interface OpportunityNotesFeedProps {
  opportunityId: Id<"pendingJotformSubmissions">;
  clientId?: Id<"clients">;
  initialComment?: string;
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

export default function OpportunityNotesFeed({
  opportunityId,
  clientId,
  initialComment,
}: OpportunityNotesFeedProps) {
  const notes = useQuery(api.notes.listByOpportunity, { opportunityId });
  const allUsers = useQuery(api.users.listForNotes);
  const addNote = useMutation(api.notes.add);
  const removeNote = useMutation(api.notes.remove);
  const updateNote = useMutation(api.notes.update);

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
  const [editingNoteId, setEditingNoteId] = useState<Id<"clientNotes"> | null>(null);
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const migratedRef = useRef(false);

  // Automatyczna migracja starego komentarza z JotForm do feedu notatek (jeśli brak notatek i brak jeszcze migracji)
  useEffect(() => {
    if (
      notes !== undefined &&
      notes.length === 0 &&
      initialComment &&
      initialComment.trim() &&
      !migratedRef.current
    ) {
      migratedRef.current = true;
      void addNote({
        opportunityId,
        clientId,
        content: `[Komentarz klienta z zgłoszenia]: ${initialComment.trim()}`,
      });
    }
  }, [notes, initialComment, opportunityId, clientId, addNote]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSaving(true);
    try {
      await addNote({ opportunityId, clientId, content: content.trim() });
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

  async function handleSaveEdit(noteId: Id<"clientNotes">) {
    if (!editContent.trim()) return;
    setSavingEdit(true);
    try {
      await updateNote({ noteId, content: editContent.trim() });
      setEditingNoteId(null);
      setEditContent("");
    } finally {
      setSavingEdit(false);
    }
  }

  const NOTE_TRUNCATE_LENGTH = 150;

  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Nagłówek sekcji */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 4, height: 18, borderRadius: 3, background: "#8b5cf6", flexShrink: 0 }} />
        <MessageSquare size={14} color="#8b5cf6" />
        <span style={{ fontSize: 12.5, fontWeight: 800, color: "var(--text-strong)", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Komentarze / Uwagi klienta (Feed)
        </span>
      </div>

      {/* Formularz dodawania notatki */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <textarea
          ref={(el) => {
            if (el) {
              el.style.height = "auto";
              el.style.height = `${Math.max(38, el.scrollHeight)}px`;
            }
          }}
          rows={1}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.max(38, e.target.scrollHeight)}px`;
          }}
          placeholder="Napisz notatkę lub uwagę..."
          className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-colors overflow-hidden resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSubmit(e);
            }
          }}
        />
        <button
          type="submit"
          disabled={saving || !content.trim()}
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 shrink-0"
          title="Dodaj notatkę"
        >
          {saving ? (
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            "Dodaj"
          )}
        </button>
      </form>

      {/* Lista notatek w formie feedu */}
      {notes === undefined ? (
        <div className="py-4 text-center text-xs text-slate-400">Ładowanie notatek…</div>
      ) : notes.length === 0 ? (
        <div className="py-4 text-center text-xs text-slate-400">
          Brak notatek. Wpisz uwagę lub notatkę powyżej.
        </div>
      ) : (
        <ul className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
          {notes.map((note) => {
            const u = userMap[note.createdBy];
            const isEditing = editingNoteId === note._id;
            const isLong = note.content.length > NOTE_TRUNCATE_LENGTH;
            const isExpanded = expandedId === note._id;
            const displayContent = isLong && !isExpanded
              ? note.content.substring(0, NOTE_TRUNCATE_LENGTH) + "…"
              : note.content;

            return (
              <li
                key={note._id}
                className="group flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 transition-colors hover:bg-slate-100/60"
              >
                {/* User avatar dot */}
                <span
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white shadow-sm"
                  style={{ background: note.createdByColor ?? userNameColor(u) }}
                  title={userName(u)}
                >
                  {userInitials(u)}
                </span>

                {/* Content / Edit form */}
                {isEditing ? (
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <textarea
                      autoFocus
                      rows={2}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full rounded-lg border border-blue-400 bg-white p-2 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void handleSaveEdit(note._id);
                        }
                        if (e.key === "Escape") setEditingNoteId(null);
                      }}
                    />
                    <div className="flex items-center gap-1.5 justify-end">
                      <button
                        type="button"
                        onClick={() => void handleSaveEdit(note._id)}
                        disabled={savingEdit || !editContent.trim()}
                        className="px-2.5 py-1 text-xs font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:opacity-50"
                      >
                        {savingEdit ? "Zapisywanie…" : "Zapisz"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingNoteId(null)}
                        disabled={savingEdit}
                        className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200"
                      >
                        Anuluj
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs leading-relaxed text-slate-800 whitespace-pre-wrap ${isLong ? "cursor-pointer" : ""}`}
                        onClick={isLong ? () => setExpandedId(isExpanded ? null : note._id) : undefined}
                      >
                        {displayContent}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                        <span className="font-semibold text-slate-600">{userName(u)}</span>
                        <span>·</span>
                        <span>
                          {new Date(note._creationTime).toLocaleString("pl-PL", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons (Edit & Delete) — visible on hover */}
                    <div className="mt-0.5 shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNoteId(note._id);
                          setEditContent(note.content);
                        }}
                        className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                        title="Edytuj notatkę"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(note._id)}
                        disabled={deletingId === note._id}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50"
                        title="Usuń notatkę"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
