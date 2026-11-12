"use client";

import type { SupplierOrderIssue, SupplierOrderStep } from "@/convex/lib/supplierOrderValidation";

type SupplierOrderSummaryProps = Readonly<{
  serviceName: string;
  supplierName: string;
  isApiEnabled: boolean;
  netAmount?: number;
  selectedProducts: Array<{ id: string; name: string }>;
  driveFiles: Array<{ id: string; name: string }>;
  notesCount: number;
  qaPreviewText: string;
  issues: SupplierOrderIssue[];
  onGoToStep: (step: SupplierOrderStep) => void;
  onSaveDraft: () => void;
  onSendToAlco: () => void;
  saving: boolean;
  sendingToAlco: boolean;
}>;

export default function SupplierOrderSummary({
  serviceName,
  supplierName,
  isApiEnabled,
  netAmount,
  selectedProducts,
  driveFiles,
  notesCount,
  qaPreviewText,
  issues,
  onGoToStep,
  onSaveDraft,
  onSendToAlco,
  saving,
  sendingToAlco,
}: SupplierOrderSummaryProps) {
  const hasBlockingIssues = isApiEnabled && issues.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 m-0">
              {isApiEnabled ? "Podsumowanie i wysyłka do ALCO" : "Podsumowanie i zapis zamówienia"}
            </h3>
            <p className="text-xs text-slate-500 m-0 mt-0.5">
              Sprawdź kompletność danych przed {isApiEnabled ? "utworzeniem zamówienia w CRM dostawcy" : "zapisaniem"}.
            </p>
          </div>
        </div>

        {/* Podgląd wiadomości Q&A */}
        <div className="flex flex-col gap-1.5">
          <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
            Podgląd specyfikacji produktów do wysłania
          </div>
          {qaPreviewText ? (
            <pre className="m-0 whitespace-pre-wrap font-sans text-xs text-slate-800 bg-amber-50/50 border border-amber-200/80 rounded-xl p-3.5 leading-relaxed">
              {qaPreviewText}
            </pre>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-3.5 text-xs text-slate-400">
              Brak wybranych produktów lub odpowiedzi do podglądu.
            </div>
          )}
        </div>

        {/* Przyciski akcji */}
        <div className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-slate-100">
          {hasBlockingIssues ? (
            <button
              type="button"
              onClick={() => onGoToStep(issues[0].step)}
              className="text-xs font-semibold text-red-600 hover:text-red-800 underline bg-transparent border-0 p-0 cursor-pointer text-left"
            >
              {issues[0].message} — przejdź do kroku →
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2.5 ml-auto">
          <button
            type="button"
            disabled={saving || sendingToAlco}
            onClick={onSaveDraft}
            className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer disabled:opacity-50 ${
              isApiEnabled
                ? "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                : "bg-brand text-white border-brand hover:bg-brand-hover shadow-xs"
            }`}
          >
            {saving ? "Zapisywanie..." : isApiEnabled ? "Zapisz szkic" : "Zapisz zamówienie"}
          </button>

          {isApiEnabled && (
            <button
              type="button"
              disabled={hasBlockingIssues || saving || sendingToAlco}
              onClick={onSendToAlco}
              className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {sendingToAlco ? "Wysyłanie do ALCO..." : "🚀 Wyślij zamówienie do ALCO"}
            </button>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
