"use client";

import { useState } from "react";
import { useQuery, useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
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
} from "lucide-react";
import toast from "react-hot-toast";

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

export default function BackupsPage() {
  const convex = useConvex();
  const backupStats = useQuery(api.backups.getBackupStats);
  const [isExporting, setIsExporting] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);

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

  return (
    <div className="space-y-6">
      <CrmPageHeader
        title="Kopie Zapasowe i Eksport Bazy"
        sub="Pobieranie kopii zapasowej bazy danych w formacie JSON oraz instrukcja pełnego archiwum plików."
      />

      {/* Górne karty ze statystykami */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/20 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Łącznie rekordów
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

      {/* Sekcja 1: Eksport danych w przeglądarce */}
      <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <FileJson className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Pobierz kopię zapasową danych (JSON)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Generuje i pobiera pełny plik JSON ze wszystkimi tabelami i rekordami systemu CRM.
              </p>
            </div>
          </div>

          <button
            onClick={handleDownloadBackupJson}
            disabled={isExporting || !backupStats}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-medium text-sm transition-colors disabled:opacity-50 shadow-sm"
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

        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
          <span>Struktura pliku: JSON z podziałem na klucze reprezentujące poszczególne tabele bazy danych Convex.</span>
        </div>
      </div>

      {/* Sekcja 2: Eksport CLI z plikami */}
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

      {/* Sekcja 3: Statystyki tabel */}
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
