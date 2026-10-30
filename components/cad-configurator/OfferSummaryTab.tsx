"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import toast from "react-hot-toast";
import { CadConstructionItem } from "./CadCanvas";
import { uploadCadSnapshotsForOffer } from "./cadSvgRenderer";
import { isGlassSystemConstruction, checkIsStandard, calculateGlassSystemPricing } from "@/lib/glassPricing";
import {
  FileText,
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
  PackagePlus,
  Sparkles,
  Search,
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

export interface OfferAdditionItem {
  _id: string;
  offerId: string;
  name: string;
  description?: string;
  targetConstructionId?: string;
  sourceTemplateId?: string;
  quantity: number;
  unit: string;
  priceNet: number;
  costNet?: number;
  installationPriceNet?: number;
  installationCostNet?: number;
  orderIndex?: number;
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
  additions?: OfferAdditionItem[];
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
  isTriangle?: boolean;
  hasTracks?: boolean;
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
  isTriangle,
  hasTracks,
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
        {!isTriangle && hasTracks !== false && panesCount > 1 && (
          <div className="text-[10px] text-[#64748b] mt-0.5">
            System {panesCount}-torowy
          </div>
        )}
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
        {!isTriangle && hasTracks !== false && panesCount > 1 && (
          <span>System {panesCount}-torowy</span>
        )}
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

interface InlineAdditionRowProps {
  addition: OfferAdditionItem;
  readOnly?: boolean;
  onUpdate: (id: Id<"offerAdditions">, patch: Partial<OfferAdditionItem>) => Promise<void>;
  onRemove: (id: Id<"offerAdditions">) => Promise<void>;
}

function InlineAdditionRow({
  addition,
  readOnly,
  onUpdate,
  onRemove,
}: InlineAdditionRowProps) {
  const [name, setName] = useState(addition.name);
  const [qtyStr, setQtyStr] = useState(String(addition.quantity));
  const [priceStr, setPriceStr] = useState(String(addition.priceNet));
  const [instPriceStr, setInstPriceStr] = useState(String(addition.installationPriceNet ?? 0));
  const [unit, setUnit] = useState(addition.unit || "szt.");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [prevSynced, setPrevSynced] = useState({
    name: addition.name,
    quantity: addition.quantity,
    priceNet: addition.priceNet,
    installationPriceNet: addition.installationPriceNet ?? 0,
    unit: addition.unit || "szt.",
  });

  const currentInstPrice = addition.installationPriceNet ?? 0;
  const currentUnit = addition.unit || "szt.";

  const hasExternallyChanged =
    prevSynced.name !== addition.name ||
    prevSynced.quantity !== addition.quantity ||
    prevSynced.priceNet !== addition.priceNet ||
    prevSynced.installationPriceNet !== currentInstPrice ||
    prevSynced.unit !== currentUnit;

  if (hasExternallyChanged) {
    setPrevSynced({
      name: addition.name,
      quantity: addition.quantity,
      priceNet: addition.priceNet,
      installationPriceNet: currentInstPrice,
      unit: currentUnit,
    });
    if (focusedField !== "name") setName(addition.name);
    if (focusedField !== "qty") setQtyStr(String(addition.quantity));
    if (focusedField !== "price") setPriceStr(String(addition.priceNet));
    if (focusedField !== "instPrice") setInstPriceStr(String(currentInstPrice));
    setUnit(currentUnit);
  }

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const performSave = async (patch: Partial<OfferAdditionItem>) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setSaveState("saving");
    try {
      await onUpdate(addition._id as Id<"offerAdditions">, patch);
      setPrevSynced((prev) => ({
        ...prev,
        ...patch,
        installationPriceNet: patch.installationPriceNet ?? prev.installationPriceNet,
        unit: patch.unit ?? prev.unit,
      }));
      setSaveState("saved");
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        setSaveState("idle");
      }, 2500);
    } catch (err) {
      console.error("Błąd zapisu dodatku:", err);
      setSaveState("idle");
    }
  };

  const scheduleSave = (patch: Partial<OfferAdditionItem>) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setSaveState("saving");
    debounceTimerRef.current = setTimeout(() => {
      performSave(patch);
    }, 450);
  };

  const commitName = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(addition.name);
      return;
    }
    if (trimmed !== prevSynced.name) {
      performSave({ name: trimmed });
    }
  };

  const commitQty = () => {
    const val = parseFloat(qtyStr);
    if (isNaN(val) || val <= 0) {
      setQtyStr(String(addition.quantity));
      return;
    }
    if (val !== prevSynced.quantity) {
      performSave({ quantity: val });
    }
  };

  const commitPrice = () => {
    const val = parseFloat(priceStr);
    if (isNaN(val) || val < 0) {
      setPriceStr(String(addition.priceNet));
      return;
    }
    if (val !== prevSynced.priceNet) {
      performSave({ priceNet: val });
    }
  };

  const commitInstPrice = () => {
    const val = parseFloat(instPriceStr);
    const valid = isNaN(val) || val < 0 ? 0 : val;
    if (valid !== prevSynced.installationPriceNet) {
      performSave({ installationPriceNet: valid });
    }
  };

  const handleUnitChange = (newUnit: string) => {
    setUnit(newUnit);
    performSave({ unit: newUnit });
  };

  const parsedQty = parseFloat(qtyStr) || addition.quantity || 1;
  const parsedPrice = parseFloat(priceStr) || addition.priceNet || 0;
  const totalLineNet = Math.round(parsedQty * parsedPrice);

  return (
    <tr className="hover:bg-[#f8fafc] transition-colors border-b border-slate-100 last:border-b-0 text-xs">
      {/* Kolumna 1: Lp */}
      <td className="py-2.5 px-3 text-center text-[#64748b] font-mono text-[11px]">
        {addition.orderIndex !== undefined ? addition.orderIndex + 1 : "—"}
      </td>

      {/* Kolumna 2: Nazwa dodatku */}
      <td className="py-2.5 px-3">
        {readOnly ? (
          <span className="font-semibold text-[#0b1220]">{addition.name}</span>
        ) : (
          <input
            type="text"
            value={name}
            onFocus={() => setFocusedField("name")}
            onChange={(e) => {
              const v = e.target.value;
              setName(v);
              if (v.trim()) scheduleSave({ name: v.trim() });
            }}
            onBlur={() => {
              setFocusedField(null);
              commitName();
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            placeholder="Nazwa dodatku (np. Zamek, Pilot, Transport)..."
            className="w-full font-semibold text-[#0b1220] bg-transparent hover:bg-slate-50 focus:bg-white border border-transparent hover:border-slate-300 focus:border-[#4ABBC3] rounded px-2 py-1 outline-none transition-all placeholder:font-normal placeholder:text-slate-400"
          />
        )}
      </td>

      {/* Kolumna 3: Ilość */}
      <td className="py-2.5 px-3 text-center">
        {readOnly ? (
          <span className="font-mono font-bold text-[#0b1220]">{addition.quantity}</span>
        ) : (
          <input
            type="number"
            min={0.1}
            step={1}
            value={qtyStr}
            onFocus={() => setFocusedField("qty")}
            onChange={(e) => {
              const v = e.target.value;
              setQtyStr(v);
              const num = parseFloat(v);
              if (!isNaN(num) && num > 0) scheduleSave({ quantity: num });
            }}
            onBlur={() => {
              setFocusedField(null);
              commitQty();
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="w-16 text-center font-mono font-bold text-[#0b1220] bg-white border border-slate-200 hover:border-slate-300 focus:border-[#4ABBC3] rounded px-1.5 py-1 outline-none transition-all"
          />
        )}
      </td>

      {/* Kolumna 5: Jednostka */}
      <td className="py-2.5 px-3 text-center">
        {readOnly ? (
          <span className="text-[#64748b] font-mono text-[11px]">{addition.unit}</span>
        ) : (
          <select
            value={unit}
            onChange={(e) => handleUnitChange(e.target.value)}
            className="text-xs font-mono text-[#475569] bg-white border border-slate-200 hover:border-slate-300 focus:border-[#4ABBC3] rounded px-1.5 py-1 outline-none transition-all cursor-pointer"
          >
            <option value="szt.">szt.</option>
            <option value="mb">mb</option>
            <option value="kpl.">kpl.</option>
            <option value="m²">m²</option>
            <option value="usł.">usł.</option>
          </select>
        )}
      </td>

      {/* Kolumna 6: Cena jedn. netto */}
      <td className="py-2.5 px-3 text-right">
        {readOnly ? (
          <span className="font-mono text-[#334155]">{addition.priceNet.toLocaleString("pl-PL")} zł</span>
        ) : (
          <div className="inline-flex items-center gap-1 justify-end">
            <input
              type="number"
              min={0}
              step={1}
              value={priceStr}
              onFocus={() => setFocusedField("price")}
              onChange={(e) => {
                const v = e.target.value;
                setPriceStr(v);
                const num = parseFloat(v);
                if (!isNaN(num) && num >= 0) scheduleSave({ priceNet: num });
              }}
              onBlur={() => {
                setFocusedField(null);
                commitPrice();
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="w-20 text-right font-mono text-xs text-[#0b1220] bg-white border border-slate-200 hover:border-slate-300 focus:border-[#4ABBC3] rounded px-1.5 py-1 outline-none transition-all"
            />
            <span className="text-slate-400 font-mono text-[10px]">zł</span>
          </div>
        )}
      </td>

      {/* Kolumna 7: Wartość netto */}
      <td className="py-2.5 px-3 text-right font-mono font-bold text-xs text-[#0b1220]">
        {totalLineNet.toLocaleString("pl-PL")} zł
      </td>

      {/* Kolumna 8: Montaż netto */}
      <td className="py-2.5 px-3 text-right">
        {readOnly ? (
          <span className="font-mono text-xs text-slate-500">
            {addition.installationPriceNet ? `${(addition.installationPriceNet * addition.quantity).toLocaleString("pl-PL")} zł` : "—"}
          </span>
        ) : (
          <div className="inline-flex items-center gap-1 justify-end">
            <input
              type="number"
              min={0}
              step={1}
              value={instPriceStr}
              onFocus={() => setFocusedField("instPrice")}
              onChange={(e) => {
                const v = e.target.value;
                setInstPriceStr(v);
                const num = parseFloat(v);
                if (!isNaN(num) && num >= 0) scheduleSave({ installationPriceNet: num });
              }}
              onBlur={() => {
                setFocusedField(null);
                commitInstPrice();
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              placeholder="0"
              className="w-16 text-right font-mono text-xs text-[#0b1220] bg-white border border-slate-200 hover:border-slate-300 focus:border-[#4ABBC3] rounded px-1.5 py-1 outline-none transition-all placeholder:text-slate-300"
            />
            <span className="text-slate-400 font-mono text-[10px]">zł</span>
          </div>
        )}
      </td>

      {/* Kolumna 9: Akcje i status zapisu */}
      <td className="py-2.5 px-3 text-right">
        <div className="flex items-center justify-end gap-1.5">
          {saveState === "saving" && (
            <span
              className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-medium animate-pulse"
              title="Zapisywanie zmian..."
            >
              <Loader2 size={11} className="animate-spin" />
            </span>
          )}
          {saveState === "saved" && (
            <span
              className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 font-semibold"
              title="Wszystkie zmiany zostały pomyślnie zapisane"
            >
              <Check size={12} />
              <span className="hidden sm:inline text-[9px]">Zapisano</span>
            </span>
          )}
          {!readOnly && (
            <button
              type="button"
              onClick={() => onRemove(addition._id as Id<"offerAdditions">)}
              title="Usuń dodatek z oferty"
              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export function OfferSummaryTab({
  offer,
  items,
  additions = [],
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

  // Automatyczne uzdrowienie archiwalnych pozycji szkła z błędnym montażem 1373 zł lub nieaktualną ceną materiału (np. 10 213 zł zamiast 11 626 zł)
  useEffect(() => {
    const hasStaleGlass = items.some((it) => {
      if (!isGlassSystemConstruction(it) || !it.widthMm || !it.heightMm) return false;
      if (it.installationPriceNet === 1373 || it.installationPriceNet === 3093) return true;
      const std = checkIsStandard(Math.round(it.widthMm / 10), Math.round(it.heightMm / 10));
      if (!std.isStandard && (it.materialPriceNet === 8626 || it.priceNet === 10213)) return true;
      return false;
    });
    if (hasStaleGlass && !isSyncing) {
      syncWithTemplates({ offerId: offer._id as Id<"offers"> }).catch(() => {});
    }
  }, [items, offer._id, syncWithTemplates, isSyncing]);

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

  const addOfferAddition = useMutation(api.offers.addOfferAddition);
  const updateOfferAddition = useMutation(api.offers.updateOfferAddition);
  const removeOfferAddition = useMutation(api.offers.removeOfferAddition);
  const catalogTemplates = useQuery(api.offerAdditionTemplates.list, { activeOnly: true });
  const seedDefaultTemplates = useMutation(api.offerAdditionTemplates.seedDefaultsIfEmpty);

  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");

  const handleAddCustomAddition = async () => {
    try {
      await addOfferAddition({
        offerId: offer._id as Id<"offers">,
        name: "Nowy dodatek",
        quantity: 1,
        unit: "szt.",
        priceNet: 0,
      });
      toast.success("Dodano nową pozycję dodatku");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Błąd: ${msg}`);
    }
  };

  const handleAddFromTemplate = async (tpl: Doc<"offerAdditionTemplates">) => {
    try {
      await addOfferAddition({
        offerId: offer._id as Id<"offers">,
        sourceTemplateId: tpl._id,
        name: tpl.name,
        description: tpl.description,
        quantity: 1,
        unit: tpl.unit,
        priceNet: tpl.defaultPriceNet,
        costNet: tpl.defaultCostNet,
        installationPriceNet: tpl.defaultInstallationPriceNet,
        installationCostNet: tpl.defaultInstallationCostNet,
      });
      toast.success(`Dodano: ${tpl.name}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Błąd: ${msg}`);
    }
  };

  const handlePrintPdf = async () => {
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    // Krótka chwila na ukończenie ewentualnych mutacji w toku (np. z debounced zapisu dodatków)
    await new Promise((r) => setTimeout(r, 250));

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
  const totalQuantity = items.reduce((acc, it) => acc + (it.quantity || 1), 0);

  // Kalkulacja filarów całości oferty: Materiał i Montaż
  const totalMaterialCost = items.reduce((acc, it) => {
    const q = it.quantity || 1;
    const baseCost =
      it.materialCostNet !== undefined && it.materialCostNet !== null
        ? it.materialCostNet
        : it.costNet || 0;
    const brushes = it.brushesCostNet || 0;
    const handles = it.handlesCostNet || 0;
    return acc + (baseCost + brushes + handles) * q;
  }, 0);

  const totalInstallationCost = items.reduce((acc, it) => {
    const q = it.quantity || 1;
    const cost = it.installationCostNet !== undefined && it.installationCostNet !== null ? it.installationCostNet : 0;
    return acc + cost * q;
  }, 0);

  const totalInstallationPrice = items.reduce((acc, it) => {
    const q = it.quantity || 1;
    let price =
      it.installationPriceNet !== undefined && it.installationPriceNet !== null
        ? it.installationPriceNet
        : 0;
    if (price === 1373 && isGlassSystemConstruction(it)) {
      price = 1587;
    }
    return acc + price * q;
  }, 0);

  const totalMaterialPrice = items.reduce((acc, it) => {
    const q = it.quantity || 1;
    if (isGlassSystemConstruction(it) && it.widthMm && it.heightMm) {
      const calc = calculateGlassSystemPricing(it.widthMm, it.heightMm);
      if (!calc.isStandard && (it.materialPriceNet === 8626 || it.priceNet === 10213)) {
        return acc + calc.materialPriceNet * q;
      }
    }
    if (it.materialPriceNet !== undefined && it.materialPriceNet !== null) {
      return acc + it.materialPriceNet * q;
    }
    const inst = (it.installationPriceNet || 0) * q;
    return acc + Math.max(0, (it.priceNet || 0) * q - inst);
  }, 0);

  // Kalkulacja dodatków
  const additionsList = additions || [];
  const totalAdditionsPrice = additionsList.reduce(
    (acc, a) => acc + (a.priceNet || 0) * (a.quantity || 1),
    0
  );
  const totalAdditionsCost = additionsList.reduce(
    (acc, a) => acc + (a.costNet || 0) * (a.quantity || 1),
    0
  );
  const totalAdditionsInstallationPrice = additionsList.reduce(
    (acc, a) => acc + (a.installationPriceNet || 0) * (a.quantity || 1),
    0
  );
  const totalAdditionsInstallationCost = additionsList.reduce(
    (acc, a) => acc + (a.installationCostNet || 0) * (a.quantity || 1),
    0
  );

  const totalBasePrice = totalMaterialPrice + totalAdditionsPrice;
  const totalBaseCost = totalMaterialCost + totalAdditionsCost;

  const combinedInstallationPrice = totalInstallationPrice + totalAdditionsInstallationPrice;
  const combinedInstallationCost = totalInstallationCost + totalAdditionsInstallationCost;
  const totalCombinedCost = totalBaseCost + combinedInstallationCost;

  const discountPct = offer.discountPercent || 0;
  const [prevDiscountPct, setPrevDiscountPct] = useState(discountPct);
  const [customDiscount, setCustomDiscount] = useState<string>(String(discountPct));

  if (discountPct !== prevDiscountPct) {
    setPrevDiscountPct(discountPct);
    setCustomDiscount(String(discountPct));
  }

  const vatRate = offer.vatRate ?? 23;

  // Rabat naliczany jest od wartości bazowej (konstrukcje + dodatki)
  const discountedBaseNet = Math.round(totalBasePrice * (1 - discountPct / 100));
  const discountAmount = totalBasePrice - discountedBaseNet;
  const finalOfferNet = discountedBaseNet + combinedInstallationPrice;
  const vatAmount = Math.round((finalOfferNet * vatRate) / 100);
  const finalOfferGross = finalOfferNet + vatAmount;
  const profitNet = finalOfferNet - totalCombinedCost;
  const marginPct =
    finalOfferNet > 0 ? Math.round((profitNet / finalOfferNet) * 100) : 0;

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
                  const instPrice =
                    it.installationPriceNet !== undefined && it.installationPriceNet !== null
                      ? it.installationPriceNet
                      : 0;
                  let matUnitPrice =
                    it.materialPriceNet !== undefined && it.materialPriceNet !== null
                      ? it.materialPriceNet
                      : Math.max(0, (it.priceNet || 0) - instPrice);
                  if (isGlassSystemConstruction(it) && it.widthMm && it.heightMm) {
                    const calc = calculateGlassSystemPricing(it.widthMm, it.heightMm);
                    if (!calc.isStandard && (matUnitPrice === 8626 || it.priceNet === 10213)) {
                      matUnitPrice = calc.materialPriceNet;
                    }
                  }
                  const qty = it.quantity || 1;
                  const totalLineMatPrice = matUnitPrice * qty;
                  const panes = Math.max(1, it.panesCount || 3);
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
                        isTriangle={isTriangle}
                        hasTracks={!isTriangle && (it.panesCount ? it.panesCount > 1 : true)}
                        readOnly={readOnly}
                        onUpdateDimensions={onUpdateDimensions}
                      />

                      {/* Quantity */}
                      <td className="py-3 px-4 text-center font-mono font-bold text-xs text-[#0b1220]">
                        {qty} szt.
                      </td>

                      {/* Unit Price (Cena samej konstrukcji) */}
                      <td className="py-3 px-4 text-right font-mono text-xs text-[#475569]">
                        <div>{matUnitPrice.toLocaleString("pl-PL")} zł</div>
                        {instPrice > 0 && (
                          <div className="text-[10px] text-slate-400 font-sans">
                            + montaż: {instPrice.toLocaleString("pl-PL")} zł
                          </div>
                        )}
                      </td>

                      {/* Total Net (Wartość samej konstrukcji) */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-xs md:text-sm text-[#0b1220]">
                        <div>{totalLineMatPrice.toLocaleString("pl-PL")} zł</div>
                        {instPrice > 0 && qty > 1 && (
                          <div className="text-[10px] text-slate-400 font-normal font-sans">
                            + montaż: {(instPrice * qty).toLocaleString("pl-PL")} zł
                          </div>
                        )}
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
                    Konstrukcje netto:
                  </td>
                  <td className="py-3 px-4 text-right font-extrabold text-sm text-[#0e7490]">
                    {totalMaterialPrice.toLocaleString("pl-PL")} zł
                  </td>
                  <td className="py-3 px-4 text-right text-[11px] text-[#64748b]">
                    {totalInstallationPrice > 0 ? `+ montaż: ${totalInstallationPrice.toLocaleString("pl-PL")} zł` : ""}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── 3. DODATKI I AKCESORIA DO OFERTY ── */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#e2e8f0] flex items-center justify-between flex-wrap gap-3 bg-[#f8fafc]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-teal-50 text-[#0e7490] border border-teal-200">
              <PackagePlus size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-xs text-[#0b1220] uppercase tracking-wider">
                  Dodatki i akcesoria do oferty
                </h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-[#475569] border border-slate-200">
                  {additionsList.length} {additionsList.length === 1 ? "pozycja" : "pozycji"}
                </span>
              </div>
              <p className="text-[11px] text-[#64748b]">
                Akcesoria (zamki, piloty, uszczelki) i pozycje ogólne (transport, montaż)
              </p>
            </div>
          </div>

          {!readOnly && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCatalogModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#4ABBC3] hover:bg-[#3ca8b0] text-white shadow-2xs transition-colors cursor-pointer"
              >
                <Sparkles size={13} />
                Wybierz z katalogu
              </button>
              <button
                type="button"
                onClick={handleAddCustomAddition}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
              >
                <Plus size={13} />
                Dodaj własny
              </button>
            </div>
          )}
        </div>

        {additionsList.length === 0 ? (
          <div className="p-8 text-center bg-slate-50/50">
            <PackagePlus size={36} className="mx-auto text-slate-300 mb-2.5" />
            <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wide">
              Brak dodatków w tej ofercie
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
              Możesz dodać akcesoria przypisane do konkretnej pozycji konstrukcyjnej (np. zamek, uszczelka) lub dodatki ogólne (np. transport, chemia montażowa).
            </p>
            {!readOnly && (
              <div className="flex items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCatalogModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#4ABBC3] hover:bg-[#3ca8b0] text-white shadow-2xs transition-colors cursor-pointer"
                >
                  <Sparkles size={13} />
                  Wybierz z katalogu szablonów
                </button>
                <button
                  type="button"
                  onClick={handleAddCustomAddition}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs transition-colors cursor-pointer"
                >
                  <Plus size={13} />
                  Dodaj dodatek ręcznie
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#f8fafc] text-[#475569] border-b border-[#e2e8f0] font-sans font-semibold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 text-center w-10">Lp</th>
                  <th className="py-2.5 px-3">Nazwa dodatku</th>
                  <th className="py-2.5 px-3 text-center w-20">Ilość</th>
                  <th className="py-2.5 px-3 text-center w-20">J.m.</th>
                  <th className="py-2.5 px-3 text-right w-28">Cena jedn.</th>
                  <th className="py-2.5 px-3 text-right w-28">Wartość netto</th>
                  <th className="py-2.5 px-3 text-right w-28">Montaż</th>
                  <th className="py-2.5 px-3 text-right w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {additionsList.map((addition) => (
                  <InlineAdditionRow
                    key={addition._id}
                    addition={addition}
                    readOnly={readOnly}
                    onUpdate={async (id, patch) => {
                      await updateOfferAddition({
                        id,
                        name: patch.name,
                        quantity: patch.quantity,
                        unit: patch.unit,
                        priceNet: patch.priceNet,
                        costNet: patch.costNet,
                        installationPriceNet: patch.installationPriceNet,
                        installationCostNet: patch.installationCostNet,
                        orderIndex: patch.orderIndex,
                      });
                    }}
                    onRemove={async (id) => {
                      await removeOfferAddition({ id });
                      toast.success("Usunięto dodatek");
                    }}
                  />
                ))}
              </tbody>
              <tfoot className="bg-[#f8fafc] border-t-2 border-[#e2e8f0] font-mono text-xs">
                <tr>
                  <td colSpan={2} className="py-2.5 px-3 text-right font-sans font-bold text-[#475569]">
                    Razem dodatki ({additionsList.length}):
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-[#0b1220]">
                    {additionsList.reduce((acc, a) => acc + (a.quantity || 1), 0)}
                  </td>
                  <td></td>
                  <td className="py-2.5 px-3 text-right text-[#64748b]">Dodatki netto:</td>
                  <td className="py-2.5 px-3 text-right font-extrabold text-xs text-[#0e7490]">
                    {totalAdditionsPrice.toLocaleString("pl-PL")} zł
                  </td>
                  <td className="py-2.5 px-3 text-right text-[11px] text-[#64748b]">
                    {totalAdditionsInstallationPrice > 0 ? `+ ${totalAdditionsInstallationPrice.toLocaleString("pl-PL")} zł` : "—"}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── 4. DOLNA SEKCJA: USTALENIA (LEWA STRONA) + PODSUMOWANIE OFERTY (PRAWA STRONA) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Lewa kolumna: Ustalenia (WYSIWYG / HTML) */}
        <div className="lg:col-span-5 xl:col-span-6 bg-white rounded-xl border border-[#e2e8f0] shadow-xs overflow-hidden flex flex-col">
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
                  Tryb kodu HTML
                </span>
              )}
            </div>
          )}

          <div className="p-4 sm:p-5 flex-1 flex flex-col">
            {notesMode === "wysiwyg" ? (
              <div className="relative border border-[#cbd5e1] focus-within:border-[#4ABBC3] focus-within:ring-2 focus-within:ring-[#4ABBC3]/20 rounded-lg bg-[#f8fafc] focus-within:bg-white hover:bg-white transition-all flex-1 flex flex-col">
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
                  className="w-full flex-1 min-h-[160px] max-h-[360px] overflow-y-auto p-3.5 text-xs text-[#0b1220] focus:outline-none leading-relaxed font-sans prose prose-sm max-w-none [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-[#0b1220] [&_h3]:mt-2 [&_h3]:mb-1 [&_strong]:font-semibold [&_strong]:text-[#0b1220] [&_em]:italic [&_u]:underline [&_s]:line-through"
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
              <div className="border border-slate-700 rounded-lg overflow-hidden focus-within:border-[#4ABBC3] focus-within:ring-2 focus-within:ring-[#4ABBC3]/20 flex-1 flex flex-col">
                <textarea
                  rows={7}
                  disabled={readOnly}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={handleNotesBlur}
                  placeholder="<p>Wpisz ustalenia w formacie HTML...</p>"
                  className="w-full flex-1 bg-[#0f172a] text-[#e2e8f0] font-mono text-xs p-3.5 focus:outline-none resize-y leading-relaxed border-0 min-h-[160px]"
                  spellCheck={false}
                />
              </div>
            )}

            <div className="flex items-center justify-between mt-2.5 text-[11px] text-[#64748b]">
              <span>
                Automatyczny zapis po opuszczeniu pola.
              </span>
              {notes ? (
                <span className="font-mono text-[10px] text-slate-400">
                  {notes.length} znaków HTML
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Prawa kolumna: Podsumowanie oferty */}
        <div className="lg:col-span-7 xl:col-span-6 bg-white rounded-xl border border-[#e2e8f0] shadow-xs p-5 sm:p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <h2 className="font-extrabold text-xs text-[#0b1220] uppercase tracking-wider">
                Podsumowanie oferty
              </h2>
              <div className="text-[11px] text-[#64748b] font-mono">
                Rentowność:{" "}
                <span
                  className={`font-bold px-2 py-0.5 rounded ${
                    marginPct >= 20
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  marża {marginPct}%
                </span>
              </div>
            </div>

            {/* Linia: Konstrukcje */}
            {totalAdditionsPrice > 0 ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 py-1.5">
                  <div className="shrink-0">
                    <div className="font-sans font-bold text-sm text-[#0b1220]">
                      Konstrukcje:
                    </div>
                    <div className="text-[11px] text-[#94a3b8] font-sans mt-0.5 space-y-0.5">
                      <div>cena katalogowa: {totalMaterialPrice.toLocaleString("pl-PL")} zł</div>
                      <div>koszty: {totalMaterialCost.toLocaleString("pl-PL")} zł</div>
                    </div>
                  </div>
                  <div className="font-mono text-sm sm:text-base font-medium text-slate-700 min-w-[85px] text-right">
                    {totalMaterialPrice.toLocaleString("pl-PL")} zł
                  </div>
                </div>

                {/* Linia: Dodatki i akcesoria */}
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 py-1.5 border-t border-slate-100/70">
                  <div className="shrink-0">
                    <div className="font-sans font-bold text-sm text-[#0b1220] flex items-center gap-1.5">
                      <PackagePlus size={14} className="text-[#0e7490]" />
                      Dodatki i akcesoria:
                    </div>
                    <div className="text-[11px] text-[#94a3b8] font-sans mt-0.5 space-y-0.5">
                      <div>
                        wartość: {totalAdditionsPrice.toLocaleString("pl-PL")} zł ({additionsList.length} {additionsList.length === 1 ? "pozycja" : "pozycji"})
                      </div>
                      {totalAdditionsCost > 0 && (
                        <div>koszty: {totalAdditionsCost.toLocaleString("pl-PL")} zł</div>
                      )}
                    </div>
                  </div>
                  <div className="font-mono text-sm sm:text-base font-medium text-slate-700 min-w-[85px] text-right">
                    +{totalAdditionsPrice.toLocaleString("pl-PL")} zł
                  </div>
                </div>

                {/* Linia: Baza rabatowa (Konstrukcje + Dodatki) */}
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 py-2 border-t border-slate-100">
                  <div className="shrink-0">
                    <div className="font-sans font-bold text-xs text-slate-600 uppercase tracking-wider">
                      Podstawa (konstrukcje + dodatki):
                    </div>
                    {discountPct > 0 && (
                      <div className="text-[11px] text-rose-500 font-medium mt-0.5">
                        upust: -{discountAmount.toLocaleString("pl-PL")} zł
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 font-mono text-sm sm:text-base text-[#0b1220] whitespace-nowrap shrink-0 justify-end">
                    <span className="font-medium text-slate-700 min-w-[85px] text-right">
                      {totalBasePrice.toLocaleString("pl-PL")} zł
                    </span>

                    <span className="text-rose-500 font-bold select-none">-</span>

                    {/* Pole rabatu */}
                    <div className="inline-flex items-center gap-1.5 bg-white border border-[#cbd5e1] hover:border-rose-400 focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-500/20 rounded-md px-2 py-1 transition-all shadow-2xs">
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
                        className="w-11 bg-transparent text-[#0b1220] font-mono font-bold text-sm text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="0"
                        title="Wpisz procent rabatu"
                      />
                      <span className="text-rose-600 font-sans font-bold text-xs tracking-wide select-none">
                        % RABAT
                      </span>
                    </div>

                    <span className="text-slate-400 font-bold select-none">=</span>

                    <span className="font-extrabold text-[#0e7490] min-w-[100px] text-right">
                      {discountedBaseNet.toLocaleString("pl-PL")} zł
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 py-2">
                <div className="shrink-0">
                  <div className="font-sans font-bold text-sm text-[#0b1220]">
                    Konstrukcje:
                  </div>
                  <div className="text-[11px] text-[#94a3b8] font-sans mt-0.5 space-y-0.5">
                    <div>cena katalogowa: {totalMaterialPrice.toLocaleString("pl-PL")} zł</div>
                    <div>koszty: {totalMaterialCost.toLocaleString("pl-PL")} zł</div>
                    {discountPct > 0 && (
                      <div className="text-rose-500 font-medium">upust: -{discountAmount.toLocaleString("pl-PL")} zł</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 font-mono text-sm sm:text-base text-[#0b1220] whitespace-nowrap shrink-0 justify-end">
                  <span className="font-medium text-slate-700 min-w-[85px] text-right">
                    {totalMaterialPrice.toLocaleString("pl-PL")} zł
                  </span>

                  <span className="text-rose-500 font-bold select-none">-</span>

                  {/* Czyste, jednolite pole rabatu */}
                  <div className="inline-flex items-center gap-1.5 bg-white border border-[#cbd5e1] hover:border-rose-400 focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-500/20 rounded-md px-2 py-1 transition-all shadow-2xs">
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
                      className="w-11 bg-transparent text-[#0b1220] font-mono font-bold text-sm text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="0"
                      title="Wpisz procent rabatu"
                    />
                    <span className="text-rose-600 font-sans font-bold text-xs tracking-wide select-none">
                      % RABAT
                    </span>
                  </div>

                  <span className="text-slate-400 font-bold select-none">=</span>

                  <span className="font-extrabold text-[#0e7490] min-w-[100px] text-right">
                    {discountedBaseNet.toLocaleString("pl-PL")} zł
                  </span>
                </div>
              </div>
            )}

            {/* Szybki wybór rabatu */}
            {!readOnly && (
              <div className="flex items-center gap-1.5 justify-end -mt-2">
                <span className="text-[10px] text-slate-400 font-sans">Szybki rabat:</span>
                {PRESET_DISCOUNTS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setCustomDiscount(String(preset));
                      onUpdateOffer({ discountPercent: preset });
                    }}
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                      discountPct === preset
                        ? "bg-rose-600 text-white font-bold"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                    }`}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            )}

            {/* Linia: Montaż */}
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 py-3 border-t border-slate-100">
              <div className="shrink-0">
                <div className="font-sans font-bold text-sm text-[#0b1220]">
                  Montaż:
                </div>
                <div className="text-[11px] text-[#94a3b8] font-sans mt-0.5 space-y-0.5">
                  <div>koszt ekipy: {combinedInstallationCost.toLocaleString("pl-PL")} zł</div>
                  {totalAdditionsInstallationPrice > 0 && (
                    <div className="text-[#0e7490]">
                      w tym montaż dodatków: {totalAdditionsInstallationPrice.toLocaleString("pl-PL")} zł
                    </div>
                  )}
                </div>
              </div>

              <div className="font-mono text-sm sm:text-base font-bold text-slate-800 text-right min-w-[100px] whitespace-nowrap shrink-0">
                {combinedInstallationPrice.toLocaleString("pl-PL")} zł
              </div>
            </div>

            {/* Linia podsumowania: RAZEM */}
            <div className="pt-4 mt-2 border-t-2 border-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="font-sans font-black text-base text-[#0b1220] tracking-wider uppercase shrink-0">
                RAZEM =
              </div>

              <div className="flex flex-wrap items-center gap-2.5 font-mono text-sm sm:text-base whitespace-nowrap shrink-0 justify-end">
                <span className="font-extrabold text-[#0e7490]">
                  {finalOfferNet.toLocaleString("pl-PL")} zł netto
                </span>

                <span className="text-slate-400 font-bold select-none">+</span>

                {/* Wybór stawki VAT w linii równania */}
                <div className="inline-flex items-center gap-1 bg-slate-100 border border-slate-300 rounded px-2 py-0.5 text-xs font-sans">
                  <select
                    disabled={readOnly}
                    value={vatRate}
                    onChange={(e) => onUpdateOffer({ vatRate: Number(e.target.value) })}
                    className="bg-transparent font-mono font-bold text-[#0b1220] focus:outline-none cursor-pointer"
                  >
                    {PRESET_VAT_RATES.map((r) => (
                      <option key={r} value={r}>
                        {r}%
                      </option>
                    ))}
                  </select>
                  <span className="font-bold text-slate-700">VAT</span>
                </div>

                <span className="text-slate-400 font-bold select-none">=</span>

                <span className="font-black text-base sm:text-xl text-slate-900 bg-slate-100/90 px-3 py-1 rounded-lg border border-slate-300/80 min-w-[135px] text-right">
                  {finalOfferGross.toLocaleString("pl-PL")} zł brutto
                </span>
              </div>
            </div>
          </div>

          {/* Dyskretne podsumowanie kosztów i rentowności dla handlowca */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748b] font-mono">
            <div>
              Koszta łączne: <strong className="text-slate-700">{totalCombinedCost.toLocaleString("pl-PL")} zł</strong>
            </div>
            <div>
              Szacowany zysk:{" "}
              <strong className={profitNet >= 0 ? "text-emerald-600" : "text-rose-600"}>
                {profitNet >= 0 ? `+${profitNet.toLocaleString("pl-PL")}` : profitNet.toLocaleString("pl-PL")} zł
              </strong>
              {" • "}
              Marża:{" "}
              <strong className={marginPct >= 20 ? "text-emerald-600" : "text-amber-600"}>
                {marginPct}%
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal wyboru dodatków z katalogu szablonów ── */}
      {isCatalogModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-[#f8fafc]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-teal-50 text-[#0e7490] border border-teal-200">
                  <PackagePlus size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#0b1220]">Wybierz z katalogu dodatków</h3>
                  <p className="text-xs text-[#64748b]">Wybierz gotowy dodatek i dodaj do oferty</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCatalogModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search bar */}
            <div className="p-4 border-b border-slate-100 bg-white">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Szukaj dodatku (np. zamek, uszczelka, pilot)..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-[#4ABBC3] focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Catalog List */}
            <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100">
              {(() => {
                const templates = (catalogTemplates || []).filter((t) => {
                  if (!catalogSearch) return true;
                  const q = catalogSearch.toLowerCase();
                  return (
                    t.name.toLowerCase().includes(q) ||
                    (t.category && t.category.toLowerCase().includes(q)) ||
                    (t.description && t.description.toLowerCase().includes(q))
                  );
                });

                if (templates.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <p className="text-xs text-slate-500 mb-3">
                        {catalogTemplates && catalogTemplates.length === 0
                          ? "Katalog dodatków jest pusty. Możesz załadować domyślne dodatki jednym kliknięciem."
                          : "Nie znaleziono dodatków spełniających kryteria."}
                      </p>
                      {catalogTemplates && catalogTemplates.length === 0 && (
                        <button
                          type="button"
                          onClick={async () => {
                            await seedDefaultTemplates({});
                            toast.success("Załadowano domyślne dodatki!");
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#4ABBC3] text-white rounded-lg hover:bg-[#3ca8b0] transition-colors cursor-pointer"
                        >
                          <Sparkles size={13} />
                          Załaduj domyślne pozycje katalogu
                        </button>
                      )}
                    </div>
                  );
                }

                return templates.map((tpl) => (
                  <div
                    key={tpl._id}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 rounded-lg px-2 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-xs text-[#0b1220]">{tpl.name}</span>
                        {tpl.category && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                            {tpl.category}
                          </span>
                        )}
                      </div>
                      {tpl.description && (
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{tpl.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-[11px] text-slate-600 font-mono mt-1">
                        <span>
                          Cena: <strong className="text-[#0e7490]">{tpl.defaultPriceNet.toLocaleString("pl-PL")} zł</strong> / {tpl.unit}
                        </span>
                        {tpl.defaultInstallationPriceNet ? (
                          <span className="text-slate-400">
                            + montaż: {tpl.defaultInstallationPriceNet.toLocaleString("pl-PL")} zł
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddFromTemplate(tpl)}
                      className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-[#4ABBC3] text-[#0e7490] hover:text-white border border-[#4ABBC3]/40 hover:border-[#4ABBC3] transition-all cursor-pointer shadow-2xs"
                    >
                      <Plus size={13} />
                      Dodaj
                    </button>
                  </div>
                ));
              })()}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-[#f8fafc] flex items-center justify-between">
              <Link
                href="/admin/ustawienia?tab=dodatki"
                target="_blank"
                className="text-xs text-[#0e7490] hover:underline inline-flex items-center gap-1"
              >
                <ExternalLink size={12} />
                Zarządzaj katalogiem dodatków w Ustawieniach
              </Link>
              <button
                type="button"
                onClick={() => setIsCatalogModalOpen(false)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800 transition-colors cursor-pointer"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
