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
import SideDrawer from "@/components/SideDrawer";
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
import { ConvexError } from "convex/values";

const KIND_LABELS: Record<string, string> = {
  vat: "Faktura VAT",
  advance: "Zaliczkowa",
  final: "Końcowa",
  estimate: "Zamówienie",
  proforma: "Proforma",
  correction: "Korekta",
};

function convexErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof ConvexError) {
    return typeof e.data === "string" ? e.data : fallback;
  }
  return e instanceof Error ? e.message : fallback;
}

const KIND_VARIANTS: Record<string, string> = {
  vat: "default",
  advance: "warning",
  final: "success",
  estimate: "neutral",
  proforma: "neutral",
  correction: "error",
};

const STATUS_LABELS: Record<string, string> = {
  issued: "Wystawiona",
  sent: "Wysłana",
  paid: "Opłacona",
  unpaid: "Nieopłacona",
  partially_paid: "Częściowo opłacona",
  rejected: "Odrzucona",
  overdue: "Przeterminowana",
  draft: "Szkic",
};

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  draft:          { background: "#f3f4f6", color: "#475569", border: "1px solid #cbd5e1" },
  issued:         { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" },
  unpaid:         { background: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3" },
  sent:           { background: "#eef2ff", color: "#4338ca", border: "1px solid #c7d2fe" },
  paid:           { background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0" },
  partially_paid: { background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa" },
  rejected:       { background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" },
  overdue:        { background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5" },
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

type CachedExpense = {
  _id: Id<"fakturowniaExpensesCache">;
  remoteId: string;
  number?: string;
  kind?: string;
  status?: string;
  sellerName?: string;
  issueDate?: string;
  netAmount?: number;
  grossAmount?: number;
  currency?: string;
  orderId?: Id<"orders">;
};




type Tab = "szczegoly" | "dokumenty" | "finanse" | "faktury" | "koszty" | "wycena" | "reklamacja" | "notatki";

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

function TodoTaskRow({
  task,
  users,
  now,
  currentUserId,
  onRemove,
  onUpdate,
  onOpenDrawer,
}: {
  task: KanbanTask;
  users: AssignableUser[];
  now: number;
  currentUserId?: string;
  onRemove: () => void;
  onUpdate: (args: {
    title?: string;
    assignedUserId?: Id<"users">;
    clearAssignee?: boolean;
    dueDate?: number;
    clearDueDate?: boolean;
    status?: "todo" | "in_progress" | "done";
  }) => void;
  onOpenDrawer: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editingDate, setEditingDate] = useState(false);

  const isOverdue = task.dueDate && task.dueDate < now && task.status !== "done";
  const isDone = task.status === "done";

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

  const toggleDone = () => {
    onUpdate({ status: isDone ? "todo" : "done" });
  };

  const cycleStatus = () => {
    if (isDone) {
      onUpdate({ status: "todo" });
    } else {
      onUpdate({ status: task.status === "todo" ? "in_progress" : "todo" });
    }
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "8px 10px",
        borderRadius: 8,
        background: isDone ? "var(--panel-2)" : "#fff",
        border: isDone ? "1px solid var(--line)" : "1px solid var(--line)",
        boxShadow: hovered ? "0 1px 3px rgba(0,0,0,0.04)" : "none",
        transition: "all 0.12s",
      }}
    >
      {/* Lewa strona: Checkbox + Tytuł */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
        {/* Okrągły checkbox */}
        <button
          type="button"
          onClick={toggleDone}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 18,
            height: 18,
            borderRadius: "50%",
            border: isDone ? "1.5px solid #16a34a" : "1.5px solid var(--text-mute)",
            background: isDone ? "#16a34a" : "transparent",
            cursor: "pointer",
            flexShrink: 0,
            padding: 0,
            color: "#fff",
            transition: "all 0.1s",
          }}
          title={isDone ? "Oznacz jako niewykonane" : "Oznacz jako wykonane"}
        >
          {isDone && (
            <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Tytuł zadania (edycja inline) */}
        {editingTitle ? (
          <input
            autoFocus
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveTitle();
              if (e.key === "Escape") { setEditTitle(task.title); setEditingTitle(false); }
            }}
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              fontSize: 12.5,
              fontFamily: "inherit",
              outline: "none",
              color: "var(--text-strong)",
              padding: 0,
              cursor: "text",
            }}
          />
        ) : (
          <span
            onClick={() => { setEditTitle(task.title); setEditingTitle(true); }}
            title="Kliknij, aby edytować tytuł"
            style={{
              fontSize: 12.5,
              fontWeight: 500,
              color: isDone ? "var(--text-mute)" : "var(--text-strong)",
              textDecoration: isDone ? "line-through" : "none",
              cursor: "text",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            {task.title}
          </span>
        )}
      </div>

      {/* Prawa strona: Badges + Akcje */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {/* Badge statusu - klikalny (rotuje status) */}
        <button
          type="button"
          onClick={cycleStatus}
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            padding: "2px 6px",
            borderRadius: 6,
            cursor: "pointer",
            border: "none",
            background: isDone
              ? "var(--panel)"
              : task.status === "in_progress"
              ? "#ffedd5"
              : "#f1f5f9",
            color: isDone
              ? "var(--text-mute)"
              : task.status === "in_progress"
              ? "#b45309"
              : "#475569",
            transition: "all 0.15s",
          }}
          title="Kliknij, aby zmienić status zadania"
        >
          {isDone ? "Gotowe" : task.status === "in_progress" ? "W toku" : "Do zrobienia"}
        </button>

        {/* Termin */}
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
              fontSize: 11,
              border: "1px solid var(--line)",
              borderRadius: 4,
              padding: "1px 5px",
              background: "var(--panel-2)",
              color: "var(--text)",
              fontFamily: "inherit",
            }}
          />
        ) : task.dueDate ? (
          <button
            type="button"
            onClick={() => setEditingDate(true)}
            title="Zmień termin"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              fontSize: 10.5,
              fontWeight: isOverdue ? 600 : 400,
              color: isOverdue ? "#dc2626" : "var(--text-mute)",
              background: isOverdue ? "#fef2f2" : "var(--panel-2)",
              border: `1px solid ${isOverdue ? "#fecaca" : "var(--line)"}`,
              padding: "1px 6px",
              borderRadius: 4,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
            </svg>
            {new Date(task.dueDate).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" })}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setEditingDate(true)}
            title="Dodaj termin"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              fontSize: 10.5,
              color: "var(--text-mute)",
              background: "none",
              border: "1px dashed var(--line)",
              padding: "1px 6px",
              borderRadius: 4,
              cursor: "pointer",
              fontFamily: "inherit",
              opacity: hovered ? 0.7 : 0,
              transition: "opacity 0.15s",
            }}
          >
            Termin
          </button>
        )}

        {/* Przypisana osoba */}
        <span style={{ display: "inline-flex" }}>
          <UserPickerDropdown
            value={task.assignedUserId ?? ""}
            onChange={handleAssigneeChange}
            users={users}
            compact
            currentUserId={currentUserId}
          />
        </span>

        {/* Komentarze / szczegóły */}
        <button
          type="button"
          onClick={onOpenDrawer}
          title="Komentarze i szczegóły zadania"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-mute)",
            padding: "2px",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            opacity: hovered ? 0.8 : 0.4,
            transition: "opacity 0.15s",
          }}
        >
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m-9.75 0h.008v.008H2.25V12zm.008-3.75h.008v.008H2.258v-.008zM14 6H4a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V8a2 2 0 00-2-2z" />
          </svg>
        </button>

        {/* Usuń zadanie */}
        <button
          type="button"
          onClick={onRemove}
          title="Usuń zadanie"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--bad)",
            padding: "2px",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            opacity: hovered ? 0.8 : 0,
            transition: "opacity 0.15s",
          }}
        >
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
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
  const [openTaskId, setOpenTaskId] = useState<Id<"orderTasks"> | null>(null);

  const openCount = tasks?.filter((t) => t.status !== "done").length ?? 0;
  const [now, setNow] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      setNow(Date.now());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const sortedTasks = [...(tasks ?? [])].sort((a, b) => {
    const aDone = a.status === "done" ? 1 : 0;
    const bDone = b.status === "done" ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 4, height: 20, borderRadius: 3, background: "#3b82f6", flexShrink: 0 }} />
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="#3b82f6" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-strong)", textTransform: "uppercase", letterSpacing: 0.6 }}>
            Lista zadań
          </span>
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
        <button
          type="button"
          onClick={() => setCreateInStatus("todo")}
          className="btn btn-xs"
          style={{ fontSize: 11, padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Dodaj zadanie
        </button>
      </div>

      {/* Lista zadań */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
        {tasks === undefined ? (
          <div style={{ fontSize: 12.5, color: "var(--text-mute)" }}>Ładowanie...</div>
        ) : sortedTasks.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "var(--text-mute)", padding: "12px 14px", borderRadius: 8, background: "var(--panel-2)", border: "1px dashed var(--line)" }}>
            Brak zadań w tym zleceniu. Kliknij „Dodaj zadanie”, aby dodać pierwsze zadanie.
          </div>
        ) : (
          sortedTasks.map((task) => (
            <TodoTaskRow
              key={task._id}
              task={task as KanbanTask}
              users={salesUsers as AssignableUser[]}
              now={now}
              currentUserId={me?._id}
              onRemove={() => void removeTask({ taskId: task._id })}
              onUpdate={(args) => void updateTask({ taskId: task._id, ...args })}
              onOpenDrawer={() => setOpenTaskId(task._id)}
            />
          ))
        )}
      </div>

      <TaskDrawer taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
      <CreateOrderTaskDrawer
        orderId={orderId}
        initialStatus={createInStatus}
        onClose={() => setCreateInStatus(null)}
      />
    </div>
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

function InvoicesTableGroup({
  invoices,
  title,
  isEstimate,
  fakturowniaConfig,
  setReminderInvoiceId,
  unassignInvoice,
}: {
  invoices: CachedInvoice[];
  title?: string;
  isEstimate?: boolean;
  fakturowniaConfig: { subdomain?: string } | null | undefined;
  setReminderInvoiceId: (id: Id<"fakturowniaInvoicesCache">) => void;
  unassignInvoice: (args: { invoiceId: Id<"fakturowniaInvoicesCache"> }) => void;
}) {
  if (invoices.length === 0) return null;
  const totalNet = invoices.reduce((s, i) => s + (i.netAmount ?? 0), 0);
  const totalGross = invoices.reduce((s, i) => s + (i.grossAmount ?? 0), 0);
  const currency = invoices.find((i) => i.currency)?.currency ?? "PLN";

  return (
    <div className={`mb-4 overflow-hidden rounded-xl border transition-all ${
      isEstimate
        ? "border-indigo-200 bg-white shadow-sm ring-1 ring-indigo-100"
        : "border-emerald-200 bg-white shadow-sm ring-1 ring-emerald-100"
    }`}>
      {title && (
        <div
          className={`flex flex-wrap items-center justify-between gap-4 px-4 py-3.5 border-b ${
            isEstimate
              ? "bg-gradient-to-r from-indigo-50/90 via-indigo-50/40 to-white border-indigo-100"
              : "bg-gradient-to-r from-emerald-50/90 via-emerald-50/40 to-white border-emerald-100"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                isEstimate
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {isEstimate ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4
                  className={`text-sm font-bold tracking-wide uppercase ${
                    isEstimate ? "text-indigo-950" : "text-emerald-950"
                  }`}
                >
                  {title}
                </h4>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                    isEstimate
                      ? "bg-indigo-100 text-indigo-800"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {isEstimate ? "Dokument bazowy" : "Rozliczenia"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isEstimate
                  ? "Kosztorys / zamówienie wysłane do klienta w Fakturowni"
                  : "Faktury VAT, zaliczkowe i końcowe wystawione do tego zlecenia"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {isEstimate ? "Wycena (Zamówienie)" : "Suma faktur"} ({invoices.length} {invoices.length === 1 ? "szt." : "szt."})
              </div>
              <div className="text-sm font-bold text-slate-900 tabular-nums">
                {totalNet.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}{" "}
                <span className="text-xs font-normal text-slate-500">netto</span>
              </div>
            </div>
          </div>
        </div>
      )}
      <TableRoot className="w-full overflow-hidden">
        <Table style={{ tableLayout: "fixed", width: "100%" }}>
          <colgroup>
            <col style={{ width: "18%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "6%" }} />
          </colgroup>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Numer</TableHeaderCell>
              <TableHeaderCell>Rodzaj</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Data</TableHeaderCell>
              <TableHeaderCell style={{ textAlign: "right" }}>Netto</TableHeaderCell>
              <TableHeaderCell style={{ textAlign: "right" }}>Brutto</TableHeaderCell>
              <TableHeaderCell />
              <TableHeaderCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {invoices.map((inv) => {
              const invUrl = fakturowniaConfig?.subdomain
                ? `https://${fakturowniaConfig.subdomain}.fakturownia.pl/invoices/${inv.remoteId}`
                : null;
              return (
                <TableRow key={inv._id} className="hover:bg-gray-50 transition-colors">
                  <TableCell className="whitespace-nowrap font-mono text-sm text-gray-900 truncate">
                    <div className="flex items-center gap-1.5">
                      {inv.number ?? <span className="text-gray-400">#${inv.remoteId}</span>}
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
                  <TableCell className="truncate">
                    <Badge
                      variant={
                        (KIND_VARIANTS[inv.kind] ?? "neutral") as Parameters<typeof Badge>[0]["variant"]
                      }
                    >
                      {KIND_LABELS[inv.kind] ?? inv.kind}
                    </Badge>
                  </TableCell>
                  <TableCell className="truncate">
                    {inv.status ? (
                      <span
                        style={{
                          ...(STATUS_STYLES[inv.status] || {
                            background: "#f3f4f6",
                            color: "#475569",
                            border: "1px solid #cbd5e1",
                          }),
                          padding: "4px 8px",
                          borderRadius: "9999px",
                          fontSize: "12px",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          display: "inline-block",
                        }}
                      >
                        {STATUS_LABELS[inv.status] ?? inv.status}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-gray-600 truncate">
                    {inv.issueDate ? (
                      new Date(inv.issueDate).toLocaleDateString("pl-PL")
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums text-sm font-semibold text-gray-900">
                    {inv.netAmount != null ? (
                      `${inv.netAmount.toLocaleString("pl-PL", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} ${inv.currency ?? "PLN"}`
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums text-xs text-gray-400">
                    {inv.grossAmount != null ? (
                      `${inv.grossAmount.toLocaleString("pl-PL", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} ${inv.currency ?? "PLN"}`
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {inv.status !== "paid" && !isEstimate && (
                      <button
                        onClick={() => setReminderInvoiceId(inv._id)}
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
                      onClick={() => unassignInvoice({ invoiceId: inv._id })}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 ml-auto"
                    >
                      Odepnij
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFoot>
            <TableRow className="bg-gray-50 font-semibold">
              <TableCell
                colSpan={4}
                className="text-xs font-semibold text-gray-500 uppercase tracking-wide"
                style={{ whiteSpace: "nowrap" }}
              >
                Suma {isEstimate ? "zamówienia" : "faktur"}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm text-gray-900 whitespace-nowrap font-bold">
                {totalNet.toLocaleString("pl-PL", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                {currency}
              </TableCell>
              <TableCell className="text-right tabular-nums text-xs text-gray-400 whitespace-nowrap font-normal">
                {totalGross.toLocaleString("pl-PL", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                {currency}
              </TableCell>
              <TableCell colSpan={2} />
            </TableRow>
          </TableFoot>
        </Table>
      </TableRoot>
    </div>
  );
}

function ExpensesTableGroup({
  expenses,
  fakturowniaConfig,
  categories,
  onSelectExpense,
}: {
  expenses: (CachedExpense & { categoryId?: Id<"expenseCategories"> })[];
  fakturowniaConfig: { subdomain?: string } | null | undefined;
  categories: { _id: Id<"expenseCategories">; name: string }[];
  onSelectExpense: (exp: CachedExpense) => void;
}) {
  if (expenses.length === 0) return null;
  const totalNet = expenses.reduce((s, i) => s + (i.netAmount ?? 0), 0);
  const totalGross = expenses.reduce((s, i) => s + (i.grossAmount ?? 0), 0);
  const currency = expenses.find((i) => i.currency)?.currency ?? "PLN";

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm ring-1 ring-amber-100 transition-all">
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3.5 border-b bg-gradient-to-r from-amber-50/90 via-amber-50/40 to-white border-amber-100">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold tracking-wide uppercase text-amber-950">
                Koszty Zlecenia (Wydatki)
              </h4>
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-amber-100 text-amber-800">
                Koszty
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Faktury kosztowe i wydatki z Fakturowni przypisane do tego zlecenia
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Suma wydatków ({expenses.length} szt.)
            </div>
            <div className="text-sm font-bold text-slate-900 tabular-nums">
              {totalNet.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}{" "}
              <span className="text-xs font-normal text-slate-500">netto</span>
            </div>
          </div>
        </div>
      </div>

      <TableRoot className="w-full overflow-hidden">
        <Table style={{ tableLayout: "fixed", width: "100%" }}>
          <colgroup>
            <col style={{ width: "18%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "8%" }} />
          </colgroup>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Numer</TableHeaderCell>
              <TableHeaderCell>Sprzedawca</TableHeaderCell>
              <TableHeaderCell>Kategoria</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Data</TableHeaderCell>
              <TableHeaderCell style={{ textAlign: "right" }}>Netto</TableHeaderCell>
              <TableHeaderCell style={{ textAlign: "right" }}>Brutto</TableHeaderCell>
              <TableHeaderCell style={{ textAlign: "center" }}>VAT%</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {expenses.map((exp) => {
              const expUrl = fakturowniaConfig?.subdomain && !exp.remoteId.startsWith("custom_")
                ? `https://${fakturowniaConfig.subdomain}.fakturownia.pl/invoices/${exp.remoteId}`
                : null;

              // Derive VAT rate from stored gross/net
              const vatRateLabel = (() => {
                const g = exp.grossAmount;
                const n = exp.netAmount;
                if (!g || !n || g === 0) return "—";
                if (Math.abs(g - n) < 0.01) return "0% / BV";
                const rate = Math.round((g / n - 1) * 100);
                return `${rate}%`;
              })();

              const categoryName = categories.find((c) => c._id === exp.categoryId)?.name || "—";

              return (
                <TableRow
                  key={exp._id}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => onSelectExpense(exp)}
                >
                  <TableCell className="whitespace-nowrap font-mono text-sm text-gray-900 truncate">
                    <div className="flex items-center gap-1.5">
                      {exp.number ?? <span className="text-gray-400">#${exp.remoteId}</span>}
                      {expUrl && (
                        <a
                          href={expUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-blue-500 transition-colors"
                          onClick={(e) => e.stopPropagation()}
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
                  <TableCell className="truncate text-sm text-gray-900 font-medium">
                    {exp.sellerName || "—"}
                  </TableCell>
                  <TableCell className="truncate text-sm font-semibold text-slate-700">
                    {categoryName}
                  </TableCell>
                  <TableCell className="truncate">
                    {exp.status ? (
                      <span
                        style={{
                          ...(STATUS_STYLES[exp.status] || {
                            background: "#f3f4f6",
                            color: "#475569",
                            border: "1px solid #cbd5e1",
                          }),
                          padding: "4px 8px",
                          borderRadius: "9999px",
                          fontSize: "12px",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          display: "inline-block",
                        }}
                      >
                        {STATUS_LABELS[exp.status] ?? exp.status}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-gray-600 truncate">
                    {exp.issueDate ? (
                      new Date(exp.issueDate).toLocaleDateString("pl-PL")
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums text-sm font-semibold text-gray-900">
                    {exp.netAmount != null ? (
                      `${exp.netAmount.toLocaleString("pl-PL", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} ${exp.currency ?? "PLN"}`
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums text-xs text-gray-400">
                    {exp.grossAmount != null ? (
                      `${exp.grossAmount.toLocaleString("pl-PL", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} ${exp.currency ?? "PLN"}`
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-xs font-semibold text-slate-600 tabular-nums">
                    {vatRateLabel}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFoot>
            <TableRow className="bg-gray-50 font-semibold">
              <TableCell
                colSpan={5}
                className="text-xs font-semibold text-gray-500 uppercase tracking-wide"
                style={{ whiteSpace: "nowrap" }}
              >
                Suma wydatków
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm text-gray-900 whitespace-nowrap font-bold">
                {totalNet.toLocaleString("pl-PL", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                {currency}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm text-gray-900 whitespace-nowrap font-bold">
                {totalGross.toLocaleString("pl-PL", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                {currency}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableFoot>
        </Table>
      </TableRoot>
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
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseSearch, setExpenseSearch] = useState("");
  const [amountView, setAmountView] = useState<"netto" | "brutto">("netto");
  const [showAddCustomExpenseModal, setShowAddCustomExpenseModal] = useState(false);
  const [customExpenseTitle, setCustomExpenseTitle] = useState("");
  const [customExpenseAmount, setCustomExpenseAmount] = useState("");
  const [customExpenseVatRate, setCustomExpenseVatRate] = useState("23");
  const [customExpenseInputMode, setCustomExpenseInputMode] = useState<"brutto" | "netto">("netto");
  const [selectedExpense, setSelectedExpense] = useState<CachedExpense | null>(null);
  const [editExpenseTitle, setEditExpenseTitle] = useState("");
  const [editExpenseAmount, setEditExpenseAmount] = useState("");
  const [editExpenseVatRate, setEditExpenseVatRate] = useState("23");
  const [editExpenseInputMode, setEditExpenseInputMode] = useState<"brutto" | "netto">("brutto");
  const [editExpenseDate, setEditExpenseDate] = useState("");
  const [editExpenseCategory, setEditExpenseCategory] = useState("");
  const [customExpenseDate, setCustomExpenseDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [customExpenseCategory, setCustomExpenseCategory] = useState<string>("");
  
  const calculateNet = (grossVal: string, vatVal: string) => {
    const gross = parseFloat(grossVal);
    if (isNaN(gross) || gross <= 0) return 0;
    if (vatVal === "exempt" || vatVal === "0") return gross;
    const vat = parseFloat(vatVal);
    if (isNaN(vat)) return gross;
    return Math.round((gross / (1 + vat / 100)) * 100) / 100;
  };

  const calculateGross = (netVal: string, vatVal: string) => {
    const net = parseFloat(netVal);
    if (isNaN(net) || net <= 0) return 0;
    if (vatVal === "exempt" || vatVal === "0") return net;
    const vat = parseFloat(vatVal);
    if (isNaN(vat)) return net;
    return Math.round((net * (1 + vat / 100)) * 100) / 100;
  };

  const [reminderInvoiceId, setReminderInvoiceId] =
    useState<Id<"fakturowniaInvoicesCache"> | null>(null);
  const [warningModalText, setWarningModalText] = useState<string | null>(null);

  const client = useQuery(api.clients.getById, { clientId });
  const order = useQuery(api.orders.getById, { orderId: orderIdTyped });
  const events = useQuery(api.events.listByOrder, { orderId: orderIdTyped });
  const assignedInvoices = useQuery(api.fakturownia.listCachedInvoicesByOrder, {
    orderId: orderIdTyped,
  });
  const expenses = useQuery(api.fakturownia.listCachedExpensesByOrder, {
    orderId: orderIdTyped,
  });
  const allInvoices = useQuery(
    api.fakturownia.listCachedInvoices,
  ) as CachedInvoice[] | undefined;
  const allExpenses = useQuery(
    api.fakturownia.listCachedExpenses,
  ) as CachedExpense[] | undefined;
  const fakturowniaConfig = useQuery(api.fakturownia.getConfig);
  const existingComplaint = useQuery(api.complaints.getByOrderId, {
    orderId: orderIdTyped,
  });
  const changeStatus = useMutation(api.orders.changeStatus);
  const assignInvoice = useMutation(api.fakturownia.assignInvoiceToOrder);
  const unassignInvoice = useMutation(api.fakturownia.unassignInvoiceFromOrder);
  const assignExpense = useMutation(api.fakturownia.assignExpense);
  const unassignExpense = useMutation(api.fakturownia.unassignExpense);
  const addCustomExpense = useMutation(api.fakturownia.addCustomExpense);
  const deleteCustomExpense = useMutation(api.fakturownia.deleteCustomExpense);
  const updateCustomExpense = useMutation(api.fakturownia.updateCustomExpense);
  const expenseCategories = useQuery(api.expenseCategories.list);
  const assignCategory = useMutation(api.fakturownia.assignCategory);
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
  const refreshOrderNumber = useMutation(api.orders.refreshOrderNumber);
  const setCustomText = useMutation(api.orders.setCustomText);
  const updateDeliveryDate = useMutation(api.orders.updateServiceDeliveryDate);
  const clearInstallationDate = useMutation(api.orders.clearInstallationDate);
  const [editingCustomText, setEditingCustomText] = useState(false);
  const [customTextDraft, setCustomTextDraft] = useState("");
  const [editingServices, setEditingServices] = useState(false);
  const [draftServices, setDraftServices] = useState<string[]>([]);
  const [editingDeliverySvc, setEditingDeliverySvc] = useState<string | null>(null);
  // Edycja jednej usługi = lista wpisów (po jednym na zaznaczonego dostawcę).
  const [draftDeliveries, setDraftDeliveries] = useState<NonNullable<NonNullable<typeof order>["serviceDeliveries"]> | null>(null);
  const [editingCompletionDate, setEditingCompletionDate] = useState(false);
  const [draftCompletionDate, setDraftCompletionDate] = useState<number | undefined>(undefined);
  const [draftInstallationStart, setDraftInstallationStart] = useState<number | undefined>(undefined);
  const [confirmDeleteDate, setConfirmDeleteDate] = useState(false);
  const [editingFinanceSvc, setEditingFinanceSvc] = useState<string | null>(null);
  const [draftEarnings, setDraftEarnings] = useState<string>("");
  const [draftWorkDays, setDraftWorkDays] = useState<string>("");

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
      setWarningModalText(convexErrorMessage(error, "Nie udało się zmienić statusu."));
    }
  }

  async function handleArchive() {
    if (order?.status === "archived") return;
    try {
      await changeStatus({ orderId: orderIdTyped, newStatus: "archived" });
    } catch (error) {
      console.error("Archive failed:", error);
      setWarningModalText(convexErrorMessage(error, "Błąd archiwizacji zlecenia."));
    }
  }

  async function handleRestore() {
    if (order?.status !== "archived") return;
    try {
      await changeStatus({ orderId: orderIdTyped, newStatus: "completed" });
    } catch (error) {
      console.error("Restore failed:", error);
      setWarningModalText(convexErrorMessage(error, "Błąd przywracania zlecenia."));
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
    const existing = (order?.serviceDeliveries ?? []).filter((x) => x.serviceName === svcName);
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
    const others = (order?.serviceDeliveries ?? []).filter((x) => x.serviceName !== editingDeliverySvc);
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

  function startEditFinance(svcName: string) {
    const existing = (order?.serviceFinances ?? []).find((f) => f.serviceName === svcName);
    setDraftEarnings(existing?.earningsAmount !== undefined ? String(existing.earningsAmount) : "");
    setDraftWorkDays(existing?.workDays !== undefined ? String(existing.workDays) : "");
    setEditingFinanceSvc(svcName);
  }

  function cancelEditFinance() {
    setEditingFinanceSvc(null);
    setDraftEarnings("");
    setDraftWorkDays("");
  }

  async function saveFinance() {
    if (!editingFinanceSvc || !order) return;
    const others = (order.serviceFinances ?? []).filter((f) => f.serviceName !== editingFinanceSvc);
    const earnings = draftEarnings.trim() !== "" ? parseFloat(draftEarnings.replace(",", ".")) : undefined;
    const days = draftWorkDays.trim() !== "" ? parseFloat(draftWorkDays.replace(",", ".")) : undefined;
    const next = [...others, {
      serviceName: editingFinanceSvc,
      earningsAmount: !isNaN(earnings as number) ? earnings : undefined,
      workDays: !isNaN(days as number) ? days : undefined,
    }];
    await updateOrder({ orderId: orderIdTyped, serviceFinances: next });
    setEditingFinanceSvc(null);
    setDraftEarnings("");
    setDraftWorkDays("");
  }

  function startEditCompletionDate() {
    if (order?.installationStartDate && order.installationStartDate > 10000000) {
      const d = new Date(order.installationStartDate);
      const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const minutes = d.getHours() * 60 + d.getMinutes();
      setDraftCompletionDate(dateOnly);
      setDraftInstallationStart(minutes);
    } else {
      setDraftCompletionDate(order?.projectEndDate);
      setDraftInstallationStart(order?.installationStartDate);
    }
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
      projectEndDate: draftCompletionDate !== undefined ? draftCompletionDate : undefined,
      installationStartDate: draftInstallationStart !== undefined ? draftInstallationStart : undefined,
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
    { key: "dokumenty", label: "Dokumenty" },
    { key: "finanse", label: "Finanse" },
    { key: "wycena", label: "Wycena" },

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
            background: "#4abbc3",
            borderBottom: "1px solid rgba(11, 18, 32, 0.15)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "#000000",
            }}
          >
            <Link
              href="/admin"
              style={{ color: "#000000", fontWeight: 600, textDecoration: "none" }}
              onMouseEnter={(e) => { e.currentTarget.style.textDecoration = "underline" }}
              onMouseLeave={(e) => { e.currentTarget.style.textDecoration = "none" }}
            >
              Klienci
            </Link>
            <span style={{ color: "#000000", opacity: 0.7, fontWeight: 700 }}>›</span>
            <Link
              href={`/admin/klient/${id}`}
              style={{
                color: "#000000",
                fontWeight: 600,
                textDecoration: "none",
                fontSize: 12,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.textDecoration = "underline" }}
              onMouseLeave={(e) => { e.currentTarget.style.textDecoration = "none" }}
            >
              {client.clientType === "business" && client.companyName
                ? client.companyName
                : `${client.firstName} ${client.lastName}`}
            </Link>
            <span style={{ color: "#000000", opacity: 0.7, fontWeight: 700 }}>›</span>
            <span style={{ color: "#000000", fontWeight: 700 }}>
              {orderNumber}
            </span>
            {me?.role === "admin" && (
              <button
                type="button"
                title="Odśwież numer zlecenia (nowy numer z bieżącego miesiąca)"
                onClick={async () => {
                  if (!confirm(`Czy na pewno chcesz zmienić numer zlecenia z "${orderNumber}" na nowy numer z bieżącego miesiąca?`)) return;
                  try {
                    const result = await refreshOrderNumber({ orderId: orderIdTyped });
                    alert(`Numer zmieniony: ${result.oldName} → ${result.newName}`);
                  } catch (err) {
                    alert(`Błąd: ${err instanceof Error ? err.message : String(err)}`);
                  }
                }}
                style={{
                  background: "rgba(255,255,255,0.35)",
                  border: "1px solid rgba(0,0,0,0.15)",
                  borderRadius: 4,
                  padding: "2px 5px",
                  cursor: "pointer",
                  fontSize: 11,
                  lineHeight: 1,
                  color: "#000",
                  display: "inline-flex",
                  alignItems: "center",
                  marginLeft: 4,
                }}
              >
                ↻
              </button>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* Oś czasu - mini */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "rgba(255, 255, 255, 0.35)",
                padding: "4px 10px",
                borderRadius: 8,
                border: "1px solid rgba(0, 0, 0, 0.1)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: order.projectStartDate ? "#2563eb" : "#4b5563", flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: "#000000", fontWeight: 600, whiteSpace: "nowrap" }}>
                  {order.projectStartDate ? `Start: ${fmtLocalDate(order.projectStartDate)}` : "Start: oczekuje"}
                </span>
              </div>
              <div style={{ width: 1, height: 10, background: "rgba(0, 0, 0, 0.15)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: order.projectEndDate ? "#059669" : "#4b5563", flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: "#000000", fontWeight: 600, whiteSpace: "nowrap" }}>
                  {order.projectEndDate ? `Koniec: ${fmtLocalDate(order.projectEndDate)}` : "Koniec: w trakcie"}
                </span>
              </div>
            </div>
            <span style={{ width: 1, height: 14, background: "rgba(0, 0, 0, 0.15)", display: "inline-block" }} />

            {/* Przypisana osoba */}
            {(() => {
              const assigneesArray = Array.from(new Set([
                ...(order.assignedUserId ? [order.assignedUserId] : []),
                ...(order.assignedUserIds || [])
              ]));
              const assignedUsers = assigneesArray.map(id => assignableUsers.find((u) => u._id === id)).filter(Boolean);
              
              const assignedName = assignedUsers.length === 0
                ? null
                : assignedUsers.length === 1
                ? (assignedUsers[0]!.displayName ?? assignedUsers[0]!.login ?? "")
                : `${assignedUsers.length} osoby`;
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
                      background: "#ffffff",
                      color: "#000000",
                      border: "1px solid rgba(0, 0, 0, 0.15)",
                      fontWeight: 600,
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
                            if (!assigneesArray.includes(me._id)) {
                              void assignOrder({ orderId: orderIdTyped, assignedUserIds: [...assigneesArray, me._id] });
                            }
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
                            if (assigneesArray.includes(u._id)) {
                              void assignOrder({ orderId: orderIdTyped, assignedUserIds: assigneesArray.filter(id => id !== u._id) });
                            } else {
                              void assignOrder({ orderId: orderIdTyped, assignedUserIds: [...assigneesArray, u._id] });
                            }
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            width: "100%",
                            textAlign: "left",
                            padding: "6px 12px",
                            fontSize: 12,
                            background: assigneesArray.includes(u._id) ? "var(--panel-2)" : "transparent",
                            border: "none",
                            borderBottom: "1px solid var(--line)",
                            cursor: "pointer",
                            color: "var(--text)",
                            fontFamily: "inherit",
                            fontWeight: assigneesArray.includes(u._id) ? 600 : 400,
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--panel-2)" }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = assigneesArray.includes(u._id) ? "var(--panel-2)" : "transparent" }}
                        >
                          {u.color && (
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: u.color, flexShrink: 0 }} />
                          )}
                          <span style={{ flex: 1 }}>{u.displayName ?? u.login}</span>
                          {me && u._id === me._id && (
                            <span style={{ fontSize: 10, fontWeight: 600, color: "#2563eb", background: "#eff6ff", borderRadius: 3, padding: "1px 5px", flexShrink: 0 }}>Ty</span>
                          )}
                          {assigneesArray.includes(u._id) && (
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: "#2563eb", flexShrink: 0 }}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                        </button>
                      ))}
                      {/* Usuń przypisanie */}
                      {assigneesArray.length > 0 && (
                        <button
                          onClick={() => {
                            void assignOrder({ orderId: orderIdTyped, assignedUserIds: [] });
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
            <span style={{ width: 1, height: 14, background: "rgba(0, 0, 0, 0.15)", display: "inline-block" }} />
            {/* Drive CTA */}
            <DriveFolderButton
              folderUrl={order.folderUrl}
              createdAt={order._creationTime}
              onCreate={() => void handleCreateFolder()}
              busy={creatingFolder}
              style={{
                fontSize: 11,
                background: "#ffffff",
                color: "#000000",
                border: "1px solid rgba(0, 0, 0, 0.15)",
                fontWeight: 600,
              }}
            />
            <button
              onClick={openSmsModal}
              className="btn"
              style={{
                fontSize: 11,
                background: "#ffffff",
                color: "#000000",
                border: "1px solid rgba(0, 0, 0, 0.15)",
                fontWeight: 600,
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
                style={{
                  fontSize: 11,
                  background: "#ffffff",
                  color: "#000000",
                  border: "1px solid rgba(0, 0, 0, 0.15)",
                  fontWeight: 600,
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
                    d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
                  />
                </svg>
                Archiwizuj
              </button>
            ) : (
              <button
                onClick={() => void handleRestore()}
                className="btn"
                style={{
                  fontSize: 11,
                  background: "#ffffff",
                  color: "#000000",
                  border: "1px solid rgba(0, 0, 0, 0.15)",
                  fontWeight: 600,
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
                background: "#ffffff",
                color: "var(--bad)",
                border: "1px solid oklch(0.72 0.18 25 / 0.4)",
                fontWeight: 600,
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
                {editingCustomText ? (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <input
                      autoFocus
                      type="text"
                      value={customTextDraft}
                      onChange={(e) => setCustomTextDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = customTextDraft.trim();
                          setCustomText({ orderId: orderIdTyped, customText: val || null });
                          setEditingCustomText(false);
                        }
                        if (e.key === "Escape") setEditingCustomText(false);
                      }}
                      onBlur={() => {
                        const val = customTextDraft.trim();
                        setCustomText({ orderId: orderIdTyped, customText: val || null });
                        setEditingCustomText(false);
                      }}
                      placeholder="Tekst własny zlecenia…"
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        fontFamily: "inherit",
                        padding: "4px 8px",
                        borderRadius: 6,
                        border: "1px solid var(--accent)",
                        background: "var(--panel)",
                        color: "var(--text-strong)",
                        outline: "none",
                        boxShadow: "0 0 0 3px var(--accent-soft)",
                        width: 260,
                      }}
                    />
                  </div>
                ) : order.customText ? (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "4px 6px 4px 10px",
                      borderRadius: 8,
                      borderLeft: "3px solid var(--accent)",
                      background: "var(--accent-soft)",
                      cursor: "pointer",
                    }}
                    title="Kliknij, aby edytować"
                    onClick={() => { setCustomTextDraft(order.customText ?? ""); setEditingCustomText(true); }}
                  >
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
                    >
                      {order.customText}
                    </span>
                    <button
                      title="Usuń tekst własny"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCustomText({ orderId: orderIdTyped, customText: null });
                      }}
                      style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        background: "transparent", border: "none", cursor: "pointer",
                        color: "var(--text-mute)", padding: 2, borderRadius: 4,
                        lineHeight: 1,
                      }}
                    >
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setCustomTextDraft(""); setEditingCustomText(true); }}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      fontSize: 11.5, fontWeight: 500, color: "var(--text-mute)",
                      background: "transparent", border: "1px dashed var(--line-2)",
                      borderRadius: 6, padding: "3px 8px", cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent-line)"; e.currentTarget.style.color = "var(--accent)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--line-2)"; e.currentTarget.style.color = "var(--text-mute)"; }}
                  >
                    + Dodaj tekst własny
                  </button>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>


                <InvestmentLocation
                  orderId={orderIdTyped}
                  investmentStreet={order.investmentStreet}
                  investmentBuildingNumber={order.investmentBuildingNumber}
                  investmentApartmentNumber={order.investmentApartmentNumber}
                  investmentPostalCode={order.investmentPostalCode}
                  investmentCity={order.investmentCity}
                />

                {/* Termin montażu — popover approach to avoid layout disruption */}
                <div style={{ position: "relative", display: "inline-flex" }}>
                  {/* Pill view or "add" button — always in flow */}
                  {confirmDeleteDate ? (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 12, background: "var(--panel-2)", border: "1px solid var(--line)" }}>
                      <span style={{ fontSize: 12, color: "var(--bad)", fontWeight: 600 }}>Usunąć termin montażu?</span>
                      <button type="button" onClick={() => void deleteCompletionDate()} className="btn btn-xs" style={{ fontSize: 11, padding: "3px 10px", background: "var(--bad)", color: "#fff", borderColor: "var(--bad)" }}>Tak, usuń</button>
                      <button type="button" onClick={() => setConfirmDeleteDate(false)} className="btn btn-xs" style={{ fontSize: 11, padding: "3px 10px" }}>Anuluj</button>
                    </div>
                  ) : (order.projectEndDate || (order.installationStartDate && order.installationStartDate > 10000000)) ? (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "6px 8px 6px 6px",
                        borderRadius: 12,
                        border: editingCompletionDate ? "1px solid var(--accent-line)" : "1px solid var(--line)",
                        background: "var(--card)",
                        maxWidth: "100%",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 32,
                          height: 32,
                          borderRadius: 9,
                          background: "var(--accent-soft)",
                          color: "var(--accent)",
                          flexShrink: 0,
                        }}
                      >
                        <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                        </svg>
                      </span>

                      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: 1.25 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7, color: "var(--text-mute)" }}>
                          Termin montażu
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {(() => {
                            if (order.installationStartDate && order.installationStartDate > 10000000) {
                              return fmtLocalDate(order.installationStartDate);
                            }
                            return order.projectEndDate ? fmtLocalDate(order.projectEndDate) : "Brak daty";
                          })()}
                        </span>
                        <span style={{ fontSize: 11.5, color: "var(--text-mute)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {(() => {
                            if (order.installationStartDate && order.installationStartDate > 10000000) {
                              const d = new Date(order.installationStartDate);
                              return `${d.toLocaleDateString("pl-PL", { weekday: "short" })}, godz. ${d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}`;
                            }
                            if (order.projectEndDate) {
                              const d = new Date(order.projectEndDate);
                              let timeStr = "08:00";
                              if (order.installationStartDate !== undefined && order.installationStartDate <= 1440) {
                                const h = Math.floor(order.installationStartDate / 60).toString().padStart(2, "0");
                                const m = (order.installationStartDate % 60).toString().padStart(2, "0");
                                timeStr = `${h}:${m}`;
                              }
                              return `${d.toLocaleDateString("pl-PL", { weekday: "short" })}, godz. ${timeStr}`;
                            }
                            return "";
                          })()}
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0, marginLeft: 2 }}>
                        <button
                          type="button"
                          onClick={editingCompletionDate ? cancelEditCompletionDate : startEditCompletionDate}
                          title="Edytuj termin montażu"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            color: editingCompletionDate ? "var(--accent)" : "var(--text-mute)",
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.background = "var(--panel)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = editingCompletionDate ? "var(--accent)" : "var(--text-mute)"; e.currentTarget.style.background = "transparent"; }}
                        >
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteDate(true)}
                          title="Usuń termin montażu"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            color: "var(--text-mute)",
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--bad)"; e.currentTarget.style.background = "var(--panel)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-mute)"; e.currentTarget.style.background = "transparent"; }}
                        >
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={startEditCompletionDate}
                      title="Ustaw termin montażu"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 7,
                        padding: "6px 12px",
                        borderRadius: 999,
                        border: "1px dashed var(--line)",
                        background: "transparent",
                        color: "var(--text-mute)",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                      </svg>
                      Ustaw termin montażu
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </button>
                  )}

                  {/* Popover edit form — floats below pill */}
                  {editingCompletionDate && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        right: 0,
                        zIndex: 50,
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        padding: 16,
                        borderRadius: 14,
                        border: "1px solid #e2e8f0",
                        background: "#ffffff",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
                        width: 320,
                        minWidth: 280,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: 24,
                              height: 24,
                              borderRadius: 7,
                              background: "var(--accent-soft)",
                              color: "var(--accent)",
                              flexShrink: 0,
                            }}
                          >
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                            </svg>
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7, color: "var(--text-mute)" }}>
                            Edytuj termin
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={cancelEditCompletionDate}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            border: "none",
                            background: "transparent",
                            color: "var(--text-mute)",
                            cursor: "pointer",
                          }}
                        >
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="date"
                          value={tsToDateStr(draftCompletionDate)}
                          onChange={(e) => setDraftCompletionDate(dateStrToTs(e.target.value))}
                          style={{
                            fontSize: 13, padding: "6px 10px", borderRadius: 8,
                            border: "1px solid var(--line)", background: "var(--panel-2)",
                            color: "var(--text-strong)", fontFamily: "inherit", fontWeight: 600, flex: 1,
                          }}
                        />
                        <select
                          value={minsToHour(draftInstallationStart) ?? ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDraftInstallationStart(val !== "" ? parseInt(val) * 60 : undefined);
                          }}
                          style={{
                            fontSize: 13, padding: "6px 10px", borderRadius: 8,
                            border: "1px solid var(--line)", background: "var(--panel-2)",
                            color: "var(--text-strong)", fontFamily: "inherit", width: 100,
                          }}
                        >
                          <option value="">— godz.</option>
                          {Array.from({ length: 24 }, (_, i) => (
                            <option key={i} value={i}>{i.toString().padStart(2, "0")}:00</option>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button type="button" onClick={cancelEditCompletionDate} className="btn" style={{ fontSize: 11, padding: "5px 12px" }}>
                          Anuluj
                        </button>
                        <button type="button" onClick={() => void saveCompletionDate()} className="btn primary" style={{ fontSize: 11, padding: "5px 14px" }}>
                          Zapisz
                        </button>
                      </div>
                    </div>
                  )}
                </div>


              </div>
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
          </div>
        </div>

            {/* Zintegrowana sekcja "Usługi i wycena" */}
            <div style={{ margin: "0 16px 0", padding: "16px 20px", borderRadius: 12, background: "var(--accent-soft)", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 4, height: 20, borderRadius: 3, background: "var(--accent)", flexShrink: 0 }} />
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--accent)" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.527-.639.856-1.434.938-2.275L15.23 4.28a2.25 2.25 0 00-2.25-2.25H4.28a2.25 2.25 0 00-2.25 2.25v8.702c0 .841.329 1.636.938 2.275l3.03 2.496c.639.527 1.434.856 2.275.938L11.42 15.17z" />
                  </svg>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-strong)", textTransform: "uppercase", letterSpacing: 0.6 }}>
                    Usługi i wycena zlecenia
                  </span>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={startEditServices}
                    title="Dodaj lub zarządzaj listą usług w zleceniu"
                    className="btn"
                    style={{ fontSize: 11.5, padding: "5px 12px", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}
                  >
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    {(order.services ?? []).length > 0 ? "Zarządzaj usługami" : "Dodaj usługi"}
                  </button>


                </div>
              </div>

              {/* Panel wyboru usług z listy */}
              {servicesList.length > 0 && editingServices && (
                <div
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    border: "1px solid var(--accent-line)",
                    background: "var(--accent-soft)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7, color: "var(--accent)" }}>
                    Wybierz usługi przypisane do tego zlecenia
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {Array.from(new Set([
                      ...servicesList.map((s) => s.name),
                      ...(order.services ?? [])
                    ])).map((svcName) => {
                      const active = draftServices.includes(svcName);
                      return (
                        <button
                          key={svcName}
                          type="button"
                          onClick={() => toggleDraftService(svcName)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 7,
                            fontSize: 12.5,
                            fontWeight: 600,
                            padding: "6px 12px 6px 8px",
                            borderRadius: 10,
                            border: active ? "1px solid var(--accent)" : "1px solid var(--line)",
                            background: active ? "var(--accent)" : "var(--card)",
                            color: active ? "#fff" : "var(--text-strong)",
                            cursor: "pointer",
                            transition: "all 0.15s",
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
                              background: active ? "rgba(255,255,255,0.2)" : "var(--panel-2)",
                              color: active ? "#fff" : "var(--text-mute)",
                              flexShrink: 0,
                            }}
                          >
                            <ServiceIcon name={svcName} />
                          </span>
                          {svcName}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={saveServices} className="btn primary btn-xs" style={{ padding: "5px 14px", fontSize: 11.5 }}>
                      Zapisz usługi
                    </button>
                    <button onClick={cancelEditServices} className="btn btn-xs" style={{ padding: "5px 12px", fontSize: 11.5 }}>
                      Anuluj
                    </button>
                  </div>
                </div>
              )}

              {/* Kafelki usług i edycja inline (bez modalu) */}
              {(order.services ?? []).length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-mute)", padding: "16px", borderRadius: 10, background: "var(--panel-2)", border: "1px dashed var(--line)", textAlign: "center" }}>
                  Brak przypisanych usług w zleceniu — kliknij przycisk <strong>„Dodaj usługi”</strong> powyżej, aby dodać zakres prac i wprowadzić ich wycenę.
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 14 }}>
                  {(order.services ?? []).map((svcName) => {
                    const f = (order.serviceFinances ?? []).find((x) => x.serviceName === svcName);
                    const earnings = f?.earningsAmount;
                    const days = f?.workDays;
                    const dailyRate = earnings && days && days > 0 ? earnings / days : null;
                    const isEditingThis = editingFinanceSvc === svcName;
                    const displayFinanceInfo = isEditingThis;

                    return (
                      <div
                        key={svcName}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          padding: displayFinanceInfo ? "16px" : "10px 14px",
                          borderRadius: displayFinanceInfo ? 14 : 10,
                          background: "#fff",
                          border: isEditingThis ? "1px solid var(--accent)" : "1px solid var(--line)",
                          boxShadow: isEditingThis ? "0 4px 16px rgba(0,0,0,0.06)" : "0 1px 3px rgba(0,0,0,0.02)",
                          transition: "all 0.15s ease",
                          maxWidth: displayFinanceInfo ? 380 : 260,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, fontSize: displayFinanceInfo ? 14 : 13, color: "var(--text-strong)", minWidth: 0 }}>
                            <span style={{
                              display: "inline-flex", alignItems: "center", justifyContent: "center",
                              width: displayFinanceInfo ? 30 : 24,
                              height: displayFinanceInfo ? 30 : 24,
                              borderRadius: 8,
                              background: "var(--accent-soft)",
                              color: "var(--accent)",
                              flexShrink: 0,
                            }}>
                              <ServiceIcon name={svcName} />
                            </span>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={svcName}>
                              {svcName}
                            </span>
                          </span>

                          {displayFinanceInfo && !isEditingThis && (
                            <button
                              type="button"
                              onClick={() => startEditFinance(svcName)}
                              style={{
                                fontSize: 11, color: "var(--accent)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4,
                                background: "var(--panel)", padding: "4px 10px", borderRadius: 999, border: "1px solid var(--accent-line)",
                                cursor: "pointer", transition: "all 0.15s",
                                whiteSpace: "nowrap", flexShrink: 0,
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent)"; e.currentTarget.style.color = "#fff"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--panel)"; e.currentTarget.style.color = "var(--accent)"; }}
                            >
                              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                              Edytuj stawki
                            </button>
                          )}
                        </div>

                        {displayFinanceInfo && (
                          <>
                            {isEditingThis ? (
                              /* Formularz edycji inline */
                              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                                <div>
                                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                                    Kwota zarobku (przychód) [PLN]
                                  </label>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="np. 12500"
                                    value={draftEarnings}
                                    onChange={(e) => setDraftEarnings(e.target.value)}
                                    style={{
                                      width: "100%", fontSize: 13.5, padding: "7px 10px", borderRadius: 8,
                                      border: "1px solid var(--accent)", background: "var(--panel)", color: "var(--text-strong)",
                                      fontFamily: "monospace", fontWeight: 700,
                                    }}
                                    autoFocus
                                  />
                                </div>

                                <div>
                                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                                    Ilość dni pracy [dni]
                                  </label>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="np. 3 lub 1.5"
                                    value={draftWorkDays}
                                    onChange={(e) => setDraftWorkDays(e.target.value)}
                                    style={{
                                      width: "100%", fontSize: 13.5, padding: "7px 10px", borderRadius: 8,
                                      border: "1px solid var(--accent)", background: "var(--panel)", color: "var(--text-strong)",
                                      fontFamily: "monospace", fontWeight: 700,
                                    }}
                                  />
                                </div>

                                {/* Wyliczona dniówka na żywo */}
                                {(() => {
                                  const eVal = draftEarnings.trim() !== "" ? parseFloat(draftEarnings.replace(",", ".")) : NaN;
                                  const dVal = draftWorkDays.trim() !== "" ? parseFloat(draftWorkDays.replace(",", ".")) : NaN;
                                  const rate = !isNaN(eVal) && !isNaN(dVal) && dVal > 0 ? eVal / dVal : null;
                                  return (
                                    <div style={{ background: "var(--accent-soft)", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--accent-line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                      <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-strong)" }}>Wyliczona dniówka:</span>
                                      <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--accent)", fontFamily: "monospace" }}>
                                        {rate !== null ? `${Math.round(rate).toLocaleString("pl-PL")} zł/dzień` : "—"}
                                      </span>
                                    </div>
                                  );
                                })()}

                                <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 4 }}>
                                  <button
                                    type="button"
                                    onClick={() => void saveFinance()}
                                    className="btn primary btn-xs"
                                    style={{ padding: "5px 14px", fontSize: 11.5 }}
                                  >
                                    Zapisz
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelEditFinance}
                                    className="btn btn-xs"
                                    style={{ padding: "5px 12px", fontSize: 11.5 }}
                                  >
                                    Anuluj
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* Widok zapisanych stawek */
                              <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, background: "var(--panel-2)", padding: "10px 12px", borderRadius: 10, marginBottom: 10 }}>
                                  <div>
                                    <div style={{ fontSize: 9.5, color: "var(--text-mute)", fontWeight: 700, letterSpacing: 0.5 }}>KWOTA ZAROBKU</div>
                                    <div style={{ fontSize: 13.5, fontWeight: 700, color: earnings ? "var(--ok)" : "var(--text-mute)", fontFamily: "monospace", marginTop: 3 }}>
                                      {earnings ? `${earnings.toLocaleString("pl-PL")} zł` : "—"}
                                    </div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 9.5, color: "var(--text-mute)", fontWeight: 700, letterSpacing: 0.5 }}>DNI PRACY</div>
                                    <div style={{ fontSize: 13.5, fontWeight: 700, color: days ? "var(--text-strong)" : "var(--text-mute)", fontFamily: "monospace", marginTop: 3 }}>
                                      {days ? `${days} dni` : "—"}
                                    </div>
                                  </div>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px dashed var(--line)", paddingTop: 10 }}>
                                  <span style={{ fontSize: 11.5, color: "var(--text-mute)", fontWeight: 600 }}>Wyliczona dniówka:</span>
                                  <span style={{ fontSize: 13.5, fontWeight: 700, color: dailyRate ? "var(--accent)" : "var(--text-mute)", fontFamily: "monospace" }}>
                                    {dailyRate ? `${Math.round(dailyRate).toLocaleString("pl-PL")} zł/dzień` : "—"}
                                  </span>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

        {/* Zamówienia u dostawców oraz Lista zadań */}
        <div className="grid grid-cols-3 gap-4" style={{ padding: "16px 20px" }}>
          {/* Lewa kolumna: Zamówienia u dostawców */}
          <div style={{ background: "var(--accent-soft)", borderRadius: 12, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 4, height: 20, borderRadius: 3, background: "#f59e0b", flexShrink: 0 }} />
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="#f59e0b" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
              </svg>
              <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-strong)", textTransform: "uppercase", letterSpacing: 0.6 }}>
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
                      background: "#fff",
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
                    background: "#fff",
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

          {/* Środkowa kolumna: Lista zadań */}
          <div style={{ background: "var(--accent-soft)", borderRadius: 12, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
            <TodoSection orderId={orderIdTyped} />
          </div>

          {/* Prawa kolumna: Notatki */}
          <div style={{ background: "var(--accent-soft)", borderRadius: 12, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ width: 4, height: 20, borderRadius: 3, background: "#8b5cf6", flexShrink: 0 }} />
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="#8b5cf6" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
              <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-strong)", textTransform: "uppercase", letterSpacing: 0.6 }}>
                Notatki
              </span>
            </div>
            <Notes clientId={clientId} orderId={orderIdTyped} />
          </div>
        </div>

        {/* Czas realizacji */}
        {(() => {
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          const ord = order as any;
          if (!ord.realizationStartDate && !ord.realizationEndDate) return null;
          return (
            <div style={{ margin: "0 16px", padding: "14px 20px", borderRadius: 12, background: "var(--panel)", display: "flex", flexWrap: "wrap", gap: 32 }}>
              {ord.realizationStartDate && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Początek realizacji</div>
                  <div style={{ fontSize: 13, color: "var(--text-strong)", fontWeight: 500 }}>{fmtDateTime(ord.realizationStartDate)}</div>
                </div>
              )}
              {ord.realizationEndDate && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Koniec realizacji</div>
                  <div style={{ fontSize: 13, color: "var(--text-strong)", fontWeight: 500 }}>{fmtDateTime(ord.realizationEndDate)}</div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Tabs */}
        <div style={{ display: "flex", borderTop: "1px solid var(--line)", gap: 2 }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key || (tab.key === "finanse" && (activeTab === "faktury" || activeTab === "koszty"));
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


          {/* Pliki zlecenia — dwa gridy side-by-side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <OrderDriveBrowser
              orderId={orderIdTyped}
              rootFolderId={order.folderId}
              previewSide="left"
            />
            <OrderDriveBrowser
              orderId={orderIdTyped}
              rootFolderId={order.folderId}
              previewSide="right"
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
        </div>
      )}

      {/* ── Tab: Finanse (Faktury + Koszty) ── */}
      {(activeTab === "finanse" || activeTab === "faktury" || activeTab === "koszty") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Podsumowanie finansowe */}
          {(() => {
            const estimateInvs = (assignedInvoices ?? []).filter(
              (inv) => inv.kind === "estimate" || inv.kind === "order"
            );
            const estimateNet = estimateInvs.reduce((sum, inv) => sum + (inv.netAmount ?? 0), 0);
            const estimateGross = estimateInvs.reduce((sum, inv) => sum + (inv.grossAmount ?? 0), 0);

            const regularInvs = (assignedInvoices ?? []).filter(
              (inv) => inv.kind !== "estimate" && inv.kind !== "order"
            );
            const invNet = regularInvs.reduce((sum, inv) => sum + (inv.netAmount ?? 0), 0);
            const invGross = regularInvs.reduce((sum, inv) => sum + (inv.grossAmount ?? 0), 0);

            const expNet = (expenses ?? []).reduce((sum, exp) => sum + (exp.netAmount ?? 0), 0);
            const expGross = (expenses ?? []).reduce((sum, exp) => sum + (exp.grossAmount ?? 0), 0);

            const balNet = invNet - expNet;
            const balGross = invGross - expGross;
            const projBalNet = estimateNet - expNet;
            const projBalGross = estimateGross - expGross;

            const marginPct = invNet > 0 ? (balNet / invNet) * 100 : null;

            const vatFromRevenue = invGross - invNet;
            const vatFromExpenses = expGross - expNet;
            const vatPosition = vatFromRevenue - vatFromExpenses;

            const percentInvoiced = estimateNet > 0 ? Math.round((invNet / estimateNet) * 100) : null;
            const remainingNet = estimateNet > 0 ? Math.max(0, estimateNet - invNet) : 0;
            const remainingGross = estimateGross > 0 ? Math.max(0, estimateGross - invGross) : 0;

            const isNetto = amountView === "netto";
            const fmt = (v: number) => v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            return (
              <div className="flex flex-col gap-3">
                {/* Toggle + nagłówek */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Podsumowanie finansowe
                  </span>
                  <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
                    <button
                      onClick={() => setAmountView("netto")}
                      className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                        isNetto
                          ? "bg-white text-slate-800 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      Netto
                    </button>
                    <button
                      onClick={() => setAmountView("brutto")}
                      className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                        !isNetto
                          ? "bg-white text-slate-800 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      Brutto
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                  {/* KARTA 1: PRZYCHODY */}
                  <div className="panel p-4 flex flex-col gap-2 border border-slate-200/80 rounded-xl shadow-sm bg-white">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Przychody
                      </span>
                      {percentInvoiced !== null && (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            (isNetto ? invNet : invGross) >= (isNetto ? estimateNet : estimateGross) && estimateNet > 0
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-indigo-100 text-indigo-800"
                          }`}
                        >
                          {(isNetto ? invNet : invGross) >= (isNetto ? estimateNet : estimateGross) && estimateNet > 0
                            ? "✓ 100%"
                            : `${percentInvoiced}%`}
                        </span>
                      )}
                    </div>

                    <div className="text-2xl font-extrabold text-slate-900 tabular-nums leading-tight">
                      {fmt(isNetto ? invNet : invGross)}
                      <span className="text-sm font-normal text-slate-400 ml-1">PLN</span>
                    </div>

                    <div className="text-[11px] text-slate-400">
                      {isNetto
                        ? `Brutto: ${fmt(invGross)} PLN`
                        : `Netto: ${fmt(invNet)} PLN`}
                    </div>

                    {estimateNet > 0 && (
                      <div className="mt-auto flex flex-col gap-1">
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              invNet >= estimateNet ? "bg-emerald-500" : "bg-indigo-500"
                            }`}
                            style={{
                              width: `${Math.min(100, Math.max(2, (invNet / estimateNet) * 100))}%`,
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>
                            Zamówienie: {fmt(isNetto ? estimateNet : estimateGross)} PLN
                          </span>
                          {(isNetto ? remainingNet : remainingGross) > 0 ? (
                            <span className="font-medium text-amber-600">
                              Pozostało: {fmt(isNetto ? remainingNet : remainingGross)}
                            </span>
                          ) : (
                            <span className="font-medium text-emerald-600">✓ Zafakt. w całości</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* KARTA 2: KOSZTY */}
                  <div className="panel p-4 flex flex-col gap-2 border border-slate-200/80 rounded-xl shadow-sm bg-white">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Koszty
                      </span>
                      {invNet > 0 && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                          {Math.round(((isNetto ? expNet : expGross) / (isNetto ? invNet : invGross)) * 100)}% przychodów
                        </span>
                      )}
                    </div>

                    <div className="text-2xl font-extrabold text-slate-900 tabular-nums leading-tight">
                      {fmt(isNetto ? expNet : expGross)}
                      <span className="text-sm font-normal text-slate-400 ml-1">PLN</span>
                    </div>

                    <div className="text-[11px] text-slate-400">
                      {isNetto
                        ? `Brutto: ${fmt(expGross)} PLN`
                        : `Netto: ${fmt(expNet)} PLN`}
                    </div>

                    <div className="mt-auto text-[11px] text-slate-400">
                      {(expenses ?? []).length} pozycji kosztowych
                    </div>
                  </div>

                  {/* KARTA 3: BILANS + MARŻA */}
                  <div
                    className={`panel p-4 flex flex-col gap-2 border rounded-xl shadow-sm ${
                      (isNetto ? balNet : balGross) >= 0
                        ? "border-emerald-200 bg-emerald-50/50"
                        : "border-rose-200 bg-rose-50/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Bilans (Zysk)
                      </span>
                      {marginPct !== null && invNet > 0 && (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            marginPct >= 20
                              ? "bg-emerald-100 text-emerald-800"
                              : marginPct >= 5
                                ? "bg-amber-100 text-amber-800"
                                : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          Marża {marginPct.toFixed(1)}%
                        </span>
                      )}
                    </div>

                    <div
                      className={`text-2xl font-extrabold tabular-nums leading-tight ${
                        (isNetto ? balNet : balGross) >= 0 ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {fmt(isNetto ? balNet : balGross)}
                      <span className="text-sm font-normal text-slate-400 ml-1">PLN</span>
                    </div>

                    <div className="text-[11px] text-slate-500">
                      {isNetto
                        ? `Brutto: ${fmt(balGross)} PLN`
                        : `Netto: ${fmt(balNet)} PLN`}
                    </div>

                    {estimateNet > 0 && (
                      <div className="mt-auto text-[11px] text-slate-500">
                        Prognoza z zamówienia:{" "}
                        <span
                          className={`font-semibold ${
                            (isNetto ? projBalNet : projBalGross) >= 0
                              ? "text-emerald-700"
                              : "text-rose-700"
                          }`}
                        >
                          {fmt(isNetto ? projBalNet : projBalGross)} PLN
                        </span>
                      </div>
                    )}
                  </div>

                  {/* KARTA 4: POZYCJA VAT */}
                  <div
                    className={`panel p-4 flex flex-col gap-2 border rounded-xl shadow-sm ${
                      vatPosition > 0
                        ? "border-rose-200 bg-rose-50/40"
                        : vatPosition < 0
                          ? "border-emerald-200 bg-emerald-50/40"
                          : "border-slate-200/80 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Pozycja VAT
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          vatPosition > 0
                            ? "bg-rose-100 text-rose-800"
                            : vatPosition < 0
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {vatPosition > 0 ? "Do zapłaty" : vatPosition < 0 ? "Do zwrotu" : "Neutralna"}
                      </span>
                    </div>

                    <div
                      className={`text-2xl font-extrabold tabular-nums leading-tight ${
                        vatPosition > 0
                          ? "text-rose-700"
                          : vatPosition < 0
                            ? "text-emerald-700"
                            : "text-slate-700"
                      }`}
                    >
                      {fmt(Math.abs(vatPosition))}
                      <span className="text-sm font-normal text-slate-400 ml-1">PLN</span>
                    </div>

                    <div className="mt-auto flex flex-col gap-1 text-[11px] text-slate-500">
                      <div className="flex justify-between">
                        <span>VAT z faktur sprzedaży</span>
                        <span className="font-semibold text-slate-700">+{fmt(vatFromRevenue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>VAT z kosztów</span>
                        <span className="font-semibold text-slate-700">−{fmt(vatFromExpenses)}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-200 pt-1 mt-0.5">
                        <span className="font-bold text-slate-700">Saldo VAT</span>
                        <span
                          className={`font-bold ${
                            vatPosition > 0
                              ? "text-rose-700"
                              : vatPosition < 0
                                ? "text-emerald-700"
                                : "text-slate-700"
                          }`}
                        >
                          {vatPosition >= 0 ? "+" : "−"}{fmt(Math.abs(vatPosition))} PLN
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
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
              (() => {
                const estimateInvoices = assignedInvoices.filter(
                  (inv) => inv.kind === "estimate" || inv.kind === "order"
                );
                const regularInvoices = assignedInvoices.filter(
                  (inv) => inv.kind !== "estimate" && inv.kind !== "order"
                );
                return (
                  <div className="flex flex-col">
                    {estimateInvoices.length > 0 && (
                      <InvoicesTableGroup
                        invoices={estimateInvoices}
                        title="Zamówienie w Fakturowni (Wycena)"
                        isEstimate={true}
                        fakturowniaConfig={fakturowniaConfig}
                        setReminderInvoiceId={setReminderInvoiceId}
                        unassignInvoice={unassignInvoice}
                      />
                    )}
                    {regularInvoices.length > 0 && (
                      <InvoicesTableGroup
                        invoices={regularInvoices}
                        title="Wystawione Faktury"
                        isEstimate={false}
                        fakturowniaConfig={fakturowniaConfig}
                        setReminderInvoiceId={setReminderInvoiceId}
                        unassignInvoice={unassignInvoice}
                      />
                    )}
                  </div>
                );
              })()
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

          {/* Koszty zlecenia (Fakturownia) */}
          <SectionCard
            title="Koszty zlecenia (Fakturownia)"
            action={
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddCustomExpenseModal(true)}
                  className="btn-outline"
                  style={{ fontSize: 11, padding: "6px 12px", height: "auto" }}
                >
                  <svg
                    width="12"
                    height="12"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    className="mr-1"
                    style={{ display: "inline-block" }}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4.5v15m7.5-7.5h-15"
                    />
                  </svg>
                  Dodaj wydatek
                </button>
                <button
                  onClick={() => setShowExpenseModal(true)}
                  className="btn"
                  style={{ fontSize: 11, padding: "6px 12px", height: "auto" }}
                >
                  <svg
                    width="12"
                    height="12"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    className="mr-1"
                    style={{ display: "inline-block" }}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
                    />
                  </svg>
                  Przypisz z Fakturowni
                </button>
              </div>
            }
          >
            {expenses === undefined ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-mute)", fontSize: 13 }}>
                Ładowanie wydatków...
              </div>
            ) : expenses.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center" }}>
                <p style={{ margin: 0, color: "var(--text-mute)", fontSize: 13, marginBottom: 12 }}>
                  Brak powiązanych wydatków z tym zleceniem.
                </p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => setShowAddCustomExpenseModal(true)}
                    className="btn-outline"
                    style={{ fontSize: 12 }}
                  >
                    Dodaj wydatek
                  </button>
                  <button
                    onClick={() => setShowExpenseModal(true)}
                    className="btn"
                    style={{ fontSize: 12 }}
                  >
                    Przypisz z Fakturowni
                  </button>
                </div>
              </div>
            ) : (
              <ExpensesTableGroup
                expenses={expenses}
                fakturowniaConfig={fakturowniaConfig}
                categories={expenseCategories ?? []}
                onSelectExpense={(exp) => {
                  const isCustom = exp.remoteId.startsWith("custom_");
                  setSelectedExpense(exp);
                  setEditExpenseCategory(exp.categoryId ?? "");
                  if (isCustom) {
                    setEditExpenseTitle(exp.number ?? "");
                    setEditExpenseAmount(exp.grossAmount?.toString() ?? "");
                    setEditExpenseInputMode("brutto");
                    setEditExpenseDate(exp.issueDate ?? "");
                    // Derive VAT rate
                    const g = exp.grossAmount;
                    const n = exp.netAmount;
                    if (g && n && g !== 0) {
                      const rate = Math.round((g / n - 1) * 100);
                      setEditExpenseVatRate(rate.toString());
                    } else {
                      setEditExpenseVatRate("23");
                    }
                  } else {
                    setEditExpenseTitle("");
                    setEditExpenseAmount("");
                    setEditExpenseDate("");
                    setEditExpenseVatRate("23");
                  }
                }}
              />
            )}
          </SectionCard>
        </div>
      )}

      {/* ── Tab: Dokumenty ── */}
      {activeTab === "dokumenty" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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

      
      {/* Modal: Custom Expense */}
      <SideDrawer
        open={showAddCustomExpenseModal}
        onClose={() => {
          setShowAddCustomExpenseModal(false);
          setCustomExpenseTitle("");
          setCustomExpenseAmount("");
          setCustomExpenseVatRate("23");
          setCustomExpenseInputMode("netto");
          setCustomExpenseDate(new Date().toISOString().split("T")[0]);
          setCustomExpenseCategory("");
        }}
        title="Dodaj własny wydatek"
        width={400}
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              onClick={() => {
                setShowAddCustomExpenseModal(false);
                setCustomExpenseTitle("");
                setCustomExpenseAmount("");
                setCustomExpenseVatRate("23");
                setCustomExpenseInputMode("netto");
                setCustomExpenseDate(new Date().toISOString().split("T")[0]);
                setCustomExpenseCategory("");
              }}
            >
              Anuluj
            </button>
            <button
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!customExpenseTitle.trim() || !customExpenseAmount.trim() || !customExpenseCategory}
              onClick={async () => {
                try {
                  let grossVal = 0;
                  let netVal = 0;
                  if (customExpenseInputMode === "brutto") {
                    grossVal = parseFloat(customExpenseAmount);
                    netVal = calculateNet(customExpenseAmount, customExpenseVatRate);
                  } else {
                    netVal = parseFloat(customExpenseAmount);
                    grossVal = calculateGross(customExpenseAmount, customExpenseVatRate);
                  }

                  if (isNaN(grossVal) || isNaN(netVal)) {
                    throw new Error("Wprowadź poprawną kwotę");
                  }

                  await addCustomExpense({
                    orderId: orderIdTyped,
                    title: customExpenseTitle.trim(),
                    grossAmount: grossVal,
                    netAmount: netVal,
                    issueDate: customExpenseDate || undefined,
                    categoryId: customExpenseCategory ? (customExpenseCategory as Id<"expenseCategories">) : undefined,
                  });
                  setShowAddCustomExpenseModal(false);
                  setCustomExpenseTitle("");
                  setCustomExpenseAmount("");
                  setCustomExpenseVatRate("23");
                  setCustomExpenseInputMode("netto");
                  setCustomExpenseDate(new Date().toISOString().split("T")[0]);
                  setCustomExpenseCategory("");
                } catch (err) {
                  alert(err instanceof Error ? err.message : String(err));
                }
              }}
            >
              Dodaj wydatek
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-4 p-5">
          <p className="text-sm text-gray-500 m-0">
            Dodaj wydatek ręcznie (np. koszt, który nie ma faktury z Fakturowni). Zostanie on przypisany do tego zlecenia.
          </p>
          
          {/* Przełącznik Netto / Brutto we wprowadzaniu */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Wprowadzana kwota</label>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 w-full">
              <button
                onClick={() => {
                  setCustomExpenseInputMode("brutto");
                  setCustomExpenseAmount("");
                }}
                className={`flex-1 rounded-md py-1.5 text-xs font-semibold text-center transition-all ${
                  customExpenseInputMode === "brutto"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Brutto
              </button>
              <button
                onClick={() => {
                  setCustomExpenseInputMode("netto");
                  setCustomExpenseAmount("");
                }}
                className={`flex-1 rounded-md py-1.5 text-xs font-semibold text-center transition-all ${
                  customExpenseInputMode === "netto"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Netto
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Tytuł / Nazwa wydatku *</label>
            <input
              type="text"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={customExpenseTitle}
              onChange={(e) => setCustomExpenseTitle(e.target.value)}
              placeholder="np. Paliwo, Materiały pomocnicze"
            />
          </div>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">
              {customExpenseInputMode === "brutto" ? "Kwota brutto (PLN) *" : "Kwota netto (PLN) *"}
            </label>
            <input
              type="number"
              step="0.01"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={customExpenseAmount}
              onChange={(e) => setCustomExpenseAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Stawka VAT</label>
            <select
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              value={customExpenseVatRate}
              onChange={(e) => setCustomExpenseVatRate(e.target.value)}
            >
              <option value="23">23%</option>
              <option value="8">8%</option>
              <option value="5">5%</option>
              <option value="0">0%</option>
              <option value="exempt">Zwolniony / Bez VAT</option>
            </select>
            {customExpenseAmount && !isNaN(parseFloat(customExpenseAmount)) && (
              <div className="text-xs text-slate-500 mt-0.5">
                {customExpenseInputMode === "brutto" ? (
                  <>
                    Obliczona kwota netto:{" "}
                    <span className="font-semibold text-slate-700">
                      {calculateNet(customExpenseAmount, customExpenseVatRate).toLocaleString("pl-PL", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      PLN
                    </span>
                  </>
                ) : (
                  <>
                    Obliczona kwota brutto:{" "}
                    <span className="font-semibold text-slate-700">
                      {calculateGross(customExpenseAmount, customExpenseVatRate).toLocaleString("pl-PL", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      PLN
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Data wydatku</label>
            <input
              type="date"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={customExpenseDate}
              onChange={(e) => setCustomExpenseDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Kategoria wydatku *</label>
            <select
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              value={customExpenseCategory}
              onChange={(e) => setCustomExpenseCategory(e.target.value)}
            >
              <option value="">Wybierz kategorię...</option>
              {expenseCategories?.map((cat) => (
                <option key={cat._id} value={cat._id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </SideDrawer>

      {/* Drawer: Szczegóły / Edycja Wydatku */}
      <SideDrawer
        open={!!selectedExpense}
        onClose={() => {
          setSelectedExpense(null);
          setEditExpenseTitle("");
          setEditExpenseAmount("");
          setEditExpenseVatRate("23");
          setEditExpenseInputMode("brutto");
          setEditExpenseDate("");
          setEditExpenseCategory("");
        }}
        title={selectedExpense?.remoteId.startsWith("custom_") ? "Edycja wydatku" : "Szczegóły wydatku"}
        width={400}
        footer={
          <div className="flex items-center justify-between w-full">
            {selectedExpense?.remoteId.startsWith("custom_") ? (
              <button
                className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
                onClick={async () => {
                  if (selectedExpense && confirm("Czy na pewno chcesz usunąć ten wydatek?")) {
                    try {
                      await deleteCustomExpense({ expenseId: selectedExpense._id });
                      setSelectedExpense(null);
                    } catch (err) {
                      alert(err instanceof Error ? err.message : String(err));
                    }
                  }
                }}
              >
                Usuń
              </button>
            ) : selectedExpense ? (
              <button
                className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
                onClick={async () => {
                  if (confirm("Czy na pewno chcesz odpiąć ten wydatek od zlecenia?")) {
                    try {
                      await unassignExpense({ expenseId: selectedExpense._id });
                      setSelectedExpense(null);
                    } catch (err) {
                      alert(err instanceof Error ? err.message : String(err));
                    }
                  }
                }}
              >
                Odepnij od zlecenia
              </button>
            ) : <div />}

            <div className="flex items-center gap-3">
              <button
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                onClick={() => {
                  setSelectedExpense(null);
                  setEditExpenseTitle("");
                  setEditExpenseAmount("");
                  setEditExpenseVatRate("23");
                  setEditExpenseInputMode("brutto");
                  setEditExpenseDate("");
                  setEditExpenseCategory("");
                }}
              >
                Anuluj
              </button>
              <button
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!editExpenseCategory || (selectedExpense?.remoteId.startsWith("custom_") && (!editExpenseTitle.trim() || !editExpenseAmount.trim()))}
                onClick={async () => {
                  if (!selectedExpense) return;
                  try {
                    const isCustom = selectedExpense.remoteId.startsWith("custom_");
                    const catId = editExpenseCategory ? (editExpenseCategory as Id<"expenseCategories">) : undefined;
                    if (isCustom) {
                      let grossVal = 0;
                      let netVal = 0;
                      if (editExpenseInputMode === "brutto") {
                        grossVal = parseFloat(editExpenseAmount);
                        netVal = calculateNet(editExpenseAmount, editExpenseVatRate);
                      } else {
                        netVal = parseFloat(editExpenseAmount);
                        grossVal = calculateGross(editExpenseAmount, editExpenseVatRate);
                      }

                      if (isNaN(grossVal) || isNaN(netVal)) {
                        throw new Error("Wprowadź poprawną kwotę");
                      }

                      await updateCustomExpense({
                        expenseId: selectedExpense._id,
                        title: editExpenseTitle.trim(),
                        grossAmount: grossVal,
                        netAmount: netVal,
                        issueDate: editExpenseDate || undefined,
                        categoryId: catId,
                      });
                    } else {
                      await assignCategory({
                        expenseId: selectedExpense._id,
                        categoryId: catId,
                      });
                    }
                    setSelectedExpense(null);
                  } catch (err) {
                    alert(err instanceof Error ? err.message : String(err));
                  }
                }}
              >
                Zapisz
              </button>
            </div>
          </div>
        }
      >
        {selectedExpense && (
          <div className="flex flex-col gap-4 p-5">
            {selectedExpense.remoteId.startsWith("custom_") ? (
              <>
                {/* Ręczny koszt - pełna edycja */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Wprowadzana kwota</label>
                  <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 w-full">
                    <button
                      onClick={() => {
                        setEditExpenseInputMode("brutto");
                        setEditExpenseAmount("");
                      }}
                      className={`flex-1 rounded-md py-1.5 text-xs font-semibold text-center transition-all ${
                        editExpenseInputMode === "brutto"
                          ? "bg-white text-slate-800 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      Brutto
                    </button>
                    <button
                      onClick={() => {
                        setEditExpenseInputMode("netto");
                        setEditExpenseAmount("");
                      }}
                      className={`flex-1 rounded-md py-1.5 text-xs font-semibold text-center transition-all ${
                        editExpenseInputMode === "netto"
                          ? "bg-white text-slate-800 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      Netto
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Tytuł / Nazwa wydatku *</label>
                  <input
                    type="text"
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    value={editExpenseTitle}
                    onChange={(e) => setEditExpenseTitle(e.target.value)}
                    placeholder="np. Paliwo, Materiały pomocnicze"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    {editExpenseInputMode === "brutto" ? "Kwota brutto (PLN) *" : "Kwota netto (PLN) *"}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    value={editExpenseAmount}
                    onChange={(e) => setEditExpenseAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Stawka VAT</label>
                  <select
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none bg-white"
                    value={editExpenseVatRate}
                    onChange={(e) => setEditExpenseVatRate(e.target.value)}
                  >
                    <option value="23">23%</option>
                    <option value="8">8%</option>
                    <option value="5">5%</option>
                    <option value="0">0%</option>
                    <option value="exempt">Zwolniony / Bez VAT</option>
                  </select>
                  {editExpenseAmount && !isNaN(parseFloat(editExpenseAmount)) && (
                    <div className="text-xs text-slate-500 mt-0.5">
                      {editExpenseInputMode === "brutto" ? (
                        <>
                          Obliczona kwota netto:{" "}
                          <span className="font-semibold text-slate-700">
                            {calculateNet(editExpenseAmount, editExpenseVatRate).toLocaleString("pl-PL", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            PLN
                          </span>
                        </>
                      ) : (
                        <>
                          Obliczona kwota brutto:{" "}
                          <span className="font-semibold text-slate-700">
                            {calculateGross(editExpenseAmount, editExpenseVatRate).toLocaleString("pl-PL", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            PLN
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Data wydatku</label>
                  <input
                    type="date"
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    value={editExpenseDate}
                    onChange={(e) => setEditExpenseDate(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <>
                {/* Koszt z Fakturowni - tylko do odczytu */}
                <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-sm">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Numer</span>
                    <p className="font-semibold text-slate-800 m-0 mt-0.5 font-mono">{selectedExpense.number || "—"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sprzedawca</span>
                    <p className="font-semibold text-slate-800 m-0 mt-0.5 truncate" title={selectedExpense.sellerName}>{selectedExpense.sellerName || "—"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</span>
                    <p className="m-0 mt-0.5">
                      {selectedExpense.status ? (
                        <span
                          style={{
                            ...(STATUS_STYLES[selectedExpense.status] || {
                              background: "#f3f4f6",
                              color: "#475569",
                              border: "1px solid #cbd5e1",
                            }),
                            padding: "2px 6px",
                            borderRadius: "9999px",
                            fontSize: "11px",
                            fontWeight: 600,
                            display: "inline-block",
                          }}
                        >
                          {STATUS_LABELS[selectedExpense.status] ?? selectedExpense.status}
                        </span>
                      ) : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Data</span>
                    <p className="font-semibold text-slate-800 m-0 mt-0.5">
                      {selectedExpense.issueDate ? new Date(selectedExpense.issueDate).toLocaleDateString("pl-PL") : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Netto</span>
                    <p className="font-bold text-slate-800 m-0 mt-0.5 tabular-nums">
                      {selectedExpense.netAmount != null ? `${selectedExpense.netAmount.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} ${selectedExpense.currency ?? "PLN"}` : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Brutto</span>
                    <p className="font-semibold text-slate-500 m-0 mt-0.5 tabular-nums">
                      {selectedExpense.grossAmount != null ? `${selectedExpense.grossAmount.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} ${selectedExpense.currency ?? "PLN"}` : "—"}
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Wspólne pole: Kategoria */}
            <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-4">
              <label className="text-sm font-semibold text-gray-800">Kategoria wydatku *</label>
              <select
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none bg-white"
                value={editExpenseCategory}
                onChange={(e) => setEditExpenseCategory(e.target.value)}
              >
                <option value="">Wybierz kategorię...</option>
                {expenseCategories?.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </SideDrawer>

      {showExpenseModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => {
            setShowExpenseModal(false);
            setExpenseSearch("");
          }}
        >
          <div
            className="relative flex h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Przypisz wydatki do zlecenia
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">{orderNumber}</p>
              </div>
              <button
                onClick={() => {
                  setShowExpenseModal(false);
                  setExpenseSearch("");
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
                  value={expenseSearch}
                  onChange={(e) => setExpenseSearch(e.target.value)}
                  placeholder="Szukaj po numerze lub sprzedawcy…"
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3">
              {allExpenses === undefined ? (
                <div className="py-8 text-center text-sm text-gray-400">
                  Ładowanie wydatków…
                </div>
              ) : (
                <div className="space-y-1">
                  {allExpenses
                    .filter((exp) => {
                      const q = expenseSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        (exp.number ?? "").toLowerCase().includes(q) ||
                        (exp.sellerName ?? "").toLowerCase().includes(q)
                      );
                    })
                    .sort((a, b) => {
                      const rank = (exp: CachedExpense) =>
                        exp.orderId === orderIdTyped
                          ? 0
                          : !exp.orderId
                            ? 1
                            : 2;
                      return rank(a) - rank(b);
                    })
                    .map((exp) => {
                      const isAssignedHere = exp.orderId === orderIdTyped;
                      const isAssignedElsewhere =
                        !!exp.orderId && exp.orderId !== orderIdTyped;
                      return (
                        <div
                          key={exp._id}
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
                                {exp.number ?? `#${exp.remoteId}`}
                              </span>
                              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                                Wydatek
                              </span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                              {exp.sellerName && (
                                <span className="truncate">
                                  {exp.sellerName}
                                </span>
                              )}
                              {exp.grossAmount != null && (
                                <span className="shrink-0 tabular-nums">
                                  {exp.grossAmount.toLocaleString("pl-PL", {
                                    minimumFractionDigits: 2,
                                  })}{" "}
                                  {exp.currency ?? "PLN"}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="ml-3 shrink-0">
                            {isAssignedHere ? (
                              <button
                                onClick={() =>
                                  unassignExpense({ expenseId: exp._id })
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
                                  assignExpense({
                                    expenseId: exp._id,
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

      {/* Warning/Constraint Alert Modal ("Potykacz") */}
      {warningModalText && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setWarningModalText(null)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Accent Bar */}
            <div className="bg-amber-500 h-1.5 w-full" />
            
            <div className="p-6">
              <div className="flex items-start gap-4">
                {/* Icon Container */}
                <div className="flex-shrink-0 bg-amber-50 rounded-full p-2.5 text-amber-600">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                
                {/* Content */}
                <div className="flex-grow min-w-0">
                  <h3 className="text-base font-bold text-slate-900 leading-6">
                    Wymagane wykonanie zadań
                  </h3>
                  <div className="mt-2 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {warningModalText}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setWarningModalText(null)}
                  className="rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-xs font-semibold shadow transition-colors"
                >
                  Rozumiem
                </button>
              </div>
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

