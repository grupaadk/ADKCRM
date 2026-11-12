"use client";

export type SupplierOrderThreadSection =
  | "supplier"
  | "products"
  | "files"
  | "correspondence";

type SupplierOrderDetailsSidebarProps = Readonly<{
  activeSection: SupplierOrderThreadSection;
  onSectionChange: (section: SupplierOrderThreadSection) => void;
  summaryData: {
    supplierName?: string;
    netAmount?: number;
    selectedProductsCount: number;
    sentFilesCount: number;
    messagesCount: number;
    externalOrderNumber?: string;
    isExalcoSupplier: boolean;
  };
}>;

const SECTIONS: Array<{
  key: SupplierOrderThreadSection;
  number: number;
  title: string;
}> = [
  { key: "supplier", number: 1, title: "Dostawca i terminy" },
  { key: "products", number: 2, title: "Produkty i pytania" },
  { key: "files", number: 3, title: "Pliki i załączniki" },
  { key: "correspondence", number: 4, title: "Korespondencja" },
];

export default function SupplierOrderDetailsSidebar({
  activeSection,
  onSectionChange,
  summaryData,
}: SupplierOrderDetailsSidebarProps) {
  function getSectionSubtitle(section: SupplierOrderThreadSection): string {
    switch (section) {
      case "supplier": {
        const sup = summaryData.supplierName || "Dostawca";
        const amt =
          summaryData.netAmount && summaryData.netAmount > 0
            ? `${summaryData.netAmount.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} PLN`
            : "brak kwoty";
        return `${sup} • ${amt}`;
      }
      case "products":
        return summaryData.selectedProductsCount > 0
          ? `Wybrano: ${summaryData.selectedProductsCount}`
          : "Brak wybranych produktów";
      case "files":
        return summaryData.sentFilesCount > 0
          ? `Wysłanych: ${summaryData.sentFilesCount}`
          : "Brak wysłanych plików";
      case "correspondence":
        return `${summaryData.messagesCount} ${
          summaryData.messagesCount === 1 ? "wiadomość" : "wiadomości"
        }`;
    }
  }

  return (
    <div className="w-[280px] shrink-0 flex flex-col gap-3">
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-3 flex flex-col gap-1.5">
        <div className="px-2 pt-1 pb-2 border-b border-slate-100">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Szczegóły zamówienia
          </div>
          <div className="text-xs text-slate-500 mt-0.5 truncate">
            {summaryData.externalOrderNumber
              ? `Exalco #${summaryData.externalOrderNumber}`
              : summaryData.isExalcoSupplier
              ? "Zamówienie API"
              : "Zamówienie wewnętrzne"}
          </div>
        </div>

        <nav className="flex flex-col gap-1.5 mt-1" aria-label="Sekcje zamówienia">
          {SECTIONS.map((section) => {
            const isActive = activeSection === section.key;

            return (
              <button
                key={section.key}
                type="button"
                onClick={() => onSectionChange(section.key)}
                className={`w-full text-left rounded-xl px-3 py-2.5 border transition-all flex items-start gap-2.5 cursor-pointer ${
                  isActive
                    ? "bg-[var(--accent-soft)] border-[var(--accent-line)] shadow-2xs"
                    : "bg-white border-transparent hover:bg-slate-50 hover:border-slate-200"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 border ${
                    isActive
                      ? "bg-brand text-white border-brand"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  }`}
                >
                  {section.number}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-xs font-bold leading-snug ${
                      isActive ? "text-[#1c646a]" : "text-slate-800"
                    }`}
                  >
                    {section.title}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                    {getSectionSubtitle(section.key)}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
