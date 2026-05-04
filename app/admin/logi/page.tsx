"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";

const LEVEL_STYLES: Record<string, string> = {
  info: "bg-blue-50 text-blue-700",
  warn: "bg-yellow-50 text-yellow-700",
  error: "bg-red-50 text-red-700",
};

const SOURCES = ["createClientFolder", "createOrderFolder"];

export default function LogiPage() {
  const router = useRouter();
  const [source, setSource] = useState<string>("");

  const logs = useQuery(api.systemLogs.list, {
    source: source || undefined,
    limit: 200,
  });

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← Wróć
        </button>
        <h1 className="text-2xl font-bold text-slate-900">Logi systemowe</h1>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm text-slate-600">Źródło:</label>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Wszystkie</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {logs === undefined ? (
        <p className="text-sm text-slate-400">Ładowanie...</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-slate-400">Brak logów.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Czas</th>
                <th className="px-3 py-2 font-medium">Poziom</th>
                <th className="px-3 py-2 font-medium">Źródło</th>
                <th className="px-3 py-2 font-medium">Wiadomość</th>
                <th className="px-3 py-2 font-medium">Dane</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log: (typeof logs)[number]) => (
                <tr key={log._id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-400">
                    {new Date(log._creationTime).toLocaleString("pl-PL", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${LEVEL_STYLES[log.level] ?? ""}`}
                    >
                      {log.level}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-500">
                    {log.source}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{log.message}</td>
                  <td className="max-w-xs break-all px-3 py-2 font-mono text-xs text-slate-400">
                    {log.data ? JSON.stringify(log.data) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
