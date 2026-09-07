"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Plus, Trash2, Edit3, Save, Layers, Code, CheckCircle, FileText } from "lucide-react";

type ComponentCategory = "guidelines" | "pricing_rules" | "output_format" | "questions" | "validation" | "context";

const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  guidelines: "Wytyczne ogólne",
  pricing_rules: "Reguły wyceniania",
  output_format: "Formatowanie wyjścia",
  questions: "Pytania doprecyzowujące",
  validation: "Walidacja",
  context: "Kontekst danych",
};

export default function PromptComponentsLibrary() {
  const components = useQuery(api.aiWorkflows.listPromptComponents) ?? [];
  const upsertComponent = useMutation(api.aiWorkflows.upsertPromptComponent);
  const deleteComponent = useMutation(api.aiWorkflows.deletePromptComponent);

  const [editingId, setEditingId] = useState<Id<"aiPromptComponents"> | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ComponentCategory>("guidelines");
  const [content, setContent] = useState("");
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleEdit = (comp: (typeof components)[number]) => {
    setEditingId(comp._id);
    setTitle(comp.title);
    setCategory(comp.category);
    setContent(comp.content);
  };

  const handleReset = () => {
    setEditingId(null);
    setTitle("");
    setCategory("guidelines");
    setContent("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    try {
      await upsertComponent({
        id: editingId ?? undefined,
        title: title.trim(),
        category,
        content: content.trim(),
      });
      setStatusMsg({ type: "success", text: "Zapisano komponent wytycznych." });
      handleReset();
    } catch (err) {
      setStatusMsg({ type: "error", text: `Błąd zapisu: ${err instanceof Error ? err.message : "Nieznany błąd"}` });
    }
  };

  const handleDelete = async (id: Id<"aiPromptComponents">) => {
    if (!confirm("Czy na pewno chcesz usunąć ten komponent wytycznych?")) return;
    try {
      await deleteComponent({ id });
      setStatusMsg({ type: "success", text: "Usunięto komponent." });
    } catch (err) {
      setStatusMsg({ type: "error", text: `Błąd usuwania: ${err instanceof Error ? err.message : "Nieznany błąd"}` });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {statusMsg && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            backgroundColor: statusMsg.type === "success" ? "rgba(74, 187, 195, 0.1)" : "rgba(239, 68, 68, 0.1)",
            color: statusMsg.type === "success" ? "var(--accent)" : "var(--bad)",
            border: `1px solid ${statusMsg.type === "success" ? "var(--accent-line)" : "rgba(239, 68, 68, 0.2)"}`,
          }}
        >
          {statusMsg.text}
        </div>
      )}

      {/* Formularz dodawania / edycji */}
      <div className="panel" style={{ padding: 18, borderRadius: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Layers size={18} style={{ color: "var(--accent)" }} />
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
            {editingId ? "Edytuj Komponent Wytycznych" : "Stwórz Nowy Komponent Wytycznych Promptu"}
          </h3>
        </div>

        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 12 }}>
            <div>
              <label className="up mute" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>
                Nazwa komponentu (np. Zasady rabatowania tarasów)
              </label>
              <input
                type="text"
                className="panel"
                style={{ width: "100%", padding: "8px 12px", fontSize: 13, borderRadius: 6, border: "1px solid var(--line)" }}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Wpisz tytuł..."
                required
              />
            </div>

            <div>
              <label className="up mute" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>
                Kategoria
              </label>
              <select
                className="panel"
                style={{ width: "100%", padding: "8px 12px", fontSize: 13, borderRadius: 6, border: "1px solid var(--line)" }}
                value={category}
                onChange={(e) => setCategory(e.target.value as ComponentCategory)}
              >
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="up mute" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>
              Treść wytycznych dla Promptu AI (Instrukcja dla Claude)
            </label>
            <textarea
              className="panel"
              rows={4}
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 13,
                fontFamily: "monospace",
                borderRadius: 6,
                border: "1px solid var(--line)",
                resize: "vertical",
              }}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="np. Zawsze przed wyceną sprawdź szerokość profilu. Jeśli inwestycja przekracza 15 000 zł netto, zaproponuj bezpłatny transport..."
              required
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
            {editingId && (
              <button type="button" className="btn" onClick={handleReset} style={{ padding: "6px 14px", borderRadius: 6 }}>
                Anuluj
              </button>
            )}
            <button type="submit" className="btn primary" style={{ padding: "6px 16px", borderRadius: 6, gap: 6 }}>
              <Save size={14} />
              {editingId ? "Zapisz zmiany" : "Dodaj Komponent"}
            </button>
          </div>
        </form>
      </div>

      {/* Lista istniejących komponentów */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
        {components.map((comp) => (
          <div
            key={comp._id}
            className="panel"
            style={{
              padding: 14,
              borderRadius: 8,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              borderLeft: "3px solid var(--accent)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
              <div>
                <span className="pill acc" style={{ fontSize: 10, padding: "1px 6px" }}>
                  {CATEGORY_LABELS[comp.category as ComponentCategory] ?? comp.category}
                </span>
                <h4 style={{ fontSize: 14, fontWeight: 700, margin: "4px 0 0", color: "var(--text-strong)" }}>
                  {comp.title}
                </h4>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  className="btn"
                  onClick={() => handleEdit(comp)}
                  style={{ padding: 4, borderRadius: 4 }}
                  title="Edytuj"
                >
                  <Edit3 size={14} />
                </button>
                <button
                  className="btn"
                  onClick={() => handleDelete(comp._id)}
                  style={{ padding: 4, borderRadius: 4, color: "var(--bad)" }}
                  title="Usuń"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <p
              style={{
                fontSize: 12,
                color: "var(--text-dim)",
                margin: 0,
                whiteSpace: "pre-wrap",
                fontFamily: "monospace",
                maxHeight: 120,
                overflowY: "auto",
                backgroundColor: "var(--panel-2)",
                padding: 8,
                borderRadius: 6,
              }}
            >
              {comp.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
