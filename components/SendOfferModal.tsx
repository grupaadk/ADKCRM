"use client";

import { useState, useCallback, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { EstimateCardData } from "@/components/EstimateCardView";
import { computeSummary } from "@/components/EstimateCardView";
import { generateOfferEmailHtml } from "@/lib/offerEmailTemplate";
import {
  X,
  Send,
  Eye,
  Settings2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Mail,
  User,
  Calendar,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  estimate: EstimateCardData;
  opportunityId?: Id<"pendingJotformSubmissions">;
  onClose: () => void;
};

type Tab = "settings" | "preview";
type SendState = "idle" | "sending" | "success" | "error";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const FOLLOW_UP_OPTIONS = [
  { label: "Bez przypomnienia", days: 0 },
  { label: "Za 1 dzień", days: 1 },
  { label: "Za 3 dni", days: 3 },
  { label: "Za 7 dni", days: 7 },
  { label: "Za 14 dni", days: 14 },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function SendOfferModal({ estimate, opportunityId, onClose }: Props) {
  const { client, title } = estimate;
  const summary = computeSummary(estimate.items, estimate.discountPercent);

  const clientName =
    client.clientType === "business" && client.companyName
      ? client.companyName
      : `${client.firstName} ${client.lastName}`;

  // ── Form state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>("settings");
  const [toEmail, setToEmail] = useState(client.email ?? "");
  const [ccEmail, setCcEmail] = useState("aluminiumadk@gmail.com");
  const [subject, setSubject] = useState(`Oferta Grupy ADK — ${title}`);
  const [introText, setIntroText] = useState(
    `Szanowni Państwo,\n\nDziękujemy za zainteresowanie naszą ofertą. W załączeniu przesyłamy szczegółową specyfikację wraz z kalkulacją przygotowaną specjalnie dla Państwa.\n\nZapraszamy do kontaktu w razie jakichkolwiek pytań.`,
  );
  const [salesRepName, setSalesRepName] = useState("");
  const [salesRepPhone, setSalesRepPhone] = useState("");
  const [salesRepEmail, setSalesRepEmail] = useState("");
  const [followUpDays, setFollowUpDays] = useState(0);
  const [showSalesRepFields, setShowSalesRepFields] = useState(false);

  const [sendState, setSendState] = useState<SendState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const sendOfferEmail = useAction(api.offerEmails.sendOfferEmail);

  // ── Live preview HTML ───────────────────────────────────────────────────────
  const previewHtml = useCallback(
    () =>
      generateOfferEmailHtml({
        estimate,
        introText,
        salesRepName: salesRepName || undefined,
        salesRepPhone: salesRepPhone || undefined,
        salesRepEmail: salesRepEmail || undefined,
      }),
    [estimate, introText, salesRepName, salesRepPhone, salesRepEmail],
  );

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // ── Send handler ─────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!toEmail.trim()) {
      setErrorMessage("Podaj adres e-mail odbiorcy.");
      return;
    }
    setSendState("sending");
    setErrorMessage("");

    try {
      const htmlBody = generateOfferEmailHtml({
        estimate,
        introText,
        salesRepName: salesRepName || undefined,
        salesRepPhone: salesRepPhone || undefined,
        salesRepEmail: salesRepEmail || undefined,
      });

      await sendOfferEmail({
        opportunityId,
        to: toEmail.trim(),
        cc: ccEmail.trim() || undefined,
        subject: subject.trim(),
        htmlBody,
        followUpDays: followUpDays > 0 ? followUpDays : undefined,
        offerTitle: title,
        clientName,
      });

      setSendState("success");
    } catch (err) {
      setSendState("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Nieznany błąd podczas wysyłki.",
      );
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────

  if (sendState === "success") {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: "48px 40px",
            textAlign: "center",
            maxWidth: 400,
            boxShadow: "0 24px 80px rgba(0,0,0,0.18)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "linear-gradient(135deg,#10b981,#059669)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <CheckCircle2 color="#fff" size={32} />
          </div>
          <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#1a2e44" }}>
            Oferta wysłana!
          </h3>
          <p style={{ margin: "0 0 24px", fontSize: 14, color: "#4a5e78", lineHeight: 1.6 }}>
            Wiadomość e-mail z ofertą została wysłana do <strong>{toEmail}</strong>
            {ccEmail ? ` (kopia: ${ccEmail})` : ""}.
            {followUpDays > 0 && (
              <> W kalendarzu CRM dodano przypomnienie za {followUpDays} {followUpDays === 1 ? "dzień" : "dni"}.</>
            )}
          </p>
          <button
            onClick={onClose}
            style={{
              background: "linear-gradient(135deg,#0f5a9a,#1a80cf)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "12px 32px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Zamknij
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(10,20,40,0.6)",
        backdropFilter: "blur(6px)",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          width: "100%",
          maxWidth: 780,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 32px 100px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          style={{
            background: "linear-gradient(135deg,#0d2137 0%,#1a3a5c 50%,#0f5a9a 100%)",
            padding: "20px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Mail size={18} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>
                  Wyślij ofertę do klienta
                </div>
                <div style={{ fontSize: 12, color: "#93c5e8", marginTop: 2 }}>
                  {clientName} · {fmt(summary.grossTotal)} zł brutto
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 8,
              width: 34,
              height: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#fff",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #e8eef5",
            background: "#f8fafd",
            flexShrink: 0,
          }}
        >
          {(["settings", "preview"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: "12px 16px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                color: activeTab === tab ? "#0f5a9a" : "#6b7fa3",
                borderBottom: activeTab === tab ? "2px solid #0f5a9a" : "2px solid transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                transition: "all 0.15s",
              }}
            >
              {tab === "settings" ? <Settings2 size={15} /> : <Eye size={15} />}
              {tab === "settings" ? "Ustawienia i treść" : "Podgląd e-maila"}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: 0 }}>
          {activeTab === "settings" && (
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Recipients */}
              <div
                style={{
                  background: "#f0f5fb",
                  borderRadius: 10,
                  border: "1px solid #dce8f5",
                  padding: "16px 18px",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "#0f5a9a", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 12 }}>
                  Odbiorcy
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#4a5e78", display: "flex", alignItems: "center", gap: 5 }}>
                      <Mail size={12} /> Do (TO) *
                    </span>
                    <input
                      type="email"
                      value={toEmail}
                      onChange={(e) => setToEmail(e.target.value)}
                      placeholder="email@klienta.pl"
                      style={{
                        padding: "9px 12px",
                        border: "1px solid #dce8f5",
                        borderRadius: 8,
                        fontSize: 13,
                        color: "#1a2e44",
                        background: "#fff",
                        outline: "none",
                        fontFamily: "inherit",
                      }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#4a5e78", display: "flex", alignItems: "center", gap: 5 }}>
                      <Mail size={12} /> Kopia (CC)
                    </span>
                    <input
                      type="email"
                      value={ccEmail}
                      onChange={(e) => setCcEmail(e.target.value)}
                      placeholder="aluminiumadk@gmail.com"
                      style={{
                        padding: "9px 12px",
                        border: "1px solid #dce8f5",
                        borderRadius: 8,
                        fontSize: 13,
                        color: "#1a2e44",
                        background: "#fff",
                        outline: "none",
                        fontFamily: "inherit",
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Subject */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#4a5e78" }}>
                  Temat wiadomości *
                </span>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  style={{
                    padding: "9px 12px",
                    border: "1px solid #dce8f5",
                    borderRadius: 8,
                    fontSize: 13,
                    color: "#1a2e44",
                    background: "#fff",
                    outline: "none",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Intro text */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#4a5e78" }}>
                  Treść wstępu / uwagi handlowca
                </span>
                <textarea
                  value={introText}
                  onChange={(e) => setIntroText(e.target.value)}
                  rows={6}
                  style={{
                    padding: "10px 12px",
                    border: "1px solid #dce8f5",
                    borderRadius: 8,
                    fontSize: 13,
                    color: "#1a2e44",
                    background: "#fff",
                    outline: "none",
                    fontFamily: "inherit",
                    resize: "vertical",
                    lineHeight: 1.6,
                  }}
                />
              </div>

              {/* Sales rep */}
              <div
                style={{
                  background: "#f8fafd",
                  borderRadius: 10,
                  border: "1px solid #dce8f5",
                  overflow: "hidden",
                }}
              >
                <button
                  onClick={() => setShowSalesRepFields((v) => !v)}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#4a5e78",
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <User size={13} /> Dane handlowca w stopce
                  </span>
                  {showSalesRepFields ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {showSalesRepFields && (
                  <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                    <input
                      type="text"
                      value={salesRepName}
                      onChange={(e) => setSalesRepName(e.target.value)}
                      placeholder="Imię i Nazwisko handlowca"
                      style={{ padding: "9px 12px", border: "1px solid #dce8f5", borderRadius: 8, fontSize: 13, color: "#1a2e44", background: "#fff", outline: "none", fontFamily: "inherit" }}
                    />
                    <input
                      type="tel"
                      value={salesRepPhone}
                      onChange={(e) => setSalesRepPhone(e.target.value)}
                      placeholder="Telefon handlowca"
                      style={{ padding: "9px 12px", border: "1px solid #dce8f5", borderRadius: 8, fontSize: 13, color: "#1a2e44", background: "#fff", outline: "none", fontFamily: "inherit" }}
                    />
                    <input
                      type="email"
                      value={salesRepEmail}
                      onChange={(e) => setSalesRepEmail(e.target.value)}
                      placeholder="E-mail handlowca"
                      style={{ padding: "9px 12px", border: "1px solid #dce8f5", borderRadius: 8, fontSize: 13, color: "#1a2e44", background: "#fff", outline: "none", fontFamily: "inherit" }}
                    />
                  </div>
                )}
              </div>

              {/* Follow-up */}
              <div
                style={{
                  background: "#f0f5fb",
                  borderRadius: 10,
                  border: "1px solid #dce8f5",
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Calendar size={15} color="#0f5a9a" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#0f5a9a", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Automatyczny Follow-up
                  </span>
                </div>
                <select
                  value={followUpDays}
                  onChange={(e) => setFollowUpDays(Number(e.target.value))}
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #dce8f5",
                    borderRadius: 8,
                    fontSize: 13,
                    color: "#1a2e44",
                    background: "#fff",
                    outline: "none",
                    fontFamily: "inherit",
                    cursor: "pointer",
                  }}
                >
                  {FOLLOW_UP_OPTIONS.map((opt) => (
                    <option key={opt.days} value={opt.days}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Error */}
              {errorMessage && (
                <div
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 8,
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    color: "#b91c1c",
                  }}
                >
                  <AlertCircle size={16} />
                  {errorMessage}
                </div>
              )}
            </div>
          )}

          {activeTab === "preview" && (
            <div style={{ height: "100%", minHeight: 400 }}>
              <iframe
                srcDoc={previewHtml()}
                style={{
                  width: "100%",
                  height: "100%",
                  minHeight: 500,
                  border: "none",
                  display: "block",
                }}
                title="Podgląd e-maila"
                sandbox="allow-same-origin"
              />
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid #e8eef5",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#f8fafd",
            flexShrink: 0,
            gap: 12,
          }}
        >
          <div style={{ fontSize: 12, color: "#8a9bb8" }}>
            Wysyłka przez: <strong style={{ color: "#1a2e44" }}>aluminiumadk@gmail.com</strong>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                padding: "10px 20px",
                border: "1px solid #dce8f5",
                borderRadius: 8,
                background: "#fff",
                color: "#4a5e78",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Anuluj
            </button>
            <button
              onClick={handleSend}
              disabled={sendState === "sending"}
              style={{
                padding: "10px 24px",
                border: "none",
                borderRadius: 8,
                background:
                  sendState === "sending"
                    ? "#6b9fd4"
                    : "linear-gradient(135deg,#0f5a9a,#1a80cf)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                cursor: sendState === "sending" ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {sendState === "sending" ? (
                <>
                  <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                  Wysyłanie…
                </>
              ) : (
                <>
                  <Send size={16} />
                  Wyślij ofertę
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
