"use client";

import { useState } from "react";
import { ITKanbanTab } from "@/app/admin/ustawienia/ITKanbanTab";
import { ITTimeTrackerWidget } from "@/components/it/ITTimeTrackerWidget";
import { ITTimeReportsView } from "@/components/it/ITTimeReportsView";
import { ITServicesManager } from "@/components/it/ITServicesManager";
import { Kanban, BarChart2, CreditCard } from "lucide-react";

export default function PracaITPage() {
  const [activeTab, setActiveTab] = useState<"board" | "reports" | "services">("board");

  return (
    <div className="w-full px-4 py-8 sm:px-6 lg:px-8">
      {/* Nagłówek i Nawigacja Zakładek */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Praca IT</h1>
          <p className="mt-1 text-sm text-gray-500">
            Tracker czasu pracy, tablica zadań IT, raporty oraz subskrypcje i usługi IT.
          </p>
        </div>

        {/* Nawigacja Przełączania Zakładek */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80 self-start sm:self-auto text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab("board")}
            className={`px-3.5 py-2 rounded-lg transition flex items-center gap-2 ${
              activeTab === "board"
                ? "bg-white text-slate-800 shadow-xs border border-slate-200"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Kanban className="size-4 text-[#4dbdc6]" />
            Tablica i Tracker
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("reports")}
            className={`px-3.5 py-2 rounded-lg transition flex items-center gap-2 ${
              activeTab === "reports"
                ? "bg-white text-slate-800 shadow-xs border border-slate-200"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <BarChart2 className="size-4 text-[#4dbdc6]" />
            Raporty czasu
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("services")}
            className={`px-3.5 py-2 rounded-lg transition flex items-center gap-2 ${
              activeTab === "services"
                ? "bg-white text-slate-800 shadow-xs border border-slate-200"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <CreditCard className="size-4 text-[#4dbdc6]" />
            Subskrypcje IT
          </button>
        </div>
      </div>

      {/* Zawartość zależna od aktywnej zakładki */}
      {activeTab === "board" ? (
        <>
          {/* Tracker Czasu Pracy IT (nad Kanbanem) */}
          <ITTimeTrackerWidget />
          {/* Kanban i Backlog */}
          <ITKanbanTab />
        </>
      ) : activeTab === "reports" ? (
        /* Widok Raportowania Czasowego */
        <ITTimeReportsView />
      ) : (
        /* Widok Spisu Usług i Subskrypcji IT */
        <ITServicesManager />
      )}
    </div>
  );
}
