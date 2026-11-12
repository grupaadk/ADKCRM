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

        {/* Lista braków lub potwierdzenie gotowości */}
        {issues.length > 0 ? (
          <div
            className={`rounded-xl border p-3.5 flex flex-col gap-2 ${
              isApiEnabled
                ? "bg-red-50/80 border-red-200 text-red-900"
                : "bg-amber-50/80 border-amber-200 text-amber-900"
            }`}
          >
            <div className="text-xs font-bold flex items-center gap-1.5">
              <span>{isApiEnabled ? "⛔" : "⚠️"}</span>
              <span>
                {isApiEnabled
                  ? `Uzupełnij brakujące dane przed wysyłką (${issues.length}):`
                  : `Brakujące pola (nie blokują zapisu, ${issues.length}):`}
              </span>
            </div>
            <ul className="m-0 pl-4 flex flex-col gap-1.5 text-xs">
              {issues.map((issue, idx) => (
                <li key={`${issue.step}-${idx}`} className="flex items-center justify-between gap-3">
                  <span>{issue.message}</span>
                  <button
                    type="button"
                    onClick={() => onGoToStep(issue.step)}
                    className={`shrink-0 text-[11px] font-bold underline cursor-pointer bg-transparent border-0 p-0 ${
                      isApiEnabled ? "text-red-700 hover:text-red-900" : "text-amber-800 hover:text-amber-950"
                    }`}
                  >
                    Przejdź do kroku →
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-900 flex items-center gap-2 font-semibold">
            <span>✓</span>
            <span>
              Wszystkie wymagane dane są uzupełnione.{" "}
              {isApiEnabled ? "Zamówienie jest gotowe do wysyłki." : "Możesz zapisać zamówienie."}
            </span>
          </div>
        )}

        {/* Główne parametry zamówienia */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex flex-col gap-2">
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-500 font-semibold">Usługa / Kategoria:</span>
              <span className="font-bold text-slate-900">{serviceName || "—"}</span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-500 font-semibold">Dostawca:</span>
              <span className="font-bold text-slate-900">{supplierName || "—"}</span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-500 font-semibold">Kwota netto:</span>
              <span
                className={`font-bold ${
                  netAmount && netAmount > 0 ? "text-slate-900" : "text-red-600"
                }`}
              >
                {netAmount && netAmount > 0
                  ? `${netAmount.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} PLN`
                  : "nie podano"}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex flex-col gap-2">
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-500 font-semibold">Załączniki Google Drive:</span>
              <span className="font-bold text-slate-900">
                {driveFiles.length > 0 ? `${driveFiles.length} szt.` : "Brak"}
              </span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-500 font-semibold">Dodatkowe uwagi / wiadomości:</span>
              <span className="font-bold text-slate-900">{notesCount}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-slate-500 font-semibold">Wybrane produkty:</span>
              {selectedProducts.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {selectedProducts.map((p) => (
                    <span
                      key={p.id}
                      className="rounded-md bg-amber-100 border border-amber-300 px-2 py-0.5 text-[11px] font-bold text-amber-900"
                    >
                      {p.name}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-slate-400 italic">Brak wybranych produktów</span>
              )}
            </div>
          </div>
        </div>

        {/* Podgląd wiadomości Q&A */}
        {qaPreviewText && (
          <div className="flex flex-col gap-1.5">
            <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
              Podgląd specyfikacji produktów do wysłania
            </div>
            <pre className="m-0 whitespace-pre-wrap font-sans text-xs text-slate-800 bg-amber-50/50 border border-amber-200/80 rounded-xl p-3 leading-relaxed">
              {qaPreviewText}
            </pre>
          </div>
        )}

        {/* Przyciski akcji */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
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
  );
}
