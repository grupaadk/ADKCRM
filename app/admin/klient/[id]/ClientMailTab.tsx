"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cx } from "@/components/ui/utils";
import {
  Mail,
  Loader2,
  Pencil,
  Send,
  X,
  Reply,
  Paperclip,
  Download,
  ImageIcon,
  ChevronLeft,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

type EmailMetadata = {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  dateTimestamp: number;
  snippet: string;
  isRead: boolean;
  isStarred: boolean;
  labelIds: string[];
};

type Attachment = {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
};

type EmailDetail = EmailMetadata & {
  body: string;
  isHtml: boolean;
  messageId: string;
  references: string;
  attachments: Attachment[];
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function parseFrom(from: string): { name: string; email: string } {
  const match = from.match(/^(.*?)\s*<(.+?)>$/);
  if (match) return { name: match[1].trim().replace(/^"|"$/g, ""), email: match[2] };
  return { name: from, email: from };
}

function plainTextToHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Compose Modal ─────────────────────────────────────────────────────────────

function ComposeModal({
  defaultTo,
  defaultSubject,
  defaultBody,
  title,
  onClose,
  onSend,
}: {
  defaultTo: string;
  defaultSubject?: string;
  defaultBody?: string;
  title?: string;
  onClose: () => void;
  onSend: (to: string, subject: string, body: string) => Promise<void>;
}) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject ?? "");
  const [body, setBody] = useState(defaultBody ?? "");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!to.trim() || !subject.trim()) return;
    setSending(true);
    try {
      await onSend(to, subject, body);
      onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4 pointer-events-none">
      <div className="pointer-events-auto w-[520px] max-h-[560px] rounded-t-xl shadow-2xl border border-gray-300 bg-white flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800 rounded-t-xl">
          <span className="text-sm font-medium text-white truncate">
            {title ?? "Nowa wiadomość"}
          </span>
          <button onClick={onClose} className="text-slate-300 hover:text-white">
            <X className="size-4" />
          </button>
        </div>

        {/* To */}
        <div className="flex items-center border-b border-gray-200 px-4">
          <span className="text-xs text-gray-500 w-10 shrink-0">Do</span>
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="flex-1 py-2.5 text-sm outline-none"
            placeholder="Adres odbiorcy"
          />
        </div>

        {/* Subject */}
        <div className="flex items-center border-b border-gray-200 px-4">
          <span className="text-xs text-gray-500 w-10 shrink-0">Temat</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="flex-1 py-2.5 text-sm outline-none"
            placeholder="Temat wiadomości"
          />
        </div>

        {/* Body */}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="flex-1 p-4 text-sm outline-none resize-none placeholder-gray-400"
          placeholder="Treść wiadomości..."
          rows={8}
        />

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <button
            onClick={handleSend}
            disabled={sending || !to.trim() || !subject.trim()}
            className={cx(
              "flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium text-white transition-colors",
              sending || !to.trim() || !subject.trim()
                ? "bg-blue-300 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700",
            )}
          >
            {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            Wyślij
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors text-sm">
            Anuluj
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Message Detail ─────────────────────────────────────────────────────────────

function MessageDetail({
  email,
  onBack,
  onReply,
  connectedEmail,
}: {
  email: EmailDetail;
  onBack: () => void;
  onReply: (subject: string, body: string, threadId: string, messageId: string, references: string) => void;
  connectedEmail: string;
}) {
  const { name, email: fromEmail } = parseFrom(email.from);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const getAttachmentAction = useAction(api.gmail.getAttachment);

  const isOutgoing = fromEmail.toLowerCase() === connectedEmail.toLowerCase();

  useEffect(() => {
    if (!iframeRef.current || !email.isHtml) return;
    const iframe = iframeRef.current;
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; }
        a { color: #2563eb; }
        img { max-width: 100%; }
      </style>
    </head><body>${email.body}</body></html>`);
    doc.close();
    const resize = () => {
      if (iframe.contentDocument?.body) {
        iframe.style.height = iframe.contentDocument.body.scrollHeight + 32 + "px";
      }
    };
    iframe.onload = resize;
    resize();
  }, [email.body, email.isHtml]);

  const handleDownload = async (att: Attachment) => {
    const res = await getAttachmentAction({ messageId: email.id, attachmentId: att.attachmentId });
    const base64 = res.data.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: att.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = att.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 pb-4 mb-4 border-b border-slate-100">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ChevronLeft className="size-4" />
          Powrót
        </button>
        <div className="flex-1" />
        <button
          onClick={() =>
            onReply(
              email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`,
              `\n\n--- Oryginalna wiadomość ---\nOd: ${email.from}\nData: ${email.date}\n\n${email.snippet}`,
              email.threadId,
              email.messageId,
              email.references,
            )
          }
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <Reply className="size-3.5" />
          Odpowiedz
        </button>
      </div>

      {/* Subject */}
      <h2 className="text-lg font-semibold text-slate-900 mb-4">{email.subject}</h2>

      {/* Sender info */}
      <div className="flex items-start justify-between mb-5 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className={cx(
            "size-9 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold",
            isOutgoing ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700",
          )}>
            {(name || fromEmail)[0]?.toUpperCase() ?? "?"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-900">{name || fromEmail}</span>
              {isOutgoing ? (
                <span className="flex items-center gap-0.5 text-[10px] font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-1.5 py-0.5">
                  <ArrowUpRight className="size-2.5" /> Wysłana
                </span>
              ) : (
                <span className="flex items-center gap-0.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-1.5 py-0.5">
                  <ArrowDownLeft className="size-2.5" /> Odebrana
                </span>
              )}
            </div>
            {fromEmail !== name && (
              <div className="text-xs text-slate-500">{fromEmail}</div>
            )}
            <div className="text-xs text-slate-400 mt-0.5">Do: {email.to}</div>
          </div>
        </div>
        <div className="text-xs text-slate-400 shrink-0 mt-1">{email.date}</div>
      </div>

      {/* Body */}
      {email.isHtml ? (
        <iframe
          ref={iframeRef}
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          className="w-full border-none"
          title="Email content"
          style={{ minHeight: 200 }}
        />
      ) : (
        <div
          className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed"
          dangerouslySetInnerHTML={{ __html: plainTextToHtml(email.body || email.snippet) }}
        />
      )}

      {/* Attachments */}
      {email.attachments?.length > 0 && (
        <div className="mt-6 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-1.5 mb-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
            <Paperclip className="size-3.5" />
            {email.attachments.length === 1 ? "1 załącznik" : `${email.attachments.length} załączniki`}
          </div>
          <div className="flex flex-wrap gap-2">
            {email.attachments.map((att) => {
              const isImage = att.mimeType.startsWith("image/");
              return (
                <button
                  key={att.attachmentId}
                  onClick={() => handleDownload(att)}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm hover:bg-slate-100 transition-colors"
                >
                  {isImage ? (
                    <ImageIcon className="size-4 text-blue-500 shrink-0" />
                  ) : (
                    <Paperclip className="size-4 text-slate-400 shrink-0" />
                  )}
                  <span className="max-w-[160px] truncate text-slate-700">{att.filename}</span>
                  <span className="text-slate-400 text-xs shrink-0">{formatBytes(att.size)}</span>
                  <Download className="size-3.5 text-slate-400 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function ClientMailTab({ clientEmail }: { clientEmail: string }) {
  const connectionStatus = useQuery(api.gmail.getConnectionStatus);
  const listMessagesAction = useAction(api.gmail.listMessages);
  const getMessageAction = useAction(api.gmail.getMessage);
  const sendEmailAction = useAction(api.gmail.sendEmail);

  const [messages, setMessages] = useState<EmailMetadata[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [loadingList, setLoadingList] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<EmailDetail | null>(null);
  const [loadingMessage, setLoadingMessage] = useState(false);
  const [compose, setCompose] = useState<{
    to: string;
    subject?: string;
    body?: string;
    title?: string;
    threadId?: string;
    inReplyToMessageId?: string;
    references?: string;
  } | null>(null);

  const searchQuery = `from:${clientEmail} OR to:${clientEmail}`;

  const fetchMessages = useCallback(async (pageToken?: string) => {
    setLoadingList(true);
    try {
      const result = await listMessagesAction({
        labelId: "ALL",
        searchQuery,
        maxResults: 20,
        pageToken,
      });
      const sorted = [...result.messages].sort((a, b) => b.dateTimestamp - a.dateTimestamp);
      if (pageToken) {
        setMessages((prev) => {
          const combined = [...prev, ...sorted];
          return combined.sort((a, b) => b.dateTimestamp - a.dateTimestamp);
        });
      } else {
        setMessages(sorted);
      }
      setNextPageToken(result.nextPageToken);
    } catch (err) {
      console.error("Failed to fetch client messages:", err);
    } finally {
      setLoadingList(false);
    }
  }, [listMessagesAction, searchQuery]);

  const isConnected = connectionStatus?.connectionStatus === "connected";

  useEffect(() => {
    if (isConnected) {
      void fetchMessages();
    }
  }, [isConnected, fetchMessages]);

  const handleSelectMessage = async (messageId: string) => {
    setLoadingMessage(true);
    try {
      const detail = await getMessageAction({ messageId });
      const meta = messages.find((m) => m.id === messageId)!;
      setSelectedMessage({ ...meta, ...detail });
    } catch (err) {
      console.error("Failed to fetch message:", err);
    } finally {
      setLoadingMessage(false);
    }
  };

  const handleSend = async (to: string, subject: string, body: string) => {
    await sendEmailAction({
      to,
      subject,
      body,
      threadId: compose?.threadId,
      inReplyToMessageId: compose?.inReplyToMessageId,
      references: compose?.references,
    });
    // Refresh list after sending
    setTimeout(() => fetchMessages(), 1500);
  };

  // ── No email set ──────────────────────────────────────────────────────────────
  if (!clientEmail) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
        <Mail className="size-10 mb-3 opacity-30" />
        <p className="text-sm font-medium text-slate-600">Brak adresu email</p>
        <p className="mt-1 text-xs">Dodaj email klienta, aby zobaczyć historię korespondencji.</p>
      </div>
    );
  }

  // ── Loading connection status ─────────────────────────────────────────────────
  if (connectionStatus === undefined) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-5 animate-spin text-slate-400" />
      </div>
    );
  }

  // ── Gmail not connected ───────────────────────────────────────────────────────
  if (connectionStatus === null || connectionStatus.connectionStatus !== "connected") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
        <Mail className="size-10 mb-3 opacity-30" />
        <p className="text-sm font-medium text-slate-600">Skrzynka Gmail niepodłączona</p>
        <p className="mt-1 text-xs">
          Podłącz konto Gmail w{" "}
          <a href="/admin/mail" className="text-blue-600 hover:underline">
            panelu poczty
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-slate-400">{clientEmail}</p>
        <button
          onClick={() => setCompose({ to: clientEmail, title: "Nowa wiadomość" })}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Pencil className="size-3.5" />
          Nowa wiadomość
        </button>
      </div>

      {/* Selected message detail */}
      {selectedMessage ? (
        <MessageDetail
          email={selectedMessage}
          connectedEmail={connectionStatus.connectedEmail ?? ""}
          onBack={() => setSelectedMessage(null)}
          onReply={(subject, body, threadId, inReplyToMessageId, references) => {
            const { email: replyTo } = parseFrom(selectedMessage.from);
            const connectedEmail = connectionStatus.connectedEmail ?? "";
            const isOutgoing = replyTo.toLowerCase() === connectedEmail.toLowerCase();
            setCompose({
              to: isOutgoing ? selectedMessage.to : replyTo,
              subject,
              body,
              title: `Odp: ${selectedMessage.subject}`,
              threadId,
              inReplyToMessageId,
              references,
            });
          }}
        />
      ) : loadingMessage ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-5 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {/* Message list */}
          {loadingList && messages.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-5 animate-spin text-slate-400" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
              <Mail className="size-10 mb-3 opacity-30" />
              <p className="text-sm font-medium text-slate-600">Brak korespondencji</p>
              <p className="mt-1 text-xs">Nie znaleziono żadnych wiadomości z tym klientem.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 -mx-6 border-t border-slate-100">
              {messages.map((email) => {
                const { name, email: fromEmail } = parseFrom(email.from);
                const connectedEmail = connectionStatus.connectedEmail ?? "";
                const isOutgoing = fromEmail.toLowerCase() === connectedEmail.toLowerCase();
                return (
                  <button
                    key={email.id}
                    onClick={() => handleSelectMessage(email.id)}
                    className={cx(
                      "w-full text-left px-6 py-3.5 transition-colors hover:bg-slate-50 focus:outline-none",
                      !email.isRead && "bg-white",
                      email.isRead && "bg-slate-50/50",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Direction indicator */}
                      <div className="mt-1 shrink-0">
                        {isOutgoing ? (
                          <ArrowUpRight className="size-3.5 text-blue-400" />
                        ) : (
                          <ArrowDownLeft className="size-3.5 text-emerald-500" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={cx(
                            "text-sm truncate",
                            !email.isRead ? "font-semibold text-slate-900" : "font-medium text-slate-600",
                          )}>
                            {isOutgoing ? `Do: ${email.to}` : (name || fromEmail)}
                          </span>
                          <span className="text-xs text-slate-400 shrink-0">{email.date}</span>
                        </div>
                        <div className={cx(
                          "text-sm truncate mt-0.5",
                          !email.isRead ? "font-medium text-slate-800" : "text-slate-500",
                        )}>
                          {email.subject}
                        </div>
                        <div className="text-xs text-slate-400 truncate mt-0.5">{email.snippet}</div>
                      </div>
                    </div>
                  </button>
                );
              })}

              {nextPageToken && (
                <button
                  onClick={() => fetchMessages(nextPageToken)}
                  disabled={loadingList}
                  className="w-full py-3 text-sm text-blue-600 hover:bg-slate-50 transition-colors"
                >
                  {loadingList ? "Ładowanie..." : "Wczytaj więcej"}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Compose modal */}
      {compose && (
        <ComposeModal
          defaultTo={compose.to}
          defaultSubject={compose.subject}
          defaultBody={compose.body}
          title={compose.title}
          onClose={() => setCompose(null)}
          onSend={handleSend}
        />
      )}
    </div>
  );
}
