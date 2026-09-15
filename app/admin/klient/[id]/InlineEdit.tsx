"use client";

import { useState, useRef, useEffect } from "react";

interface InlineEditProps {
  value: string;
  onSave: (value: string) => void;
  label: string;
  placeholder?: string;
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  color: "var(--text-mute)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 3,
  display: "block",
};

export default function InlineEdit({ value, onSave, label, placeholder }: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed !== value) {
      onSave(trimmed);
    }
    setEditing(false);
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  if (editing) {
    return (
      <div>
        <label style={LABEL_STYLE}>{label}</label>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") cancel();
            }}
            placeholder={placeholder}
            style={{
              width: "100%",
              border: "1px solid var(--accent)",
              borderRadius: 6,
              padding: "4px 8px",
              fontSize: 12.5,
              fontWeight: 600,
              fontFamily: "inherit",
              color: "var(--text-strong)",
              background: "var(--panel)",
              outline: "none",
              boxShadow: "0 0 0 3px var(--accent-soft)",
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <label style={LABEL_STYLE}>{label}</label>
      <div
        className="group"
        style={{
          display: "flex",
          alignItems: "center",
          justify: "space-between",
          borderRadius: 6,
          background: "var(--panel)",
          border: "1px solid var(--line-2)",
          padding: "4px 8px",
          minHeight: 30,
          cursor: "pointer",
          transition: "all 0.15s ease",
        }}
        onClick={() => setEditing(true)}
      >
        <span
          style={{
            fontSize: 12.5,
            fontWeight: value ? 700 : 500,
            color: value ? "var(--text-strong)" : "var(--text-mute)",
            fontStyle: value ? "normal" : "italic",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value ? `${value} zł` : (placeholder ?? "—")}
        </span>
        {value && (
          <button
            type="button"
            title="Wyczyszczenie pola"
            onClick={(e) => {
              e.stopPropagation();
              setDraft("");
              onSave("");
            }}
            style={{
              padding: "1px 4px",
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              color: "var(--text-mute)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              opacity: 0.6,
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.color = "#ef4444";
              e.currentTarget.style.opacity = "1";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = "var(--text-mute)";
              e.currentTarget.style.opacity = "0.6";
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

