"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { X, Plus } from "lucide-react";

export function ITKanbanTab() {
  const columns = useQuery(api.itKanban.getColumns) ?? [];
  const tasks = useQuery(api.itKanban.getTasks) ?? [];
  const createColumn = useMutation(api.itKanban.createColumn);
  const deleteColumn = useMutation(api.itKanban.deleteColumn);
  const createTask = useMutation(api.itKanban.createTask);
  const deleteTask = useMutation(api.itKanban.deleteTask);
  const moveTask = useMutation(api.itKanban.moveTask);

  const [newColName, setNewColName] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [addingTaskToCol, setAddingTaskToCol] = useState<Id<"itKanbanColumns"> | null>(null);
  const [viewType, setViewType] = useState<"board" | "list">("board");

  // DND State
  const [draggedTaskId, setDraggedTaskId] = useState<Id<"itKanbanTasks"> | null>(null);

  const handleAddColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;
    await createColumn({ title: newColName.trim(), color: "#cbd5e1" });
    setNewColName("");
  };

  const handleAddTask = async (colId: Id<"itKanbanColumns">) => {
    if (!newTaskTitle.trim()) {
      setAddingTaskToCol(null);
      return;
    }
    await createTask({
      columnId: colId,
      title: newTaskTitle.trim(),
      priority: "normal",
    });
    setNewTaskTitle("");
    setAddingTaskToCol(null);
  };

  const handleDragStart = (e: React.DragEvent, taskId: Id<"itKanbanTasks">) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, colId: Id<"itKanbanColumns">) => {
    e.preventDefault();
    if (!draggedTaskId) return;

    const task = tasks.find((t) => t._id === draggedTaskId);
    if (!task) return;

    // Optional: Calculate new position based on drop target index instead of just appending
    // For simplicity, appending to the end of the new column
    const colTasks = tasks.filter(t => t.columnId === colId);
    const newPos = colTasks.length > 0 ? Math.max(...colTasks.map(t => t.position)) + 1 : 0;

    if (task.columnId !== colId) {
      await moveTask({ id: draggedTaskId, columnId: colId, position: newPos });
    }
    setDraggedTaskId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">IT Kanban</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Prywatna tablica zespołu IT. Możesz tu zarządzać wewnętrznymi zadaniami technicznymi.
          </p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setViewType("board")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewType === "board" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Tablica
          </button>
          <button
            onClick={() => setViewType("list")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewType === "list" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Lista (Notion-style)
          </button>
        </div>
      </div>

      {viewType === "list" ? (
        <div className="space-y-8">
          {columns.map((col) => {
            const colTasks = tasks
              .filter((t) => t.columnId === col._id)
              .sort((a, b) => a.position - b.position);

            return (
              <div key={col._id} className="space-y-3">
                <div className="flex items-center gap-2 group">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: col.color || "#cbd5e1" }} />
                  <h3 className="font-semibold text-sm text-slate-800">{col.title} <span className="text-slate-400 font-normal ml-1">{colTasks.length}</span></h3>
                  <button
                    onClick={async () => {
                      if (confirm("Usunąć tę listę?")) {
                        try {
                          await deleteColumn({ id: col._id });
                        } catch (err) {
                          alert(err instanceof Error ? err.message : "Wystąpił błąd");
                        }
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 ml-2 transition-opacity"
                    title="Usuń listę"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                {colTasks.length === 0 ? (
                   <p className="text-xs text-slate-400 pl-5">Brak zadań.</p>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden ml-5 bg-white">
                    <table className="w-full text-left text-sm">
                      <tbody className="divide-y divide-slate-100">
                        {colTasks.map((task) => (
                          <tr key={task._id} className="hover:bg-slate-50 group">
                            <td className="px-4 py-2.5 font-medium text-slate-700">{task.title}</td>
                            <td className="px-4 py-2.5 w-10 text-right">
                              <button
                                onClick={() => {
                                  if (confirm("Usunąć zadanie?")) deleteTask({ id: task._id });
                                }}
                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 transition-opacity"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                
                <div className="pl-5 pt-1">
                  {addingTaskToCol === col._id ? (
                    <div className="max-w-md bg-white p-2 rounded-lg shadow-sm border border-slate-200">
                      <input
                        autoFocus
                        className="w-full text-sm outline-none bg-transparent"
                        placeholder="Tytuł zadania..."
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddTask(col._id);
                          if (e.key === "Escape") setAddingTaskToCol(null);
                        }}
                        onBlur={() => handleAddTask(col._id)}
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingTaskToCol(col._id)}
                      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 font-medium transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Nowe zadanie
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          
          <div className="pt-4">
            <form onSubmit={handleAddColumn} className="max-w-xs">
              <input
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400"
                placeholder="+ Dodaj nową listę"
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
              />
            </form>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-6 overflow-x-auto pb-4">
        {columns.map((col) => {
          const colTasks = tasks
            .filter((t) => t.columnId === col._id)
            .sort((a, b) => a.position - b.position);

          return (
            <div
              key={col._id}
              className="flex-shrink-0 w-80 bg-slate-100 rounded-xl p-3 flex flex-col max-h-[80vh]"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col._id)}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="font-semibold text-sm text-slate-800">{col.title}</h3>
                <button
                  onClick={async () => {
                    if (confirm("Usunąć tę listę?")) {
                      try {
                        await deleteColumn({ id: col._id });
                      } catch (err) {
                        alert(err instanceof Error ? err.message : "Wystąpił błąd");
                      }
                    }
                  }}
                  className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-slate-200"
                  title="Usuń listę"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 min-h-[50px]">
                {colTasks.map((task) => (
                  <div
                    key={task._id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task._id)}
                    className={`bg-white p-3 rounded-lg shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing group ${
                      draggedTaskId === task._id ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <p className="text-sm text-slate-700 font-medium leading-snug">{task.title}</p>
                      <button
                        onClick={() => {
                          if (confirm("Usunąć zadanie?")) deleteTask({ id: task._id });
                        }}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {addingTaskToCol === col._id ? (
                  <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-200 mt-2">
                    <input
                      autoFocus
                      className="w-full text-sm outline-none bg-transparent"
                      placeholder="Tytuł zadania..."
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddTask(col._id);
                        if (e.key === "Escape") setAddingTaskToCol(null);
                      }}
                      onBlur={() => handleAddTask(col._id)}
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingTaskToCol(col._id)}
                    className="flex items-center gap-2 text-slate-500 hover:bg-slate-200 w-full p-2 rounded-lg text-sm font-medium transition-colors mt-2"
                  >
                    <Plus className="w-4 h-4" /> Dodaj kartę
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Dodaj nową listę */}
        <div className="flex-shrink-0 w-80">
          <form onSubmit={handleAddColumn} className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-3">
            <input
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400"
              placeholder="+ Dodaj nową listę"
              value={newColName}
              onChange={(e) => setNewColName(e.target.value)}
            />
          </form>
        </div>
        </div>
      )}
    </div>
  );
}
