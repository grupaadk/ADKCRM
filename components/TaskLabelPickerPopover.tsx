"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Check, Plus, Search, X } from "lucide-react";

export const PRESET_LABEL_COLORS = [
  { name: "Zielony", hex: "#22c55e" },
  { name: "Żółty", hex: "#eab308" },
  { name: "Pomarańczowy", hex: "#f97316" },
  { name: "Czerwony", hex: "#ef4444" },
  { name: "Fioletowy", hex: "#a855f7" },
  { name: "Niebieski", hex: "#3b82f6" },
  { name: "Błękitny", hex: "#0ea5e9" },
  { name: "Różowy", hex: "#ec4899" },
  { name: "Limonkowy", hex: "#84cc16" },
  { name: "Szary", hex: "#64748b" },
  { name: "Szmaragdowy", hex: "#10b981" },
  { name: "Morski", hex: "#14b8a6" },
  { name: "Indigo", hex: "#6366f1" },
  { name: "Fuksja", hex: "#d946ef" },
  { name: "Różany", hex: "#f43f5e" },
  { name: "Bursztynowy", hex: "#f59e0b" },
  { name: "Fiołkowy", hex: "#8b5cf6" },
  { name: "Cyan", hex: "#06b6d4" },
  { name: "Oliwkowy", hex: "#65a30d" },
  { name: "Granatowy", hex: "#1e40af" },
  { name: "Malinowy", hex: "#be123c" },
  { name: "Wrzosowy", hex: "#c084fc" },
];

export interface TaskLabelPickerPopoverProps {
  taskId: Id<"orderTasks">;
  currentLabelIds?: Id<"taskLabels">[];
  open: boolean;
  onClose: () => void;
}

export default function TaskLabelPickerPopover({
  taskId,
  currentLabelIds = [],
  open,
  onClose,
}: TaskLabelPickerPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [labelSearch, setLabelSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newColor, setNewColor] = useState("#22c55e");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allLabels = useQuery(api.taskLabels.list) ?? [];
  const updateTask = useMutation(api.orderTasks.update);
  const createLabel = useMutation(api.taskLabels.create);

  useEffect(() => {
    if (!open) {
      setIsCreating(false);
      setLabelSearch("");
      setNewTitle("");
      return;
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  async function toggleLabel(labelId: Id<"taskLabels">) {
    const isSelected = currentLabelIds.includes(labelId);
    const updated = isSelected
      ? currentLabelIds.filter((id) => id !== labelId)
      : [...currentLabelIds, labelId];

    await updateTask({
      taskId,
      labelIds: updated,
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const createdId = await createLabel({
        title: newTitle.trim(),
        color: newColor,
      });

      const updated = [...currentLabelIds, createdId];
      await updateTask({
        taskId,
        labelIds: updated,
      });

      setNewTitle("");
      setIsCreating(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  const filteredLabels = allLabels.filter((l) =>
    l.title.toLowerCase().includes(labelSearch.toLowerCase())
  );

  return (
    <div
      ref={popoverRef}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className="absolute right-0 top-8 z-50 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-2xl text-left select-none animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Nagłówek */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
          {isCreating ? "Nowa etykieta" : "Etykiety"}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          title="Zamknij"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {!isCreating ? (
        <>
          {/* Szukajka */}
          {allLabels.length > 3 && (
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-2 size-3 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Szukaj etykiet..."
                value={labelSearch}
                onChange={(e) => setLabelSearch(e.target.value)}
                className="w-full rounded-md border border-gray-200 pl-7 pr-2.5 py-1 text-xs outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                autoFocus
              />
            </div>
          )}

          {/* Lista etykiet */}
          <div className="max-h-48 overflow-y-auto space-y-1 pr-0.5">
            {filteredLabels.map((l) => {
              const isSelected = currentLabelIds.includes(l._id);
              return (
                <button
                  key={l._id}
                  type="button"
                  onClick={() => void toggleLabel(l._id)}
                  className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90 active:scale-[0.99]"
                  style={{ backgroundColor: l.color }}
                  title={isSelected ? `Odznacz: ${l.title}` : `Zaznacz: ${l.title}`}
                >
                  <span className="truncate mr-2 drop-shadow-sm">{l.title}</span>
                  {isSelected && (
                    <Check className="size-3.5 shrink-0 text-white drop-shadow-md" />
                  )}
                </button>
              );
            })}

            {allLabels.length === 0 && (
              <div className="py-4 text-center text-xs text-gray-400">
                Brak zdefiniowanych etykiet
              </div>
            )}

            {allLabels.length > 0 && filteredLabels.length === 0 && (
              <div className="py-4 text-center text-xs text-gray-400">
                Nie znaleziono etykiety
              </div>
            )}
          </div>

          {/* Przycisk dodawania nowej etykiety */}
          <button
            type="button"
            onClick={() => {
              setIsCreating(true);
              setNewTitle(labelSearch.trim());
              setNewColor("#22c55e");
            }}
            className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-gray-300 bg-gray-50/80 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <Plus className="size-3.5" />
            Utwórz nową etykietę
          </button>
        </>
      ) : (
        /* Formularz tworzenia nowej etykiety */
        <form onSubmit={handleCreate} className="space-y-2.5">
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase">Nazwa</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="np. Pilne, Wycena..."
              className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-xs outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
              autoFocus
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase">Kolor</label>
            <div className="grid grid-cols-6 gap-1.5 mt-1 max-h-32 overflow-y-auto pr-0.5">
              {PRESET_LABEL_COLORS.map((col) => (
                <button
                  key={col.hex}
                  type="button"
                  onClick={() => setNewColor(col.hex)}
                  className="size-6 rounded-md relative flex items-center justify-center border hover:scale-110 transition-transform"
                  style={{
                    backgroundColor: col.hex,
                    borderColor: newColor === col.hex ? "#000000" : "transparent",
                  }}
                  title={col.name}
                >
                  {newColor === col.hex && (
                    <Check className="size-3 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="flex-1 rounded-md border border-gray-200 bg-white py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Wróć
            </button>
            <button
              type="submit"
              disabled={!newTitle.trim() || isSubmitting}
              className="flex-1 rounded-md bg-indigo-600 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Zapis..." : "Dodaj"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
