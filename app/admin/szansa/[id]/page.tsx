"use client";

import { use, useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import InlineEdit from "@/app/admin/klient/[id]/InlineEdit";
import AddressSearch, { type AddressData } from "@/components/AddressSearch";
import { useStatusLabel } from "@/components/StatusLabelsContext";
import {
  Archive,
  ArchiveRestore,
  Trash2,
  Send,
  MapPin,
  Building2,
  Plus,
  Pencil,
  Check,
  X,
  SlidersHorizontal,
  Loader2,
  ArrowLeft,
  Settings,
} from "lucide-react";
import { TerraceRoofConfigurator } from "@/components/TerraceRoofConfigurator";
import { GlassEnclosureConfigurator } from "@/components/GlassEnclosureConfigurator";
import { ProkalConfigurator, type ProkalPositionData } from "@/components/ProkalConfigurator";
import { formatPLN } from "@/lib/terraceCalculatorEngine";
import DriveFolderButton from "@/components/DriveFolderButton";
import OpportunityAttachmentsSection from "./OpportunityAttachmentsSection";
import OpportunityNotesFeed from "./OpportunityNotesFeed";

const FIELD_LABEL: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  color: "var(--text-mute)",
  margin: 0,
  marginBottom: 4,
};

interface ConfiguratorObject {
  variant?: string;
  width?: string;
  depth?: string;
  dimensions?: string;
  area?: string;
  options?: string;
  location?: string;
  userNotes?: string;
}

interface ServiceConfigWall {
  id?: string;
  type?: string;
  widthCm?: number;
  heightCm?: number;
  quantity?: number;
}

interface ServiceConfigAccessory {
  id?: string;
  name?: string;
  quantity?: number;
  effectiveWidthCm?: number;
  linkedWallLabel?: string;
}

interface ServiceConfigItem {
  serviceName: string;
  calculatorType: string;
  input?: {
    walls?: ServiceConfigWall[];
    accessories?: ServiceConfigAccessory[];
    widthCm?: number;
    depthCm?: number;
    materialMarkupPercent?: number;
    [key: string]: unknown;
  };
  result?: {
    installationNet?: number;
    totalNetPrice?: number;
    finalPriceNet?: number;
    totalNet?: number;
    totalClientNet?: number;
    options?: {
      polycarbonate?: {
        totalNet?: number;
      };
    };
    input?: {
      areaSqM?: number;
    };
    walls?: Array<{
      id?: string;
      areaSqm?: number;
      standardWidthCm?: number;
      unitClientNet: number;
    }>;
    accessories?: Array<{
      id?: string;
      name?: string;
      effectiveWidthCm?: number;
      linkedWallLabel?: string;
      totalClientNet: number;
    }>;
    [key: string]: unknown;
  };
  updatedAt?: number;
  updatedBy?: string;
  offerText?: string;
}

function parseConfiguratorData(commentStr?: string): { parsedConfig: ConfiguratorObject | null; displayComment: string } {
  if (!commentStr) return { parsedConfig: null, displayComment: "" };

  const hasConfigKeywords =
    commentStr.includes("Wariant:") ||
    commentStr.includes("Wymiary:") ||
    commentStr.includes("Wyposażenie:");

  if (!hasConfigKeywords) {
    return { parsedConfig: null, displayComment: commentStr };
  }

  const parts = commentStr.split("|").map(s => s.trim());
  const config: ConfiguratorObject = {};
  const notesParts: string[] = [];

  for (const part of parts) {
    if (part.startsWith("Wariant:")) {
      config.variant = part.replace(/^Wariant:\s*/, "").trim();
    } else if (part.startsWith("Wymiary:")) {
      const dimStr = part.replace(/^Wymiary:\s*/, "").trim();
      const areaMatch = dimStr.match(/\(([^)]+)\)/);
      if (areaMatch) {
        config.area = areaMatch[1].trim();
        config.dimensions = dimStr.replace(/\s*\([^)]+\)/, "").trim();
      } else {
        config.dimensions = dimStr;
      }
    } else if (part.startsWith("Wyposażenie:")) {
      config.options = part.replace(/^Wyposażenie:\s*/, "").trim();
    } else if (part.startsWith("Lokalizacja:")) {
      config.location = part.replace(/^Lokalizacja:\s*/, "").trim();
    } else if (part.startsWith("Uwagi:")) {
      const val = part.replace(/^Uwagi:\s*/, "").trim();
      if (val && val !== "Brak dodatkowych uwag") {
        config.userNotes = val;
      }
    } else if (!part.startsWith("Załączone pliki")) {
      notesParts.push(part);
    }
  }

  const cleanNotes = [config.userNotes, ...notesParts].filter(Boolean).join("\n");

  return {
    parsedConfig: (config.variant || config.dimensions || config.options) ? config : null,
    displayComment: cleanNotes,
  };
}

// Ikona usługi dopasowana do nazwy — jak w widoku zlecenia
function ServiceIcon({ name, size = 15 }: { name: string; size?: number }) {
  const n = name.toLowerCase();
  let path: string;
  if (n.includes("okn")) {
    path = "M4 4h16v16H4zM12 4v16M4 12h16";
  } else if (n.includes("drzw")) {
    path = "M6 21V4a1 1 0 011-1h8a1 1 0 011 1v17M5 21h14M13.5 12h.01";
  } else if (n.includes("bram")) {
    path = "M4 21V6a2 2 0 012-2h12a2 2 0 012 2v15M4 21h16M4 9.5h16M4 13.5h16M4 17.5h16";
  } else if (n.includes("taras") || n.includes("zabud")) {
    path = "M3 21h18M5 21V10l7-5 7 5v11M9.5 21v-5h5v5";
  } else if (n.includes("alumin") || n.includes("konstr")) {
    path = "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z";
  } else if (n.includes("ogrodz")) {
    path = "M3 13h18M3 17h18M6 21V7l1.5-2L9 7v14M15 21V7l1.5-2L18 7v14";
  } else if (
    n.includes("słoneczn") || n.includes("sloneczn") ||
    n.includes("rolet") || n.includes("przeciw")
  ) {
    path = "M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4M12 8a4 4 0 100 8 4 4 0 000-8z";
  } else {
    path = "M9.6 3.6 3.6 9.6a2 2 0 0 0 0 2.8l8 8a2 2 0 0 0 2.8 0l6-6a2 2 0 0 0 0-2.8l-8-8A2 2 0 0 0 11 3H5a2 2 0 0 0-2 2v6M7.5 7.5h.01";
  }
  return (
    <svg
      width={size}
      height={size}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

export default function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const opportunityId = id as Id<"pendingJotformSubmissions">;
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<"szczegoly" | "wyceny">(
    tabParam === "wyceny" || tabParam === "konfigurator" ? "wyceny" : "szczegoly"
  );

  useEffect(() => {
    if (tabParam === "wyceny" || tabParam === "konfigurator") {
      setActiveTab("wyceny");
    } else if (tabParam === "szczegoly") {
      setActiveTab("szczegoly");
    }
  }, [tabParam]);

  const handleTabChange = (tab: "szczegoly" | "wyceny") => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (tab === "wyceny") {
        url.searchParams.set("tab", "wyceny");
      } else {
        url.searchParams.delete("tab");
      }
      window.history.replaceState(null, "", url.toString());
    }
  };

  const opp = useQuery(api.salesOpportunities.getSalesOpportunity, { opportunityId });
  const updateField = useMutation(api.salesOpportunities.updateOpportunity);
  const updateStage = useMutation(api.salesOpportunities.updateOpportunityStage);
  const archive = useMutation(api.salesOpportunities.archiveOpportunity);
  const unarchive = useMutation(api.salesOpportunities.unarchiveOpportunity);
  const deleteOpp = useMutation(api.salesOpportunities.deleteSalesOpportunity);
  const convert = useMutation(api.salesOpportunities.convertToOrder);
  const retryFolder = useMutation(api.salesOpportunities.retryCreateFolderAndUploadFiles);
  const saveConfigs = useMutation(api.salesOpportunities.saveOpportunityConfigurations);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [converting, setConverting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [editingServices, setEditingServices] = useState(false);
  const [draftServices, setDraftServices] = useState<string[]>([]);
  const [sameAddress, setSameAddress] = useState<boolean>(false);
  const [editingLeadSource, setEditingLeadSource] = useState(false);
  const [draftLeadSource, setDraftLeadSource] = useState("");

  // Inline Configurator state
  const [activeConfiguratorType, setActiveConfiguratorType] = useState<"TERRACE_ROOF" | "GLASS_ENCLOSURE" | null>(null);
  const [editingConfigIndex, setEditingConfigIndex] = useState<number | null>(null);
  const [draftConfigData, setDraftConfigData] = useState<{
    serviceName: string;
    calculatorType: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    input: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result: any;
    offerText?: string;
    isValid: boolean;
  } | null>(null);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState<{
    isOpen: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  } | null>(null);
  const [configuratorWorkspaceMode, setConfiguratorWorkspaceMode] = useState<"PROKAL" | "TERRACE_ROOF" | "ALL_POSITIONS">("PROKAL");

  const handleStartAdd = (type: "TERRACE_ROOF" | "GLASS_ENCLOSURE") => {
    setEditingConfigIndex(null);
    setDraftConfigData(null);
    setActiveConfiguratorType(type);
    if (type === "TERRACE_ROOF") {
      setConfiguratorWorkspaceMode("TERRACE_ROOF");
    } else {
      setConfiguratorWorkspaceMode("PROKAL");
    }
    handleTabChange("wyceny");
  };

  const handleStartEdit = (index: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const configs: any[] = (opp as any)?.serviceConfigurations || [];
    const target = configs[index];
    if (!target) return;
    setEditingConfigIndex(index);
    setDraftConfigData(null);
    if (
      target.calculatorType === "GLASS_ENCLOSURE" ||
      (target.serviceName && target.serviceName.toLowerCase().includes("zabudow"))
    ) {
      setActiveConfiguratorType("GLASS_ENCLOSURE");
    } else {
      setActiveConfiguratorType("TERRACE_ROOF");
    }
    handleTabChange("wyceny");
  };

  const handleCancelConfig = () => {
    setActiveConfiguratorType(null);
    setEditingConfigIndex(null);
    setDraftConfigData(null);
  };

  const handleSaveConfig = async () => {
    if (!draftConfigData || !draftConfigData.isValid) return;
    setIsSavingConfig(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentConfigs = [...(((opp as any)?.serviceConfigurations as any[]) || [])];
      const itemToSave = {
        serviceName: draftConfigData.serviceName,
        calculatorType: draftConfigData.calculatorType,
        input: draftConfigData.input,
        result: draftConfigData.result,
        offerText: draftConfigData.offerText,
        updatedAt: Date.now(),
      };

      if (editingConfigIndex !== null && editingConfigIndex >= 0 && editingConfigIndex < currentConfigs.length) {
        currentConfigs[editingConfigIndex] = itemToSave;
      } else {
        currentConfigs.push(itemToSave);
      }

      await saveConfigs({
        opportunityId,
        serviceConfigurations: currentConfigs,
      });

      setActiveConfiguratorType(null);
      setEditingConfigIndex(null);
      setDraftConfigData(null);
    } catch (err: unknown) {
      console.error("Failed to save configuration:", err);
      const msg = err instanceof Error ? err.message : String(err);
      alert("Wystąpił błąd podczas zapisywania konfiguracji: " + msg);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleDeleteConfig = async (index: number) => {
    if (!confirm("Czy na pewno chcesz usunąć tę wycenę? Wartość szansy zostanie automatycznie przeliczona.")) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentConfigs = [...(((opp as any)?.serviceConfigurations as any[]) || [])];
      currentConfigs.splice(index, 1);
      await saveConfigs({
        opportunityId,
        serviceConfigurations: currentConfigs,
      });
      if (editingConfigIndex === index) {
        setActiveConfiguratorType(null);
        setEditingConfigIndex(null);
        setDraftConfigData(null);
      }
    } catch (err: unknown) {
      console.error("Failed to delete configuration:", err);
      const msg = err instanceof Error ? err.message : String(err);
      alert("Wystąpił błąd podczas usuwania konfiguracji: " + msg);
    }
  };

  useEffect(() => {
    if (opp?.leadSource !== undefined) {
      setDraftLeadSource(opp.leadSource ?? "");
    }
  }, [opp?.leadSource]);

  const handleSaveLeadSource = async () => {
    try {
      const val = draftLeadSource.trim();
      await updateField({
        opportunityId,
        leadSource: val ? val : null,
      });
      setEditingLeadSource(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Błąd zapisu źródła leada";
      setError(msg);
    }
  };

  const assignDropdownRef = useRef<HTMLDivElement>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  const me = useQuery(api.users.me);
  const isAdmin = me?.role === "admin";
  const assignOpportunity = useMutation(api.salesOpportunities.assignOpportunity);
  const assignableUsers = useQuery(api.users.listAllActive) ?? [];
  const servicesList = useQuery(api.services.list, {}) ?? [];

  // Synchronizacja checkboxa "Taki sam jak klienta" gdy dane opp się załadują
  useEffect(() => {
    if (opp) {
      setSameAddress(
        (opp.investmentStreet ?? "") === (opp.street ?? "") &&
        (opp.investmentBuildingNumber ?? "") === (opp.buildingNumber ?? "") &&
        (opp.investmentPostalCode ?? "") === (opp.postalCode ?? "") &&
        (opp.investmentCity ?? "") === (opp.city ?? "") &&
        !!(opp.street || opp.city)
      );
    }
  }, [opp, opp?.street, opp?.buildingNumber, opp?.postalCode, opp?.city, opp?.investmentStreet, opp?.investmentBuildingNumber, opp?.investmentPostalCode, opp?.investmentCity]);

  useEffect(() => {
    const el = commentRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [opp?.comment]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (assignDropdownRef.current && !assignDropdownRef.current.contains(e.target as Node)) {
        setShowAssignDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const configurationsList: ServiceConfigItem[] = useMemo(() => {
    return ((opp as unknown as Record<string, unknown>)?.serviceConfigurations as ServiceConfigItem[] | undefined) || [];
  }, [opp]);

  // Pozycje PROKAL wyciągnięte z configurationsList
  const initialProkalPositions: ProkalPositionData[] = useMemo(() => {
    const prokalConfigs = configurationsList.filter((c) => c.calculatorType === "PROKAL_SLIDING");
    if (prokalConfigs.length === 0) return [];
    return prokalConfigs.map((c, idx) => ({
      id: `pos-${idx + 1}`,
      name: c.serviceName,
      quantity: 1,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      input: c.input as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result: c.result as any,
      notes: c.offerText,
    }));
  }, [configurationsList]);

  const stage = opp?.stage ?? "lead";
  const stageLabel = useStatusLabel(stage);

  if (opp === undefined) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 256 }}>
        <span className="mute" style={{ fontSize: 13 }}>Ładowanie…</span>
      </div>
    );
  }

  if (opp === null) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 256, gap: 16 }}>
        <span className="mute" style={{ fontSize: 13 }}>Szansa sprzedaży nie znaleziona.</span>
        <Link href="/admin/panel?tab=opportunities" style={{ fontSize: 13, color: "var(--accent)" }}>Wróć do panelu</Link>
      </div>
    );
  }



  const save = (field: string, value: string | string[] | number | null | undefined) => {
    updateField({ opportunityId, [field]: value }).catch((err) => {
      setError(err instanceof Error ? err.message : "Wystąpił błąd");
      setTimeout(() => setError(null), 3000);
    });
  };


  async function handleStageChange(next: "lead" | "inquiry") {
    if (stage === next) return;
    try {
      await updateStage({ opportunityId, stage: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd zmiany etapu");
    }
  }

  async function handleConvert() {
    setError(null);
    setConverting(true);
    try {
      const { clientId, orderId } = await convert({ opportunityId });
      router.push(`/admin/klient/${clientId}/zlecenie/${orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się utworzyć zlecenia");
      setConverting(false);
    }
  }

  async function handleArchive() {
    try {
      if (opp?.archived) {
        await unarchive({ opportunityId });
      } else {
        await archive({ opportunityId });
      }
      router.push("/admin/panel?tab=opportunities");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd archiwizacji");
    }
  }

  async function handleDelete() {
    try {
      await deleteOpp({ opportunityId });
      router.push("/admin/panel?tab=opportunities");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd usuwania");
    }
  }

  async function handleRetryFolder() {
    setError(null);
    setRetrying(true);
    try {
      await retryFolder({ opportunityId });
      await new Promise((resolve) => setTimeout(resolve, 2000));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd tworzenia folderu");
      setRetrying(false);
    }
  }

  const selectedServices = opp.services ?? [];
  const { parsedConfig, displayComment } = parseConfiguratorData(opp.comment);

  const handleSaveProkalPositions = async (prokalPositions: ProkalPositionData[]) => {
    setIsSavingConfig(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentConfigs = [...(((opp as any)?.serviceConfigurations as any[]) || [])];
      const nonProkalConfigs = currentConfigs.filter(
        (c) => c.calculatorType !== "PROKAL_SLIDING"
      );

      const newProkalConfigs = prokalPositions.map((pos) => ({
        serviceName: pos.name,
        calculatorType: "PROKAL_SLIDING",
        input: pos.input,
        result: {
          ...pos.result,
          totalPriceNet: pos.result.totalPriceNet * pos.quantity,
          totalCostNet: pos.result.totalCostNet * pos.quantity,
          profitNet: pos.result.profitNet * pos.quantity,
        },
        updatedAt: Date.now(),
      }));

      // Upewniamy się, że konfiguracje nie zawierają pól poza walidatorem (np. offerText)
      const finalConfigs = [...nonProkalConfigs, ...newProkalConfigs].map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (cfg: any) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { offerText: _ignored, ...clean } = cfg;
          return clean;
        }
      );

      await saveConfigs({
        opportunityId,
        serviceConfigurations: finalConfigs,
      });

      setFeedbackModal({
        isOpen: true,
        type: "success",
        title: "Wycena zapisana",
        message: "Wycena została pomyślnie zapisana! Wartość szansy została zaktualizowana.",
      });
    } catch (err: unknown) {
      console.error("Failed to save glass positions:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setFeedbackModal({
        isOpen: true,
        type: "error",
        title: "Błąd zapisu wyceny",
        message: "Wystąpił błąd podczas zapisu wyceny: " + msg,
      });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const mainStreetPart = [opp.street, [opp.buildingNumber, opp.apartmentNumber].filter(Boolean).join("/")].filter(Boolean).join(" ");
  const mainCityPart = [opp.postalCode, opp.city].filter(Boolean).join(" ");
  const mainAddressStr = [mainStreetPart, mainCityPart].filter(Boolean).join(", ");

  const investStreetPart = [opp.investmentStreet, [opp.investmentBuildingNumber, opp.investmentApartmentNumber].filter(Boolean).join("/")].filter(Boolean).join(" ");
  const investCityPart = [opp.investmentPostalCode, opp.investmentCity].filter(Boolean).join(" ");
  const investmentAddressStr = [investStreetPart, investCityPart].filter(Boolean).join(", ");

  const mainMapsUrl = mainAddressStr ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mainAddressStr)}` : null;
  const investmentMapsUrl = investmentAddressStr ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(investmentAddressStr)}` : null;



  function handleAddress(a: AddressData) {
    const patch: Record<string, string> = {};
    if (a.street) patch.street = a.street;
    if (a.buildingNumber) patch.buildingNumber = a.buildingNumber;
    if (a.postalCode) patch.postalCode = a.postalCode;
    if (a.city) patch.city = a.city;
    if (Object.keys(patch).length > 0) {
      void updateField({ opportunityId, ...patch });
      // Jezeli "taki sam" to aktualizuj rowniez adres inwestycji
      if (sameAddress) {
        const investPatch: Record<string, string> = {};
        if (a.street) investPatch.investmentStreet = a.street;
        if (a.buildingNumber) investPatch.investmentBuildingNumber = a.buildingNumber;
        if (a.postalCode) investPatch.investmentPostalCode = a.postalCode;
        if (a.city) investPatch.investmentCity = a.city;
        void updateField({ opportunityId, ...investPatch });
      }
    }
  }

  function handleInvestmentAddress(a: AddressData) {
    const patch: Record<string, string> = {};
    if (a.street) patch.investmentStreet = a.street;
    if (a.buildingNumber) patch.investmentBuildingNumber = a.buildingNumber;
    if (a.postalCode) patch.investmentPostalCode = a.postalCode;
    if (a.city) patch.investmentCity = a.city;
    if (Object.keys(patch).length > 0) {
      void updateField({ opportunityId, ...patch });
    }
  }

  function handleSameAddressToggle(checked: boolean) {
    setSameAddress(checked);
    if (checked && opp) {
      // Skopiuj adres klienta do adresu inwestycji
      void updateField({
        opportunityId,
        investmentStreet: opp.street,
        investmentBuildingNumber: opp.buildingNumber,
        investmentApartmentNumber: opp.apartmentNumber,
        investmentPostalCode: opp.postalCode,
        investmentCity: opp.city,
      });
    }
  }

  // Rating finansowy (jak w zleceniu)
  const profit = opp.profit;
  const workDays = opp.workDays;
  const dailyProfit = (profit !== undefined && workDays && workDays > 0) ? Math.round(profit / workDays) : null;
  let rating: number | null = null;
  if (dailyProfit !== null) {
    if (dailyProfit >= 5000) rating = 5;
    else if (dailyProfit >= 4000) rating = 4;
    else if (dailyProfit >= 3000) rating = 3;
    else if (dailyProfit >= 2000) rating = 2;
    else if (dailyProfit >= 1000) rating = 1;
    else rating = 0;
  }
  const C = 251.327;
  const pct = (rating ?? 0) / 5;
  const filledDash = C * pct;
  const strokeDasharray = `${filledDash} ${C - filledDash}`;
  const ratingColors: Record<number, string> = {
    5: "#10b981",
    4: "#84cc16",
    3: "#3b82f6",
    2: "#f97316",
    1: "#ef4444",
    0: "#94a3b8",
  };
  const ringColor = rating !== null ? (ratingColors[rating] ?? "#3b82f6") : "#cbd5e1";

  function startEditServices() {
    setDraftServices(selectedServices);
    setEditingServices(true);
  }
  function toggleDraftService(name: string) {
    setDraftServices((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]
    );
  }
  function saveServices() {
    save("services", draftServices.length > 0 ? draftServices : undefined);
    setEditingServices(false);
  }
  function cancelEditServices() {
    setEditingServices(false);
    setDraftServices([]);
  }

  // Assignees
  const assigneesArray = Array.from(new Set([
    ...(opp.assignedUserId ? [opp.assignedUserId] : []),
    ...(opp.assignedUserIds || [])
  ]));
  const assignedUsers = assigneesArray.map(uid => assignableUsers.find((u) => u._id === uid)).filter(Boolean);
  const assignedName = assignedUsers.length === 0
    ? null
    : assignedUsers.length === 1
    ? (assignedUsers[0]!.displayName ?? assignedUsers[0]!.login ?? "")
    : `${assignedUsers.length} osoby`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {opp.processed && (
        <div style={{
          backgroundColor: "#fef3c7",
          border: "1px solid #f59e0b",
          borderRadius: 12,
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, fontWeight: 600, color: "#92400e" }}>
            <span style={{ fontSize: 18 }}>ℹ️</span>
            <span>Ta szansa została już przekonwertowana do zlecenia. Możesz nadal przeglądać jej dane i historię.</span>
          </div>
          {opp.convertedOrder ? (
            <Link
              href={`/admin/klient/${opp.convertedOrder.clientId}/zlecenie/${opp.convertedOrder._id}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                borderRadius: 8,
                backgroundColor: "#0284c7",
                color: "#ffffff",
                fontWeight: 600,
                fontSize: 13,
                textDecoration: "none",
                boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
              }}
            >
              Przejdź do Zlecenia ({opp.convertedOrder.name ?? "Zlecenie"}) &rarr;
            </Link>
          ) : opp.clientId ? (
            <Link
              href={`/admin/klient/${opp.clientId}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                borderRadius: 8,
                backgroundColor: "#0284c7",
                color: "#ffffff",
                fontWeight: 600,
                fontSize: 13,
                textDecoration: "none",
                boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
              }}
            >
              Przejdź do Klienta &rarr;
            </Link>
          ) : null}
        </div>
      )}
      {/* ── Header panel ── */}
      <div className="panel" style={{ overflow: "visible" }}>
        {/* Breadcrumb + actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px",
            background: "#4abbc3",
            borderBottom: "1px solid rgba(11, 18, 32, 0.15)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#000000" }}>
            <Link
              href="/admin/panel?tab=opportunities"
              style={{ color: "#000000", fontWeight: 600, textDecoration: "none" }}
              onMouseEnter={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
              onMouseLeave={(e) => { e.currentTarget.style.textDecoration = "none"; }}
            >
              Zlecenia
            </Link>
            <span style={{ color: "#000000", opacity: 0.7, fontWeight: 700 }}>›</span>
            <span style={{ color: "#000000", fontWeight: 500 }}>Szansa sprzedaży</span>
            {opp.submissionId && (
              <>
                <span style={{ color: "#000000", opacity: 0.7, fontWeight: 700 }}>›</span>
                <span style={{ color: "#000000", fontWeight: 600 }}>#{opp.submissionId}</span>
              </>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* Przypisana osoba */}
            <div ref={assignDropdownRef} style={{ position: "relative" }}>
              <button
                onClick={() => setShowAssignDropdown((v) => !v)}
                className="btn"
                style={{
                  fontSize: 11,
                  padding: "4px 10px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  ...(assignedUsers.length === 1 && assignedUsers[0]!.color
                    ? { borderColor: assignedUsers[0]!.color + "80", color: assignedUsers[0]!.color }
                    : {}),
                }}
                title={assignedName ? `Przypisany: ${assignedName}` : "Przypisz osobę"}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                {assignedName ?? "+ Przypisz"}
              </button>
              {showAssignDropdown && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    right: 0,
                    minWidth: 180,
                    background: "var(--panel)",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                    zIndex: 500,
                    overflow: "hidden",
                  }}
                >
                  {assignableUsers.map((u) => (
                    <button
                      key={u._id}
                      onClick={() => {
                        if (assigneesArray.includes(u._id)) {
                          void assignOpportunity({ opportunityId, assignedUserIds: assigneesArray.filter(uid => uid !== u._id) });
                        } else {
                          void assignOpportunity({ opportunityId, assignedUserIds: [...assigneesArray, u._id] });
                        }
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        width: "100%",
                        textAlign: "left",
                        padding: "6px 12px",
                        fontSize: 12,
                        background: assigneesArray.includes(u._id) ? "var(--panel-2)" : "transparent",
                        border: "none",
                        borderBottom: "1px solid var(--line)",
                        cursor: "pointer",
                        color: "var(--text)",
                        fontFamily: "inherit",
                        fontWeight: assigneesArray.includes(u._id) ? 600 : 400,
                      }}
                    >
                      {u.color && (
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: u.color, flexShrink: 0 }} />
                      )}
                      <span style={{ flex: 1 }}>{u.displayName ?? u.login}</span>
                      {assigneesArray.includes(u._id) && (
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: "#2563eb", flexShrink: 0 }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </button>
                  ))}
                  {assigneesArray.length > 0 && (
                    <button
                      onClick={() => {
                        void assignOpportunity({ opportunityId, assignedUserIds: [] });
                        setShowAssignDropdown(false);
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "6px 12px",
                        fontSize: 12,
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--bad, #ef4444)",
                        fontFamily: "inherit",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fee2e2"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                    >
                      Usuń przypisanie
                    </button>
                  )}
                </div>
              )}
            </div>

            <DriveFolderButton
              folderUrl={opp.opportunityFolderUrl}
              createdAt={opp._creationTime}
              onCreate={handleRetryFolder}
              busy={retrying}
            />
            <button
              onClick={handleArchive}
              className="btn"
              style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", fontSize: 11.5 }}
              title={opp.archived ? "Przywróć z archiwum" : "Archiwizuj"}
            >
              {opp.archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
              {opp.archived ? "Przywróć" : "Archiwizuj"}
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="btn"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "5px 10px",
                fontSize: 11.5,
                color: "#dc2626",
                borderColor: "#fca5a5",
              }}
              title="Usuń szansę"
            >
              <Trash2 size={13} /> Usuń
            </button>
          </div>
        </div>

        {/* Title + stage bar */}
        <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", borderBottom: "1px solid var(--line)" }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-strong)", margin: 0, lineHeight: 1.2 }}>
              {opp.firstName} {opp.lastName}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
              <span style={{ fontSize: 12, color: "var(--text-mute)" }}>
                Szansa sprzedaży · {stageLabel}
                {opp.submissionId && ` · #${opp.submissionId}`}
                {opp.archived && " · ZARCHIWIZOWANA"}
              </span>

              {opp.clientId && (
                <>
                  <span style={{ fontSize: 12, color: "var(--text-mute)" }}>·</span>
                  <Link
                    href={`/admin/klient/${opp.clientId}`}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--accent)",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.textDecoration = "none"; }}
                  >
                    <Building2 size={13} />
                    <span>Profil klienta &rarr;</span>
                  </Link>
                </>
              )}

              <span style={{ fontSize: 12, color: "var(--text-mute)" }}>·</span>

              {editingLeadSource ? (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="text"
                    value={draftLeadSource}
                    onChange={(e) => setDraftLeadSource(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveLeadSource();
                      if (e.key === "Escape") {
                        setDraftLeadSource(opp.leadSource ?? "");
                        setEditingLeadSource(false);
                      }
                    }}
                    autoFocus
                    placeholder="od kogo lead..."
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 6,
                      border: "1px solid var(--accent)",
                      background: "var(--panel)",
                      color: "var(--text-strong)",
                      outline: "none",
                      width: 170,
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSaveLeadSource}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: "#2563eb",
                      color: "#fff",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftLeadSource(opp.leadSource ?? "");
                      setEditingLeadSource(false);
                    }}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: "transparent",
                      color: "var(--text-mute)",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Anuluj
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setDraftLeadSource(opp.leadSource ?? "");
                    setEditingLeadSource(true);
                  }}
                  title="Edytuj źródło leada"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 11.5,
                    fontWeight: opp.leadSource ? 600 : 500,
                    padding: "2px 8px",
                    borderRadius: 6,
                    border: `1px solid ${opp.leadSource ? "var(--line-2)" : "1px dashed #cbd5e1"}`,
                    background: opp.leadSource ? "var(--panel)" : "rgba(241, 245, 249, 0.6)",
                    color: opp.leadSource ? "var(--text-strong)" : "var(--text-mute)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span style={{ color: "#2563eb", fontWeight: 700 }}>Źródło:</span>
                  {opp.leadSource ? (
                    <span>{opp.leadSource}</span>
                  ) : (
                    <span style={{ fontStyle: "italic", opacity: 0.8 }}>+ Dodaj od kogo lead</span>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Etap + konwersja */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={FIELD_LABEL}>Etap:</span>
              <div style={{ display: "flex", gap: 4 }}>
                {(["lead", "inquiry"] as const).map((s) => {
                  const active = stage === s;
                  return (
                    <button
                      key={s}
                      onClick={() => handleStageChange(s)}
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        padding: "4px 12px",
                        borderRadius: 6,
                        border: `1px solid ${active ? "#1d4ed8" : "var(--line)"}`,
                        background: active ? "#2563eb" : "var(--panel)",
                        color: active ? "#fff" : "var(--text)",
                        cursor: "pointer",
                        transition: "all 0.1s ease",
                      }}
                    >
                      {s === "lead" ? "Oferty" : "Oferta wysłana"}
                    </button>
                  );
                })}
              </div>
            </div>
            {opp.processed ? (
              opp.convertedOrder ? (
                <Link
                  href={`/admin/klient/${opp.convertedOrder.clientId}/zlecenie/${opp.convertedOrder._id}`}
                  className="btn primary"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    padding: "5px 12px",
                    textDecoration: "none",
                  }}
                >
                  <Send size={13} />
                  Przejdź do zlecenia ({opp.convertedOrder.name ?? "Zlecenie"})
                </Link>
              ) : (
                <button
                  disabled
                  className="btn"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    padding: "5px 12px",
                    opacity: 0.6,
                    cursor: "not-allowed",
                  }}
                >
                  Zlecenie utworzone
                </button>
              )
            ) : (
              <button
                onClick={handleConvert}
                disabled={stage !== "inquiry" || converting}
                className="btn primary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  padding: "5px 12px",
                  opacity: stage !== "inquiry" || converting ? 0.5 : 1,
                  cursor: stage !== "inquiry" || converting ? "not-allowed" : "pointer",
                }}
              >
                <Send size={13} />
                {converting ? "Tworzenie..." : "Utwórz zlecenie"}
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            padding: "0 16px",
            borderTop: "1px solid var(--line)",
            background: "var(--panel)",
          }}
        >
          <button
            type="button"
            onClick={() => handleTabChange("szczegoly")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: activeTab === "szczegoly" ? 600 : 500,
              color: activeTab === "szczegoly" ? "var(--accent)" : "var(--text-mute)",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              borderBottom: activeTab === "szczegoly" ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: -1,
              background: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.15s ease",
            }}
          >
            <Building2 size={15} />
            Szczegóły szansy
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("wyceny")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: activeTab === "wyceny" ? 600 : 500,
              color: activeTab === "wyceny" ? "var(--accent)" : "var(--text-mute)",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              borderBottom: activeTab === "wyceny" ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: -1,
              background: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.15s ease",
            }}
          >
            <SlidersHorizontal size={15} />
            Wyceny i konfiguratory techniczne
            {configurationsList.length > 0 && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 20,
                  height: 20,
                  padding: "0 6px",
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 700,
                  background: activeTab === "wyceny" ? "var(--accent)" : "var(--line)",
                  color: activeTab === "wyceny" ? "#fff" : "var(--text)",
                }}
              >
                {configurationsList.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            color: "#dc2626",
            borderRadius: 6,
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      {activeTab === "szczegoly" && (
        <>
          {/* ── Główny horyzontalny box: Dane klienta + Adresy + Finanse i Rating — 4 kolumny ── */}
      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
        {/* Nagłówek */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>
          <span style={{ width: 4, height: 18, borderRadius: 3, background: "var(--accent)", flexShrink: 0 }} />
          <Building2 size={14} color="var(--accent)" />
          <span style={{ fontSize: 12.5, fontWeight: 800, color: "var(--text-strong)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Dane klienta, Finanse i Adresy
          </span>
        </div>

        {/* 4-kolumnowy układ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 0 }}>

          {/* Kolumna 1: Dane klienta */}
          <div style={{ padding: "14px 16px", borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ ...FIELD_LABEL, marginBottom: 6 }}>Dane kontaktowe</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <InlineEdit label="Imię" value={opp.firstName} onSave={(v) => save("firstName", v || null)} />
              <InlineEdit label="Nazwisko" value={opp.lastName} onSave={(v) => save("lastName", v || null)} />
              <InlineEdit label="E-mail" value={opp.email ?? ""} placeholder="—" onSave={(v) => save("email", v || null)} />
              <InlineEdit label="Telefon" value={opp.phone ?? ""} placeholder="—" onSave={(v) => save("phone", v || null)} />
            </div>
            <div style={{ marginTop: 4, paddingTop: 8, borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 8 }}>
              <InlineEdit
                label="Źródło leada (Od kogo)"
                value={opp.leadSource ?? ""}
                placeholder="np. Polecenie, FB, Przedstawiciel..."
                onSave={(v) => save("leadSource", v || null)}
              />
              <InlineEdit
                label="Identyfikator Kanban"
                value={opp.customText ?? ""}
                placeholder="np. KOWALSKI – Zabudowa tarasu"
                onSave={(v) => save("customText", v || null)}
              />
            </div>
          </div>

          {/* Kolumna 2: Adres klienta */}
          <div style={{ padding: "14px 16px", borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
              <p style={FIELD_LABEL}>Adres klienta</p>
              {mainMapsUrl && (
                <a href={mainMapsUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10.5, color: "#2563eb", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <MapPin size={11} /> Maps
                </a>
              )}
            </div>
            <AddressSearch onSelect={handleAddress} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <InlineEdit label="Ulica" value={opp.street ?? ""} placeholder="—" onSave={(v) => { save("street", v || null); if (sameAddress) save("investmentStreet", v || null); }} />
              <InlineEdit label="Nr bud. / mieszk." value={[opp.buildingNumber, opp.apartmentNumber].filter(Boolean).join("/")} placeholder="—" onSave={(v) => {
                const parts = v ? v.split("/") : [];
                save("buildingNumber", parts[0] || null);
                save("apartmentNumber", parts[1] || null);
                if (sameAddress) {
                  save("investmentBuildingNumber", parts[0] || null);
                  save("investmentApartmentNumber", parts[1] || null);
                }
              }} />
              <InlineEdit label="Kod pocztowy" value={opp.postalCode ?? ""} placeholder="—" onSave={(v) => { save("postalCode", v || null); if (sameAddress) save("investmentPostalCode", v || null); }} />
              <InlineEdit label="Miejscowość" value={opp.city ?? ""} placeholder="—" onSave={(v) => { save("city", v || null); if (sameAddress) save("investmentCity", v || null); }} />
            </div>
          </div>

          {/* Kolumna 3: Adres inwestycji + toggle */}
          <div style={{ padding: "14px 16px", borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
              <p style={FIELD_LABEL}>Adres inwestycji (montaż)</p>

              {/* Toggle „Taki sam jak klienta" */}
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}>
                <div
                  onClick={() => handleSameAddressToggle(!sameAddress)}
                  style={{
                    width: 30,
                    height: 16,
                    borderRadius: 8,
                    background: sameAddress ? "var(--accent)" : "var(--line)",
                    position: "relative",
                    flexShrink: 0,
                    cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                >
                  <div style={{
                    position: "absolute",
                    top: 2,
                    left: sameAddress ? 16 : 2,
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: "#fff",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                    transition: "left 0.2s",
                  }} />
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: sameAddress ? "var(--accent)" : "var(--text-mute)" }}>
                  Taki sam
                </span>
              </label>
            </div>

            {sameAddress ? (
              /* Kompaktowy box gdy adresy są takie same */
              <div style={{
                padding: "8px 10px",
                borderRadius: 8,
                background: "var(--accent-soft)",
                border: "1px solid rgba(74, 187, 195, 0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                  <MapPin size={13} color="var(--accent)" style={{ flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {mainAddressStr || "Identyczny jak adres klienta"}
                    </div>
                  </div>
                </div>
                {mainMapsUrl && (
                  <a href={mainMapsUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10.5, color: "var(--accent)", fontWeight: 700, textDecoration: "none", flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 2 }}>
                    Maps &rarr;
                  </a>
                )}
              </div>
            ) : (
              /* Pola adresu inwestycji */
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <AddressSearch onSelect={handleInvestmentAddress} />
                  </div>
                  {investmentMapsUrl && (
                    <a href={investmentMapsUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10.5, color: "#0284C7", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3 }}>
                      <MapPin size={11} /> Maps
                    </a>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <InlineEdit label="Ulica" value={opp.investmentStreet ?? ""} placeholder="—" onSave={(v) => save("investmentStreet", v || null)} />
                  <InlineEdit label="Nr bud. / mieszk." value={[opp.investmentBuildingNumber, opp.investmentApartmentNumber].filter(Boolean).join("/")} placeholder="—" onSave={(v) => {
                    const parts = v ? v.split("/") : [];
                    save("investmentBuildingNumber", parts[0] || null);
                    save("investmentApartmentNumber", parts[1] || null);
                  }} />
                  <InlineEdit label="Kod pocztowy" value={opp.investmentPostalCode ?? ""} placeholder="—" onSave={(v) => save("investmentPostalCode", v || null)} />
                  <InlineEdit label="Miejscowość" value={opp.investmentCity ?? ""} placeholder="—" onSave={(v) => save("investmentCity", v || null)} />
                </div>
              </>
            )}
          </div>

          {/* Kolumna 4 (ostatnia): Finanse i Rating */}
          <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ ...FIELD_LABEL, marginBottom: 6 }}>Finanse i Rating</p>

            {/* Kompaktowy grid: Donut po lewej, pola po prawej */}
            <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 8, alignItems: "stretch" }}>

              {/* Wykres donut ratingu */}
              <div style={{
                background: "var(--card)",
                borderRadius: 10,
                border: "1px solid var(--line)",
                padding: "6px 4px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                textAlign: "center",
              }}>
                <div style={{ position: "relative", width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="56" height="56" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="50" cy="50" r="40" fill="none" stroke="var(--line)" strokeWidth="14" />
                    {rating !== null && (
                      <circle
                        cx="50" cy="50" r="40"
                        fill="none"
                        stroke={ringColor}
                        strokeWidth="14"
                        strokeDasharray={strokeDasharray}
                        strokeLinecap="round"
                        style={{ transition: "stroke-dasharray 0.5s ease" }}
                      />
                    )}
                  </svg>
                  <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                    <span style={{ fontSize: 16, fontWeight: 900, color: "var(--text-strong)", fontVariantNumeric: "tabular-nums" }}>
                      {rating !== null ? rating : "—"}
                    </span>
                    <span style={{ fontSize: 7.5, fontWeight: 700, color: "var(--text-mute)", marginTop: 1, textTransform: "uppercase" }}>
                      {rating !== null ? "z 5" : "brak"}
                    </span>
                  </div>
                </div>
                {rating !== null ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 800, color: ringColor }}>
                      {dailyProfit !== null ? `${dailyProfit.toLocaleString("pl-PL")} zł/d` : "—"}
                    </div>
                    <div style={{ fontSize: 8.5, color: "var(--text-mute)", lineHeight: 1.1 }}>
                      {rating === 5 && "≥ 5k zł/d"}
                      {rating === 4 && "≥ 4k zł/d"}
                      {rating === 3 && "≥ 3k zł/d"}
                      {rating === 2 && "≥ 2k zł/d"}
                      {rating === 1 && "≥ 1k zł/d"}
                      {rating === 0 && "< 1k zł/d"}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 8.5, color: "var(--text-mute)", fontStyle: "italic" }}>Wpisz dane</div>
                )}
              </div>

              {/* Pola finansowe — Zarobek tylko dla admina */}
              <div style={{ background: "var(--card)", padding: 8, borderRadius: 10, border: "1px solid var(--line)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 8px", alignItems: "start" }}>
                <InlineEdit
                  label="Koszt (PLN)"
                  suffix=" zł"
                  value={opp.cost !== undefined && opp.cost !== null ? String(Math.round(opp.cost)) : ""}
                  placeholder="0"
                  onSave={(v) => {
                    const num = v ? parseFloat(v.replace(/,/g, ".")) : null;
                    if (num !== null && !isNaN(num)) {
                      const roundedCost = Math.round(num);
                      save("cost", roundedCost);
                      if (opp.price !== undefined && opp.price !== null) {
                        save("profit", Math.round(opp.price - roundedCost));
                      }
                    } else save("cost", null);
                  }}
                />
                <InlineEdit
                  label="Cena (PLN)"
                  suffix=" zł"
                  value={opp.price !== undefined && opp.price !== null ? String(Math.round(opp.price)) : ""}
                  placeholder="0"
                  onSave={(v) => {
                    const num = v ? parseFloat(v.replace(/,/g, ".")) : null;
                    if (num !== null && !isNaN(num)) {
                      const roundedPrice = Math.round(num);
                      save("price", roundedPrice);
                      if (opp.cost !== undefined && opp.cost !== null) {
                        save("profit", Math.round(roundedPrice - opp.cost));
                      }
                    } else save("price", null);
                  }}
                />
                <InlineEdit
                  label="Dni montażu"
                  suffix=" dni"
                  value={opp.workDays !== undefined && opp.workDays !== null ? String(opp.workDays) : ""}
                  placeholder="np. 2"
                  onSave={(v) => {
                    const num = v ? parseFloat(v.replace(/,/g, ".")) : null;
                    if (num !== null && !isNaN(num) && num >= 0) save("workDays", num);
                    else save("workDays", null);
                  }}
                />
                {isAdmin && (
                  <InlineEdit
                    label="Zarobek (PLN)"
                    suffix=" zł"
                    value={opp.profit !== undefined && opp.profit !== null ? String(Math.round(opp.profit)) : ""}
                    placeholder="0"
                    onSave={(v) => {
                      const num = v ? parseFloat(v.replace(/,/g, ".")) : null;
                      if (num !== null && !isNaN(num)) save("profit", Math.round(num));
                      else save("profit", null);
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Usługi (styl jak w zleceniu) ── */}
      <div style={{ background: "var(--accent-soft)", borderRadius: 12, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 4, height: 20, borderRadius: 3, background: "var(--accent)", flexShrink: 0 }} />
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--accent)" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.527-.639.856-1.434.938-2.275L15.23 4.28a2.25 2.25 0 00-2.25-2.25H4.28a2.25 2.25 0 00-2.25 2.25v8.702c0 .841.329 1.636.938 2.275l3.03 2.496c.639.527 1.434.856 2.275.938L11.42 15.17z" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-strong)", textTransform: "uppercase", letterSpacing: 0.6 }}>
              Wybrane usługi
            </span>
          </div>
          <button
            type="button"
            onClick={startEditServices}
            title="Dodaj lub zarządzaj usługami"
            className="btn"
            style={{ fontSize: 11.5, padding: "5px 12px", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}
          >
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {selectedServices.length > 0 ? "Zarządzaj usługami" : "Dodaj usługi"}
          </button>
        </div>

        {/* Panel wyboru usług */}
        {servicesList.length > 0 && editingServices && (
          <div
            style={{
              padding: 14,
              borderRadius: 12,
              border: "1px solid var(--accent-line)",
              background: "var(--accent-soft)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7, color: "var(--accent)" }}>
              Wybierz usługi przypisane do tej szansy
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {Array.from(new Set([
                ...servicesList.map((s) => s.name),
                ...selectedServices
              ])).map((svcName) => {
                const active = draftServices.includes(svcName);
                return (
                  <button
                    key={svcName}
                    type="button"
                    onClick={() => toggleDraftService(svcName)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      fontSize: 12.5,
                      fontWeight: 600,
                      padding: "6px 12px 6px 8px",
                      borderRadius: 10,
                      border: active ? "1px solid var(--accent)" : "1px solid var(--line)",
                      background: active ? "var(--accent)" : "var(--card)",
                      color: active ? "#fff" : "var(--text-strong)",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: active ? "rgba(255,255,255,0.2)" : "var(--panel-2)",
                        color: active ? "#fff" : "var(--text-mute)",
                        flexShrink: 0,
                      }}
                    >
                      <ServiceIcon name={svcName} />
                    </span>
                    {svcName}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={saveServices} className="btn primary btn-xs" style={{ padding: "5px 14px", fontSize: 11.5 }}>
                Zapisz usługi
              </button>
              <button onClick={cancelEditServices} className="btn btn-xs" style={{ padding: "5px 12px", fontSize: 11.5 }}>
                Anuluj
              </button>
            </div>
          </div>
        )}

        {/* Kafelki wybranych usług */}
        {selectedServices.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--text-mute)", padding: "16px", borderRadius: 10, background: "var(--panel-2)", border: "1px dashed var(--line)", textAlign: "center" }}>
            Brak przypisanych usług — kliknij <strong>&bdquo;Dodaj usługi&rdquo;</strong> powyżej, aby dodać zakres prac.
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {selectedServices.map((svcName) => (
              <div
                key={svcName}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  fontSize: 12.5,
                  fontWeight: 600,
                  padding: "6px 12px 6px 8px",
                  borderRadius: 10,
                  border: "1px solid var(--accent)",
                  background: "var(--accent)",
                  color: "#fff",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: "rgba(255,255,255,0.2)",
                    color: "#fff",
                    flexShrink: 0,
                  }}
                >
                  <ServiceIcon name={svcName} />
                </span>
                {svcName}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Skrót do wycen i konfiguratora technicznego ── */}
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: "#0F766E15",
              color: "#0F766E",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <SlidersHorizontal size={20} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-strong)" }}>
                Wyceny i konfiguratory techniczne
              </span>
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 12,
                  fontSize: 11,
                  fontWeight: 600,
                  background: configurationsList.length > 0 ? "#ecfdf5" : "#f1f5f9",
                  color: configurationsList.length > 0 ? "#047857" : "#64748b",
                  border: configurationsList.length > 0 ? "1px solid #a7f3d0" : "1px solid #e2e8f0",
                }}
              >
                {configurationsList.length > 0
                  ? `${configurationsList.length} ${configurationsList.length === 1 ? "skonfigurowana pozycja" : "skonfigurowane pozycje"}`
                  : "Brak skonfigurowanych pozycji"}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-mute)", marginTop: 2 }}>
              {configurationsList.length > 0
                ? "Wyceny pozycji (zadaszenia tarasów, zabudowy szklane) są aktywne w osobnym widoku. Kliknij, aby przejść do kalkulatora."
                : "Skorzystaj z kalkulatorów zadaszeń i zabudów, aby precyzyjnie wyliczyć koszt, marżę i cenę oferty."}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={() => handleTabChange("wyceny")}
            className="btn primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              padding: "7px 14px",
            }}
          >
            <SlidersHorizontal size={14} />
            {configurationsList.length > 0 ? "Otwórz wyceny i kalkulatory" : "Przejdź do wyceny"} &rarr;
          </button>
        </div>
      </div>

      {/* ── 2-kolumnowy układ: Pliki (po lewej) + Komentarz (po prawej) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Załączniki (Pliki) */}
        <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 14 }}>
          <OpportunityAttachmentsSection
            opportunityId={opportunityId}
            opportunityFolderId={opp.opportunityFolderId}
          />
        </div>

        {/* Komentarz / Feed notatek */}
        <OpportunityNotesFeed
          opportunityId={opportunityId}
          clientId={opp.clientId}
          initialComment={displayComment || opp.comment}
        />
      </div>
    </>
  )}

  {activeTab === "wyceny" && (
    <>
      {/* ── Pasek nawigacyjny i finansowy dla widoku wycen ── */}
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={() => handleTabChange("szczegoly")}
          className="btn"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            padding: "6px 12px",
          }}
        >
          <ArrowLeft size={13} />
          Wróć do szczegółów szansy
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ color: "var(--text-mute)" }}>Wartość oferty:</span>
            <span style={{ fontWeight: 700, color: "var(--text-strong)" }}>
              {opp.price !== undefined && opp.price !== null
                ? `${Number(opp.price).toLocaleString("pl-PL")} zł`
                : "—"}
            </span>
          </div>
          <div style={{ width: 1, height: 14, background: "var(--line)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ color: "var(--text-mute)" }}>Koszt:</span>
            <span style={{ fontWeight: 600, color: "var(--text)" }}>
              {opp.cost !== undefined && opp.cost !== null
                ? `${Number(opp.cost).toLocaleString("pl-PL")} zł`
                : "—"}
            </span>
          </div>
          {opp.profit !== undefined && opp.profit !== null && (
            <>
              <div style={{ width: 1, height: 14, background: "var(--line)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <span style={{ color: "var(--text-mute)" }}>Zysk szacowany:</span>
                <span
                  style={{
                    fontWeight: 700,
                    color: opp.profit >= 0 ? "var(--good, #16a34a)" : "var(--bad, #dc2626)",
                  }}
                >
                  {Number(opp.profit).toLocaleString("pl-PL")} zł
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Przełącznik modułów wyceny: PROKAL vs Zadaszenia ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: 10,
          padding: "8px 14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setConfiguratorWorkspaceMode("PROKAL")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              borderRadius: 6,
              fontSize: 12.5,
              fontWeight: configuratorWorkspaceMode === "PROKAL" ? 700 : 500,
              background: configuratorWorkspaceMode === "PROKAL" ? "#0284C7" : "transparent",
              color: configuratorWorkspaceMode === "PROKAL" ? "#FFFFFF" : "var(--text)",
              border: "none",
              cursor: "pointer",
            }}
          >
            <SlidersHorizontal size={14} />
            Systemy całoszklane przesuwne
          </button>

          <button
            type="button"
            onClick={() => setConfiguratorWorkspaceMode("TERRACE_ROOF")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              borderRadius: 6,
              fontSize: 12.5,
              fontWeight: configuratorWorkspaceMode === "TERRACE_ROOF" ? 700 : 500,
              background: configuratorWorkspaceMode === "TERRACE_ROOF" ? "#0284C7" : "transparent",
              color: configuratorWorkspaceMode === "TERRACE_ROOF" ? "#FFFFFF" : "var(--text)",
              border: "none",
              cursor: "pointer",
            }}
          >
            <Plus size={14} />
            Kalkulator Zadaszeń Tarasów
          </button>

          <button
            type="button"
            onClick={() => setConfiguratorWorkspaceMode("ALL_POSITIONS")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              borderRadius: 6,
              fontSize: 12.5,
              fontWeight: configuratorWorkspaceMode === "ALL_POSITIONS" ? 700 : 500,
              background: configuratorWorkspaceMode === "ALL_POSITIONS" ? "#0284C7" : "transparent",
              color: configuratorWorkspaceMode === "ALL_POSITIONS" ? "#FFFFFF" : "var(--text)",
              border: "none",
              cursor: "pointer",
            }}
          >
            Wszystkie pozycje szansy ({configurationsList.length})
          </button>
        </div>

        <Link
          href="/admin/ustawienia?tab=prokal"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 11.5,
            color: "var(--accent)",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          <Settings size={13} />
          Ustawienia komponentów i cennika &rarr;
        </Link>
      </div>

      {configuratorWorkspaceMode === "PROKAL" && (
        <ProkalConfigurator
          initialPositions={initialProkalPositions}
          onSavePositions={handleSaveProkalPositions}
          isSaving={isSavingConfig}
          clientInfo={{
            name: [opp.firstName, opp.lastName].filter(Boolean).join(" ") || opp.clientName,
            phone: opp.phone,
            email: opp.email,
            address: mainAddressStr,
            investmentAddress: investmentAddressStr,
            orderNumber: opp.submissionId ? `#${opp.submissionId}` : undefined,
            projectNumber: opp.leadSource || "Oferta CRM",
          }}
        />
      )}

      {configuratorWorkspaceMode !== "PROKAL" && (
        <>
          {/* ── Wyceny i konfiguratory techniczne ── */}
      {(() => {
        const configs: ServiceConfigItem[] =
          ((opp as unknown as Record<string, unknown>).serviceConfigurations as ServiceConfigItem[] | undefined) || [];
        const hasConfigurations = configs.length > 0;

        return (
          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Nagłówek sekcji */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, background: "#0F766E", color: "#fff" }}>
                  <SlidersHorizontal size={17} />
                </span>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", margin: 0 }}>
                    Wyceny i konfiguratory techniczne
                  </h3>
                  <p style={{ fontSize: 11, color: "#64748B", margin: 0 }}>
                    Kalkulatory ofertowe (Zadaszenia tarasów, Zabudowy szklane). Wartość szansy przelicza się automatycznie.
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {activeConfiguratorType === null ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleStartAdd("TERRACE_ROOF")}
                      className="btn"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 12px",
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 8,
                        background: "#ffffff",
                        border: "1px solid #CBD5E1",
                        color: "#0F172A",
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={14} className="text-teal-700" />
                      + Dodaj zadaszenie tarasu
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartAdd("GLASS_ENCLOSURE")}
                      className="btn"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 12px",
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 8,
                        background: "#0F766E",
                        border: "1px solid #0F766E",
                        color: "#ffffff",
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={14} />
                      + Dodaj zabudowę szklaną
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleCancelConfig}
                    className="btn"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 600,
                      borderRadius: 8,
                      background: "#ffffff",
                      border: "1px solid #E2E8F0",
                      color: "#64748B",
                      cursor: "pointer",
                    }}
                  >
                    <X size={14} />
                    Zamknij konfigurator
                  </button>
                )}
              </div>
            </div>

            {/* ── Aktywny moduł konfiguratora (Inline Expandable Form) ── */}
            {activeConfiguratorType !== null && (
              <div
                style={{
                  background: "#ffffff",
                  border: "2px solid #0F766E",
                  borderRadius: 12,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #E2E8F0", paddingBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0F766E" }}>
                      {editingConfigIndex !== null
                        ? `Edycja pozycji #${editingConfigIndex + 1}: ${configs[editingConfigIndex]?.serviceName || "Wycena"}`
                        : activeConfiguratorType === "TERRACE_ROOF"
                        ? "Nowa pozycja: Zadaszenie tarasu"
                        : "Nowa pozycja: Zabudowa szklana"}
                    </span>
                    <span style={{ fontSize: 11, color: "#64748B" }}>
                      (Wprowadź dane i zatwierdź przyciskiem poniżej)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelConfig}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: "#94A3B8",
                      padding: 4,
                      display: "flex",
                      alignItems: "center",
                    }}
                    title="Anuluj"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Komponent kalkulatora */}
                <div style={{ overflowX: "auto" }}>
                  {activeConfiguratorType === "TERRACE_ROOF" ? (
                    <TerraceRoofConfigurator
                      initialInput={editingConfigIndex !== null ? configs[editingConfigIndex]?.input : undefined}
                      clientType={opp.clientId ? "individual" : undefined}
                      onChange={(data) => setDraftConfigData(data)}
                    />
                  ) : (
                    <GlassEnclosureConfigurator
                      initialInput={editingConfigIndex !== null ? configs[editingConfigIndex]?.input : undefined}
                      onChange={(data) => setDraftConfigData(data)}
                    />
                  )}
                </div>

                {/* Pasek zatwierdzenia konfiguratora */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 12,
                    borderTop: "1px solid #E2E8F0",
                    background: "#F8FAFC",
                    margin: "-16px -16px -16px -16px",
                    padding: "12px 16px",
                    borderBottomLeftRadius: 10,
                    borderBottomRightRadius: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {draftConfigData?.result && (
                      <div style={{ fontSize: 12, color: "#475569" }}>
                        Wycena pozycji:{" "}
                        <strong style={{ fontSize: 14, color: "#0F766E" }}>
                          {formatPLN(
                            draftConfigData.result?.options?.polycarbonate?.totalNet ??
                            draftConfigData.result?.finalPriceNet ??
                            draftConfigData.result?.totalNet ??
                            draftConfigData.result?.totalNetPrice ??
                            draftConfigData.result?.totalClientNet ?? 0
                          )} netto
                        </strong>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      type="button"
                      onClick={handleCancelConfig}
                      className="btn"
                      style={{
                        padding: "7px 14px",
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 8,
                        background: "#ffffff",
                        border: "1px solid #CBD5E1",
                        color: "#475569",
                        cursor: "pointer",
                      }}
                    >
                      Anuluj
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveConfig}
                      disabled={!draftConfigData?.isValid || isSavingConfig}
                      className="btn"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "7px 16px",
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 8,
                        background: !draftConfigData?.isValid || isSavingConfig ? "#94A3B8" : "#0F766E",
                        border: "none",
                        color: "#ffffff",
                        cursor: !draftConfigData?.isValid || isSavingConfig ? "not-allowed" : "pointer",
                      }}
                    >
                      {isSavingConfig ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      <span>{editingConfigIndex !== null ? "Zaktualizuj pozycję w szansie" : "Zapisz wycenę i dodaj do szansy"}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Lista zapisanych wycen ── */}
            {hasConfigurations ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {configs.map((cfg: ServiceConfigItem, cIdx: number) => {
                  const sName = cfg.serviceName || `Usługa #${cIdx + 1}`;
                  const isGlass = cfg.calculatorType === "GLASS_ENCLOSURE" || sName.toLowerCase().includes("zabudow");
                  const isRoof = cfg.calculatorType === "terrace_roof" || sName.toLowerCase().includes("zadaszen");
                  const isBeingEdited = editingConfigIndex === cIdx && activeConfiguratorType !== null;

                  return (
                    <div
                      key={cIdx}
                      style={{
                        background: isBeingEdited ? "#F0FDFA" : "#ffffff",
                        border: isBeingEdited ? "2px solid #0F766E" : "1px solid #CBD5E1",
                        borderRadius: 10,
                        padding: 14,
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        transition: "all 0.2s ease",
                      }}
                    >
                      {/* Nagłówek pozycji */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, borderBottom: "1px solid #F1F5F9", paddingBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 6,
                              background: "#0F766E",
                              color: "#fff",
                              fontSize: 11,
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {cIdx + 1}
                          </span>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>{sName}</span>
                          {cfg.updatedAt && (
                            <span style={{ fontSize: 10.5, color: "#64748B" }}>
                              (Zaktualizowano: {new Date(cfg.updatedAt).toLocaleDateString("pl-PL")})
                            </span>
                          )}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {cfg.result && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
                              {cfg.result.installationNet !== undefined && (
                                <span style={{ color: "#0F766E", fontWeight: 600 }}>
                                  Montaż: {formatPLN(cfg.result.installationNet)}
                                </span>
                              )}
                              <span style={{ color: "#0F172A", fontWeight: 700, background: "#F1F5F9", padding: "3px 8px", borderRadius: 6, border: "1px solid #E2E8F0" }}>
                                Razem: {formatPLN(cfg.result.totalNetPrice ?? cfg.result.finalPriceNet ?? cfg.result.totalNet ?? cfg.result.totalClientNet ?? cfg.result.totalPriceNet ?? 0)} netto
                              </span>
                            </div>
                          )}

                          {/* Akcje dla pozycji: Edytuj & Usuń */}
                          <button
                            type="button"
                            onClick={() => handleStartEdit(cIdx)}
                            className="btn"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "4px 8px",
                              fontSize: 11,
                              fontWeight: 600,
                              borderRadius: 6,
                              background: "#ffffff",
                              border: "1px solid #CBD5E1",
                              color: "#1E293B",
                              cursor: "pointer",
                            }}
                            title="Edytuj tę wycenę"
                          >
                            <Pencil size={12} className="text-teal-700" />
                            Edytuj
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteConfig(cIdx)}
                            className="btn"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "4px 8px",
                              fontSize: 11,
                              fontWeight: 600,
                              borderRadius: 6,
                              background: "#ffffff",
                              border: "1px solid #FCA5A5",
                              color: "#DC2626",
                              cursor: "pointer",
                            }}
                            title="Usuń tę wycenę"
                          >
                            <Trash2 size={12} />
                            Usuń
                          </button>
                        </div>
                      </div>

                      {/* Szczegóły dla Zabudowy Szklanej */}
                      {isGlass && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {/* Ścianki */}
                          {cfg.input?.walls && cfg.input.walls.length > 0 && (
                            <div>
                              <span style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                                Ścianki szklane ({cfg.input.walls.length} szt.)
                              </span>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 6 }}>
                                {cfg.input.walls.map((w: ServiceConfigWall, wIdx: number) => {
                                  const wRes = cfg.result?.walls?.find((item) => item.id === w.id);
                                  const typeName = w.type === "FRONT" ? "Ścianka frontowa" : "Ścianka boczna";
                                  return (
                                    <div
                                      key={w.id || wIdx}
                                      style={{
                                        background: "#F8FAFC",
                                        border: "1px solid #E2E8F0",
                                        borderRadius: 6,
                                        padding: "6px 8px",
                                        fontSize: 11,
                                      }}
                                    >
                                      <div style={{ fontWeight: 700, color: "#1E293B" }}>
                                        #{wIdx + 1} {typeName} {w.quantity && w.quantity > 1 ? `(x${w.quantity} szt.)` : ""}
                                      </div>
                                      <div style={{ color: "#475569", marginTop: 2 }}>
                                        Wymiary: <strong>{w.widthCm} × {w.heightCm} cm</strong>
                                        {wRes?.areaSqm && ` (${wRes.areaSqm.toFixed(2)} m²)`}
                                      </div>
                                      {wRes && (
                                        <div style={{ color: "#0F766E", marginTop: 2, fontSize: 10.5 }}>
                                          Profil std: {wRes.standardWidthCm} cm | Materiał: {formatPLN(wRes.unitClientNet * (w.quantity || 1))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Lamele i dodatki */}
                          {cfg.input?.accessories && cfg.input.accessories.length > 0 && (
                            <div>
                              <span style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                                Lamele i dodatki ({cfg.input.accessories.length} szt.)
                              </span>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 6 }}>
                                {cfg.input.accessories.map((a: ServiceConfigAccessory, aIdx: number) => {
                                  const aRes = cfg.result?.accessories?.find((item) => item.id === a.id);
                                  return (
                                    <div
                                      key={a.id || aIdx}
                                      style={{
                                        background: "#F8FAFC",
                                        border: "1px solid #E2E8F0",
                                        borderRadius: 6,
                                        padding: "6px 8px",
                                        fontSize: 11,
                                      }}
                                    >
                                      <div style={{ fontWeight: 700, color: "#1E293B" }}>
                                        #{aIdx + 1} {aRes?.name || "Dodatek"} {a.quantity && a.quantity > 1 ? `(x${a.quantity} szt.)` : ""}
                                      </div>
                                      {aRes?.effectiveWidthCm && (
                                        <div style={{ color: "#475569", marginTop: 2 }}>
                                          Szerokość: <strong>{aRes.effectiveWidthCm} cm</strong>
                                          {aRes.linkedWallLabel && ` [ze ściany: ${aRes.linkedWallLabel}]`}
                                        </div>
                                      )}
                                      {aRes && (
                                        <div style={{ color: "#0F766E", marginTop: 2, fontSize: 10.5 }}>
                                          Razem: {formatPLN(aRes.totalClientNet)}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Szczegóły dla Zadaszenia tarasu */}
                      {isRoof && cfg.input && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "8px 10px" }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", display: "block" }}>Wymiary (Szer. × Głęb.)</span>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0F172A" }}>
                              {cfg.input.widthCm} cm × {cfg.input.depthCm} cm
                            </span>
                          </div>
                          {cfg.result?.input?.areaSqM && (
                            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "8px 10px" }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", display: "block" }}>Powierzchnia zadaszenia</span>
                              <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0F766E" }}>
                                {Number(cfg.result.input.areaSqM).toFixed(2)} m²
                              </span>
                            </div>
                          )}
                          {cfg.input.materialMarkupPercent && (
                            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "8px 10px" }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", display: "block" }}>Narzut materiału</span>
                              <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0F172A" }}>
                                {cfg.input.materialMarkupPercent}%
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Szczegóły dla Systemu Całoszklanego */}
                      {cfg.calculatorType === "PROKAL_SLIDING" && cfg.result && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "8px 10px" }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", display: "block" }}>Wymiary (Szer. × Wys.)</span>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0F172A" }}>
                              {cfg.input?.widthMm ?? cfg.result.widthMm} mm × {cfg.input?.heightMm ?? cfg.result.heightMm} mm
                            </span>
                          </div>
                          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "8px 10px" }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", display: "block" }}>Tory i skrzydła</span>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0F766E" }}>
                              {cfg.result.tracksCount}-torowy ({cfg.result.sashesCount} skrzydeł)
                            </span>
                          </div>
                          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "8px 10px" }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", display: "block" }}>Szkło i waga</span>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0F172A" }}>
                              {cfg.result.glassCode} ({cfg.result.totalGlassAreaSqM} m², {cfg.result.totalWeightKg} kg)
                            </span>
                          </div>
                          {cfg.result.excelPricing && (
                            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "8px 10px" }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", display: "block" }}>Cena z cennika Excel</span>
                              <span style={{ fontSize: 12.5, fontWeight: 700, color: "#059669" }}>
                                {formatPLN(cfg.result.totalPriceNet)} netto
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : activeConfiguratorType === null ? (
              /* Empty state gdy brak konfiguracji i brak aktywnego edytora */
              parsedConfig ? (
                /* Fallback dla zgłoszeń z JotForm z parametrami tekstowymi */
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                  {parsedConfig?.variant && (
                    <div style={{ background: "#ffffff", border: "1px solid #CBD5E1", borderRadius: 6, padding: "8px 10px" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", display: "block" }}>Wybrany wariant (Jotform)</span>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0F172A" }}>{parsedConfig.variant}</span>
                    </div>
                  )}
                  {parsedConfig?.dimensions && (
                    <div style={{ background: "#ffffff", border: "1px solid #CBD5E1", borderRadius: 6, padding: "8px 10px" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", display: "block" }}>Wymiary (Jotform)</span>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0F172A" }}>{parsedConfig.dimensions}</span>
                    </div>
                  )}
                  {parsedConfig?.area && (
                    <div style={{ background: "#ffffff", border: "1px solid #CBD5E1", borderRadius: 6, padding: "8px 10px" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", display: "block" }}>Powierzchnia (Jotform)</span>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0F766E" }}>{parsedConfig.area}</span>
                    </div>
                  )}
                  {parsedConfig?.options && (
                    <div style={{ gridColumn: "span 2", background: "#ffffff", border: "1px solid #CBD5E1", borderRadius: 6, padding: "8px 10px" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", display: "block" }}>Wyposażenie dodatkowe (Jotform)</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#1E293B" }}>{parsedConfig.options}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    background: "#ffffff",
                    border: "1px dashed #CBD5E1",
                    borderRadius: 10,
                    padding: "24px 16px",
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B" }}>
                    <SlidersHorizontal size={18} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
                    Brak skonfigurowanych wycen dla tej szansy
                  </div>
                  <div style={{ fontSize: 11.5, color: "#64748B", maxWidth: 420 }}>
                    Dodaj wycenę zadaszenia tarasu lub zabudowy szklanej za pomocą powyższych przycisków, aby precyzyjnie wyliczyć koszt, cenę oraz zysk szansy sprzedaży.
                  </div>
                </div>
              )
            ) : null}
          </div>
        );
      })()}
        </>
      )}
    </>
  )}

      {/* Modal Potwierdzenia usuwania */}
      {confirmDelete && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            background: "rgba(15,23,42,0.5)",
          }}
          onClick={() => setConfirmDelete(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              padding: 20,
              maxWidth: 400,
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
              Usunąć szansę sprzedaży?
            </h3>
            <p style={{ fontSize: 12.5, color: "var(--text-mute)", margin: 0 }}>
              {"Operacja nieodwracalna. Je\u015bli chcesz tylko schowa\u0107 szans\u0119 z listy, u\u017cyj \u201eArchiwizuj\u201d."}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
              <button onClick={() => setConfirmDelete(false)} className="btn">
                Anuluj
              </button>
              <button
                onClick={() => {
                  setConfirmDelete(false);
                  void handleDelete();
                }}
                className="btn"
                style={{ background: "#ef4444", color: "#fff", borderColor: "#dc2626" }}
              >
                Usuń
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal powiadomienia o zapisie wyceny */}
      {feedbackModal?.isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            background: "rgba(15,23,42,0.5)",
            backdropFilter: "blur(2px)",
          }}
          onClick={() => setFeedbackModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: 24,
              maxWidth: 420,
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: "50%",
                  background: feedbackModal.type === "success" ? "#ecfdf5" : "#fef2f2",
                  color: feedbackModal.type === "success" ? "#059669" : "#dc2626",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {feedbackModal.type === "success" ? <Check size={22} /> : <X size={22} />}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
                  {feedbackModal.title}
                </h3>
                <p style={{ fontSize: 13, color: "var(--text-mute)", margin: "6px 0 0 0", lineHeight: 1.5 }}>
                  {feedbackModal.message}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setFeedbackModal(null)}
                className="btn"
                style={{
                  background: feedbackModal.type === "success" ? "#0284c7" : "#475569",
                  color: "#ffffff",
                  border: "none",
                  padding: "8px 20px",
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Rozumiem
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
