"use client";

import type { SupplierOrderIssue, SupplierOrderStep } from "@/convex/lib/supplierOrderValidation";

type SupplierOrderStepperProps = Readonly<{
  currentStep: SupplierOrderStep;
  onStepChange: (step: SupplierOrderStep) => void;
  issues: SupplierOrderIssue[];
  showValidation: boolean;
  summaryData: {
    supplierName?: string;
    netAmount?: number;
    selectedProductsCount: number;
    attachmentsCount: number;
    notesCount: number;
    isApiEnabled: boolean;
  };
}>;

const STEPS: Array<{
  key: SupplierOrderStep;
  number: number;
  title: string;
}> = [
  { key: "supplier", number: 1, title: "Dostawca i kwota" },
  { key: "products", number: 2, title: "Produkty i pytania" },
  { key: "attachments", number: 3, title: "Załączniki i uwagi" },
  { key: "summary", number: 4, title: "Podsumowanie i wysyłka" },
];

export default function SupplierOrderStepper({
  currentStep,
  onStepChange,
  issues,
  showValidation,
  summaryData,
}: SupplierOrderStepperProps) {
  function getStepSubtitle(step: SupplierOrderStep): string {
    switch (step) {
      case "supplier": {
        const sup = summaryData.supplierName || "Nie wybrano";
        const amt =
          summaryData.netAmount && summaryData.netAmount > 0
            ? `${summaryData.netAmount.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} PLN`
            : "brak kwoty";
        return `${sup} • ${amt}`;
      }
      case "products":
        return summaryData.selectedProductsCount > 0
          ? `Wybrano: ${summaryData.selectedProductsCount}`
          : "Wybierz produkty i odpowiedzi";
      case "attachments":
        return `Plików: ${summaryData.attachmentsCount} • Uwag: ${summaryData.notesCount}`;
      case "summary":
        return summaryData.isApiEnabled
          ? "Weryfikacja i wysyłka do ALCO"
          : "Weryfikacja i zapis zamówienia";
    }
  }

  function isStepComplete(step: SupplierOrderStep): boolean {
    const stepHasErrors = issues.some((issue) => issue.step === step);
    if (stepHasErrors) return false;
    switch (step) {
      case "supplier":
        return Boolean(summaryData.netAmount && summaryData.netAmount > 0);
      case "products":
        return summaryData.selectedProductsCount > 0;
      case "attachments":
        return summaryData.attachmentsCount > 0 || summaryData.notesCount > 0;
      case "summary":
        return issues.length === 0;
    }
  }

  return (
    <div className="w-[280px] shrink-0 flex flex-col gap-3">
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-3 flex flex-col gap-1.5">
        <div className="px-2 pt-1 pb-2 border-b border-slate-100">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Kreator zamówienia
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Uzupełnij kroki przed wysłaniem
          </div>
        </div>

        <nav className="flex flex-col gap-1.5 mt-1" aria-label="Kroki zamówienia">
          {STEPS.map((step) => {
            const isActive = currentStep === step.key;
            const stepIssues = issues.filter((issue) => issue.step === step.key);
            const hasVisibleError = showValidation && stepIssues.length > 0;
            const completed = isStepComplete(step.key);
            const labelTitle =
              step.key === "summary" && !summaryData.isApiEnabled
                ? "Podsumowanie i zapis"
                : step.title;

            return (
              <button
                key={step.key}
                type="button"
                onClick={() => onStepChange(step.key)}
                className={`w-full text-left rounded-xl px-3 py-2.5 border transition-all flex items-start gap-2.5 cursor-pointer ${
                  isActive
                    ? "bg-blue-50/90 border-blue-300 shadow-2xs"
                    : hasVisibleError
                    ? "bg-red-50/50 border-red-200 hover:bg-red-50"
                    : "bg-white border-transparent hover:bg-slate-50 hover:border-slate-200"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 border ${
                    hasVisibleError
                      ? "bg-red-100 text-red-700 border-red-300"
                      : isActive
                      ? "bg-blue-600 text-white border-blue-600"
                      : completed
                      ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  }`}
                >
                  {hasVisibleError ? "!" : completed && !isActive ? "✓" : step.number}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-xs font-bold leading-snug ${
                      hasVisibleError
                        ? "text-red-800"
                        : isActive
                        ? "text-blue-900"
                        : "text-slate-800"
                    }`}
                  >
                    {labelTitle}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                    {getStepSubtitle(step.key)}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {showValidation && issues.length > 0 && (
        <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-3 text-xs text-amber-900">
          <div className="font-bold mb-1">Do uzupełnienia ({issues.length})</div>
          <div className="text-[11px] text-amber-800 leading-relaxed">
            Kliknij krok oznaczony wykrzyknikiem lub przejdź do podsumowania, aby zobaczyć listę braków.
          </div>
        </div>
      )}
    </div>
  );
}
