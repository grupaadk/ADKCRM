"use client";

import { useState, useEffect, useCallback } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Mail,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  Send,
  User,
  Clock,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ArrowUpRight,
  ArrowDownLeft
} from "lucide-react";

interface ThreadItem {
  id: string;
  subject: string;
  participants: string[];
  messageCount: number;
  latestDate: string;
  latestDateTimestamp: number;
  snippet?: string;
  hasUnread?: boolean;
  latestFrom?: string;
  hasAttachment?: boolean;
}

interface MessageAttachment {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

interface ThreadMessage {
  id: string;
  from?: string;
  to?: string;
  date: string;
  dateTimestamp: number;
  snippet: string;
  isRead: boolean;
  body: string;
  isHtml: boolean;
  messageId?: string;
  references?: string;
  attachments?: MessageAttachment[];
}

function SingleEmailMessageCard({ msg }: { msg: ThreadMessage }) {
  const [expandedBody, setExpandedBody] = useState(false);
  
  const fromStr = (msg.from || "").toLowerCase();
  const isFromADK = 
    fromStr.includes("aluminiumadk@gmail.com") || 
    fromStr.includes("adkokna.pl") ||
    fromStr.includes("adk okna") ||
    fromStr.includes("grupa adk");

  const cardBg = isFromADK ? "#F0F9FF" : "#FFFFFF";
  const borderLeftColor = isFromADK ? "#0284C7" : "#10B981";
  const badgeBg = isFromADK ? "#E0F2FE" : "#DCFCE7";
  const badgeColor = isFromADK ? "#0369A1" : "#15803D";
  const badgeText = isFromADK ? "Wysyłka ADK" : "Od Klienta";

  const isLongText = (msg.body || "").length > 450;

  return (
    <div
      style={{
        background: cardBg,
        border: "1px solid #E2E8F0",
        borderLeft: `4px solid ${borderLeftColor}`,
        borderRadius: 8,
        padding: 12,
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* Header wiadomości */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(0,0,0,0.06)", paddingBottom: 6, flexWrap: "wrap", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, fontWeight: 800, background: badgeBg, color: badgeColor, padding: "2px 8px", borderRadius: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
            {isFromADK ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
            {badgeText}
          </span>

          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#0F172A" }}>
            Od: <span style={{ fontWeight: 600, color: "#334155" }}>{msg.from || "Nieznany nadawca"}</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10.5, color: "#64748B" }}>
            Do: {msg.to || "Nieznany odbiorca"}
          </span>
          <span style={{ fontSize: 10.5, color: "#94A3B8", fontWeight: 500 }}>
            {msg.date}
          </span>
        </div>
      </div>

      {/* Treść wiadomości (z kontrolą wysokości) */}
      <div style={{ position: "relative" }}>
        <div
          style={{
            fontSize: 12.5,
            color: "#1E293B",
            lineHeight: 1.6,
            maxHeight: expandedBody || !isLongText ? "none" : "220px",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {msg.isHtml ? (
            <div
              dangerouslySetInnerHTML={{ __html: msg.body }}
              style={{ maxWidth: "100%", overflowX: "auto" }}
            />
          ) : (
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0 }}>
              {msg.body}
            </pre>
          )}
        </div>

        {/* Nakładka gradientowa & Przycisk rozwijania przy długiej wiadomości */}
        {isLongText && (
          <div
            style={{
              marginTop: 6,
              display: "flex",
              justifyContent: "center",
              paddingTop: expandedBody ? 6 : 20,
              background: expandedBody ? "transparent" : "linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0.95))",
            }}
          >
            <button
              type="button"
              onClick={() => setExpandedBody(!expandedBody)}
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#2563EB",
                background: "#EFF6FF",
                border: "1px solid #BFDBFE",
                padding: "3px 12px",
                borderRadius: 12,
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              }}
            >
              {expandedBody ? "▲ Zwiń treść wiadomości" : "▼ Pokaż pełną treść wiadomości"}
            </button>
          </div>
        )}
      </div>

      {/* Załączniki */}
      {msg.attachments && msg.attachments.length > 0 && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px dashed #CBD5E1", display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
            Załączniki ({msg.attachments.length}):
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {msg.attachments.map((att, aIdx) => (
              <span
                key={aIdx}
                style={{
                  fontSize: 11,
                  background: "#ffffff",
                  border: "1px solid #CBD5E1",
                  padding: "3px 8px",
                  borderRadius: 4,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  color: "#334155",
                }}
              >
                <Paperclip size={11} /> {att.filename} ({Math.round(att.size / 1024)} KB)
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OpportunityEmailThreadsSection({
  clientEmail,
  defaultEmail = "aluminiumadk@gmail.com",
}: {
  clientEmail?: string;
  defaultEmail?: string;
}) {
  const listThreadsAction = useAction(api.gmail.listThreads);
  const getThreadAction = useAction(api.gmail.getThread);
  const sendEmailAction = useAction(api.gmail.sendEmail);

  const [activeQueryEmail, setActiveQueryEmail] = useState<string>(
    clientEmail || defaultEmail
  );
  const [customSearch, setCustomSearch] = useState<string>("");
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null);
  const [threadMessagesMap, setThreadMessagesMap] = useState<Record<string, ThreadMessage[]>>({});
  const [loadingThreadId, setLoadingThreadId] = useState<string | null>(null);

  const [replyText, setReplyText] = useState<string>("");
  const [sendingReply, setSendingReply] = useState<boolean>(false);
  const [sendSuccess, setSendSuccess] = useState<boolean>(false);

  const fetchThreads = useCallback(async (queryEmail: string) => {
    setLoading(true);
    setError(null);
    try {
      const searchQuery = `from:${queryEmail} OR to:${queryEmail}`;
      const result = await listThreadsAction({
        labelId: "ALL",
        searchQuery: searchQuery,
        maxResults: 25,
      });

      setThreads(result.threads || []);
    } catch (err) {
      console.error("Błąd pobierania wątków Gmail:", err);
      setError(err instanceof Error ? err.message : "Nie udało się pobrać wiadomości E-mail z Gmaila.");
    } finally {
      setLoading(false);
    }
  }, [listThreadsAction]);

  useEffect(() => {
    void fetchThreads(activeQueryEmail);
  }, [activeQueryEmail, fetchThreads]);

  const handleToggleThread = async (threadId: string) => {
    if (expandedThreadId === threadId) {
      setExpandedThreadId(null);
      return;
    }

    setExpandedThreadId(threadId);

    if (!threadMessagesMap[threadId]) {
      setLoadingThreadId(threadId);
      try {
        const fullThread = await getThreadAction({ threadId });
        setThreadMessagesMap((prev) => ({
          ...prev,
          [threadId]: (fullThread.messages || []) as ThreadMessage[],
        }));
      } catch (err) {
        console.error("Błąd pobierania wiadomości wątku:", err);
      } finally {
        setLoadingThreadId(null);
      }
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customSearch.trim()) {
      setActiveQueryEmail(customSearch.trim());
    }
  };

  const handleSendReply = async (thread: ThreadItem) => {
    if (!replyText.trim()) return;
    setSendingReply(true);
    setError(null);
    setSendSuccess(false);

    try {
      const messages = threadMessagesMap[thread.id] || [];
      const lastMsg = messages[messages.length - 1];

      await sendEmailAction({
        to: activeQueryEmail,
        subject: thread.subject.startsWith("Re:") ? thread.subject : `Re: ${thread.subject}`,
        body: replyText.trim(),
        threadId: thread.id,
        inReplyToMessageId: lastMsg?.messageId,
        references: lastMsg?.references || lastMsg?.messageId,
      });

      setReplyText("");
      setSendSuccess(true);
      setTimeout(() => setSendSuccess(false), 4000);

      const updatedThread = await getThreadAction({ threadId: thread.id });
      setThreadMessagesMap((prev) => ({
        ...prev,
        [thread.id]: (updatedThread.messages || []) as ThreadMessage[],
      }));
    } catch (err) {
      console.error("Błąd wysyłania odpowiedzi E-mail:", err);
      setError(err instanceof Error ? err.message : "Nie udało się wysłać odpowiedzi E-mail");
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: 8,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Nagłówek Sekcji Wiadomości */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Mail size={16} className="text-purple-600" />
          <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
            Korespondencja E-mail (Gmail)
          </h2>
          <span style={{ fontSize: 10.5, fontWeight: 700, background: "#F1F5F9", color: "#475569", padding: "2px 8px", borderRadius: 12, border: "1px solid var(--line)" }}>
            {threads.length} {threads.length === 1 ? "wątek" : "wątków"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={() => void fetchThreads(activeQueryEmail)}
            disabled={loading}
            className="btn"
            style={{ fontSize: 11, padding: "4px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}
            title="Odśwież skrzynkę"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            {loading ? "Ładowanie..." : "Odśwież"}
          </button>
        </div>
      </div>

      {/* Szybkie Przełączniki E-mail & Wyszukiwarka */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", background: "var(--panel-2)", padding: 8, borderRadius: 6, border: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-mute)" }}>Adres email:</span>
          
          <button
            type="button"
            onClick={() => setActiveQueryEmail("aluminiumadk@gmail.com")}
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "3px 8px",
              borderRadius: 6,
              border: `1px solid ${activeQueryEmail === "aluminiumadk@gmail.com" ? "#2563eb" : "var(--line)"}`,
              background: activeQueryEmail === "aluminiumadk@gmail.com" ? "#2563eb" : "var(--panel)",
              color: activeQueryEmail === "aluminiumadk@gmail.com" ? "#ffffff" : "var(--text)",
              cursor: "pointer",
            }}
          >
            aluminiumadk@gmail.com
          </button>

          {clientEmail && clientEmail.toLowerCase() !== "aluminiumadk@gmail.com" && (
            <button
              type="button"
              onClick={() => setActiveQueryEmail(clientEmail)}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: 6,
                border: `1px solid ${activeQueryEmail === clientEmail ? "#2563eb" : "var(--line)"}`,
                background: activeQueryEmail === clientEmail ? "#2563eb" : "var(--panel)",
                color: activeQueryEmail === clientEmail ? "#ffffff" : "var(--text)",
                cursor: "pointer",
              }}
            >
              {clientEmail}
            </button>
          )}
        </div>

        <form onSubmit={handleSearchSubmit} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="email"
            value={customSearch}
            onChange={(e) => setCustomSearch(e.target.value)}
            placeholder="Inny adres email..."
            style={{
              fontSize: 11,
              padding: "3px 8px",
              borderRadius: 4,
              border: "1px solid var(--line)",
              background: "var(--panel)",
              color: "var(--text)",
              outline: "none",
              width: 160,
            }}
          />
          <button type="submit" className="btn" style={{ padding: "3px 6px", fontSize: 11 }}>
            <Search size={11} />
          </button>
        </form>
      </div>

      {/* Komunikat o błędzie */}
      {error && (() => {
        const isAuthError = 
          error.includes("invalid_grant") || 
          error.includes("refresh failed") || 
          error.includes("not connected") ||
          error.includes("401");

        const GMAIL_AUTH_URL = "https://fearless-firefly-85.eu-west-1.convex.site/api/gmail/auth";

        if (isAuthError) {
          return (
            <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#991B1B", padding: "12px 14px", borderRadius: 6, fontSize: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                <AlertCircle size={16} className="text-red-600" />
                <span>Wygasła autoryzacja konta Gmail (Błąd Google: invalid_grant)</span>
              </div>
              <p style={{ margin: 0, fontSize: 11.5, color: "#7F1D1D" }}>
                Token odświeżania OAuth w Google wygasł lub został cofnięty. Wystarczy kliknąć poniższy przycisk, aby połączyć konto ponownym logowaniem w Google.
              </p>
              <a
                href={GMAIL_AUTH_URL}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "#DC2626",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 12,
                  padding: "6px 12px",
                  borderRadius: 6,
                  textDecoration: "none",
                  width: "fit-content",
                  marginTop: 4,
                }}
              >
                <ExternalLink size={14} /> Ponownie połącz konto Gmail (Zaloguj przez Google)
              </a>
            </div>
          );
        }

        return (
          <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#991B1B", padding: "8px 12px", borderRadius: 6, fontSize: 11.5, display: "flex", alignItems: "center", gap: 6 }}>
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        );
      })()}

      {/* Stan Ładowania */}
      {loading && threads.length === 0 && (
        <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "var(--text-mute)" }}>
          Przeszukiwanie wiadomości Gmail dla <strong>{activeQueryEmail}</strong>...
        </div>
      )}

      {/* Brak wyników */}
      {!loading && threads.length === 0 && !error && (
        <div style={{ padding: "20px 14px", textAlign: "center", background: "var(--panel-2)", border: "1px dashed var(--line)", borderRadius: 6 }}>
          <Mail size={24} style={{ margin: "0 auto 6px", color: "var(--text-mute)", opacity: 0.5 }} />
          <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-strong)", margin: 0 }}>
            Brak wiadomości E-mail dla adresu: {activeQueryEmail}
          </p>
          <p style={{ fontSize: 11, color: "var(--text-mute)", margin: "4px 0 0" }}>
            Nie znaleziono odebranych ani wysłanych wątków pocztowych powiązanych z tym adresem.
          </p>
        </div>
      )}

      {/* Lista Wątków E-mail */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {threads.map((thread) => {
          const isExpanded = expandedThreadId === thread.id;
          const messages = threadMessagesMap[thread.id] || [];

          return (
            <div
              key={thread.id}
              style={{
                border: `1px solid ${isExpanded ? "#2563eb" : "var(--line)"}`,
                borderRadius: 6,
                background: "var(--panel)",
                overflow: "hidden",
                transition: "border-color 0.15s ease",
              }}
            >
              {/* Nagłówek pojedynczego wątku */}
              <div
                onClick={() => void handleToggleThread(thread.id)}
                style={{
                  padding: "10px 12px",
                  cursor: "pointer",
                  background: isExpanded ? "#F8FAFC" : "var(--panel)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  userSelect: "none",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "80%" }}>
                      {thread.subject}
                    </span>
                    
                    {thread.hasUnread && (
                      <span style={{ fontSize: 9.5, fontWeight: 800, background: "#EF4444", color: "#ffffff", padding: "1px 6px", borderRadius: 10 }}>
                        NOWA
                      </span>
                    )}

                    <span style={{ fontSize: 10, fontWeight: 600, background: "var(--panel-2)", border: "1px solid var(--line)", padding: "1px 6px", borderRadius: 4, color: "var(--text-mute)" }}>
                      {thread.messageCount} {thread.messageCount === 1 ? "wiadomość" : "wiadomości"}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "var(--text-mute)" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                      <User size={11} /> {thread.participants.join(", ")}
                    </span>
                    <span>•</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                      <Clock size={11} /> {thread.latestDate}
                    </span>
                  </div>

                  {thread.snippet && !isExpanded && (
                    <p style={{ fontSize: 11.5, color: "#64748B", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {thread.snippet}
                    </p>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {thread.hasAttachment && (
                    <Paperclip size={13} style={{ color: "var(--text-mute)" }} title="Zawiera załączniki" />
                  )}
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {/* Rozwinięty Widok Wiadomości Wątku */}
              {isExpanded && (
                <div style={{ padding: 12, borderTop: "1px solid var(--line)", background: "#FAFAFA", display: "flex", flexDirection: "column", gap: 12 }}>
                  
                  {loadingThreadId === thread.id && (
                    <div style={{ padding: 16, textAlign: "center", fontSize: 11.5, color: "var(--text-mute)" }}>
                      Ładowanie wiadomości wątku...
                    </div>
                  )}

                  {/* Lista sformatowanych kart wiadomości */}
                  {messages.map((msg, idx) => (
                    <SingleEmailMessageCard key={msg.id || idx} msg={msg} />
                  ))}

                  {/* Szybka odpowiedź w tym wątku */}
                  <div style={{ marginTop: 6, background: "#ffffff", border: "1px solid #CBD5E1", borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#0F172A" }}>
                      Odpowiedz w tym wątku do: {activeQueryEmail}
                    </span>

                    {sendSuccess && (
                      <div style={{ fontSize: 11, color: "#166534", background: "#DCFCE7", padding: "4px 8px", borderRadius: 4, display: "flex", alignItems: "center", gap: 4 }}>
                        <CheckCircle2 size={12} /> Odpowiedź E-mail została pomyślnie wysłana!
                      </div>
                    )}

                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Wpisz treść odpowiedzi do klienta..."
                      rows={3}
                      style={{
                        width: "100%",
                        fontSize: 12,
                        padding: "6px 8px",
                        borderRadius: 6,
                        border: "1px solid var(--line)",
                        outline: "none",
                        resize: "vertical",
                        fontFamily: "inherit",
                      }}
                    />

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => void handleSendReply(thread)}
                        disabled={sendingReply || !replyText.trim()}
                        className="btn primary"
                        style={{ fontSize: 11.5, padding: "4px 12px", display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        <Send size={12} />
                        {sendingReply ? "Wysyłanie..." : "Wyślij odpowiedź"}
                      </button>
                    </div>
                  </div>

                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
