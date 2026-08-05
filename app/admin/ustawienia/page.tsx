"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useAction } from "convex/react";
import { deriveStatusStyle, makeCustomStatusKey, type StatusDef } from "@/lib/statuses";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import type { Id } from "@/convex/_generated/dataModel";
import ModalPortal from "@/components/ModalPortal";
import { X } from "lucide-react";
import { ITKanbanTab } from "./ITKanbanTab";
import { EventTypesTab } from "./EventTypesTab";
import { InstallationTeamsTab } from "./InstallationTeamsTab";

type Tab = "google-drive" | "jotform" | "fakturownia" | "szablony" | "sms" | "crm" | "logi" | "uslugi" | "dostawcy" | "wydatki" | "it-kanban" | "typy-wydarzen" | "ekipy-montazowe";

const EMPTY_TEMPLATE = {
  type: "custom",
  key: "",
  name: "",
  googleDriveFileId: "",
  fileNamePattern: "",
};

const TEMPLATE_TYPES = [
  ["pomiar", "pomiar", "Pomiar", "Pomiar_{{firstName}}_{{lastName}}_{{city}}"],
  ["umowa", "umowa", "Umowa", "Umowa_{{firstName}}_{{lastName}}_{{city}}"],
  [
    "gwarancja",
    "gwarancja_",
    "Gwarancja",
    "Gwarancja_{{firstName}}_{{lastName}}_{{city}}",
  ],
  [
    "odbior_inwestor",
    "odbior_inwestor",
    "Odbior inwestor",
    "Odbior_{{firstName}}_{{lastName}}_{{city}}",
  ],
  [
    "protokol_montaz",
    "protokol_montaz",
    "Protokol montazu",
    "OdMontazysty_{{firstName}}_{{lastName}}_{{city}}",
  ],
  [
    "faktura",
    "faktura",
    "Faktura",
    "Faktura_{{firstName}}_{{lastName}}_{{city}}",
  ],
  [
    "reklamacja",
    "reklamacja",
    "Reklamacja",
    "Reklamacja_{{firstName}}_{{lastName}}_{{city}}",
  ],
  ["custom", "", "Inny / wlasny", ""],
] as const;

const siteUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL?.replace(".cloud", ".site") ?? "";

// --- Status indicator component ---

function StatusDot({ status }: { status: string | undefined }) {
  switch (status) {
    case "connected":
      return (
        <span
          className="inline-block w-3 h-3 rounded-full bg-green-500"
          title="Polaczono"
        />
      );
    case "token_expiring":
      return (
        <span
          className="inline-block w-3 h-3 rounded-full bg-yellow-500"
          title="Token wygasa"
        />
      );
    case "expired":
    case "refresh_failed":
      return (
        <span
          className="inline-block w-3 h-3 rounded-full bg-red-500"
          title="Token wygasl"
        />
      );
    case "disconnected":
      return (
        <span
          className="inline-block w-3 h-3 rounded-full bg-slate-400"
          title="Rozlaczono"
        />
      );
    case "error":
      return (
        <span className="text-red-500 font-bold text-sm" title="Blad">
          ✕
        </span>
      );
    default:
      return (
        <span
          className="inline-block w-3 h-3 rounded-full bg-slate-300"
          title="Nieznany"
        />
      );
  }
}

// --- Relative time helper ---

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = timestamp - now;
  const absDiff = Math.abs(diff);

  const minutes = Math.floor(absDiff / 60000);
  const hours = Math.floor(absDiff / 3600000);

  if (diff > 0) {
    // Future
    if (hours > 0) return `za ${hours} godz. ${minutes % 60} min`;
    return `za ${minutes} min`;
  }
  // Past
  if (hours > 0) return `${hours} godz. ${minutes % 60} min temu`;
  if (minutes > 0) return `${minutes} min temu`;
  return "przed chwila";
}

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function getDriveStatusMeta(status: string | undefined) {
  switch (status) {
    case "connected":
      return {
        label: "Polaczono",
        tone: "bg-green-50 text-green-700 border-green-200",
        hint: "Google Drive jest gotowy do tworzenia folderow i dokumentow.",
      };
    case "token_expiring":
      return {
        label: "Token wygasa",
        tone: "bg-amber-50 text-amber-700 border-amber-200",
        hint: "Token wciaz dziala, ale powinien zostac odswiezony.",
      };
    case "refreshing":
      return {
        label: "Odswiezanie tokenu",
        tone: "bg-blue-50 text-blue-700 border-blue-200",
        hint: "Trwa automatyczne odnawianie dostepu do Google Drive.",
      };
    case "expired":
      return {
        label: "Token wygasl",
        tone: "bg-amber-50 text-amber-700 border-amber-200",
        hint: "Dostep wygasl. Odswiez token lub polacz konto ponownie.",
      };
    case "refresh_failed":
      return {
        label: "Wymaga ponownego polaczenia",
        tone: "bg-red-50 text-red-700 border-red-200",
        hint: "Refresh token nie zadzialal. Najpewniej trzeba polaczyc konto od nowa.",
      };
    case "error":
      return {
        label: "Blad polaczenia",
        tone: "bg-red-50 text-red-700 border-red-200",
        hint: "Google Drive zwrocil blad. Sprawdz polaczenie i uprawnienia.",
      };
    default:
      return {
        label: "Nieznany stan",
        tone: "bg-slate-50 text-slate-700 border-slate-200",
        hint: "Stan polaczenia nie zostal jeszcze okreslony.",
      };
  }
}

// --- Google Drive Tab ---

function GoogleDriveTab() {
  const connection = useQuery(api.googleDrive.getConnectionStatus);
  const disconnect = useMutation(api.googleDrive.disconnect);
  const healthCheck = useAction(api.googleDrive.healthCheck);
  const refreshAccessToken = useAction(api.googleDrive.refreshAccessToken);
  const listDrives = useAction(api.googleDrive.listSharedDrives);
  const listFolders = useAction(api.googleDrive.listFolders);
  const saveSharedDriveConfig = useMutation(
    api.googleDrive.saveSharedDriveConfig,
  );

  const [healthLoading, setHealthLoading] = useState(false);
  const [healthResult, setHealthResult] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [drives, setDrives] = useState<Array<{
    id: string;
    name: string;
  }> | null>(null);
  const [drivesLoading, setDrivesLoading] = useState(false);
  const [templateFolders, setTemplateFolders] = useState<Array<{
    id: string;
    name: string;
  }> | null>(null);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [sharedDriveIdInput, setSharedDriveIdInput] = useState<string>();
  const [templateFolderIdInput, setTemplateFolderIdInput] = useState<string>();

  const config = useQuery(api.crmConfig.getConfig);
  const saveFoldersConfig = useMutation(api.crmConfig.saveGoogleDriveFoldersConfig);
  const templates = useQuery(api.documentTemplates.list);
  const updateTemplateTargetFolder = useMutation(api.documentTemplates.updateTargetFolder);

  const [oppValuation, setOppValuation] = useState("");
  const [oppReceived, setOppReceived] = useState("");
  const [oppSent, setOppSent] = useState("");
  const [oppPonzio, setOppPonzio] = useState("");

  const [orderInvoices, setOrderInvoices] = useState("");
  const [orderDocs, setOrderDocs] = useState("");
  const [orderMeasurements, setOrderMeasurements] = useState("");
  const [customFolders, setCustomFolders] = useState<string[]>([]);
  const [customOppFolders, setCustomOppFolders] = useState<string[]>([]);
  const [foldersNotice, setFoldersNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [savingFolders, setSavingFolders] = useState(false);

  const templatesByFolder = useMemo(() => {
    const groups: Record<string, typeof templates> = {};
    if (!templates) return groups;

    const validFolders = new Set([
      oppValuation.trim(),
      oppReceived.trim(),
      oppSent.trim(),
      oppPonzio.trim(),
      ...customOppFolders.map((f) => f.trim()),
      orderInvoices.trim(),
      orderDocs.trim(),
      orderMeasurements.trim(),
      ...customFolders.map((f) => f.trim()),
    ]);

    for (const t of templates) {
      const tf = t.targetFolder?.trim() ?? "";
      if (tf && validFolders.has(tf)) {
        if (!groups[tf]) groups[tf] = [];
        groups[tf]!.push(t);
      } else {
        if (!groups[""]) groups[""] = [];
        groups[""]!.push(t);
      }
    }
    return groups;
  }, [templates, oppValuation, oppReceived, oppSent, oppPonzio, customOppFolders, orderInvoices, orderDocs, orderMeasurements, customFolders]);

  const renderMoveDropdown = (t: NonNullable<typeof templates>[number]) => {
    return (
      <select
        value={t.targetFolder ?? ""}
        onChange={async (e) => {
          try {
            await updateTemplateTargetFolder({
              id: t._id,
              targetFolder: e.target.value || undefined,
            });
          } catch (err) {
            console.error("Failed to move template", err);
          }
        }}
        className="ml-2 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[10px] text-slate-500 hover:text-slate-700 hover:border-slate-300 focus:outline-none transition-all cursor-pointer font-sans"
      >
        <option value="">📁 Przenieś do...</option>
        <option value="">Główny folder klienta</option>
        <optgroup label="Szansa Sprzedaży">
          {oppValuation && <option value={oppValuation}>{oppValuation}</option>}
          {oppReceived && <option value={oppReceived}>{oppReceived}</option>}
          {oppSent && <option value={oppSent}>{oppSent}</option>}
          {oppPonzio && <option value={oppPonzio}>{oppPonzio}</option>}
          {customOppFolders.map((f) => f.trim() && <option key={f} value={f.trim()}>{f.trim()}</option>)}
        </optgroup>
        <optgroup label="Zlecenie">
          {orderInvoices && <option value={orderInvoices}>{orderInvoices}</option>}
          {orderDocs && <option value={orderDocs}>{orderDocs}</option>}
          {orderMeasurements && <option value={orderMeasurements}>{orderMeasurements}</option>}
          {customFolders.map((f) => f.trim() && <option key={f} value={f.trim()}>{f.trim()}</option>)}
        </optgroup>
      </select>
    );
  };

  const renderAssignTemplateDropdown = (folderName: string) => {
    if (!templates) return null;
    const availableTemplates = templates.filter(
      (t) => (t.targetFolder?.trim() ?? "") !== folderName.trim()
    );
    if (availableTemplates.length === 0) return null;

    return (
      <select
        value=""
        onChange={async (e) => {
          const val = e.target.value;
          if (!val) return;
          try {
            await updateTemplateTargetFolder({
              id: val as Id<"documentTemplates">,
              targetFolder: folderName || undefined,
            });
          } catch (err) {
            console.error("Failed to assign template", err);
          }
        }}
        className="ml-2 text-[9px] font-sans text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 hover:border-amber-300 rounded px-1.5 py-0.5 transition-all cursor-pointer focus:outline-none opacity-0 group-hover:opacity-100 font-medium"
      >
        <option value="">+ Przypisz szablon</option>
        {availableTemplates.map((t) => (
          <option key={t._id} value={t._id}>
            {t.name}
          </option>
        ))}
      </select>
    );
  };

  const renderUnassignButton = (t: NonNullable<typeof templates>[number]) => {
    return (
      <button
        type="button"
        onClick={async () => {
          try {
            await updateTemplateTargetFolder({
              id: t._id,
              targetFolder: undefined,
            });
          } catch (err) {
            console.error("Failed to unassign template", err);
          }
        }}
        className="ml-1 text-red-500 hover:text-red-700 p-0.5 rounded transition-all focus:outline-none"
        title="Usuń powiązanie z folderem"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    );
  };

  const handleAddCustomFolder = () => {
    setCustomFolders((prev) => [...prev, "Nowy folder"]);
  };

  const handleUpdateCustomFolder = (index: number, name: string) => {
    setCustomFolders((prev) =>
      prev.map((f, i) => (i === index ? name : f))
    );
  };

  const handleDeleteCustomFolder = (index: number) => {
    setCustomFolders((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddCustomOppFolder = () => {
    setCustomOppFolders((prev) => [...prev, "Nowy folder"]);
  };

  const handleUpdateCustomOppFolder = (index: number, name: string) => {
    setCustomOppFolders((prev) =>
      prev.map((f, i) => (i === index ? name : f))
    );
  };

  const handleDeleteCustomOppFolder = (index: number) => {
    setCustomOppFolders((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (config) {
      const folders = config.googleDriveFolders ?? {
        opportunity: {
          valuationFiles: "Pliki do wyceny od klienta - rzuty i przysłane",
          offersReceived: "Koszta - oferty od dostawców",
          offersSent: "Oferty - wysłane do Klienta",
          ponzioFiles: "Ponzio - pliki",
          customSubfolders: [],
        },
        order: {
          invoices: "Faktury - sprzedażowe, kosztowe, potwierdzenia, zamówienia",
          documents: "Dokumenty - gwarancje, protokoły, umowy",
          measurements: "Pomiary - ustalenia",
          customSubfolders: [
            "Zdjęcia budowy",
            "Rysunki konstrukcji do zamówienia"
          ]
        },
      };

      const oppFolders = folders.opportunity ?? {
        valuationFiles: "Pliki do wyceny od klienta - rzuty i przysłane",
        offersReceived: "Koszta - oferty od dostawców",
        offersSent: "Oferty - wysłane do Klienta",
        ponzioFiles: "Ponzio - pliki",
        customSubfolders: [],
      };

      const orderFolders = folders.order ?? {
        invoices: "Faktury - sprzedażowe, kosztowe, potwierdzenia, zamówienia",
        documents: "Dokumenty - gwarancje, protokoły, umowy",
        measurements: "Pomiary - ustalenia",
        customSubfolders: [
          "Zdjęcia budowy",
          "Rysunki konstrukcji do zamówienia"
        ]
      };

      const legacyCustomFolders = (config?.googleDriveFolders as Record<string, unknown> | undefined)?.customSubfolders as string[] | undefined;

      setOppValuation(oppFolders.valuationFiles);
      setOppReceived(oppFolders.offersReceived);
      setOppSent(oppFolders.offersSent);
      setOppPonzio(oppFolders.ponzioFiles);
      setCustomOppFolders(oppFolders.customSubfolders ?? []);

      setOrderInvoices(orderFolders.invoices);
      setOrderDocs(orderFolders.documents);
      setOrderMeasurements(orderFolders.measurements);
      setCustomFolders(orderFolders.customSubfolders ?? legacyCustomFolders ?? []);
    }
  }, [config]);

  const handleSaveFolders = async () => {
    setSavingFolders(true);
    setFoldersNotice(null);
    try {
      await saveFoldersConfig({
        googleDriveFolders: {
          opportunity: {
            valuationFiles: oppValuation.trim() || "Pliki do wyceny od klienta - rzuty i przysłane",
            offersReceived: oppReceived.trim() || "Koszta - oferty od dostawców",
            offersSent: oppSent.trim() || "Oferty - wysłane do Klienta",
            ponzioFiles: oppPonzio.trim() || "Ponzio - pliki",
            customSubfolders: customOppFolders.map((f) => f.trim()).filter((f) => f.length > 0),
          },
          order: {
            invoices: orderInvoices.trim() || "Faktury - sprzedażowe, kosztowe, potwierdzenia, zamówienia",
            documents: orderDocs.trim() || "Dokumenty - gwarancje, protokoły, umowy",
            measurements: orderMeasurements.trim() || "Pomiary - ustalenia",
            customSubfolders: customFolders.map((f) => f.trim()).filter((f) => f.length > 0),
          },
        },
      });
      setFoldersNotice({ type: "success", text: "Konfiguracja folderów została zapisana!" });
    } catch (e) {
      setFoldersNotice({ type: "error", text: e instanceof Error ? e.message : "Błąd zapisu" });
    } finally {
      setSavingFolders(false);
    }
  };

  const effectiveSharedDriveId =
    sharedDriveIdInput ?? connection?.sharedDriveId ?? "";
  const effectiveTemplateFolderId =
    templateFolderIdInput ?? connection?.templatesFolderId ?? "";

  const driveStatus = getDriveStatusMeta(connection?.connectionStatus);

  const selectedDriveName = useMemo(
    () => drives?.find((drive) => drive.id === effectiveSharedDriveId)?.name,
    [drives, effectiveSharedDriveId],
  );

  const selectedTemplateFolderName = useMemo(
    () =>
      templateFolders?.find((folder) => folder.id === effectiveTemplateFolderId)
        ?.name,
    [templateFolders, effectiveTemplateFolderId],
  );

  const handleHealthCheck = useCallback(async () => {
    setHealthLoading(true);
    setHealthResult(null);
    setNotice(null);
    try {
      const result = await healthCheck();
      setHealthResult(
        result.status === "connected"
          ? "Polaczenie dziala poprawnie"
          : (result.error ?? `Status polaczenia: ${result.status}`),
      );
    } catch (error: unknown) {
      setHealthResult(`Blad: ${getErrorMessage(error, "Nieznany blad")}`);
    } finally {
      setHealthLoading(false);
    }
  }, [healthCheck]);

  const handleDisconnect = useCallback(async () => {
    if (!confirm("Czy na pewno chcesz rozlaczyc Google Drive?")) return;
    setDisconnecting(true);
    setNotice(null);
    try {
      await disconnect();
      setNotice({ type: "success", text: "Google Drive zostal rozlaczony." });
    } catch (error: unknown) {
      setNotice({
        type: "error",
        text: `Blad rozlaczania: ${getErrorMessage(error, "Nieznany blad")}`,
      });
    } finally {
      setDisconnecting(false);
    }
  }, [disconnect]);

  const handleLoadDrives = useCallback(async () => {
    setDrivesLoading(true);
    setNotice(null);
    try {
      const result = await listDrives();
      setDrives(Array.isArray(result) ? result : []);
    } catch (error: unknown) {
      setNotice({
        type: "error",
        text: `Blad ladowania dyskow: ${getErrorMessage(error, "Nieznany blad")}`,
      });
    } finally {
      setDrivesLoading(false);
    }
  }, [listDrives]);

  const handleConnect = () => {
    const appUrl = encodeURIComponent(window.location.origin);
    const authUrl = `${siteUrl}/api/google-drive/auth?appUrl=${appUrl}`;
    window.open(authUrl, "_blank");
  };

  const handleLoadTemplateFolders = useCallback(async () => {
    if (!connection?.sharedDriveId) return;

    setFoldersLoading(true);
    setNotice(null);
    try {
      const result = await listFolders({ driveId: connection.sharedDriveId });
      setTemplateFolders(Array.isArray(result) ? result : []);
    } catch (error: unknown) {
      setNotice({
        type: "error",
        text: `Blad folderow: ${getErrorMessage(error, "Nieznany blad")}`,
      });
    } finally {
      setFoldersLoading(false);
    }
  }, [connection?.sharedDriveId, listFolders]);

  const handleRefreshToken = useCallback(async () => {
    setRefreshing(true);
    setNotice(null);
    try {
      await refreshAccessToken();
      setNotice({
        type: "success",
        text: "Token Google Drive zostal odswiezony.",
      });
    } catch (error: unknown) {
      setNotice({
        type: "error",
        text: `Blad odswiezania: ${getErrorMessage(error, "Nieznany blad")}`,
      });
    } finally {
      setRefreshing(false);
    }
  }, [refreshAccessToken]);

  const handleSaveSharedDrive = useCallback(async () => {
    if (!effectiveSharedDriveId.trim()) return;
    setNotice(null);
    try {
      await saveSharedDriveConfig({
        sharedDriveId: effectiveSharedDriveId.trim(),
      });
      setSharedDriveIdInput(undefined);
      setNotice({ type: "success", text: "Dysk wspoldzielony zapisany." });
    } catch (error: unknown) {
      setNotice({
        type: "error",
        text: `Blad zapisu dysku: ${getErrorMessage(error, "Nieznany blad")}`,
      });
    }
  }, [effectiveSharedDriveId, saveSharedDriveConfig]);

  const handleSaveTemplatesFolder = useCallback(async () => {
    if (!effectiveTemplateFolderId.trim()) return;
    setNotice(null);
    try {
      await saveSharedDriveConfig({
        templatesFolderId: effectiveTemplateFolderId.trim(),
      });
      setTemplateFolderIdInput(undefined);
      setNotice({ type: "success", text: "Folder szablonow zapisany." });
    } catch (error: unknown) {
      setNotice({
        type: "error",
        text: `Blad zapisu folderu: ${getErrorMessage(error, "Nieznany blad")}`,
      });
    }
  }, [effectiveTemplateFolderId, saveSharedDriveConfig]);

  // Loading state
  if (connection === undefined) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-slate-200 rounded w-1/3" />
          <div className="h-4 bg-slate-200 rounded w-1/2" />
          <div className="h-10 bg-slate-200 rounded w-48" />
        </div>
      </div>
    );
  }

  // Not connected state
  if (!connection || connection.connectionStatus === "disconnected") {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-8">
        <div className="text-center max-w-md mx-auto">
          <div className="mb-4">
            <svg
              className="mx-auto h-16 w-16 text-slate-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Google Drive nie jest polaczony
          </h3>
          <p className="text-sm text-slate-500 mb-6">
            Polacz konto Google Drive, aby generowac dokumenty i przechowywac
            pliki klientow automatycznie.
          </p>
          <button
            onClick={handleConnect}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972a6.033 6.033 0 110-12.064c1.498 0 2.866.549 3.921 1.453l2.814-2.814A9.969 9.969 0 0012.545 2C7.021 2 2.543 6.477 2.543 12s4.478 10 10.002 10c8.396 0 10.249-7.85 9.426-11.748l-9.426-.013z" />
            </svg>
            Polacz z Google Drive
          </button>
        </div>
      </div>
    );
  }

  // Connected state
  return (
    <div className="space-y-4">
      {notice && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            notice.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Connection status card */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <StatusDot status={connection.connectionStatus} />
              <h3 className="text-base font-semibold text-slate-900">
                {driveStatus.label}
              </h3>
            </div>
            <div
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${driveStatus.tone}`}
            >
              {driveStatus.hint}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleHealthCheck}
              disabled={healthLoading}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {healthLoading ? "Sprawdzanie..." : "Testuj polaczenie"}
            </button>
            <button
              onClick={handleRefreshToken}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {refreshing ? "Odswiezanie..." : "Odnów token"}
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="inline-flex items-center gap-2 rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {disconnecting ? "Rozlaczanie..." : "Rozlacz"}
            </button>
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <dt className="text-slate-500">Email</dt>
            <dd className="text-slate-900 font-medium mt-0.5">
              {connection.connectedEmail}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Polaczony przez</dt>
            <dd className="text-slate-900 font-medium mt-0.5 font-mono text-xs">
              {connection.connectedBy}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Waznosc tokenu</dt>
            <dd className="text-slate-900 font-medium mt-0.5">
              {connection.expiresAt
                ? formatRelativeTime(connection.expiresAt)
                : "Brak danych"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Ostatni health check</dt>
            <dd className="text-slate-900 font-medium mt-0.5">
              {connection.lastCheckedAt
                ? formatDateTime(connection.lastCheckedAt)
                : "Nigdy"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Dysk wspoldzielony</dt>
            <dd className="text-slate-900 font-medium mt-0.5 break-all">
              {selectedDriveName ?? connection.sharedDriveId ?? "Nie wybrano"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Folder szablonow</dt>
            <dd className="text-slate-900 font-medium mt-0.5 break-all">
              {selectedTemplateFolderName ??
                connection.templatesFolderId ??
                "Nie skonfigurowano"}
            </dd>
          </div>
        </dl>
      </div>

      {/* Folder browser */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">
              Konfiguracja folderow
            </h4>
            <p className="mt-1 text-xs text-slate-500">
              Wybierz dysk wspoldzielony dla klientow i folder, z ktorego
              aplikacja ma pobierac szablony.
            </p>
          </div>
        </div>

        {/* Folder klientów */}
        <div className="mb-6 rounded-lg border border-slate-200 p-4">
          <label className="block text-sm text-slate-500 mb-1">
            Dysk wspoldzielony klientow
          </label>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-mono text-slate-600">
              {effectiveSharedDriveId || "Brak ID dysku"}
            </span>
            {selectedDriveName && (
              <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                {selectedDriveName}
              </span>
            )}
            <button
              type="button"
              onClick={handleLoadDrives}
              disabled={drivesLoading}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
            >
              {drivesLoading ? "Ladowanie dyskow..." : "Pobierz dyski"}
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={effectiveSharedDriveId}
              onChange={(e) => setSharedDriveIdInput(e.target.value)}
              placeholder="ID dysku lub folderu glównego klientow"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleSaveSharedDrive}
              disabled={!effectiveSharedDriveId.trim()}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Zapisz
            </button>
          </div>
          {drives && drives.length > 0 && (
            <select
              className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={effectiveSharedDriveId}
              onChange={(e) => {
                setSharedDriveIdInput(e.target.value);
              }}
            >
              <option value="">Wybierz dysk...</option>
              {drives.map((d: { id: string; name: string }) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
          {drives && drives.length === 0 && (
            <p className="mt-2 text-xs text-slate-400">
              Nie znaleziono dyskow wspoldzielonych. Mozesz zapisac ID recznie.
            </p>
          )}
        </div>

        {/* Folder szablonów */}
        <div className="rounded-lg border border-slate-200 p-4">
          <label className="block text-sm text-slate-500 mb-1">
            Folder szablonow dokumentow
          </label>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-mono text-slate-600">
              {effectiveTemplateFolderId || "Brak ID folderu"}
            </span>
            {selectedTemplateFolderName && (
              <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                {selectedTemplateFolderName}
              </span>
            )}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              placeholder="ID folderu szablonow"
              value={effectiveTemplateFolderId}
              onChange={(e) => setTemplateFolderIdInput(e.target.value)}
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleSaveTemplatesFolder}
              disabled={!effectiveTemplateFolderId.trim()}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Zapisz
            </button>
            {connection.sharedDriveId && (
              <button
                type="button"
                onClick={handleLoadTemplateFolders}
                disabled={foldersLoading}
                className="px-3 py-2 text-sm border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 disabled:opacity-50"
              >
                {foldersLoading ? "Ladowanie..." : "Przegladaj foldery"}
              </button>
            )}
          </div>
          {templateFolders && templateFolders.length > 0 && (
            <select
              className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={effectiveTemplateFolderId}
              onChange={(e) => {
                setTemplateFolderIdInput(e.target.value);
              }}
            >
              <option value="">Wybierz folder szablonow...</option>
              {templateFolders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          )}
          <p className="text-xs text-slate-400 mt-1">
            Po zapisaniu tego folderu aplikacja pobiera z niego pliki szablonow
            dokumentow.
          </p>
        </div>
      </div>

      {/* Folder structure configuration */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-slate-900">
            Zarządzanie strukturą folderów na Google Drive
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            Poniżej znajduje się interaktywne drzewo folderów. Kliknij bezpośrednio na nazwę folderu w drzewie, aby zmienić jego nazwę.
          </p>
        </div>

        {foldersNotice && (
          <div
            className={`mb-4 rounded-lg border p-4 text-sm ${
              foldersNotice.type === "success"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {foldersNotice.text}
          </div>
        )}

        <div className="space-y-6">
          <div className="font-mono text-xs text-slate-600 space-y-2 bg-slate-50 border border-slate-200 rounded-lg p-5">
            {/* Root: Client folder */}
            <div className="flex items-center gap-1.5 text-slate-800 font-medium">
              <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
              </svg>
              <span className="font-sans font-semibold">Jan Kowalski (Warszawa, ul. Złota)</span>
              <span className="text-[10px] text-slate-400 font-normal italic font-sans ml-1">(Główny folder klienta)</span>
            </div>

            {/* Opportunity Branch */}
            <div className="pl-4 border-l border-slate-300">
              <div className="flex items-center gap-1.5 text-slate-700 mt-2 mb-1 group">
                <span className="text-slate-400">├──</span>
                <svg className="w-4.5 h-4.5 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
                </svg>
                <span className="font-sans font-medium text-slate-800">2026-07-15_Złota_Wycena</span>
                <span className="text-[10px] text-blue-500 font-normal font-sans ml-1">[SZANSA SPRZEDAŻY]</span>
                <button
                  type="button"
                  onClick={handleAddCustomOppFolder}
                  className="ml-2 text-[10px] font-sans text-blue-600 hover:text-blue-700 flex items-center gap-0.5 font-medium bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded transition-all opacity-0 group-hover:opacity-100"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Dodaj podfolder
                </button>
              </div>

              {/* Opportunity Children */}
              <div className="pl-6 border-l border-slate-300 ml-4 space-y-1">
                {/* Valuation Files */}
                <div>
                  <div className="flex items-center gap-1.5 group">
                    <span className="text-slate-400">├──</span>
                    <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
                    </svg>
                    <input
                      type="text"
                      value={oppValuation}
                      onChange={(e) => setOppValuation(e.target.value)}
                      className="font-sans text-xs text-slate-600 bg-transparent border border-transparent hover:border-slate-300 hover:bg-white focus:border-blue-500 focus:bg-white focus:outline-none px-2 py-0.5 rounded transition-all w-80 font-medium"
                      placeholder="Folder wyceny..."
                    />
                    <span className="text-[9px] text-blue-500 font-sans font-medium bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded flex items-center gap-0.5 whitespace-nowrap ml-2">
                      <svg className="w-2.5 h-2.5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                      kopiowany do zlecenia
                    </span>
                    {renderAssignTemplateDropdown(oppValuation)}
                    <span className="text-[9px] text-slate-400 opacity-0 group-hover:opacity-100 font-sans transition-opacity ml-1">(kliknij aby edytować)</span>
                  </div>
                  {/* Templates inside Valuation Files */}
                  {templatesByFolder[oppValuation.trim()]?.map((t) => (
                    <div key={t._id} className="flex items-center gap-1.5 py-0.5 pl-6 border-l border-slate-300 ml-4">
                      <span className="text-slate-400">├──</span>
                      <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      <span className="font-sans text-slate-500 font-medium">{t.name}</span>
                      {renderMoveDropdown(t)}
                      {renderUnassignButton(t)}
                    </div>
                  ))}
                </div>

                {/* Offers Received */}
                <div>
                  <div className="flex items-center gap-1.5 group">
                    <span className="text-slate-400">├──</span>
                    <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
                    </svg>
                    <input
                      type="text"
                      value={oppReceived}
                      onChange={(e) => setOppReceived(e.target.value)}
                      className="font-sans text-xs text-slate-600 bg-transparent border border-transparent hover:border-slate-300 hover:bg-white focus:border-blue-500 focus:bg-white focus:outline-none px-2 py-0.5 rounded transition-all w-80 font-medium"
                      placeholder="Folder kosztów..."
                    />
                    <span className="text-[9px] text-blue-500 font-sans font-medium bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded flex items-center gap-0.5 whitespace-nowrap ml-2">
                      <svg className="w-2.5 h-2.5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                      kopiowany do zlecenia
                    </span>
                    {renderAssignTemplateDropdown(oppReceived)}
                    <span className="text-[9px] text-slate-400 opacity-0 group-hover:opacity-100 font-sans transition-opacity ml-1">(kliknij aby edytować)</span>
                  </div>
                  {/* Templates inside Offers Received */}
                  {templatesByFolder[oppReceived.trim()]?.map((t) => (
                    <div key={t._id} className="flex items-center gap-1.5 py-0.5 pl-6 border-l border-slate-300 ml-4">
                      <span className="text-slate-400">├──</span>
                      <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      <span className="font-sans text-slate-500 font-medium">{t.name}</span>
                      {renderMoveDropdown(t)}
                      {renderUnassignButton(t)}
                    </div>
                  ))}
                </div>

                {/* Offers Sent */}
                <div>
                  <div className="flex items-center gap-1.5 group">
                    <span className="text-slate-400">├──</span>
                    <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
                    </svg>
                    <input
                      type="text"
                      value={oppSent}
                      onChange={(e) => setOppSent(e.target.value)}
                      className="font-sans text-xs text-slate-600 bg-transparent border border-transparent hover:border-slate-300 hover:bg-white focus:border-blue-500 focus:bg-white focus:outline-none px-2 py-0.5 rounded transition-all w-80 font-medium"
                      placeholder="Folder ofert..."
                    />
                    <span className="text-[9px] text-blue-500 font-sans font-medium bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded flex items-center gap-0.5 whitespace-nowrap ml-2">
                      <svg className="w-2.5 h-2.5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                      kopiowany do zlecenia
                    </span>
                    {renderAssignTemplateDropdown(oppSent)}
                    <span className="text-[9px] text-slate-400 opacity-0 group-hover:opacity-100 font-sans transition-opacity ml-1">(kliknij aby edytować)</span>
                  </div>
                  {/* Templates inside Offers Sent */}
                  {templatesByFolder[oppSent.trim()]?.map((t) => (
                    <div key={t._id} className="flex items-center gap-1.5 py-0.5 pl-6 border-l border-slate-300 ml-4">
                      <span className="text-slate-400">├──</span>
                      <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      <span className="font-sans text-slate-500 font-medium">{t.name}</span>
                      {renderMoveDropdown(t)}
                      {renderUnassignButton(t)}
                    </div>
                  ))}
                </div>

                {/* Ponzio Files */}
                <div>
                  <div className="flex items-center gap-1.5 group">
                    <span className="text-slate-400">{customOppFolders.length === 0 ? "└──" : "├──"}</span>
                    <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
                    </svg>
                    <input
                      type="text"
                      value={oppPonzio}
                      onChange={(e) => setOppPonzio(e.target.value)}
                      className="font-sans text-xs text-slate-600 bg-transparent border border-transparent hover:border-slate-300 hover:bg-white focus:border-blue-500 focus:bg-white focus:outline-none px-2 py-0.5 rounded transition-all w-80 font-medium"
                      placeholder="Folder Ponzio..."
                    />
                    <span className="text-[9px] text-blue-500 font-sans font-medium bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded flex items-center gap-0.5 whitespace-nowrap ml-2">
                      <svg className="w-2.5 h-2.5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                      kopiowany do zlecenia
                    </span>
                    {renderAssignTemplateDropdown(oppPonzio)}
                    <span className="text-[9px] text-slate-400 opacity-0 group-hover:opacity-100 font-sans transition-opacity ml-1">(kliknij aby edytować)</span>
                  </div>
                  {/* Templates inside Ponzio Files */}
                  {templatesByFolder[oppPonzio.trim()]?.map((t) => (
                    <div key={t._id} className="flex items-center gap-1.5 py-0.5 pl-6 border-l border-slate-300 ml-4">
                      <span className="text-slate-400">├──</span>
                      <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      <span className="font-sans text-slate-500 font-medium">{t.name}</span>
                      {renderMoveDropdown(t)}
                      {renderUnassignButton(t)}
                    </div>
                  ))}
                </div>

                {/* Custom Opportunity Subfolders list */}
                {customOppFolders.map((cf, idx) => {
                  const isLast = idx === customOppFolders.length - 1;
                  const folderNameTrimmed = cf.trim();
                  return (
                    <div key={idx}>
                      <div className="flex items-center gap-1.5 group">
                        <span className="text-slate-400">{isLast ? "└──" : "├──"}</span>
                        <svg className="w-4.5 h-4.5 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
                        </svg>
                        <input
                          type="text"
                          value={cf}
                          onChange={(e) => handleUpdateCustomOppFolder(idx, e.target.value)}
                          className="font-sans text-xs bg-transparent border border-transparent hover:border-slate-300 hover:bg-white focus:border-blue-500 focus:bg-white focus:outline-none px-2 py-0.5 rounded transition-all w-80 font-medium text-blue-600 focus:text-slate-800"
                          placeholder="Nazwa podfolderu..."
                          autoFocus={cf === "Nowy folder"}
                        />
                        <span className="text-[9px] text-blue-500 font-sans font-medium bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded flex items-center gap-0.5 whitespace-nowrap ml-2">
                          <svg className="w-2.5 h-2.5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                          </svg>
                          kopiowany do zlecenia
                        </span>
                        {renderAssignTemplateDropdown(cf)}
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomOppFolder(idx)}
                          className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity ml-1"
                          title="Usuń folder"
                        >
                          <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                          </svg>
                        </button>
                      </div>
                      {/* Templates inside Custom Opp Folder */}
                      {folderNameTrimmed && templatesByFolder[folderNameTrimmed]?.map((t) => (
                        <div key={t._id} className="flex items-center gap-1.5 py-0.5 pl-6 border-l border-slate-300 ml-4">
                          <span className="text-slate-400">├──</span>
                          <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                          <span className="font-sans text-slate-500 font-medium">{t.name}</span>
                          {renderMoveDropdown(t)}
                          {renderUnassignButton(t)}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Order Branch */}
            <div className="pl-4 border-l border-slate-300">
              <div className="flex items-center gap-1.5 text-slate-700 mt-2 mb-1 group">
                <span className="text-slate-400">└──</span>
                <svg className="w-4.5 h-4.5 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
                </svg>
                <span className="font-sans font-medium text-slate-800">2026-07-15_Złota</span>
                <span className="text-[10px] text-green-600 font-normal font-sans ml-1">[ZLECENIE]</span>
                <button
                  type="button"
                  onClick={handleAddCustomFolder}
                  className="ml-2 text-[10px] font-sans text-blue-600 hover:text-blue-700 flex items-center gap-0.5 font-medium bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded transition-all opacity-0 group-hover:opacity-100"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Dodaj podfolder
                </button>
              </div>

              {/* Order Children */}
              <div className="pl-6 ml-4 space-y-1">
                {/* Invoices */}
                <div>
                  <div className="flex items-center gap-1.5 group">
                    <span className="text-slate-400">├──</span>
                    <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
                    </svg>
                    <input
                      type="text"
                      value={orderInvoices}
                      onChange={(e) => setOrderInvoices(e.target.value)}
                      className="font-sans text-xs text-slate-600 bg-transparent border border-transparent hover:border-slate-300 hover:bg-white focus:border-blue-500 focus:bg-white focus:outline-none px-2 py-0.5 rounded transition-all w-80 font-medium"
                      placeholder="Folder faktur..."
                    />
                    {renderAssignTemplateDropdown(orderInvoices)}
                    <span className="text-[9px] text-slate-400 opacity-0 group-hover:opacity-100 font-sans transition-opacity ml-1">(kliknij aby edytować)</span>
                  </div>
                  {/* Templates inside Invoices */}
                  {templatesByFolder[orderInvoices.trim()]?.map((t) => (
                    <div key={t._id} className="flex items-center gap-1.5 py-0.5 pl-6 border-l border-slate-300 ml-4">
                      <span className="text-slate-400">├──</span>
                      <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      <span className="font-sans text-slate-500 font-medium">{t.name}</span>
                      {renderMoveDropdown(t)}
                      {renderUnassignButton(t)}
                    </div>
                  ))}
                </div>

                {/* Documents */}
                <div>
                  <div className="flex items-center gap-1.5 group">
                    <span className="text-slate-400">├──</span>
                    <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
                    </svg>
                    <input
                      type="text"
                      value={orderDocs}
                      onChange={(e) => setOrderDocs(e.target.value)}
                      className="font-sans text-xs text-slate-600 bg-transparent border border-transparent hover:border-slate-300 hover:bg-white focus:border-blue-500 focus:bg-white focus:outline-none px-2 py-0.5 rounded transition-all w-80 font-medium"
                      placeholder="Folder dokumentów..."
                    />
                    {renderAssignTemplateDropdown(orderDocs)}
                    <span className="text-[9px] text-slate-400 opacity-0 group-hover:opacity-100 font-sans transition-opacity ml-1">(kliknij aby edytować)</span>
                  </div>
                  {/* Templates inside Documents */}
                  {templatesByFolder[orderDocs.trim()]?.map((t) => (
                    <div key={t._id} className="flex items-center gap-1.5 py-0.5 pl-6 border-l border-slate-300 ml-4">
                      <span className="text-slate-400">├──</span>
                      <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      <span className="font-sans text-slate-500 font-medium">{t.name}</span>
                      {renderMoveDropdown(t)}
                      {renderUnassignButton(t)}
                    </div>
                  ))}
                </div>

                {/* Measurements */}
                <div>
                  <div className="flex items-center gap-1.5 group">
                    <span className="text-slate-400">{customFolders.length === 0 ? "└──" : "├──"}</span>
                    <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
                    </svg>
                    <input
                      type="text"
                      value={orderMeasurements}
                      onChange={(e) => setOrderMeasurements(e.target.value)}
                      className="font-sans text-xs text-slate-600 bg-transparent border border-transparent hover:border-slate-300 hover:bg-white focus:border-blue-500 focus:bg-white focus:outline-none px-2 py-0.5 rounded transition-all w-80 font-medium"
                      placeholder="Folder pomiarów..."
                    />
                    {renderAssignTemplateDropdown(orderMeasurements)}
                    <span className="text-[9px] text-slate-400 opacity-0 group-hover:opacity-100 font-sans transition-opacity ml-1">(kliknij aby edytować)</span>
                  </div>
                  {/* Templates inside Measurements */}
                  {templatesByFolder[orderMeasurements.trim()]?.map((t) => (
                    <div key={t._id} className="flex items-center gap-1.5 py-0.5 pl-6 border-l border-slate-300 ml-4">
                      <span className="text-slate-400">├──</span>
                      <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      <span className="font-sans text-slate-500 font-medium">{t.name}</span>
                      {renderMoveDropdown(t)}
                      {renderUnassignButton(t)}
                    </div>
                  ))}
                </div>

                {/* Custom Subfolders list */}
                {customFolders.map((cf, idx) => {
                  const isLast = idx === customFolders.length - 1;
                  const folderNameTrimmed = cf.trim();
                  return (
                    <div key={idx}>
                      <div className="flex items-center gap-1.5 group">
                        <span className="text-slate-400">{isLast ? "└──" : "├──"}</span>
                        <svg className="w-4.5 h-4.5 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
                        </svg>
                        <input
                          type="text"
                          value={cf}
                          onChange={(e) => handleUpdateCustomFolder(idx, e.target.value)}
                          className="font-sans text-xs bg-transparent border border-transparent hover:border-slate-300 hover:bg-white focus:border-blue-500 focus:bg-white focus:outline-none px-2 py-0.5 rounded transition-all w-80 font-medium text-blue-600 focus:text-slate-800"
                          placeholder="Nazwa podfolderu..."
                          autoFocus={cf === "Nowy folder"}
                        />
                        {renderAssignTemplateDropdown(cf)}
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomFolder(idx)}
                          className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity"
                          title="Usuń folder"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                          </svg>
                        </button>
                      </div>
                      {/* Templates inside Custom Order Folder */}
                      {folderNameTrimmed && templatesByFolder[folderNameTrimmed]?.map((t) => (
                        <div key={t._id} className="flex items-center gap-1.5 py-0.5 pl-6 border-l border-slate-300 ml-4">
                          <span className="text-slate-400">├──</span>
                          <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                          <span className="font-sans text-slate-500 font-medium">{t.name}</span>
                          {renderMoveDropdown(t)}
                          {renderUnassignButton(t)}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button
            type="button"
            onClick={handleSaveFolders}
            disabled={savingFolders || config === undefined}
            className="rounded-md bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm"
          >
            {savingFolders ? "Zapisywanie..." : "Zapisz strukturę folderów"}
          </button>
        </div>
      </div>

      {/* Health check */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">
              Diagnostyka
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Sprawdz czy polaczenie z Google Drive dziala poprawnie.
            </p>
          </div>
          <button
            onClick={handleHealthCheck}
            disabled={healthLoading}
            className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {healthLoading ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Sprawdzanie...
              </>
            ) : (
              "Testuj polaczenie"
            )}
          </button>
        </div>
        {healthResult && (
          <div
            className={`mt-4 p-3 rounded-md text-sm ${
              healthResult.startsWith("Blad")
                ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-green-50 text-green-700 border border-green-200"
            }`}
          >
            {healthResult}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Jotform Tab ---

function JotformTab() {
  const webhookUrl = `${siteUrl}/api/webhooks/jotform`;
  const jotformConfig = useQuery(api.jotformAdmin.getConfig);
  const saveConfig = useMutation(api.jotformAdmin.saveConfig);
  const registerWebhook = useAction(api.jotformAdmin.registerWebhook);
  const unregisterWebhook = useAction(api.jotformAdmin.unregisterWebhook);
  const checkStatus = useAction(api.jotformAdmin.checkWebhookStatus);
  const testConn = useAction(api.jotformAdmin.testConnection);
  const encryptApiKey = useAction(api.jotformAdmin.encryptApiKey);

  const [apiKey, setApiKey] = useState("");
  const [formId, setFormId] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [connUser, setConnUser] = useState<string | null>(null);
  const hasSavedApiKey = jotformConfig?.hasApiKey ?? false;
  const effectiveApiKey = apiKey || (hasSavedApiKey ? "********" : "");
  const effectiveFormId = formId || jotformConfig?.formId || "";

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = webhookUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [webhookUrl]);

  const handleTestConnection = async () => {
    if (!apiKey.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const result = await testConn({ apiKey: apiKey.trim() });
      if (result.success) {
        setConnUser(result.username ?? null);
        setMessage({
          type: "success",
          text: `Połączono jako: ${result.username ?? "OK"}`,
        });
      } else {
        setMessage({ type: "error", text: result.error ?? "Błąd połączenia" });
      }
    } catch (error: unknown) {
      setMessage({
        type: "error",
        text: getErrorMessage(error, "Błąd połączenia"),
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    const nextFormId = effectiveFormId.trim();
    if (!nextFormId || (!apiKey.trim() && !hasSavedApiKey)) return;
    setLoading(true);
    try {
      const encryptedApiKey = apiKey.trim()
        ? await encryptApiKey({ apiKey: apiKey.trim() })
        : undefined;
      await saveConfig({ encryptedApiKey, formId: nextFormId });
      setMessage({ type: "success", text: "Konfiguracja zapisana" });
      if (apiKey.trim()) {
        setApiKey("");
      }
      if (formId) {
        setFormId(nextFormId);
      }
    } catch (error: unknown) {
      setMessage({
        type: "error",
        text: getErrorMessage(error, "Błąd zapisu"),
      });
    }
    setLoading(false);
  };

  const handleRegister = async () => {
    const nextFormId = effectiveFormId.trim();
    if (!nextFormId || (!apiKey.trim() && !hasSavedApiKey)) return;
    setLoading(true);
    setMessage(null);
    try {
      const encryptedApiKey = apiKey.trim()
        ? await encryptApiKey({ apiKey: apiKey.trim() })
        : undefined;
      await saveConfig({ encryptedApiKey, formId: nextFormId });
      // Zarejestruj webhook (klucz API czytany z bazy)
      const result = await registerWebhook({
        formId: nextFormId,
        webhookUrl,
      });
      if (result.success) {
        setMessage({
          type: "success",
          text: "Webhook zarejestrowany w Jotform!",
        });
        if (apiKey.trim()) {
          setApiKey("");
        }
        if (formId) {
          setFormId(nextFormId);
        }
      } else {
        setMessage({
          type: "error",
          text: result.error ?? "Nie udało się zarejestrować",
        });
      }
    } catch (error: unknown) {
      setMessage({
        type: "error",
        text: getErrorMessage(error, "Błąd rejestracji webhooka"),
      });
    }
    setLoading(false);
  };

  const handleUnregister = async () => {
    const nextFormId = effectiveFormId.trim();
    if (!nextFormId) return;
    setLoading(true);
    setMessage(null);
    try {
      const result = await unregisterWebhook({
        formId: nextFormId,
        webhookUrl,
      });
      if (result.success) {
        setMessage({ type: "success", text: "Webhook wyrejestrowany" });
      } else {
        setMessage({ type: "error", text: result.error ?? "Błąd" });
      }
    } catch (error: unknown) {
      setMessage({ type: "error", text: getErrorMessage(error, "Błąd") });
    }
    setLoading(false);
  };

  const handleCheckStatus = async () => {
    const nextFormId = effectiveFormId.trim();
    if (!nextFormId) return;
    setLoading(true);
    setMessage(null);
    try {
      const result = await checkStatus({
        formId: nextFormId,
        webhookUrl,
      });
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({
          type: result.registered ? "success" : "error",
          text: result.registered
            ? "Webhook jest aktywny w Jotform"
            : "Webhook nie jest zarejestrowany w Jotform",
        });
      }
    } catch (error: unknown) {
      setMessage({ type: "error", text: getErrorMessage(error, "Błąd") });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Webhook URL */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-1">
          Webhook URL
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          Ten URL odbiera dane z formularza Jotform.
        </p>
        <div className="flex items-stretch gap-2">
          <input
            type="text"
            readOnly
            value={webhookUrl}
            className="flex-1 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-700 select-all focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-800 transition-colors shrink-0"
          >
            {copied ? "Skopiowano" : "Kopiuj"}
          </button>
        </div>
      </div>

      {/* Automatyczna rejestracja */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-1">
          Automatyczna rejestracja webhooka
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          Podaj klucz API Jotform i ID formularza, aby automatycznie
          zarejestrować webhook.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Jotform API Key
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={effectiveApiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Wklej API key z Jotform → Settings → API"
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleTestConnection}
                disabled={loading || !apiKey.trim()}
                className="px-3 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Testuj
              </button>
            </div>
            {connUser && (
              <p className="mt-1 text-xs text-green-600">
                Połączono jako: {connUser}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              ID formularza
            </label>
            <input
              type="text"
              value={effectiveFormId}
              onChange={(e) => setFormId(e.target.value)}
              placeholder="np. 260517926002047"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-slate-400">
              ID formularza &quot;Formularz bezpłatnej wyceny&quot; z PRD:
              260517926002047
            </p>
          </div>

          {/* Status */}
          {jotformConfig && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-3 rounded-md bg-slate-50 border border-slate-200">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${jotformConfig.hasApiKey ? "bg-green-500" : "bg-gray-400"}`}
                />
                <span className="text-sm text-slate-700">
                  {jotformConfig.hasApiKey
                    ? "Klucz API zapisany"
                    : "Klucz API nie skonfigurowany"}
                </span>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-md bg-slate-50 border border-slate-200">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${jotformConfig.webhookRegistered ? "bg-green-500" : "bg-gray-400"}`}
                />
                <span className="text-sm text-slate-700">
                  {jotformConfig.webhookRegistered
                    ? "Webhook zarejestrowany"
                    : "Webhook nie zarejestrowany"}
                </span>
              </div>
            </div>
          )}

          {/* Message */}
          {message && (
            <div
              className={`p-3 rounded-md text-sm ${
                message.type === "success"
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSave}
              disabled={loading || !apiKey.trim() || !formId.trim()}
              className="px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Zapisz konfigurację
            </button>
            <button
              onClick={handleRegister}
              disabled={loading || !apiKey.trim() || !formId.trim()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
            >
              {loading ? "Rejestruję..." : "Zarejestruj webhook"}
            </button>
            <button
              onClick={handleCheckStatus}
              disabled={loading || !formId.trim()}
              className="px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Sprawdź status
            </button>
            {jotformConfig?.webhookRegistered && (
              <button
                onClick={handleUnregister}
                disabled={loading}
                className="px-4 py-2 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                Wyrejestruj
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
        <p className="text-xs text-amber-800">
          <strong>Uwaga:</strong> API key Jotform znajdziesz w: Jotform →
          Settings → API. Uprawnienia: wymagany dostęp do formularzy (Full
          Access lub Form Access).
        </p>
      </div>
    </div>
  );
}

// --- Fakturownia Tab ---

function FakturowniaTab() {
  const config = useQuery(api.fakturownia.getConfig);
  const saveConfig = useMutation(api.fakturownia.saveConfig);
  const encryptToken = useAction(api.fakturownia.encryptApiToken);
  const testConnection = useAction(api.fakturownia.testConnection);

  const [subdomain, setSubdomain] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasSavedToken = config?.hasApiToken ?? false;

  useEffect(() => {
    if (config && !initialized) {
      setSubdomain(config.subdomain ?? "");
      setInitialized(true);
    }
  }, [config, initialized]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setSaving(true);
    try {
      const sub = subdomain.trim().toLowerCase().replace(/\.fakturownia\.pl$/i, "");
      if (!sub) {
        throw new Error("Podaj subdomenę (np. moja-firma)");
      }
      let encrypted: string | undefined;
      const trimmedToken = apiToken.trim();
      if (trimmedToken) {
        encrypted = await encryptToken({ apiToken: trimmedToken });
      }
      await saveConfig({
        subdomain: sub,
        encryptedApiToken: encrypted,
      });
      setApiToken("");
      setMessage("Zapisano ustawienia Fakturowni.");
    } catch (err) {
      setError(getErrorMessage(err, "Błąd zapisu"));
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setMessage(null);
    setError(null);
    setTesting(true);
    try {
      const res = await testConnection({
        apiToken: apiToken.trim() || undefined,
      });
      if (res.ok) setMessage("Połączenie z API Fakturowni działa.");
      else setError(res.error ?? "Błąd testu");
    } catch (err) {
      setError(getErrorMessage(err, "Błąd testu"));
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <p className="text-sm text-slate-600">
        Integracja wysyła wycenę jako{" "}
        <strong>zamówienie</strong> (typ dokumentu &quot;estimate&quot; w API Fakturowni).
      </p>

      <form onSubmit={handleSave} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Subdomena Fakturowni
          </label>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="np. moja-firma (bez .fakturownia.pl)"
            value={subdomain}
            onChange={(e) => setSubdomain(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Token API
          </label>
          <input
            type="password"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder={hasSavedToken ? "•••• zapisany — wpisz nowy, aby zmienić" : "Z ustawień konta → Integracja"}
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            autoComplete="off"
          />
          {config?.usingEnvToken && (
            <p className="mt-1 text-xs text-amber-700">
              Używany jest token ze zmiennej środowiskowej FAKTUROWNIA_API_TOKEN.
            </p>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-emerald-700">{message}</p>}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? "Zapisywanie…" : "Zapisz"}
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {testing ? "Test…" : "Test połączenia"}
          </button>
        </div>
      </form>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        <p className="mb-2">
          Token: Ustawienia konta Fakturownia → Ustawienia → Integracja → kod autoryzacji API.
        </p>
        <p>
          Opcjonalnie na serwerze Convex:{" "}
          <code className="rounded bg-white px-1">FAKTUROWNIA_API_TOKEN</code>,{" "}
          <code className="rounded bg-white px-1">FAKTUROWNIA_SUBDOMAIN</code>.
        </p>
      </div>
    </div>
  );
}


// --- SMS Tab ---

type SmsRecipient = { name: string; phone: string };

function SmsTab() {
  const config = useQuery(api.sms.getConfig);
  const saveConfig = useMutation(api.sms.saveConfig);

  const [phone, setPhone] = useState("");
  const [sender, setSender] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [newRecipientName, setNewRecipientName] = useState("");
  const [newRecipientPhone, setNewRecipientPhone] = useState("");

  const effectivePhone = phone || config?.internalPhone || "";
  const effectiveSender = sender || config?.senderName || "ADK Okna";
  const currentRecipients: SmsRecipient[] = config?.recipients ?? [];

  const saveWithRecipients = async (recipients: SmsRecipient[]) => {
    const phoneVal = effectivePhone.trim();
    const senderVal = effectiveSender.trim();
    if (!phoneVal || !senderVal) return;
    setSaving(true);
    setMessage(null);
    try {
      await saveConfig({ internalPhone: phoneVal, senderName: senderVal, recipients });
      setMessage({ type: "success", text: "Konfiguracja SMS zapisana." });
    } catch (error: unknown) {
      setMessage({ type: "error", text: getErrorMessage(error, "Błąd zapisu") });
    }
    setSaving(false);
  };

  const handleSave = async () => {
    setPhone("");
    setSender("");
    await saveWithRecipients(currentRecipients);
  };

  const handleAddRecipient = async () => {
    const name = newRecipientName.trim();
    const recipientPhone = newRecipientPhone.trim();
    if (!name || !recipientPhone) return;
    const updated = [...currentRecipients, { name, phone: recipientPhone }];
    await saveWithRecipients(updated);
    setNewRecipientName("");
    setNewRecipientPhone("");
  };

  const handleRemoveRecipient = async (index: number) => {
    const updated = currentRecipients.filter((_, i) => i !== index);
    await saveWithRecipients(updated);
  };

  if (config === undefined) {
    return <div className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white" />;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-1">
          Konfiguracja SMS API
        </h3>
        <p className="text-sm text-slate-500 mb-6">
          Ustawienia wysyłki wiadomości SMS przez SMSAPI.pl. Token API
          konfigurowany jest jako zmienna środowiskowa{" "}
          <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">
            SMSAPI_TOKEN
          </code>{" "}
          w Convex Dashboard.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Numer telefonu odbiorcy (wewnętrzny)
            </label>
            <input
              type="tel"
              value={effectivePhone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="np. 48515453090"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-slate-400">
              Używany przez przycisk &quot;Wyślij adres&quot; w karcie klienta. Podaj numer
              z prefiksem kraju bez znaku &quot;+&quot;, np.{" "}
              <code className="font-mono">48515453090</code>.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nazwa nadawcy
            </label>
            <input
              type="text"
              value={effectiveSender}
              onChange={(e) => setSender(e.target.value)}
              placeholder="ADK Okna"
              maxLength={11}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-slate-400">
              Nazwa wyświetlana jako nadawca SMS. Maksymalnie 11 znaków
              (ograniczenie operatora). Wymaga aktywacji w panelu SMSAPI.pl.
            </p>
          </div>

          {message && (
            <div
              className={`p-3 rounded-md text-sm ${
                message.type === "success"
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="pt-1">
            <button
              onClick={handleSave}
              disabled={saving || !effectivePhone.trim() || !effectiveSender.trim()}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? "Zapisywanie..." : "Zapisz konfigurację"}
            </button>
          </div>
        </div>
      </div>

      {/* Lista adresatów */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-1">
          Lista adresatów SMS
        </h3>
        <p className="text-sm text-slate-500 mb-5">
          Osoby, które można wybrać przy wysyłce adresu inwestycji ze zlecenia.
        </p>

        <div className="space-y-2 mb-5">
          {currentRecipients.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Brak zapisanych adresatów.</p>
          ) : (
            currentRecipients.map((r, i) => (
              <div key={i} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2.5 bg-slate-50">
                <div className="min-w-0">
                  <span className="text-sm font-medium text-slate-800">{r.name}</span>
                  <span className="ml-2 font-mono text-xs text-slate-500">{r.phone}</span>
                </div>
                <button
                  onClick={() => void handleRemoveRecipient(i)}
                  disabled={saving}
                  className="ml-3 flex-shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40"
                  title="Usuń adresata"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-medium text-slate-600 mb-3">Dodaj nowego adresata</p>
          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              value={newRecipientName}
              onChange={(e) => setNewRecipientName(e.target.value)}
              placeholder="Imię i nazwisko"
              className="flex-1 min-w-[140px] rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="tel"
              value={newRecipientPhone}
              onChange={(e) => setNewRecipientPhone(e.target.value)}
              placeholder="np. 48515453090"
              className="flex-1 min-w-[140px] rounded-md border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => { if (e.key === "Enter") void handleAddRecipient(); }}
            />
            <button
              onClick={() => void handleAddRecipient()}
              disabled={saving || !newRecipientName.trim() || !newRecipientPhone.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 text-white px-4 py-2 text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-40"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Dodaj
            </button>
          </div>
        </div>
      </div>

      <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
        <p className="text-xs text-amber-800">
          <strong>Uwaga:</strong> Token SMSAPI ustaw jako zmienną środowiskową{" "}
          <code className="font-mono">SMSAPI_TOKEN</code> w Convex Dashboard →
          Settings → Environment Variables. Aby używać nazwy nadawcy innej niż
          numer telefonu, aktywuj ją wcześniej w panelu SMSAPI.pl (Ustawienia →
          Pola nadawcy).
        </p>
      </div>
    </div>
  );
}

// --- Ogolne Tab ---

function OgolneTab() {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <p className="text-sm text-slate-500">
        Ustawienia ogolne pojawia sie tutaj.
      </p>
    </div>
  );
}

// --- Szablony Tab ---

function SzablonyTab() {
  const templates = useQuery(api.documentTemplates.list);
  const driveConnection = useQuery(api.googleDrive.getConnectionStatus);
  const createTemplate = useMutation(api.documentTemplates.create);
  const deleteTemplate = useMutation(api.documentTemplates.deleteTemplate);
  const listTemplateFiles = useAction(api.googleDrive.listTemplateFiles);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_TEMPLATE);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [availableFiles, setAvailableFiles] = useState<Array<{
    id: string;
    name: string;
  }> | null>(null);
  const [filesLoading, setFilesLoading] = useState(false);
  const [fileSearch, setFileSearch] = useState("");

  const filteredFiles = useMemo(() => {
    if (!availableFiles) return null;
    const query = fileSearch.trim().toLowerCase();
    if (!query) return availableFiles;
    return availableFiles.filter((file) =>
      file.name.toLowerCase().includes(query),
    );
  }, [availableFiles, fileSearch]);

  const handleLoadTemplateFiles = async () => {
    setFilesLoading(true);
    setNotice(null);
    try {
      const files = await listTemplateFiles();
      setAvailableFiles(files);
    } catch (error) {
      setNotice({
        type: "error",
        text: `Blad plikow: ${getErrorMessage(error, "Nieznany blad")}`,
      });
    } finally {
      setFilesLoading(false);
    }
  };

  const openCreateModal = () => {
    setShowModal(true);
    setNotice(null);
    setFileSearch("");
    if (driveConnection?.templatesFolderId && availableFiles === null) {
      void handleLoadTemplateFiles();
    }
  };

  const handleCreate = async () => {
    if (!form.key.trim() || !form.name.trim()) return;
    setSaving(true);
    setNotice(null);
    try {
      await createTemplate({
        key: form.key.trim(),
        name: form.name.trim(),
        googleDriveFileId: form.googleDriveFileId.trim() || undefined,
        fileNamePattern:
          form.fileNamePattern.trim() ||
          `${form.key}_{{firstName}}_{{lastName}}_{{city}}`,
        fieldMappings: [],
      });
      setForm(EMPTY_TEMPLATE);
      setShowModal(false);
      setNotice({ type: "success", text: "Szablon zostal utworzony." });
    } catch (error) {
      setNotice({
        type: "error",
        text: `Blad zapisu: ${getErrorMessage(error, "Nieznany blad")}`,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTypeChange = (type: string) => {
    const selectedType = TEMPLATE_TYPES.find((item) => item[0] === type);
    if (!selectedType) return;
    setForm((current) => ({
      ...current,
      type,
      key: selectedType[1] || current.key,
      name: selectedType[2] || current.name,
      fileNamePattern: selectedType[3] || current.fileNamePattern,
    }));
  };

  const handleDelete = async (id: Id<"documentTemplates">, name: string) => {
    if (!confirm(`Czy na pewno chcesz usunąć szablon "${name}"?`)) return;
    setDeleting(id);
    setNotice(null);
    try {
      await deleteTemplate({ id });
      setNotice({ type: "success", text: `Usunieto szablon „${name}".` });
    } catch (error) {
      setNotice({
        type: "error",
        text: `Blad usuwania: ${getErrorMessage(error, "Nieznany blad")}`,
      });
    } finally {
      setDeleting(null);
    }
  };

  if (templates === undefined) {
    return <div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-white" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Document Templates
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
            Szablony dokumentow
          </h2>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Dodaj szablon
        </button>
      </div>

      {notice && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            notice.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="space-y-4">
          {templates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <p className="text-base font-medium text-slate-700">
                Brak szablonow dokumentow.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Zacznij od dodania pierwszego szablonu i podpiecia pliku z
                Google Drive.
              </p>
              <button
                onClick={openCreateModal}
                className="mt-5 inline-flex items-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                Dodaj pierwszy szablon
              </button>
            </div>
          ) : (
            templates.map((template) => (
              <div
                key={template._id}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700">
                        {template.key}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          template.isActive
                            ? "bg-green-50 text-green-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {template.isActive ? "Aktywny" : "Nieaktywny"}
                      </span>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                        v{template.version}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold tracking-tight text-slate-900">
                        {template.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {template.fileNamePattern}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/szablony/${template._id}`}
                      className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Edytuj mapper
                    </Link>
                    <button
                      onClick={() => handleDelete(template._id, template.name)}
                      disabled={deleting === template._id}
                      className="inline-flex items-center rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deleting === template._id ? "Usuwanie..." : "Usun"}
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      Google Drive
                    </p>
                    <p className="mt-2 break-all font-mono text-xs text-slate-700">
                      {template.googleDriveFileId ?? "Brak wybranego pliku"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      Mapowania
                    </p>
                    <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                      {template.fieldMappings.length}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      Status integracji
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-700">
                      {template.googleDriveFileId
                        ? "Gotowy do kopiowania"
                        : "Wymaga wyboru pliku z Drive"}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
      </div>

      {showModal && (
        <ModalPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Nowy szablon
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Utworz wpis szablonu, podepnij plik Google Drive i przygotuj
                  nazwe wynikowego dokumentu.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setForm(EMPTY_TEMPLATE);
                }}
                className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              >
                Zamknij
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Typ dokumentu
                </label>
                <select
                  value={form.type}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {TEMPLATE_TYPES.map((type) => (
                    <option key={type[0]} value={type[0]}>
                      {type[2]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Klucz
                </label>
                <input
                  type="text"
                  value={form.key}
                  onChange={(e) => setForm({ ...form, key: e.target.value })}
                  placeholder="np. pomiar"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  disabled={form.type !== "custom" && form.type !== "gwarancja"}
                />
                {form.type === "gwarancja" ? (
                  <p className="mt-1 text-xs text-slate-400">
                    Klucz musi zaczynać się od <span className="font-mono">gwarancja_</span>
                  </p>
                ) : form.type !== "custom" && (
                  <p className="mt-1 text-xs text-slate-400">
                    Klucz wynika z wybranego typu dokumentu.
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Nazwa
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="np. Pomiar 2026/03"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Plik z Google Drive
                </label>
                <input
                  type="text"
                  value={form.googleDriveFileId}
                  onChange={(e) =>
                    setForm({ ...form, googleDriveFileId: e.target.value })
                  }
                  placeholder="ID pliku na Google Drive"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                />
                {driveConnection?.templatesFolderId && (
                  <div className="mt-2 space-y-2">
                    <input
                      type="text"
                      value={fileSearch}
                      onChange={(e) => setFileSearch(e.target.value)}
                      placeholder="Szukaj pliku po nazwie..."
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => void handleLoadTemplateFiles()}
                      disabled={filesLoading}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
                    >
                      {filesLoading
                        ? "Ladowanie plikow..."
                        : "Pobierz pliki z folderu szablonow"}
                    </button>
                    {filteredFiles && filteredFiles.length > 0 && (
                      <select
                        value={form.googleDriveFileId}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            googleDriveFileId: e.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="">Wybierz plik z Google Drive...</option>
                        {filteredFiles.map((file) => (
                          <option key={file.id} value={file.id}>
                            {file.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {filteredFiles && filteredFiles.length === 0 && (
                      <p className="text-xs text-slate-500">
                        Brak plikow pasujacych do wyszukiwania.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Wzorzec nazwy pliku
                </label>
                <input
                  type="text"
                  value={form.fileNamePattern}
                  onChange={(e) =>
                    setForm({ ...form, fileNamePattern: e.target.value })
                  }
                  placeholder="Pomiar_{{firstName}}_{{lastName}}_{{city}}"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Jesli zostawisz puste, system wygeneruje domyslny wzorzec z
                  klucza szablonu.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setForm(EMPTY_TEMPLATE);
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800"
              >
                Anuluj
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !form.key.trim() || !form.name.trim()}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? "Zapisywanie..." : "Utworz szablon"}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}

// --- CennikTab ---

const VAT_RATES = [23, 8, 0];
const UNITS = ["szt.", "m²", "mb", "usł.", "kpl.", "godz."];

function fmt(n: number) {
  return n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type PricingEntry = {
  _id: Id<"servicePricing">;
  name: string;
  description?: string;
  unit: string;
  unitPrice: number;
  vatRate: number;
  isActive: boolean;
};

type PricingForm = {
  name: string;
  description: string;
  unit: string;
  unitPrice: string;
  vatRate: number;
};

const EMPTY_PRICING_FORM: PricingForm = {
  name: "",
  description: "",
  unit: "szt.",
  unitPrice: "",
  vatRate: 23,
};

function PricingRow({
  entry,
  onSave,
  onToggle,
  onDelete,
}: {
  entry: PricingEntry;
  onSave: (id: Id<"servicePricing">, data: Partial<PricingForm>) => Promise<void>;
  onToggle: (id: Id<"servicePricing">) => Promise<void>;
  onDelete: (id: Id<"servicePricing">) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PricingForm>({
    name: entry.name,
    description: entry.description ?? "",
    unit: entry.unit,
    unitPrice: String(entry.unitPrice),
    vatRate: entry.vatRate,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await onSave(entry._id, {
        ...draft,
        description: draft.description || undefined,
      } as Partial<PricingForm>);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd zapisu");
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!confirm(`Usunąć "${entry.name}" z cennika?`)) return;
    setBusy(true);
    try {
      await onDelete(entry._id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd usuwania");
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <tr className="bg-blue-50">
        <td className="px-4 py-3" colSpan={6}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="col-span-2">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Nazwa</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Opis</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  placeholder="opcjonalny opis"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Cena netto</label>
                <input
                  type="number" min="0" step="0.01"
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  value={draft.unitPrice}
                  onChange={(e) => setDraft((d) => ({ ...d, unitPrice: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Jednostka</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  value={draft.unit}
                  onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}
                >
                  {UNITS.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">VAT %</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  value={draft.vatRate}
                  onChange={(e) => setDraft((d) => ({ ...d, vatRate: parseInt(e.target.value) }))}
                >
                  {VAT_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                </select>
              </div>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button onClick={save} disabled={busy || !draft.name}
                className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
                Zapisz
              </button>
              <button onClick={() => setEditing(false)}
                className="rounded-lg border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                Anuluj
              </button>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className={`group border-b border-slate-100 hover:bg-slate-50 ${!entry.isActive ? "opacity-50" : ""}`}>
      <td className="px-4 py-3 text-sm font-medium text-slate-800">
        {entry.name}
        {entry.description && <span className="ml-1.5 text-xs text-slate-400">{entry.description}</span>}
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">{fmt(entry.unitPrice)} zł</td>
      <td className="px-4 py-3 text-sm text-slate-600">{entry.unit}</td>
      <td className="px-4 py-3 text-sm text-slate-600">{entry.vatRate}%</td>
      <td className="px-4 py-3">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${entry.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
          {entry.isActive ? "Aktywna" : "Nieaktywna"}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="invisible flex justify-end gap-1 group-hover:visible">
          <button onClick={() => setEditing(true)}
            className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-200">Edytuj</button>
          <button onClick={() => onToggle(entry._id)} disabled={busy}
            className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-200">
            {entry.isActive ? "Dezaktywuj" : "Aktywuj"}
          </button>
          <button onClick={del} disabled={busy}
            className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50">Usuń</button>
        </div>
      </td>
    </tr>
  );
}

function CennikTab() {
  const entries = useQuery(api.servicePricing.list, { includeInactive: true });
  const createEntry = useMutation(api.servicePricing.create);
  const updateEntry = useMutation(api.servicePricing.update);
  const toggleActive = useMutation(api.servicePricing.toggleActive);
  const removeEntry = useMutation(api.servicePricing.remove);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PricingForm>(EMPTY_PRICING_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await createEntry({
        name: form.name,
        description: form.description || undefined,
        unit: form.unit,
        unitPrice: parseFloat(form.unitPrice) || 0,
        vatRate: form.vatRate,
      });
      setForm(EMPTY_PRICING_FORM);
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd zapisu");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(id: Id<"servicePricing">, data: Partial<PricingForm>) {
    await updateEntry({
      id,
      name: data.name,
      description: data.description,
      unit: data.unit,
      unitPrice: data.unitPrice ? parseFloat(data.unitPrice) : undefined,
      vatRate: data.vatRate,
    });
  }

  async function handleToggle(id: Id<"servicePricing">) {
    await toggleActive({ id });
  }

  async function handleDelete(id: Id<"servicePricing">) {
    await removeEntry({ id });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Cennik usług</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Definiuj usługi z cenami bazowymi. Przy tworzeniu wyceny można wybrać pozycję z cennika lub wpisać własną.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
          >
            + Dodaj usługę
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">Nowa usługa</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="col-span-2">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Nazwa *</label>
              <input
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="np. Okna PVC"
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Opis</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="opcjonalny opis"
              />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Cena netto *</label>
              <input
                required type="number" min="0" step="0.01"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.unitPrice}
                onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Jednostka</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              >
                {UNITS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">VAT %</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                value={form.vatRate}
                onChange={(e) => setForm((f) => ({ ...f, vatRate: parseInt(e.target.value) }))}
              >
                {VAT_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
          </div>
          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={busy}
              className="rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
              Dodaj
            </button>
            <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY_PRICING_FORM); setError(null); }}
              className="rounded-lg border border-slate-300 px-5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              Anuluj
            </button>
          </div>
        </form>
      )}

      {entries === undefined ? (
        <p className="text-sm text-slate-400">Ładowanie...</p>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center">
          <p className="text-sm text-slate-400">Brak pozycji w cenniku — dodaj pierwszą usługę</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Usługa</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Cena netto</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Jedn.</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">VAT</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                <th className="w-32" />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <PricingRow
                  key={entry._id}
                  entry={entry}
                  onSave={handleSave}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --- Usługi Tab ---

function ServicesTab() {
  const services = useQuery(api.services.list, { includeInactive: true });
  const allSuppliersRaw = useQuery(api.suppliers.list, {});
  const allSuppliers = useMemo(() => allSuppliersRaw ?? [], [allSuppliersRaw]);
  const createService = useMutation(api.services.create);
  const updateService = useMutation(api.services.update);
  const toggleActive = useMutation(api.services.toggleActive);
  const removeService = useMutation(api.services.remove);
  const reorderService = useMutation(api.services.reorder);
  const assignSuppliers = useMutation(api.services.assignSuppliers);
  const seedServices = useMutation(api.services.seed);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supplierMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of allSuppliers) m.set(s._id, s.name);
    return m;
  }, [allSuppliers]);

  useEffect(() => {
    if (services !== undefined && services.length === 0) {
      seedServices().catch(() => {});
    }
  }, [services, seedServices]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await createService({ name: form.name, description: form.description || undefined, defaultTasks: [] });
      setForm({ name: "", description: "" });
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd zapisu");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(id: Id<"services">, data: { name?: string; description?: string; defaultTasks?: { title: string; daysToComplete?: number }[] }) {
    await updateService({ id, ...data });
  }

  async function handleToggle(id: Id<"services">) {
    await toggleActive({ id });
  }

  async function handleDelete(id: Id<"services">) {
    await removeService({ id });
  }

  async function handleMoveUp(id: Id<"services">, currentSort: number) {
    if (!services) return;
    const sorted = [...services].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((s) => s._id === id);
    if (idx <= 0) return;
    const prev = sorted[idx - 1];
    await reorderService({ id: prev._id, sortOrder: currentSort });
    await reorderService({ id, sortOrder: prev.sortOrder });
  }

  async function handleMoveDown(id: Id<"services">, currentSort: number) {
    if (!services) return;
    const sorted = [...services].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((s) => s._id === id);
    if (idx === -1 || idx >= sorted.length - 1) return;
    const next = sorted[idx + 1];
    await reorderService({ id: next._id, sortOrder: currentSort });
    await reorderService({ id, sortOrder: next.sortOrder });
  }

  async function handleAssignSuppliers(id: Id<"services">, supplierIds: Id<"suppliers">[]) {
    await assignSuppliers({ serviceId: id, supplierIds });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Usługi</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Lista usług oferowanych przez firmę. Zarządzaj nazwami i przypisanymi dostawcami.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
          >
            + Dodaj usługę
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">Nowa usługa</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="col-span-2">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Nazwa *</label>
              <input
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="np. Okna"
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Opis</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="opcjonalny opis"
              />
            </div>
          </div>
          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={busy}
              className="rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
              Dodaj
            </button>
            <button type="button" onClick={() => { setShowForm(false); setForm({ name: "", description: "" }); setError(null); }}
              className="rounded-lg border border-slate-300 px-5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              Anuluj
            </button>
          </div>
        </form>
      )}

      {services === undefined ? (
        <p className="text-sm text-slate-400">Ładowanie...</p>
      ) : services.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center">
          <p className="text-sm text-slate-400">Brak usług — dodaj pierwszą usługę</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="w-8 px-2 py-3" />
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Usługa</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Dostawcy</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                <th className="w-32" />
              </tr>
            </thead>
            <tbody>
              {[...services]
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((svc) => (
                  <ServicesRow
                    key={svc._id}
                    service={svc}
                    supplierMap={supplierMap}
                    allSuppliers={allSuppliers}
                    onSave={handleSave}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    onAssignSuppliers={handleAssignSuppliers}
                    onMoveUp={handleMoveUp}
                    onMoveDown={handleMoveDown}
                  />
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ServicesRow({
  service,
  supplierMap,
  allSuppliers,
  onSave,
  onToggle,
  onDelete,
  onAssignSuppliers,
  onMoveUp,
  onMoveDown,
}: {
  service: {
    _id: Id<"services">;
    name: string;
    description?: string;
    supplierIds?: Id<"suppliers">[];
    isActive: boolean;
    sortOrder: number;
    defaultTasks?: { title: string; daysToComplete?: number }[];
  };
  supplierMap: Map<string, string>;
  allSuppliers: { _id: Id<"suppliers">; name: string }[];
  onSave: (id: Id<"services">, data: { name?: string; description?: string; defaultTasks?: { title: string; daysToComplete?: number }[] }) => Promise<void>;
  onToggle: (id: Id<"services">) => Promise<void>;
  onDelete: (id: Id<"services">) => Promise<void>;
  onAssignSuppliers: (id: Id<"services">, supplierIds: Id<"suppliers">[]) => Promise<void>;
  onMoveUp: (id: Id<"services">, sortOrder: number) => Promise<void>;
  onMoveDown: (id: Id<"services">, sortOrder: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    name: service.name,
    description: service.description ?? "",
    supplierIds: service.supplierIds ?? [] as Id<"suppliers">[],
    defaultTasks: service.defaultTasks ?? [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await onSave(service._id, { name: draft.name, description: draft.description || undefined, defaultTasks: draft.defaultTasks });
      await onAssignSuppliers(service._id, draft.supplierIds);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd zapisu");
    } finally {
      setBusy(false);
    }
  }

  function toggleSupplier(id: Id<"suppliers">) {
    setDraft((d) => ({
      ...d,
      supplierIds: d.supplierIds.includes(id)
        ? d.supplierIds.filter((s) => s !== id)
        : [...d.supplierIds, id],
    }));
  }

  const assignedNames = (service.supplierIds ?? [])
    .map((id) => supplierMap.get(id))
    .filter(Boolean) as string[];

  if (editing) {
    return (
      <tr className="bg-blue-50">
        <td className="px-4 py-3" colSpan={5}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Nazwa</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Opis</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Dostawcy</label>
              {allSuppliers.length === 0 ? (
                <p className="text-xs text-slate-400">Brak dostawców — dodaj ich w zakładce Dostawcy.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {allSuppliers.map((s) => {
                    const active = draft.supplierIds.includes(s._id);
                    return (
                      <button
                        key={s._id}
                        type="button"
                        onClick={() => toggleSupplier(s._id)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                          active
                            ? "border-slate-800 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-100"
                        }`}
                      >
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* Sekcja domyślnych zadań */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Domyślne zadania (przy tworzeniu zlecenia)</label>
                <button
                  type="button"
                  onClick={() => setDraft(d => ({ ...d, defaultTasks: [...d.defaultTasks, { title: "Nowe zadanie" }] }))}
                  className="rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-200"
                >
                  + Dodaj zadanie
                </button>
              </div>
              
              {draft.defaultTasks.length === 0 ? (
                <p className="text-xs text-slate-400">Brak domyślnych zadań dla tej usługi.</p>
              ) : (
                <div className="space-y-2">
                  {draft.defaultTasks.map((task, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                        placeholder="Tytuł zadania (np. Zamówienie u dostawcy)"
                        value={task.title}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDraft(d => {
                            const nt = [...d.defaultTasks];
                            nt[idx] = { ...nt[idx], title: val };
                            return { ...d, defaultTasks: nt };
                          });
                        }}
                      />
                      <input
                        className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                        type="number"
                        min="0"
                        placeholder="Dni"
                        title="Dni na realizację od momentu utworzenia (puste = brak terminu)"
                        value={task.daysToComplete === undefined ? "" : task.daysToComplete}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDraft(d => {
                            const nt = [...d.defaultTasks];
                            nt[idx] = { ...nt[idx], daysToComplete: val === "" ? undefined : parseInt(val, 10) };
                            return { ...d, defaultTasks: nt };
                          });
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setDraft(d => {
                            const nt = [...d.defaultTasks];
                            nt.splice(idx, 1);
                            return { ...d, defaultTasks: nt };
                          });
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-600"
                        title="Usuń zadanie"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button onClick={save} disabled={busy || !draft.name}
                className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
                Zapisz
              </button>
              <button onClick={() => setEditing(false)}
                className="rounded-lg border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                Anuluj
              </button>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className={`group border-b border-slate-100 hover:bg-slate-50 ${!service.isActive ? "opacity-50" : ""}`}>
      <td className="px-2 py-3">
        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={() => onMoveUp(service._id, service.sortOrder)}
            className="text-slate-300 hover:text-slate-600"
            title="Przesuń w górę"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            onClick={() => onMoveDown(service._id, service.sortOrder)}
            className="text-slate-300 hover:text-slate-600"
            title="Przesuń w dół"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </td>
      <td className="px-4 py-3 text-sm font-medium text-slate-800">
        {service.name}
        {service.description && <span className="ml-1.5 text-xs text-slate-400">{service.description}</span>}
      </td>
      <td className="px-4 py-3">
        {assignedNames.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {assignedNames.map((name) => (
              <span key={name} className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                {name}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${service.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
          {service.isActive ? "Aktywna" : "Nieaktywna"}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="invisible flex justify-end gap-1 group-hover:visible">
          <button onClick={() => setEditing(true)}
            className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-200">Edytuj</button>
          <button onClick={() => onToggle(service._id)} disabled={busy}
            className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-200">
            {service.isActive ? "Dezaktywuj" : "Aktywuj"}
          </button>
          <button onClick={() => onDelete(service._id)} disabled={busy}
            className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50">Usuń</button>
        </div>
      </td>
    </tr>
  );
}

// --- Dostawcy Tab ---

function SuppliersTab() {
  const suppliers = useQuery(api.suppliers.list, { includeInactive: true });
  const createSupplier = useMutation(api.suppliers.create);
  const updateSupplier = useMutation(api.suppliers.update);
  const toggleActive = useMutation(api.suppliers.toggleActive);
  const removeSupplier = useMutation(api.suppliers.remove);

  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await createSupplier({ name: formName.trim() });
      setFormName("");
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd zapisu");
    } finally {
      setBusy(false);
    }
  }

  if (suppliers === undefined) {
    return <p className="text-sm text-slate-400">Ładowanie...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Dostawcy</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Zarządzaj dostawcami przypisywanymi do usług.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
          >
            + Dodaj dostawcę
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">Nowy dostawca</h3>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Nazwa *</label>
              <input
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="np. Alco"
              />
            </div>
          </div>
          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={busy || !formName.trim()}
              className="rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
              Dodaj
            </button>
            <button type="button" onClick={() => { setShowForm(false); setFormName(""); setError(null); }}
              className="rounded-lg border border-slate-300 px-5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              Anuluj
            </button>
          </div>
        </form>
      )}

      {suppliers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center">
          <p className="text-sm text-slate-400">Brak dostawców — dodaj pierwszego dostawcę</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Dostawca</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                <th className="w-32" />
              </tr>
            </thead>
            <tbody>
              {[...suppliers].map((s) => (
                <SupplierRow
                  key={s._id}
                  supplier={s}
                  onSave={(id, data) => updateSupplier({ id, ...data })}
                  onToggle={(id) => toggleActive({ id })}
                  onDelete={(id) => removeSupplier({ id })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SupplierRow({
  supplier,
  onSave,
  onToggle,
  onDelete,
}: {
  supplier: { _id: Id<"suppliers">; name: string; isActive: boolean };
  onSave: (id: Id<"suppliers">, data: { name?: string }) => Promise<unknown>;
  onToggle: (id: Id<"suppliers">) => Promise<unknown>;
  onDelete: (id: Id<"suppliers">) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(supplier.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await onSave(supplier._id, { name: draftName });
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd zapisu");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <tr className="bg-blue-50">
        <td className="px-4 py-3" colSpan={3}>
          <div className="flex items-center gap-2">
            <input
              className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
            />
            <button onClick={save} disabled={busy || !draftName.trim()}
              className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
              Zapisz
            </button>
            <button onClick={() => setEditing(false)}
              className="rounded-lg border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              Anuluj
            </button>
          </div>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </td>
      </tr>
    );
  }

  return (
    <tr className={`group border-b border-slate-100 hover:bg-slate-50 ${!supplier.isActive ? "opacity-50" : ""}`}>
      <td className="px-4 py-3 text-sm font-medium text-slate-800">{supplier.name}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${supplier.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
          {supplier.isActive ? "Aktywny" : "Nieaktywny"}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="invisible flex justify-end gap-1 group-hover:visible">
          <button onClick={() => setEditing(true)}
            className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-200">Edytuj</button>
          <button onClick={() => onToggle(supplier._id)} disabled={busy}
            className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-200">
            {supplier.isActive ? "Dezaktywuj" : "Aktywuj"}
          </button>
          <button onClick={() => onDelete(supplier._id)} disabled={busy}
            className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50">Usuń</button>
        </div>
      </td>
    </tr>
  );
}

// --- CRM Tab: menedżer statusów ---

const KIND_LABEL: Record<string, string> = {
  opportunity: "szansa sprzedaży",
  order: "zlecenie",
};

function CrmTab() {
  const registry = useQuery(api.crmConfig.listStatuses);
  const usage = useQuery(api.crmConfig.statusUsageCounts);
  const saveStatuses = useMutation(api.crmConfig.saveStatuses);

  const [draft, setDraft] = useState<StatusDef[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  useEffect(() => {
    if (registry) setDraft(registry.map((s) => ({ ...s })));
  }, [registry]);

  if (!draft) {
    return <div className="text-sm text-slate-400">Ładowanie...</div>;
  }

  const update = (idx: number, patch: Partial<StatusDef>) =>
    setDraft((d) => d!.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  const reorder = (from: number, to: number) =>
    setDraft((d) => {
      if (!d || to < 0 || to >= d.length || from === to) return d;
      const next = [...d];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });

  const addCustom = () => {
    setDraft((d) => {
      const list = d ?? [];
      const key = makeCustomStatusKey("nowy status", list.map((s) => s.key), Date.now());
      return [
        ...list,
        {
          key,
          label: "Nowy status",
          color: "#3b82f6",
          sortOrder: list.length,
          hidden: false,
          isCore: false,
          kind: "order" as const,
        },
      ];
    });
  };

  const remove = (idx: number) => {
    setError(null);
    const s = draft[idx];
    if (s.isCore) return;
    const count = usage?.[s.key] ?? 0;
    if (count > 0) {
      setError(`Status „${s.label}" jest używany przez ${count} ${count === 1 ? "zlecenie" : "zleceń"} — najpierw przenieś je do innego statusu.`);
      return;
    }
    setDraft((d) => d!.filter((_, i) => i !== idx));
  };

  async function handleSave() {
    setError(null);
    if (!draft) return;
    for (const s of draft) {
      if (!s.label.trim()) {
        setError("Nazwa statusu nie może być pusta.");
        return;
      }
    }
    setSaving(true);
    try {
      const payload = draft.map((s, i) => ({ ...s, sortOrder: i }));
      await saveStatuses({ statuses: payload });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      const msg =
        (err as { data?: string })?.data ??
        (err as Error)?.message ??
        "Błąd zapisu";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Statusy zleceń</h2>
        <p className="mt-1 text-sm text-slate-500">
          Zarządzaj nazwami, kolorami i kolejnością statusów w całym CRM. Przeciągnij, aby zmienić
          kolejność. Możesz dodać własne statusy. Statusów bazowych nie można usunąć.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {draft.map((s, idx) => {
          const style = deriveStatusStyle(s.color);
          const count = usage?.[s.key] ?? 0;
          return (
            <div
              key={s.key}
              draggable
              onDragStart={() => setDragIdx(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIdx !== null) reorder(dragIdx, idx);
                setDragIdx(null);
              }}
              onDragEnd={() => setDragIdx(null)}
              className={`flex items-center gap-2 rounded-md border bg-white px-2.5 py-2 ${
                dragIdx === idx ? "border-blue-400 opacity-60" : "border-slate-200"
              }`}
            >
              <span className="cursor-grab select-none text-slate-300" title="Przeciągnij">⠿</span>

              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  onClick={() => reorder(idx, idx - 1)}
                  disabled={idx === 0}
                  className="px-1 text-[10px] leading-none text-slate-400 hover:text-slate-700 disabled:opacity-30"
                  title="W górę"
                >▲</button>
                <button
                  type="button"
                  onClick={() => reorder(idx, idx + 1)}
                  disabled={idx === draft.length - 1}
                  className="px-1 text-[10px] leading-none text-slate-400 hover:text-slate-700 disabled:opacity-30"
                  title="W dół"
                >▼</button>
              </div>

              <input
                type="color"
                value={s.color}
                onChange={(e) => update(idx, { color: e.target.value })}
                className="h-7 w-9 shrink-0 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
                title="Kolor"
              />

              <input
                value={s.label}
                onChange={(e) => update(idx, { label: e.target.value })}
                className="min-w-0 flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />

              <span
                className="hidden shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium sm:inline-flex"
                style={{ background: style.bg, color: style.text, boxShadow: `inset 0 0 0 1px ${style.border}` }}
                title="Podgląd"
              >
                <span className="size-1.5 rounded-full" style={{ background: style.dot }} />
                {s.label || "—"}
              </span>

              <label className="flex shrink-0 items-center gap-1 text-xs text-slate-500" title="Ukryj kolumnę na tablicy">
                <input
                  type="checkbox"
                  checked={s.hidden}
                  onChange={(e) => update(idx, { hidden: e.target.checked })}
                />
                ukryj
              </label>

              <span className="w-24 shrink-0 text-right text-[11px] text-slate-400">
                {s.isCore ? KIND_LABEL[s.kind] : `${count} zleceń`}
              </span>

              {s.isCore ? (
                <span className="w-7 shrink-0 text-center text-[11px] text-slate-300" title="Status bazowy — nie można usunąć">🔒</span>
              ) : (
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="w-7 shrink-0 text-center text-slate-400 hover:text-red-600"
                  title="Usuń status"
                >✕</button>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addCustom}
        className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:border-slate-400 hover:bg-slate-50"
      >
        + Dodaj status
      </button>

      <div className="flex items-center gap-3 border-t border-slate-200 pt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? "Zapisywanie..." : "Zapisz"}
        </button>
        {saved && <span className="text-sm text-emerald-600">Zapisano.</span>}
      </div>
    </div>
  );
}

// --- Logi Tab ---

function LogiTab() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Logi systemowe</h2>
        <p className="mt-1 text-sm text-slate-500">
          Logi z akcji Convex (tworzenie folderów, błędy) zapisywane w czasie rzeczywistym.
        </p>
      </div>
      <Link
        href="/admin/logi"
        className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Otwórz logi →
      </Link>
    </div>
  );
}

// --- ExpenseCategoriesTab ---
function ExpenseCategoriesTab() {
  const categories = useQuery(api.expenseCategories.list);
  const createCategory = useMutation(api.expenseCategories.create);
  const removeCategory = useMutation(api.expenseCategories.remove);

  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await createCategory({ name: formName.trim() });
      setFormName("");
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd zapisu");
    } finally {
      setBusy(false);
    }
  }

  if (categories === undefined) {
    return <p className="text-sm text-slate-400">Ładowanie...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Kategorie wydatków</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Definiuj kategorie wydatków do przypisywania w rozliczeniach finansowych zleceń.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
          >
            + Dodaj kategorię
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">Nowy typ wydatków</h3>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Nazwa *</label>
              <input
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="np. Paliwo, Robocizna, Materiały..."
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
              >
                Zapisz
              </button>
            </div>
          </div>
          {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
        </form>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-sm font-semibold text-slate-900">Zdefiniowane kategorie</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {categories.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">Brak zdefiniowanych kategorii. Dodaj pierwszą kategorię powyżej.</p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                  <th className="px-5 py-3">Nazwa kategorii</th>
                  <th className="px-5 py-3 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {categories.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-800">{c.name}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={async () => {
                          if (confirm(`Czy na pewno chcesz usunąć kategorię "${c.name}"? Przypisane wydatki utracą tę kategorię.`)) {
                            await removeCategory({ categoryId: c._id });
                          }
                        }}
                        className="text-xs font-semibold text-red-600 hover:text-red-800"
                      >
                        Usuń
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Tabs config ---

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "google-drive", label: "Google Drive" },
  { key: "jotform", label: "Jotform" },
  { key: "fakturownia", label: "Fakturownia" },
  { key: "sms", label: "SMS" },
  { key: "szablony", label: "Szablony" },
  { key: "crm", label: "CRM" },
  { key: "uslugi", label: "Usługi" },
  { key: "dostawcy", label: "Dostawcy" },
  { key: "wydatki", label: "Kategorie wydatków" },
  { key: "logi", label: "Logi" },
  { key: "it-kanban", label: "IT Kanban" },
  { key: "typy-wydarzen", label: "Typy Wydarzeń" },
  { key: "ekipy-montazowe", label: "Ekipy Montażowe" },
];

// --- Main Page ---

export default function UstawieniaPage() {
  const [activeTab, setActiveTab] = useState<Tab>("google-drive");
  const router = useRouter();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Ustawienia</h1>
        <p className="text-slate-500 mt-1">Konfiguracja systemu.</p>
      </div>

      {/* Tab navigation */}
      <div className="border-b border-slate-200 mb-6">
        <nav className="flex gap-6 overflow-x-auto" aria-label="Zakladki ustawien">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "google-drive" && <GoogleDriveTab />}
      {activeTab === "jotform" && <JotformTab />}
      {activeTab === "fakturownia" && <FakturowniaTab />}
      {activeTab === "sms" && <SmsTab />}
      {activeTab === "szablony" && <SzablonyTab />}
      {activeTab === "crm" && <CrmTab />}
      {activeTab === "uslugi" && <ServicesTab />}
      {activeTab === "dostawcy" && <SuppliersTab />}
      {activeTab === "wydatki" && <ExpenseCategoriesTab />}
      {activeTab === "logi" && <LogiTab />}
      {activeTab === "it-kanban" && <ITKanbanTab />}
      {activeTab === "typy-wydarzen" && <EventTypesTab />}
      {activeTab === "ekipy-montazowe" && <InstallationTeamsTab />}

      {/* ── TEST SENTRY — odkomentuj żeby sprawdzić czy błędy docierają do Sentry ──
      <div className="mt-8 p-4 border border-dashed border-red-300 rounded-lg">
        <p className="text-xs text-red-400 mb-2 font-mono">// Sentry test — usuń po weryfikacji</p>
        <button
          onClick={() => { throw new Error("Sentry test error — ADK CRM frontend"); }}
          className="rounded bg-red-500 px-3 py-1.5 text-sm text-white hover:bg-red-600"
        >
          Rzuć testowy błąd (frontend)
        </button>
      </div>
      ── */}
    </div>
  );
}
