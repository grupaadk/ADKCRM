"use client";

import { useState, useMemo } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  FileSpreadsheet,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Sparkles,
  Info,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Table,
} from "lucide-react";
import {
  POLYCARBONATE_CONFIG,
  WALLS_CONFIG,
  DEFAULT_WALL_ITEMS,
  STANDARD_DEPTHS,
  STANDARD_WIDTHS,
  type PriceListRow,
  type GenericPriceItem,
} from "@/lib/priceListConstants";
import { BASE_PRICE_MATRIX } from "@/lib/terraceCalculatorEngine";

type PriceCategory =
  | "polycarbonate"
  | "walls"
  | "glass"
  | "pergolas"
  | "zip_screens"
  | "accessories"
  | "assembly";

const CATEGORIES: Array<{ id: PriceCategory; label: string; available: boolean; configKey: string }> = [
  { id: "polycarbonate", label: "Zadaszenia Poliwęglan", available: true, configKey: POLYCARBONATE_CONFIG.key },
  { id: "walls", label: "Ściany przesuwne, stałe, trójkąt", available: true, configKey: WALLS_CONFIG.key },
  { id: "glass", label: "Zadaszenia Szkło", available: false, configKey: "glass_roofs" },
  { id: "pergolas", label: "Pergole Lamelowe", available: false, configKey: "pergolas" },
  { id: "zip_screens", label: "Rolety ZIP / Ekrany", available: false, configKey: "zip_screens" },
  { id: "accessories", label: "Akcesoria & Oświetlenie", available: false, configKey: "accessories" },
  { id: "assembly", label: "Stawki Montażu", available: false, configKey: "assembly" },
];

export function PriceListsTab() {
  const [activeCategory, setActiveCategory] = useState<PriceCategory>("polycarbonate");
  const [syncing, setSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  const me = useQuery(api.users.me);
  const isAdmin = me?.role === "admin";

  const activeConfig = useMemo(() => {
    if (activeCategory === "walls") return WALLS_CONFIG;
    return POLYCARBONATE_CONFIG;
  }, [activeCategory]);

  const priceList = useQuery(api.terracePricing.getPriceList, {
    key: activeConfig.key,
  });

  const syncLogs = useQuery(api.terracePricing.listSyncLogs, {
    priceListKey: activeConfig.key,
    limit: 10,
  });

  const syncPolyAction = useAction(api.terracePricing.syncPolycarbonate);
  const syncWallsAction = useAction(api.terracePricing.syncWalls);

  const handleSync = async () => {
    setSyncing(true);
    setSyncFeedback(null);
    try {
      let res;
      if (activeCategory === "walls") {
        res = await syncWallsAction({});
      } else {
        res = await syncPolyAction({});
      }

      if (res.success) {
        setSyncFeedback({
          type: "success",
          message: `Pomyślnie zsynchronizowano cennik (${res.itemCount} stawek).`,
        });
      } else {
        setSyncFeedback({
          type: "error",
          message: res.errorMessage || "Wystąpił błąd podczas pobierania cennika.",
        });
      }
    } catch (err: any) {
      setSyncFeedback({
        type: "error",
        message: err.message || "Błąd wywołania synchronizacji",
      });
    } finally {
      setSyncing(false);
    }
  };

  const widths = priceList?.widths ?? STANDARD_WIDTHS;
  const matrix = priceList?.matrix ?? [];

  // Generate flat rows for polycarbonate
  const polycarbonateRows: PriceListRow[] = useMemo(() => {
    const rows: PriceListRow[] = [];
    for (const d of STANDARD_DEPTHS) {
      const matrixRow = matrix.find((m) => m.depth === d.depth);
      for (const w of widths) {
        const matrixKey = `${d.series}_${d.depth}x${w}`;
        const baseEntry = BASE_PRICE_MATRIX[matrixKey];
        
        let priceNet = 0;
        if (matrixRow && matrixRow.prices[String(w)]) {
          priceNet = matrixRow.prices[String(w)];
        } else if (baseEntry) {
          priceNet = baseEntry.basePriceNet;
        }

        const area = baseEntry?.area ?? +((d.depth * w) / 10000).toFixed(2);
        const priceGross = baseEntry?.basePriceGross ?? Math.round(priceNet * 1.23);
        const priceNetPerSqM = area > 0 ? +(priceNet / area).toFixed(2) : 0;

        rows.push({
          key: matrixKey,
          dimensions: {
            depthCm: d.depth,
            widthCm: w,
          },
          dimension: `${d.depth} × ${w} cm`,
          dimensionMeters: `${(d.depth / 100).toFixed(2)} × ${(w / 100).toFixed(2)} m`,
          depthCm: d.depth,
          widthCm: w,
          series: d.series,
          areaSqM: area,
          priceNet,
          priceGross,
          priceNetPerSqM,
        });
      }
    }
    return rows;
  }, [matrix, widths]);

  // Wall items (Column A = Produkt / wymiary, Column C = Cena netto)
  const wallItems: GenericPriceItem[] = useMemo(() => {
    if (priceList?.items && Array.isArray(priceList.items) && priceList.items.length > 0) {
      return priceList.items;
    }
    return DEFAULT_WALL_ITEMS;
  }, [priceList]);

  return (
    <div className="space-y-6">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--panel)] rounded-2xl border border-[var(--line)] p-5 md:p-6 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-strong)]">Moduł Cenników</h2>
              <p className="text-xs text-[var(--text-mute)] mt-0.5">
                Baza cen pobierana bezpośrednio z arkusza Google Sheets dla modułu wycen ADK.
              </p>
            </div>
          </div>
        </div>

        {/* Source link & sync action */}
        <div className="flex items-center gap-3 flex-wrap">
          <a
            href={activeConfig.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--line-2)] bg-[var(--panel-2)] hover:bg-[var(--panel-2)]/80 text-xs font-semibold text-[var(--text-strong)] transition-colors shadow-2xs"
          >
            <ExternalLink className="w-3.5 h-3.5 text-brand" />
            <span>Otwórz arkusz Google Sheets ↗</span>
          </a>

          {isAdmin ? (
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-white text-xs font-semibold hover:bg-brand-hover disabled:opacity-50 transition-colors shadow-2xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              <span>{syncing ? "Pobieranie danych..." : "Synchronizuj z arkusza"}</span>
            </button>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500 text-xs font-medium border border-slate-200">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>Tylko do odczytu</span>
            </div>
          )}
        </div>
      </div>

      {/* ─── Sync Feedback Alert ────────────────────────────────────────────── */}
      {syncFeedback && (
        <div
          className={`p-4 rounded-xl text-xs font-medium border flex items-center justify-between gap-3 ${
            syncFeedback.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : "bg-amber-50 text-amber-900 border-amber-200"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {syncFeedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span>{syncFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncFeedback(null)}
            className="text-xs font-bold opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* ─── Sub-tabs Navigation ─────────────────────────────────────────────── */}
      <div className="border-b border-[var(--line)]">
        <nav className="flex gap-2 overflow-x-auto pb-2">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveCategory(cat.id);
                  setSyncFeedback(null);
                }}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
                  isActive
                    ? "bg-brand text-white shadow-2xs"
                    : cat.available
                    ? "bg-[var(--panel-2)] hover:bg-[var(--panel-2)]/80 text-[var(--text-strong)] border border-[var(--line-2)]"
                    : "bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60"
                }`}
              >
                <span>{cat.label}</span>
                {!cat.available && (
                  <span className="text-[10px] font-normal uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">
                    Wkrótce
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ─── ACTIVE TAB CONTENT: Zadaszenia Poliwęglan ───────────────────────── */}
      {activeCategory === "polycarbonate" && (
        <div className="space-y-6">
          {/* Metadata Summary Card */}
          <div className="bg-[var(--panel)] rounded-2xl border border-[var(--line)] p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[var(--line-2)] pb-3">
              <div className="font-bold text-sm text-[var(--text-strong)] flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand" />
                Konfiguracja i źródło cennika
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-100/90 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Aktywny · {polycarbonateRows.length} pozycji
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-[var(--panel-2)] border border-[var(--line-2)]">
                <span className="text-[11px] text-[var(--text-mute)] block mb-0.5 font-medium">Zakładka arkusza</span>
                <strong className="text-[var(--text-strong)] font-semibold">{POLYCARBONATE_CONFIG.sheetName}</strong>
              </div>
              <div className="p-3 rounded-xl bg-[var(--panel-2)] border border-[var(--line-2)]">
                <span className="text-[11px] text-[var(--text-mute)] block mb-0.5 font-medium">Ostatnia synchronizacja</span>
                <strong className="text-[var(--text-strong)] font-semibold">
                  {priceList?.syncedAt ? new Date(priceList.syncedAt).toLocaleString("pl-PL") : "Brak"}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-[var(--panel-2)] border border-[var(--line-2)]">
                <span className="text-[11px] text-[var(--text-mute)] block mb-0.5 font-medium">Zsynchronizował</span>
                <strong className="text-[var(--text-strong)] font-semibold truncate block" title={priceList?.syncedBy}>
                  {priceList?.syncedBy || "System"}
                </strong>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-[var(--text-mute)] pt-1">
              <Info className="w-3.5 h-3.5 text-brand shrink-0" />
              <span>
                Cennik pobierany bezpośrednio ze wskazanego arkusza Google dla zadaszeń z poliwęglanu (stawki netto).
              </span>
            </div>
          </div>

          {/* ─── 2-COLUMN TABLE (Wymiary & Cena netto) ────────────────────────── */}
          <div className="bg-[var(--panel)] rounded-2xl border border-[var(--line)] shadow-2xs overflow-hidden">
            <div className="p-4 md:p-5 border-b border-[var(--line)] flex items-center justify-between gap-3 bg-[var(--panel-2)]/50">
              <div className="flex items-center gap-2.5">
                <Table className="w-4 h-4 text-brand" />
                <div>
                  <h3 className="font-bold text-sm text-[var(--text-strong)]">
                    Cennik Zadaszeń Poliwęglan
                  </h3>
                  <p className="text-[11px] text-[var(--text-mute)]">
                    Łącznie {polycarbonateRows.length} pozycji wymiarowych
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-[var(--text-dim)]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                  STANDARD (Wysięg ≤ 400 cm)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block" />
                  PRO+ (Wysięg ≥ 450 cm)
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-[var(--panel-2)] border-b border-[var(--line)] text-[var(--text-strong)]">
                    <th className="p-3.5 font-bold sticky left-0 bg-[var(--panel-2)] z-10 min-w-[280px] border-r border-[var(--line)]">
                      Wymiary (Wysięg × Szerokość)
                    </th>
                    <th className="p-3.5 font-bold text-right min-w-[220px]">
                      Cena netto (PLN)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line-2)]/60">
                  {polycarbonateRows.map((row, idx) => {
                    const isPro = row.series === "PRO+";
                    return (
                      <tr
                        key={row.key}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          idx % 2 === 0 ? "bg-[var(--panel)]" : "bg-[var(--panel-2)]/30"
                        }`}
                      >
                        {/* Dimensions + Series Badge */}
                        <td className="p-3.5 sticky left-0 bg-inherit z-10 border-r border-[var(--line)]">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2.5">
                                <span className="font-bold text-slate-900 text-sm">
                                  {row.dimension}
                                </span>
                                <span className="text-xs text-[var(--text-mute)] font-normal">
                                  ({row.dimensionMeters})
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-[var(--text-mute)] font-medium">
                                <span>
                                  Wysięg: <strong className="text-slate-800 font-semibold">{row.dimensions.depthCm} cm</strong>
                                </span>
                                <span>×</span>
                                <span>
                                  Szerokość: <strong className="text-slate-800 font-semibold">{row.dimensions.widthCm} cm</strong>
                                </span>
                              </div>
                            </div>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md self-start sm:self-center shrink-0 ${
                                isPro
                                  ? "bg-purple-100 text-purple-800 border border-purple-200"
                                  : "bg-blue-100 text-blue-800 border border-blue-200"
                              }`}
                            >
                              {row.series}
                            </span>
                          </div>
                        </td>

                        {/* Price */}
                        <td className="p-3.5 text-right font-bold text-slate-900 text-sm">
                          {row.priceNet.toLocaleString("pl-PL")} zł <span className="text-xs font-normal text-slate-500">netto</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── Sync Logs / Audit History ─────────────────────────────────── */}
          <div className="bg-[var(--panel)] rounded-2xl border border-[var(--line)] shadow-2xs overflow-hidden">
            <button
              type="button"
              onClick={() => setShowLogs(!showLogs)}
              className="w-full p-4 md:p-5 flex items-center justify-between text-left hover:bg-[var(--panel-2)]/40 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-brand" />
                <span className="font-bold text-sm text-[var(--text-strong)]">Historia aktualizacji i synchronizacji</span>
                <span className="text-xs text-[var(--text-mute)]">({syncLogs?.length ?? 0} wpisów)</span>
              </div>
              {showLogs ? (
                <ChevronUp className="w-4 h-4 text-[var(--text-mute)]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[var(--text-mute)]" />
              )}
            </button>

            {showLogs && (
              <div className="p-4 md:p-5 border-t border-[var(--line)]">
                {(!syncLogs || syncLogs.length === 0) ? (
                  <p className="text-xs text-[var(--text-mute)] py-2">Brak zarejestrowanych zdarzeń synchronizacji.</p>
                ) : (
                  <div className="space-y-2.5">
                    {syncLogs.map((log) => (
                      <div
                        key={log._id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-[var(--panel-2)] border border-[var(--line-2)] text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          {log.status === "success" ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                          )}
                          <div>
                            <span className="font-semibold text-[var(--text-strong)]">
                              {log.status === "success" ? "Pomyślna synchronizacja" : "Błąd synchronizacji"}
                            </span>
                            <span className="text-[var(--text-mute)] ml-2">({log.itemCount} stawek)</span>
                            {log.errorMessage && (
                              <p className="text-[11px] text-amber-700 mt-0.5">{log.errorMessage}</p>
                            )}
                          </div>
                        </div>

                        <div className="text-[11px] text-[var(--text-dim)] flex items-center gap-3">
                          <span>{log.syncedBy}</span>
                          <span>•</span>
                          <span>{new Date(log.syncedAt).toLocaleString("pl-PL")}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── ACTIVE TAB CONTENT: Ściany przesuwne, stałe, trójkąt ────────────── */}
      {activeCategory === "walls" && (
        <div className="space-y-6">
          {/* Metadata Summary Card */}
          <div className="bg-[var(--panel)] rounded-2xl border border-[var(--line)] p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[var(--line-2)] pb-3">
              <div className="font-bold text-sm text-[var(--text-strong)] flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand" />
                Konfiguracja i źródło cennika
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-100/90 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Aktywny · {wallItems.length} pozycji
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-[var(--panel-2)] border border-[var(--line-2)]">
                <span className="text-[11px] text-[var(--text-mute)] block mb-0.5 font-medium">Zakładka arkusza</span>
                <strong className="text-[var(--text-strong)] font-semibold">{WALLS_CONFIG.sheetName}</strong>
              </div>
              <div className="p-3 rounded-xl bg-[var(--panel-2)] border border-[var(--line-2)]">
                <span className="text-[11px] text-[var(--text-mute)] block mb-0.5 font-medium">Ostatnia synchronizacja</span>
                <strong className="text-[var(--text-strong)] font-semibold">
                  {priceList?.syncedAt ? new Date(priceList.syncedAt).toLocaleString("pl-PL") : "Brak"}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-[var(--panel-2)] border border-[var(--line-2)]">
                <span className="text-[11px] text-[var(--text-mute)] block mb-0.5 font-medium">Zsynchronizował</span>
                <strong className="text-[var(--text-strong)] font-semibold truncate block" title={priceList?.syncedBy}>
                  {priceList?.syncedBy || "System"}
                </strong>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-[var(--text-mute)] pt-1">
              <Info className="w-3.5 h-3.5 text-brand shrink-0" />
              <span>
                Cennik pobierany z zakładki <strong>Ściany przesuwne,stałe,trójkąt</strong> (Produkt / wymiary oraz Cena netto).
              </span>
            </div>
          </div>

          {/* ─── 2-COLUMN TABLE (Produkt / wymiary & Cena netto) ───────────────── */}
          <div className="bg-[var(--panel)] rounded-2xl border border-[var(--line)] shadow-2xs overflow-hidden">
            <div className="p-4 md:p-5 border-b border-[var(--line)] flex items-center justify-between gap-3 bg-[var(--panel-2)]/50">
              <div className="flex items-center gap-2.5">
                <Table className="w-4 h-4 text-brand" />
                <div>
                  <h3 className="font-bold text-sm text-[var(--text-strong)]">
                    Cennik ścian
                  </h3>
                  <p className="text-[11px] text-[var(--text-mute)]">
                    Łącznie {wallItems.length} pozycji cennikowych
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-[var(--panel-2)] border-b border-[var(--line)] text-[var(--text-strong)]">
                    <th className="p-3.5 font-bold sticky left-0 bg-[var(--panel-2)] z-10 min-w-[340px] border-r border-[var(--line)]">
                      Produkt / wymiary
                    </th>
                    <th className="p-3.5 font-bold text-right min-w-[200px]">
                      Cena netto (PLN)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line-2)]/60">
                  {wallItems.map((item, idx) => {
                    const net = item.priceNet ?? Math.round((item.priceGross ?? 0) / 1.23);
                    const widthVal = item.dimensions?.widthCm ?? item.widthCm;
                    const heightVal = item.dimensions?.heightCm ?? item.heightCm;

                    return (
                      <tr
                        key={item.id || idx}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          idx % 2 === 0 ? "bg-[var(--panel)]" : "bg-[var(--panel-2)]/30"
                        }`}
                      >
                        <td className="p-3.5 sticky left-0 bg-inherit z-10 border-r border-[var(--line)]">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="space-y-0.5">
                              <span className="font-bold text-slate-900 text-sm block">
                                {item.name}
                              </span>
                              {widthVal && heightVal && (
                                <div className="flex items-center gap-2 text-[11px] text-[var(--text-mute)] font-medium">
                                  <span>
                                    Szerokość otworu: <strong className="text-slate-800 font-semibold">{widthVal} cm</strong>
                                  </span>
                                  <span>×</span>
                                  <span>
                                    Wysokość otworu: <strong className="text-slate-800 font-semibold">{heightVal} cm</strong>
                                  </span>
                                </div>
                              )}
                            </div>
                            {item.trackCount && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 self-start sm:self-center shrink-0">
                                {item.trackCount}-torowy
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5 text-right font-bold text-slate-900 text-sm">
                          {net.toLocaleString("pl-PL")} zł <span className="text-xs font-normal text-slate-500">netto</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── Sync Logs / Audit History ─────────────────────────────────── */}
          <div className="bg-[var(--panel)] rounded-2xl border border-[var(--line)] shadow-2xs overflow-hidden">
            <button
              type="button"
              onClick={() => setShowLogs(!showLogs)}
              className="w-full p-4 md:p-5 flex items-center justify-between text-left hover:bg-[var(--panel-2)]/40 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-brand" />
                <span className="font-bold text-sm text-[var(--text-strong)]">Historia aktualizacji i synchronizacji</span>
                <span className="text-xs text-[var(--text-mute)]">({syncLogs?.length ?? 0} wpisów)</span>
              </div>
              {showLogs ? (
                <ChevronUp className="w-4 h-4 text-[var(--text-mute)]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[var(--text-mute)]" />
              )}
            </button>

            {showLogs && (
              <div className="p-4 md:p-5 border-t border-[var(--line)]">
                {(!syncLogs || syncLogs.length === 0) ? (
                  <p className="text-xs text-[var(--text-mute)] py-2">Brak zarejestrowanych zdarzeń synchronizacji.</p>
                ) : (
                  <div className="space-y-2.5">
                    {syncLogs.map((log) => (
                      <div
                        key={log._id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-[var(--panel-2)] border border-[var(--line-2)] text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          {log.status === "success" ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                          )}
                          <div>
                            <span className="font-semibold text-[var(--text-strong)]">
                              {log.status === "success" ? "Pomyślna synchronizacja" : "Błąd synchronizacji"}
                            </span>
                            <span className="text-[var(--text-mute)] ml-2">({log.itemCount} stawek)</span>
                            {log.errorMessage && (
                              <p className="text-[11px] text-amber-700 mt-0.5">{log.errorMessage}</p>
                            )}
                          </div>
                        </div>

                        <div className="text-[11px] text-[var(--text-dim)] flex items-center gap-3">
                          <span>{log.syncedBy}</span>
                          <span>•</span>
                          <span>{new Date(log.syncedAt).toLocaleString("pl-PL")}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Upcoming Categories Placeholder ─────────────────────────────────── */}
      {activeCategory !== "polycarbonate" && activeCategory !== "walls" && (
        <div className="bg-[var(--panel)] rounded-2xl border border-[var(--line)] p-12 text-center space-y-3 shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[var(--text-strong)]">
            Cennik: {CATEGORIES.find((c) => c.id === activeCategory)?.label}
          </h3>
          <p className="text-xs text-[var(--text-mute)] max-w-md mx-auto">
            Ten element modułu cenników zostanie zintegrowany w kolejnym etapie (arkusz Google Sheets lub dedykowana baza stawek).
          </p>
        </div>
      )}
    </div>
  );
}
