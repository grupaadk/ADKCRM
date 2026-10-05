"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

type Props = {
  onClose: () => void;
  onCreated?: () => void;
};

export default function NewServiceTripModal({ onClose, onCreated }: Props) {
  const [visible, setVisible] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTrip = useMutation(api.serviceTrips.create);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleSave = async () => {
    if (!name.trim()) { setError("Wpisz nazwę wyjazdu."); return; }
    if (!date) { setError("Wybierz datę wyjazdu."); return; }

    setSaving(true);
    setError(null);
    try {
      await createTrip({ name: name.trim(), date: new Date(date).getTime() });
      onCreated?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd zapisu.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 800,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.2s",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--panel)",
          borderRadius: 14,
          padding: 28,
          width: 420,
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          transform: visible ? "scale(1)" : "scale(0.95)",
          transition: "transform 0.2s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-strong)" }}>
              Nowy wyjazd serwisowy
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-mute)" }}>
              Utwórz wyjazd i przypisuj do niego reklamacje
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-mute)", fontSize: 20, lineHeight: 1, padding: 4,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Nazwa */}
          <div>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--text-mute)", marginBottom: 5 }}>
              Nazwa wyjazdu <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Wyjazd do Krakowa — październik"
              autoFocus
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--line)",
                background: "var(--panel-2)",
                color: "var(--text)",
                fontSize: 13,
                fontFamily: "inherit",
                boxSizing: "border-box",
                outline: "none",
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>

          {/* Data */}
          <div>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--text-mute)", marginBottom: 5 }}>
              Data wyjazdu <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--line)",
                background: "var(--panel-2)",
                color: "var(--text)",
                fontSize: 13,
                fontFamily: "inherit",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          {error && (
            <p style={{
              margin: 0, fontSize: 12, color: "#dc2626",
              background: "#fef2f2", border: "1px solid #fca5a5",
              borderRadius: 6, padding: "6px 10px",
            }}>
              {error}
            </p>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "1px solid var(--line)", borderRadius: 7,
              cursor: "pointer", fontSize: 12.5, padding: "7px 16px",
              color: "var(--text-mute)", fontFamily: "inherit",
            }}
          >
            Anuluj
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="btn primary"
            style={{ fontSize: 12.5, padding: "7px 18px" }}
          >
            {saving ? "Tworzenie…" : "Utwórz wyjazd"}
          </button>
        </div>
      </div>
    </div>
  );
}
