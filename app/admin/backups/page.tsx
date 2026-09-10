"use client";

import { useState } from "react";
import { useQuery, useMutation, useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { CrmPageHeader } from "@/components/crm-ui";
import {
  Database,
  Download,
  ShieldCheck,
  Copy,
  Check,
  FileJson,
  Archive,
  RefreshCw,
  HardDrive,
  Table as TableIcon,
  UploadCloud,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  User,
  Search,
  FileArchive,
} from "lucide-react";
import toast from "react-hot-toast";
import JSZip from "jszip";

const TABLE_LABELS: Record<string, string> = {
  users: "Użytkownicy i konta",
  clients: "Klienci",
  orders: "Zamówienia i zlecenia",
  complaints: "Reklamacje",
  services: "Słownik usług",
  suppliers: "Dostawcy",
  documentTemplates: "Szablony dokumentów",
  crmConfig: "Ustawienia CRM",
  systemLogs: "Logi systemowe",
  orderTasks: "Zadania zleceń",
  calendarEvents: "Warunki / Wydarzenia kalendarza",
  installationTeams: "Ekipy montażowe",
  cars: "Flota samochodowa",
  hrLeaves: "Urlopy i wniosek HR",
  aiAssistantConfig: "Konfiguracja Asystenta AI",
};

interface ParsedBackupPayload {
  version?: string;
  app?: string;
  exportedAt?: string;
  totalRecords?: number;
  tablesCount?: number;
  client?: {
    id: string;
    name: string;
  };
  tables: Record<string, Record<string, unknown>[]>;
}

export default function BackupsPage() {
  const convex = useConvex();
  const backupStats = useQuery(api.backups.getBackupStats);
  const restoreMutation = useMutation(api.backups.restoreFullBackup);

  const [isExporting, setIsExporting] = useState(false);
  const [isExportingClient, setIsExportingClient] = useState(false);
  const [isExportingClientZip, setIsExportingClientZip] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);

  // Stan dla podszukania klienta do dedykowanego backupu
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<Id<"clients"> | null>(null);

  const clientSearchResults = useQuery(
    api.clients.search,
    clientSearchTerm.trim().length > 0 ? { searchTerm: clientSearchTerm } : "skip"
  );
  const allClientsRes = useQuery(api.clients.list);
  const selectedClient = useQuery(
    api.clients.getById,
    selectedClientId ? { clientId: selectedClientId } : "skip"
  );

  // Stan dla importu / instalatora
  const [parsedBackup, setParsedBackup] = useState<ParsedBackupPayload | null>(null);
  const [rawUploadedZip, setRawUploadedZip] = useState<JSZip | null>(null);
  const [backupFileName, setBackupFileName] = useState<string | null>(null);
  const [restoreMode, setRestoreMode] = useState<"replace" | "merge">("replace");
  const [isRestoring, setIsRestoring] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restoreResult, setRestoreResult] = useState<{ totalImported: number; uploadedDriveFilesCount?: number } | null>(null);

  const cliCommand = "npx convex export --prod --include-file-storage --path ./backups/backup_full.zip";

  const handleCopyCli = () => {
    navigator.clipboard.writeText(cliCommand);
    setCopiedCli(true);
    toast.success("Skopiowano komendę do schowka!");
    setTimeout(() => setCopiedCli(false), 2500);
  };

  const handleDownloadBackupJson = async () => {
    setIsExporting(true);
    const toastId = toast.loading("Generowanie pełnej kopii zapasowej w formacie JSON...");

    try {
      const data = await convex.query(api.backups.exportFullBackup);
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const filename = `adk_crm_backup_${timestamp}.json`;

      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Kopia zapasowa pobrana! (${(blob.size / (1024 * 1024)).toFixed(2)} MB)`, { id: toastId });
    } catch (err: unknown) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Wystąpił błąd podczas generowania pliku kopii zapasowej.",
        { id: toastId }
      );
    } finally {
      setIsExporting(false);
    }
  };

  // Obsługa pobierania dedykowanego backupu dla konkretnego klienta (JSON)
  const handleDownloadClientBackup = async () => {
    if (!selectedClientId) {
      toast.error("Wybierz najpierw klienta z listy.");
      return;
    }

    setIsExportingClient(true);
    const toastId = toast.loading("Generowanie kopii zapasowej dla wybranego klienta...");

    try {
      const data = await convex.query(api.backups.exportClientBackup, { clientId: selectedClientId });
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const safeName = (data.client.name || "klient").replace(/[^a-zA-Z0-9_-]/g, "_");
      const filename = `adk_backup_klient_${safeName}_${timestamp}.json`;

      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Wygenerowano i pobrano kopię dla: ${data.client.name}`, { id: toastId });
    } catch (err: unknown) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Błąd podczas generowania kopii zapasowej klienta.",
        { id: toastId }
      );
    } finally {
      setIsExportingClient(false);
    }
  };

  // Obsługa pobierania PEŁNEGO ARCHIWUM ZIP DLA KLIENTA (JSON + pliki z Google Drive)
  const handleDownloadClientZipBackup = async () => {
    if (!selectedClientId) {
      toast.error("Wybierz najpierw klienta z listy.");
      return;
    }

    setIsExportingClientZip(true);
    const toastId = toast.loading("Przygotowywanie pełnego archiwum ZIP (dane + pliki Google Drive)...");

    try {
      const data = await convex.query(api.backups.exportClientBackup, { clientId: selectedClientId });

      const zip = new JSZip();
      zip.file("data.json", JSON.stringify(data, null, 2));

      toast.loading("Skanowanie plików klienta na Google Drive...", { id: toastId });
      const driveRes = await convex.action(api.googleDrive.getClientDriveFilesMetadata, {
        clientId: selectedClientId,
      });
      const driveFiles = driveRes.files ?? [];

      if (driveFiles.length > 0) {
        const driveFolder = zip.folder("Pliki_Google_Drive");
        let count = 0;

        for (const fileMeta of driveFiles) {
          count++;
          toast.loading(
            `Pobieranie z Google Drive (${count}/${driveFiles.length}): ${fileMeta.name}...`,
            { id: toastId }
          );

          try {
            const fileRes = await convex.action(api.googleDrive.downloadDriveFileBase64, {
              fileId: fileMeta.id,
            });
            const binaryStr = atob(fileRes.base64);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            driveFolder?.file(fileMeta.relativePath, bytes);
          } catch (fileErr) {
            console.error(`Nie udało się pobrać pliku ${fileMeta.name} z Drive:`, fileErr);
          }
        }
      }

      toast.loading("Pakowanie archiwum ZIP...", { id: toastId });
      const zipBlob = await zip.generateAsync({ type: "blob" });

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const safeName = (data.client.name || "klient").replace(/[^a-zA-Z0-9_-]/g, "_");
      const filename = `adk_backup_klient_${safeName}_FULL.zip`;

      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(
        `Pobrano pełne archiwum ZIP (${(zipBlob.size / (1024 * 1024)).toFixed(2)} MB, plików z Drive: ${driveFiles.length})!`,
        { id: toastId }
      );
    } catch (err: unknown) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Błąd podczas tworzenia archiwum ZIP klienta.",
        { id: toastId }
      );
    } finally {
      setIsExportingClientZip(false);
    }
  };

  // Obsługa wyboru pliku JSON lub ZIP do importu
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBackupFileName(file.name);
    setRestoreResult(null);
    setRawUploadedZip(null);

    try {
      if (file.name.endsWith(".zip")) {
        const zip = await JSZip.loadAsync(file);
        setRawUploadedZip(zip);

        const jsonFile =
          zip.file("data.json") ||
          Object.values(zip.files).find((f) => f.name.endsWith(".json") && !f.dir);

        if (!jsonFile) {
          throw new Error("Plik ZIP nie zawiera pliku data.json z danymi bazy.");
        }

        const jsonText = await jsonFile.async("string");
        const json = JSON.parse(jsonText);

        if (!json || typeof json !== "object" || !json.tables) {
          throw new Error("Struktura JSON w pliku ZIP jest nieprawidłowa.");
        }

        setParsedBackup(json as ParsedBackupPayload);
        toast.success(`Odczytano archiwum ZIP: ${file.name}`);
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const text = event.target?.result as string;
            const json = JSON.parse(text);
            if (!json || typeof json !== "object" || !json.tables) {
              throw new Error("Plik nie posiada prawidłowej struktury (brak sekcji tables).");
            }
            setParsedBackup(json as ParsedBackupPayload);
            toast.success(`Odczytano plik: ${file.name}`);
          } catch (err: unknown) {
            console.error(err);
            setParsedBackup(null);
            setBackupFileName(null);
            toast.error(err instanceof Error ? err.message : "Błąd odczytu pliku JSON.");
          }
        };
        reader.readAsText(file);
      }
    } catch (err: unknown) {
      console.error(err);
      setParsedBackup(null);
      setBackupFileName(null);
      toast.error(err instanceof Error ? err.message : "Błąd przetwarzania pliku backupu.");
    }
  };

  // Wykonanie przywracania danych i ewentualne wgrywanie plików na Google Drive
  const handleExecuteRestore = async () => {
    if (!parsedBackup) return;

    setConfirmOpen(false);
    setIsRestoring(true);
    const toastId = toast.loading("Przywracanie danych w bazie Convex...");

    try {
      // 1. Odtwórz dane bazy w Convex
      const res = await restoreMutation({
        backupData: parsedBackup,
        mode: restoreMode,
      });

      let uploadedDriveCount = 0;

      // 2. Jeśli wgrywamy plik ZIP zawierający podkatalog Pliki_Google_Drive
      if (rawUploadedZip) {
        const driveFilesToUpload: Array<{ relativePath: string; entry: JSZip.JSZipObject }> = [];
        rawUploadedZip.forEach((relativePath, entry) => {
          if (!entry.dir && (relativePath.startsWith("Pliki_Google_Drive/") || relativePath.startsWith("Pliki_Google_Drive\\"))) {
            const cleanRelPath = relativePath.replace(/^Pliki_Google_Drive[/\\]/, "");
            if (cleanRelPath) {
              driveFilesToUpload.push({ relativePath: cleanRelPath, entry });
            }
          }
        });

        if (driveFilesToUpload.length > 0) {
          // Ustalamy klienta do wgrania plików
          const clientRecords = parsedBackup.tables.clients as Array<{ _id: string }>;
          const targetClientId = (clientRecords && clientRecords.length > 0 ? clientRecords[0]._id : undefined) as Id<"clients"> | undefined;

          if (targetClientId) {
            let processed = 0;
            for (const item of driveFilesToUpload) {
              processed++;
              toast.loading(
                `Wgrywanie plików na Google Drive (${processed}/${driveFilesToUpload.length}): ${item.relativePath}...`,
                { id: toastId }
              );

              try {
                const base64 = await item.entry.async("base64");
                await convex.action(api.googleDrive.uploadBackupDriveFile, {
                  clientId: targetClientId,
                  relativePath: item.relativePath,
                  fileBase64: base64,
                });
                uploadedDriveCount++;
              } catch (driveErr) {
                console.error(`Błąd wgrywania pliku ${item.relativePath} na Google Drive:`, driveErr);
              }
            }
          }
        }
      }

      setRestoreResult({
        totalImported: res.totalImported,
        uploadedDriveFilesCount: uploadedDriveCount,
      });

      if (uploadedDriveCount > 0) {
        toast.success(
          `Odtworzono bazę danych (${res.totalImported} obiektów) i załadowano ${uploadedDriveCount} plików na Google Drive!`,
          { id: toastId }
        );
      } else {
        toast.success(`Pomyślnie przywrócono ${res.totalImported} obiektów w bazie danych!`, { id: toastId });
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Wystąpił błąd podczas przywracania danych.",
        { id: toastId }
      );
    } finally {
      setIsRestoring(false);
    }
  };

  const clientList = clientSearchTerm.trim().length > 0 ? clientSearchResults : allClientsRes?.page;

  return (
    <div className="space-y-6">
      <CrmPageHeader
        title="Kopie Zapasowe i Instalator Bazy"
        sub="Pobieranie pełnej kopii bazy, eksport klienta z plikami Google Drive (ZIP) oraz przywracanie z pliku JSON/ZIP."
      />

      {/* Górne karty ze statystykami */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/20 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Łącznie rekordów w bazie
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {backupStats ? backupStats.totalRecords.toLocaleString("pl-PL") : "..."}
            </div>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-950/20 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <TableIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Monitorowane tabele
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {backupStats ? Object.keys(backupStats.stats).length : "..."}
            </div>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-purple-500/20 bg-purple-500/5 dark:bg-purple-950/20 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Dostęp Administracyjny
            </div>
            <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Zabezpieczono (Role Admin)
            </div>
          </div>
        </div>
      </div>

      {/* Sekcja 1: Eksport danych (Pobieranie Pełnej Bazy) */}
      <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <FileJson className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                1. Pobierz pełną kopię zapasową danych (JSON)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Generuje i pobiera pełny plik JSON ze wszystkimi tabelami i rekordami systemu CRM.
              </p>
            </div>
          </div>

          <button
            onClick={handleDownloadBackupJson}
            disabled={isExporting || !backupStats}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-medium text-sm transition-colors disabled:opacity-50 shadow-sm shrink-0"
          >
            {isExporting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Generowanie...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Pobierz Kopię Bazy (.json)
              </>
            )}
          </button>
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400">
          Ustrukturyzowany format JSON umożliwia łatwy podgląd oraz import do nowego lub czystego środowiska CRM.
        </div>
      </div>

      {/* Sekcja 2: Dedykowany eksport dla konkretnego klienta */}
      <div className="p-6 rounded-xl border border-blue-500/30 bg-blue-500/5 dark:bg-blue-950/10 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              2. Eksport Kopii Zapasowej dla Konkretnego Klienta (JSON / ZIP z Google Drive)
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Wybierz klienta z listy, aby wyeksportować dedykowany pakiet danych (sam JSON lub pełne archiwum ZIP wraz z plikami z Google Drive).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {/* Wyszukiwanie i lista */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Wyszukaj i wybierz klienta:
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Szukaj po nazwisku, firmie, emailu..."
                value={clientSearchTerm}
                onChange={(e) => setClientSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-1 space-y-1">
              {!clientList ? (
                <div className="p-3 text-center text-xs text-gray-400">Wczytywanie listy klientów...</div>
              ) : clientList.length === 0 ? (
                <div className="p-3 text-center text-xs text-gray-400">Nie znaleziono klientów.</div>
              ) : (
                clientList.map((c) => {
                  const displayName =
                    [c.firstName, c.lastName].filter(Boolean).join(" ") ||
                    c.companyName ||
                    "Brak nazwy";
                  const isSelected = selectedClientId === c._id;

                  return (
                    <button
                      key={c._id}
                      onClick={() => setSelectedClientId(c._id)}
                      className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors flex items-center justify-between ${
                        isSelected
                          ? "bg-blue-600 text-white font-semibold"
                          : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200"
                      }`}
                    >
                      <div className="truncate pr-2">
                        <span className="font-medium">{displayName}</span>
                        {c.companyName && (
                          <span className={`ml-1.5 text-[10px] ${isSelected ? "text-blue-100" : "text-gray-400"}`}>
                            ({c.companyName})
                          </span>
                        )}
                      </div>
                      {c.city && (
                        <span className={`text-[10px] shrink-0 ${isSelected ? "text-blue-100" : "text-gray-400"}`}>
                          {c.city}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Podgląd wybranego klienta i akcje */}
          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Wybrana Kartoteka Klienta
            </h4>

            {!selectedClient ? (
              <div className="py-8 text-center text-xs text-gray-400 italic">
                Wybierz klienta z listy po lewej stronie, aby odblokować przyciski eksportu.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 space-y-1">
                  <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {[selectedClient.firstName, selectedClient.lastName].filter(Boolean).join(" ") ||
                      selectedClient.companyName}
                  </div>
                  {selectedClient.companyName && (
                    <div className="text-xs text-gray-600 dark:text-gray-300">
                      Firma: <strong>{selectedClient.companyName}</strong> {selectedClient.nip ? `(NIP: ${selectedClient.nip})` : ""}
                    </div>
                  )}
                  {selectedClient.email && (
                    <div className="text-xs text-gray-500">Email: {selectedClient.email}</div>
                  )}
                  {selectedClient.phone && (
                    <div className="text-xs text-gray-500">Tel: {selectedClient.phone}</div>
                  )}
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-end">
                  <button
                    onClick={handleDownloadClientBackup}
                    disabled={isExportingClient || isExportingClientZip}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium text-xs transition-colors disabled:opacity-50"
                  >
                    {isExportingClient ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    Pobierz Dane (.json)
                  </button>

                  <button
                    onClick={handleDownloadClientZipBackup}
                    disabled={isExportingClient || isExportingClientZip}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-xs transition-colors shadow-sm disabled:opacity-50"
                  >
                    {isExportingClientZip ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Pobieranie plików z Drive...
                      </>
                    ) : (
                      <>
                        <FileArchive className="w-3.5 h-3.5" />
                        Pobierz Pełny ZIP (z Google Drive)
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sekcja 3: Instalator & Przywracanie z pliku JSON / ZIP */}
      <div className="p-6 rounded-xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/10 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              3. Przywracanie i Instalator Bazy Danych z pliku JSON lub ZIP
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Wgraj plik `.json` lub archiwum `.zip`, aby odtworzyć bazę Convex oraz automatycznie utworzyć folder i wgrać pliki z powrotem na Google Drive.
            </p>
          </div>
        </div>

        {/* Wgrywanie pliku */}
        <div className="border-2 border-dashed border-emerald-500/30 rounded-xl p-6 text-center bg-white/60 dark:bg-gray-900/60 hover:bg-white transition-colors">
          <input
            type="file"
            accept=".json,.zip"
            id="backup-file-input"
            onChange={handleFileSelect}
            className="hidden"
          />
          <label htmlFor="backup-file-input" className="cursor-pointer space-y-2 block">
            <UploadCloud className="w-10 h-10 mx-auto text-emerald-600 dark:text-emerald-400" />
            <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
              {backupFileName ? (
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Wybrany plik: {backupFileName}
                </span>
              ) : (
                "Kliknij tutaj lub przeciągnij plik .json lub .zip"
              )}
            </div>
            <p className="text-xs text-gray-500">Obsługiwane formaty: plik .json oraz archiwum .zip (z plikami Google Drive)</p>
          </label>
        </div>

        {/* Podgląd wybranego backupu i ustawienia importu */}
        {parsedBackup && (
          <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  Wykryto prawidłową kopię zapasową
                </span>
                <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  Wyeksportowano: {parsedBackup.exportedAt ? new Date(parsedBackup.exportedAt).toLocaleString("pl-PL") : "Brak daty"}
                </div>
              </div>
              <div className="text-xs text-gray-500">
                Łącznie wykrytych obiektów: <strong className="text-gray-900 dark:text-gray-100">{Object.values(parsedBackup.tables).reduce((acc, t) => acc + (t?.length || 0), 0)}</strong>
              </div>
            </div>

            {/* Wybór trybu */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Wybierz tryb przywracania danych:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  onClick={() => setRestoreMode("replace")}
                  className={`p-3 rounded-lg border cursor-pointer flex items-start gap-3 transition-colors ${
                    restoreMode === "replace"
                      ? "border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-100"
                      : "border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="restoreMode"
                    checked={restoreMode === "replace"}
                    onChange={() => setRestoreMode("replace")}
                    className="mt-1"
                  />
                  <div>
                    <div className="text-xs font-bold">Nadpisz i zaktualizuj (Pełny import)</div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">
                      Czyści dotychczasowe dane i wgrywa dokładny stan z pliku.
                    </div>
                  </div>
                </label>

                <label
                  onClick={() => setRestoreMode("merge")}
                  className={`p-3 rounded-lg border cursor-pointer flex items-start gap-3 transition-colors ${
                    restoreMode === "merge"
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                      : "border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="restoreMode"
                    checked={restoreMode === "merge"}
                    onChange={() => setRestoreMode("merge")}
                    className="mt-1"
                  />
                  <div>
                    <div className="text-xs font-bold">Połącz z istniejącymi danymi (Merge)</div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">
                      Dopisuje nowe rekordy z pliku bez usuwania obecnych danych.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Tabela wykrytych obiektów */}
            <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-800 p-2 bg-gray-50/50 dark:bg-gray-950/50">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {Object.entries(parsedBackup.tables).map(([tbl, items]) => (
                  <div key={tbl} className="flex justify-between px-2 py-1 bg-white dark:bg-gray-900 rounded border border-gray-100 dark:border-gray-800">
                    <span className="font-mono text-[11px] truncate max-w-[120px]">{tbl}</span>
                    <span className="font-bold">{items?.length || 0}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={isRestoring}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors shadow-md disabled:opacity-50"
              >
                {isRestoring ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Przywracanie danych i plików...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    Rozpocznij Przywracanie Bazy & Plików
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Informacja o wyniku po sukcesie */}
        {restoreResult && (
          <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <div className="text-sm font-bold">Import bazy danych oraz plików zakończony pomyślnie!</div>
              <div className="text-xs">
                Zaimportowano łącznie {restoreResult.totalImported} obiektów bazy.
                {restoreResult.uploadedDriveFilesCount ? ` Otworzono i załadowano ${restoreResult.uploadedDriveFilesCount} plików na Google Drive.` : ""}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Potwierdzenia */}
      {confirmOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h4 className="text-base font-bold text-gray-900 dark:text-gray-100">
                Potwierdzenie przywracania bazy
              </h4>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              Czy na pewno chcesz rozpocząć przywracanie danych z pliku <strong>{backupFileName}</strong> w trybie{" "}
              <strong>{restoreMode === "replace" ? "Nadpisz i zaktualizuj" : "Połącz (Merge)"}</strong>?
            </p>

            <div className="flex justify-end gap-3 pt-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={handleExecuteRestore}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-md"
              >
                Tak, Przywróć Bazę
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sekcja 4: Eksport CLI z plikami */}
      <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Archive className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Eksport CLI & Pełne Archiwum Załączników (ZIP)
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Instrukcja pobrania pełnego backupu bazy wraz z fizycznymi plikami z Convex Storage.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-gray-950 text-gray-100 font-mono text-xs flex items-center justify-between gap-4 overflow-x-auto">
          <code>{cliCommand}</code>
          <button
            onClick={handleCopyCli}
            className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors shrink-0"
            title="Kopiuj polecenie"
          >
            {copiedCli ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <p>• Uruchom powyższą komendę w terminalu w katalogu głównym projektu.</p>
          <p>• Parametr <code>--include-file-storage</code> sprawi, że w archiwum ZIP znajdą się również zapisane rysunki, wyceny oraz załączniki PDF.</p>
        </div>
      </div>

      {/* Sekcja 5: Statystyki tabel */}
      <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-gray-400" />
            Szczegóły tabel w bazie danych
          </h3>
          <span className="text-xs text-gray-500">
            {backupStats ? `Ostatnia aktualizacja: ${new Date(backupStats.exportedAt).toLocaleTimeString("pl-PL")}` : ""}
          </span>
        </div>

        {!backupStats ? (
          <div className="py-8 text-center text-sm text-gray-500 animate-pulse">
            Wczytywanie statystyk bazy danych...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(backupStats.stats).map(([table, count]) => (
              <div
                key={table}
                className="p-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 font-mono">
                    {table}
                  </div>
                  <div className="text-[11px] text-gray-500 truncate max-w-[170px]">
                    {TABLE_LABELS[table] || table}
                  </div>
                </div>
                <div className="text-sm font-bold text-gray-900 dark:text-gray-100 px-2 py-0.5 rounded bg-gray-200/60 dark:bg-gray-800">
                  {count}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
