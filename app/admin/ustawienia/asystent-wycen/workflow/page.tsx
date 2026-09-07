"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, GitFork, FileCode } from "lucide-react";
import WorkflowCanvas from "../asystent-wycen/WorkflowCanvas";
import PromptComponentsLibrary from "../asystent-wycen/PromptComponentsLibrary";

export default function WorkflowsSettingsPage() {
  const [activeTab, setActiveTab] = useState<"builder" | "components">("builder");

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 16px" }}>
      {/* Nagłówek powrotny */}
      <div style={{ marginBottom: 20 }}>
        <Link
          href="/admin/ustawienia/asystent-wycen"
          className="btn"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
        >
          <ArrowLeft size={16} /> Powrót do Ustawień Asystenta Wycen
        </Link>
      </div>

      {/* Tytuł i opis sekcji */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 6px", color: "var(--text-strong)" }}>
          Workflowy & Wytyczne AI (N8N Builder)
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-dim)", margin: 0, maxWidth: 800 }}>
          Dedykowany edytor procesów wyceniania w stylu N8N. Twórz wizualne schematy blokowe dla konkretnych usług oraz zarządzaj modułową biblioteką wytycznych i instrukcji dla Claude AI.
        </p>
      </div>

      {/* Nawigacja zakładek powiązanego widoku */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab("builder")}
          className={`btn ${activeTab === "builder" ? "primary" : ""}`}
          style={{ padding: "10px 18px", borderRadius: 8, fontSize: 14, gap: 8 }}
        >
          <GitFork size={16} /> Wizualny Edytor Workflow (Canvas)
        </button>
        <button
          onClick={() => setActiveTab("components")}
          className={`btn ${activeTab === "components" ? "primary" : ""}`}
          style={{ padding: "10px 18px", borderRadius: 8, fontSize: 14, gap: 8 }}
        >
          <FileCode size={16} /> Biblioteka Wytycznych Promptu
        </button>
      </div>

      {/* Zawartość wybranej zakładki */}
      {activeTab === "builder" && <WorkflowCanvas />}
      {activeTab === "components" && <PromptComponentsLibrary />}
    </div>
  );
}
