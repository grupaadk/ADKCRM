"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { X, Plus, Play, CheckCircle2, History } from "lucide-react";

export function ITKanbanTab() {
  const columns = useQuery(api.itKanban.getColumns) ?? [];
  const tasks = useQuery(api.itKanban.getTasks) ?? [];
  const sprints = useQuery(api.itKanban.getSprints) ?? [];

  const createColumn = useMutation(api.itKanban.createColumn);
  const deleteColumn = useMutation(api.itKanban.deleteColumn);
  const createTask = useMutation(api.itKanban.createTask);
  const updateTask = useMutation(api.itKanban.updateTask);
  const deleteTask = useMutation(api.itKanban.deleteTask);
  const moveTask = useMutation(api.itKanban.moveTask);

  const createSprint = useMutation(api.itKanban.createSprint);
  const updateSprintStatus = useMutation(api.itKanban.updateSprintStatus);
  const deleteSprint = useMutation(api.itKanban.deleteSprint);

  const [mode, setMode] = useState<"active-sprint" | "backlog" | "all-tasks" | "history">("all-tasks");
  const [viewType, setViewType] = useState<"board" | "list">("board");
  const [backlogSearchQuery, setBacklogSearchQuery] = useState("");

  const [newColName, setNewColName] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [addingTaskToCol, setAddingTaskToCol] = useState<Id<"itKanbanColumns"> | null>(null);

  const [newSprintName, setNewSprintName] = useState("");
  
  // DND State for board
  const [draggedTaskId, setDraggedTaskId] = useState<Id<"itKanbanTasks"> | null>(null);
  
  // DND State for backlog
  const [draggedToSprintId, setDraggedToSprintId] = useState<Id<"itKanbanSprints"> | "backlog" | null>(null);

  // Modals state
  const [startingSprintId, setStartingSprintId] = useState<Id<"itKanbanSprints"> | null>(null);
  const [endingSprintId, setEndingSprintId] = useState<Id<"itKanbanSprints"> | null>(null);

  const activeSprint = sprints.find((s) => s.status === "active");
  const plannedSprints = sprints.filter((s) => s.status === "planned");
  const completedSprints = sprints.filter((s) => s.status === "completed").sort((a, b) => (b.endDate || 0) - (a.endDate || 0));

  // Handlers
  const handleAddColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;
    await createColumn({ title: newColName.trim(), color: "#cbd5e1" });
    setNewColName("");
  };

  const handleAddTask = async (colId: Id<"itKanbanColumns">, sprintId?: Id<"itKanbanSprints">) => {
    if (!newTaskTitle.trim()) {
      setAddingTaskToCol(null);
      return;
    }
    await createTask({
      columnId: colId,
      sprintId,
      title: newTaskTitle.trim(),
      priority: "normal",
    });
    setNewTaskTitle("");
    setAddingTaskToCol(null);
  };

  const handleCreateSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSprintName.trim()) return;
    await createSprint({ name: newSprintName.trim() });
    setNewSprintName("");
  };

  // DND Board Handlers
  const handleDragStart = (e: React.DragEvent, taskId: Id<"itKanbanTasks">) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const handleDropToColumn = async (e: React.DragEvent, colId: Id<"itKanbanColumns">) => {
    e.preventDefault();
    if (!draggedTaskId) return;
    const task = tasks.find((t) => t._id === draggedTaskId);
    if (!task) return;
    
    const colTasks = tasks.filter(t => t.columnId === colId);
    const newPos = colTasks.length > 0 ? Math.max(...colTasks.map(t => t.position)) + 1 : 0;

    if (task.columnId !== colId) {
      await moveTask({ id: draggedTaskId, columnId: colId, position: newPos });
    }
    setDraggedTaskId(null);
  };

  // DND Backlog Handlers
  const handleDropToSprint = async (e: React.DragEvent, targetSprintId: Id<"itKanbanSprints"> | null) => {
    e.preventDefault();
    if (!draggedTaskId) return;
    
    const task = tasks.find((t) => t._id === draggedTaskId);
    if (!task) return;

    if (task.sprintId !== targetSprintId) {
       await updateTask({ id: task._id, sprintId: targetSprintId });
    }
    setDraggedTaskId(null);
    setDraggedToSprintId(null);
  };

  const renderActiveSprint = (sprintFilter: Id<"itKanbanSprints"> | "all") => {
    if (sprintFilter !== "all" && !activeSprint) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <Play className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900">Brak aktywnego sprintu</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm">
            Przejdź do widoku Planowania (Backlog), stwórz nowy sprint i rozpocznij go, aby widzieć zadania tutaj.
          </p>
          <button
            onClick={() => setMode("backlog")}
            className="mt-6 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Przejdź do Planowania
          </button>
        </div>
      );
    }

    const sprintTasks = sprintFilter === "all" ? tasks : tasks.filter((t) => t.sprintId === activeSprint?._id);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-slate-900">
              {sprintFilter === "all" ? "Wszystkie zadania" : activeSprint?.name}
            </h3>
            {sprintFilter !== "all" && (
              <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">Aktywny</span>
            )}
          </div>
          <div className="flex items-center gap-3">
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
            {sprintFilter !== "all" && activeSprint && (
              <button
                onClick={() => setEndingSprintId(activeSprint._id)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" /> Zakończ sprint
              </button>
            )}
          </div>
        </div>

        {viewType === "board" ? (
          <div className="flex items-start gap-6 overflow-x-auto pb-4 min-h-[500px]">
            {columns.map((col) => {
              const colTasks = sprintTasks
                .filter((t) => t.columnId === col._id)
                .sort((a, b) => a.position - b.position);

              return (
                <div
                  key={col._id}
                  className="flex-shrink-0 w-80 bg-slate-100 rounded-xl p-3 flex flex-col max-h-[80vh]"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDropToColumn(e, col._id)}
                >
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="font-semibold text-sm text-slate-800">{col.title} <span className="text-slate-400 font-normal ml-1">{colTasks.length}</span></h3>
                    <button
                      onClick={async () => {
                        if (confirm("Usunąć tę listę? Zadania z niej pozostaną bez kolumny i wywołają błąd, zalecane tylko puste!")) {
                           await deleteColumn({ id: col._id });
                        }
                      }}
                      className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-slate-200"
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
                        <div className="flex items-start gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); updateTask({ id: task._id, isCompleted: !task.isCompleted }) }}
                            className={`mt-0.5 flex-shrink-0 transition-colors ${task.isCompleted ? 'text-green-500' : 'text-slate-200 hover:text-slate-400'}`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <p className={`text-sm font-medium leading-snug flex-1 ${task.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{task.title}</p>
                          <button
                            onClick={() => {
                              if (confirm("Usunąć zadanie?")) deleteTask({ id: task._id });
                            }}
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 transition-opacity flex-shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    {/* Add Task input inside active sprint adds to this sprint */}
                    {addingTaskToCol === col._id ? (
                      <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-200 mt-2">
                        <input
                          autoFocus
                          className="w-full text-sm outline-none bg-transparent"
                          placeholder="Tytuł zadania..."
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddTask(col._id, sprintFilter === "all" ? undefined : activeSprint?._id);
                            if (e.key === "Escape") setAddingTaskToCol(null);
                          }}
                          onBlur={() => handleAddTask(col._id, sprintFilter === "all" ? undefined : activeSprint?._id)}
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingTaskToCol(col._id)}
                        className="flex items-center gap-2 text-slate-500 hover:bg-slate-200 w-full p-2 rounded-lg text-sm font-medium transition-colors mt-2"
                      >
                        <Plus className="w-4 h-4" /> Dodaj zadanie
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="flex-shrink-0 w-80">
              <form onSubmit={handleAddColumn} className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-3">
                <input
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400"
                  placeholder="+ Dodaj kolumnę"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                />
              </form>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {columns.map((col) => {
              const colTasks = sprintTasks
                .filter((t) => t.columnId === col._id)
                .sort((a, b) => a.position - b.position);

              return (
                <div key={col._id} className="space-y-3">
                  <div className="flex items-center gap-2 group">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: col.color || "#cbd5e1" }} />
                    <h3 className="font-semibold text-sm text-slate-800">{col.title} <span className="text-slate-400 font-normal ml-1">{colTasks.length}</span></h3>
                  </div>
                  
                  {colTasks.length === 0 ? (
                     <p className="text-xs text-slate-400 pl-5">Brak zadań w kolumnie.</p>
                  ) : (
                    <div className="border border-slate-200 rounded-lg overflow-hidden ml-5 bg-white">
                      <table className="w-full text-left text-sm">
                        <tbody className="divide-y divide-slate-100">
                          {colTasks.map((task) => (
                            <tr key={task._id} className="hover:bg-slate-50 group">
                              <td className="px-4 py-2.5 font-medium flex items-center gap-2">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); updateTask({ id: task._id, isCompleted: !task.isCompleted }) }}
                                  className={`flex-shrink-0 transition-colors ${task.isCompleted ? 'text-green-500' : 'text-slate-200 hover:text-slate-400'}`}
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                                <span className={task.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'}>{task.title}</span>
                              </td>
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
                            if (e.key === "Enter") handleAddTask(col._id, sprintFilter === "all" ? undefined : activeSprint?._id);
                            if (e.key === "Escape") setAddingTaskToCol(null);
                          }}
                          onBlur={() => handleAddTask(col._id, sprintFilter === "all" ? undefined : activeSprint?._id)}
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingTaskToCol(col._id)}
                        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 font-medium transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Dodaj zadanie
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderBacklog = () => {
    let backlogTasks = tasks.filter((t) => t.sprintId === undefined);
    
    if (backlogSearchQuery.trim()) {
      const q = backlogSearchQuery.toLowerCase();
      backlogTasks = backlogTasks.filter(t => t.title.toLowerCase().includes(q));
    }

    // Domyślna kolumna dla nowo tworzonych zadań w backlogu
    const defaultColumnId = columns.length > 0 ? columns[0]._id : undefined;

    return (
      <div className="space-y-8 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Planowanie (Backlog)</h3>
            <p className="text-sm text-slate-500 mt-1">Przeciągnij zadania z Backlogu do odpowiednich sprintów.</p>
          </div>
          <form onSubmit={handleCreateSprint} className="flex gap-2">
            <input
              className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-slate-400 w-64"
              placeholder="Nazwa nowego sprintu..."
              value={newSprintName}
              onChange={(e) => setNewSprintName(e.target.value)}
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              Utwórz Sprint
            </button>
          </form>
        </div>

        {/* List of planned sprints */}
        <div className="space-y-6">
          {plannedSprints.map((sprint) => {
            const sprintTasks = tasks.filter((t) => t.sprintId === sprint._id);
            return (
              <div 
                key={sprint._id} 
                className={`bg-slate-50 border rounded-xl overflow-hidden transition-colors ${draggedToSprintId === sprint._id ? 'border-slate-400 bg-slate-100' : 'border-slate-200'}`}
                onDragOver={(e) => { e.preventDefault(); setDraggedToSprintId(sprint._id); }}
                onDragLeave={() => setDraggedToSprintId(null)}
                onDrop={(e) => handleDropToSprint(e, sprint._id)}
              >
                <div className="flex items-center justify-between bg-slate-100 px-4 py-3 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <h4 className="font-semibold text-slate-800">{sprint.name}</h4>
                    <span className="text-xs font-medium text-slate-500 bg-slate-200 px-2 py-0.5 rounded-md">{sprintTasks.length} zadań</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={async () => {
                        if (activeSprint) {
                          alert("Zakończ wpierw obecny aktywny sprint!");
                          return;
                        }
                        setStartingSprintId(sprint._id);
                      }}
                      className="text-xs font-medium bg-white border border-slate-200 shadow-sm px-3 py-1.5 rounded text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Rozpocznij sprint
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm("Usunąć ten sprint? Zadania z niego wrócą do Backlogu.")) {
                          await deleteSprint({ id: sprint._id });
                        }
                      }}
                      className="text-slate-400 hover:text-red-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="p-2 min-h-[60px]">
                  {sprintTasks.length === 0 ? (
                    <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-sm">
                      Przeciągnij zadania tutaj
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {sprintTasks.map(task => (
                         <div
                           key={task._id}
                           draggable
                           onDragStart={(e) => handleDragStart(e, task._id)}
                           className="flex items-center justify-between bg-white px-3 py-2 border border-slate-200 rounded-md cursor-grab active:cursor-grabbing hover:border-slate-300 transition-colors group"
                         >
                           <div className="flex items-center gap-2">
                             <button 
                               onClick={(e) => { e.stopPropagation(); updateTask({ id: task._id, isCompleted: !task.isCompleted }) }}
                               className={`flex-shrink-0 transition-colors ${task.isCompleted ? 'text-green-500' : 'text-slate-200 hover:text-slate-400'}`}
                             >
                               <CheckCircle2 className="w-4 h-4" />
                             </button>
                             <span className={`text-sm font-medium ${task.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{task.title}</span>
                           </div>
                           <button
                             onClick={() => updateTask({ id: task._id, sprintId: null })} // usun ze sprintu = przenies do backlogu
                             className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600"
                             title="Usuń ze sprintu (wyślij do backlogu)"
                           >
                             <X className="w-3.5 h-3.5" />
                           </button>
                         </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Backlog area */}
        <div 
          className={`border-t border-slate-200 pt-6 mt-8 ${draggedToSprintId === "backlog" ? 'bg-slate-50 -mx-4 px-4 rounded-lg' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDraggedToSprintId("backlog"); }}
          onDragLeave={() => setDraggedToSprintId(null)}
          onDrop={(e) => handleDropToSprint(e, null)}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h4 className="text-lg font-semibold text-slate-900">Backlog (Nieprzypisane zadania)</h4>
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{backlogTasks.length} zadań</span>
            </div>
            
            <input
              type="text"
              placeholder="Szukaj w backlogu..."
              value={backlogSearchQuery}
              onChange={(e) => setBacklogSearchQuery(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-slate-400 bg-white"
            />
          </div>

          <div className="space-y-6 mb-4">
            {columns.map((col) => {
              const colTasks = backlogTasks.filter(t => t.columnId === col._id).sort((a, b) => a.position - b.position);
              
              if (colTasks.length === 0) return null; // Ukryj puste kolumny w backlogu dla przejrzystości
              
              return (
                <div key={col._id}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: col.color || "#cbd5e1" }} />
                    <h5 className="text-sm font-semibold text-slate-700">{col.title}</h5>
                  </div>
                  <div className="space-y-1 pl-4 border-l-2 border-slate-100">
                    {colTasks.map((task) => (
                      <div
                        key={task._id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task._id)}
                        className="flex items-center justify-between bg-white px-3 py-2 border border-slate-200 rounded-md cursor-grab active:cursor-grabbing hover:border-slate-300 transition-colors group"
                      >
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); updateTask({ id: task._id, isCompleted: !task.isCompleted }) }}
                            className={`flex-shrink-0 transition-colors ${task.isCompleted ? 'text-green-500' : 'text-slate-200 hover:text-slate-400'}`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <span className={`text-sm font-medium ${task.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{task.title}</span>
                        </div>
                        <button
                          onClick={() => {
                            if (confirm("Usunąć zadanie całkowicie?")) deleteTask({ id: task._id });
                          }}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 transition-opacity"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            
            {backlogTasks.length === 0 && !backlogSearchQuery && (
               <div className="text-center py-6 text-slate-400 text-sm">
                 Backlog jest pusty. Wszystkie zadania zostały zaplanowane w sprintach!
               </div>
            )}
            
            {backlogTasks.length === 0 && backlogSearchQuery && (
               <div className="text-center py-6 text-slate-400 text-sm">
                 Brak wyników wyszukiwania dla &quot;{backlogSearchQuery}&quot;.
               </div>
            )}
          </div>
          
          {defaultColumnId ? (
            <div className="max-w-md">
              <input
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400 focus:bg-white transition-colors"
                placeholder="+ Dodaj zadanie do Backlogu (Enter)"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && newTaskTitle.trim()) {
                    await createTask({
                      columnId: defaultColumnId,
                      title: newTaskTitle.trim(),
                      priority: "normal",
                    });
                    setNewTaskTitle("");
                  }
                }}
              />
            </div>
          ) : (
            <p className="text-xs text-amber-600">Utwórz przynajmniej jedną kolumnę w widoku Aktywnego Sprintu, aby móc dodawać zadania.</p>
          )}
        </div>
      </div>
    );
  };

  const renderHistory = () => {
    if (completedSprints.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <History className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900">Brak historii sprintów</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm">
            Gdy zrealizujesz i zakończysz swój pierwszy sprint, pojawi się on w tym miejscu.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-8 max-w-4xl">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Historia Sprintów</h3>
          <p className="text-sm text-slate-500 mt-1">Zakończone sprinty oraz zadania w nich zrealizowane.</p>
        </div>
        <div className="space-y-6">
          {completedSprints.map((sprint) => {
            const sprintTasks = tasks.filter((t) => t.sprintId === sprint._id);
            const completedCount = sprintTasks.filter(t => t.isCompleted).length;
            const startDateStr = sprint.startDate ? new Date(sprint.startDate).toLocaleDateString('pl-PL') : "Brak daty";
            const endDateStr = sprint.endDate ? new Date(sprint.endDate).toLocaleDateString('pl-PL') : "Brak daty";

            return (
              <div key={sprint._id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-800">{sprint.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{startDateStr} - {endDateStr}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-md shadow-sm">
                      Zakończono: {completedCount} / {sprintTasks.length}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  {sprintTasks.length === 0 ? (
                    <p className="text-sm text-slate-500">Brak zadań w tym sprincie.</p>
                  ) : (
                    <div className="space-y-2">
                      {sprintTasks.map(task => (
                        <div key={task._id} className="flex items-center gap-3">
                          <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${task.isCompleted ? 'text-green-500' : 'text-slate-300'}`} />
                          <span className={`text-sm ${task.isCompleted ? 'text-slate-700 font-medium' : 'text-slate-400 line-through'}`}>
                            {task.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderModals = () => {
    // START SPRINT MODAL
    if (startingSprintId) {
      const sprintToStart = sprints.find(s => s._id === startingSprintId);
      const tasksInSprint = tasks.filter(t => t.sprintId === startingSprintId);

      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-900">Rozpocznij sprint</h3>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-slate-600">
                Zamierzasz wystartować sprint <strong>{sprintToStart?.name}</strong>. W tym sprincie znajduje się obecnie <strong>{tasksInSprint.length}</strong> zadań.
              </p>
              <p className="text-sm text-slate-600">
                Po rozpoczęciu, sprint pojawi się w zakładce Tablica Sprintu dla całego zespołu.
              </p>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button 
                onClick={() => setStartingSprintId(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={async () => {
                  await updateSprintStatus({ id: startingSprintId, status: "active" });
                  setStartingSprintId(null);
                  setMode("active-sprint");
                }}
                className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
              >
                Rozpocznij sprint
              </button>
            </div>
          </div>
        </div>
      );
    }

    // END SPRINT MODAL
    if (endingSprintId) {
      const sprintToEnd = sprints.find(s => s._id === endingSprintId);
      const tasksInSprint = tasks.filter(t => t.sprintId === endingSprintId);
      const completedCount = tasksInSprint.filter(t => t.isCompleted).length;
      const incompleteCount = tasksInSprint.length - completedCount;

      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-900">Zakończ sprint</h3>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-slate-600">
                Podsumowanie sprintu <strong>{sprintToEnd?.name}</strong>:
              </p>
              <div className="bg-slate-50 p-4 rounded-lg flex items-center justify-around border border-slate-100">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{completedCount}</div>
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Ukończone</div>
                </div>
                <div className="w-px h-10 bg-slate-200" />
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-500">{incompleteCount}</div>
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Otwarte</div>
                </div>
              </div>
              {incompleteCount > 0 && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <p className="text-xs text-amber-800 font-medium">
                    Uwaga: {incompleteCount} niezakończone zadania zostaną automatycznie przeniesione z powrotem do Backlogu (stracą przypisanie do tego sprintu).
                  </p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button 
                onClick={() => setEndingSprintId(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Wróć
              </button>
              <button
                onClick={async () => {
                  await updateSprintStatus({ id: endingSprintId, status: "completed" });
                  setEndingSprintId(null);
                  setMode("history");
                }}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                Zakończ sprint
              </button>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6">
      {renderModals()}
      
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">IT Kanban</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Zarządzaj pracą zespołu IT.
          </p>
        </div>
        <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setMode("all-tasks")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
              mode === "all-tasks"
                ? "bg-white shadow-sm text-slate-900"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            Wszystkie zadania
          </button>
          <button
            onClick={() => setMode("active-sprint")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
              mode === "active-sprint"
                ? "bg-white shadow-sm text-slate-900"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            Tablica Sprintu
          </button>
          <button
            onClick={() => setMode("backlog")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
              mode === "backlog"
                ? "bg-white shadow-sm text-slate-900"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            Planowanie (Backlog)
          </button>
          <button
            onClick={() => setMode("history")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
              mode === "history"
                ? "bg-white shadow-sm text-slate-900"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <History className="w-4 h-4" /> Historia
          </button>
        </div>
      </div>

      {mode === "active-sprint" && renderActiveSprint(activeSprint?._id || "none")}
      {mode === "all-tasks" && renderActiveSprint("all")}
      {mode === "backlog" && renderBacklog()}
      {mode === "history" && renderHistory()}
    </div>
  );
}
