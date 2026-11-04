"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

export const DOC_KEYS: Array<{ key: string; short: string; label: string }> = [
  { key: "pomiar", short: "P", label: "Pomiar" },
  { key: "umowa", short: "U", label: "Umowa" },
  { key: "odbior_inwestor", short: "O", label: "Odbiór inwestorski" },
  { key: "protokol_montaz", short: "M", label: "Protokół montażu" },
  { key: "gwarancja_alco", short: "G", label: "Gwarancja ALCO" },
  { key: "reklamacja", short: "R", label: "Reklamacja" },
];

type DocEntry = {
  url?: string;
  signatureStatus?: "signed" | "not_applicable";
};

type DocStatusInfo = {
  style: React.CSSProperties;
  statusLabel: string;
  isUnsigned: boolean;
};

function getDocStatus(doc: DocEntry | undefined, label: string): DocStatusInfo {
  if (!doc?.url) {
    return {
      style: {
        background: "var(--panel-2, #f1f5f9)",
        color: "var(--text-mute, #94a3b8)",
        border: "1px solid var(--line, #e2e8f0)",
        opacity: 0.65,
      },
      statusLabel: `${label}: brak dokumentu`,
      isUnsigned: false,
    };
  }

  if (doc.signatureStatus === "signed") {
    return {
      style: {
        background: "#dcfce7",
        color: "#15803d",
        border: "1px solid #86efac",
        fontWeight: 700,
      },
      statusLabel: `${label}: podpisany ✓`,
      isUnsigned: false,
    };
  }

  if (doc.signatureStatus === "not_applicable") {
    return {
      style: {
        background: "#fef3c7",
        color: "#b45309",
        border: "1px solid #fde68a",
        fontWeight: 600,
      },
      statusLabel: `${label}: podpis nie dotyczy`,
      isUnsigned: false,
    };
  }

  // Wgrany / wygenerowany, ale niepodpisany!
  return {
    style: {
      background: "#fee2e2",
      color: "#b91c1c",
      border: "1.5px solid #ef4444",
      fontWeight: 800,
      boxShadow: "0 0 0 1px rgba(239, 68, 68, 0.2)",
    },
    statusLabel: `⚠️ ${label}: WGRANY, BRAK PODPISU!`,
    isUnsigned: true,
  };
}

export default function DocumentProgressTiles({
  documents,
}: {
  documents?: Record<string, DocEntry>;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        userSelect: "none",
      }}
    >
      {DOC_KEYS.map(({ key, short, label }) => {
        const { style, statusLabel, isUnsigned } = getDocStatus(documents?.[key], label);
        return (
          <div
            key={key}
            title={statusLabel}
            style={{
              width: 19,
              height: 19,
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              lineHeight: 1,
              fontFamily: "inherit",
              cursor: "help",
              position: "relative",
              ...style,
            }}
          >
            {short}
            {isUnsigned && (
              <span
                style={{
                  position: "absolute",
                  top: -2,
                  right: -2,
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  backgroundColor: "#dc2626",
                  border: "1px solid #fff",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function DocumentColumnHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 6,
        left: Math.max(12, Math.min(rect.left, window.innerWidth - 275)),
      });
    }
  };

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    updatePosition();
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  const handlePopoverMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const handlePopoverMouseLeave = () => {
    setIsOpen(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    updatePosition();
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleScrollOrOutside = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener("scroll", handleScrollOrOutside, true);
    window.addEventListener("click", handleScrollOrOutside);
    return () => {
      window.removeEventListener("scroll", handleScrollOrOutside, true);
      window.removeEventListener("click", handleScrollOrOutside);
    };
  }, [isOpen]);

  return (
    <>
      <div
        ref={triggerRef}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          position: "relative",
          display: "inline-flex",
          flexDirection: "column",
          gap: 2,
          cursor: "pointer",
          textAlign: "left",
          userSelect: "none",
        }}
      >
        <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span>Dokumenty</span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 13,
              height: 13,
              borderRadius: "50%",
              background: isOpen ? "var(--accent, #0ea5e9)" : "var(--panel-3, #f1f5f9)",
              color: isOpen ? "#ffffff" : "var(--text-mute, #64748b)",
              fontSize: 9,
              fontWeight: 700,
              border: `1px solid ${isOpen ? "var(--accent)" : "var(--line, #e2e8f0)"}`,
              transition: "all 0.15s ease",
            }}
            title="Kliknij lub najedź, aby zobaczyć agendę dokumentów"
          >
            ?
          </span>
        </div>
        <div
          style={{
            display: "inline-flex",
            gap: 3.5,
            fontSize: 8.5,
            fontWeight: 600,
            color: "var(--text-mute)",
            letterSpacing: "0.02em",
            lineHeight: 1,
          }}
        >
          {DOC_KEYS.map((doc, idx) => (
            <React.Fragment key={doc.key}>
              {idx > 0 && <span style={{ opacity: 0.4 }}>·</span>}
              <span title={`${doc.short} – ${doc.label}`}>{doc.short}</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Floating Agenda Popover in CRM style via Portal */}
      {typeof document !== "undefined" && isOpen && createPortal(
        <div
          onMouseEnter={handlePopoverMouseEnter}
          onMouseLeave={handlePopoverMouseLeave}
          style={{
            position: "fixed",
            top: coords.top,
            left: coords.left,
            zIndex: 9999,
            width: 260,
            background: "var(--panel, #ffffff)",
            border: "1px solid var(--line, #e2e8f0)",
            borderRadius: 10,
            padding: "12px 14px",
            boxShadow: "0 10px 25px -4px rgba(0, 0, 0, 0.12), 0 4px 10px -2px rgba(0, 0, 0, 0.05)",
            fontSize: 12,
            fontFamily: "inherit",
            color: "var(--text-strong, #0f172a)",
            textAlign: "left",
            animation: "fadeIn 0.12s ease-out",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: 6,
              marginBottom: 8,
              borderBottom: "1px solid var(--line, #f1f5f9)",
            }}
          >
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-strong)" }}>
              Agenda dokumentów
            </span>
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 600,
                padding: "1px 6px",
                borderRadius: 999,
                background: "var(--panel-2, #f8fafc)",
                color: "var(--text-mute)",
                border: "1px solid var(--line, #e2e8f0)",
              }}
            >
              6 typów
            </span>
          </div>

          {/* List of documents with mini-pills */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {DOC_KEYS.map((doc) => (
              <div
                key={doc.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 11.5,
                  padding: "2px 0",
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 9.5,
                    fontWeight: 700,
                    background: "var(--panel-2, #f8fafc)",
                    color: "var(--text-strong)",
                    border: "1px solid var(--line, #cbd5e1)",
                    flexShrink: 0,
                  }}
                >
                  {doc.short}
                </span>
                <span style={{ fontWeight: 500, color: "var(--text-strong)" }}>
                  {doc.label}
                </span>
              </div>
            ))}
          </div>

          {/* Color status legend */}
          <div
            style={{
              marginTop: 10,
              paddingTop: 8,
              borderTop: "1px solid var(--line, #f1f5f9)",
              display: "flex",
              flexDirection: "column",
              gap: 4.5,
            }}
          >
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: "var(--text-mute)",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 2,
              }}
            >
              Oznaczenia statusu:
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: "#fee2e2",
                  border: "1.5px solid #ef4444",
                  flexShrink: 0,
                }}
              />
              <span style={{ color: "#b91c1c", fontWeight: 600 }}>Czerwony:</span>
              <span style={{ color: "var(--text-dim, #64748b)" }}>Wgrany, brak podpisu</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: "#dcfce7",
                  border: "1px solid #86efac",
                  flexShrink: 0,
                }}
              />
              <span style={{ color: "#15803d", fontWeight: 600 }}>Zielony:</span>
              <span style={{ color: "var(--text-dim, #64748b)" }}>Podpisany</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: "var(--panel-2, #f8fafc)",
                  border: "1px solid var(--line, #e2e8f0)",
                  flexShrink: 0,
                }}
              />
              <span style={{ color: "var(--text-mute)", fontWeight: 600 }}>Szary:</span>
              <span style={{ color: "var(--text-dim, #64748b)" }}>Brak pliku</span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
