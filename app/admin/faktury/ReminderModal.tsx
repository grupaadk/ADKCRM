"use client";

import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { X, Send, Mail, AlertTriangle, CheckCircle } from "lucide-react";
import ModalPortal from "@/components/ModalPortal";

export default function ReminderModal({
  invoiceId,
  onClose,
}: {
  invoiceId: Id<"fakturowniaInvoicesCache">;
  onClose: () => void;
}) {
  const preview = useQuery(api.paymentReminders.previewReminder, { invoiceId });
  const history = useQuery(api.paymentReminders.listByInvoice, { invoiceId });
  const sendReminder = useAction(api.paymentReminders.sendReminder);

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      await sendReminder({ invoiceId });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd wysyłki");
    } finally {
      setSending(false);
    }
  }

  return (
    <ModalPortal>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-lg flex-col rounded-xl bg-white shadow-2xl ring-1 ring-gray-200"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Przypomnienie o płatności
            </h2>
            {preview?.invoiceNumber && (
              <p className="mt-0.5 text-xs text-gray-500">
                Faktura {preview.invoiceNumber}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {preview === undefined && (
            <p className="animate-pulse text-sm text-gray-400">Ładowanie podglądu…</p>
          )}

          {preview === null && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertTriangle className="size-4 shrink-0" />
              Nie znaleziono faktury.
            </div>
          )}

          {preview && !preview.hasClient && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
              <AlertTriangle className="size-4 shrink-0" />
              Faktura nie jest przypisana do żadnego zlecenia. Najpierw przypisz ją do zlecenia.
            </div>
          )}

          {preview && preview.hasClient && !preview.hasEmail && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
              <AlertTriangle className="size-4 shrink-0" />
              Klient nie ma przypisanego adresu email.
            </div>
          )}

          {preview && preview.hasClient && preview.hasEmail && (
            <>
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  Do
                </p>
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  <Mail className="size-3.5 shrink-0 text-gray-400" />
                  <span className="text-sm text-gray-900">{preview.to}</span>
                </div>
              </div>

              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  Temat
                </p>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">
                  {preview.subject}
                </div>
              </div>

              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  Treść
                </p>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-sans text-xs leading-relaxed text-gray-700">
                  {preview.previewText}
                </pre>
              </div>
            </>
          )}

          {/* Historia */}
          {history && history.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                Historia wysyłek
              </p>
              <div className="space-y-1.5">
                {history.map((r) => (
                  <div
                    key={r._id}
                    className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600"
                  >
                    <span>{new Date(r.sentAt).toLocaleString("pl-PL")}</span>
                    <span className="text-gray-400">{r.recipientEmail}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sent && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2.5 text-sm text-green-700">
              <CheckCircle className="size-4 shrink-0" />
              Wiadomość została wysłana pomyślnie.
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertTriangle className="size-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-5 py-3">
          <button onClick={onClose} className="btn" style={{ fontSize: 12 }}>
            {sent ? "Zamknij" : "Anuluj"}
          </button>
          {!sent && preview?.hasClient && preview?.hasEmail && (
            <button
              onClick={handleSend}
              disabled={sending}
              className="btn"
              style={{
                fontSize: 12,
                background: sending ? undefined : "var(--accent)",
                color: sending ? undefined : "white",
                borderColor: "transparent",
                opacity: sending ? 0.6 : 1,
              }}
            >
              <Send className="size-3" />
              {sending ? "Wysyłanie…" : "Wyślij"}
            </button>
          )}
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
