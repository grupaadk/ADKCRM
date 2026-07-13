"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { createPortal } from "react-dom";
import ComplaintPhotoSection from "@/app/admin/klient/[id]/zlecenie/[orderId]/ComplaintPhotoSection";

type Status = "nowa" | "w_toku" | "rozwiazana" | "zamknieta";

const STATUS_LABELS: Record<Status, string> = {
  nowa: "Nowa",
  w_toku: "W toku",
  rozwiazana: "Rozwiązana",
  zamknieta: "Zamknięta",
};

const STATUS_COLORS: Record<Status, { bg: string; color: string; border: string }> = {
  nowa: { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  w_toku: { bg: "#fffbeb", color: "#b45309", border: "#fde68a" },
  rozwiazana: { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
  zamknieta: { bg: "#f8fafc", color: "#64748b", border: "#e2e8f0" },
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

type Props = {
  complaintId: Id<"complaints">;
  onClose: () => void;
};

export default function ComplaintDetailPanel({ complaintId, onClose }: Props) {
  const [visible, setVisible] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);
  const notesEndRef = useRef<HTMLDivElement>(null);

  const complaint = useQuery(api.complaints.getById, { complaintId });
  const me = useQuery(api.users.me);
  const users = useQuery(api.users.listAllActive);
  const orders = useQuery(api.orders.listForPicker);

  const updateStatus = useMutation(api.complaints.updateStatus);
  const updateDetails = useMutation(api.complaints.updateDetails);
  const deleteComplaint = useMutation(api.complaints.deleteComplaint);
  const addNote = useMutation(api.complaints.addNote);
  const deleteNote = useMutation(api.complaints.deleteNote);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      setTimeout(() => {
        if (!document.querySelector("[data-complaint-panel]")) {
          document.body.style.overflow = "";
        }
      }, 0);
    };
  }, []);

  useEffect(() => {
    notesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [complaint?.notes?.length]);

  const handleAddNote = useCallback(async () => {
    const text = newNote.trim();
    if (!text || !complaint) return;
    setAddingNote(true);
    try {
      await addNote({
        complaintId,
        text,
        createdBy: me?.displayName ?? me?.login ?? "Nieznany",
      });
      setNewNote("");
    } finally {
      setAddingNote(false);
    }
  }, [newNote, complaint, addNote, complaintId, me]);

  const panelStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    right: 0,
    bottom: 0,
    width: "520px",
    maxWidth: "100vw",
    zIndex: 600,
    background: "var(--panel, #fff)",
    borderLeft: "1px solid var(--line)",
    display: "flex",
    flexDirection: "column",
    boxShadow: "-8px 0 40px rgba(0,0,0,0.15)",
    transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    transform: visible ? "translateX(0)" : "translateX(100%)",
  };

  const handleDelete = async () => {
    if (window.confirm("Czy na pewno chcesz usunąć tę reklamację? Tej operacji nie można cofnąć.")) {
      await deleteComplaint({ complaintId });
      onClose();
    }
  };

  if (complaint === undefined) {
    return createPortal(
      <div style={panelStyle} data-complaint-panel="true">
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 13, color: "var(--text-mute)" }}>Ładowanie…</span>
        </div>
      </div>,
      document.body,
    );
  }

  if (!complaint) return null;

  const status = complaint.status as Status;
  const statusColors = STATUS_COLORS[status] ?? STATUS_COLORS.nowa;
  const notes = [
    ...(complaint.notes ?? []),
    ...(complaint.entries ?? []).filter((e) => e.type === "note").map((e) => ({
      id: e.id,
      text: e.text,
      createdAt: e.createdAt,
      createdBy: e.createdBy,
    })),
  ].sort((a, b) => a.createdAt - b.createdAt);

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 599,
          background: "rgba(0,0,0,0.2)",
        }}
      />
      <div style={panelStyle} data-complaint-panel="true">
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid var(--line)",
            flexShrink: 0,
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-strong)" }}>
              Reklamacja
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 20,
                background: statusColors.bg,
                color: statusColors.color,
                border: `1px solid ${statusColors.border}`,
              }}
            >
              {STATUS_LABELS[status]}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-mute)",
              padding: 4,
              display: "flex",
              borderRadius: 4,
            }}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 0 }}>
          {/* Meta info */}
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Date */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11.5, color: "var(--text-mute)", width: 120, flexShrink: 0 }}>Data reklamacji</span>
              <span style={{ fontSize: 12.5, color: "var(--text)", fontWeight: 500 }}>
                {formatDate(complaint.startDate)}
              </span>
            </div>
            {/* Service Date */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11.5, color: "var(--text-mute)", width: 120, flexShrink: 0 }}>Data serwisu</span>
              <input
                type="date"
                value={complaint.serviceDate ? new Date(complaint.serviceDate).toISOString().slice(0, 10) : ""}
                onChange={(e) => {
                  const val = e.target.value;
                  updateDetails({
                    complaintId,
                    serviceDate: val ? new Date(val).getTime() : undefined,
                  });
                }}
                style={{
                  fontSize: 12,
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "1px solid var(--line)",
                  background: "var(--panel-2)",
                  color: "var(--text)",
                  fontFamily: "inherit",
                }}
              />
              {complaint.serviceDate && (
                <button
                  type="button"
                  onClick={() => updateDetails({ complaintId, serviceDate: undefined })}
                  title="Wyczyść datę serwisu"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-mute)",
                    fontSize: 11,
                    padding: "2px 4px",
                  }}
                >
                  ✕
                </button>
              )}
            </div>
            {/* Status selector */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11.5, color: "var(--text-mute)", width: 120, flexShrink: 0 }}>Status</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(Object.keys(STATUS_LABELS) as Status[]).map((s) => {
                  const isActive = complaint.status === s;
                  const colors = STATUS_COLORS[s];
                  return (
                    <button
                      key={s}
                      onClick={() => updateStatus({ complaintId, status: s })}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "4px 10px",
                        borderRadius: 20,
                        border: `1px solid ${isActive ? colors.border : "var(--line)"}`,
                        background: isActive ? colors.bg : "var(--panel-2)",
                        color: isActive ? colors.color : "var(--text-mute)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Order */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11.5, color: "var(--text-mute)", width: 120, flexShrink: 0 }}>Zlecenie</span>
              <select
                value={complaint.orderId ?? ""}
                onChange={(e) => {
                  const val = e.target.value as Id<"orders"> | "";
                  updateDetails({ complaintId, orderId: val || undefined });
                }}
                style={{
                  fontSize: 12,
                  padding: "3px 8px",
                  borderRadius: 6,
                  border: "1px solid var(--line)",
                  background: "var(--panel-2)",
                  color: "var(--text)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  flex: 1,
                }}
              >
                <option value="">— Brak zlecenia —</option>
                {orders?.map((o) => (
                  <option key={o._id} value={o._id}>
                    {o.name ?? o.customText ?? o._id} — {o.clientName}
                  </option>
                ))}
              </select>
              {complaint.orderId && (
                <a
                  href={`/admin/klient/${complaint.clientId}/zlecenie/${complaint.orderId}`}
                  target="_blank"
                  rel="noreferrer"
                  title="Przejdź do zlecenia"
                  style={{ color: "var(--accent)", fontSize: 12, textDecoration: "none", whiteSpace: "nowrap" }}
                >
                  → Otwórz
                </a>
              )}
            </div>
            {/* Assigned to */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11.5, color: "var(--text-mute)", width: 120, flexShrink: 0 }}>Przypisany do</span>
              <select
                value={complaint.assignedTo ?? ""}
                onChange={(e) =>
                  updateDetails({ complaintId, assignedTo: e.target.value || undefined })
                }
                style={{
                  fontSize: 12,
                  padding: "3px 8px",
                  borderRadius: 6,
                  border: "1px solid var(--line)",
                  background: "var(--panel-2)",
                  color: "var(--text)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  flex: 1,
                }}
              >
                <option value="">— Nieprzypisany —</option>
                {users?.map((u) => (
                  <option key={u._id} value={u.displayName ?? u.login ?? ""}>
                    {u.displayName ?? u.login}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Uwagi klienta */}
          <ComplaintSection title="Uwagi klienta">
            <EditableTextArea
              value={complaint.clientDescription ?? ""}
              placeholder="Wpisz uwagi zgłoszone przez klienta…"
              onSave={(val) => updateDetails({ complaintId, clientDescription: val })}
            />
          </ComplaintSection>

          {/* Zdjęcia */}
          <ComplaintSection title="Zdjęcia">
            <ComplaintPhotoSection
              clientId={complaint.clientId}
              orderId={complaint.orderId}
              complaintId={complaintId}
              complaintFolderId={complaint.complaintFolderId}
            />
          </ComplaintSection>

          {/* Notatki wewnętrzne */}
          <ComplaintSection title="Notatki wewnętrzne">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {notes.length === 0 && (
                <p style={{ fontSize: 12, color: "var(--text-mute)", margin: 0 }}>Brak notatek.</p>
              )}
              {notes.map((note) => (
                <div
                  key={note.id}
                  style={{
                    display: "flex",
                    gap: 8,
                    padding: "8px 10px",
                    background: "var(--panel-2)",
                    borderRadius: 6,
                    border: "1px solid var(--line)",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 12.5, color: "var(--text)", whiteSpace: "pre-wrap" }}>
                      {note.text}
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-mute)" }}>
                      {note.createdBy} · {formatDateTime(note.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteNote({ complaintId, noteId: note.id })}
                    title="Usuń notatkę"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#cbd5e1",
                      padding: 0,
                      alignSelf: "flex-start",
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#cbd5e1"; }}
                  >
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              <div ref={notesEndRef} />
              {/* Add note */}
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <textarea
                  ref={noteInputRef}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Dodaj notatkę wewnętrzną…"
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      void handleAddNote();
                    }
                  }}
                  style={{
                    flex: 1,
                    fontSize: 12.5,
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--line)",
                    background: "var(--panel-2)",
                    color: "var(--text)",
                    fontFamily: "inherit",
                    resize: "none",
                    outline: "none",
                  }}
                />
                <button
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || addingNote}
                  className="btn"
                  style={{ alignSelf: "flex-end", fontSize: 11, padding: "6px 12px" }}
                >
                  {addingNote ? "…" : "Dodaj"}
                </button>
              </div>
              <p style={{ margin: 0, fontSize: 10.5, color: "var(--text-mute)" }}>Ctrl+Enter aby zapisać</p>
            </div>
          </ComplaintSection>
          
          <div style={{ padding: "16px", marginTop: "auto" }}>
            <button
              onClick={handleDelete}
              style={{
                width: "100%",
                padding: "10px",
                backgroundColor: "#fee2e2",
                color: "#dc2626",
                border: "1px solid #fecaca",
                borderRadius: "8px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "background-color 0.2s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#fecaca")}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#fee2e2")}
            >
              Usuń reklamację
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

function ComplaintSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
      <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-mute)" }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function EditableTextArea({
  value,
  placeholder,
  onSave,
}: {
  value: string;
  placeholder: string;
  onSave: (val: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (!editing) setDraft(value);
  }

  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(value); setEditing(true); }}
        style={{
          display: "block",
          width: "100%",
          textAlign: "left",
          background: "none",
          border: "1px dashed var(--line)",
          borderRadius: 6,
          padding: "7px 10px",
          cursor: "text",
          fontSize: 12.5,
          color: value ? "var(--text)" : "var(--text-mute)",
          fontFamily: "inherit",
          minHeight: 36,
          whiteSpace: "pre-wrap",
        }}
      >
        {value || placeholder}
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={4}
        onKeyDown={(e) => {
          if (e.key === "Escape") { setEditing(false); setDraft(value); }
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            onSave(draft);
            setEditing(false);
          }
        }}
        style={{
          fontSize: 12.5,
          padding: "7px 10px",
          borderRadius: 6,
          border: "1px solid var(--accent)",
          background: "var(--panel-2)",
          color: "var(--text)",
          fontFamily: "inherit",
          resize: "vertical",
          outline: "none",
        }}
      />
      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={() => { onSave(draft); setEditing(false); }}
          className="btn"
          style={{ fontSize: 11 }}
        >
          Zapisz
        </button>
        <button
          onClick={() => { setEditing(false); setDraft(value); }}
          style={{
            background: "none",
            border: "1px solid var(--line)",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 11,
            padding: "4px 10px",
            color: "var(--text-mute)",
            fontFamily: "inherit",
          }}
        >
          Anuluj
        </button>
        <span style={{ fontSize: 10.5, color: "var(--text-mute)", alignSelf: "center" }}>Ctrl+Enter aby zapisać</span>
      </div>
    </div>
  );
}
