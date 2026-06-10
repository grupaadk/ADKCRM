"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import TaskDrawer from "@/components/TaskDrawer";
import CreateOrderTaskDrawer from "@/components/CreateOrderTaskDrawer";

/* ── kolumny kanbanu (identyczne jak w zleceniu) ── */
const KANBAN_COLS = [
  { key: "todo" as const,        label: "Do zrobienia", accent: "#64748b", headerBg: "#f8fafc", colBg: "#f8fafc", border: "#e2e8f0" },
  { key: "in_progress" as const, label: "W trakcie",    accent: "#2563eb", headerBg: "#eff6ff", colBg: "#f5f9ff", border: "#bfdbfe" },
  { key: "done" as const,        label: "Gotowe",       accent: "#16a34a", headerBg: "#f0fdf4", colBg: "#f7fdf9", border: "#bbf7d0" },
];
type StatusKey = (typeof KANBAN_COLS)[number]["key"];

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
  currentUserId,
}: {
  value: string;
  onChange: (id: string) => void;
  users: AssignableUser[];
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
        title={selName ?? "Przypisz osobę"}
        style={{ display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
      >
        {sel ? (
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
            border: "1px dashed var(--line)", borderRadius: 4, padding: "1px 6px",
          }}>
            +osoba
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 300,
          background: "var(--panel)", border: "1px solid var(--line)",
          borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
          minWidth: 180, overflow: "hidden", padding: "4px 0",
        }}>
          <button type="button" onClick={() => { onChange(""); setOpen(false); }}
            style={{
              display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "7px 12px",
              background: !value ? "var(--panel-2)" : "none", border: "none", cursor: "pointer",
              fontSize: 12.5, color: "var(--text-mute)", fontFamily: "inherit", textAlign: "left",
            }}
          >
            <div style={{
              width: 22, height: 22, borderRadius: "50%", border: "1.5px dashed var(--line)",
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
                  display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "7px 12px",
                  background: value === u._id ? "var(--panel-2)" : "none", border: "none", cursor: "pointer",
                  fontSize: 12.5, color: "var(--text)", fontFamily: "inherit", textAlign: "left",
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", background: uColor(u._id),
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
  status: StatusKey;
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
  colKey: StatusKey;
  colIdx: number;
  users: AssignableUser[];
  now: number;
  currentUserId?: string;
  onMove: (dir: "prev" | "next") => void;
  onRemove: () => void;
  onUpdate: (args: { title?: string; assignedUserId?: Id<"users">; clearAssignee?: boolean; dueDate?: number; clearDueDate?: boolean }) => void;
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

  const dueDateStr = task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : "";

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
        background: "var(--panel)", borderRadius: 7, border: "1px solid var(--line)",
        padding: "9px 10px 8px",
        boxShadow: hovered && !editingTitle ? "0 2px 8px rgba(0,0,0,0.08)" : "0 1px 2px rgba(0,0,0,0.04)",
        cursor: editingTitle ? "default" : "pointer", transition: "box-shadow 0.12s", userSelect: "none",
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
            width: "100%", resize: "none", border: "none", background: "transparent",
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

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", minHeight: 22 }}>
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
              fontSize: 11, border: "1px solid var(--line)", borderRadius: 4, padding: "1px 5px",
              background: "var(--panel-2)", color: "var(--text)", fontFamily: "inherit",
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
              padding: "1px 6px", borderRadius: 4, cursor: "pointer", fontFamily: "inherit",
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
              fontSize: 10.5, color: "var(--text-mute)", background: "none",
              border: "1px dashed var(--line)", padding: "1px 6px", borderRadius: 4,
              cursor: "pointer", fontFamily: "inherit", opacity: 0.6,
            }}
          >
            <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
            </svg>
            Termin
          </button>
        ) : null}

        <span onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex" }}>
          <UserPickerDropdown
            value={task.assignedUserId ?? ""}
            onChange={handleAssigneeChange}
            users={users}
            currentUserId={currentUserId}
          />
        </span>

        <div style={{ flex: 1 }} />

        {hovered && (
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {colIdx > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); onMove("prev"); }}
                title="Przenieś w lewo"
                style={{ background: "var(--panel-2)", border: "1px solid var(--line)", cursor: "pointer", color: "var(--text-mute)", padding: "1px 5px", borderRadius: 4, fontSize: 14, lineHeight: 1, fontFamily: "inherit" }}
              >‹</button>
            )}
            {colIdx < 2 && (
              <button
                onClick={(e) => { e.stopPropagation(); onMove("next"); }}
                title="Przenieś w prawo"
                style={{ background: "var(--panel-2)", border: "1px solid var(--line)", cursor: "pointer", color: "var(--text-mute)", padding: "1px 5px", borderRadius: 4, fontSize: 14, lineHeight: 1, fontFamily: "inherit" }}
              >›</button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              title="Usuń zadanie"
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-mute)", padding: "2px 3px", borderRadius: 4, display: "flex", alignItems: "center", opacity: 0.5 }}
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

/**
 * Współdzielony kanban "Lista zadań" — dla zlecenia albo szansy sprzedaży.
 * Przekaż dokładnie jedno: `orderId` albo `opportunityId`.
 */
export default function TaskKanban({
  orderId,
  opportunityId,
}: {
  orderId?: Id<"orders">;
  opportunityId?: Id<"pendingJotformSubmissions">;
}) {
  const orderTasks = useQuery(
    api.orderTasks.listByOrder,
    orderId ? { orderId } : "skip",
  );
  const oppTasks = useQuery(
    api.orderTasks.listByOpportunity,
    opportunityId ? { opportunityId } : "skip",
  );
  const tasks = orderId ? orderTasks : oppTasks;

  const salesUsers = useQuery(api.users.listAssignable) ?? [];
  const me = useQuery(api.users.me);
  const updateTask = useMutation(api.orderTasks.update);
  const removeTask = useMutation(api.orderTasks.remove);

  const [createInStatus, setCreateInStatus] = useState<StatusKey | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<Id<"orderTasks"> | null>(null);

  async function handleMove(taskId: Id<"orderTasks">, from: string, dir: "prev" | "next") {
    const order = ["todo", "in_progress", "done"];
    const idx = order.indexOf(from);
    const next = dir === "next" ? idx + 1 : idx - 1;
    if (next < 0 || next >= order.length) return;
    await updateTask({ taskId, status: order[next] as StatusKey });
  }

  async function handleDrop(targetCol: StatusKey, e: React.DragEvent) {
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
          <span style={{ fontSize: 10, fontWeight: 700, background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: 10, padding: "1px 7px" }}>
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
                minHeight: 120, transition: "background 0.15s",
                outline: dragOverCol === col.key ? `2px solid ${col.accent}` : "none",
                outlineOffset: -2,
              }}
            >
              {/* Column header */}
              <div style={{ padding: "8px 10px", background: col.headerBg, borderBottom: `1px solid ${col.border}`, display: "flex", alignItems: "center", gap: 6 }}>
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

                <button
                  onClick={() => setCreateInStatus(col.key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 4, padding: "5px 8px", fontSize: 12,
                    color: "var(--text-mute)", background: "none", border: "none",
                    cursor: "pointer", borderRadius: 5, width: "100%", textAlign: "left",
                    fontFamily: "inherit", marginTop: 2,
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
        opportunityId={opportunityId}
        initialStatus={createInStatus}
        onClose={() => setCreateInStatus(null)}
      />
    </section>
  );
}
