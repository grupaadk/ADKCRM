"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import toast from "react-hot-toast";
import { CadCanvas, CadConstructionItem } from "./CadCanvas";
import { LeftPropertiesPanel } from "./LeftPropertiesPanel";
import { VerticalPositionsList } from "./VerticalPositionsList";
import { BottomTabsBar, ConstructionTemplate } from "./BottomTabsBar";
import { OfferSummaryTab, OfferData, OpportunityData } from "./OfferSummaryTab";
import { AddConstructionModal, SelectedConstructionEntry } from "./AddConstructionModal";
import { AllConstructionsCadView } from "./AllConstructionsCadView";
import {
  ArrowLeft,
  Check,
  Loader2,
  Printer,
  ChevronRight,
  Trash2,
} from "lucide-react";

interface CadWorkspaceProps {
  offerId: Id<"offers">;
  onBack?: () => void;
}

export function CadWorkspace({ offerId, onBack }: CadWorkspaceProps) {
  // Pobieranie oferty i pozycji z backendu
  const offerData = useQuery(api.offers.getOfferWithItems, { offerId });
  const rawTemplates = useQuery(api.constructions.list, { includeInactive: false });

  // Mutacje Convex
  const updateOffer = useMutation(api.offers.updateOffer);
  const addPosition = useMutation(api.offers.addConstructionPosition);
  const updatePosition = useMutation(api.offers.updateConstructionPosition);
  const reorderPositions = useMutation(api.offers.reorderConstructionPositions);
  const removePosition = useMutation(api.offers.removeConstructionPosition);
  const duplicatePosition = useMutation(api.offers.duplicateConstructionPosition);
  const ensureTriangle = useMutation(api.constructions.ensureTriangleConstruction);

  // Zapewnij istnienie kategorii i konstrukcji trójkąta
  React.useEffect(() => {
    ensureTriangle().catch(() => {});
  }, [ensureTriangle]);

  // Aktywna zakładka: 'offer', 'all-cad' lub ID pozycji
  const [activeTab, setActiveTab] = useState<"offer" | "all-cad" | string>("offer");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">("saved");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const generateOfferPdf = useAction(api.googleDrive.generateOfferPdf);

  const handlePrintPdf = async () => {
    setIsGeneratingPdf(true);
    const toastId = toast.loading("Generowanie oferty w PDF z szablonu Google Docs i zapis w Google Drive...");
    try {
      const result = await generateOfferPdf({ offerId });
      toast.success(
        "Oferta PDF została zapisana w folderze 'Oferty - wysłane do Klienta'!",
        { id: toastId, duration: 6000 }
      );
      if (result.pdfUrl) {
        window.open(result.pdfUrl, "_blank");
      }
    } catch (err: unknown) {
      console.error("[generateOfferPdf] error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Błąd generowania PDF: ${msg}`, { id: toastId, duration: 7000 });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const items: CadConstructionItem[] = useMemo(
    () => (offerData?.items as unknown as CadConstructionItem[]) || [],
    [offerData?.items]
  );
  const offer: OfferData | null = useMemo(
    () => (offerData?.offer as unknown as OfferData) || null,
    [offerData?.offer]
  );
  const opportunity: OpportunityData | null = useMemo(
    () => (offerData?.opportunity as unknown as OpportunityData) || null,
    [offerData?.opportunity]
  );
  const templates: ConstructionTemplate[] = useMemo(
    () => (rawTemplates as unknown as ConstructionTemplate[]) || [],
    [rawTemplates]
  );

  const effectiveActiveTab =
    activeTab !== "offer" &&
    activeTab !== "all-cad" &&
    items.length > 0 &&
    !items.some((it) => it._id === activeTab)
      ? items[0]._id
      : activeTab;

  const activeItem = items.find((it) => it._id === effectiveActiveTab) || null;

  const handleItemChange = async (patch: Partial<CadConstructionItem>) => {
    if (!activeItem) return;
    setSaveStatus("saving");
    try {
      await updatePosition({
        itemId: activeItem._id as Id<"offerConstructions">,
        name: patch.name,
        shortName: patch.shortName,
        description: patch.description,
        notes: patch.notes,
        warning: patch.warning,
        color: patch.color,
        systemName: patch.systemName,
        quantity: patch.quantity,
        widthMm: patch.widthMm,
        heightMm: patch.heightMm,
        panesCount: patch.panesCount,
        fillType: patch.fillType,
        priceNet: patch.priceNet,
        costNet: patch.costNet,
      });
      setSaveStatus("saved");
    } catch (err) {
      console.error("Błąd zapisu pozycji konstrukcji:", err);
      setSaveStatus("idle");
    }
  };

  const handleUpdatePositionPlacement = async (
    itemId: string,
    patch: { placedAboveItemId?: string | null; rowIndex?: number | null }
  ) => {
    try {
      await updatePosition({
        itemId: itemId as Id<"offerConstructions">,
        placedAboveItemId: patch.placedAboveItemId ?? (patch.placedAboveItemId === null ? null : undefined),
        rowIndex: patch.rowIndex ?? (patch.rowIndex === null ? null : undefined),
      });
    } catch (err) {
      console.error("Błąd aktualizacji położenia konstrukcji:", err);
    }
  };

  const handleReorderPositions = async (orderedItemIds: string[]) => {
    try {
      await reorderPositions({
        offerId,
        itemIds: orderedItemIds as Id<"offerConstructions">[],
      });
    } catch (err) {
      console.error("Błąd zmiany kolejności pozycji:", err);
    }
  };

  const handleUpdatePositionDimensions = async (
    itemId: string,
    patch: { widthMm?: number; heightMm?: number }
  ) => {
    setSaveStatus("saving");
    try {
      await updatePosition({
        itemId: itemId as Id<"offerConstructions">,
        widthMm: patch.widthMm,
        heightMm: patch.heightMm,
      });
      setSaveStatus("saved");
    } catch (err) {
      console.error("Błąd aktualizacji wymiarów konstrukcji:", err);
      setSaveStatus("idle");
    }
  };

  const handleOfferChange = async (patch: Partial<OfferData>) => {
    if (!offer) return;
    setSaveStatus("saving");
    try {
      await updateOffer({
        offerId,
        title: patch.title,
        status: patch.status,
        discountPercent: patch.discountPercent,
        notes: patch.notes,
        terms: patch.terms,
      });
      setSaveStatus("saved");
    } catch (err) {
      console.error("Błąd zapisu oferty:", err);
      setSaveStatus("idle");
    }
  };

  const handleAddConstruction = async (templateId?: string) => {
    setSaveStatus("saving");
    try {
      const newItemId = await addPosition({
        offerId,
        constructionId: templateId ? (templateId as Id<"constructions">) : undefined,
      });
      setActiveTab(newItemId);
      setSaveStatus("saved");
    } catch (err) {
      console.error("Błąd dodawania konstrukcji:", err);
      setSaveStatus("idle");
    }
  };

  const handleAddMultipleConstructions = async (entries: SelectedConstructionEntry[]) => {
    if (entries.length === 0) return;
    setSaveStatus("saving");
    try {
      let lastItemId: string | null = null;
      for (const entry of entries) {
        for (let i = 0; i < entry.quantity; i++) {
          const newItemId = await addPosition({
            offerId,
            constructionId: entry.templateId as Id<"constructions">,
          });
          lastItemId = newItemId;
        }
      }
      if (lastItemId && entries.length === 1 && entries[0].quantity === 1) {
        setActiveTab(lastItemId);
      }
      setSaveStatus("saved");
    } catch (err) {
      console.error("Błąd dodawania wielu konstrukcji:", err);
      setSaveStatus("idle");
    }
  };

  const handleDuplicate = async (itemId: string) => {
    setSaveStatus("saving");
    try {
      const newItemId = await duplicatePosition({
        itemId: itemId as Id<"offerConstructions">,
      });
      setActiveTab(newItemId);
      setSaveStatus("saved");
    } catch (err) {
      console.error("Błąd duplikowania pozycji:", err);
      setSaveStatus("idle");
    }
  };

  const handleDelete = (itemId: string) => {
    setItemToDelete(itemId);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    setSaveStatus("saving");
    try {
      await removePosition({
        itemId: itemToDelete as Id<"offerConstructions">,
      });
      if (activeTab === itemToDelete) {
        setActiveTab("offer");
      }
      setSaveStatus("saved");
      setItemToDelete(null);
    } catch (err) {
      console.error("Błąd usuwania pozycji:", err);
      setSaveStatus("idle");
    } finally {
      setIsDeleting(false);
    }
  };

  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else if (opportunity) {
      router.push(`/admin/szansa/${opportunity._id}`);
    } else {
      router.push("/admin/oferta");
    }
  };

  if (!offerData || !offer) {
    return (
      <div className="h-full flex items-center justify-center bg-[#f6f7f9] text-slate-500">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-[#4ABBC3]" size={30} />
          <span className="text-xs font-medium">Ładowanie konfiguratora CAD...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#f6f7f9] text-[#1f2937] overflow-hidden">
      {/* ── Top Header bar dopasowany do ADK CRM ── */}
      <header className="h-12 bg-white border-b border-[#e3e7ee] px-4 flex items-center justify-between z-30 shrink-0 shadow-xs">
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={handleBack}
            className="text-[#4b5563] hover:text-[#0b1220] font-medium flex items-center gap-1.5 transition-colors cursor-pointer px-2 py-1 -ml-1 rounded hover:bg-slate-100"
            title="Wróć do poprzedniej strony / widoku"
          >
            <ArrowLeft size={13} />
            <span>Wróć</span>
          </button>

          <ChevronRight size={13} className="text-slate-300" />

          {/* Numer oferty z kolorem brandowym ADK */}
          <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-[rgba(74,187,195,0.12)] text-[#0e7490] border border-[rgba(74,187,195,0.3)]">
            {offer.offerNumber}
          </span>

          <span className="font-semibold text-xs text-[#0b1220] truncate max-w-[200px] md:max-w-md">
            {offer.title}
          </span>
        </div>

        {/* Status i akcje po prawej */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#7c8597]">
            {saveStatus === "saving" ? (
              <>
                <Loader2 size={12} className="animate-spin text-[#4ABBC3]" />
                <span className="text-[#4ABBC3] hidden sm:inline">Zapisywanie...</span>
              </>
            ) : (
              <>
                <Check size={12} className="text-[#10b981]" />
                <span className="text-[#7c8597] hidden sm:inline">Zapisano</span>
              </>
            )}
          </div>

          <button
            type="button"
            disabled={isGeneratingPdf}
            onClick={handlePrintPdf}
            title="Drukuj ofertę / Pobierz PDF z Google Drive"
            className="btn icon disabled:opacity-60 cursor-pointer"
            style={{ padding: "4px 8px", fontSize: 11.5 }}
          >
            {isGeneratingPdf ? (
              <Loader2 size={13} className="animate-spin text-[#4ABBC3]" />
            ) : (
              <Printer size={13} />
            )}
            <span className="hidden sm:inline">
              {isGeneratingPdf ? "Generowanie..." : "Drukuj / PDF"}
            </span>
          </button>
        </div>
      </header>

      {/* ── Main Workspace Body ── */}
      <div className="flex-1 flex overflow-hidden">
        {effectiveActiveTab === "all-cad" ? (
          <AllConstructionsCadView
            offer={offer}
            items={items}
            opportunity={opportunity}
            onSelectPosition={(itemId) => setActiveTab(itemId)}
            onBackToOffer={() => setActiveTab("offer")}
            onAddNewPosition={() => setIsAddModalOpen(true)}
            onUpdatePlacement={handleUpdatePositionPlacement}
            onReorderPositions={handleReorderPositions}
            onUpdateDimensions={handleUpdatePositionDimensions}
          />
        ) : effectiveActiveTab === "offer" || !activeItem ? (
          <OfferSummaryTab
            offer={offer}
            items={items}
            opportunity={opportunity}
            onUpdateOffer={handleOfferChange}
            onOpenPositionInCad={(itemId) => setActiveTab(itemId)}
            onOpenAllInCad={() => setActiveTab("all-cad")}
            onDuplicatePosition={handleDuplicate}
            onDeletePosition={handleDelete}
            onAddNewPosition={() => setIsAddModalOpen(true)}
          />
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* Lewy panel parametrów */}
            <LeftPropertiesPanel
              item={activeItem}
              onChange={handleItemChange}
            />

            {/* Centralny widok CAD */}
            <CadCanvas item={activeItem} onChange={handleItemChange} />

            {/* Prawy panel pozycji z miniaturami */}
            <VerticalPositionsList
              items={items}
              activeItemId={activeItem._id}
              onSelectItem={(id) => setActiveTab(id)}
              onDuplicateItem={handleDuplicate}
              onDeleteItem={handleDelete}
              onAddNew={() => setIsAddModalOpen(true)}
            />
          </div>
        )}
      </div>

      {/* ── Dolny pasek zakładek ── */}
      <BottomTabsBar
        activeTab={effectiveActiveTab}
        items={items}
        templates={templates}
        onSelectTab={(tab) => setActiveTab(tab)}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onAddConstruction={handleAddConstruction}
      />

      {/* Modal wyboru szablonu konstrukcji */}
      <AddConstructionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        templates={templates}
        onSelectTemplate={handleAddConstruction}
        onSelectMultipleTemplates={handleAddMultipleConstructions}
      />

      {/* Dyskretny natywny potykacz potwierdzenia usunięcia */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-[#0b1220]/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full border border-[#e3e7ee] p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-[#fee2e2] text-[#dc2626] shrink-0">
                <Trash2 size={18} />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[#0b1220]">
                  Usunąć konstrukcję z oferty?
                </h4>
                <p className="text-xs text-[#7c8597] leading-relaxed">
                  Ta pozycja ({items.find((it) => it._id === itemToDelete)?.name || "konstrukcja"}) oraz jej rysunek CAD zostaną wycofane z oferty.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#f1f5f9]">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setItemToDelete(null)}
                className="px-3 py-1.5 rounded-md text-xs font-semibold text-[#4b5563] hover:text-[#0b1220] hover:bg-[#f3f5f8] transition-colors cursor-pointer"
              >
                Anuluj
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-3.5 py-1.5 rounded-md text-xs font-semibold bg-[#dc2626] hover:bg-[#b91c1c] text-white transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Usuwanie...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={13} />
                    <span>Usuń pozycję</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
