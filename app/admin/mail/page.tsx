"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { cx } from "@/components/ui/utils";
import {
  Inbox,
  Send,
  FileText,
  Trash2,
  AlertOctagon,
  Star,
  RefreshCw,
  ChevronLeft,
  Reply,
  Mail,
  Search,
  X,
  Pencil,
  Loader2,
  Wifi,
  WifiOff,
  Paperclip,
  Download,
  ImageIcon,
  UserCheck,
  Filter,
  Tag,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  hasAttachment?: boolean;
};

type Attachment = {
  attachmentId?: string; // undefined for small inline attachments
  filename: string;
  mimeType: string;
  size: number;
  data?: string; // inline base64 data for small attachments
};

type EmailDetail = EmailMetadata & {
  body: string;
  isHtml: boolean;
  messageId: string;
  references: string;
  attachments: Attachment[];
  inlineImages: Attachment[];
};

type Label = {
  id: string;
  name: string;
  icon: React.ElementType;
  labelPl: string;
};

type ThreadMetadata = {
  id: string;
  subject: string;
  participants: string[];
  messageCount: number;
  latestDate: string;
  latestDateTimestamp: number;
  snippet: string;
  hasUnread: boolean;
  isStarred: boolean;
  latestFrom: string;
  hasAttachment?: boolean;
};

type ThreadMessageDetail = {
  id: string;
  from: string;
  to: string;
  date: string;
  dateTimestamp: number;
  snippet: string;
  isRead: boolean;
  labelIds: string[];
  body: string;
  isHtml: boolean;
  messageId: string;
  references: string;
  attachments: Attachment[];
  inlineImages: Attachment[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SYSTEM_LABELS: Label[] = [
  { id: "INBOX", name: "INBOX", icon: Inbox, labelPl: "Odebrane" },
  { id: "__OTHER__", name: "__OTHER__", icon: Filter, labelPl: "Inne" },
  { id: "STARRED", name: "STARRED", icon: Star, labelPl: "Oznaczone gwiazdką" },
  { id: "SENT", name: "SENT", icon: Send, labelPl: "Wysłane" },
  { id: "DRAFT", name: "DRAFT", icon: FileText, labelPl: "Wersje robocze" },
  { id: "SPAM", name: "SPAM", icon: AlertOctagon, labelPl: "Spam" },
  { id: "TRASH", name: "TRASH", icon: Trash2, labelPl: "Kosz" },
];

const siteUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL?.replace(".cloud", ".site") ?? "";

// ─── Email Relevance Filter ────────────────────────────────────────────────────
//
// Logic: BLACKLIST is checked first (hard reject).
//        If it passes, at least one WHITELIST rule must match.
//        Applies only to INBOX — other folders (Sent, Trash…) are shown as-is.

const FILTER_BLACKLIST: { domains: string[]; patterns: string[] } = {
  domains: ["trello.com", "google.com", "atlassian.com", "mail.google.com"],
  patterns: ["noreply", "no-reply", "donotreply", "notifications"],
};

const FILTER_WHITELIST: { domain: string; name: string } = {
  domain: "adkokna.pl",
  name: "adk okna",
};

function isEmailRelevant(email: EmailMetadata): boolean {
  const from = email.from.toLowerCase();
  const to = email.to.toLowerCase();
  const subject = email.subject.toLowerCase();

  // ── Step 1: Blacklist (hard reject) ──────────────────────────────────────
  if (FILTER_BLACKLIST.domains.some((d) => from.includes(d))) return false;
  if (FILTER_BLACKLIST.patterns.some((p) => from.includes(p))) return false;

  // ── Step 2: Whitelist (at least one must match) ───────────────────────────
  // All customer emails land in kontakt@adkokna.pl → 'to' always contains the domain.
  // Staff emails are from @adkokna.pl.
  // Forwarded / CC threads reference the domain in subject.
  if (to.includes(FILTER_WHITELIST.domain)) return true;        // customer → kontakt@adkokna.pl
  if (from.includes(FILTER_WHITELIST.domain)) return true;      // staff @adkokna.pl
  if (subject.includes(FILTER_WHITELIST.domain)) return true;   // domain in subject
  if (subject.includes(FILTER_WHITELIST.name)) return true;     // "ADK Okna" in subject

  // ── Step 3: Default — reject ──────────────────────────────────────────────
  return false;
}

/** Labels where the relevance filter is active */
const FILTERED_LABELS = new Set(["INBOX", "STARRED", "__OTHER__"]);

/** Labels that use thread view (grouped by threadId) */
const THREAD_LABELS = new Set(["INBOX", "STARRED", "__OTHER__"]);

/** Virtual labels that don't have their own Gmail fetch — reuse INBOX threads */
const VIRTUAL_LABELS = new Set(["__OTHER__"]);

function isThreadRelevant(thread: ThreadMetadata): boolean {
  const latestFrom = thread.latestFrom.toLowerCase();
  const subject = thread.subject.toLowerCase();
  const participantsStr = thread.participants.join(" ").toLowerCase();

  if (FILTER_BLACKLIST.domains.some((d) => latestFrom.includes(d))) return false;
  if (FILTER_BLACKLIST.patterns.some((p) => latestFrom.includes(p))) return false;

  if (participantsStr.includes(FILTER_WHITELIST.domain)) return true;
  if (latestFrom.includes(FILTER_WHITELIST.domain)) return true;
  if (subject.includes(FILTER_WHITELIST.domain)) return true;
  if (subject.includes(FILTER_WHITELIST.name)) return true;

  return false;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Compose Modal ────────────────────────────────────────────────────────────

type AttachmentPayload = {
  filename: string;
  mimeType: string;
  data: string; // base64
};

type ComposeProps = {
  onClose: () => void;
  onSend: (to: string, subject: string, body: string, attachments: AttachmentPayload[]) => Promise<void>;
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
  title?: string;
};

function ComposeModal({ onClose, onSend, defaultTo = "", defaultSubject = "", defaultBody = "", title = "Nowa wiadomość" }: ComposeProps) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentPayload[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip "data:<mime>;base64," prefix
        const data = result.split(",")[1] ?? "";
        setAttachments((prev) => [...prev, { filename: file.name, mimeType: file.type || "application/octet-stream", data }]);
      };
      reader.readAsDataURL(file);
    });
    // Reset input so the same file can be re-added if removed
    e.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (!to.trim() || !subject.trim()) return;
    setSending(true);
    try {
      await onSend(to, subject, body, attachments);
      onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={cx(
      "fixed bottom-0 right-6 z-50 w-[520px] rounded-t-lg shadow-2xl border border-gray-300 bg-white flex flex-col",
      minimized ? "h-10" : "h-[480px]"
    )}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-gray-800 rounded-t-lg cursor-pointer select-none"
        onClick={() => setMinimized((m) => !m)}
      >
        <span className="text-sm font-medium text-white truncate">{title}</span>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMinimized((m) => !m)}
            className="text-gray-300 hover:text-white transition-colors"
          >
            <ChevronLeft className={cx("size-4 transition-transform", minimized ? "-rotate-90" : "rotate-90")} />
          </button>
          <button onClick={onClose} className="text-gray-300 hover:text-white transition-colors">
            <X className="size-4" />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* To */}
          <div className="flex items-center border-b border-gray-200 px-3">
            <span className="text-xs text-gray-500 w-8 shrink-0">Do</span>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="flex-1 py-2 text-sm outline-none placeholder-gray-400"
              placeholder="Adres odbiorcy"
            />
          </div>

          {/* Subject */}
          <div className="flex items-center border-b border-gray-200 px-3">
            <span className="text-xs text-gray-500 w-8 shrink-0">Temat</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex-1 py-2 text-sm outline-none placeholder-gray-400"
              placeholder="Temat wiadomości"
            />
          </div>

          {/* Body */}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="flex-1 p-3 text-sm outline-none resize-none placeholder-gray-400"
            placeholder="Treść wiadomości..."
          />

          {/* Attachments list */}
          {attachments.length > 0 && (
            <div className="px-3 py-2 border-t border-gray-100 flex flex-wrap gap-1.5">
              {attachments.map((att, i) => (
                <div key={i} className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700 max-w-[200px]">
                  <Paperclip className="size-3 shrink-0 text-gray-400" />
                  <span className="truncate">{att.filename}</span>
                  <button onClick={() => removeAttachment(i)} className="shrink-0 text-gray-400 hover:text-gray-700 ml-0.5">
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSend}
                disabled={sending || !to.trim() || !subject.trim()}
                className={cx(
                  "flex items-center gap-2 rounded px-4 py-1.5 text-sm font-medium text-white transition-colors",
                  sending || !to.trim() || !subject.trim()
                    ? "bg-blue-300 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                Wyślij
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors"
                title="Dodaj załącznik"
              >
                <Paperclip className="size-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <Trash2 className="size-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Email List Item ──────────────────────────────────────────────────────────

function EmailListItem({
  email,
  selected,
  onClick,
  clientInfo,
}: {
  email: EmailMetadata;
  selected: boolean;
  onClick: () => void;
  clientInfo?: { _id: string; firstName: string; lastName: string };
}) {
  const { name } = parseFrom(email.from);

  return (
    <button
      onClick={onClick}
      className={cx(
        "w-full text-left px-4 py-3 border-b border-gray-100 transition-colors hover:bg-gray-50 focus:outline-none",
        selected && "bg-blue-50 border-l-2 border-l-blue-500",
        !email.isRead && "bg-white",
        email.isRead && !selected && "bg-gray-50/50",
      )}
    >
      <div className="flex items-start gap-2">
        {/* Unread dot */}
        <div className="mt-1.5 shrink-0">
          {!email.isRead ? (
            <div className="size-2 rounded-full bg-blue-500" />
          ) : (
            <div className="size-2 rounded-full bg-transparent" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={cx("text-sm truncate", !email.isRead ? "font-semibold text-gray-900" : "font-medium text-gray-700")}>
                {name || email.from}
              </span>
              {clientInfo && (
                <span className="flex items-center gap-0.5 shrink-0 rounded-full bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                  <UserCheck className="size-2.5" />
                  Klient
                </span>
              )}
            </div>
            <span className="text-xs text-gray-400 shrink-0">{email.date}</span>
          </div>
          <div className={cx("text-sm truncate mt-0.5", !email.isRead ? "font-medium text-gray-800" : "text-gray-600")}>
            {email.subject}
          </div>
          <div className="text-xs text-gray-400 truncate mt-0.5">{email.snippet}</div>
        </div>

        <div className="flex flex-col items-center gap-1 shrink-0">
          {email.isStarred && <Star className="size-3.5 text-yellow-400 fill-yellow-400" />}
          {email.hasAttachment && <Paperclip className="size-3 text-gray-300" />}
        </div>
      </div>
    </button>
  );
}

// ─── Thread List Item ─────────────────────────────────────────────────────────

function ThreadListItem({
  thread,
  selected,
  onClick,
  clientInfo,
}: {
  thread: ThreadMetadata;
  selected: boolean;
  onClick: () => void;
  clientInfo?: { _id: string; firstName: string; lastName: string };
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "w-full text-left px-4 py-3 border-b border-gray-100 transition-colors hover:bg-gray-50 focus:outline-none",
        selected && "bg-blue-50 border-l-2 border-l-blue-500",
        thread.hasUnread ? "bg-white" : "bg-gray-50/50",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="mt-1.5 shrink-0">
          {thread.hasUnread ? (
            <div className="size-2 rounded-full bg-blue-500" />
          ) : (
            <div className="size-2 rounded-full bg-transparent" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={cx("text-sm truncate", thread.hasUnread ? "font-semibold text-gray-900" : "font-medium text-gray-700")}>
                {thread.participants.slice(0, 2).join(", ")}
                {thread.participants.length > 2 && ` +${thread.participants.length - 2}`}
              </span>
              {thread.messageCount > 1 && (
                <span className="shrink-0 text-[10px] font-medium text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5">
                  {thread.messageCount}
                </span>
              )}
              {clientInfo && (
                <span className="flex items-center gap-0.5 shrink-0 rounded-full bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                  <UserCheck className="size-2.5" />
                  Klient
                </span>
              )}
            </div>
            <span className="text-xs text-gray-400 shrink-0">{thread.latestDate}</span>
          </div>
          <div className={cx("text-sm truncate mt-0.5", thread.hasUnread ? "font-medium text-gray-800" : "text-gray-600")}>
            {thread.subject}
          </div>
          <div className="text-xs text-gray-400 truncate mt-0.5">{thread.snippet}</div>
        </div>

        <div className="flex flex-col items-center gap-1 shrink-0">
          {thread.isStarred && <Star className="size-3.5 text-yellow-400 fill-yellow-400" />}
          {thread.hasAttachment && <Paperclip className="size-3 text-gray-300" />}
        </div>
      </div>
    </button>
  );
}

// ─── Thread View ──────────────────────────────────────────────────────────────

function ThreadMessageItem({
  msg,
  expanded,
  onToggle,
  connectedEmail,
  onDownloadAttachment,
}: {
  msg: ThreadMessageDetail;
  expanded: boolean;
  onToggle: () => void;
  connectedEmail: string;
  onDownloadAttachment: (att: Attachment) => Promise<void>;
}) {
  const { name, email: fromEmail } = parseFrom(msg.from);
  const isOutgoing = fromEmail.toLowerCase() === connectedEmail.toLowerCase();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!expanded || !iframeRef.current || !msg.isHtml) return;
    const iframe = iframeRef.current;
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #1f2937; margin: 0; padding: 0; }
        a { color: #2563eb; }
        img { max-width: 100%; }
      </style>
    </head><body>${msg.body}</body></html>`);
    doc.close();
    const resize = () => {
      if (iframe.contentDocument?.body) {
        iframe.style.height = iframe.contentDocument.body.scrollHeight + 8 + "px";
      }
    };
    iframe.onload = resize;
    resize();
  }, [expanded, msg.body, msg.isHtml]);

  return (
    <div className={cx("border border-gray-200 rounded-lg overflow-hidden", !msg.isRead && "border-blue-200")}>
      {/* Header (always visible) */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className={cx(
          "size-8 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold",
          isOutgoing ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700",
        )}>
          {(name || fromEmail)[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cx("text-sm", msg.isRead ? "font-medium text-gray-800" : "font-semibold text-gray-900")}>
              {name || fromEmail}
            </span>
            {isOutgoing && (
              <span className="text-[10px] font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-1.5 py-0.5 shrink-0">
                Wysłana
              </span>
            )}
          </div>
          {!expanded && (
            <div className="text-xs text-gray-400 truncate mt-0.5">{msg.snippet}</div>
          )}
        </div>
        <span className="text-xs text-gray-400 shrink-0">{msg.date}</span>
        {!expanded && msg.attachments?.length > 0 && (
          <Paperclip className="size-3.5 text-gray-400 shrink-0" title="Zawiera załączniki" />
        )}
        <ChevronLeft className={cx("size-4 text-gray-400 shrink-0 transition-transform", expanded ? "-rotate-90" : "rotate-90")} />
      </button>

      {/* Body (only when expanded) */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="text-xs text-gray-400 mb-3 mt-2">Do: {msg.to}</div>

          {/* Attachments — shown before body so they're always visible */}
          {msg.attachments?.length > 0 && (
            <div className="mb-3 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <Paperclip className="size-3" />
                {msg.attachments.length === 1 ? "1 załącznik" : `${msg.attachments.length} załączniki`}
              </div>
              <div className="flex flex-wrap gap-2">
                {msg.attachments.map((att) => (
                  <AttachmentChip
                    key={att.attachmentId ?? att.filename}
                    att={att}
                    onDownload={() => onDownloadAttachment(att)}
                  />
                ))}
              </div>
            </div>
          )}

          {msg.isHtml ? (
            <iframe
              ref={iframeRef}
              sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              className="w-full border-none"
              title="Email content"
              style={{ minHeight: 100 }}
            />
          ) : (
            <div
              className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed"
              dangerouslySetInnerHTML={{ __html: plainTextToHtml(msg.body || msg.snippet) }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ThreadView({
  threadId,
  subject,
  messages,
  connectedEmail,
  classificationStatus,
  onBack,
  onReply,
  onDownloadAttachment,
  onAddToTrello,
  onReclassify,
  isAddedToTrello,
}: {
  threadId: string;
  subject: string;
  messages: ThreadMessageDetail[];
  connectedEmail: string;
  classificationStatus?: "LEAD" | "OTHER";
  onBack: () => void;
  onReply: (msg: ThreadMessageDetail) => void;
  onDownloadAttachment: (messageId: string, att: Attachment) => Promise<void>;
  onAddToTrello: (msg: ThreadMessageDetail) => Promise<void>;
  onReclassify: (threadId: string, newStatus: "LEAD" | "OTHER") => void;
  isAddedToTrello: boolean;
}) {
  // Latest message expanded by default, rest collapsed
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(messages.length > 0 ? [messages[messages.length - 1].id] : []),
  );
  const [trelloLoading, setTrelloLoading] = useState(false);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const firstMsg = messages[0];
  const lastMsg = messages[messages.length - 1];

  async function handleAddToTrello() {
    if (!firstMsg) return;
    setTrelloLoading(true);
    try {
      await onAddToTrello(firstMsg);
    } finally {
      setTrelloLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ChevronLeft className="size-4" />
          Powrót
        </button>
        <div className="flex-1" />
        {firstMsg && (
          <button
            onClick={handleAddToTrello}
            disabled={trelloLoading || isAddedToTrello}
            className={cx(
              "flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm font-medium transition-colors",
              isAddedToTrello
                ? "bg-emerald-50 text-emerald-700 cursor-default"
                : "bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50",
            )}
            title={isAddedToTrello ? "Już dodano do Trello" : "Utwórz kartę Trello"}
          >
            {trelloLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <FileText className="size-3.5" />
            )}
            {isAddedToTrello ? "Dodano do Trello" : "Dodaj do Trello"}
          </button>
        )}
        {classificationStatus && (
          <button
            onClick={() =>
              onReclassify(threadId, classificationStatus === "LEAD" ? "OTHER" : "LEAD")
            }
            className={cx(
              "flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm font-medium transition-colors",
              classificationStatus === "LEAD"
                ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                : "bg-green-50 text-green-700 hover:bg-green-100",
            )}
            title={
              classificationStatus === "LEAD"
                ? "Oznacz jako Inne (nie-lead)"
                : "Przenieś do Odebranych jako Lead"
            }
          >
            <Tag className="size-3.5" />
            {classificationStatus === "LEAD" ? "Oznacz jako Inne" : "To jest Lead"}
          </button>
        )}
        {lastMsg && (
          <button
            onClick={() => onReply(lastMsg)}
            className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <Reply className="size-3.5" />
            Odpowiedz
          </button>
        )}
      </div>

      {/* Thread content */}
      <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
        <h1 className="text-xl font-semibold text-gray-900 mb-6">{subject}</h1>
        <div className="flex flex-col gap-3">
          {messages.map((msg) => (
            <ThreadMessageItem
              key={msg.id}
              msg={msg}
              expanded={expanded.has(msg.id)}
              onToggle={() => toggleExpanded(msg.id)}
              connectedEmail={connectedEmail}
              onDownloadAttachment={(att) => onDownloadAttachment(msg.id, att)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Email View ───────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentChip({
  att,
  onDownload,
}: {
  att: Attachment;
  onDownload: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const isImage = att.mimeType.startsWith("image/");

  const handleClick = async () => {
    setLoading(true);
    try { await onDownload(); } finally { setLoading(false); }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm hover:bg-gray-100 transition-colors disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="size-4 text-gray-400 animate-spin shrink-0" />
      ) : isImage ? (
        <ImageIcon className="size-4 text-blue-500 shrink-0" />
      ) : (
        <Paperclip className="size-4 text-gray-400 shrink-0" />
      )}
      <span className="max-w-[160px] truncate text-gray-700">{att.filename}</span>
      <span className="text-gray-400 text-xs shrink-0">{formatBytes(att.size)}</span>
      <Download className="size-3.5 text-gray-400 shrink-0" />
    </button>
  );
}

function EmailView({
  email,
  onBack,
  onReply,
  onStar,
  onTrash,
  onDownloadAttachment,
  onAddToTrello,
  isAddedToTrello,
}: {
  email: EmailDetail;
  onBack: () => void;
  onReply: () => void;
  onStar: () => void;
  onTrash: () => void;
  onDownloadAttachment: (att: Attachment) => Promise<void>;
  onAddToTrello: () => Promise<void>;
  isAddedToTrello: boolean;
}) {
  const { name, email: fromEmail } = parseFrom(email.from);
  const [trelloLoading, setTrelloLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  async function handleAddToTrello() {
    setTrelloLoading(true);
    try {
      await onAddToTrello();
    } finally {
      setTrelloLoading(false);
    }
  }

  useEffect(() => {
    if (!iframeRef.current || !email.isHtml) return;
    const iframe = iframeRef.current;
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #1f2937; margin: 0; padding: 16px; }
        a { color: #2563eb; }
        img { max-width: 100%; }
      </style>
    </head><body>${email.body}</body></html>`);
    doc.close();
    // Auto-resize iframe
    const resize = () => {
      if (iframe.contentDocument?.body) {
        iframe.style.height = iframe.contentDocument.body.scrollHeight + 32 + "px";
      }
    };
    iframe.onload = resize;
    resize();
  }, [email.body, email.isHtml]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ChevronLeft className="size-4" />
          Powrót
        </button>
        <div className="flex-1" />
        <button
          onClick={onStar}
          className="p-1.5 rounded hover:bg-gray-100 transition-colors"
          title={email.isStarred ? "Usuń gwiazdkę" : "Dodaj gwiazdkę"}
        >
          <Star className={cx("size-4", email.isStarred ? "text-yellow-400 fill-yellow-400" : "text-gray-400")} />
        </button>
        <button
          onClick={handleAddToTrello}
          disabled={trelloLoading || isAddedToTrello}
          className={cx(
            "flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm font-medium transition-colors",
            isAddedToTrello
              ? "bg-emerald-50 text-emerald-700 cursor-default"
              : "bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50",
          )}
          title={isAddedToTrello ? "Już dodano do Trello" : "Utwórz kartę Trello"}
        >
          {trelloLoading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <FileText className="size-3.5" />
          )}
          {isAddedToTrello ? "Dodano do Trello" : "Dodaj do Trello"}
        </button>
        <button
          onClick={onReply}
          className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <Reply className="size-3.5" />
          Odpowiedz
        </button>
        <button
          onClick={onTrash}
          className="p-1.5 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-red-500"
          title="Przenieś do kosza"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {/* Email content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-3xl mx-auto">
          {/* Subject */}
          <h1 className="text-xl font-semibold text-gray-900 mb-4">{email.subject}</h1>

          {/* Sender info */}
          <div className="flex items-start justify-between mb-6 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <span className="text-sm font-semibold text-blue-700">
                  {(name || fromEmail)[0]?.toUpperCase() ?? "?"}
                </span>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">{name || fromEmail}</div>
                <div className="text-xs text-gray-500">{fromEmail !== name ? fromEmail : ""}</div>
                <div className="text-xs text-gray-400 mt-0.5">Do: {email.to}</div>
              </div>
            </div>
            <div className="text-xs text-gray-400 shrink-0 mt-1">{email.date}</div>
          </div>

          {/* Attachments — shown before body so they're always visible */}
          {email.attachments?.length > 0 && (
            <div className="mb-4 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <Paperclip className="size-3.5" />
                {email.attachments.length === 1 ? "1 załącznik" : `${email.attachments.length} załączniki`}
              </div>
              <div className="flex flex-wrap gap-2">
                {email.attachments.map((att) => (
                  <AttachmentChip
                    key={att.attachmentId ?? att.filename}
                    att={att}
                    onDownload={() => onDownloadAttachment(att)}
                  />
                ))}
              </div>
            </div>
          )}

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
              className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed"
              dangerouslySetInnerHTML={{ __html: plainTextToHtml(email.body || email.snippet) }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MailPage() {
  const { user } = useUser();
  const connectionStatus = useQuery(api.gmail.getConnectionStatus);

  const [selectedLabel, setSelectedLabel] = useState("INBOX");
  const [messages, setMessages] = useState<EmailMetadata[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<EmailDetail | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeReply, setComposeReply] = useState<Partial<ComposeProps> | null>(null);
  const [replyMeta, setReplyMeta] = useState<{ messageId?: string; references?: string; threadId?: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  // Thread state
  const [threads, setThreads] = useState<ThreadMetadata[]>([]);
  const [threadsNextPageToken, setThreadsNextPageToken] = useState<string | undefined>();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedThread, setSelectedThread] = useState<{ messages: ThreadMessageDetail[] } | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);

  // Trello — trwałe śledzenie dodanych wiadomości (persisted w localStorage)
  const [addedToTrelloIds, setAddedToTrelloIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("trelloAddedMessageIds");
      return new Set(saved ? (JSON.parse(saved) as string[]) : []);
    } catch {
      return new Set<string>();
    }
  });

  const markAddedToTrello = useCallback((messageId: string) => {
    setAddedToTrelloIds((prev) => {
      const next = new Set(prev);
      next.add(messageId);
      try {
        localStorage.setItem("trelloAddedMessageIds", JSON.stringify([...next]));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  const listMessagesAction = useAction(api.gmail.listMessages);
  const listThreadsAction = useAction(api.gmail.listThreads);
  const getMessageAction = useAction(api.gmail.getMessage);
  const getThreadAction = useAction(api.gmail.getThread);
  const getAttachmentAction = useAction(api.gmail.getAttachment);
  const sendEmailAction = useAction(api.gmail.sendEmail);
  const modifyMessageAction = useAction(api.gmail.modifyMessage);
  const trashMessageAction = useAction(api.gmail.trashMessage);
  const getLabelInfoAction = useAction(api.gmail.getLabelInfo);
  const createTrelloCardFromEmailAction = useAction(api.trello.createCardFromEmail);
  const disconnectMutation = useMutation(api.gmail.disconnect);

  // Klasyfikacja AI
  const classifyThreadAction = useAction(api.emailClassification.classifyThread);
  const reclassifyMutation = useMutation(api.emailClassification.reclassify);
  const inboxThreadIds = useMemo(() => threads.map((t) => t.id), [threads]);
  const classifications = useQuery(api.emailClassification.getByThreadIds, {
    threadIds: inboxThreadIds,
  });

  // Ref do śledzenia wątków już wysłanych do klasyfikacji (unikamy duplikatów)
  const classifyingRef = useRef<Set<string>>(new Set());

  const handleDownloadAttachment = async (messageId: string, att: Attachment) => {
    let rawBase64: string;
    if (att.data) {
      rawBase64 = att.data;
    } else if (att.attachmentId) {
      const res = await getAttachmentAction({ messageId, attachmentId: att.attachmentId });
      rawBase64 = res.data;
    } else {
      return;
    }
    const base64 = rawBase64.replace(/-/g, "+").replace(/_/g, "/");
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

  // Fetch message list (with one automatic retry on connection loss)
  const fetchMessages = useCallback(async (labelId: string, pageToken?: string, attempt = 0) => {
    setLoadingList(true);
    try {
      const result = await listMessagesAction({ labelId, pageToken, maxResults: 20 });
      if (pageToken) {
        setMessages((prev) => [...prev, ...result.messages]);
      } else {
        setMessages(result.messages);
      }
      setNextPageToken(result.nextPageToken);
    } catch (err) {
      const isConnectionLost = err instanceof Error && err.message.includes("Connection lost");
      if (isConnectionLost && attempt === 0) {
        // Transient WebSocket drop — retry once after a short delay
        setTimeout(() => fetchMessages(labelId, pageToken, 1), 2000);
        return;
      }
      console.error("Failed to fetch messages:", err);
    } finally {
      setLoadingList(false);
    }
  }, [listMessagesAction]);

  // Fetch thread list
  const fetchThreads = useCallback(async (labelId: string, pageToken?: string, attempt = 0) => {
    setLoadingList(true);
    try {
      const result = await listThreadsAction({ labelId, pageToken, maxResults: 20 });
      if (pageToken) {
        setThreads((prev) => [...prev, ...result.threads]);
      } else {
        setThreads(result.threads);
      }
      setThreadsNextPageToken(result.nextPageToken);
    } catch (err) {
      const isConnectionLost = err instanceof Error && err.message.includes("Connection lost");
      if (isConnectionLost && attempt === 0) {
        setTimeout(() => fetchThreads(labelId, pageToken, 1), 2000);
        return;
      }
      console.error("Failed to fetch threads:", err);
    } finally {
      setLoadingList(false);
    }
  }, [listThreadsAction]);

  // Fetch unread count for INBOX
  const fetchInboxUnread = useCallback(async () => {
    try {
      const info = await getLabelInfoAction({ labelId: "INBOX" });
      setUnreadCounts((prev) => ({ ...prev, INBOX: info.messagesUnread }));
    } catch {
      // non-critical
    }
  }, [getLabelInfoAction]);

  // Load messages/threads when label changes
  useEffect(() => {
    if (connectionStatus?.connectionStatus === "connected") {
      setMessages([]);
      setThreads([]);
      setSelectedMessageId(null);
      setSelectedThreadId(null);
      setSelectedMessage(null);
      setSelectedThread(null);
      // Wirtualne labele (np. "Inne") używają danych z INBOX
      const labelToFetch = VIRTUAL_LABELS.has(selectedLabel) ? "INBOX" : selectedLabel;
      if (THREAD_LABELS.has(selectedLabel)) {
        fetchThreads(labelToFetch);
      } else {
        fetchMessages(labelToFetch);
      }
      fetchInboxUnread();
    }
  }, [selectedLabel, connectionStatus?.connectionStatus, fetchMessages, fetchThreads, fetchInboxUnread]);

  // Auto-klasyfikacja nowo załadowanych wątków INBOX
  useEffect(() => {
    if (!threads.length || classifications === undefined) return;
    threads.forEach((thread) => {
      if (!classifications[thread.id] && !classifyingRef.current.has(thread.id)) {
        classifyingRef.current.add(thread.id);
        classifyThreadAction({
          threadId: thread.id,
          subject: thread.subject,
          from: thread.latestFrom,
          snippet: thread.snippet,
        }).catch(console.error);
      }
    });
  }, [threads, classifications, classifyThreadAction]);

  // Fetch full thread when selected
  const handleSelectThread = async (threadId: string) => {
    setSelectedThreadId(threadId);
    setLoadingThread(true);
    try {
      const detail = await getThreadAction({ threadId });
      setSelectedThread(detail as { messages: ThreadMessageDetail[] });
    } catch (err) {
      console.error("Failed to fetch thread:", err);
    } finally {
      setLoadingThread(false);
    }
  };

  // Fetch full message when selected
  const handleSelectMessage = async (id: string) => {
    setSelectedMessageId(id);
    setLoadingMessage(true);
    try {
      const detail = await getMessageAction({ messageId: id });
      setSelectedMessage(detail as EmailDetail);

      // Mark as read if unread
      const msg = messages.find((m) => m.id === id);
      if (msg && !msg.isRead) {
        await modifyMessageAction({ messageId: id, removeLabelIds: ["UNREAD"] });
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, isRead: true } : m))
        );
      }
    } catch (err) {
      console.error("Failed to fetch message:", err);
    } finally {
      setLoadingMessage(false);
    }
  };

  // Send email
  const handleSendEmail = async (to: string, subject: string, body: string, attachments: AttachmentPayload[]) => {
    await sendEmailAction({
      to,
      subject,
      body: body.replace(/\n/g, "<br>"),
      inReplyToMessageId: replyMeta?.messageId,
      references: replyMeta?.references,
      threadId: replyMeta?.threadId,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
    setReplyMeta(null);
    // Refresh sent
    if (selectedLabel === "SENT") {
      await fetchMessages("SENT");
    }
    // Refresh thread if replying in thread context
    if (replyMeta?.threadId) {
      const detail = await getThreadAction({ threadId: replyMeta.threadId });
      setSelectedThread(detail as { messages: ThreadMessageDetail[] });
      setThreads((prev) =>
        prev.map((t) =>
          t.id === replyMeta.threadId
            ? { ...t, messageCount: (detail as { messages: ThreadMessageDetail[] }).messages.length }
            : t
        )
      );
    }
  };

  // Star/unstar
  const handleStar = async () => {
    if (!selectedMessage) return;
    const isStarred = selectedMessage.isStarred;
    await modifyMessageAction({
      messageId: selectedMessage.id,
      addLabelIds: isStarred ? [] : ["STARRED"],
      removeLabelIds: isStarred ? ["STARRED"] : [],
    });
    const updated = { ...selectedMessage, isStarred: !isStarred };
    setSelectedMessage(updated);
    setMessages((prev) =>
      prev.map((m) => (m.id === selectedMessage.id ? { ...m, isStarred: !isStarred } : m))
    );
  };

  // Trash
  const handleTrash = async () => {
    if (!selectedMessage) return;
    await trashMessageAction({ messageId: selectedMessage.id });
    setMessages((prev) => prev.filter((m) => m.id !== selectedMessage.id));
    setSelectedMessage(null);
    setSelectedMessageId(null);
  };

  // Reply to single message
  const handleReply = () => {
    if (!selectedMessage) return;
    const { email: fromEmail } = parseFrom(selectedMessage.from);
    setReplyMeta({
      messageId: selectedMessage.messageId,
      references: selectedMessage.references,
      threadId: selectedMessage.threadId,
    });
    setComposeReply({
      defaultTo: fromEmail,
      defaultSubject: selectedMessage.subject.startsWith("Re:")
        ? selectedMessage.subject
        : `Re: ${selectedMessage.subject}`,
      defaultBody: `\n\n--- Oryginalna wiadomość ---\nOd: ${selectedMessage.from}\nData: ${selectedMessage.date}\n\n${selectedMessage.snippet}`,
      title: `Odp: ${selectedMessage.subject}`,
    });
    setComposeOpen(true);
  };

  // Reply from thread view
  const handleReplyToThread = (msg: ThreadMessageDetail) => {
    const { email: fromEmail } = parseFrom(msg.from);
    const threadSubject = threads.find((t) => t.id === selectedThreadId)?.subject ?? "";
    setReplyMeta({
      messageId: msg.messageId,
      references: msg.references,
      threadId: selectedThreadId ?? undefined,
    });
    setComposeReply({
      defaultTo: fromEmail,
      defaultSubject: threadSubject.startsWith("Re:") ? threadSubject : `Re: ${threadSubject}`,
      defaultBody: `\n\n--- Oryginalna wiadomość ---\nOd: ${msg.from}\nData: ${msg.date}\n\n${msg.snippet}`,
      title: `Odp: ${threadSubject}`,
    });
    setComposeOpen(true);
  };

  // Trello — utwórz kartę z emaila (single message)
  const handleAddEmailToTrello = async () => {
    if (!selectedMessage) return;
    const { email: fromEmail } = parseFrom(selectedMessage.from);
    const allAttachments = [
      ...(selectedMessage.attachments ?? []),
      ...(selectedMessage.inlineImages ?? []),
    ];
    await createTrelloCardFromEmailAction({
      listId: "63ce283991c2d000e9f8024e",
      from: fromEmail,
      subject: selectedMessage.subject,
      body: selectedMessage.isHtml
        ? selectedMessage.snippet
        : (selectedMessage.body || selectedMessage.snippet),
      messageId: selectedMessage.id,
      attachments: allAttachments.map((a) => ({
        attachmentId: a.attachmentId,
        filename: a.filename,
        mimeType: a.mimeType,
      })),
    });
    markAddedToTrello(selectedMessage.id);
  };

  // Trello — utwórz kartę z wiadomości w wątku
  const handleAddThreadMessageToTrello = async (msg: ThreadMessageDetail) => {
    const { email: fromEmail } = parseFrom(msg.from);
    const threadSubject = threads.find((t) => t.id === selectedThreadId)?.subject ?? "";
    const allAttachments = [
      ...(msg.attachments ?? []),
      ...(msg.inlineImages ?? []),
    ];
    await createTrelloCardFromEmailAction({
      listId: "63ce283991c2d000e9f8024e",
      from: fromEmail,
      subject: threadSubject,
      body: msg.isHtml ? msg.snippet : (msg.body || msg.snippet),
      messageId: msg.id,
      attachments: allAttachments.map((a) => ({
        attachmentId: a.attachmentId,
        filename: a.filename,
        mimeType: a.mimeType,
      })),
    });
    markAddedToTrello(msg.id);
  };

  // Ręczna reklasyfikacja wątku przez handlowca
  const handleReclassify = (threadId: string, newStatus: "LEAD" | "OTHER") => {
    reclassifyMutation({ gmailThreadId: threadId, classificationStatus: newStatus }).catch(
      console.error,
    );
  };

  // Apply relevance filter (INBOX/STARRED only), then optional search
  const relevantMessages = FILTERED_LABELS.has(selectedLabel)
    ? messages.filter(isEmailRelevant)
    : messages;

  const filteredMessages = searchQuery
    ? relevantMessages.filter(
        (m) =>
          m.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.snippet.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : relevantMessages;

  // Thread filtering
  // Dla INBOX i "Inne": tylko blacklist (nie whitelist) — AI klasyfikuje resztę.
  // Whitelist odrzucałby maile od klientów spoza domeny adkokna.pl (np. gmail.com).
  // Dla pozostałych labelek: pełna heurystyka isThreadRelevant.
  const blacklistFilteredThreads = useMemo(
    () =>
      threads.filter((t) => {
        const from = t.latestFrom.toLowerCase();
        return (
          !FILTER_BLACKLIST.domains.some((d) => from.includes(d)) &&
          !FILTER_BLACKLIST.patterns.some((p) => from.includes(p))
        );
      }),
    [threads],
  );

  const relevantThreads =
    selectedLabel === "INBOX" || selectedLabel === "__OTHER__"
      ? blacklistFilteredThreads
      : FILTERED_LABELS.has(selectedLabel)
        ? threads.filter(isThreadRelevant)
        : threads;

  // Filtracja AI: INBOX pokazuje tylko potwierdzone LEAD, "Inne" pokazuje tylko OTHER.
  // Niesklasyfikowane wątki (czekające na AI) są ukryte w INBOX — pojawiają się dopiero
  // po potwierdzeniu przez model jako LEAD.
  const classificationFilteredThreads = useMemo(() => {
    if (selectedLabel === "INBOX") {
      return relevantThreads.filter((t) => classifications?.[t.id] === "LEAD");
    }
    if (selectedLabel === "__OTHER__") {
      return relevantThreads.filter((t) => classifications?.[t.id] === "OTHER");
    }
    return relevantThreads;
  }, [relevantThreads, selectedLabel, classifications]);

  const filteredThreads = searchQuery
    ? classificationFilteredThreads.filter(
        (t) =>
          t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.participants.some((p) => p.toLowerCase().includes(searchQuery.toLowerCase())) ||
          t.snippet.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : classificationFilteredThreads;

  const isThreadView = THREAD_LABELS.has(selectedLabel);

  // Wyciągamy unikalne emaile nadawców, żeby sprawdzić czy są w bazie klientów
  const senderEmails = useMemo(() => {
    if (isThreadView) {
      const emails = filteredThreads.flatMap((t) => {
        const { email } = parseFrom(t.latestFrom);
        return email ? [email.toLowerCase()] : [];
      });
      return [...new Set(emails)];
    }
    const emails = filteredMessages.map((m) => parseFrom(m.from).email.toLowerCase()).filter(Boolean);
    return [...new Set(emails)];
  }, [filteredMessages, filteredThreads, isThreadView]);

  const clientsByEmail = useQuery(api.clients.findByEmails, { emails: senderEmails });

  // ─── Connect Screen ──────────────────────────────────────────────────────────

  if (connectionStatus === undefined) {
    return (
      <div className="-m-6 flex items-center justify-center bg-gray-50" style={{ height: "calc(100vh - 56px)" }}>
        <Loader2 className="size-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!connectionStatus || connectionStatus.connectionStatus === "disconnected") {
    return (
      <div className="-m-6 flex items-center justify-center bg-gray-50" style={{ height: "calc(100vh - 56px)" }}>
        <div className="text-center max-w-sm">
          <div className="flex size-16 items-center justify-center rounded-full bg-blue-50 mx-auto mb-4">
            <Mail className="size-8 text-blue-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Podłącz skrzynkę Gmail</h2>
          <p className="text-sm text-gray-500 mb-6">
            Połącz konto Google Workspace, aby odbierać i wysyłać maile z adresu{" "}
            <span className="font-medium text-gray-700">kontakt@adkokna.pl</span> bezpośrednio w CRM.
          </p>
          <a
            href={`${siteUrl}/api/gmail/auth?userId=${user?.id ?? "unknown"}`}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Mail className="size-4" />
            Połącz z Google
          </a>
        </div>
      </div>
    );
  }

  const isError = ["expired", "refresh_failed", "error"].includes(connectionStatus.connectionStatus);

  // ─── Main Mail UI ────────────────────────────────────────────────────────────

  return (
    <div className="-m-6 flex overflow-hidden bg-white" style={{ height: "calc(100vh - 56px)" }}>

      {/* ── Sidebar ── */}
      <aside className="w-56 shrink-0 flex flex-col border-r border-gray-200 bg-white">
        {/* Compose button */}
        <div className="p-3">
          <button
            onClick={() => { setComposeReply(null); setComposeOpen(true); }}
            className="flex w-full items-center gap-2.5 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 hover:bg-blue-100 shadow-sm transition-colors"
          >
            <Pencil className="size-4" />
            Nowa wiadomość
          </button>
        </div>

        {/* Labels */}
        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          {SYSTEM_LABELS.map((label) => {
            const isActive = selectedLabel === label.id;
            const unread = unreadCounts[label.id];
            return (
              <button
                key={label.id}
                onClick={() => setSelectedLabel(label.id)}
                className={cx(
                  "flex w-full items-center gap-3 rounded-full px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-blue-100 text-blue-800 font-semibold"
                    : "text-gray-700 hover:bg-gray-100",
                )}
              >
                <label.icon className="size-4 shrink-0" />
                <span className="flex-1 text-left">{label.labelPl}</span>
                {unread ? (
                  <span className="text-xs font-semibold text-gray-700">{unread}</span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* Connection status */}
        <div className="px-3 py-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            {isError ? (
              <WifiOff className="size-3.5 text-red-400" />
            ) : (
              <Wifi className="size-3.5 text-green-500" />
            )}
            <span className="text-xs text-gray-500 truncate">{connectionStatus.connectedEmail}</span>
          </div>
          {isError && (
            <a
              href={`${siteUrl}/api/gmail/auth?userId=${user?.id ?? "unknown"}`}
              className="mt-1 block text-xs text-red-500 hover:underline"
            >
              Odśwież połączenie
            </a>
          )}
          <button
            onClick={() => disconnectMutation({})}
            className="mt-1 text-xs text-gray-400 hover:text-gray-600 hover:underline"
          >
            Rozłącz
          </button>
        </div>
      </aside>

      {/* ── Email List ── */}
      <div className="w-80 shrink-0 flex flex-col border-r border-gray-200">
        {/* Search & refresh */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200">
          <div className="flex flex-1 items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5">
            <Search className="size-3.5 text-gray-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj w tej skrzynce..."
              className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400 min-w-0"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")}>
                <X className="size-3.5 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>
          <button
            onClick={() => isThreadView ? fetchThreads(selectedLabel) : fetchMessages(selectedLabel)}
            disabled={loadingList}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors text-gray-500"
            title="Odśwież"
          >
            <RefreshCw className={cx("size-4", loadingList && "animate-spin")} />
          </button>
        </div>

        {/* Label title */}
        <div className="px-4 py-2 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">
            {SYSTEM_LABELS.find((l) => l.id === selectedLabel)?.labelPl ?? selectedLabel}
          </h2>
        </div>

        {/* Message/Thread list */}
        <div className="flex-1 overflow-y-auto">
          {loadingList && (isThreadView ? threads.length === 0 : messages.length === 0) ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="size-5 animate-spin text-gray-400" />
            </div>
          ) : (isThreadView ? filteredThreads.length === 0 : filteredMessages.length === 0) ? (
            (() => {
              // INBOX: jeśli są wątki w trakcie klasyfikacji, pokaż stosowny komunikat
              const classifying = selectedLabel === "INBOX" && blacklistFilteredThreads.length > 0 && blacklistFilteredThreads.some((t) => !classifications?.[t.id]);
              return (
                <div className="flex flex-col items-center justify-center h-32 text-gray-400 px-4 text-center">
                  {classifying ? (
                    <>
                      <Loader2 className="size-6 mb-2 animate-spin opacity-60" />
                      <p className="text-sm">Analizuję wiadomości AI…</p>
                      <p className="text-xs mt-1 opacity-70">Filtrowanie zapytań o ofertę</p>
                    </>
                  ) : (
                    <>
                      <Mail className="size-8 mb-2 opacity-40" />
                      <p className="text-sm">Brak zapytań o ofertę</p>
                    </>
                  )}
                </div>
              );
            })()
          ) : isThreadView ? (
            <>
              {filteredThreads.map((thread) => {
                const { email: senderEmail } = parseFrom(thread.latestFrom);
                const clientInfo = clientsByEmail?.[senderEmail.toLowerCase()];
                return (
                  <ThreadListItem
                    key={thread.id}
                    thread={thread}
                    selected={selectedThreadId === thread.id}
                    onClick={() => handleSelectThread(thread.id)}
                    clientInfo={clientInfo}
                  />
                );
              })}
              {threadsNextPageToken && !searchQuery && (
                <button
                  onClick={() => fetchThreads(selectedLabel, threadsNextPageToken)}
                  disabled={loadingList}
                  className="w-full py-3 text-sm text-blue-600 hover:bg-gray-50 transition-colors border-t border-gray-100"
                >
                  {loadingList ? "Ładowanie..." : "Wczytaj więcej"}
                </button>
              )}
            </>
          ) : (
            <>
              {filteredMessages.map((email) => {
                const senderEmail = parseFrom(email.from).email.toLowerCase();
                const clientInfo = clientsByEmail?.[senderEmail];
                return (
                  <EmailListItem
                    key={email.id}
                    email={email}
                    selected={selectedMessageId === email.id}
                    onClick={() => handleSelectMessage(email.id)}
                    clientInfo={clientInfo}
                  />
                );
              })}
              {nextPageToken && !searchQuery && (
                <button
                  onClick={() => fetchMessages(selectedLabel, nextPageToken)}
                  disabled={loadingList}
                  className="w-full py-3 text-sm text-blue-600 hover:bg-gray-50 transition-colors border-t border-gray-100"
                >
                  {loadingList ? "Ładowanie..." : "Wczytaj więcej"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Email View / Thread View / Empty State ── */}
      <div className="flex-1 overflow-hidden">
        {isThreadView ? (
          loadingThread ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="size-6 animate-spin text-gray-400" />
            </div>
          ) : selectedThread ? (
            <ThreadView
              threadId={selectedThreadId ?? ""}
              subject={threads.find((t) => t.id === selectedThreadId)?.subject ?? ""}
              messages={selectedThread.messages}
              connectedEmail={connectionStatus.connectedEmail}
              classificationStatus={
                selectedThreadId ? classifications?.[selectedThreadId] : undefined
              }
              onBack={() => { setSelectedThread(null); setSelectedThreadId(null); }}
              onReply={handleReplyToThread}
              onDownloadAttachment={handleDownloadAttachment}
              onAddToTrello={handleAddThreadMessageToTrello}
              onReclassify={handleReclassify}
              isAddedToTrello={
                selectedThread.messages.length > 0
                  ? addedToTrelloIds.has(selectedThread.messages[0].id)
                  : false
              }
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Mail className="size-16 mb-4 opacity-20" />
              <p className="text-sm">Wybierz wątek, aby go przeczytać</p>
            </div>
          )
        ) : loadingMessage ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="size-6 animate-spin text-gray-400" />
          </div>
        ) : selectedMessage ? (
          <EmailView
            email={selectedMessage}
            onBack={() => { setSelectedMessage(null); setSelectedMessageId(null); }}
            onReply={handleReply}
            onStar={handleStar}
            onTrash={handleTrash}
            onAddToTrello={handleAddEmailToTrello}
            onDownloadAttachment={(att) => handleDownloadAttachment(selectedMessage.id, att)}
            isAddedToTrello={addedToTrelloIds.has(selectedMessage.id)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Mail className="size-16 mb-4 opacity-20" />
            <p className="text-sm">Wybierz wiadomość, aby ją przeczytać</p>
          </div>
        )}
      </div>

      {/* ── Compose Modal ── */}
      {composeOpen && (
        <ComposeModal
          onClose={() => setComposeOpen(false)}
          onSend={handleSendEmail}
          defaultTo={composeReply?.defaultTo}
          defaultSubject={composeReply?.defaultSubject}
          defaultBody={composeReply?.defaultBody}
          title={composeReply?.title ?? "Nowa wiadomość"}
        />
      )}
    </div>
  );
}
