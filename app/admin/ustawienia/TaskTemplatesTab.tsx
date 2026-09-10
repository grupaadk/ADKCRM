"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Plus, Trash2, GripVertical, Pencil, X, ChevronUp, ChevronDown } from "lucide-react";

type TemplateItem = { title: string };

function reorderArray<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length) {
    return list;
  }
  const result = [...list];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

function moveItemUp<T>(list: T[], index: number): T[] {
  if (index <= 0) return list;
  return reorderArray(list, index, index - 1);
}

function moveItemDown<T>(list: T[], index: number): T[] {
  if (index >= list.length - 1) return list;
  return reorderArray(list, index, index + 1);
}

export function TaskTemplatesTab() {
  const templates = useQuery(api.taskTemplates.list) ?? [];
  const createTemplate = useMutation(api.taskTemplates.create);
  const updateTemplate = useMutation(api.taskTemplates.update);
  const removeTemplate = useMutation(api.taskTemplates.remove);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newItems, setNewItems] = useState<TemplateItem[]>([{ title: "" }]);
  const [newDragIdx, setNewDragIdx] = useState<number | null>(null);
  const [newDragOverIdx, setNewDragOverIdx] = useState<number | null>(null);

  const [editingId, setEditingId] = useState<Id<"taskTemplates"> | null>(null);
  const [editName, setEditName] = useState("");
  const [editItems, setEditItems] = useState<TemplateItem[]>([]);
  const [editDragIdx, setEditDragIdx] = useState<number | null>(null);
  const [editDragOverIdx, setEditDragOverIdx] = useState<number | null>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<Id<"taskTemplates"> | null>(null);

  function resetCreate() {
    setCreating(false);
    setNewName("");
    setNewItems([{ title: "" }]);
    setNewDragIdx(null);
    setNewDragOverIdx(null);
  }

  async function handleCreate() {
    const filtered = newItems.filter((i) => i.title.trim());
    if (!newName.trim() || filtered.length === 0) return;
    await createTemplate({ name: newName.trim(), items: filtered });
    resetCreate();
  }

  function startEdit(template: { _id: Id<"taskTemplates">; name: string; items: TemplateItem[] }) {
    setEditingId(template._id);
    setEditName(template.name);
    setEditItems([...template.items]);
    setEditDragIdx(null);
    setEditDragOverIdx(null);
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    const filtered = editItems.filter((i) => i.title.trim());
    if (!editName.trim() || filtered.length === 0) return;
    await updateTemplate({ templateId: editingId, name: editName.trim(), items: filtered });
    setEditingId(null);
  }

  async function handleDelete(id: Id<"taskTemplates">) {
    await removeTemplate({ templateId: id });
    setConfirmDeleteId(null);
  }

  async function handleQuickReorder(
    templateId: Id<"taskTemplates">,
    items: TemplateItem[],
    fromIdx: number,
    toIdx: number
  ) {
    const reordered = reorderArray(items, fromIdx, toIdx);
    await updateTemplate({ templateId, items: reordered });
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Szablony list zadań</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Zdefiniuj gotowe listy zadań, które można szybko zastosować w zleceniu. Przesuwaj zadania, aby ustalić ich kolejność.
          </p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
          >
            <Plus className="size-4" />
            Nowy szablon
          </button>
        )}
      </div>

      {/* Create form */}
      {creating && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50/50 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-3">Nowy szablon</h3>

          <div className="mb-4">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Nazwa szablonu
            </label>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="np. Montaż okien"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Zadania (przeciągnij uchwyt lub użyj strzałek, aby zmienić kolejność)
            </label>
            <div className="space-y-2">
              {newItems.map((item, idx) => {
                const isDragOver = newDragOverIdx === idx && newDragIdx !== idx;
                const isDragging = newDragIdx === idx;

                return (
                  <div
                    key={idx}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", String(idx));
                      setNewDragIdx(idx);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (newDragOverIdx !== idx) setNewDragOverIdx(idx);
                    }}
                    onDragLeave={() => {
                      if (newDragOverIdx === idx) setNewDragOverIdx(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (newDragIdx !== null && newDragIdx !== idx) {
                        setNewItems(reorderArray(newItems, newDragIdx, idx));
                      }
                      setNewDragIdx(null);
                      setNewDragOverIdx(null);
                    }}
                    onDragEnd={() => {
                      setNewDragIdx(null);
                      setNewDragOverIdx(null);
                    }}
                    className={`flex items-center gap-1.5 rounded-lg border bg-white p-1.5 transition-all ${
                      isDragOver
                        ? "border-blue-500 bg-blue-50/80 ring-2 ring-blue-200"
                        : "border-slate-200 hover:border-slate-300"
                    } ${isDragging ? "opacity-40" : ""}`}
                  >
                    <div
                      className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-600 shrink-0"
                      title="Przeciągnij, aby zmienić kolejność"
                    >
                      <GripVertical className="size-4" />
                    </div>

                    <div className="flex flex-col shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => setNewItems(moveItemUp(newItems, idx))}
                        className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-20 disabled:hover:bg-transparent"
                        title="Przesuń w górę"
                      >
                        <ChevronUp className="size-3" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === newItems.length - 1}
                        onClick={() => setNewItems(moveItemDown(newItems, idx))}
                        className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-20 disabled:hover:bg-transparent"
                        title="Przesuń w dół"
                      >
                        <ChevronDown className="size-3" />
                      </button>
                    </div>

                    <span className="flex size-5 shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] font-semibold text-slate-500">
                      {idx + 1}
                    </span>

                    <input
                      value={item.title}
                      onMouseDown={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const updated = [...newItems];
                        updated[idx] = { title: e.target.value };
                        setNewItems(updated);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          setNewItems([...newItems, { title: "" }]);
                        }
                      }}
                      placeholder={`Zadanie ${idx + 1}`}
                      className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-400"
                    />

                    {newItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setNewItems(newItems.filter((_, i) => i !== idx))}
                        className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                        title="Usuń zadanie"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => setNewItems([...newItems, { title: "" }])}
              className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              <Plus className="size-3" />
              Dodaj zadanie
            </button>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={resetCreate}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Anuluj
            </button>
            <button
              onClick={() => void handleCreate()}
              disabled={!newName.trim() || newItems.filter((i) => i.title.trim()).length === 0}
              className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
            >
              Zapisz szablon
            </button>
          </div>
        </div>
      )}

      {/* Templates list */}
      <div className="space-y-3">
        {templates.length === 0 && !creating && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
            <p className="text-sm text-slate-500">
              Brak szablonów. Kliknij &quot;Nowy szablon&quot;, aby utworzyć pierwszy.
            </p>
          </div>
        )}

        {templates.map((template) => {
          const isEditing = editingId === template._id;

          if (isEditing) {
            return (
              <div key={template._id} className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
                <div className="mb-3">
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Nazwa szablonu
                  </label>
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                  />
                </div>

                <div className="mb-4">
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Zadania (przeciągnij uchwyt lub użyj strzałek, aby zmienić kolejność)
                  </label>
                  <div className="space-y-2">
                    {editItems.map((item, idx) => {
                      const isDragOver = editDragOverIdx === idx && editDragIdx !== idx;
                      const isDragging = editDragIdx === idx;

                      return (
                        <div
                          key={idx}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", String(idx));
                            setEditDragIdx(idx);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            if (editDragOverIdx !== idx) setEditDragOverIdx(idx);
                          }}
                          onDragLeave={() => {
                            if (editDragOverIdx === idx) setEditDragOverIdx(null);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (editDragIdx !== null && editDragIdx !== idx) {
                              setEditItems(reorderArray(editItems, editDragIdx, idx));
                            }
                            setEditDragIdx(null);
                            setEditDragOverIdx(null);
                          }}
                          onDragEnd={() => {
                            setEditDragIdx(null);
                            setEditDragOverIdx(null);
                          }}
                          className={`flex items-center gap-1.5 rounded-lg border bg-white p-1.5 transition-all ${
                            isDragOver
                              ? "border-amber-500 bg-amber-50/80 ring-2 ring-amber-200"
                              : "border-slate-200 hover:border-slate-300"
                          } ${isDragging ? "opacity-40" : ""}`}
                        >
                          <div
                            className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-600 shrink-0"
                            title="Przeciągnij, aby zmienić kolejność"
                          >
                            <GripVertical className="size-4" />
                          </div>

                          <div className="flex flex-col shrink-0">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => setEditItems(moveItemUp(editItems, idx))}
                              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-20 disabled:hover:bg-transparent"
                              title="Przesuń w górę"
                            >
                              <ChevronUp className="size-3" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === editItems.length - 1}
                              onClick={() => setEditItems(moveItemDown(editItems, idx))}
                              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-20 disabled:hover:bg-transparent"
                              title="Przesuń w dół"
                            >
                              <ChevronDown className="size-3" />
                            </button>
                          </div>

                          <span className="flex size-5 shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] font-semibold text-slate-500">
                            {idx + 1}
                          </span>

                          <input
                            value={item.title}
                            onMouseDown={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const updated = [...editItems];
                              updated[idx] = { title: e.target.value };
                              setEditItems(updated);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                setEditItems([...editItems, { title: "" }]);
                              }
                            }}
                            className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-400"
                          />

                          {editItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setEditItems(editItems.filter((_, i) => i !== idx))}
                              className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                              title="Usuń zadanie"
                            >
                              <X className="size-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setEditItems([...editItems, { title: "" }])}
                    className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                  >
                    <Plus className="size-3" />
                    Dodaj zadanie
                  </button>
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    Anuluj
                  </button>
                  <button
                    onClick={() => void handleSaveEdit()}
                    disabled={!editName.trim() || editItems.filter((i) => i.title.trim()).length === 0}
                    className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
                  >
                    Zapisz zmiany
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={template._id}
              className="rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300 transition-colors shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-slate-900">{template.name}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {template.items.length}{" "}
                    {template.items.length === 1
                      ? "zadanie"
                      : template.items.length < 5
                        ? "zadania"
                        : "zadań"}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(template)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    title="Edytuj szablon"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(template._id)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                    title="Usuń szablon"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Task items preview with quick reordering */}
              <div className="mt-3 space-y-1">
                {template.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="flex size-4 shrink-0 items-center justify-center rounded border border-slate-300 text-[9px] font-semibold text-slate-400 bg-slate-50">
                        {idx + 1}
                      </span>
                      <span className="truncate">{item.title}</span>
                    </div>

                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => void handleQuickReorder(template._id, template.items, idx, idx - 1)}
                        className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-20 disabled:hover:bg-transparent"
                        title="Przesuń w górę"
                      >
                        <ChevronUp className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === template.items.length - 1}
                        onClick={() => void handleQuickReorder(template._id, template.items, idx, idx + 1)}
                        className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-20 disabled:hover:bg-transparent"
                        title="Przesuń w dół"
                      >
                        <ChevronDown className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete confirmation modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setConfirmDeleteId(null)}
          />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Usuń szablon</h3>
            <p className="mt-2 text-sm text-slate-600">
              Czy na pewno chcesz usunąć ten szablon? Zadania już zastosowane w zleceniach nie zostaną usunięte.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={() => void handleDelete(confirmDeleteId)}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Usuń
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
