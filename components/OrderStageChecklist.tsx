"use client";

import React, { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import toast from "react-hot-toast";
import { Check, CheckCircle2, Plus, Trash2 } from "lucide-react";

export type OrderChecklistStageKey = "kitting" | "installation";

export interface OrderStageChecklistItem {
  _id: Id<"stageChecklists">;
  title: string;
  done: boolean;
}

const STAGE_META: Record<
  OrderChecklistStageKey,
  { label: string; color: string; bg: string; border: string }
> = {
  kitting: {
    label: "Kompletacja",
    color: "#0284c7",
    bg: "rgba(2, 132, 199, 0.08)",
    border: "rgba(2, 132, 199, 0.28)",
  },
  installation: {
    label: "Montaż",
    color: "#059669",
    bg: "rgba(5, 150, 105, 0.08)",
    border: "rgba(5, 150, 105, 0.28)",
  },
};

interface OrderStageChecklistProps {
  orderId: Id<"orders">;
  stageKey: OrderChecklistStageKey;
  items: OrderStageChecklistItem[] | undefined;
}

export default function OrderStageChecklist({
  orderId,
  stageKey,
  items,
}: OrderStageChecklistProps) {
  const meta = STAGE_META[stageKey];
  const createItem = useMutation(api.stageChecklists.create);
  const toggleItem = useMutation(api.stageChecklists.toggle);
  const removeItem = useMutation(api.stageChecklists.remove);

  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const list = items ?? [];
  const totalCount = list.length;
  const doneCount = list.filter((i) => i.done).length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title || adding) return;
    setAdding(true);
    try {
      await createItem({ orderId, stageKey, title });
      setNewTitle("");
    } catch (err) {
      console.error(err);
      toast.error("Nie udało się dodać punktu checklisty.");
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (itemId: Id<"stageChecklists">) => {
    try {
      await toggleItem({ itemId });
    } catch (err) {
      console.error(err);
      toast.error("Nie udało się zaktualizować punktu checklisty.");
    }
  };

  const handleRemove = async (itemId: Id<"stageChecklists">) => {
    try {
      await removeItem({ itemId });
    } catch (err) {
      console.error(err);
      toast.error("Nie udało się usunąć punktu checklisty.");
    }
  };

  return (
    <div className="flex flex-col gap-3 mt-1">
      {/* Progress bar when items exist */}
      {totalCount > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold">
            <span style={{ color: "var(--text-mute)" }}>
              Postęp etapu: {meta.label}
            </span>
            <span className="tabular-nums" style={{ color: meta.color }}>
              {doneCount}/{totalCount} ({progressPct}%)
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-200/80 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progressPct}%`,
                background: progressPct === 100 ? "#16a34a" : meta.color,
              }}
            />
          </div>
        </div>
      )}

      {/* Quick Add Form */}
      <form onSubmit={(e) => void handleAdd(e)} className="flex items-center gap-1.5">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder={`Dodaj zadanie dla etapu ${meta.label}…`}
          disabled={adding}
          className="flex-1 min-w-0 px-3 py-1.5 text-xs rounded-lg border bg-white focus:outline-none transition-colors"
          style={{
            borderColor: "var(--line)",
            color: "var(--text-strong)",
          }}
        />
        <button
          type="submit"
          disabled={!newTitle.trim() || adding}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity cursor-pointer disabled:opacity-45 shrink-0"
          style={{ background: meta.color }}
        >
          <Plus size={13} />
          <span>Dodaj</span>
        </button>
      </form>

      {/* Checklist items */}
      {items === undefined ? (
        <div className="text-xs" style={{ color: "var(--text-mute)" }}>
          Ładowanie…
        </div>
      ) : list.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-1 text-center py-4 px-3 rounded-lg border border-dashed text-xs"
          style={{
            background: "var(--panel-2)",
            borderColor: "var(--line)",
            color: "var(--text-mute)",
          }}
        >
          <CheckCircle2 size={18} className="opacity-40" />
          <span>
            Brak zadań dla etapu <strong>{meta.label}</strong>. Dodaj punkt powyżej — pojawi się też w harmonogramie.
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {list.map((item) => (
            <div
              key={item._id}
              className="group flex items-center gap-2.5 px-3 py-2 rounded-lg border bg-white transition-colors hover:border-slate-300"
              style={{ borderColor: "var(--line)" }}
            >
              <button
                type="button"
                onClick={() => void handleToggle(item._id)}
                className="w-4 h-4 rounded flex items-center justify-center border transition-colors cursor-pointer shrink-0"
                style={{
                  background: item.done ? meta.color : "#ffffff",
                  borderColor: item.done ? meta.color : "#cbd5e1",
                }}
                title={item.done ? "Oznacz jako nieukończone" : "Oznacz jako ukończone"}
              >
                {item.done && <Check size={11} className="text-white stroke-[3]" />}
              </button>

              <span
                onClick={() => void handleToggle(item._id)}
                className={`flex-1 min-w-0 text-xs leading-snug break-words cursor-pointer select-none ${
                  item.done ? "line-through text-slate-400" : "font-medium"
                }`}
                style={item.done ? undefined : { color: "var(--text-strong)" }}
              >
                {item.title}
              </span>

              <button
                type="button"
                onClick={() => void handleRemove(item._id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer shrink-0"
                title="Usuń punkt"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
