"use client";

import Link from "next/link";
import { ArrowLeft, GitFork } from "lucide-react";
import WorkflowCanvas from "../WorkflowCanvas";

export default function WorkflowsSettingsPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 6rem)", padding: "16px 24px", gap: 14 }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        <Link
          href="/admin/ustawienia/asystent-wycen"
          className="btn"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, padding: "6px 12px" }}
        >
          <ArrowLeft size={16} /> Powrót
        </Link>
        <h1
          style={{
            fontSize: 18,
            fontWeight: 700,
            margin: 0,
            color: "var(--text-strong)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <GitFork size={18} style={{ color: "var(--accent)" }} />
          Workflowy &amp; Wytyczne AI
          <span className="pill acc" style={{ fontSize: 11, padding: "2px 8px" }}>
            N8N Builder
          </span>
        </h1>
      </div>

      {/* Canvas — full remaining height */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <WorkflowCanvas />
      </div>
    </div>
  );
}
