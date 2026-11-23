"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import toast from "react-hot-toast";
import {
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Trash2,
  Users,
} from "lucide-react";
import SideDrawer from "./SideDrawer";

type StageKey = "kitting" | "production" | "installation";

const STAGE_META: Record<
  StageKey,
  { label: string; color: string; bg: string; border: string; startField: string; endField: string }
> = {
  kitting: {
    label: "Kompletacja",
    color: "#0284c7",
    bg: "rgba(2, 132, 199, 0.14)",
    border: "rgba(2, 132, 199, 0.45)",
    startField: "completionStartDate",
    endField: "completionEndDate",
  },
  production: {
    label: "Produkcja",
    color: "#7c3aed",
    bg: "rgba(124, 58, 237, 0.14)",
    border: "rgba(124, 58, 237, 0.45)",
    startField: "productionStartDate",
    endField: "productionEndDate",
  },
  installation: {
    label: "Montaż",
    color: "#059669",
    bg: "rgba(5, 150, 105, 0.14)",
    border: "rgba(5, 150, 105, 0.45)",
    startField: "installationPhaseStartDate",
    endField: "installationPhaseEndDate",
  },
};

function formatPlDate(ts?: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function diffDays(a: number, b: number): number {
  return Math.round((b - a) / 86_400_000);
}

interface StageTasksDrawerProps {
  open: boolean;
  onClose: () => void;
  order: {
    _id: Id<"orders">;
    name: string;
    customText?: string;
    clientId: Id<"clients">;
    clientName: string;
    investmentCity?: string;
    installationTeamId?: Id<"installationTeams">;
    installationTeamName?: string;
    installationTeamColor?: string;
    stageKey: StageKey;
    completionStartDate?: number;
    completionEndDate?: number;
    productionStartDate?: number;
    productionEndDate?: number;
    installationPhaseStartDate?: number;
    installationPhaseEndDate?: number;
  } | null;
  stageKey: StageKey | null;
}

export default function StageTasksDrawer({
  open,
  onClose,
  order,
  stageKey,
}: StageTasksDrawerProps) {
  const stage = stageKey ? STAGE_META[stageKey] : STAGE_META.kitting;
  const items = useQuery(
    api.stageChecklists.listByOrderStage,
    order && stageKey ? { orderId: order._id, stageKey } : "skip",
  );
  const activeTeams = useQuery(
    api.installationTeams.listActive,
    open && stageKey === "installation" ? {} : "skip",
  );

  const createItem = useMutation(api.stageChecklists.create);
  const toggleItem = useMutation(api.stageChecklists.toggle);
  const removeItem = useMutation(api.stageChecklists.remove);
  const updateOrder = useMutation(api.orders.update);

  const [newItemTitle, setNewItemTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [clearingDates, setClearingDates] = useState(false);
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);
  const [savingTeam, setSavingTeam] = useState(false);
  const teamDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!teamDropdownOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (
        teamDropdownRef.current &&
        !teamDropdownRef.current.contains(e.target as Node)
      ) {
        setTeamDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTeamDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [teamDropdownOpen]);

  const handleSelectTeam = async (nextTeamId: Id<"installationTeams"> | null) => {
    if (!order || savingTeam) return;
    setTeamDropdownOpen(false);
    setSavingTeam(true);
    try {
      await updateOrder({
        orderId: order._id,
        installationTeamId: nextTeamId,
      });
      if (nextTeamId) {
        const team = activeTeams?.find((t) => t._id === nextTeamId);
        toast.success(
          team ? `Przypisano ekipę: ${team.name}` : "Przypisano ekipę montażową",
        );
      } else {
        toast.success("Usunięto przypisanie ekipy");
      }
    } catch (err) {
      console.error(err);
      toast.error("Nie udało się zapisać ekipy montażowej.");
    } finally {
      setSavingTeam(false);
    }
  };

  const checklistItems = items ?? [];
  const totalCount = checklistItems.length;
  const doneCount = checklistItems.filter((item) => item.done).length;
  const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // Daty etapu na osi czasu
  const rawStart = order
    ? (order[stage.startField as keyof typeof order] as number | undefined)
    : undefined;
  const rawEnd = order
    ? (order[stage.endField as keyof typeof order] as number | undefined)
    : undefined;
  const hasDates = Boolean(rawStart && rawEnd);
  const hasAnyDate = Boolean(rawStart || rawEnd);
  const spanDays = hasDates ? Math.max(1, diffDays(rawStart!, rawEnd!) + 1) : null;
  const isCurrentOrderStage = Boolean(order && stageKey && order.stageKey === stageKey);

  const handleClearStageDates = async () => {
    if (!order || !stageKey || clearingDates) return;
    setClearingDates(true);
    try {
      await updateOrder({
        orderId: order._id,
        [stage.startField]: null,
        [stage.endField]: null,
      });
      toast.success(`Usunięto termin etapu: ${stage.label}`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Nie udało się usunąć terminu etapu.");
    } finally {
      setClearingDates(false);
    }
  };

  const handleAddItem = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!order || !stageKey) return;
    const title = newItemTitle.trim();
    if (!title || adding) return;
    setAdding(true);
    try {
      await createItem({
        orderId: order._id,
        stageKey,
        title,
      });
      setNewItemTitle("");
    } catch (err) {
      console.error(err);
      toast.error("Błąd podczas dodawania punktu checklisty");
    } finally {
      setAdding(false);
    }
  };

  const handleToggleItem = async (itemId: Id<"stageChecklists">) => {
    try {
      await toggleItem({ itemId });
    } catch (err) {
      console.error(err);
      toast.error("Błąd aktualizacji checklisty");
    }
  };

  const handleDeleteItem = async (itemId: Id<"stageChecklists">) => {
    try {
      await removeItem({ itemId });
    } catch (err) {
      console.error(err);
      toast.error("Błąd usuwania punktu checklisty");
    }
  };

  return (
    <SideDrawer
      open={open && Boolean(order && stageKey)}
      onClose={onClose}
      width={480}
      title={
        order && stageKey ? (
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: stage.color }}
            />
            <span>Checklista etapu: {stage.label}</span>
            {isCurrentOrderStage && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 tracking-wide uppercase">
                W trakcie
              </span>
            )}
          </div>
        ) : null
      }
    >
      {order && stageKey && (
        <div className="flex flex-col h-full overflow-y-auto p-5 space-y-5">
          {/* Order Info Card */}
          <div className="p-4 rounded-xl border bg-slate-50/80 border-slate-200/80 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <Link
                  href={`/admin/klient/${order.clientId}/zlecenie/${order._id}`}
                  className="text-[15px] font-bold leading-snug hover:underline inline-flex items-center gap-1.5 break-words"
                  style={{ color: "var(--text-strong)" }}
                >
                  <span>{order.customText?.trim() || order.name}</span>
                  <ExternalLink size={13} className="opacity-55 shrink-0" />
                </Link>

                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                  {order.customText?.trim() && (
                    <span className="font-mono text-[11px] font-semibold text-slate-600 bg-white border border-slate-200/90 px-1.5 py-0.2 rounded">
                      {order.name}
                    </span>
                  )}
                  <span>
                    {order.clientName}
                    {order.investmentCity ? ` • ${order.investmentCity}` : ""}
                    {order.installationTeamName ? ` • ${order.installationTeamName}` : ""}
                  </span>
                </div>
              </div>

              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0"
                style={{
                  background: stage.bg,
                  color: stage.color,
                  border: `1px solid ${stage.border}`,
                }}
              >
                {stage.label}
              </span>
            </div>

            {/* Timeline Dates row */}
            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-slate-600 min-w-0">
                <Calendar size={13} className="text-slate-400 shrink-0" />
                {hasDates ? (
                  <span className="font-medium truncate">
                    {formatPlDate(rawStart)} – {formatPlDate(rawEnd)} ({spanDays} dni)
                  </span>
                ) : rawStart ? (
                  <span className="font-medium truncate">
                    od {formatPlDate(rawStart)} (brak daty końca)
                  </span>
                ) : rawEnd ? (
                  <span className="font-medium truncate">
                    do {formatPlDate(rawEnd)}
                  </span>
                ) : (
                  <span className="italic text-slate-400">Brak ustalonego terminu</span>
                )}
              </div>

              {hasAnyDate && (
                <button
                  type="button"
                  onClick={() => void handleClearStageDates()}
                  disabled={clearingDates}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-rose-600 bg-white border border-rose-200/80 hover:bg-rose-50 hover:border-rose-300 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                  title="Usuń belkę tego etapu z osi czasu"
                >
                  <Trash2 size={12} />
                  <span>{clearingDates ? "Usuwanie…" : "Usuń z osi"}</span>
                </button>
              )}
            </div>

            {/* Installation Team Selector — only for Montaż stage */}
            {stageKey === "installation" && (
              <div
                ref={teamDropdownRef}
                className="pt-2.5 border-t border-slate-200/60 space-y-1.5 relative"
              >
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                  <Users size={12} className="text-slate-400" />
                  <span>Ekipa realizująca montaż</span>
                </div>

                <button
                  type="button"
                  disabled={savingTeam}
                  onClick={() => setTeamDropdownOpen((v) => !v)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border bg-white text-xs font-semibold transition-all shadow-2xs ${
                    teamDropdownOpen
                      ? "border-[var(--brand,#4ABBC3)] ring-2 ring-[var(--brand,#4ABBC3)]/20 shadow-sm"
                      : "border-slate-200 hover:border-slate-300"
                  } ${savingTeam ? "opacity-55 cursor-not-allowed" : "cursor-pointer"}`}
                  style={{ color: "var(--text-strong)" }}
                >
                  <span className="flex items-center gap-2 min-w-0 truncate">
                    {order.installationTeamId ? (
                      <>
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-black/10"
                          style={{
                            background: order.installationTeamColor ?? "#059669",
                          }}
                        />
                        <span className="truncate">
                          {order.installationTeamName ?? "Przypisana ekipa"}
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-400 font-medium">
                        Wybierz ekipę montażową…
                      </span>
                    )}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-slate-400 shrink-0 ml-2 transition-transform duration-200 ${
                      teamDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {teamDropdownOpen && (
                  <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg space-y-0.5">
                    <button
                      type="button"
                      onClick={() => void handleSelectTeam(null)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer ${
                        !order.installationTeamId
                          ? "bg-slate-100 text-slate-900 font-semibold"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                      }`}
                    >
                      <span>Bez przypisanej ekipy</span>
                      {!order.installationTeamId && (
                        <Check size={14} className="text-slate-600 shrink-0" />
                      )}
                    </button>

                    {(activeTeams ?? []).length > 0 && (
                      <div className="my-1 border-t border-slate-100" />
                    )}

                    {(activeTeams ?? []).map((team) => {
                      const isSelected = order.installationTeamId === team._id;
                      const teamColor = team.color ?? "#059669";
                      return (
                        <button
                          key={team._id}
                          type="button"
                          onClick={() => void handleSelectTeam(team._id)}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-slate-900 text-white font-semibold"
                              : "text-slate-700 font-medium hover:bg-slate-100"
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0 truncate">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-white/40"
                              style={{ background: teamColor }}
                            />
                            <span className="truncate">{team.name}</span>
                          </span>
                          {isSelected && (
                            <Check size={14} className="stroke-[2.5] shrink-0 ml-2" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span style={{ color: "var(--text-strong)" }}>Postęp etapu</span>
              <span className="text-slate-500">
                {doneCount} / {totalCount} ({progressPercent}%)
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${progressPercent}%`,
                  background: stage.color,
                }}
              />
            </div>
          </div>

          {/* Quick Add Item Form */}
          <form onSubmit={handleAddItem} className="flex items-center gap-2">
            <input
              type="text"
              value={newItemTitle}
              onChange={(e) => setNewItemTitle(e.target.value)}
              placeholder={`+ Dodaj punkt do checklisty (${stage.label})...`}
              className="flex-1 px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-sky-500 border-slate-200"
              disabled={adding}
            />
            <button
              type="submit"
              disabled={!newItemTitle.trim() || adding}
              className="px-3 py-2 text-xs font-bold rounded-lg text-white transition-opacity disabled:opacity-40 cursor-pointer"
              style={{ background: stage.color }}
            >
              Dodaj
            </button>
          </form>

          {/* Checklist Items */}
          <div className="space-y-1.5 pt-1">
            {checklistItems.length === 0 ? (
              <div className="text-center py-8 px-4 rounded-xl border border-dashed border-slate-200 space-y-2">
                <CheckCircle2 size={24} className="mx-auto text-slate-300" />
                <p className="text-xs font-medium text-slate-600">
                  Brak pozycji na checkliście dla etapu {stage.label}
                </p>
                <p className="text-[11px] text-slate-400">
                  Dodaj pierwszy punkt powyżej, aby śledzić postęp na wykresie Gantta.
                </p>
              </div>
            ) : (
              checklistItems.map((item) => (
                <div
                  key={item._id}
                  className={`group flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                    item.done
                      ? "bg-slate-50/60 border-slate-200/60 opacity-75"
                      : "bg-white border-slate-200 hover:border-slate-300 shadow-xs"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => handleToggleItem(item._id)}
                      className={`w-4 h-4 rounded flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                        item.done
                          ? "bg-emerald-500 text-white"
                          : "border border-slate-300 hover:border-emerald-500"
                      }`}
                    >
                      {item.done && <Check size={11} className="stroke-[3]" />}
                    </button>

                    <span
                      onClick={() => handleToggleItem(item._id)}
                      className={`text-xs select-none block truncate cursor-pointer flex-1 ${
                        item.done
                          ? "line-through text-slate-400 font-normal"
                          : "text-slate-800 font-medium"
                      }`}
                    >
                      {item.title}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteItem(item._id)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600 transition-opacity cursor-pointer shrink-0"
                    title="Usuń punkt"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </SideDrawer>
  );
}
