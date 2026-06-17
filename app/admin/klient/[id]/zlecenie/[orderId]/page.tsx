"use client";

import type { ReactNode } from "react";
import { use, useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import DriveFolderButton from "@/components/DriveFolderButton";
import { useRouter, useSearchParams } from "next/navigation";
import DocumentCheckboxes from "../../DocumentCheckboxes";
import OrderLineItems from "../../OrderLineItems";
import { useStatusLabels, useStatuses } from "@/components/StatusLabelsContext";
import { deriveStatusStyle } from "@/lib/statuses";
import ComplaintTab from "./ComplaintTab";
import OrderDriveBrowser from "./OrderDriveBrowser";
import TaskDrawer from "@/components/TaskDrawer";
import CreateOrderTaskDrawer from "@/components/CreateOrderTaskDrawer";
import InvestmentLocation from "../../InvestmentLocation";
import Notes from "../../Notes";
import ReminderModal from "@/app/admin/faktury/ReminderModal";
import {
  Table,
  TableBody,
  TableCell,
  TableFoot,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";

const KIND_LABELS: Record<string, string> = {
  vat: "Faktura VAT",
  advance: "Faktura zaliczkowa",
  final: "Faktura końcowa",
  estimate: "Wycena",
  proforma: "Proforma",
  correction: "Korekta",
};

const KIND_VARIANTS: Record<string, string> = {
  vat: "default",
  advance: "purple",
  final: "teal",
  estimate: "amber",
  proforma: "neutral",
  correction: "orange",
};

const STATUS_LABELS: Record<string, string> = {
  issued: "Wystawiona",
  sent: "Wysłana",
  paid: "Zapłacona",
  partially_paid: "Częściowo zapłacona",
  rejected: "Odrzucona",
  draft: "Szkic",
};

const STATUS_VARIANTS: Record<string, string> = {
  issued: "neutral",
  sent: "default",
  paid: "success",
  partially_paid: "warning",
  rejected: "error",
  draft: "amber",
};

type CachedInvoice = {
  _id: Id<"fakturowniaInvoicesCache">;
  remoteId: string;
  number?: string;
  kind: string;
  status?: string;
  buyerName?: string;
  issueDate?: string;
  netAmount?: number;
  grossAmount?: number;
  currency?: string;
  orderId?: Id<"orders">;
};



type Tab = "szczegoly" | "wycena" | "reklamacja" | "notatki";

function getProjectFileLinks(projectFiles: string | undefined) {
  if (!projectFiles) return [];
  return projectFiles
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function getFileName(url: string, index: number) {
  try {
    const pathname = new URL(url).pathname;
    return pathname.split("/").filter(Boolean).at(-1) || `Zalacznik ${index + 1}`;
  } catch {
    return `Zalacznik ${index + 1}`;
  }
}

// Ikona usługi dobierana po nazwie (okna/drzwi/brama/...). Domyślnie — tag.
function ServiceIcon({ name, size = 15 }: { name: string; size?: number }) {
  const n = name.toLowerCase();
  let path: string;
  if (n.includes("okn")) {
    path = "M4 4h16v16H4zM12 4v16M4 12h16";
  } else if (n.includes("drzw")) {
    path = "M6 21V4a1 1 0 011-1h8a1 1 0 011 1v17M5 21h14M13.5 12h.01";
  } else if (n.includes("bram")) {
    path = "M4 21V6a2 2 0 012-2h12a2 2 0 012 2v15M4 21h16M4 9.5h16M4 13.5h16M4 17.5h16";
  } else if (n.includes("taras") || n.includes("zabud")) {
    path = "M3 21h18M5 21V10l7-5 7 5v11M9.5 21v-5h5v5";
  } else if (n.includes("alumin") || n.includes("konstr")) {
    path = "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z";
  } else if (n.includes("ogrodz")) {
    path = "M3 13h18M3 17h18M6 21V7l1.5-2L9 7v14M15 21V7l1.5-2L18 7v14";
  } else if (
    n.includes("słoneczn") || n.includes("sloneczn") ||
    n.includes("rolet") || n.includes("przeciw")
  ) {
    path = "M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4M12 8a4 4 0 100 8 4 4 0 000-8z";
  } else {
    path = "M9.6 3.6 3.6 9.6a2 2 0 0 0 0 2.8l8 8a2 2 0 0 0 2.8 0l6-6a2 2 0 0 0 0-2.8l-8-8A2 2 0 0 0 11 3H5a2 2 0 0 0-2 2v6M7.5 7.5h.01";
  }
  return (
    <svg
      width={size}
      height={size}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

function SectionCard({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="panel" style={{ overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <span className="up mute">{title}</span>
        {action}
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </section>
  );
}

function CollapsibleSection({
  title,
  children,
  badge,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  badge?: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="panel" style={{ overflow: "hidden" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          width: "100%",
          borderBottom: open ? "1px solid var(--line)" : "none",
          background: "none",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <span className="up mute">{title}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {badge}
          <svg
            style={{
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform 0.2s",
              color: "var(--text-mute)",
            }}
            width="14"
            height="14"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && <div style={{ padding: 16 }}>{children}</div>}
    </section>
  );
}


const KANBAN_COLS = [
  {
    key: "todo" as const,
    label: "Do zrobienia",
    accent: "#64748b",
    headerBg: "#f8fafc",
    colBg: "#f8fafc",
    border: "#e2e8f0",
  },
  {
    key: "in_progress" as const,
    label: "W trakcie",
    accent: "#2563eb",
    headerBg: "#eff6ff",
    colBg: "#f5f9ff",
    border: "#bfdbfe",
  },
  {
    key: "done" as const,
    label: "Gotowe",
    accent: "#16a34a",
    headerBg: "#f0fdf4",
    colBg: "#f7fdf9",
    border: "#bbf7d0",
  },
];

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

type AssignableUser = { _id: Id<"users">; displayName?: string | null; login: string };

function UserPickerDropdown({
  value,
  onChange,
  users,
  compact = false,
  currentUserId,
}: {
  value: string;
  onChange: (id: string) => void;
  users: AssignableUser[];
  compact?: boolean;
  currentUserId?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const sel = users.find((u) => u._id === value);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const selName = sel ? (sel.displayName ?? sel.login) : null;

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={compact ? (selName ?? "Przypisz osobę") : undefined}
        style={compact ? {
          display: "flex", alignItems: "center",
          background: "none", border: "none", cursor: "pointer",
          padding: 0, fontFamily: "inherit",
        } : {
          display: "flex", alignItems: "center", gap: 6,
          padding: "3px 8px 3px 6px",
          background: "var(--panel-2)", border: "1px solid var(--line)",
          borderRadius: 6, cursor: "pointer",
          fontSize: 11.5, color: sel ? "var(--text)" : "var(--text-mute)",
          fontFamily: "inherit", minWidth: 140,
        }}
      >
        {compact ? (
          sel ? (
            <span style={{
              fontSize: 10.5, color: "var(--text-mute)",
              background: "var(--panel-2)", border: "1px solid var(--line)",
              borderRadius: 4, padding: "1px 6px",
              whiteSpace: "nowrap", maxWidth: 90,
              overflow: "hidden", textOverflow: "ellipsis", display: "block",
            }}>
              {selName}
            </span>
          ) : (
            <span style={{
              fontSize: 10.5, color: "var(--text-mute)", opacity: 0.5,
              border: "1px dashed var(--line)",
              borderRadius: 4, padding: "1px 6px",
            }}>
              +osoba
            </span>
          )
        ) : (
          <>
            <div style={{
              width: 20, height: 20, borderRadius: "50%",
              background: sel ? uColor(sel._id) : "var(--line)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 8.5, fontWeight: 700, color: sel ? "#fff" : "var(--text-mute)", flexShrink: 0,
            }}>
              {sel ? uInitials(selName!) : (
                <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              )}
            </div>
            <span style={{ flex: 1, textAlign: "left" }}>{selName ?? "Przypisz osobę"}</span>
            <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ opacity: 0.4, flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0,
          zIndex: 300,
          background: "var(--panel)", border: "1px solid var(--line)",
          borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
          minWidth: 180, overflow: "hidden", padding: "4px 0",
        }}>
          <button type="button" onClick={() => { onChange(""); setOpen(false); }}
            style={{
              display: "flex", alignItems: "center", gap: 9,
              width: "100%", padding: "7px 12px",
              background: !value ? "var(--panel-2)" : "none",
              border: "none", cursor: "pointer",
              fontSize: 12.5, color: "var(--text-mute)",
              fontFamily: "inherit", textAlign: "left",
            }}
          >
            <div style={{
              width: 22, height: 22, borderRadius: "50%",
              border: "1.5px dashed var(--line)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            Nie przypisano
          </button>
          <div style={{ height: 1, background: "var(--line)", margin: "2px 8px" }} />
          {users.map((u) => {
            const name = u.displayName ?? u.login;
            const isMe = currentUserId && u._id === currentUserId;
            return (
              <button key={u._id} type="button"
                onClick={() => { onChange(u._id); setOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 9,
                  width: "100%", padding: "7px 12px",
                  background: value === u._id ? "var(--panel-2)" : "none",
                  border: "none", cursor: "pointer",
                  fontSize: 12.5, color: "var(--text)",
                  fontFamily: "inherit", textAlign: "left",
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: "50%",
                  background: uColor(u._id),
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 700, color: "#fff", flexShrink: 0,
                }}>
                  {uInitials(name)}
                </div>
                <span style={{ flex: 1 }}>{name}</span>
                {isMe && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#2563eb", background: "#eff6ff", borderRadius: 3, padding: "1px 5px", flexShrink: 0 }}>Ty</span>
                )}
                {value === u._id && (
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: "#2563eb", flexShrink: 0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

type KanbanTask = {
  _id: Id<"orderTasks">;
  title: string;
  status: "todo" | "in_progress" | "done";
  dueDate?: number;
  assignedUserId?: Id<"users">;
  assignedUserName?: string | null;
};

function TaskCard({
  task,
  colKey,
  colIdx,
  users,
  now,
  currentUserId,
  onMove,
  onRemove,
  onUpdate,
  onOpenDrawer,
}: {
  task: KanbanTask;
  colKey: "todo" | "in_progress" | "done";
  colIdx: number;
  users: AssignableUser[];
  now: number;
  currentUserId?: string;
  onMove: (dir: "prev" | "next") => void;
  onRemove: () => void;
  onUpdate: (args: {
    title?: string;
    assignedUserId?: Id<"users">;
    clearAssignee?: boolean;
    dueDate?: number;
    clearDueDate?: boolean;
  }) => void;
  onOpenDrawer: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editingDate, setEditingDate] = useState(false);

  const isOverdue = task.dueDate && task.dueDate < now && task.status !== "done";

  function saveTitle() {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== task.title) onUpdate({ title: trimmed });
    else setEditTitle(task.title);
    setEditingTitle(false);
  }

  function handleAssigneeChange(id: string) {
    if (id) onUpdate({ assignedUserId: id as Id<"users"> });
    else onUpdate({ clearAssignee: true });
  }

  const dueDateStr = task.dueDate
    ? new Date(task.dueDate).toISOString().slice(0, 10)
    : "";

  return (
    <div
      draggable={!editingTitle && !editingDate}
      onDragStart={(e) => {
        if (editingTitle || editingDate) { e.preventDefault(); return; }
        e.dataTransfer.setData("taskId", task._id);
        e.dataTransfer.setData("fromCol", colKey);
        e.dataTransfer.effectAllowed = "move";
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => {
        if (editingTitle || editingDate) return;
        onOpenDrawer();
      }}
      style={{
        background: "var(--panel)",
        borderRadius: 7,
        border: "1px solid var(--line)",
        padding: "9px 10px 8px",
        boxShadow: hovered && !editingTitle ? "0 2px 8px rgba(0,0,0,0.08)" : "0 1px 2px rgba(0,0,0,0.04)",
        cursor: editingTitle ? "default" : "pointer",
        transition: "box-shadow 0.12s",
        userSelect: "none",
      }}
    >
      {/* Title */}
      {editingTitle ? (
        <textarea
          autoFocus
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveTitle(); }
            if (e.key === "Escape") { setEditTitle(task.title); setEditingTitle(false); }
          }}
          rows={2}
          style={{
            width: "100%", resize: "none",
            border: "none", background: "transparent",
            fontSize: 12.5, fontFamily: "inherit", outline: "none",
            color: "var(--text)", lineHeight: 1.4, padding: 0,
            marginBottom: 6, cursor: "text", userSelect: "text",
          }}
        />
      ) : (
        <p
          onClick={(e) => { e.stopPropagation(); setEditTitle(task.title); setEditingTitle(true); }}
          title="Kliknij aby edytować tytuł"
          style={{
            fontSize: 12.5, fontWeight: 500, margin: "0 0 7px",
            color: task.status === "done" ? "var(--text-mute)" : "var(--text)",
            textDecoration: task.status === "done" ? "line-through" : "none",
            lineHeight: 1.4, cursor: "text",
          }}
        >
          {task.title}
        </p>
      )}

      {/* Footer: meta + actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", minHeight: 22 }}>
        {/* Date badge / editor */}
        {editingDate ? (
          <input
            type="date"
            autoFocus
            defaultValue={dueDateStr}
            onBlur={(e) => {
              const v = e.target.value;
              if (v) onUpdate({ dueDate: new Date(v).getTime() });
              else if (task.dueDate) onUpdate({ clearDueDate: true });
              setEditingDate(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setEditingDate(false);
            }}
            style={{
              fontSize: 11, border: "1px solid var(--line)",
              borderRadius: 4, padding: "1px 5px",
              background: "var(--panel-2)", color: "var(--text)",
              fontFamily: "inherit",
            }}
          />
        ) : task.dueDate ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setEditingDate(true); }}
            title="Kliknij aby zmienić datę"
            style={{
              display: "flex", alignItems: "center", gap: 3,
              fontSize: 10.5, fontWeight: isOverdue ? 600 : 400,
              color: isOverdue ? "#dc2626" : "var(--text-mute)",
              background: isOverdue ? "#fef2f2" : "var(--panel-2)",
              border: `1px solid ${isOverdue ? "#fecaca" : "var(--line)"}`,
              padding: "1px 6px", borderRadius: 4, cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
            </svg>
            {new Date(task.dueDate).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" })}
          </button>
        ) : hovered ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setEditingDate(true); }}
            title="Dodaj termin"
            style={{
              display: "flex", alignItems: "center", gap: 2,
              fontSize: 10.5, color: "var(--text-mute)",
              background: "none", border: "1px dashed var(--line)",
              padding: "1px 6px", borderRadius: 4, cursor: "pointer",
              fontFamily: "inherit", opacity: 0.6,
            }}
          >
            <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
            </svg>
            Termin
          </button>
        ) : null}

        {/* Assignee picker (compact avatar) */}
        <span onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex" }}>
          <UserPickerDropdown
            value={task.assignedUserId ?? ""}
            onChange={handleAssigneeChange}
            users={users}
            compact
            currentUserId={currentUserId}
          />
        </span>

        <div style={{ flex: 1 }} />

        {/* Move / delete – show on hover */}
        {hovered && (
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {colIdx > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); onMove("prev"); }}
                title="Przenieś w lewo"
                style={{
                  background: "var(--panel-2)", border: "1px solid var(--line)",
                  cursor: "pointer", color: "var(--text-mute)",
                  padding: "1px 5px", borderRadius: 4, fontSize: 14, lineHeight: 1,
                  fontFamily: "inherit",
                }}
              >‹</button>
            )}
            {colIdx < 2 && (
              <button
                onClick={(e) => { e.stopPropagation(); onMove("next"); }}
                title="Przenieś w prawo"
                style={{
                  background: "var(--panel-2)", border: "1px solid var(--line)",
                  cursor: "pointer", color: "var(--text-mute)",
                  padding: "1px 5px", borderRadius: 4, fontSize: 14, lineHeight: 1,
                  fontFamily: "inherit",
                }}
              >›</button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              title="Usuń zadanie"
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--text-mute)", padding: "2px 3px", borderRadius: 4,
                display: "flex", alignItems: "center", opacity: 0.5,
              }}
            >
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TodoSection({ orderId }: { orderId: Id<"orders"> }) {
  const tasks = useQuery(api.orderTasks.listByOrder, { orderId });
  const salesUsers = useQuery(api.users.listAssignable) ?? [];
  const me = useQuery(api.users.me);
  const updateTask = useMutation(api.orderTasks.update);
  const removeTask = useMutation(api.orderTasks.remove);

  const [createInStatus, setCreateInStatus] = useState<
    "todo" | "in_progress" | "done" | null
  >(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<Id<"orderTasks"> | null>(null);

  async function handleMove(taskId: Id<"orderTasks">, from: string, dir: "prev" | "next") {
    const order = ["todo", "in_progress", "done"];
    const idx = order.indexOf(from);
    const next = dir === "next" ? idx + 1 : idx - 1;
    if (next < 0 || next >= order.length) return;
    await updateTask({ taskId, status: order[next] as "todo" | "in_progress" | "done" });
  }

  async function handleDrop(targetCol: "todo" | "in_progress" | "done", e: React.DragEvent) {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = e.dataTransfer.getData("taskId") as Id<"orderTasks">;
    const fromCol = e.dataTransfer.getData("fromCol");
    if (!taskId || fromCol === targetCol) return;
    await updateTask({ taskId, status: targetCol });
  }

  const openCount = tasks?.filter((t) => t.status !== "done").length ?? 0;

  return (
    <section className="panel" style={{ overflow: "visible" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>
        <span className="up mute">Lista zadań</span>
        {openCount > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 700,
            background: "#eff6ff", color: "#1d4ed8",
            border: "1px solid #bfdbfe", borderRadius: 10, padding: "1px 7px",
          }}>
            {openCount}
          </span>
        )}
      </div>

      {/* Kanban columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
        {KANBAN_COLS.map((col, colIdx) => {
          const colTasks = (tasks ?? []).filter((t) => t.status === col.key);

          return (
            <div
              key={col.key}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverCol(col.key); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null); }}
              onDrop={(e) => void handleDrop(col.key, e)}
              style={{
                borderRight: colIdx < 2 ? "1px solid var(--line)" : "none",
                display: "flex", flexDirection: "column",
                background: dragOverCol === col.key ? col.headerBg : col.colBg,
                minHeight: 120,
                transition: "background 0.15s",
                outline: dragOverCol === col.key ? `2px solid ${col.accent}` : "none",
                outlineOffset: -2,
              }}
            >
              {/* Column header */}
              <div style={{
                padding: "8px 10px", background: col.headerBg,
                borderBottom: `1px solid ${col.border}`,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.accent, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: col.accent, textTransform: "uppercase", letterSpacing: "0.07em", flex: 1 }}>
                  {col.label}
                </span>
                {colTasks.length > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: col.accent, opacity: 0.7 }}>{colTasks.length}</span>
                )}
              </div>

              {/* Cards */}
              <div style={{ padding: "6px", display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
                {colTasks.map((task) => (
                  <TaskCard
                    key={task._id}
                    task={task as KanbanTask}
                    colKey={col.key}
                    colIdx={colIdx}
                    users={salesUsers as AssignableUser[]}
                    now={Date.now()}
                    currentUserId={me?._id}
                    onMove={(dir) => void handleMove(task._id, col.key, dir)}
                    onRemove={() => void removeTask({ taskId: task._id })}
                    onUpdate={(args) => void updateTask({ taskId: task._id, ...args })}
                    onOpenDrawer={() => setOpenTaskId(task._id)}
                  />
                ))}

                {/* Otwórz panel szczegółów nowego zadania */}
                <button
                  onClick={() => setCreateInStatus(col.key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "5px 8px", fontSize: 12,
                    color: "var(--text-mute)", background: "none", border: "none",
                    cursor: "pointer", borderRadius: 5, width: "100%",
                    textAlign: "left", fontFamily: "inherit", marginTop: 2,
                  }}
                >
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Dodaj kartę
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <TaskDrawer taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
      <CreateOrderTaskDrawer
        orderId={orderId}
        initialStatus={createInStatus}
        onClose={() => setCreateInStatus(null)}
      />
    </section>
  );
}

const tsToDateStr = (ts: number | undefined | null) => {
  if (!ts) return "";
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const dateStrToTs = (str: string) => {
  if (!str) return undefined;
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
};

function DateInput({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (ts: number | undefined) => void;
}) {
  return (
    <input
      type="date"
      value={tsToDateStr(value)}
      onChange={(e) => onChange(dateStrToTs(e.target.value))}
      style={{
        fontSize: 13,
        padding: "4px 8px",
        borderRadius: 4,
        border: "1px solid var(--line)",
        background: "var(--card)",
        color: "var(--text)",
        fontFamily: "inherit",
      }}
    />
  );
}

// ── Zamówienia u dostawców — model kamieni milowych ──
type DeliveryField = "orderDate" | "deliveryDate" | "receivedDate";

const DELIVERY_MILESTONES: Array<{
  key: DeliveryField;
  label: string;
  tone: string;
  soft: string;
  border: string;
}> = [
  { key: "orderDate", label: "Zamówienie", tone: "#2563eb", soft: "#eff6ff", border: "#bfdbfe" },
  { key: "deliveryDate", label: "Dostawa", tone: "#b45309", soft: "#fffbeb", border: "#fde68a" },
  { key: "receivedDate", label: "Odbiór", tone: "#15803d", soft: "#f0fdf4", border: "#bbf7d0" },
];

function deliveryStatusBadge(d: { orderDate?: number; deliveryDate?: number; receivedDate?: number }) {
  if (d.receivedDate) return { label: "Odebrane", bg: "#f0fdf4", fg: "#15803d", border: "#bbf7d0" };
  if (d.orderDate) return { label: "Zamówione", bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" };
  return { label: "Oczekuje", bg: "var(--panel-2)", fg: "var(--text-mute)", border: "var(--line)" };
}

// Chip kamienia milowego (widok) — kropka + etykieta + data w jednej linii.
function MilestonePill({
  label,
  tone,
  soft,
  border,
  date,
  fmt,
}: {
  label: string;
  tone: string;
  soft: string;
  border: string;
  date: number | undefined;
  fmt: (ts: number) => string;
}) {
  const set = date != null;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 9px",
        borderRadius: 999,
        background: set ? soft : "var(--panel-2)",
        border: `1px solid ${set ? border : "var(--line)"}`,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: set ? tone : "var(--line)", flexShrink: 0 }} />
      <span style={{ fontSize: 10, fontWeight: 700, color: set ? tone : "var(--text-mute)" }}>{label}</span>
      <span style={{ fontSize: 11.5, fontWeight: set ? 600 : 400, color: set ? "var(--text-strong)" : "var(--text-mute)" }}>
        {set ? fmt(date) : "—"}
      </span>
    </span>
  );
}

// Kafelek odbioru (widok) — interaktywny, logika jak w /admin/zamowienia-dostawcy:
// brak daty → przycisk „Odebrano” (ustawia dzisiejszą datę); jest data → data + „×”.
function OdbiorMilestone({
  tone,
  soft,
  border,
  date,
  fmt,
  onMark,
  onClear,
}: {
  tone: string;
  soft: string;
  border: string;
  date: number | undefined;
  fmt: (ts: number) => string;
  onMark: () => void;
  onClear: () => void;
}) {
  const set = date != null;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 9px",
        borderRadius: 999,
        background: set ? soft : "var(--panel-2)",
        border: `1px solid ${set ? border : "var(--line)"}`,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: set ? tone : "var(--line)", flexShrink: 0 }} />
      <span style={{ fontSize: 10, fontWeight: 700, color: set ? tone : "var(--text-mute)" }}>Odbiór</span>
      {set ? (
        <>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-strong)" }}>{fmt(date)}</span>
          <button
            type="button"
            onClick={onClear}
            title="Usuń datę odbioru"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text-mute)",
              padding: 0,
              borderRadius: 4,
            }}
          >
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={onMark}
          title="Oznacz jako odebrane (dzisiejsza data)"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 0,
            fontSize: 11.5,
            fontWeight: 600,
            color: tone,
            fontFamily: "inherit",
          }}
        >
          Potwierdź odbiór
        </button>
      )}
    </span>
  );
}

// Pole daty w trybie edycji z przyciskiem czyszczenia (×).
function EditDateField({
  label,
  tone,
  value,
  onChange,
}: {
  label: string;
  tone: string;
  value: number | undefined;
  onChange: (ts: number | undefined) => void;
}) {
  const set = value != null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          color: set ? tone : "var(--text-mute)",
        }}
      >
        {label}
      </span>
      <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
        <input
          type="date"
          value={tsToDateStr(value)}
          onChange={(e) => onChange(dateStrToTs(e.target.value))}
          style={{
            fontSize: 12.5,
            padding: "4px 26px 4px 8px",
            borderRadius: 6,
            border: `1px solid ${set ? tone + "66" : "var(--line)"}`,
            background: "var(--card)",
            color: set ? "var(--text-strong)" : "var(--text-mute)",
            fontWeight: set ? 600 : 400,
            fontFamily: "inherit",
            width: 138,
          }}
        />
        {set && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            title="Wyczyść datę"
            style={{
              position: "absolute",
              right: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 17,
              height: 17,
              borderRadius: 4,
              border: "none",
              background: "var(--panel-2)",
              color: "var(--text-mute)",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string; orderId: string }>;
}) {
  const { id, orderId } = use(params);
  const clientId = id as Id<"clients">;
  const orderIdTyped = orderId as Id<"orders">;
  const router = useRouter();

  const statusLabels = useStatusLabels();
  const statuses = useStatuses();
  // Stepper realizacji: statusy order-side (poza reklamacją/ukrytymi), wg kolejności rejestru.
  const visibleStatusOrder = statuses.filter(
    (s) => s.kind === "order" && !s.hidden && s.key !== "complaint",
  );
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) ?? "szczegoly";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const assignDropdownRef = useRef<HTMLDivElement | null>(null);
  const [smsSelectedRecipients, setSmsSelectedRecipients] = useState<
    Set<number>
  >(new Set());
  const [smsCustomPhone, setSmsCustomPhone] = useState("");
  const [sendingAddress, setSendingAddress] = useState(false);
  const [smsError, setSmsError] = useState<string | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [reminderInvoiceId, setReminderInvoiceId] =
    useState<Id<"fakturowniaInvoicesCache"> | null>(null);

  const client = useQuery(api.clients.getById, { clientId });
  const order = useQuery(api.orders.getById, { orderId: orderIdTyped });
  const events = useQuery(api.events.listByOrder, { orderId: orderIdTyped });
  const assignedInvoices = useQuery(api.fakturownia.listCachedInvoicesByOrder, {
    orderId: orderIdTyped,
  });
  const allInvoices = useQuery(
    api.fakturownia.listCachedInvoices,
  ) as CachedInvoice[] | undefined;
  const fakturowniaConfig = useQuery(api.fakturownia.getConfig);
  const existingComplaint = useQuery(api.complaints.getByOrderId, {
    orderId: orderIdTyped,
  });
  const changeStatus = useMutation(api.orders.changeStatus);
  const assignInvoice = useMutation(api.fakturownia.assignInvoiceToOrder);
  const unassignInvoice = useMutation(api.fakturownia.unassignInvoiceFromOrder);
  const paymentReminders = useQuery(api.paymentReminders.listByOrder, {
    orderId: orderIdTyped,
  });
  const smsConfig = useQuery(api.sms.getConfig);
  const createOrderFolder = useAction(api.googleDrive.createOrderFolder);
  const deleteOrder = useAction(api.orders.deleteOrder);
  const sendOrderAddressSms = useAction(api.sms.sendOrderAddressSms);
  const me = useQuery(api.users.me);
  const assignableUsers = useQuery(api.users.listAssignable) ?? [];
  const assignOrder = useMutation(api.orders.assignOrder);
  const servicesList = useQuery(api.services.listActive) ?? [];
  const allSuppliers = useQuery(api.suppliers.listActive) ?? [];
  const updateOrder = useMutation(api.orders.update);
  const updateDeliveryDate = useMutation(api.orders.updateServiceDeliveryDate);
  const clearInstallationDate = useMutation(api.orders.clearInstallationDate);
  const [editingServices, setEditingServices] = useState(false);
  const [draftServices, setDraftServices] = useState<string[]>([]);
  const [editingDeliverySvc, setEditingDeliverySvc] = useState<string | null>(null);
  // Edycja jednej usługi = lista wpisów (po jednym na zaznaczonego dostawcę).
  const [draftDeliveries, setDraftDeliveries] = useState<NonNullable<typeof order.serviceDeliveries> | null>(null);
  const [editingCompletionDate, setEditingCompletionDate] = useState(false);
  const [draftCompletionDate, setDraftCompletionDate] = useState<number | undefined>(undefined);
  const [draftInstallationStart, setDraftInstallationStart] = useState<number | undefined>(undefined);
  const [confirmDeleteDate, setConfirmDeleteDate] = useState(false);

  useEffect(() => {
    if (!showAssignDropdown) return;
    function handleClick(e: MouseEvent) {
      if (!assignDropdownRef.current?.contains(e.target as Node)) {
        setShowAssignDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showAssignDropdown]);

  if (client === undefined || order === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm text-slate-400">Ladowanie...</div>
      </div>
    );
  }

  if (!client || !order) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <div className="text-sm text-slate-500">Nie znaleziono.</div>
        <Link
          href={`/admin/klient/${id}`}
          className="text-sm text-blue-600 hover:underline"
        >
          Wroc do klienta
        </Link>
      </div>
    );
  }

  const statusLabel = statusLabels[order.status] ?? order.status;
  const visibleStatusIndex = visibleStatusOrder.findIndex(
    (s) => s.key === order.status,
  );
  const isComplaint = order.status === "complaint";
  const isArchived = order.status === "archived";
  // Status nie należący do stepu (np. ukryty status własny) — pokazujemy osobny badge.
  const isStatusOutsideTimeline =
    visibleStatusIndex === -1 && !isComplaint && !isArchived;

  async function handleStatusChange(newStatus: string) {
    try {
      await changeStatus({ orderId: orderIdTyped, newStatus });
    } catch (error) {
      console.error("Status change failed:", error);
    }
  }

  async function handleArchive() {
    if (order?.status === "archived") return;
    try {
      await changeStatus({ orderId: orderIdTyped, newStatus: "archived" });
    } catch (error) {
      console.error("Archive failed:", error);
    }
  }

  async function handleRestore() {
    if (order?.status !== "archived") return;
    try {
      await changeStatus({ orderId: orderIdTyped, newStatus: "completed" });
    } catch (error) {
      console.error("Restore failed:", error);
    }
  }

  async function handleCreateFolder() {
    setCreatingFolder(true);
    try {
      await createOrderFolder({ orderId: orderIdTyped });
    } catch (error) {
      console.error("Folder creation failed:", error);
    } finally {
      setCreatingFolder(false);
    }
  }

  function openSmsModal() {
    setSmsSelectedRecipients(new Set());
    setSmsCustomPhone("");
    setSmsError(null);
    setShowSmsModal(true);
  }

  async function handleSendAddress() {
    const phones: string[] = [];
    const recipients = smsConfig?.recipients ?? [];
    smsSelectedRecipients.forEach((i) => {
      if (recipients[i]) phones.push(recipients[i].phone);
    });
    const custom = smsCustomPhone.trim();
    if (custom) phones.push(custom);

    if (phones.length === 0) {
      setSmsError(
        "Wybierz co najmniej jednego adresata lub podaj numer telefonu.",
      );
      return;
    }

    setSendingAddress(true);
    setSmsError(null);
    try {
      await sendOrderAddressSms({ orderId: orderIdTyped, recipients: phones });
      setShowSmsModal(false);
    } catch (error) {
      console.error("Błąd wysyłki SMS z adresem zlecenia:", error);
      setSmsError(
        error instanceof Error ? error.message : "Błąd wysyłki SMS",
      );
    } finally {
      setSendingAddress(false);
    }
  }

  async function handleDelete() {
    setDeleteLoading(true);
    try {
      await deleteOrder({ orderId: orderIdTyped });
      router.push(`/admin/klient/${id}`);
    } catch (error) {
      console.error("Order deletion failed:", error);
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
  }

  function startEditServices() {
    setDraftServices(order?.services ?? []);
    setEditingServices(true);
  }

  function cancelEditServices() {
    setEditingServices(false);
    setDraftServices([]);
  }

  function toggleDraftService(name: string) {
    setDraftServices((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name],
    );
  }

  async function saveServices() {
    if (!order) return;
    await updateOrder({
      orderId: orderIdTyped,
      services: draftServices.length > 0 ? draftServices : undefined,
    });
    setEditingServices(false);
    setDraftServices([]);
  }

  function startEditDelivery(svcName: string) {
    const existing = (order.serviceDeliveries ?? []).filter((x) => x.serviceName === svcName);
    setDraftDeliveries(existing.map((e) => ({ ...e })));
    setEditingDeliverySvc(svcName);
  }

  function cancelEditDelivery() {
    setEditingDeliverySvc(null);
    setDraftDeliveries(null);
  }

  // Zaznaczenie/odznaczenie dostawcy dla edytowanej usługi.
  function toggleDraftSupplier(svcName: string, supplierId: Id<"suppliers">, checked: boolean) {
    setDraftDeliveries((prev) => {
      if (!prev) return prev;
      if (checked) {
        if (prev.some((x) => x.supplierId === supplierId)) return prev;
        return [...prev, { serviceName: svcName, supplierId, orderDate: undefined, deliveryDate: undefined, receivedDate: undefined }];
      }
      return prev.filter((x) => x.supplierId !== supplierId);
    });
  }

  function updateDraftSupplierDate(
    supplierId: Id<"suppliers">,
    field: "orderDate" | "deliveryDate" | "receivedDate",
    ts: number | undefined,
  ) {
    setDraftDeliveries((prev) =>
      prev ? prev.map((x) => (x.supplierId === supplierId ? { ...x, [field]: ts } : x)) : prev,
    );
  }

  // Wyczyść wszystkie trzy terminy danego dostawcy (zachowując przypisanie).
  function clearDraftSupplierDates(supplierId: Id<"suppliers">) {
    setDraftDeliveries((prev) =>
      prev
        ? prev.map((x) =>
            x.supplierId === supplierId
              ? { ...x, orderDate: undefined, deliveryDate: undefined, receivedDate: undefined }
              : x,
          )
        : prev,
    );
  }

  async function saveDelivery() {
    if (!editingDeliverySvc || !draftDeliveries) return;
    // Zachowaj wpisy pozostałych usług; zastąp wpisy edytowanej usługi draftem.
    const others = (order.serviceDeliveries ?? []).filter((x) => x.serviceName !== editingDeliverySvc);
    const next = [...others, ...draftDeliveries];
    await updateOrder({ orderId: orderIdTyped, serviceDeliveries: next });
    setEditingDeliverySvc(null);
    setDraftDeliveries(null);
  }

  // Szybki odbiór (jak w /admin/zamowienia-dostawcy): oznacz/wyczyść datę odbioru
  // bezpośrednio z widoku, bez wchodzenia w tryb edycji.
  function markReceived(deliveryIndex: number) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return updateDeliveryDate({ orderId: orderIdTyped, deliveryIndex, field: "receivedDate", value: d.getTime() });
  }
  function clearReceived(deliveryIndex: number) {
    return updateDeliveryDate({ orderId: orderIdTyped, deliveryIndex, field: "receivedDate", value: null });
  }

  function startEditCompletionDate() {
    setDraftCompletionDate(order.completionDate);
    setDraftInstallationStart(order.installationStart);
    setEditingCompletionDate(true);
  }

  function cancelEditCompletionDate() {
    setEditingCompletionDate(false);
    setDraftCompletionDate(undefined);
    setDraftInstallationStart(undefined);
  }

  async function saveCompletionDate() {
    await updateOrder({
      orderId: orderIdTyped,
      completionDate: draftCompletionDate,
      installationStart: draftInstallationStart,
    });
    setEditingCompletionDate(false);
    setDraftCompletionDate(undefined);
    setDraftInstallationStart(undefined);
  }

  async function deleteCompletionDate() {
    try {
      await clearInstallationDate({ orderId: orderIdTyped });
    } catch (e) {
      console.error("Błąd usuwania terminu montażu:", e);
    }
    setConfirmDeleteDate(false);
  }

  const createdDate = new Date(order._creationTime).toLocaleDateString(
    "pl-PL",
    { day: "2-digit", month: "2-digit", year: "numeric" },
  );
  const fmtLocalDate = (ts: number) =>
    new Date(ts).toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const fmtDateTime = (ts: number) =>
    new Date(ts).toLocaleString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  const minsToHour = (mins: number | undefined) => {
    if (mins == null) return undefined;
    return Math.floor(mins / 60);
  };
  const hourStr = (mins: number | undefined) => {
    const h = minsToHour(mins);
    return h != null ? `${h.toString().padStart(2, "0")}:00` : "";
  };
  const orderNumber = order.name ?? `Zlecenie z ${createdDate}`;
  const projectFileLinks = getProjectFileLinks(order.projectFiles);

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "szczegoly", label: "Szczegóły" },
    { key: "wycena", label: "Wycena" },
    { key: "notatki", label: "Notatki" },
    { key: "reklamacja", label: "Reklamacja" },
  ];

  const warrantyEvent = (events ?? []).find(
    (e) => e.type === "status_changed" && e.details?.to === "complaint",
  );



  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── Header panel ── */}
      <div className="panel" style={{ overflow: "visible" }}>
        {/* Breadcrumb + actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "var(--text-mute)",
            }}
          >
            <Link
              href="/admin"
              style={{ color: "var(--text-mute)", textDecoration: "none" }}
            >
              Klienci
            </Link>
            <span style={{ opacity: 0.5 }}>›</span>
            <Link
              href={`/admin/klient/${id}`}
              className="btn"
              style={{ fontSize: 11, padding: "3px 8px" }}
            >
              {client.clientType === "business" && client.companyName
                ? client.companyName
                : `${client.firstName} ${client.lastName}`}
            </Link>
            <span style={{ opacity: 0.5 }}>›</span>
            <span style={{ color: "var(--text-dim)", fontWeight: 500 }}>
              {orderNumber}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="mono mute" style={{ fontSize: 11 }}>
              {(order as { productionDate?: number }).productionDate
                ? `Realizowane: ${fmtLocalDate((order as { productionDate?: number }).productionDate!)}`
                : `Dodano: ${createdDate}`}
              {(order as { completionDate?: number }).completionDate &&
                ` · Zak.: ${fmtLocalDate((order as { completionDate?: number }).completionDate!)}`}
            </span>
            <span style={{ width: 1, height: 14, background: "var(--line)", display: "inline-block" }} />

            {/* Przypisana osoba */}
            {(() => {
              const assignedUser = order.assignedUserId
                ? assignableUsers.find((u) => u._id === order.assignedUserId)
                : null;
              const assignedName = assignedUser
                ? (assignedUser.displayName ?? assignedUser.login ?? "")
                : null;
              return (
                <div ref={assignDropdownRef} style={{ position: "relative" }}>
                  <button
                    onClick={() => setShowAssignDropdown((v) => !v)}
                    className="btn"
                    style={{
                      fontSize: 11,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      ...(assignedUser?.color
                        ? { borderColor: assignedUser.color + "80", color: assignedUser.color }
                        : {}),
                    }}
                    title={assignedName ? `Przypisany: ${assignedName}` : "Przypisz osobę"}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                    {assignedName ?? "+ Przypisz"}
                  </button>
                  {showAssignDropdown && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        right: 0,
                        minWidth: 180,
                        background: "var(--panel)",
                        border: "1px solid var(--line)",
                        borderRadius: 8,
                        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                        zIndex: 500,
                        overflow: "hidden",
                      }}
                    >
                      {/* Przypisz mnie */}
                      {me && (
                        <button
                          onClick={() => {
                            void assignOrder({ orderId: orderIdTyped, assignedUserId: me._id });
                            setShowAssignDropdown(false);
                          }}
                          style={{
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            padding: "7px 12px",
                            fontSize: 12,
                            fontWeight: 600,
                            background: "var(--panel-2)",
                            border: "none",
                            borderBottom: "1px solid var(--line)",
                            cursor: "pointer",
                            color: "var(--text)",
                            fontFamily: "inherit",
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--accent-subtle, #f3e8ff)" }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--panel-2)" }}
                        >
                          ✓ Przypisz mnie
                        </button>
                      )}
                      {/* Lista użytkowników */}
                      {assignableUsers.map((u) => (
                        <button
                          key={u._id}
                          onClick={() => {
                            void assignOrder({ orderId: orderIdTyped, assignedUserId: u._id });
                            setShowAssignDropdown(false);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            width: "100%",
                            textAlign: "left",
                            padding: "6px 12px",
                            fontSize: 12,
                            background: order.assignedUserId === u._id ? "var(--panel-2)" : "transparent",
                            border: "none",
                            borderBottom: "1px solid var(--line)",
                            cursor: "pointer",
                            color: "var(--text)",
                            fontFamily: "inherit",
                            fontWeight: order.assignedUserId === u._id ? 600 : 400,
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--panel-2)" }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = order.assignedUserId === u._id ? "var(--panel-2)" : "transparent" }}
                        >
                          {u.color && (
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: u.color, flexShrink: 0 }} />
                          )}
                          <span style={{ flex: 1 }}>{u.displayName ?? u.login}</span>
                          {me && u._id === me._id && (
                            <span style={{ fontSize: 10, fontWeight: 600, color: "#2563eb", background: "#eff6ff", borderRadius: 3, padding: "1px 5px", flexShrink: 0 }}>Ty</span>
                          )}
                          {order.assignedUserId === u._id && (
                            <span style={{ fontSize: 10, color: "var(--text-mute)", flexShrink: 0 }}>aktualny</span>
                          )}
                        </button>
                      ))}
                      {/* Usuń przypisanie */}
                      {order.assignedUserId && (
                        <button
                          onClick={() => {
                            void assignOrder({ orderId: orderIdTyped, assignedUserId: undefined });
                            setShowAssignDropdown(false);
                          }}
                          style={{
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            padding: "6px 12px",
                            fontSize: 12,
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--bad, #ef4444)",
                            fontFamily: "inherit",
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fee2e2" }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}
                        >
                          Usuń przypisanie
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
            <span style={{ width: 1, height: 14, background: "var(--line)", display: "inline-block" }} />
            {/* Drive CTA */}
            <DriveFolderButton
              folderUrl={order.folderUrl}
              createdAt={order._creationTime}
              onCreate={() => void handleCreateFolder()}
              busy={creatingFolder}
              style={{ fontSize: 11 }}
            />
            <button
              onClick={openSmsModal}
              className="btn"
              style={{ fontSize: 11 }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                />
              </svg>
              Wyślij adres
            </button>
            {order.status !== "archived" ? (
              <button
                onClick={() => void handleArchive()}
                className="btn"
                style={{ fontSize: 11 }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
                  />
                </svg>
                Archiwizuj
              </button>
            ) : (
              <button
                onClick={() => void handleRestore()}
                className="btn"
                style={{ fontSize: 11 }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992V4.356M2.985 19.644v-4.992h4.992m0 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                  />
                </svg>
                Przywróć
              </button>
            )}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="btn"
              style={{
                fontSize: 11,
                color: "var(--bad)",
                borderColor: "oklch(0.72 0.18 25 / 0.4)",
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                />
              </svg>
              Usuń
            </button>
          </div>
        </div>

        {/* ── Status pills (nad numerem zlecenia, pod breadcrumb) ── */}
        <div
          style={{
            padding: "10px 20px",
            background: "var(--panel-2)",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            gap: 4,
            flexWrap: "wrap",
          }}
        >
          {/* Badge statusu spoza stepu */}
          {isStatusOutsideTimeline && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "4px 10px",
                borderRadius: 4,
                background: "#eff6ff",
                color: "#1d4ed8",
                border: "1px solid #bfdbfe",
                marginRight: 6,
              }}
            >
              {statusLabel}
            </span>
          )}

          {visibleStatusOrder.map((step, index) => {
            const status = step.key;
            const style = deriveStatusStyle(step.color);
            const isPast =
              visibleStatusIndex > index ||
              isComplaint ||
              isArchived;
            const isCurrent =
              visibleStatusIndex === index && !isArchived;
            const canClick = !isCurrent && !isArchived;
            const prevStep = index > 0 ? visibleStatusOrder[index - 1] : null;
            const prevIsPast = prevStep ? (visibleStatusIndex > index - 1 || isComplaint || isArchived) : false;

            return (
              <div
                key={status}
                style={{ display: "flex", alignItems: "center", gap: 4 }}
              >
                {index > 0 && (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={prevIsPast && prevStep ? deriveStatusStyle(prevStep.color).text : "#d1d5db"}
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                )}
                <button
                  onClick={
                    canClick ? () => void handleStatusChange(status) : undefined
                  }
                  disabled={!canClick}
                  title={
                    canClick
                      ? `Zmień status na: ${step.label}`
                      : undefined
                  }
                  style={{
                    padding: "4px 11px",
                    borderRadius: 4,
                    fontSize: 11.5,
                    fontWeight: 600,
                    border: "1px solid",
                    borderColor: isPast
                      ? style.border
                      : isCurrent
                        ? "#fdba74"
                        : "#e5e7eb",
                    background: isPast
                      ? style.bg
                      : isCurrent
                        ? "#fff7ed"
                        : "var(--panel)",
                    color: isPast
                      ? style.text
                      : isCurrent
                        ? "#ea580c"
                        : "#9ca3af",
                    cursor: canClick ? "pointer" : "default",
                    transition: "all 0.15s",
                    fontFamily: "inherit",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {isPast && (
                    <svg
                      width="10"
                      height="10"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                  {step.label}
                </button>
              </div>
            );
          })}

          {/* Complaint badge at the end */}
          {isComplaint && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fda4af"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
              <span
                style={{
                  padding: "4px 11px",
                  borderRadius: 4,
                  fontSize: 11.5,
                  fontWeight: 600,
                  border: "1px solid #fca5a5",
                  background: "#fff1f2",
                  color: "#b91c1c",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <svg
                  width="10"
                  height="10"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Reklamacja
              </span>
            </div>
          )}
        </div>

        {/* Title + meta */}
        <div style={{ padding: "14px 20px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "6px 10px",
              marginBottom: 6,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
                flexBasis: "100%",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <h1
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    margin: 0,
                    color: "var(--text-strong)",
                  }}
                >
                  {orderNumber}
                </h1>
                {order.customText && (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 10px",
                      borderRadius: 8,
                      borderLeft: "3px solid var(--accent)",
                      background: "var(--accent-soft)",
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.9}
                      style={{ color: "var(--accent)", flexShrink: 0 }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
                      />
                    </svg>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: "var(--text-strong)",
                        whiteSpace: "nowrap",
                        maxWidth: 300,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={order.customText}
                    >
                      {order.customText}
                    </span>
                  </div>
                )}
              </div>
              <InvestmentLocation
                orderId={orderIdTyped}
                investmentStreet={order.investmentStreet}
                investmentBuildingNumber={order.investmentBuildingNumber}
                investmentApartmentNumber={order.investmentApartmentNumber}
                investmentPostalCode={order.investmentPostalCode}
                investmentCity={order.investmentCity}
              />
            </div>
            {isArchived && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 4,
                  background: "#f1f5f9",
                  color: "#64748b",
                  border: "1px solid #e2e8f0",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Zarchiwizowane
              </span>
            )}
            {/* Usługi — widok (chip-y), edycja w panelu poniżej */}
            {servicesList.length > 0 && !editingServices && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                {(order.services ?? []).map((s) => (
                  <span
                    key={s}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      fontSize: 12.5,
                      fontWeight: 600,
                      lineHeight: 1.2,
                      padding: "5px 11px 5px 6px",
                      borderRadius: 9,
                      background: "var(--card)",
                      color: "var(--text-strong)",
                      border: "1px solid var(--line)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: "var(--accent-soft)",
                        color: "var(--accent)",
                        flexShrink: 0,
                      }}
                    >
                      <ServiceIcon name={s} />
                    </span>
                    {s}
                  </span>
                ))}
                <button
                  type="button"
                  onClick={startEditServices}
                  title={(order.services ?? []).length > 0 ? "Edytuj usługi" : "Dodaj usługi"}
                  className="btn"
                  style={{ fontSize: 11, padding: "3px 9px", flexShrink: 0 }}
                >
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                  </svg>
                  {(order.services ?? []).length > 0 ? "Edytuj" : "Dodaj usługi"}
                </button>
              </div>
            )}
          </div>

          {/* Usługi — panel edycji */}
          {servicesList.length > 0 && editingServices && (
            <div
              style={{
                marginTop: 4,
                padding: 14,
                borderRadius: 10,
                border: "1px solid var(--line)",
                background: "var(--panel-2)",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 0.7,
                  color: "var(--text-mute)",
                }}
              >
                Usługi zlecenia
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {servicesList.map((svc) => {
                  const active = draftServices.includes(svc.name);
                  return (
                    <button
                      key={svc._id}
                      type="button"
                      onClick={() => toggleDraftService(svc.name)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 7,
                        fontSize: 12.5,
                        fontWeight: 600,
                        padding: "5px 12px 5px 6px",
                        borderRadius: 9,
                        border: active
                          ? "1px solid var(--accent)"
                          : "1px solid var(--line)",
                        background: active ? "var(--accent-soft)" : "var(--card)",
                        color: active ? "var(--accent)" : "var(--text)",
                        cursor: "pointer",
                        transition: "background 0.1s, border-color 0.1s, color 0.1s",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          background: active ? "var(--accent)" : "var(--panel-2)",
                          color: active ? "#fff" : "var(--text-mute)",
                          flexShrink: 0,
                        }}
                      >
                        <ServiceIcon name={svc.name} />
                      </span>
                      {svc.name}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={saveServices} className="btn primary btn-xs">
                  Zapisz
                </button>
                <button onClick={cancelEditServices} className="btn btn-xs">
                  Anuluj
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Termin montażu */}
        <div style={{
          padding: "14px 20px",
          borderTop: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          background: order.completionDate ? "var(--accent-soft)" : "var(--panel-2)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            {/* Ikona w okręgu */}
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: order.completionDate ? "var(--accent)" : "var(--card)",
              border: order.completionDate ? "none" : "1px solid var(--line)",
              color: order.completionDate ? "#fff" : "var(--text-mute)",
            }}>
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
              </svg>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span style={{
                fontSize: 10.5, fontWeight: 700, color: "var(--accent)",
                textTransform: "uppercase", letterSpacing: 0.7,
              }}>
                Termin montażu
              </span>

              {editingCompletionDate ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 3 }}>
                  <input
                    type="date"
                    value={tsToDateStr(draftCompletionDate)}
                    onChange={(e) => setDraftCompletionDate(dateStrToTs(e.target.value))}
                    style={{
                      fontSize: 13, padding: "5px 8px", borderRadius: 6,
                      border: "1px solid var(--line)", background: "var(--card)",
                      color: "var(--text-strong)", fontFamily: "inherit", fontWeight: 600,
                    }}
                  />
                  <select
                    value={minsToHour(draftInstallationStart) ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDraftInstallationStart(val !== "" ? parseInt(val) * 60 : undefined);
                    }}
                    style={{
                      fontSize: 13, padding: "5px 8px", borderRadius: 6,
                      border: "1px solid var(--line)", background: "var(--card)",
                      color: "var(--text-strong)", fontFamily: "inherit", width: 100,
                    }}
                  >
                    <option value="">— godz.</option>
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{i.toString().padStart(2, "0")}:00</option>
                    ))}
                  </select>
                  <button onClick={saveCompletionDate} className="btn primary btn-xs">Zapisz</button>
                  <button onClick={cancelEditCompletionDate} className="btn btn-xs">Anuluj</button>
                </div>
              ) : order.completionDate ? (
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-strong)" }}>
                    {fmtLocalDate(order.completionDate)}
                  </span>
                  <span style={{ fontSize: 12.5, color: "var(--text-mute)", textTransform: "capitalize" }}>
                    {new Date(order.completionDate).toLocaleDateString("pl-PL", { weekday: "long" })}
                  </span>
                  {order.installationStart != null && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      fontSize: 12, fontWeight: 700, color: "var(--accent)",
                      background: "var(--card)", border: "1px solid var(--accent-line)",
                      borderRadius: 999, padding: "2px 9px",
                    }}>
                      <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {hourStr(order.installationStart)}
                    </span>
                  )}
                </div>
              ) : (
                <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-mute)" }}>
                  Nie ustawiono
                </span>
              )}
            </div>
          </div>

          {!editingCompletionDate && !confirmDeleteDate && (
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button
                type="button"
                onClick={startEditCompletionDate}
                className="btn"
                style={{ fontSize: 11, padding: "4px 10px" }}
              >
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                </svg>
                {order.completionDate ? "Edytuj" : "Ustaw termin"}
              </button>
              {order.completionDate && (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteDate(true)}
                  className="btn"
                  style={{ fontSize: 11, padding: "4px 10px", color: "var(--bad)", borderColor: "oklch(0.72 0.18 25 / 0.4)" }}
                  title="Usuń termin montażu"
                >
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                  Usuń
                </button>
              )}
            </div>
          )}
          {confirmDeleteDate && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: "var(--bad)", fontWeight: 600 }}>Usunąć termin montażu?</span>
              <button type="button" onClick={deleteCompletionDate} className="btn btn-xs" style={{ fontSize: 11, padding: "3px 10px", background: "var(--bad)", color: "#fff", borderColor: "var(--bad)" }}>Tak, usuń</button>
              <button type="button" onClick={() => setConfirmDeleteDate(false)} className="btn btn-xs" style={{ fontSize: 11, padding: "3px 10px" }}>Anuluj</button>
            </div>
          )}
        </div>

        {/* Zamówienia u dostawców */}
        <div style={{ padding: "16px 20px", borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--text-mute)" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-strong)", textTransform: "uppercase", letterSpacing: 0.6 }}>
              Zamówienia u dostawców
            </span>
          </div>

          {(order.services ?? []).length === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--text-mute)", padding: "10px 12px", borderRadius: 8, background: "var(--panel-2)", border: "1px dashed var(--line)" }}>
              Brak usług w zleceniu — dodaj usługi powyżej, aby przypisać dostawców.
            </div>
          ) : (
            (order.services ?? []).map((svcName) => {
              const svc = servicesList.find((s) => s.name === svcName);
              const availableSuppliers = allSuppliers.filter((s) => svc?.supplierIds?.some((sid) => sid === s._id));
              const assigned = (order.serviceDeliveries ?? []).filter((x) => x.serviceName === svcName);
              const isEditing = editingDeliverySvc === svcName;

              // ── Tryb edycji ──
              if (isEditing && draftDeliveries) {
                return (
                  <div key={svcName} style={{
                    display: "flex",
                    flexDirection: "column",
                    borderRadius: 10,
                    background: "var(--card)",
                    border: "1px solid var(--accent-line)",
                    overflow: "hidden",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  }}>
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 12px", background: "var(--accent-soft)", borderBottom: "1px solid var(--line)",
                    }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <span style={{ width: 4, height: 16, borderRadius: 2, background: "var(--accent)", flexShrink: 0 }} />
                        <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text-strong)", textTransform: "uppercase", letterSpacing: 0.4 }}>{svcName}</span>
                      </span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={saveDelivery} className="btn primary btn-xs">Zapisz</button>
                        <button onClick={cancelEditDelivery} className="btn btn-xs">Anuluj</button>
                      </div>
                    </div>

                    <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                      {availableSuppliers.length === 0 ? (
                        <span style={{ fontSize: 12, color: "var(--text-mute)" }}>
                          Brak dostawców skonfigurowanych dla tej usługi.
                        </span>
                      ) : (
                        availableSuppliers.map((s) => {
                          const entry = draftDeliveries.find((x) => x.supplierId === s._id);
                          const checked = !!entry;
                          const hasAnyDate = !!(entry && (entry.orderDate || entry.deliveryDate || entry.receivedDate));
                          return (
                            <div key={s._id} style={{
                              borderRadius: 8,
                              border: `1px solid ${checked ? "var(--line)" : "transparent"}`,
                              background: checked ? "var(--panel-2)" : "transparent",
                              padding: checked ? "8px 10px" : "2px 0",
                            }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => toggleDraftSupplier(svcName, s._id, e.target.checked)}
                                  />
                                  <span style={{ fontSize: 13, fontWeight: checked ? 600 : 400, color: checked ? "var(--text-strong)" : "var(--text-mute)" }}>
                                    {s.name}
                                  </span>
                                </label>
                                {checked && hasAnyDate && (
                                  <button
                                    type="button"
                                    onClick={() => clearDraftSupplierDates(s._id)}
                                    className="btn btn-xs"
                                    style={{ fontSize: 10, padding: "2px 8px", color: "var(--bad)" }}
                                    title="Wyczyść wszystkie terminy tego dostawcy"
                                  >
                                    Wyczyść terminy
                                  </button>
                                )}
                              </div>
                              {checked && entry && (
                                <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap", paddingLeft: 24, marginTop: 8 }}>
                                  {DELIVERY_MILESTONES.map((m) => (
                                    <EditDateField
                                      key={m.key}
                                      label={m.label}
                                      tone={m.tone}
                                      value={entry[m.key]}
                                      onChange={(ts) => updateDraftSupplierDate(s._id, m.key, ts)}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              }

              // ── Tryb widoku ──
              return (
                <div key={svcName} style={{
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 10,
                  background: "var(--card)",
                  border: "1px solid var(--line)",
                  overflow: "hidden",
                }}>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                    padding: "10px 12px", borderBottom: "1px solid var(--line)",
                    background: "var(--panel-2)",
                  }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <span style={{ width: 4, height: 16, borderRadius: 2, background: "var(--accent)", flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text-strong)", textTransform: "uppercase", letterSpacing: 0.4 }}>{svcName}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => startEditDelivery(svcName)}
                      className="btn"
                      style={{ fontSize: 10, padding: "2px 8px", flexShrink: 0 }}
                    >
                      <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                      </svg>
                      Edytuj
                    </button>
                  </div>

                  {assigned.length === 0 ? (
                    <div style={{ padding: "10px 12px", fontSize: 12.5, color: "var(--text-mute)" }}>
                      Brak przypisanych dostawców.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {assigned.map((d, i) => {
                        const supplier = allSuppliers.find((s) => s._id === d.supplierId);
                        const status = deliveryStatusBadge(d);
                        const deliveryIndex = (order.serviceDeliveries ?? []).findIndex((x) => x === d);
                        return (
                          <div
                            key={`${d.supplierId}:${i}`}
                            style={{
                              display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                              padding: "10px 12px",
                              borderTop: i > 0 ? "1px solid var(--line)" : "none",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 150, flex: "0 0 auto" }}>
                              <span style={{
                                fontSize: 12.5, fontWeight: 600,
                                color: supplier ? "var(--text-strong)" : "var(--text-mute)",
                              }}>
                                {supplier?.name ?? "— nieznany dostawca"}
                              </span>
                              <span style={{
                                fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5,
                                padding: "2px 7px", borderRadius: 999,
                                background: status.bg, color: status.fg, border: `1px solid ${status.border}`,
                                whiteSpace: "nowrap",
                              }}>
                                {status.label}
                              </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              {DELIVERY_MILESTONES.map((m) =>
                                m.key === "receivedDate" ? (
                                  <OdbiorMilestone
                                    key={m.key}
                                    tone={m.tone}
                                    soft={m.soft}
                                    border={m.border}
                                    date={d[m.key]}
                                    fmt={fmtLocalDate}
                                    onMark={() => markReceived(deliveryIndex)}
                                    onClear={() => clearReceived(deliveryIndex)}
                                  />
                                ) : (
                                  <MilestonePill
                                    key={m.key}
                                    label={m.label}
                                    tone={m.tone}
                                    soft={m.soft}
                                    border={m.border}
                                    date={d[m.key]}
                                    fmt={fmtLocalDate}
                                  />
                                )
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Czas realizacji */}
        {((order as any).realizationStartDate || (order as any).realizationEndDate) && (
          <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line)", display: "flex", flexWrap: "wrap", gap: 32, background: "var(--panel)" }}>
            {(order as any).realizationStartDate && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Początek realizacji</div>
                <div style={{ fontSize: 13, color: "var(--text-strong)", fontWeight: 500 }}>{fmtDateTime((order as any).realizationStartDate)}</div>
              </div>
            )}
            {(order as any).realizationEndDate && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Koniec realizacji</div>
                <div style={{ fontSize: 13, color: "var(--text-strong)", fontWeight: 500 }}>{fmtDateTime((order as any).realizationEndDate)}</div>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", borderTop: "1px solid var(--line)", gap: 2 }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const isComplaintTab = tab.key === "reklamacja";
            const activeColor = isComplaintTab
              ? "var(--bad)"
              : "var(--accent)";
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: "9px 16px",
                  fontSize: 12.5,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? activeColor : "var(--text-mute)",
                  borderTop: "none",
                  borderLeft: "none",
                  borderRight: "none",
                  borderBottom: isActive
                    ? `2px solid ${activeColor}`
                    : "2px solid transparent",
                  marginBottom: -1,
                  background: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab: Szczegóły ── */}
      {activeTab === "szczegoly" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Lista zadań — nad Dokumentami/Plikami */}
          <TodoSection orderId={orderIdTyped} />

          {/* Dokumenty + Pliki zlecenia */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr)",
              gap: 16,
            }}
          >
            <div className="panel" style={{ overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>
                <span className="up mute">Dokumenty</span>
              </div>
              <div style={{ padding: 16 }}>
                <DocumentCheckboxes
                  orderId={orderIdTyped}
                  documents={order.documents}
                  warrantyDocs={order.warrantyDocs ?? {}}
                  clientData={client ?? undefined}
                  orderData={order}
                />
              </div>
            </div>
            <OrderDriveBrowser
              orderId={orderIdTyped}
              rootFolderId={order.folderId}
            />
          </div>

          {/* Szczegóły zlecenia (komentarz, pliki projektu) */}
          {(order.comment ||
            (order.driveProjectFiles && order.driveProjectFiles.length > 0) ||
            projectFileLinks.length > 0) && (
            <CollapsibleSection title="Szczegóły zlecenia">
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {order.comment && (
                  <div>
                    <div className="up mute" style={{ marginBottom: 4 }}>
                      Komentarz
                    </div>
                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--text)",
                        margin: 0,
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.5,
                      }}
                    >
                      {order.comment}
                    </p>
                  </div>
                )}
                {(order.driveProjectFiles?.length ?? projectFileLinks.length) > 0 && (
                  <div>
                    <div className="up mute" style={{ marginBottom: 6 }}>
                      Pliki projektu
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {order.driveProjectFiles?.length
                        ? order.driveProjectFiles.map((f) => (
                            <a
                              key={f.fileId}
                              href={f.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="chip"
                              style={{ textDecoration: "none" }}
                            >
                              {f.name}
                            </a>
                          ))
                        : projectFileLinks.map((url, i) => (
                            <a
                              key={i}
                              href={`${process.env.NEXT_PUBLIC_CONVEX_URL}/api/jotform/file?url=${encodeURIComponent(url)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="chip"
                              style={{ textDecoration: "none" }}
                            >
                              {getFileName(url, i)}
                            </a>
                          ))}
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleSection>
          )}

          {/* Faktury z Fakturowni */}
          <SectionCard
            title="Faktury z Fakturowni"
            action={
              <button
                onClick={() => setShowInvoiceModal(true)}
                className="btn"
                style={{ fontSize: 11 }}
              >
                <svg
                  width="12"
                  height="12"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
                Przypisz fakturę
              </button>
            }
          >
            {assignedInvoices && assignedInvoices.length > 0 ? (
              <TableRoot>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Numer</TableHeaderCell>
                      <TableHeaderCell>Rodzaj</TableHeaderCell>
                      <TableHeaderCell>Status</TableHeaderCell>
                      <TableHeaderCell>Data</TableHeaderCell>
                      <TableHeaderCell className="text-right">
                        Brutto
                      </TableHeaderCell>
                      <TableHeaderCell />
                      <TableHeaderCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {assignedInvoices.map((inv) => {
                      const invUrl = fakturowniaConfig?.subdomain
                        ? `https://${fakturowniaConfig.subdomain}.fakturownia.pl/invoices/${inv.remoteId}`
                        : null;
                      return (
                        <TableRow
                          key={inv._id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <TableCell className="whitespace-nowrap font-mono text-sm text-gray-900">
                            <div className="flex items-center gap-1.5">
                              {inv.number ?? (
                                <span className="text-gray-400">
                                  #{inv.remoteId}
                                </span>
                              )}
                              {invUrl && (
                                <a
                                  href={invUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-gray-400 hover:text-blue-500 transition-colors"
                                >
                                  <svg
                                    className="h-3.5 w-3.5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                                    />
                                  </svg>
                                </a>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                (KIND_VARIANTS[inv.kind] ??
                                  "neutral") as Parameters<
                                  typeof Badge
                                >[0]["variant"]
                              }
                            >
                              {KIND_LABELS[inv.kind] ?? inv.kind}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {inv.status ? (
                              <Badge
                                variant={
                                  (STATUS_VARIANTS[inv.status] ??
                                    "neutral") as Parameters<
                                    typeof Badge
                                  >[0]["variant"]
                                }
                              >
                                {STATUS_LABELS[inv.status] ?? inv.status}
                              </Badge>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-gray-600">
                            {inv.issueDate
                              ? new Date(inv.issueDate).toLocaleDateString(
                                  "pl-PL",
                                )
                              : <span className="text-gray-400">—</span>}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right tabular-nums text-sm font-semibold text-gray-900">
                            {inv.grossAmount != null
                              ? `${inv.grossAmount.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${inv.currency ?? "PLN"}`
                              : <span className="text-gray-400">—</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            {inv.status !== "paid" && (
                              <button
                                onClick={() =>
                                  setReminderInvoiceId(inv._id)
                                }
                                className="btn"
                                style={{ fontSize: 11 }}
                                title="Wyślij przypomnienie o płatności"
                              >
                                Przypomnienie
                              </button>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <button
                              onClick={() =>
                                unassignInvoice({ invoiceId: inv._id })
                              }
                              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 ml-auto"
                            >
                              Odepnij
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  {(() => {
                    const totalGross = assignedInvoices.reduce(
                      (s, i) => s + (i.grossAmount ?? 0),
                      0,
                    );
                    const currency =
                      assignedInvoices.find((i) => i.currency)?.currency ??
                      "PLN";
                    return (
                      <TableFoot>
                        <TableRow className="bg-gray-50 font-semibold">
                          <TableCell
                            colSpan={4}
                            className="text-xs font-semibold text-gray-500 uppercase tracking-wide"
                            style={{ whiteSpace: "nowrap" }}
                          >
                            Suma ({assignedInvoices.length}{" "}
                            {assignedInvoices.length === 1
                              ? "faktura"
                              : "faktur"}
                            )
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm text-gray-900 whitespace-nowrap font-bold">
                            {totalGross.toLocaleString("pl-PL", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            {currency}
                          </TableCell>
                          <TableCell colSpan={2} />
                        </TableRow>
                      </TableFoot>
                    );
                  })()}
                </Table>
              </TableRoot>
            ) : (
              <p className="text-sm italic text-slate-400">
                Brak przypisanych faktur.
              </p>
            )}
          </SectionCard>

          {/* Payment reminders history */}
          {paymentReminders && paymentReminders.length > 0 && (
            <CollapsibleSection title="Historia przypomnień o płatności">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {paymentReminders.map((r) => (
                  <div
                    key={r._id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderRadius: 6,
                      background: "var(--panel-2)",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <span style={{ fontSize: 12, color: "var(--text)" }}>
                      {new Date(r.sentAt).toLocaleString("pl-PL")}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-mute)" }}>
                      {r.recipientEmail}
                      {r.invoiceNumber && (
                        <span style={{ marginLeft: 8, fontFamily: "monospace" }}>
                          {r.invoiceNumber}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}
        </div>
      )}

      {/* ── Tab: Wycena ── */}
      {activeTab === "wycena" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SectionCard title="Pozycje zamówienia">
            <OrderLineItems
              orderId={orderIdTyped}
              fakturownia={order.fakturownia}
              invoicePlan={order.invoicePlan}
            />
          </SectionCard>
        </div>
      )}

      {/* ── Tab: Notatki ── */}
      {activeTab === "notatki" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SectionCard title="Notatki">
            <div style={{ padding: 16 }}>
              <Notes clientId={clientId} orderId={orderIdTyped} />
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── Tab: Reklamacja ── */}
      {activeTab === "reklamacja" && (
        <ComplaintTab
          orderId={orderIdTyped}
          clientId={clientId}
          complaintStartDate={warrantyEvent?._creationTime ?? null}
        />
      )}

      {/* Payment reminder modal */}
      {reminderInvoiceId && (
        <ReminderModal
          invoiceId={reminderInvoiceId}
          onClose={() => setReminderInvoiceId(null)}
        />
      )}

      {/* Invoice assignment modal */}
      {showInvoiceModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => {
            setShowInvoiceModal(false);
            setInvoiceSearch("");
          }}
        >
          <div
            className="relative flex h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Przypisz faktury do zlecenia
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">{orderNumber}</p>
              </div>
              <button
                onClick={() => {
                  setShowInvoiceModal(false);
                  setInvoiceSearch("");
                }}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="border-b border-gray-100 px-5 py-3">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
                <input
                  type="text"
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  placeholder="Szukaj po numerze lub nabywcy…"
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3">
              {allInvoices === undefined ? (
                <div className="py-8 text-center text-sm text-gray-400">
                  Ładowanie…
                </div>
              ) : (
                <div className="space-y-1">
                  {allInvoices
                    .filter((inv) => {
                      const q = invoiceSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        (inv.number ?? "").toLowerCase().includes(q) ||
                        (inv.buyerName ?? "").toLowerCase().includes(q)
                      );
                    })
                    .sort((a, b) => {
                      const rank = (inv: CachedInvoice) =>
                        inv.orderId === orderIdTyped
                          ? 0
                          : !inv.orderId
                            ? 1
                            : 2;
                      return rank(a) - rank(b);
                    })
                    .map((inv) => {
                      const isAssignedHere = inv.orderId === orderIdTyped;
                      const isAssignedElsewhere =
                        !!inv.orderId && inv.orderId !== orderIdTyped;
                      const kindLabel =
                        inv.kind === "vat"
                          ? "Faktura VAT"
                          : inv.kind === "advance"
                            ? "Faktura zaliczkowa"
                            : inv.kind === "final"
                              ? "Faktura końcowa"
                              : inv.kind === "proforma"
                                ? "Proforma"
                                : inv.kind === "correction"
                                  ? "Korekta"
                                  : inv.kind === "estimate"
                                    ? "Wycena"
                                    : inv.kind;
                      return (
                        <div
                          key={inv._id}
                          className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${
                            isAssignedHere
                              ? "bg-blue-50 ring-1 ring-blue-200"
                              : isAssignedElsewhere
                                ? "opacity-50"
                                : "hover:bg-gray-50"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium text-slate-900">
                                {inv.number ?? `#${inv.remoteId}`}
                              </span>
                              <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                                {kindLabel}
                              </span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                              {inv.buyerName && (
                                <span className="truncate">
                                  {inv.buyerName}
                                </span>
                              )}
                              {inv.grossAmount != null && (
                                <span className="shrink-0 tabular-nums">
                                  {inv.grossAmount.toLocaleString("pl-PL", {
                                    minimumFractionDigits: 2,
                                  })}{" "}
                                  {inv.currency ?? "PLN"}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="ml-3 shrink-0">
                            {isAssignedHere ? (
                              <button
                                onClick={() =>
                                  unassignInvoice({ invoiceId: inv._id })
                                }
                                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                              >
                                <svg
                                  className="h-3.5 w-3.5"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                                Odepnij
                              </button>
                            ) : (
                              <button
                                onClick={() =>
                                  assignInvoice({
                                    invoiceId: inv._id,
                                    orderId: orderIdTyped,
                                  })
                                }
                                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                              >
                                <svg
                                  className="h-3.5 w-3.5"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M12 4.5v15m7.5-7.5h-15"
                                  />
                                </svg>
                                Przypisz
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SMS modal */}
      {showSmsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => {
            if (!sendingAddress) setShowSmsModal(false);
          }}
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Wyślij adres inwestycji SMS
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">{orderNumber}</p>
              </div>
              <button
                onClick={() => setShowSmsModal(false)}
                disabled={sendingAddress}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {(smsConfig?.recipients ?? []).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">
                    Adresaci z listy
                  </p>
                  <div className="space-y-1.5">
                    {(smsConfig?.recipients ?? []).map((r, i) => (
                      <label
                        key={i}
                        className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={smsSelectedRecipients.has(i)}
                          onChange={(e) => {
                            const next = new Set(smsSelectedRecipients);
                            if (e.target.checked) next.add(i);
                            else next.delete(i);
                            setSmsSelectedRecipients(next);
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-slate-800">
                            {r.name}
                          </span>
                          <span className="ml-2 font-mono text-xs text-slate-500">
                            {r.phone}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-slate-600 mb-2">
                  Własny numer telefonu
                </p>
                <input
                  type="tel"
                  value={smsCustomPhone}
                  onChange={(e) => setSmsCustomPhone(e.target.value)}
                  placeholder="np. 48515453090"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Numer z prefiksem kraju bez &quot;+&quot;, np.{" "}
                  <code className="font-mono">48515453090</code>
                </p>
              </div>

              {smsError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {smsError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-100 px-5 py-4">
              <button
                onClick={() => setShowSmsModal(false)}
                disabled={sendingAddress}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Anuluj
              </button>
              <button
                onClick={() => void handleSendAddress()}
                disabled={sendingAddress}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                  />
                </svg>
                {sendingAddress ? "Wysyłanie..." : "Wyślij SMS"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {showDeleteConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.4)",
            padding: 16,
          }}
        >
          <div
            className="panel"
            style={{ width: "100%", maxWidth: 400, padding: 24 }}
          >
            <h2
              style={{
                fontSize: 16,
                fontWeight: 700,
                margin: "0 0 8px",
                color: "var(--text-strong)",
              }}
            >
              Usunąć zlecenie?
            </h2>
            <p
              style={{
                fontSize: 13,
                color: "var(--text-mute)",
                margin: "0 0 24px",
              }}
            >
              Zostaną usunięte wszystkie dane zlecenia, dokumenty i folder
              Google Drive.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteLoading}
                className="btn"
              >
                Anuluj
              </button>
              <button
                onClick={() => void handleDelete()}
                disabled={deleteLoading}
                className="btn"
                style={{
                  background: "var(--bad)",
                  color: "#fff",
                  borderColor: "transparent",
                }}
              >
                {deleteLoading ? "Usuwanie…" : "Tak, usuń"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
