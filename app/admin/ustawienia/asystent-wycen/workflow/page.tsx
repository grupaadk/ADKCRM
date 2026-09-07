"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, GitFork, FileCode } from "lucide-react";
import WorkflowCanvas from "../WorkflowCanvas";
import PromptComponentsLibrary from "../PromptComponentsLibrary";

export default function WorkflowsSettingsPage() {
  const [activeTab, setActiveTab] = useState<"builder" | "components">("builder");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 6rem)", padding: "16px 24px", gap: 14 }}>
      {/* Pasek nawigacyjny i nagłówek */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link
            href="/admin/ustawienia/asystent-wycen"
            className="btn"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, padding: "6px 12px" }}
          >
            <ArrowLeft size={16} /> Powrót
          </Link>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--text-strong)", display: "flex", alignItems: "center", gap: 8 }}>
              Workflowy & Wytyczne AI <span className="pill acc" style={{ fontSize: 11, padding: "2px 8px" }}>N8N Builder</span>
            </h1>
          </div>
        </div>

        {/* Zakładki */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setActiveTab("builder")}
            className={`btn ${activeTab === "builder" ? "primary" : ""}`}
            style={{ padding: "6px 14px", borderRadius: 6, fontSize: 13, gap: 6 }}
          >
            <GitFork size={15} /> Visual Canvas (n8n)
          </button>
          <button
            onClick={() => setActiveTab("components")}
            className={`btn ${activeTab === "components" ? "primary" : ""}`}
            style={{ padding: "6px 14px", borderRadius: 6, fontSize: 13, gap: 6 }}
          >
            <FileCode size={15} /> Biblioteka Wytycznych
          </button>
        </div>
      </div>

      {/* Główna zawartość - pełna wysokość i szerokość */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {activeTab === "builder" && <WorkflowCanvas />}
        {activeTab === "components" && <PromptComponentsLibrary />}
      </div>
    </div>
  );
}
