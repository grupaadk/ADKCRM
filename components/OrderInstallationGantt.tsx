"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutList,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";

const MS_PER_DAY = 86_400_000;

export interface InstallationTeamLite {
  _id: Id<"installationTeams">;
  name: string;
  color?: string;
}

interface OrderInstallationGanttProps {
  orderId: Id<"orders">;
  defaultTeamId?: Id<"installationTeams">;
  installationTeams: InstallationTeamLite[];
}

type StageStatus = "planned" | "in_progress" | "done";

const STATUS_META: Record<
  StageStatus,
  { label: string; badgeBg: string; badgeText: string; badgeBorder: string }
> = {
  planned: {
    label: "Zaplanowane",
    badgeBg: "rgba(59, 130, 246, 0.10)",
    badgeText: "#1d4ed8",
    badgeBorder: "rgba(59, 130, 246, 0.30)",
  },
  in_progress: {
    label: "W trakcie",
    badgeBg: "rgba(245, 158, 11, 0.14)",
    badgeText: "#b45309",
    badgeBorder: "rgba(245, 158, 11, 0.35)",
  },
  done: {
    label: "Zakończone",
    badgeBg: "rgba(16, 185, 129, 0.14)",
    badgeText: "#047857",
    badgeBorder: "rgba(16, 185, 129, 0.35)",
  },
};

function normalizeDayStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function addDays(ts: number, days: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function diffDays(startTs: number, endTs: number): number {
  return Math.round((normalizeDayStart(endTs) - normalizeDayStart(startTs)) / MS_PER_DAY);
}

function tsToDateInput(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateInputToTs(str: string): number {
  if (!str) return normalizeDayStart(Date.now());
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0).getTime();
}

function formatDayShort(ts: number): string {
  return new Date(ts).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatHour(mins?: number, fallback = 480): string {
  const v = mins ?? fallback;
  const h = Math.floor(v / 60)
    .toString()
    .padStart(2, "0");
  const m = (v % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function OrderInstallationGantt({
  orderId,
  defaultTeamId,
  installationTeams,
}: OrderInstallationGanttProps) {
  const stages = useQuery(api.installationGantt.listByOrder, { orderId });
  const createStage = useMutation(api.installationGantt.createStage);
  const seedPresetStages = useMutation(api.installationGantt.seedPresetStages);
  const updateStage = useMutation(api.installationGantt.updateStage);
  const reorderStages = useMutation(api.installationGantt.reorderStages);
  const removeStage = useMutation(api.installationGantt.removeStage);

  const [viewMode, setViewMode] = useState<"gantt" | "list">("gantt");
  const [dayWidth, setDayWidth] = useState<44 | 28>(44);
  const [timelineAnchor, setTimelineAnchor] = useState<number>(() =>
    addDays(normalizeDayStart(Date.now()), -3)
  );
  const timelineDaysCount = dayWidth === 44 ? 28 : 42;
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);

  // Stan tworzenia nowego etapu
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newStartDate, setNewStartDate] = useState<number>(() => normalizeDayStart(Date.now()));
  const [newEndDate, setNewEndDate] = useState<number>(() => normalizeDayStart(Date.now()));
  const [newStartMins, setNewStartMins] = useState<number>(480);
  const [newEndMins, setNewEndMins] = useState<number>(960);
  const [newTeamId, setNewTeamId] = useState<Id<"installationTeams"> | undefined>(defaultTeamId);
  const [newNote, setNewNote] = useState("");
  const [savingNew, setSavingNew] = useState(false);

  // Stan edycji wybranego etapu (drawer/modal)
  const [editingStageId, setEditingStageId] = useState<Id<"orderInstallationStages"> | null>(null);
  const editingStage = useMemo(
    () => stages?.find((s) => s._id === editingStageId) ?? null,
    [stages, editingStageId]
  );
  const [editTitle, setEditTitle] = useState("");
  const [editStartDate, setEditStartDate] = useState<number>(0);
  const [editEndDate, setEditEndDate] = useState<number>(0);
  const [editStartMins, setEditStartMins] = useState<number>(480);
  const [editEndMins, setEditEndMins] = useState<number>(960);
  const [editTeamId, setEditTeamId] = useState<Id<"installationTeams"> | undefined>(undefined);
  const [editStatus, setEditStatus] = useState<StageStatus>("planned");
  const [editNote, setEditNote] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (!editingStage) return;
    setEditTitle(editingStage.title);
    setEditStartDate(editingStage.startDate);
    setEditEndDate(editingStage.endDate);
    setEditStartMins(editingStage.startMins ?? 480);
    setEditEndMins(editingStage.endMins ?? 960);
    setEditTeamId(editingStage.installationTeamId);
    setEditStatus(editingStage.status);
    setEditNote(editingStage.note ?? "");
  }, [editingStage]);

  // Stan przeciągania / rozciągania paska na Gantcie
  const [dragState, setDragState] = useState<{
    stageId: Id<"orderInstallationStages">;
    mode: "move" | "resize-left" | "resize-right";
    originClientX: number;
    origStart: number;
    origEnd: number;
    previewStart: number;
    previewEnd: number;
    hasMoved: boolean;
  } | null>(null);

  useEffect(() => {
    if (!dragState) return;

    const handlePointerMove = (e: PointerEvent) => {
      const dx = e.clientX - dragState.originClientX;
      const deltaDays = Math.round(dx / dayWidth);
      const hasMoved = dragState.hasMoved || Math.abs(dx) > 4;

      let previewStart = dragState.origStart;
      let previewEnd = dragState.origEnd;

      if (dragState.mode === "move") {
        previewStart = addDays(dragState.origStart, deltaDays);
        previewEnd = addDays(dragState.origEnd, deltaDays);
      } else if (dragState.mode === "resize-left") {
        const candidate = addDays(dragState.origStart, deltaDays);
        previewStart = Math.min(candidate, dragState.origEnd);
      } else if (dragState.mode === "resize-right") {
        const candidate = addDays(dragState.origEnd, deltaDays);
        previewEnd = Math.max(candidate, dragState.origStart);
      }

      setDragState((prev) =>
        prev
          ? {
              ...prev,
              previewStart,
              previewEnd,
              hasMoved,
            }
          : null
      );
    };

    const handlePointerUp = () => {
      const current = dragState;
      setDragState(null);
      if (!current) return;
      if (!current.hasMoved) {
        setEditingStageId(current.stageId);
        return;
      }
      if (
        current.previewStart !== current.origStart ||
        current.previewEnd !== current.origEnd
      ) {
        void updateStage({
          stageId: current.stageId,
          startDate: current.previewStart,
          endDate: current.previewEnd,
        });
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState, dayWidth, updateStage]);

  // Automatyczne wycentrowanie osi czasu przy pierwszym załadowaniu etapów
  const initializedAnchorRef = useRef(false);
  useEffect(() => {
    if (initializedAnchorRef.current || !stages || stages.length === 0) return;
    initializedAnchorRef.current = true;
    const minStart = Math.min(...stages.map((s) => s.startDate));
    setTimelineAnchor(addDays(minStart, -2));
  }, [stages]);

  const teamMap = useMemo(
    () => new Map(installationTeams.map((t) => [t._id, t])),
    [installationTeams]
  );

  const todayTs = normalizeDayStart(Date.now());

  const timelineDays = useMemo(() => {
    return Array.from({ length: timelineDaysCount }).map((_, idx) => {
      const ts = addDays(timelineAnchor, idx);
      const d = new Date(ts);
      const wd = d.getDay();
      return {
        ts,
        dayNum: d.getDate(),
        weekdayShort: d.toLocaleDateString("pl-PL", { weekday: "short" }).replace(".", ""),
        monthLabel: d.toLocaleDateString("pl-PL", { month: "short", year: "numeric" }),
        isWeekend: wd === 0 || wd === 6,
        isToday: ts === todayTs,
      };
    });
  }, [timelineAnchor, timelineDaysCount, todayTs]);

  // Podsumowanie harmonogramu
  const summary = useMemo(() => {
    if (!stages || stages.length === 0) {
      return { total: 0, done: 0, conflictsCount: 0, spanDays: 0, spanLabel: "Brak etapów" };
    }
    const minStart = Math.min(...stages.map((s) => s.startDate));
    const maxEnd = Math.max(...stages.map((s) => s.endDate));
    const spanDays = diffDays(minStart, maxEnd) + 1;
    const done = stages.filter((s) => s.status === "done").length;
    const conflictsCount = stages.filter((s) => s.conflicts.length > 0).length;
    return {
      total: stages.length,
      done,
      conflictsCount,
      spanDays,
      spanLabel: `${formatDayShort(minStart)} – ${formatDayShort(maxEnd)} (${spanDays} ${spanDays === 1 ? "dzień" : "dni"})`,
    };
  }, [stages]);

  const handleMoveRow = async (idx: number, direction: -1 | 1) => {
    if (!stages) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= stages.length) return;
    const orderedIds = stages.map((s) => s._id);
    const [moved] = orderedIds.splice(idx, 1);
    orderedIds.splice(targetIdx, 0, moved);
    await reorderStages({ orderId, orderedIds });
  };

  const handleCreateStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSavingNew(true);
    try {
      await createStage({
        orderId,
        title: newTitle.trim(),
        startDate: newStartDate,
        endDate: Math.max(newStartDate, newEndDate),
        startMins: newStartMins,
        endMins: newEndMins,
        installationTeamId: newTeamId,
        note: newNote.trim() || undefined,
      });
      setNewTitle("");
      setNewNote("");
      setIsAddOpen(false);
    } finally {
      setSavingNew(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStage || !editTitle.trim()) return;
    setSavingEdit(true);
    try {
      await updateStage({
        stageId: editingStage._id,
        title: editTitle.trim(),
        startDate: editStartDate,
        endDate: Math.max(editStartDate, editEndDate),
        startMins: editStartMins,
        endMins: editEndMins,
        installationTeamId: editTeamId ?? null,
        status: editStatus,
        note: editNote.trim() || null,
      });
      setEditingStageId(null);
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {/* Górny pasek podsumowania i sterowania */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "12px 14px",
          borderRadius: 10,
          background: "var(--panel-2)",
          border: "1px solid var(--line)",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "var(--text-strong)" }}>
            <Calendar size={14} style={{ color: "var(--accent)" }} />
            <span>{summary.spanLabel}</span>
          </div>

          {summary.total > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "rgba(16, 185, 129, 0.12)",
                  color: "#047857",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                }}
              >
                Postęp: {summary.done}/{summary.total}
              </span>

              {summary.conflictsCount > 0 && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "rgba(239, 68, 68, 0.12)",
                    color: "#b91c1c",
                    border: "1px solid rgba(239, 68, 68, 0.35)",
                  }}
                >
                  <AlertTriangle size={12} />
                  Kolizje ekip: {summary.conflictsCount}
                </span>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          {/* Przełącznik widoku: Gantt / Lista */}
          <div
            style={{
              display: "inline-flex",
              borderRadius: 8,
              border: "1px solid var(--line)",
              background: "var(--card)",
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode("gantt")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 10px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                background: viewMode === "gantt" ? "var(--accent)" : "transparent",
                color: viewMode === "gantt" ? "#ffffff" : "var(--text-mute)",
                border: "none",
              }}
            >
              <SlidersHorizontal size={13} />
              Gantt
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 10px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                background: viewMode === "list" ? "var(--accent)" : "transparent",
                color: viewMode === "list" ? "#ffffff" : "var(--text-mute)",
                border: "none",
              }}
            >
              <LayoutList size={13} />
              Lista
            </button>
          </div>

          {viewMode === "gantt" && (
            <>
              <div
                style={{
                  display: "inline-flex",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  background: "var(--card)",
                  overflow: "hidden",
                }}
              >
                <button
                  type="button"
                  onClick={() => setDayWidth(44)}
                  style={{
                    padding: "5px 9px",
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    background: dayWidth === 44 ? "var(--panel-2)" : "transparent",
                    color: dayWidth === 44 ? "var(--text-strong)" : "var(--text-mute)",
                    border: "none",
                  }}
                >
                  Dzień
                </button>
                <button
                  type="button"
                  onClick={() => setDayWidth(28)}
                  style={{
                    padding: "5px 9px",
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    background: dayWidth === 28 ? "var(--panel-2)" : "transparent",
                    color: dayWidth === 28 ? "var(--text-strong)" : "var(--text-mute)",
                    border: "none",
                  }}
                >
                  Kompakt
                </button>
              </div>

              <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <button
                  type="button"
                  onClick={() => setTimelineAnchor((prev) => addDays(prev, -7))}
                  className="btn btn-xs"
                  title="Poprzedni tydzień"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setTimelineAnchor(addDays(todayTs, -3))}
                  className="btn btn-xs"
                  style={{ fontSize: 11.5, fontWeight: 600 }}
                >
                  Dziś
                </button>
                <button
                  type="button"
                  onClick={() => setTimelineAnchor((prev) => addDays(prev, 7))}
                  className="btn btn-xs"
                  title="Następny tydzień"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              const baseStart =
                stages && stages.length > 0
                  ? addDays(Math.max(...stages.map((s) => s.endDate)), 1)
                  : todayTs;
              setNewStartDate(baseStart);
              setNewEndDate(baseStart);
              setNewTeamId(defaultTeamId);
              setIsAddOpen((v) => !v);
            }}
            className="btn primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              padding: "6px 12px",
            }}
          >
            <Plus size={14} />
            Dodaj etap
          </button>
        </div>
      </div>

      {/* Formularz szybkiego dodawania etapu */}
      {isAddOpen && (
        <form
          onSubmit={handleCreateStage}
          style={{
            padding: 14,
            borderRadius: 10,
            background: "var(--panel-2)",
            border: "1px solid var(--accent)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--accent)" }}>
              Nowy etap montażu
            </span>
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-mute)" }}
            >
              <X size={15} />
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.2fr", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-mute)" }}>
                Nazwa etapu *
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="np. Montaż konstrukcji głównej"
                style={{
                  fontSize: 12.5,
                  padding: "7px 10px",
                  borderRadius: 7,
                  border: "1px solid var(--line)",
                  background: "var(--card)",
                  color: "var(--text-strong)",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-mute)" }}>Od *</label>
              <input
                type="date"
                value={tsToDateInput(newStartDate)}
                onChange={(e) => {
                  const ts = dateInputToTs(e.target.value);
                  setNewStartDate(ts);
                  if (newEndDate < ts) setNewEndDate(ts);
                }}
                style={{
                  fontSize: 12.5,
                  padding: "7px 9px",
                  borderRadius: 7,
                  border: "1px solid var(--line)",
                  background: "var(--card)",
                  color: "var(--text-strong)",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-mute)" }}>Do *</label>
              <input
                type="date"
                value={tsToDateInput(newEndDate)}
                min={tsToDateInput(newStartDate)}
                onChange={(e) => setNewEndDate(Math.max(newStartDate, dateInputToTs(e.target.value)))}
                style={{
                  fontSize: 12.5,
                  padding: "7px 9px",
                  borderRadius: 7,
                  border: "1px solid var(--line)",
                  background: "var(--card)",
                  color: "var(--text-strong)",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-mute)" }}>
                Ekipa montażowa
              </label>
              <select
                value={newTeamId ?? ""}
                onChange={(e) =>
                  setNewTeamId(e.target.value ? (e.target.value as Id<"installationTeams">) : undefined)
                }
                style={{
                  fontSize: 12.5,
                  padding: "7px 9px",
                  borderRadius: 7,
                  border: "1px solid var(--line)",
                  background: "var(--card)",
                  color: "var(--text-strong)",
                }}
              >
                <option value="">— Brak przypisania —</option>
                {installationTeams.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2.5fr auto", gap: 10, alignItems: "end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-mute)" }}>Od godz.</label>
              <select
                value={Math.floor(newStartMins / 60)}
                onChange={(e) => setNewStartMins(parseInt(e.target.value, 10) * 60)}
                style={{
                  fontSize: 12.5,
                  padding: "7px 9px",
                  borderRadius: 7,
                  border: "1px solid var(--line)",
                  background: "var(--card)",
                  color: "var(--text-strong)",
                }}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-mute)" }}>Do godz.</label>
              <select
                value={Math.floor(newEndMins / 60)}
                onChange={(e) => setNewEndMins(parseInt(e.target.value, 10) * 60)}
                style={{
                  fontSize: 12.5,
                  padding: "7px 9px",
                  borderRadius: 7,
                  border: "1px solid var(--line)",
                  background: "var(--card)",
                  color: "var(--text-strong)",
                }}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-mute)" }}>
                Notatka (opcjonalnie)
              </label>
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="np. potrzebna zwyżka / dostęp od ogrodu"
                style={{
                  fontSize: 12.5,
                  padding: "7px 10px",
                  borderRadius: 7,
                  border: "1px solid var(--line)",
                  background: "var(--card)",
                  color: "var(--text-strong)",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={savingNew}
              className="btn primary"
              style={{ fontSize: 12.5, padding: "8px 16px" }}
            >
              {savingNew ? "Zapisywanie..." : "Zapisz etap"}
            </button>
          </div>
        </form>
      )}

      {/* Pusty stan z przyciskiem szybkiego szablonu */}
      {stages === undefined ? (
        <div style={{ padding: 28, textAlign: "center", fontSize: 13, color: "var(--text-mute)" }}>
          Ładowanie harmonogramu montażu…
        </div>
      ) : stages.length === 0 ? (
        <div
          style={{
            padding: 28,
            borderRadius: 12,
            border: "1px dashed var(--line)",
            background: "var(--panel-2)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)" }}>
            Brak etapów w harmonogramie montażu
          </div>
          <p style={{ fontSize: 12.5, color: "var(--text-mute)", margin: 0, maxWidth: 480 }}>
            Utwórz własne etapy lub wczytaj gotowy 4-etapowy szablon montażu, który następnie możesz dowolnie przesuwać i rozciągać na osi czasu.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={() =>
                void seedPresetStages({
                  orderId,
                  anchorDate: todayTs,
                  defaultTeamId,
                })
              }
              className="btn primary"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5 }}
            >
              <Sparkles size={14} />
              Wczytaj standardowy harmonogram (4 etapy)
            </button>
            <button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className="btn"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5 }}
            >
              <Plus size={14} />
              Dodaj własny etap
            </button>
          </div>
        </div>
      ) : viewMode === "list" ? (
        /* ── WIDOK LISTY KLASYCZNEJ ── */
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {stages.map((st, idx) => {
            const team = st.installationTeamId ? teamMap.get(st.installationTeamId) : null;
            const statusMeta = STATUS_META[st.status];
            const daysLen = diffDays(st.startDate, st.endDate) + 1;

            return (
              <div
                key={st._id}
                onClick={() => setEditingStageId(st._id)}
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid var(--line)",
                  borderLeft: `4px solid ${team?.color || "var(--accent)"}`,
                  background: "var(--card)",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-mute)" }}>
                      #{idx + 1}
                    </span>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-strong)" }}>
                      {st.title}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "1px 8px",
                        borderRadius: 999,
                        background: statusMeta.badgeBg,
                        color: statusMeta.badgeText,
                        border: `1px solid ${statusMeta.badgeBorder}`,
                      }}
                    >
                      {statusMeta.label}
                    </span>
                    {st.conflicts.length > 0 && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "1px 8px",
                          borderRadius: 999,
                          background: "rgba(239, 68, 68, 0.12)",
                          color: "#b91c1c",
                        }}
                      >
                        <AlertTriangle size={11} />
                        Kolizja ({st.conflicts.length})
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12, color: "var(--text-mute)" }}>
                    <span>
                      📅 {formatDayShort(st.startDate)} – {formatDayShort(st.endDate)} ({daysLen} {daysLen === 1 ? "dzień" : "dni"})
                    </span>
                    <span>
                      🕒 {formatHour(st.startMins, 480)}–{formatHour(st.endMins, 960)}
                    </span>
                    {team && <span>🛠️ {team.name}</span>}
                    {st.note && <span>📝 {st.note}</span>}
                  </div>
                </div>

                <div
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => void handleMoveRow(idx, -1)}
                    className="btn btn-xs"
                    title="Przesuń wyżej"
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    type="button"
                    disabled={idx === stages.length - 1}
                    onClick={() => void handleMoveRow(idx, 1)}
                    className="btn btn-xs"
                    title="Przesuń niżej"
                  >
                    <ArrowDown size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── WIDOK WYKRESU GANTTA ── */
        <div
          style={{
            borderRadius: 10,
            border: "1px solid var(--line)",
            background: "var(--card)",
            overflow: "hidden",
          }}
        >
          <div
            ref={timelineScrollRef}
            style={{
              overflowX: "auto",
              position: "relative",
              userSelect: dragState ? "none" : "auto",
            }}
          >
            <div style={{ minWidth: 270 + timelineDays.length * dayWidth }}>
              {/* Nagłówek osi czasu */}
              <div
                style={{
                  display: "flex",
                  borderBottom: "1px solid var(--line)",
                  background: "var(--panel-2)",
                  position: "sticky",
                  top: 0,
                  zIndex: 5,
                }}
              >
                <div
                  style={{
                    width: 270,
                    minWidth: 270,
                    position: "sticky",
                    left: 0,
                    zIndex: 6,
                    background: "var(--panel-2)",
                    borderRight: "1px solid var(--line)",
                    padding: "8px 12px",
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: "var(--text-mute)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span>ETAP MONTAŻU</span>
                  <span style={{ fontSize: 10.5, fontWeight: 500 }}>Przeciągnij pasek</span>
                </div>

                <div style={{ display: "flex" }}>
                  {timelineDays.map((day, dIdx) => {
                    const showMonth =
                      dIdx === 0 || day.dayNum === 1;
                    return (
                      <div
                        key={day.ts}
                        style={{
                          width: dayWidth,
                          minWidth: dayWidth,
                          borderRight: "1px solid var(--line)",
                          padding: "4px 2px",
                          textAlign: "center",
                          background: day.isToday
                            ? "rgba(8, 145, 178, 0.14)"
                            : day.isWeekend
                            ? "rgba(148, 163, 184, 0.12)"
                            : "transparent",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: day.isToday ? "var(--accent)" : "var(--text-mute)",
                            textTransform: "uppercase",
                            height: 12,
                            overflow: "hidden",
                          }}
                        >
                          {showMonth ? day.monthLabel : day.weekdayShort}
                        </div>
                        <div
                          style={{
                            fontSize: 11.5,
                            fontWeight: day.isToday ? 800 : 600,
                            color: day.isToday ? "var(--accent)" : "var(--text-strong)",
                          }}
                        >
                          {day.dayNum}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Wiersze etapów */}
              {stages.map((st, idx) => {
                const team = st.installationTeamId ? teamMap.get(st.installationTeamId) : null;
                const barColor = team?.color || "#0891b2";
                const statusMeta = STATUS_META[st.status];
                const isDraggingThis = dragState?.stageId === st._id;
                const effStart = isDraggingThis ? dragState.previewStart : st.startDate;
                const effEnd = isDraggingThis ? dragState.previewEnd : st.endDate;

                const offsetDays = diffDays(timelineAnchor, effStart);
                const durationDays = Math.max(1, diffDays(effStart, effEnd) + 1);
                const barLeft = offsetDays * dayWidth + 3;
                const barWidth = Math.max(dayWidth - 6, durationDays * dayWidth - 6);
                const timelineTotalW = timelineDays.length * dayWidth;
                const isVisibleOnTimeline =
                  barLeft + barWidth > 0 && barLeft < timelineTotalW;

                return (
                  <div
                    key={st._id}
                    style={{
                      display: "flex",
                      borderBottom: "1px solid var(--line)",
                      minHeight: 46,
                    }}
                  >
                    {/* Lewa przypięta kolumna etapu */}
                    <div
                      onClick={() => setEditingStageId(st._id)}
                      style={{
                        width: 270,
                        minWidth: 270,
                        position: "sticky",
                        left: 0,
                        zIndex: 4,
                        background: "var(--card)",
                        borderRight: "1px solid var(--line)",
                        padding: "6px 10px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 6,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: barColor,
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              fontSize: 12.5,
                              fontWeight: 600,
                              color: "var(--text-strong)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              textDecoration: st.status === "done" ? "line-through" : "none",
                              opacity: st.status === "done" ? 0.7 : 1,
                            }}
                            title={st.title}
                          >
                            {st.title}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                          <span style={{ fontSize: 10.5, color: statusMeta.badgeText, fontWeight: 600 }}>
                            {statusMeta.label}
                          </span>
                          {team && (
                            <span
                              style={{
                                fontSize: 10.5,
                                color: "var(--text-mute)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              · {team.name}
                            </span>
                          )}
                          {st.conflicts.length > 0 && (
                            <span
                              title={`Kolizja ekipy z ${st.conflicts.length} innymi zleceniami`}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 2,
                                fontSize: 10,
                                fontWeight: 700,
                                color: "#dc2626",
                              }}
                            >
                              <AlertTriangle size={11} />
                              Kolizja
                            </span>
                          )}
                        </div>
                      </div>

                      <div
                        style={{ display: "flex", flexDirection: "column", gap: 1 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => void handleMoveRow(idx, -1)}
                          style={{
                            border: "none",
                            background: "transparent",
                            cursor: idx === 0 ? "default" : "pointer",
                            opacity: idx === 0 ? 0.25 : 0.7,
                            padding: 1,
                            color: "var(--text-mute)",
                          }}
                          title="Przesuń wyżej"
                        >
                          <ArrowUp size={11} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === stages.length - 1}
                          onClick={() => void handleMoveRow(idx, 1)}
                          style={{
                            border: "none",
                            background: "transparent",
                            cursor: idx === stages.length - 1 ? "default" : "pointer",
                            opacity: idx === stages.length - 1 ? 0.25 : 0.7,
                            padding: 1,
                            color: "var(--text-mute)",
                          }}
                          title="Przesuń niżej"
                        >
                          <ArrowDown size={11} />
                        </button>
                      </div>
                    </div>

                    {/* Prawa siatka dni + pasek Gantta */}
                    <div
                      style={{
                        position: "relative",
                        display: "flex",
                        width: timelineTotalW,
                        minWidth: timelineTotalW,
                      }}
                    >
                      {timelineDays.map((day) => (
                        <div
                          key={day.ts}
                          onDoubleClick={() => {
                            setNewStartDate(day.ts);
                            setNewEndDate(day.ts);
                            setNewTeamId(defaultTeamId);
                            setIsAddOpen(true);
                          }}
                          style={{
                            width: dayWidth,
                            minWidth: dayWidth,
                            borderRight: "1px solid var(--line)",
                            background: day.isToday
                              ? "rgba(8, 145, 178, 0.06)"
                              : day.isWeekend
                              ? "rgba(148, 163, 184, 0.07)"
                              : "transparent",
                          }}
                        />
                      ))}

                      {/* Pasek etapu */}
                      {isVisibleOnTimeline && (
                        <div
                          onPointerDown={(e) => {
                            if (e.button !== 0) return;
                            e.preventDefault();
                            setDragState({
                              stageId: st._id,
                              mode: "move",
                              originClientX: e.clientX,
                              origStart: st.startDate,
                              origEnd: st.endDate,
                              previewStart: st.startDate,
                              previewEnd: st.endDate,
                              hasMoved: false,
                            });
                          }}
                          title={`${st.title} (${formatDayShort(effStart)} – ${formatDayShort(effEnd)} · ${durationDays} dni)`}
                          style={{
                            position: "absolute",
                            top: 7,
                            bottom: 7,
                            left: Math.max(2, barLeft),
                            width:
                              barLeft < 2
                                ? Math.max(18, barWidth + barLeft - 2)
                                : Math.min(barWidth, timelineTotalW - barLeft - 2),
                            borderRadius: 7,
                            background:
                              st.status === "done"
                                ? "#10b981"
                                : barColor,
                            opacity: st.status === "done" ? 0.78 : 0.95,
                            boxShadow:
                              st.conflicts.length > 0
                                ? "0 0 0 2px #ef4444, 0 2px 6px rgba(0,0,0,0.16)"
                                : isDraggingThis
                                ? "0 6px 16px rgba(0,0,0,0.22)"
                                : "0 1px 3px rgba(0,0,0,0.14)",
                            color: "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "0 8px",
                            cursor: isDraggingThis ? "grabbing" : "grab",
                            zIndex: isDraggingThis ? 3 : 2,
                            overflow: "hidden",
                          }}
                        >
                          {/* Lewy uchwyt zmiany długości */}
                          <div
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              if (e.button !== 0) return;
                              e.preventDefault();
                              setDragState({
                                stageId: st._id,
                                mode: "resize-left",
                                originClientX: e.clientX,
                                origStart: st.startDate,
                                origEnd: st.endDate,
                                previewStart: st.startDate,
                                previewEnd: st.endDate,
                                hasMoved: false,
                              });
                            }}
                            style={{
                              position: "absolute",
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: 8,
                              cursor: "ew-resize",
                            }}
                            title="Przeciągnij, aby zmienić datę startu"
                          />

                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              pointerEvents: "none",
                            }}
                          >
                            {st.status === "done" && "✓ "}
                            {st.conflicts.length > 0 && "⚠ "}
                            {dayWidth === 44 && durationDays >= 2
                              ? `${st.title} (${durationDays}d)`
                              : `${durationDays}d`}
                          </span>

                          {/* Prawy uchwyt zmiany długości */}
                          <div
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              if (e.button !== 0) return;
                              e.preventDefault();
                              setDragState({
                                stageId: st._id,
                                mode: "resize-right",
                                originClientX: e.clientX,
                                origStart: st.startDate,
                                origEnd: st.endDate,
                                previewStart: st.startDate,
                                previewEnd: st.endDate,
                                hasMoved: false,
                              });
                            }}
                            style={{
                              position: "absolute",
                              right: 0,
                              top: 0,
                              bottom: 0,
                              width: 8,
                              cursor: "ew-resize",
                            }}
                            title="Przeciągnij, aby zmienić długość etapu"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            style={{
              padding: "7px 12px",
              fontSize: 11,
              color: "var(--text-mute)",
              background: "var(--panel-2)",
              borderTop: "1px solid var(--line)",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span>
              💡 Przeciągnij pasek w poziomie, aby zmienić daty; chwyć krawędź paska, aby wydłużyć/skrócić; kliknij pasek, aby edytować szczegóły.
            </span>
            <span>Harmonogram wewnętrzny zlecenia (niezależny od Kalendarza CRM)</span>
          </div>
        </div>
      )}

      {/* Modal / Panel edycji wybranego etapu */}
      {editingStage && (
        <div
          onClick={() => setEditingStageId(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveEdit}
            style={{
              width: "100%",
              maxWidth: 520,
              borderRadius: 14,
              background: "var(--panel)",
              border: "1px solid var(--line)",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.25)",
              padding: 18,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-strong)" }}>
                Edycja etapu montażu
              </span>
              <button
                type="button"
                onClick={() => setEditingStageId(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-mute)" }}
              >
                <X size={16} />
              </button>
            </div>

            {editingStage.conflicts.length > 0 && (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 9,
                  background: "rgba(239, 68, 68, 0.10)",
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                  color: "#991b1b",
                  fontSize: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
                  <AlertTriangle size={14} />
                  Wykryto kolizję terminów wybranej ekipy:
                </div>
                {editingStage.conflicts.map((c, cIdx) => (
                  <div key={cIdx} style={{ paddingLeft: 20 }}>
                    • <strong>{c.orderLabel}</strong> — {c.dateLabel}{" "}
                    ({c.source === "gantt" ? `Gantt: ${c.stageTitle}` : "Kalendarz CRM"})
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-mute)" }}>
                Nazwa etapu *
              </label>
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                style={{
                  fontSize: 13,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  background: "var(--card)",
                  color: "var(--text-strong)",
                  fontWeight: 600,
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-mute)" }}>
                  Data rozpoczęcia
                </label>
                <input
                  type="date"
                  value={tsToDateInput(editStartDate)}
                  onChange={(e) => {
                    const ts = dateInputToTs(e.target.value);
                    setEditStartDate(ts);
                    if (editEndDate < ts) setEditEndDate(ts);
                  }}
                  style={{
                    fontSize: 13,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    background: "var(--card)",
                    color: "var(--text-strong)",
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-mute)" }}>
                  Data zakończenia
                </label>
                <input
                  type="date"
                  value={tsToDateInput(editEndDate)}
                  min={tsToDateInput(editStartDate)}
                  onChange={(e) =>
                    setEditEndDate(Math.max(editStartDate, dateInputToTs(e.target.value)))
                  }
                  style={{
                    fontSize: 13,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    background: "var(--card)",
                    color: "var(--text-strong)",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.5fr", gap: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-mute)" }}>
                  <Clock size={11} style={{ display: "inline", marginRight: 4 }} />
                  Od godz.
                </label>
                <select
                  value={Math.floor(editStartMins / 60)}
                  onChange={(e) => setEditStartMins(parseInt(e.target.value, 10) * 60)}
                  style={{
                    fontSize: 13,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    background: "var(--card)",
                    color: "var(--text-strong)",
                  }}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-mute)" }}>
                  Do godz.
                </label>
                <select
                  value={Math.floor(editEndMins / 60)}
                  onChange={(e) => setEditEndMins(parseInt(e.target.value, 10) * 60)}
                  style={{
                    fontSize: 13,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    background: "var(--card)",
                    color: "var(--text-strong)",
                  }}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-mute)" }}>
                  <Users size={11} style={{ display: "inline", marginRight: 4 }} />
                  Ekipa montażowa
                </label>
                <select
                  value={editTeamId ?? ""}
                  onChange={(e) =>
                    setEditTeamId(
                      e.target.value ? (e.target.value as Id<"installationTeams">) : undefined
                    )
                  }
                  style={{
                    fontSize: 13,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    background: "var(--card)",
                    color: "var(--text-strong)",
                  }}
                >
                  <option value="">— Brak przypisania —</option>
                  {installationTeams.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-mute)" }}>
                Status etapu
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {(["planned", "in_progress", "done"] as const).map((stKey) => {
                  const meta = STATUS_META[stKey];
                  const active = editStatus === stKey;
                  return (
                    <button
                      key={stKey}
                      type="button"
                      onClick={() => setEditStatus(stKey)}
                      style={{
                        padding: "7px 10px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        background: active ? meta.badgeBg : "var(--card)",
                        color: active ? meta.badgeText : "var(--text-mute)",
                        border: `1.5px solid ${active ? meta.badgeBorder : "var(--line)"}`,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 5,
                      }}
                    >
                      {stKey === "done" && <CheckCircle2 size={13} />}
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-mute)" }}>
                Notatka
              </label>
              <input
                type="text"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Uwagi do etapu…"
                style={{
                  fontSize: 13,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  background: "var(--card)",
                  color: "var(--text-strong)",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: 6,
                borderTop: "1px solid var(--line)",
              }}
            >
              <button
                type="button"
                onClick={async () => {
                  await removeStage({ stageId: editingStage._id });
                  setEditingStageId(null);
                }}
                className="btn btn-xs"
                style={{
                  color: "var(--bad)",
                  border: "1px solid var(--bad-line)",
                  background: "transparent",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontWeight: 600,
                }}
              >
                <Trash2 size={13} />
                Usuń etap
              </button>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setEditingStageId(null)}
                  className="btn"
                  style={{ fontSize: 12.5 }}
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="btn primary"
                  style={{ fontSize: 12.5 }}
                >
                  {savingEdit ? "Zapisywanie…" : "Zapisz zmiany"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
