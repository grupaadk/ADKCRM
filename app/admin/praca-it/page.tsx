"use client";

import { ITKanbanTab } from "@/app/admin/ustawienia/ITKanbanTab";

export default function PracaITPage() {
  return (
    <div className="w-full px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Praca IT</h1>
        <p className="mt-1 text-sm text-gray-500">
          Tablica zadań IT, sprinty oraz backlog.
        </p>
      </div>
      <ITKanbanTab />
    </div>
  );
}
