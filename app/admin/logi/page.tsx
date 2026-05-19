"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CrmPageHeader } from "@/components/crm-ui";

const LEVEL_PILL: Record<string, React.CSSProperties> = {
  info: { color: "var(--ok)", background: "var(--ok-soft)", borderColor: "oklch(0.78 0.14 155 / 0.35)" },
  warn: { color: "var(--warn)", background: "var(--warn-soft)", borderColor: "oklch(0.82 0.14 75 / 0.35)" },
  error: { color: "var(--bad)", background: "var(--bad-soft)", borderColor: "oklch(0.72 0.18 25 / 0.4)" },
};

const SOURCES = [
  "createClientFolder",
  "createOrderFolder",
  "createClientFolderForOpportunity",
  "uploadSalesOpportunityFiles",
  "uploadManualOpportunityFile",
];

export default function LogiPage() {
  const [source, setSource] = useState<string>("");

  const logs = useQuery(api.systemLogs.list, {
    source: source || undefined,
    limit: 200,
  });

  return (
    <div>
      <CrmPageHeader title="Logi systemowe" sub="Historia zdarzeń systemowych." />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span className="mute" style={{ fontSize: 12 }}>Źródło:</span>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          style={{ fontSize: 12, padding: "4px 8px", borderRadius: 5, border: "1px solid var(--line-2)", background: "var(--panel)", color: "var(--text)" }}
        >
          <option value="">Wszystkie</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {logs === undefined ? (
        <p className="mute" style={{ fontSize: 13 }}>Ładowanie…</p>
      ) : logs.length === 0 ? (
        <p className="mute" style={{ fontSize: 13 }}>Brak logów.</p>
      ) : (
        <div className="panel" style={{ overflow: "hidden" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Czas</th>
                <th>Poziom</th>
                <th>Źródło</th>
                <th>Wiadomość</th>
                <th>Dane</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: (typeof logs)[number]) => (
                <tr key={log._id}>
                  <td className="mono mute" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                    {new Date(log._creationTime).toLocaleString("pl-PL", {
                      day: "2-digit", month: "2-digit",
                      hour: "2-digit", minute: "2-digit", second: "2-digit",
                    })}
                  </td>
                  <td>
                    <span className="pill" style={LEVEL_PILL[log.level] ?? {}}>
                      {log.level}
                    </span>
                  </td>
                  <td className="mono mute" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                    {log.source}
                  </td>
                  <td style={{ fontSize: 12.5 }}>{log.message}</td>
                  <td className="mono mute" style={{ fontSize: 10.5, maxWidth: 300, wordBreak: "break-all" }}>
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
