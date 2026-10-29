"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import toast from "react-hot-toast";
import { CadConstructionItem } from "./CadCanvas";
import { uploadCadSnapshotsForOffer } from "./cadSvgRenderer";
import { isGlassSystemConstruction, checkIsStandard } from "@/lib/glassPricing";
import {
  FileText,
  Calculator,
  User,
  MapPin,
  Phone,
  Mail,
  Printer,
  Loader2,
  ExternalLink,
  Edit,
  Trash2,
  Copy,
  Plus,
  Layers,
  RefreshCw,
  Check,
  X,
  TrendingUp,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Heading3,
  Undo2,
  Redo2,
  RemoveFormatting,
  Code,
  Eye,
} from "lucide-react";

const PRESET_DISCOUNTS = [0, 3, 5, 7, 10, 15, 20];
const PRESET_VAT_RATES = [23, 8, 5, 0];

export interface OfferData {
  _id: string;
  opportunityId: string;
  offerNumber: string;
  title: string;
  status: "draft" | "sent" | "accepted" | "rejected";
  totalPriceNet: number;
  totalPriceGross: number;
  totalCostNet: number;
  discountPercent?: number;
  vatRate?: number;
  serviceId?: string;
  serviceName?: string;
  templateFileId?: string;
  notes?: string;
  terms?: string;
  /** URL ostatnio wygenerowanego PDF-u (Google Drive) */
  lastPdfUrl?: string;
  createdAt: number;
  updatedAt: number;
}

export interface OpportunityData {
  _id: string;
  firstName?: string;
  lastName?: string;
  clientName?: string;
  phone?: string;
  email?: string;
  street?: string;
  buildingNumber?: string;
  city?: string;
  postalCode?: string;
  investmentStreet?: string;
  investmentBuildingNumber?: string;
  investmentCity?: string;
  investmentPostalCode?: string;
  submissionId?: string;
}

interface OfferSummaryTabProps {
  offer: OfferData;
  items: CadConstructionItem[];
  opportunity?: OpportunityData | null;
  onUpdateOffer: (patch: Partial<OfferData>) => void;
  onOpenPositionInCad: (itemId: string) => void;
  onOpenAllInCad?: () => void;
  onDuplicatePosition: (itemId: string) => void;
  onDeletePosition: (itemId: string) => void;
  onAddNewPosition: () => void;
  onUpdateDimensions?: (
    itemId: string,
    patch: { widthMm?: number; heightMm?: number }
  ) => void;
  readOnly?: boolean;
}

interface InlineDimensionCellProps {
  itemId: string;
  widthMm: number;
  heightMm: number;
  panesCount: number;
  readOnly?: boolean;
  onUpdateDimensions?: (
    itemId: string,
    patch: { widthMm?: number; heightMm?: number }
  ) => void;
}

function InlineDimensionCell({
  itemId,
  widthMm,
  heightMm,
  panesCount,
  readOnly,
  onUpdateDimensions,
}: InlineDimensionCellProps) {
  const [wStr, setWStr] = useState(String(widthMm));
  const [hStr, setHStr] = useState(String(heightMm));
  const [isSavedRecently, setIsSavedRecently] = useState(false);

  useEffect(() => {
    setWStr(String(widthMm));
  }, [widthMm]);

  useEffect(() => {
    setHStr(String(heightMm));
  }, [heightMm]);

  const commit = () => {
    if (!onUpdateDimensions || readOnly) return;
    const w = parseInt(wStr, 10);
    const h = parseInt(hStr, 10);

    const validW = !isNaN(w) && w >= 200 && w <= 20000 ? w : widthMm;
    const validH = !isNaN(h) && h >= 200 && h <= 10000 ? h : heightMm;

    setWStr(String(validW));
    setHStr(String(validH));

    if (validW !== widthMm || validH !== heightMm) {
      onUpdateDimensions(itemId, { widthMm: validW, heightMm: validH });
      setIsSavedRecently(true);
      setTimeout(() => setIsSavedRecently(false), 1500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === "Escape") {
      setWStr(String(widthMm));
      setHStr(String(heightMm));
      (e.target as HTMLInputElement).blur();
    }
  };

  if (readOnly || !onUpdateDimensions) {
    return (
      <td className="py-3 px-4 text-center">
        <div className="font-mono font-bold text-xs text-[#0b1220]">
          {widthMm} × {heightMm} mm
        </div>
        <div className="text-[10px] text-[#64748b] mt-0.5">
          System {panesCount}-torowy
        </div>
      </td>
    );
  }

  return (
    <td
      className="py-3 px-4 text-center"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="inline-flex items-center justify-center gap-1">
        {/* Szerokość B */}
        <div className="relative group/w">
          <input
            type="number"
            min={200}
            max={20000}
            step={10}
            value={wStr}
            onChange={(e) => setWStr(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            title="Szerokość B (mm) — naciśnij Enter lub kliknij obok, aby zapisać"
            className="w-16 h-7 text-center font-mono font-bold text-xs text-[#0b1220] bg-white border border-[#cbd5e1] hover:border-[#4ABBC3] focus:border-[#0e7490] focus:ring-2 focus:ring-[#0e7490]/20 rounded transition-all focus:outline-none shadow-2xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        <span className="font-bold text-[#64748b] text-xs select-none">×</span>

        {/* Wysokość H */}
        <div className="relative group/h">
          <input
            type="number"
            min={200}
            max={10000}
            step={10}
            value={hStr}
            onChange={(e) => setHStr(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            title="Wysokość H (mm) — naciśnij Enter lub kliknij obok, aby zapisać"
            className="w-16 h-7 text-center font-mono font-bold text-xs text-[#0b1220] bg-white border border-[#cbd5e1] hover:border-[#4ABBC3] focus:border-[#0e7490] focus:ring-2 focus:ring-[#0e7490]/20 rounded transition-all focus:outline-none shadow-2xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        <span className="text-[11px] font-mono text-[#64748b] select-none pl-0.5">
          mm
        </span>
      </div>

      <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#64748b] mt-0.5">
        <span>System {panesCount}-torowy</span>
        {isSavedRecently && (
          <span className="inline-flex items-center gap-0.5 text-emerald-600 font-semibold text-[9px] animate-pulse">
            <Check size={10} />
            <span>Zapisano</span>
          </span>
        )}
      </div>
    </td>
  );
}

export function OfferSummaryTab({
  offer,
  items,
  opportunity,
  onUpdateOffer,
  onOpenPositionInCad,
  onOpenAllInCad,
  onDuplicatePosition,
  onDeletePosition,
  onAddNewPosition,
  onUpdateDimensions,
  readOnly = false,
}: OfferSummaryTabProps) {
  const router = useRouter();
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(offer.title);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  const [notes, setNotes] = useState(offer.notes || "");
  const [prevOfferNotes, setPrevOfferNotes] = useState(offer.notes || "");
  const [notesMode, setNotesMode] = useState<"wysiwyg" | "html">("wysiwyg");
  const notesEditorRef = useRef<HTMLDivElement>(null);

  if ((offer.notes || "") !== prevOfferNotes) {
    setPrevOfferNotes(offer.notes || "");
    setNotes(offer.notes || "");
  }

  // Synchronizacja treści contentEditable przy zewnętrznych zmianach lub zmianie trybu
  useEffect(() => {
    if (notesEditorRef.current && notesMode === "wysiwyg") {
      if (notesEditorRef.current.innerHTML !== notes) {
        notesEditorRef.current.innerHTML = notes;
      }
    }
  }, [notes, notesMode]);

  const handleNotesBlur = () => {
    if (notes !== (offer.notes || "")) {
      onUpdateOffer({ notes });
    }
  };

  const execNotesCommand = (command: string, value: string | undefined = undefined) => {
    if (readOnly) return;
    if (notesMode !== "wysiwyg") {
      setNotesMode("wysiwyg");
      setTimeout(() => {
        notesEditorRef.current?.focus();
        document.execCommand(command, false, value);
        if (notesEditorRef.current) {
          const html = notesEditorRef.current.innerHTML;
          const clean = html === "<p><br></p>" || html === "<br>" ? "" : html;
          setNotes(clean);
        }
      }, 50);
      return;
    }
    notesEditorRef.current?.focus();
    document.execCommand(command, false, value);
    if (notesEditorRef.current) {
      const html = notesEditorRef.current.innerHTML;
      const clean = html === "<p><br></p>" || html === "<br>" ? "" : html;
      setNotes(clean);
    }
  };
  const generateOfferPdf = useAction(api.googleDrive.generateOfferPdf);
  const duplicateOffer = useMutation(api.offers.duplicateOffer);
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const syncWithTemplates = useMutation(api.offers.syncOfferWithConstructionTemplates);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncWithTemplates = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    const toastId = toast.loading("Pobieranie aktualnych cen z bazy szablonów...");
    try {
      const res = await syncWithTemplates({
        offerId: offer._id as Id<"offers">,
      });
      toast.success(
        res.updatedCount > 0
          ? `Pomyślnie zsynchronizowano ${res.updatedCount} pozycji z szablonami!`
          : "Wszystkie pozycje są już zgodne z bazą szablonów.",
        { id: toastId }
      );
    } catch (err: unknown) {
      console.error("[syncWithTemplates] error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Błąd synchronizacji: ${msg}`, { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDuplicateOffer = async () => {
    if (isDuplicating) return;
    setIsDuplicating(true);
    const toastId = toast.loading("Tworzenie nowego wariantu oferty...");
    try {
      const newOfferId = await duplicateOffer({
        offerId: offer._id as Id<"offers">,
      });
      toast.success("Utworzono nowy wariant oferty!", { id: toastId });
      router.push(`/admin/oferta?offerId=${newOfferId}`);
    } catch (err: unknown) {
      console.error("[duplicateOffer] error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Błąd tworzenia wariantu: ${msg}`, { id: toastId });
    } finally {
      setIsDuplicating(false);
    }
  };

  const handlePrintPdf = async () => {
    setIsGeneratingPdf(true);
    const toastId = toast.loading("Przygotowywanie szkiców CAD i generowanie oferty PDF...");
    try {
      // 1. Wygeneruj zrzuty PNG ze szkiców CAD konstrukcji (jeśli są)
      let itemsCadImages: Array<{ positionIndex: number; imageUrl: string }> | undefined;
      try {
        if (items.length > 0) {
          itemsCadImages = await uploadCadSnapshotsForOffer(items, generateUploadUrl);
        }
      } catch (cadErr) {
        console.warn("[handlePrintPdf] Ostrzeżenie przy generowaniu zrzutów CAD:", cadErr);
      }

      // 2. Wywołaj akcję generowania oferty PDF z szablonu Google Docs (lub Slides wg usługi)
      const result = await generateOfferPdf({
        offerId: offer._id as Id<"offers">,
        itemsCadImages,
      });
      toast.success(
        "Oferta PDF została wygenerowana i zapisana w folderze 'Oferty - wysłane do Klienta'!",
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

  // Financial calculations
  const rawSumNet = items.reduce(
    (acc, it) => acc + (it.priceNet || 0) * (it.quantity || 1),
    0
  );
  const rawCostNet = items.reduce(
    (acc, it) => acc + (it.costNet || 0) * (it.quantity || 1),
    0
  );
  const totalQuantity = items.reduce((acc, it) => acc + (it.quantity || 1), 0);

  // Kalkulacja filarów całości oferty: Materiał i Montaż
  const totalMaterialCost = items.reduce((acc, it) => {
    const q = it.quantity || 1;
    const cost = it.materialCostNet !== undefined && it.materialCostNet !== null ? it.materialCostNet : (it.costNet || 0);
    return acc + cost * q;
  }, 0);

  const totalInstallationCost = items.reduce((acc, it) => {
    const q = it.quantity || 1;
    const cost = it.installationCostNet !== undefined && it.installationCostNet !== null ? it.installationCostNet : 0;
    return acc + cost * q;
  }, 0);

  const totalInstallationPrice = items.reduce((acc, it) => {
    const q = it.quantity || 1;
    const price = it.installationPriceNet !== undefined && it.installationPriceNet !== null ? it.installationPriceNet : 0;
    return acc + price * q;
  }, 0);

  const totalMaterialPrice = items.reduce((acc, it) => {
    const q = it.quantity || 1;
    if (it.materialPriceNet !== undefined && it.materialPriceNet !== null) {
      return acc + it.materialPriceNet * q;
    }
    const inst = (it.installationPriceNet || 0) * q;
    return acc + Math.max(0, (it.priceNet || 0) * q - inst);
  }, 0);

  const totalCombinedCost = totalMaterialCost + totalInstallationCost;
  const matProfit = totalMaterialPrice - totalMaterialCost;
  const matMarginPct = totalMaterialPrice > 0 ? Math.round((matProfit / totalMaterialPrice) * 100) : 0;
  const instProfit = totalInstallationPrice - totalInstallationCost;
  const instMarginPct = totalInstallationPrice > 0 ? Math.round((instProfit / totalInstallationPrice) * 100) : 0;

  const discountPct = offer.discountPercent || 0;
  const [prevDiscountPct, setPrevDiscountPct] = useState(discountPct);
  const [customDiscount, setCustomDiscount] = useState<string>(String(discountPct));

  if (discountPct !== prevDiscountPct) {
    setPrevDiscountPct(discountPct);
    setCustomDiscount(String(discountPct));
  }

  const vatRate = offer.vatRate ?? 23;
  const [prevVatRate, setPrevVatRate] = useState(vatRate);
  const [customVatRate, setCustomVatRate] = useState<string>(String(vatRate));

  if (vatRate !== prevVatRate) {
    setPrevVatRate(vatRate);
    setCustomVatRate(String(vatRate));
  }

  const discountedNet = Math.round(rawSumNet * (1 - discountPct / 100));
  const discountAmount = rawSumNet - discountedNet;
  const vatAmount = Math.round((discountedNet * vatRate) / 100);
  const totalGross = discountedNet + vatAmount;
  const profitNet = discountedNet - rawCostNet;
  const marginPct =
    discountedNet > 0 ? Math.round((profitNet / discountedNet) * 100) : 0;

  const clientName =
    [opportunity?.firstName, opportunity?.lastName].filter(Boolean).join(" ") ||
    opportunity?.clientName ||
    "Klient";

  const investAddress = [
    opportunity?.investmentStreet || opportunity?.street,
    opportunity?.investmentBuildingNumber || opportunity?.buildingNumber,
    opportunity?.investmentPostalCode || opportunity?.postalCode,
    opportunity?.investmentCity || opportunity?.city,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="flex-1 overflow-y-auto bg-[#f4f6f9] text-[#1f2937] p-4 md:p-6 space-y-4">
      {/* ── 1. ZINTEGROWANY KONTENER NAGŁÓWKOWY + ADNOTACJA KLIENTA + FINANSE ── */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs overflow-hidden">
        {/* Top Row: Offer Identity, Compact Client Annotation & Actions */}
        <div className="px-5 py-4 border-b border-[#e2e8f0] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            {/* Offer Number + Editable Title */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-[#f0fdff] text-[#0e7490] border border-[#a5f3fc] shrink-0">
                {offer.offerNumber}
              </span>

              {editingTitle && !readOnly ? (
                <div className="flex items-center gap-1.5 flex-1 max-w-md">
                  <input
                    type="text"
                    autoFocus
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        onUpdateOffer({ title: tempTitle });
                        setEditingTitle(false);
                      }
                      if (e.key === "Escape") {
                        setEditingTitle(false);
                      }
                    }}
                    className="w-full bg-white border border-[#4ABBC3] rounded-md px-2.5 py-1 text-[#0b1220] font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#4ABBC3]/20"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateOffer({ title: tempTitle });
                      setEditingTitle(false);
                    }}
                    className="p-1.5 rounded-md bg-[#0e7490] text-white hover:bg-[#0c637b] transition-colors"
                    title="Zapisz tytuł"
                  >
                    <Check size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTitle(false)}
                    className="p-1.5 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                    title="Anuluj"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 min-w-0">
                  <h1 className="text-base md:text-lg font-bold text-[#0b1220] truncate">
                    {offer.title}
                  </h1>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => {
                        setTempTitle(offer.title);
                        setEditingTitle(true);
                      }}
                      className="p-1 text-[#94a3b8] hover:text-[#0e7490] rounded hover:bg-slate-100 transition-colors shrink-0"
                      title="Zmień tytuł oferty"
                    >
                      <Edit size={13} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Compact Client & Investment Annotation Line */}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#64748b]">
              {opportunity && (
                <>
                  <span className="inline-flex items-center gap-1 font-semibold text-[#334155]">
                    <User size={12} className="text-[#4ABBC3] shrink-0" />
                    <span>{clientName}</span>
                  </span>

                  {opportunity.phone && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="inline-flex items-center gap-1 font-mono">
                        <Phone size={11} className="text-[#94a3b8] shrink-0" />
                        <span>{opportunity.phone}</span>
                      </span>
                    </>
                  )}

                  {opportunity.email && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Mail size={11} className="text-[#94a3b8] shrink-0" />
                        <span>{opportunity.email}</span>
                      </span>
                    </>
                  )}

                  {investAddress && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="inline-flex items-center gap-1 text-[#475569]">
                        <MapPin size={11} className="text-[#4ABBC3] shrink-0" />
                        <span>{investAddress}</span>
                      </span>
                    </>
                  )}
                  <span className="text-slate-300">·</span>
                </>
              )}

              <span>
                Utworzono:{" "}
                <strong className="font-mono font-medium text-[#475569]">
                  {new Date(offer.createdAt).toLocaleDateString("pl-PL")}
                </strong>
              </span>
              <span className="text-slate-300">·</span>
              <span>
                Zmiana:{" "}
                <strong className="font-mono font-medium text-[#475569]">
                  {new Date(offer.updatedAt).toLocaleTimeString("pl-PL", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </strong>
              </span>
            </div>
          </div>

          {/* Right side: Quick Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onOpenAllInCad && (
              <button
                type="button"
                onClick={onOpenAllInCad}
                disabled={items.length === 0}
                className={`btn font-semibold transition-all ${
                  items.length > 0
                    ? "bg-[#0b1220] hover:bg-[#1e293b] text-white border border-[#0b1220] shadow-xs cursor-pointer"
                    : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                }`}
                style={{ padding: "6px 12px", fontSize: 11.5 }}
                title="Otwórz widok wszystkich konstrukcji w ofercie na wspólnym arkuszu CAD"
              >
                <Layers size={13} className={items.length > 0 ? "text-[#4ABBC3]" : "text-slate-400"} />
                <span>Widok zbiorczy CAD</span>
                {items.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-[#4ABBC3]/20 text-[#4ABBC3]">
                    {items.length}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              disabled={isGeneratingPdf}
              onClick={handlePrintPdf}
              className="btn bg-white hover:bg-slate-50 text-[#334155] border border-[#cbd5e1] disabled:opacity-60 cursor-pointer"
              style={{ padding: "6px 11px", fontSize: 11.5 }}
              title="Wygeneruj ofertę w PDF (szablon Google Docs) i zapisz w folderze 'Oferty - wysłane do Klienta'"
            >
              {isGeneratingPdf ? (
                <Loader2 size={13} className="animate-spin text-[#4ABBC3]" />
              ) : (
                <Printer size={13} />
              )}
              <span>{isGeneratingPdf ? "Generowanie..." : "Drukuj / PDF"}</span>
            </button>

            <button
              type="button"
              disabled={isDuplicating}
              onClick={handleDuplicateOffer}
              className="btn bg-white hover:bg-slate-50 text-[#334155] border border-[#cbd5e1] disabled:opacity-60 cursor-pointer"
              style={{ padding: "6px 11px", fontSize: 11.5 }}
              title="Sklonuj całą tę ofertę ze wszystkimi pozycjami jako kolejny wariant dla tej samej szansy"
            >
              {isDuplicating ? (
                <Loader2 size={13} className="animate-spin text-[#4ABBC3]" />
              ) : (
                <Copy size={13} className="text-[#0e7490]" />
              )}
              <span>{isDuplicating ? "Duplikowanie..." : "Duplikuj jako wariant"}</span>
            </button>

            {opportunity?._id && (
              <Link
                href={`/admin/szansa/${opportunity._id}`}
                className="btn bg-[#f0fdff] hover:bg-[#e0f9fe] text-[#0e7490] border border-[#a5f3fc] font-semibold"
                style={{ padding: "6px 11px", fontSize: 11.5, textDecoration: "none" }}
                title="Przejdź do widoku szansy sprzedaży"
              >
                <span>Szansa sprzedaży</span>
                <ExternalLink size={12} />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. WYKAZ KONSTRUKCJI W OFERCIE ── */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8fafc]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-[rgba(74,187,195,0.12)] text-[#0e7490] border border-[rgba(74,187,195,0.25)]">
              <Layers size={15} className="text-[#4ABBC3]" />
            </div>
            <div>
              <h2 className="font-bold text-xs text-[#0b1220] uppercase tracking-wider">
                Wykaz konstrukcji w ofercie ({items.length})
              </h2>
              <p className="text-[11px] text-[#64748b]">
                Kliknij wybraną pozycję, aby przejść do jej rysunku technicznego w edytorze CAD
              </p>
            </div>
          </div>

          {!readOnly && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSyncWithTemplates}
                disabled={isSyncing}
                title="Pobierz aktualne ceny materiału i montażu z bazy szablonów konstrukcji"
                className="btn secondary"
                style={{ padding: "6px 12px", fontSize: 12 }}
              >
                {isSyncing ? (
                  <Loader2 size={13} className="animate-spin text-[#0e7490]" />
                ) : (
                  <RefreshCw size={13} className="text-[#0e7490]" />
                )}
                <span>{isSyncing ? "Synchronizacja..." : "Zsynchronizuj z szablonami"}</span>
              </button>
              <button
                type="button"
                onClick={onAddNewPosition}
                className="btn primary"
                style={{ padding: "6px 14px", fontSize: 12 }}
              >
                <Plus size={14} strokeWidth={2.5} />
                <span>Dodaj konstrukcję</span>
              </button>
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <div className="py-14 px-4 text-center space-y-3">
            <div className="w-11 h-11 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <FileText size={20} />
            </div>
            <div>
              <p className="font-bold text-xs text-[#0b1220]">
                Brak dodanych konstrukcji w tej ofercie
              </p>
              <p className="text-[11px] text-[#64748b] mt-0.5">
                Wybierz gotową konstrukcję z bazy (np. system szklany) i dostosuj jej wymiary w CAD.
              </p>
            </div>
            {!readOnly && (
              <button
                type="button"
                onClick={onAddNewPosition}
                className="btn primary"
                style={{ padding: "7px 16px", fontSize: 12 }}
              >
                <Plus size={14} />
                <span>Wybierz konstrukcję z bazy</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="py-2.5 px-4 w-14 text-center">Poz.</th>
                  <th className="py-2.5 px-4 w-32 text-center">Rysunek CAD</th>
                  <th className="py-2.5 px-4">Specyfikacja konstrukcji</th>
                  <th className="py-2.5 px-4 text-center">Wymiary (W × H)</th>
                  <th className="py-2.5 px-4 text-center">Ilość</th>
                  <th className="py-2.5 px-4 text-right">Cena jedn. netto</th>
                  <th className="py-2.5 px-4 text-right">Wartość netto</th>
                  <th className="py-2.5 px-4 text-right w-36">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const unitPrice = it.priceNet || 0;
                  const qty = it.quantity || 1;
                  const totalLinePrice = unitPrice * qty;
                  const panes = Math.max(1, it.panesCount || 3);

                  return (
                    <tr
                      key={it._id}
                      onClick={() => onOpenPositionInCad(it._id)}
                      className="cursor-pointer hover:bg-[#f8fafc] transition-colors group"
                    >
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-slate-100 group-hover:bg-[#e0f9fe] font-mono font-bold text-xs text-[#0e7490] transition-colors">
                          {it.positionIndex}
                        </span>
                      </td>

                        {/* Technical CAD Miniature */}
                        <td className="py-3 px-4 text-center">
                          <div
                            className="w-24 h-14 mx-auto bg-white rounded border border-[#cbd5e1] group-hover:border-[#4ABBC3] flex items-center justify-center p-1 transition-colors shadow-2xs"
                            title="Otwórz pozycję w edytorze CAD"
                          >
                            {(() => {
                              const isTriangle =
                                it.name.toLowerCase().includes("trójką") ||
                                Boolean(
                                  it.shortName &&
                                    it.shortName.toLowerCase().includes("trójką")
                                ) ||
                                Boolean(
                                  it.systemName &&
                                    (it.systemName.toLowerCase().includes("krokiew") ||
                                      it.systemName.toLowerCase().includes("profil h"))
                                );

                              const isTriangleRight =
                                isTriangle &&
                                ((it.name || "").toLowerCase().includes("praw") ||
                                  Boolean(
                                    it.shortName &&
                                      it.shortName.toLowerCase().includes("praw")
                                  ));

                              return (
                                <svg
                                  viewBox="0 0 140 70"
                                  className="w-full h-full"
                                  preserveAspectRatio="xMidYMid meet"
                                >
                                  {isTriangle ? (
                                    <g>
                                      {/* Czerwony obrys trójkąta */}
                                      <polygon
                                        points={isTriangleRight ? "5,52 135,9 135,65 5,65" : "5,9 135,52 135,65 5,65"}
                                        fill="none"
                                        stroke="#dc2626"
                                        strokeWidth="1"
                                      />
                                      {/* Dolny profil H */}
                                      <rect
                                        x="6"
                                        y="58"
                                        width="128"
                                        height="6"
                                        fill="#29323d"
                                        stroke="#1e242b"
                                        strokeWidth="0.5"
                                      />
                                      <text
                                        x="70"
                                        y="62.5"
                                        fill="#ffffff"
                                        fontSize="3.8"
                                        fontWeight="900"
                                        textAnchor="middle"
                                        letterSpacing="1px"
                                      >
                                        PROFIL H
                                      </text>
                                      {/* Słup przyścienny (wysoki bok) */}
                                      <rect
                                        x={isTriangleRight ? "128" : "6"}
                                        y="15"
                                        width="6"
                                        height="43"
                                        fill="#29323d"
                                        stroke="#1e242b"
                                        strokeWidth="0.5"
                                      />
                                      {/* Belka skośna */}
                                      <polygon
                                        points={isTriangleRight ? "134,10 6,53 6,58 134,15" : "6,10 134,53 134,58 6,15"}
                                        fill="#29323d"
                                        stroke="#1e242b"
                                        strokeWidth="0.8"
                                      />
                                      {/* Podkrokiew / listwa montażowa */}
                                      <polygon
                                        points={isTriangleRight ? "134,15 6,58 128,18" : "6,15 134,58 12,18"}
                                        fill="#29323d"
                                        stroke="#1e242b"
                                        strokeWidth="0.5"
                                      />
                                      {/* Szkło */}
                                      <polygon
                                        points={isTriangleRight ? "126,21 16,56 126,56" : "14,21 124,56 14,56"}
                                        fill="#ffffff"
                                        stroke="#38bdf8"
                                        strokeWidth="0.8"
                                      />
                                      <text
                                        x={isTriangleRight ? "95" : "45"}
                                        y="48"
                                        fill="#0b1220"
                                        fontSize="6.5"
                                        fontWeight="800"
                                        textAnchor="middle"
                                      >
                                        {it.fillType || "HART 10"}
                                      </text>
                                    </g>
                                  ) : (
                                    <>
                                      <rect
                                        x="2"
                                        y="2"
                                        width="136"
                                        height="66"
                                        fill="none"
                                        stroke="#dc2626"
                                        strokeWidth="1"
                                      />
                                      <rect
                                        x="3"
                                        y="3"
                                        width="134"
                                        height="64"
                                        fill="#29323d"
                                        stroke="#1e242b"
                                        strokeWidth="1"
                                      />
                                      <rect
                                        x="7"
                                        y="7"
                                        width="126"
                                        height="56"
                                        fill="#ffffff"
                                      />
                                      {Array.from({ length: panes }).map((_, i) => {
                                        const pw = 126 / panes;
                                        const px = 7 + i * pw;
                                        return (
                                          <g key={i}>
                                            <rect
                                              x={px + 0.5}
                                              y="7.5"
                                              width={pw - 1}
                                              height="55"
                                              fill="#ffffff"
                                              stroke="#e2e8f0"
                                              strokeWidth="0.5"
                                            />
                                            {i > 0 && (
                                              <line
                                                x1={px}
                                                y1="7"
                                                x2={px}
                                                y2="63"
                                                stroke="#dc2626"
                                                strokeWidth="1"
                                              />
                                            )}
                                          </g>
                                        );
                                      })}
                                    </>
                                  )}
                                </svg>
                              );
                            })()}
                          </div>
                        </td>

                      {/* Name, Color, Glass */}
                      <td className="py-3 px-4">
                        {(() => {
                          const isGlass = isGlassSystemConstruction({
                            name: it.name,
                            shortName: it.shortName,
                            systemName: it.systemName,
                            fillType: it.fillType,
                          });
                          const standardInfo = isGlass
                            ? checkIsStandard(
                                Math.round(it.widthMm / 10),
                                Math.round(it.heightMm / 10)
                              )
                            : null;

                          return (
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-[#0b1220] group-hover:text-[#0e7490] transition-colors text-xs md:text-sm">
                                {it.name}
                              </span>
                              {standardInfo && (
                                standardInfo.isStandard ? (
                                  <span
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs"
                                    title="Wymiar standardowy (wysokość ze skokiem co 5 cm, szerokość modułowa)"
                                  >
                                    <Check size={10} strokeWidth={2.5} />
                                    STANDARD
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200/80 shadow-2xs"
                                    title={standardInfo.reason || "Wymiar niestandardowy (wyliczony wg kalkulatora szkła)"}
                                  >
                                    NIESTANDARD {standardInfo.standardWidthCm ? `(${standardInfo.standardWidthCm})` : ""}
                                  </span>
                                )
                              )}
                            </div>
                          );
                        })()}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[#64748b] mt-1">
                          {it.systemName ? (
                            <span>
                              System:{" "}
                              <strong className="text-[#1f2937]">
                                {it.systemName}
                              </strong>
                            </span>
                          ) : null}
                          <span>
                            Kolor:{" "}
                            <strong className="text-[#334155] font-mono">
                              {it.color || "RAL 7016MAT"}
                            </strong>
                          </span>
                          <span>
                            Wypełnienie:{" "}
                            <strong className="text-[#0e7490] font-mono">
                              {it.fillType || "HART 10"}
                            </strong>
                          </span>
                        </div>
                      </td>

                      {/* Dimensions (Inline Editable) */}
                      <InlineDimensionCell
                        itemId={it._id}
                        widthMm={it.widthMm}
                        heightMm={it.heightMm}
                        panesCount={panes}
                        readOnly={readOnly}
                        onUpdateDimensions={onUpdateDimensions}
                      />

                      {/* Quantity */}
                      <td className="py-3 px-4 text-center font-mono font-bold text-xs text-[#0b1220]">
                        {qty} szt.
                      </td>

                      {/* Unit Price */}
                      <td className="py-3 px-4 text-right font-mono text-xs text-[#475569]">
                        {unitPrice.toLocaleString("pl-PL")} zł
                      </td>

                      {/* Total Net */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-xs md:text-sm text-[#0b1220]">
                        {totalLinePrice.toLocaleString("pl-PL")} zł
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenPositionInCad(it._id)}
                            title="Otwórz w edytorze CAD"
                            className="btn icon font-semibold"
                            style={{
                              padding: "4px 9px",
                              fontSize: 11,
                              color: "#0e7490",
                              borderColor: "#a5f3fc",
                              background: "#f0fdff",
                            }}
                          >
                            CAD
                          </button>
                          {!readOnly && (
                            <>
                              <button
                                type="button"
                                onClick={() => onDuplicatePosition(it._id)}
                                title="Duplikuj pozycję"
                                className="btn icon"
                                style={{ padding: "4px 6px" }}
                              >
                                <Copy size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeletePosition(it._id)}
                                title="Usuń pozycję"
                                className="btn icon"
                                style={{
                                  padding: "4px 6px",
                                  color: "#dc2626",
                                  borderColor: "#fca5a5",
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Table Summary Footer */}
              <tfoot>
                <tr className="bg-[#f8fafc] border-t-2 border-[#e2e8f0] font-mono text-xs">
                  <td colSpan={4} className="py-3 px-4 text-right font-sans font-bold text-[#475569]">
                    Razem ({items.length} {items.length === 1 ? "pozycja" : "pozycje"}):
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-[#0b1220]">
                    {totalQuantity} szt.
                  </td>
                  <td className="py-3 px-4 text-right text-[#64748b]">
                    {discountPct > 0 ? `Rabat -${discountPct}%:` : "Suma netto:"}
                  </td>
                  <td className="py-3 px-4 text-right font-extrabold text-sm text-[#0e7490]">
                    {discountedNet.toLocaleString("pl-PL")} zł
                  </td>
                  <td className="py-3 px-4 text-right text-[11px] text-[#64748b]">
                    brutto ({vatRate}%): {totalGross.toLocaleString("pl-PL")} zł
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── 3. PODSUMOWANIE OFERTY (WG SZKICU) ── */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8fafc]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-[rgba(74,187,195,0.12)] text-[#0e7490] border border-[rgba(74,187,195,0.25)]">
              <Calculator size={15} className="text-[#4ABBC3]" />
            </div>
            <div>
              <h2 className="font-bold text-xs text-[#0b1220] uppercase tracking-wider">
                Podsumowanie oferty
              </h2>
              <p className="text-[11px] text-[#64748b]">
                Kalkulacja cen katalogowych, rabat handlowy, VAT i rentowność
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-full border ${
                marginPct >= 20
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : marginPct >= 10
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              Marża całkowita: {marginPct}%
            </span>
          </div>
        </div>

        {/* Content: 2 Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#e2e8f0]">
          {/* LEWA KOLUMNA: Konstrukcje, Montaż, Razem (z kosztami) */}
          <div className="p-5 flex flex-col justify-between space-y-4 bg-white">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748b] border-b border-[#f1f5f9] pb-2">
              Koszty bazowe i ceny katalogowe
            </div>

            <div className="space-y-3.5">
              {/* 1. Konstrukcje (Cena katalogowa) */}
              <div className="p-3.5 rounded-lg bg-[#fafbfd] border border-[#f1f5f9] flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-[#0b1220]">
                    KONSTRUKCJE <span className="text-[10px] font-normal text-[#64748b]">(Cena katalogowa)</span>
                  </div>
                  <div className="text-[11px] text-[#64748b] font-mono mt-1">
                    koszta = <strong className="text-[#475569]">{totalMaterialCost.toLocaleString("pl-PL")} zł</strong>
                    {totalMaterialPrice > 0 && (
                      <span className="ml-2 text-[10px] text-emerald-600 font-semibold">
                        (marża {matMarginPct}%)
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-extrabold font-mono text-[#0b1220]">
                    {totalMaterialPrice.toLocaleString("pl-PL")} zł
                  </div>
                  <div className="text-[10px] text-[#94a3b8]">netto</div>
                </div>
              </div>

              {/* 2. Montaż */}
              <div className="p-3.5 rounded-lg bg-[#fafbfd] border border-[#f1f5f9] flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-[#0b1220] flex items-center gap-1">
                    <span className="text-[#4ABBC3] font-black">+</span>
                    <span>MONTAŻ</span>
                  </div>
                  <div className="text-[11px] text-[#64748b] font-mono mt-1">
                    koszta = <strong className="text-[#475569]">{totalInstallationCost.toLocaleString("pl-PL")} zł</strong>
                    {totalInstallationPrice > 0 && (
                      <span className="ml-2 text-[10px] text-emerald-600 font-semibold">
                        (marża {instMarginPct}%)
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-extrabold font-mono text-[#0b1220]">
                    {totalInstallationPrice.toLocaleString("pl-PL")} zł
                  </div>
                  <div className="text-[10px] text-[#94a3b8]">netto</div>
                </div>
              </div>

              {/* 3. Razem (suma bazowa) */}
              <div className="p-3.5 rounded-lg bg-[#f0f9ff]/60 border border-[#bae6fd]/60 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-extrabold text-[#0369a1] uppercase tracking-wider">
                    RAZEM <span className="text-[10px] font-normal lowercase tracking-normal text-[#0284c7]">(suma bazowa netto)</span>
                  </div>
                  <div className="text-[11px] text-[#0369a1] font-mono mt-1">
                    koszta łączne = <strong className="text-[#0c4a6e]">{totalCombinedCost.toLocaleString("pl-PL")} zł</strong>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black font-mono text-[#0369a1]">
                    {rawSumNet.toLocaleString("pl-PL")} zł
                  </div>
                  <div className="text-[10px] text-[#0284c7]">katalogowo netto</div>
                </div>
              </div>
            </div>

            <div className="text-[10px] text-[#94a3b8] italic pt-1">
              * Koszty własne obejmują zakup materiałów, profili, okuć oraz robociznę ekip montażowych.
            </div>
          </div>

          {/* PRAWA KOLUMNA: Rabat -> Cena po rabacie -> VAT -> Wartość brutto -> Zysk */}
          <div className="p-5 flex flex-col justify-between space-y-4 bg-[#fafbfd]">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748b] border-b border-[#e2e8f0] pb-2">
              Kalkulacja końcowa i podatki
            </div>

            <div className="space-y-3.5">
              {/* - RABAT */}
              <div className="bg-white p-3 rounded-lg border border-[#e2e8f0]">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-[#0b1220] flex items-center gap-1">
                    <span className="text-amber-500 font-bold">-</span>
                    <span>RABAT</span>
                  </span>
                  <span className="text-xs font-mono">
                    Upust:{" "}
                    <strong className={discountAmount > 0 ? "text-amber-600" : "text-[#64748b]"}>
                      {discountAmount > 0 ? `-${discountAmount.toLocaleString("pl-PL")} zł` : "0 zł"}
                    </strong>
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1 flex-wrap">
                    {PRESET_DISCOUNTS.map((preset) => {
                      const isActive = discountPct === preset;
                      return (
                        <button
                          key={preset}
                          type="button"
                          disabled={readOnly}
                          onClick={() => {
                            setCustomDiscount(String(preset));
                            onUpdateOffer({ discountPercent: preset });
                          }}
                          className={`px-2 py-0.5 text-[11px] font-mono font-semibold rounded border transition-all cursor-pointer ${
                            isActive
                              ? "bg-[#0e7490] text-white border-[#0e7490]"
                              : "bg-[#f8fafc] text-[#475569] border-[#cbd5e1] hover:border-[#4ABBC3] hover:text-[#0e7490]"
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {preset}%
                        </button>
                      );
                    })}
                  </div>

                  <div className="inline-flex items-center gap-1 ml-auto">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      disabled={readOnly}
                      value={customDiscount}
                      onChange={(e) => {
                        const text = e.target.value;
                        setCustomDiscount(text);
                        if (text.trim() === "") {
                          onUpdateOffer({ discountPercent: 0 });
                          return;
                        }
                        const val = parseFloat(text);
                        if (!isNaN(val) && val >= 0 && val <= 100) {
                          onUpdateOffer({
                            discountPercent: Math.round(val * 10) / 10,
                          });
                        }
                      }}
                      className={`w-14 bg-white border rounded px-2 py-0.5 text-[#0b1220] font-mono font-bold text-[11px] text-right focus:outline-none transition-colors ${
                        !PRESET_DISCOUNTS.includes(discountPct)
                          ? "border-[#0e7490] ring-1 ring-[#0e7490]/30"
                          : "border-[#cbd5e1] focus:border-[#4ABBC3]"
                      }`}
                      placeholder="Inny"
                      title="Własny procent rabatu"
                    />
                    <span className="text-[11px] font-mono font-bold text-[#64748b]">
                      %
                    </span>
                  </div>
                </div>
              </div>

              {/* = Cena po rabacie (Netto) */}
              <div className="p-3 rounded-lg bg-white border border-[#e2e8f0] flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-[#0b1220] flex items-center gap-1">
                    <span className="text-[#0e7490] font-black">=</span>
                    <span>Cena po rabacie (Netto)</span>
                  </div>
                  <div className="text-[10px] text-[#64748b] mt-0.5">
                    {discountPct > 0 ? `Zastosowano upust handlowy ${discountPct}%` : "Brak rabatu"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-extrabold font-mono text-[#0e7490]">
                    {discountedNet.toLocaleString("pl-PL")} zł
                  </div>
                </div>
              </div>

              {/* + Stawka VAT */}
              <div className="bg-white p-3 rounded-lg border border-[#e2e8f0]">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-[#0b1220] flex items-center gap-1">
                    <span className="text-[#0e7490] font-bold">+</span>
                    <span>Stawka VAT</span>
                  </span>
                  <span className="text-xs font-mono">
                    Kwota VAT:{" "}
                    <strong className="text-[#0b1220]">
                      {vatAmount.toLocaleString("pl-PL")} zł
                    </strong>
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1 flex-wrap">
                    {PRESET_VAT_RATES.map((rate) => {
                      const isActive = vatRate === rate;
                      return (
                        <button
                          key={rate}
                          type="button"
                          disabled={readOnly}
                          onClick={() => {
                            setCustomVatRate(String(rate));
                            onUpdateOffer({ vatRate: rate });
                          }}
                          className={`px-2 py-0.5 text-[11px] font-mono font-semibold rounded border transition-all cursor-pointer ${
                            isActive
                              ? "bg-[#0e7490] text-white border-[#0e7490]"
                              : "bg-[#f8fafc] text-[#475569] border-[#cbd5e1] hover:border-[#4ABBC3] hover:text-[#0e7490]"
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {rate}%
                        </button>
                      );
                    })}
                  </div>

                  <div className="inline-flex items-center gap-1 ml-auto">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      disabled={readOnly}
                      value={customVatRate}
                      onChange={(e) => {
                        const text = e.target.value;
                        setCustomVatRate(text);
                        if (text.trim() === "") {
                          onUpdateOffer({ vatRate: 23 });
                          return;
                        }
                        const val = parseFloat(text);
                        if (!isNaN(val) && val >= 0 && val <= 100) {
                          onUpdateOffer({
                            vatRate: Math.round(val * 10) / 10,
                          });
                        }
                      }}
                      className={`w-14 bg-white border rounded px-2 py-0.5 text-[#0b1220] font-mono font-bold text-[11px] text-right focus:outline-none transition-colors ${
                        !PRESET_VAT_RATES.includes(vatRate)
                          ? "border-[#0e7490] ring-1 ring-[#0e7490]/30"
                          : "border-[#cbd5e1] focus:border-[#4ABBC3]"
                      }`}
                      placeholder="Inna"
                      title="Własna stawka VAT (%)"
                    />
                    <span className="text-[11px] font-mono font-bold text-[#64748b]">
                      %
                    </span>
                  </div>
                </div>
              </div>

              {/* = Wartość brutto */}
              <div className="p-3.5 rounded-lg bg-slate-900 text-white flex items-center justify-between gap-3 shadow-xs">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1">
                    <span className="text-[#4ABBC3] font-black">=</span>
                    <span>Wartość brutto ({vatRate}%)</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Do zapłaty przez Klienta
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black font-mono text-white">
                    {totalGross.toLocaleString("pl-PL")} zł
                  </div>
                </div>
              </div>

              {/* Szacowany zysk i marża */}
              <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className={profitNet >= 0 ? "text-emerald-600" : "text-rose-600"} />
                  <div>
                    <div className="text-xs font-bold text-slate-800">
                      Szacowany zysk
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Po uwzględnieniu rabatu i wszystkich kosztów
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                      profitNet >= 0
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-rose-100 text-rose-800 border border-rose-300"
                    }`}
                  >
                    marża {marginPct}%
                  </span>
                  <div
                    className={`text-base font-black font-mono ${
                      profitNet >= 0 ? "text-emerald-700" : "text-rose-600"
                    }`}
                  >
                    {profitNet >= 0 ? `+${profitNet.toLocaleString("pl-PL")} zł` : `${profitNet.toLocaleString("pl-PL")} zł`}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. USTALENIA (WYSIWYG / HTML) ── */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#e2e8f0] flex items-center justify-between flex-wrap gap-3 bg-[#f8fafc]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-[rgba(74,187,195,0.12)] text-[#0e7490] border border-[rgba(74,187,195,0.25)]">
              <FileText size={15} className="text-[#4ABBC3]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-xs text-[#0b1220] uppercase tracking-wider">
                  Ustalenia
                </h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-100/70 text-[#0e7490] border border-teal-200/50">
                  WYSIWYG HTML
                </span>
              </div>
              <p className="text-[11px] text-[#64748b]">
                Ustalenia do oferty i wytyczne montażowe
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Przełącznik trybu: Wizualny / Kod HTML */}
            <div className="inline-flex items-center p-0.5 bg-slate-200/70 border border-slate-300/70 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setNotesMode("wysiwyg")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  notesMode === "wysiwyg"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Edytor wizualny (WYSIWYG)"
              >
                <Eye size={12} />
                <span>Wizualny</span>
              </button>
              <button
                type="button"
                onClick={() => setNotesMode("html")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  notesMode === "html"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Edycja bezpośredniego kodu HTML"
              >
                <Code size={12} />
                <span>Kod HTML</span>
              </button>
            </div>

            {!readOnly && notes !== (offer.notes || "") && (
              <button
                type="button"
                onClick={() => onUpdateOffer({ notes })}
                className="px-3 py-1 rounded-md bg-[#0e7490] hover:bg-[#0c637b] text-white font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <Check size={13} />
                <span>Zapisz ustalenia</span>
              </button>
            )}
          </div>
        </div>

        {/* Toolbar formatowania tekstu */}
        {!readOnly && (
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center flex-wrap gap-1 text-slate-700">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                execNotesCommand("bold");
              }}
              disabled={notesMode !== "wysiwyg"}
              className="p-1.5 hover:bg-white rounded hover:shadow-2xs text-slate-700 disabled:opacity-35 disabled:hover:bg-transparent transition-colors cursor-pointer"
              title="Pogrubienie (Ctrl+B)"
            >
              <Bold size={14} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                execNotesCommand("italic");
              }}
              disabled={notesMode !== "wysiwyg"}
              className="p-1.5 hover:bg-white rounded hover:shadow-2xs text-slate-700 disabled:opacity-35 disabled:hover:bg-transparent transition-colors cursor-pointer"
              title="Kursywa (Ctrl+I)"
            >
              <Italic size={14} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                execNotesCommand("underline");
              }}
              disabled={notesMode !== "wysiwyg"}
              className="p-1.5 hover:bg-white rounded hover:shadow-2xs text-slate-700 disabled:opacity-35 disabled:hover:bg-transparent transition-colors cursor-pointer"
              title="Podkreślenie (Ctrl+U)"
            >
              <Underline size={14} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                execNotesCommand("strikeThrough");
              }}
              disabled={notesMode !== "wysiwyg"}
              className="p-1.5 hover:bg-white rounded hover:shadow-2xs text-slate-700 disabled:opacity-35 disabled:hover:bg-transparent transition-colors cursor-pointer"
              title="Przekreślenie"
            >
              <Strikethrough size={14} />
            </button>

            <div className="w-[1px] h-4 bg-slate-300 mx-1" />

            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                execNotesCommand("formatBlock", "<h3>");
              }}
              disabled={notesMode !== "wysiwyg"}
              className="px-2 py-1 hover:bg-white rounded hover:shadow-2xs text-xs font-bold text-slate-700 disabled:opacity-35 disabled:hover:bg-transparent transition-colors flex items-center gap-0.5 cursor-pointer"
              title="Średni nagłówek (H3)"
            >
              <Heading3 size={14} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                execNotesCommand("formatBlock", "<p>");
              }}
              disabled={notesMode !== "wysiwyg"}
              className="px-2 py-1 hover:bg-white rounded hover:shadow-2xs text-xs font-medium text-slate-700 disabled:opacity-35 disabled:hover:bg-transparent transition-colors cursor-pointer"
              title="Zwykły akapit (P)"
            >
              Akapit
            </button>

            <div className="w-[1px] h-4 bg-slate-300 mx-1" />

            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                execNotesCommand("insertUnorderedList");
              }}
              disabled={notesMode !== "wysiwyg"}
              className="p-1.5 hover:bg-white rounded hover:shadow-2xs text-slate-700 disabled:opacity-35 disabled:hover:bg-transparent transition-colors cursor-pointer"
              title="Lista punktowana"
            >
              <List size={14} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                execNotesCommand("insertOrderedList");
              }}
              disabled={notesMode !== "wysiwyg"}
              className="p-1.5 hover:bg-white rounded hover:shadow-2xs text-slate-700 disabled:opacity-35 disabled:hover:bg-transparent transition-colors cursor-pointer"
              title="Lista numerowana"
            >
              <ListOrdered size={14} />
            </button>

            <div className="w-[1px] h-4 bg-slate-300 mx-1" />

            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                execNotesCommand("removeFormat");
              }}
              disabled={notesMode !== "wysiwyg"}
              className="p-1.5 hover:bg-white rounded hover:shadow-2xs text-slate-700 disabled:opacity-35 disabled:hover:bg-transparent transition-colors cursor-pointer"
              title="Wyczyść formatowanie"
            >
              <RemoveFormatting size={14} />
            </button>

            <div className="w-[1px] h-4 bg-slate-300 mx-1" />

            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                execNotesCommand("undo");
              }}
              disabled={notesMode !== "wysiwyg"}
              className="p-1.5 hover:bg-white rounded hover:shadow-2xs text-slate-700 disabled:opacity-35 disabled:hover:bg-transparent transition-colors cursor-pointer"
              title="Cofnij (Ctrl+Z)"
            >
              <Undo2 size={14} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                execNotesCommand("redo");
              }}
              disabled={notesMode !== "wysiwyg"}
              className="p-1.5 hover:bg-white rounded hover:shadow-2xs text-slate-700 disabled:opacity-35 disabled:hover:bg-transparent transition-colors cursor-pointer"
              title="Ponów (Ctrl+Y)"
            >
              <Redo2 size={14} />
            </button>

            {notesMode === "html" && (
              <span className="ml-auto text-[11px] text-amber-700 font-medium">
                Tryb edycji kodu HTML (możesz wpisywać tagi np. &lt;p&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;strong&gt;)
              </span>
            )}
          </div>
        )}

        <div className="p-4 sm:p-5">
          {notesMode === "wysiwyg" ? (
            <div className="relative border border-[#cbd5e1] focus-within:border-[#4ABBC3] focus-within:ring-2 focus-within:ring-[#4ABBC3]/20 rounded-lg bg-[#f8fafc] focus-within:bg-white hover:bg-white transition-all">
              <div
                ref={notesEditorRef}
                contentEditable={!readOnly}
                suppressContentEditableWarning
                onInput={(e) => {
                  const html = e.currentTarget.innerHTML;
                  if (html === "<p><br></p>" || html === "<br>" || html.trim() === "") {
                    setNotes("");
                  } else {
                    setNotes(html);
                  }
                }}
                onBlur={handleNotesBlur}
                className="w-full min-h-[160px] max-h-[380px] overflow-y-auto p-3.5 text-xs text-[#0b1220] focus:outline-none leading-relaxed font-sans prose prose-sm max-w-none [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-[#0b1220] [&_h3]:mt-2 [&_h3]:mb-1 [&_strong]:font-semibold [&_strong]:text-[#0b1220] [&_em]:italic [&_u]:underline [&_s]:line-through"
              />
              {!notes && (
                <div
                  onClick={() => notesEditorRef.current?.focus()}
                  className="absolute top-3.5 left-3.5 text-xs text-[#94a3b8] pointer-events-none select-none"
                >
                  Wpisz ustalenia do oferty (np. zakres prac i montażu, wytyczne techniczne, termin realizacji, ustalenia z inwestorem)...
                </div>
              )}
            </div>
          ) : (
            <div className="border border-slate-700 rounded-lg overflow-hidden focus-within:border-[#4ABBC3] focus-within:ring-2 focus-within:ring-[#4ABBC3]/20">
              <textarea
                rows={7}
                disabled={readOnly}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleNotesBlur}
                placeholder="<p>Wpisz ustalenia w formacie HTML...</p>"
                className="w-full bg-[#0f172a] text-[#e2e8f0] font-mono text-xs p-3.5 focus:outline-none resize-y leading-relaxed border-0 min-h-[160px]"
                spellCheck={false}
              />
            </div>
          )}

          <div className="flex items-center justify-between mt-2.5 text-[11px] text-[#64748b]">
            <span>
              Ustalenia zostaną automatycznie zapisane po opuszczeniu pola lub po kliknięciu &quot;Zapisz ustalenia&quot;.
            </span>
            {notes ? (
              <span className="font-mono text-[10px] text-slate-400">
                {notes.length} znaków HTML
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
