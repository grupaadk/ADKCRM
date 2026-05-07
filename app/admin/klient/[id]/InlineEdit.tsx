"use client";

import { useState, useRef, useEffect } from "react";

interface InlineEditProps {
  value: string;
  onSave: (value: string) => void;
  label: string;
  placeholder?: string;
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-mute)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 4,
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
    if (trimmed !== value) onSave(trimmed);
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
            borderRadius: 5,
            padding: "5px 8px",
            fontSize: 13,
            fontFamily: "inherit",
            color: "var(--text-strong)",
            background: "var(--panel)",
            outline: "none",
            boxShadow: "0 0 0 3px var(--accent-soft)",
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <label style={LABEL_STYLE}>{label}</label>
      <button
        type="button"
        onClick={() => setEditing(true)}
        style={{
          display: "block",
          width: "calc(100% + 12px)",
          textAlign: "left",
          fontSize: 13,
          color: value ? "var(--text)" : "var(--text-mute)",
          fontStyle: value ? "normal" : "italic",
          background: "transparent",
          border: "1px solid transparent",
          borderRadius: 5,
          padding: "4px 6px",
          margin: "0 -6px",
          cursor: "pointer",
          fontFamily: "inherit",
          transition: "background 0.1s, border-color 0.1s",
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = "var(--panel-2)";
          e.currentTarget.style.borderColor = "var(--line-2)";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.borderColor = "transparent";
        }}
      >
        {value || (placeholder ?? "—")}
      </button>
    </div>
  );
}
