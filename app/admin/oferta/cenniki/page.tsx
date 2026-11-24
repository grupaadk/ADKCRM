"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowLeft,
  TableProperties,
  Layers,
  Umbrella,
  Info,
  Percent,
  Save,
  RotateCcw,
  Check,
  Loader2,
} from "lucide-react";
import { fmtPLN } from "@/components/crm-ui";
import {
  GLASS_MODULE_CATALOG,
  GLASS_PRICING_CONFIG,
  STANDARD_MODULE_WIDTHS_CM,
} from "@/lib/glassPricing";
import { getTrianglePricingRanges } from "@/lib/pricingRanges";
import {
  ROOF_BASE_CATALOG,
  ROOF_PRICING_CONFIG,
  ROOF_STANDARD_DEPTHS_CM,
  ROOF_STANDARD_WIDTHS_CM,
  getRoofInstallationRates,
  getRoofSeries,
  type RoofCoverType,
} from "@/lib/roofPricing";

type ActiveTab = "zabudowa" | "zadaszenia";
type PriceViewMode = "price" | "cost";

const DEFAULT_MARKUP_PERCENT = 52;

const ROOF_INSTALL_TIERS = [
  { label: "do 10 m²", sampleArea: 10 },
  { label: "10,01 – 15 m²", sampleArea: 15 },
  { label: "15,01 – 20 m²", sampleArea: 20 },
  { label: "20,01 – 25 m²", sampleArea: 25 },
  { label: "powyżej 25 m²", sampleArea: 30 },
] as const;

function parsePercentInput(raw: string | null, fallback: number): number {
  if (raw === null) return fallback;
  const normalized = raw.replace(",", ".").trim();
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 500) return fallback;
  return parsed;
}

export default function OfferPriceListsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("zabudowa");
  const [roofCover, setRoofCover] = useState<RoofCoverType>("polycarbonate");
  const [roofViewMode, setRoofViewMode] = useState<PriceViewMode>("price");

  const pricingConfig = useQuery(api.crmConfig.getPricingConfig);
  const me = useQuery(api.users.me);
  const savePricingConfig = useMutation(api.crmConfig.savePricingConfig);

  const isAdmin = me?.role === "admin";
  const savedGlassPercent =
    pricingConfig?.glassMaterialMarkupPercent ?? DEFAULT_MARKUP_PERCENT;
  const savedRoofPercent =
    pricingConfig?.roofMaterialMarkupPercent ?? DEFAULT_MARKUP_PERCENT;

  const [glassDraft, setGlassDraft] = useState<string | null>(null);
  const [roofDraft, setRoofDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const glassInputValue = glassDraft ?? String(savedGlassPercent);
  const roofInputValue = roofDraft ?? String(savedRoofPercent);

  const effectiveGlassPercent = parsePercentInput(glassDraft, savedGlassPercent);
  const effectiveRoofPercent = parsePercentInput(roofDraft, savedRoofPercent);
  const effectiveGlassMultiplier = 1 + effectiveGlassPercent / 100;
  const effectiveRoofMultiplier = 1 + effectiveRoofPercent / 100;

  const isDirty =
    effectiveGlassPercent !== savedGlassPercent ||
    effectiveRoofPercent !== savedRoofPercent;

  const triangleRanges = getTrianglePricingRanges(effectiveGlassMultiplier);

  const handleSaveMarkups = async () => {
    setSaveError(null);
    setSaveMessage(null);
    const parsedGlass = Number(glassInputValue.replace(",", ".").trim());
    const parsedRoof = Number(roofInputValue.replace(",", ".").trim());
    if (
      !Number.isFinite(parsedGlass) ||
      parsedGlass < 0 ||
      parsedGlass > 500
    ) {
      setSaveError("Narzut dla zabudowy musi być liczbą z zakresu 0–500%.");
      return;
    }
    if (!Number.isFinite(parsedRoof) || parsedRoof < 0 || parsedRoof > 500) {
      setSaveError("Narzut dla zadaszeń musi być liczbą z zakresu 0–500%.");
      return;
    }
    setSaving(true);
    try {
      await savePricingConfig({
        glassMaterialMarkupPercent: parsedGlass,
        roofMaterialMarkupPercent: parsedRoof,
      });
      setGlassDraft(null);
      setRoofDraft(null);
      setSaveMessage("Zapisano narzuty na materiał.");
      setTimeout(() => setSaveMessage(null), 3500);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Nie udało się zapisać narzutów."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancelDraft = () => {
    setGlassDraft(null);
    setRoofDraft(null);
    setSaveError(null);
  };

  const handleResetDefaults = () => {
    setGlassDraft(String(DEFAULT_MARKUP_PERCENT));
    setRoofDraft(String(DEFAULT_MARKUP_PERCENT));
    setSaveError(null);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[rgba(74,187,195,0.12)] text-[#0e7490] rounded-lg border border-[rgba(74,187,195,0.3)]">
            <TableProperties size={22} className="text-[#4ABBC3]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#0b1220]">
              Cenniki zabudowy i zadaszeń
            </h1>
            <p className="text-xs text-[#7c8597] mt-0.5">
              Bazowe tabele i reguły wykorzystywane przez algorytm wycen ofertowych (wszystkie kwoty netto)
            </p>
          </div>
        </div>

        <Link
          href="/admin/oferta"
          className="btn"
          style={{ padding: "8px 14px", fontSize: 13 }}
        >
          <ArrowLeft size={15} />
          <span>Powrót do listy ofert</span>
        </Link>
      </div>

      {/* Configurable Material Markup Panel */}
      <div className="panel p-4 space-y-3 border border-[#d4dae3]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Percent size={15} className="text-[#0e7490]" />
            <h2 className="text-sm font-bold text-[#0b1220]">
              Konfiguracja narzutu na materiał
            </h2>
            {isDirty && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#fef3c7] text-[#92400e]">
                Podgląd niezapisanych zmian
              </span>
            )}
            {saveMessage && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#dcfce7] text-[#166534]">
                <Check size={12} />
                {saveMessage}
              </span>
            )}
          </div>
          {!isAdmin && me !== undefined && (
            <span className="text-[11px] text-[#7c8597]">
              Edycja narzutów dostępna dla administratora
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#334155]">
              Zabudowa szklana i trójkąty (%)
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={500}
                step={0.5}
                disabled={!isAdmin || saving}
                value={glassInputValue}
                onChange={(e) => {
                  setGlassDraft(e.target.value);
                  setSaveError(null);
                }}
                className="w-28 px-2.5 py-1.5 text-sm font-semibold text-[#0b1220] bg-[#f8fafc] border border-[#cbd5e1] rounded-md focus:outline-none focus:border-[#4ABBC3] focus:bg-white disabled:opacity-60 tabular-nums"
              />
              <span className="text-xs text-[#64748b] tabular-nums">
                % (mnożnik ×{effectiveGlassMultiplier.toFixed(2)})
              </span>
            </div>
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#334155]">
              Zadaszenia aluminiowe (%)
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={500}
                step={0.5}
                disabled={!isAdmin || saving}
                value={roofInputValue}
                onChange={(e) => {
                  setRoofDraft(e.target.value);
                  setSaveError(null);
                }}
                className="w-28 px-2.5 py-1.5 text-sm font-semibold text-[#0b1220] bg-[#f8fafc] border border-[#cbd5e1] rounded-md focus:outline-none focus:border-[#4ABBC3] focus:bg-white disabled:opacity-60 tabular-nums"
              />
              <span className="text-xs text-[#64748b] tabular-nums">
                % (mnożnik ×{effectiveRoofMultiplier.toFixed(2)})
              </span>
            </div>
          </label>

          {isAdmin && (
            <div className="flex items-center gap-2 flex-wrap lg:justify-end">
              <button
                type="button"
                onClick={handleSaveMarkups}
                disabled={!isDirty || saving}
                className="btn primary disabled:opacity-50"
                style={{ padding: "7px 14px", fontSize: 12.5 }}
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                <span>Zapisz narzuty</span>
              </button>

              {isDirty && (
                <button
                  type="button"
                  onClick={handleCancelDraft}
                  disabled={saving}
                  className="btn"
                  style={{ padding: "7px 12px", fontSize: 12.5 }}
                >
                  <span>Anuluj</span>
                </button>
              )}

              {(effectiveGlassPercent !== DEFAULT_MARKUP_PERCENT ||
                effectiveRoofPercent !== DEFAULT_MARKUP_PERCENT) && (
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  disabled={saving}
                  className="btn"
                  style={{ padding: "7px 12px", fontSize: 12.5 }}
                  title="Przywraca domyślny narzut 52% w formularzu"
                >
                  <RotateCcw size={13} />
                  <span>Domyślne (52%)</span>
                </button>
              )}
            </div>
          )}
        </div>

        {saveError && (
          <p className="text-xs font-medium text-[#b91c1c]">{saveError}</p>
        )}

        <div className="flex items-start gap-2 pt-1 border-t border-[#eef2f6]">
          <Info size={14} className="text-[#0e7490] shrink-0 mt-0.5" />
          <p className="text-[11px] text-[#64748b] leading-relaxed">
            Zmiana narzutu obowiązuje dla nowo dodawanych pozycji i przeliczeń wymiarów. Istniejące zapisane
            oferty oraz ręcznie nadpisane ceny materiału i montażu w konfiguratorze CAD pozostają bez zmian.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#e2e8f0] pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("zabudowa")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === "zabudowa"
              ? "bg-[#0e7490] text-white shadow-xs"
              : "bg-white text-[#475569] border border-[#d4dae3] hover:bg-[#f8fafc]"
          }`}
        >
          <Layers size={14} />
          <span>Zabudowa szklana i trójkąty</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("zadaszenia")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === "zadaszenia"
              ? "bg-[#0e7490] text-white shadow-xs"
              : "bg-white text-[#475569] border border-[#d4dae3] hover:bg-[#f8fafc]"
          }`}
        >
          <Umbrella size={14} />
          <span>Zadaszenia aluminiowe</span>
        </button>
      </div>

      {activeTab === "zabudowa" ? (
        <div className="space-y-5">
          {/* Glass modules table */}
          <div className="panel overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e2e8f0] bg-[#f8fafc] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-[#0b1220]">
                  Systemy całoszklane przesuwne — tabela modułów
                </h2>
                <p className="text-[11px] text-[#7c8597]">
                  Źródło: arkusz „OFERTOWANIE ŚCIANKI / WYLICZENIE SZKŁO” (kwoty netto)
                </p>
              </div>
              <span className="text-[11px] font-medium text-[#0e7490] bg-[rgba(74,187,195,0.12)] px-2.5 py-1 rounded-full">
                Narzut materiału: +{effectiveGlassPercent}%
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[#475569] text-left">
                    <th className="py-2.5 px-3 font-semibold">Moduł (szer. B)</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Skrzydła</th>
                    <th className="py-2.5 px-3 font-semibold text-right">System</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Szczotki</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Uchwyty</th>
                    <th className="py-2.5 px-3 font-semibold text-right bg-[#f0fdfa] text-[#0f766e]">
                      STANDARD koszt
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-right bg-[#f0fdfa] text-[#0f766e]">
                      STANDARD cena (+{effectiveGlassPercent}%)
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-right bg-[#fffbeb] text-[#92400e]">
                      NIESTANDARD profile (bez szkła)
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-right">
                      Montaż klient ({GLASS_PRICING_CONFIG.installationPricePerMb} zł/mb)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef2f6]">
                  {STANDARD_MODULE_WIDTHS_CM.map((widthCm) => {
                    const row = GLASS_MODULE_CATALOG[widthCm];
                    const stdPrice = Math.round(
                      row.standardCostNet * effectiveGlassMultiplier
                    );
                    const installPrice = Math.round(
                      (widthCm / 100) * GLASS_PRICING_CONFIG.installationPricePerMb
                    );
                    return (
                      <tr key={widthCm} className="hover:bg-[#f8fafc]">
                        <td className="py-2.5 px-3 font-medium text-[#0b1220]">
                          {row.label}
                        </td>
                        <td className="py-2.5 px-3 text-center text-[#475569]">
                          {row.panes}
                        </td>
                        <td className="py-2.5 px-3 text-right text-[#475569] tabular-nums">
                          {fmtPLN(row.systemCostNet)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-[#475569] tabular-nums">
                          {fmtPLN(row.brushesCostNet)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-[#475569] tabular-nums">
                          {fmtPLN(row.handlesCostNet)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-[#0f766e] bg-[#f0fdfa]/50 tabular-nums">
                          {fmtPLN(row.standardCostNet)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-[#0f766e] bg-[#f0fdfa]/50 tabular-nums">
                          {fmtPLN(stdPrice)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-[#92400e] bg-[#fffbeb]/50 tabular-nums">
                          {fmtPLN(row.nonStandardProfilesCostNet)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-[#475569] tabular-nums">
                          {fmtPLN(installPrice)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Triangles table */}
          <div className="panel overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e2e8f0] bg-[#f8fafc] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-[#0b1220]">
                  Trójkąty do zabudowy tarasu (LEWY / PRAWY) — progi szerokości B
                </h2>
                <p className="text-[11px] text-[#7c8597]">
                  Montaż trójkątów: 200 zł/mb koszt ekipy · 250 zł/mb cena dla klienta (od rzeczywistej szerokości B)
                </p>
              </div>
              <span className="text-[11px] font-medium text-[#0e7490] bg-[rgba(74,187,195,0.12)] px-2.5 py-1 rounded-full">
                9 progów szerokości · narzut +{effectiveGlassPercent}%
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[#475569] text-left">
                    <th className="py-2.5 px-4 font-semibold">Zakres szerokości B</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Koszt materiału netto</th>
                    <th className="py-2.5 px-4 font-semibold text-right">
                      Cena materiału netto (+{effectiveGlassPercent}%)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef2f6]">
                  {triangleRanges.map((range) => (
                    <tr
                      key={`${range.minWidthMm}-${range.maxWidthMm}`}
                      className="hover:bg-[#f8fafc]"
                    >
                      <td className="py-2.5 px-4 font-medium text-[#0b1220]">
                        {range.label || `${range.minWidthMm}–${range.maxWidthMm} mm`}
                      </td>
                      <td className="py-2.5 px-4 text-right text-[#475569] tabular-nums">
                        {fmtPLN(range.costNet ?? 0)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-[#0b1220] tabular-nums">
                        {fmtPLN(range.priceNet)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Roof Catalog Matrix */}
          <div className="panel overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e2e8f0] bg-[#f8fafc] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-[#0b1220]">
                  Zadaszenia aluminiowe — cennik katalogowy materiału (głębokość D × szerokość B)
                </h2>
                <p className="text-[11px] text-[#7c8597]">
                  Źródło: arkusz „OFERTOWANIE ZADASZENIA” · kwoty netto za sam materiał (bez montażu)
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Cover toggle */}
                <div className="inline-flex rounded-md border border-[#d4dae3] bg-white p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setRoofCover("polycarbonate")}
                    className={`px-2.5 py-1 rounded font-medium cursor-pointer transition-colors ${
                      roofCover === "polycarbonate"
                        ? "bg-[#0e7490] text-white"
                        : "text-[#475569] hover:text-[#0b1220]"
                    }`}
                  >
                    Poliwęglan
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoofCover("glass")}
                    className={`px-2.5 py-1 rounded font-medium cursor-pointer transition-colors ${
                      roofCover === "glass"
                        ? "bg-[#0e7490] text-white"
                        : "text-[#475569] hover:text-[#0b1220]"
                    }`}
                  >
                    Szkło (×{ROOF_PRICING_CONFIG.glassMaterialMultiplier})
                  </button>
                </div>

                {/* Price vs Cost toggle */}
                <div className="inline-flex rounded-md border border-[#d4dae3] bg-white p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setRoofViewMode("price")}
                    className={`px-2.5 py-1 rounded font-medium cursor-pointer transition-colors ${
                      roofViewMode === "price"
                        ? "bg-[#0b1220] text-white"
                        : "text-[#475569] hover:text-[#0b1220]"
                    }`}
                  >
                    Cena netto (+{effectiveRoofPercent}%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoofViewMode("cost")}
                    className={`px-2.5 py-1 rounded font-medium cursor-pointer transition-colors ${
                      roofViewMode === "cost"
                        ? "bg-[#0b1220] text-white"
                        : "text-[#475569] hover:text-[#0b1220]"
                    }`}
                  >
                    Koszt zakupu netto
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[#475569]">
                    <th className="py-2.5 px-3 text-left font-semibold sticky left-0 bg-[#f8fafc] z-10 min-w-[130px]">
                      Głębokość D / Seria
                    </th>
                    {ROOF_STANDARD_WIDTHS_CM.map((w) => (
                      <th
                        key={w}
                        className="py-2.5 px-2.5 text-right font-semibold whitespace-nowrap tabular-nums"
                      >
                        {w} cm
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef2f6]">
                  {ROOF_STANDARD_DEPTHS_CM.map((depthCm) => {
                    const series = getRoofSeries(depthCm);
                    const isPro = series === "PRO+";
                    return (
                      <tr key={depthCm} className="hover:bg-[#f8fafc]">
                        <td className="py-2.5 px-3 font-semibold text-[#0b1220] sticky left-0 bg-white z-10 border-r border-[#eef2f6] whitespace-nowrap">
                          <span>{depthCm} cm</span>
                          <span
                            className={`ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isPro
                                ? "bg-[#fef3c7] text-[#92400e]"
                                : "bg-[#e0f2fe] text-[#0369a1]"
                            }`}
                          >
                            {series}
                          </span>
                        </td>
                        {ROOF_STANDARD_WIDTHS_CM.map((widthCm) => {
                          const key = `${series}_${depthCm}x${widthCm}`;
                          const basePoly = ROOF_BASE_CATALOG[key] ?? 0;
                          const rawCost =
                            roofCover === "glass"
                              ? basePoly *
                                ROOF_PRICING_CONFIG.glassMaterialMultiplier
                              : basePoly;
                          const val =
                            roofViewMode === "price"
                              ? Math.round(rawCost * effectiveRoofMultiplier)
                              : Math.round(rawCost);
                          return (
                            <td
                              key={widthCm}
                              className="py-2.5 px-2.5 text-right tabular-nums whitespace-nowrap text-[#0b1220]"
                            >
                              {val.toLocaleString("pl-PL")} zł
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Roof Installation Rates Table */}
          <div className="panel overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e2e8f0] bg-[#f8fafc]">
              <h2 className="text-sm font-bold text-[#0b1220]">
                Stawki montażu zadaszeń (zł netto / m²)
              </h2>
              <p className="text-[11px] text-[#7c8597]">
                Dla wymiarów niestandardowych oraz wszystkich zadaszeń szklanych obowiązuje stawka z kolumny „Niestandard / Szkło” (+50 zł/m² dla klienta)
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[#475569] text-left">
                    <th className="py-2.5 px-4 font-semibold">Przedział powierzchni</th>
                    <th className="py-2.5 px-4 font-semibold text-right">
                      Klient — Standard (poliwęglan)
                    </th>
                    <th className="py-2.5 px-4 font-semibold text-right bg-[#fffbeb] text-[#92400e]">
                      Klient — Niestandard / Szkło
                    </th>
                    <th className="py-2.5 px-4 font-semibold text-right">
                      Koszt ekipy (poliwęglan)
                    </th>
                    <th className="py-2.5 px-4 font-semibold text-right">
                      Koszt ekipy (szkło)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef2f6]">
                  {ROOF_INSTALL_TIERS.map((tier) => {
                    const stdPoly = getRoofInstallationRates(
                      tier.sampleArea,
                      "polycarbonate",
                      true
                    );
                    const customOrGlass = getRoofInstallationRates(
                      tier.sampleArea,
                      "glass",
                      false
                    );
                    return (
                      <tr key={tier.label} className="hover:bg-[#f8fafc]">
                        <td className="py-2.5 px-4 font-medium text-[#0b1220]">
                          {tier.label}
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold text-[#0b1220] tabular-nums">
                          {stdPoly.pricePerM2} zł/m²
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold text-[#92400e] bg-[#fffbeb]/50 tabular-nums">
                          {customOrGlass.pricePerM2} zł/m²
                        </td>
                        <td className="py-2.5 px-4 text-right text-[#475569] tabular-nums">
                          {stdPoly.costPerM2} zł/m²
                        </td>
                        <td className="py-2.5 px-4 text-right text-[#475569] tabular-nums">
                          {customOrGlass.costPerM2} zł/m²
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
