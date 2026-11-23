"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  TableProperties,
  Layers,
  Umbrella,
  Info,
  Wrench,
  Ruler,
  Percent,
} from "lucide-react";
import { fmtPLN } from "@/components/crm-ui";
import {
  GLASS_MODULE_CATALOG,
  GLASS_PRICING_CONFIG,
  STANDARD_MODULE_WIDTHS_CM,
} from "@/lib/glassPricing";
import { DEFAULT_TRIANGLE_PRICING_RANGES } from "@/lib/pricingRanges";
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

const ROOF_INSTALL_TIERS = [
  { label: "do 10 m²", sampleArea: 10 },
  { label: "10,01 – 15 m²", sampleArea: 15 },
  { label: "15,01 – 20 m²", sampleArea: 20 },
  { label: "20,01 – 25 m²", sampleArea: 25 },
  { label: "powyżej 25 m²", sampleArea: 30 },
] as const;

export default function OfferPriceListsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("zabudowa");
  const [roofCover, setRoofCover] = useState<RoofCoverType>("polycarbonate");
  const [roofViewMode, setRoofViewMode] = useState<PriceViewMode>("price");

  const glassMarkupPct = Math.round(
    (GLASS_PRICING_CONFIG.materialMarkupMultiplier - 1) * 100
  );
  const roofMarkupPct = Math.round(
    (ROOF_PRICING_CONFIG.materialMarkupMultiplier - 1) * 100
  );

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

      {/* Info banner */}
      <div className="panel p-3.5 flex items-start gap-3 bg-[#f8fafc] border border-[#e2e8f0]">
        <Info size={16} className="text-[#0e7490] shrink-0 mt-0.5" />
        <p className="text-xs text-[#475569] leading-relaxed">
          Poniższe stawki służą jako domyślna baza wyliczeń w algorytmie ofertowym. W konfiguratorze CAD
          każdej oferty nadal możesz ręcznie nadpisać cenę materiału, montażu lub dowolnej pozycji.
        </p>
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
          {/* Summary cards for Glass System */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="panel p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0e7490]">
                <Ruler size={14} />
                <span>Kryterium STANDARD (ścianki)</span>
              </div>
              <p className="text-xs text-[#475569] leading-relaxed">
                Szerokość dokładnie jedna z 10 wartości modułowych (
                <strong>94–578 cm</strong>) oraz wysokość w przedziale{" "}
                <strong>200–250 cm</strong> ze skokiem co <strong>5 cm</strong>.
              </p>
            </div>

            <div className="panel p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0e7490]">
                <Percent size={14} />
                <span>Materiał i niestandard</span>
              </div>
              <p className="text-xs text-[#475569] leading-relaxed">
                Narzut na materiał: <strong>+{glassMarkupPct}%</strong> (×
                {GLASS_PRICING_CONFIG.materialMarkupMultiplier}). Dla wymiaru{" "}
                <strong>NIESTANDARD</strong>: szkło{" "}
                <strong>
                  {GLASS_PRICING_CONFIG.glassPurchasePricePerM2} zł/m²
                </strong>{" "}
                + koszt profili bez szkła najbliższego wyższego modułu.
              </p>
            </div>

            <div className="panel p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0e7490]">
                <Wrench size={14} />
                <span>Montaż (ścianki przesuwne)</span>
              </div>
              <p className="text-xs text-[#475569] leading-relaxed">
                Rozliczany od szerokości <strong>modułu standardowego</strong>{" "}
                (w mb): koszt ekipy{" "}
                <strong>{GLASS_PRICING_CONFIG.installationCostPerMb} zł/mb</strong>
                , cena dla klienta{" "}
                <strong>
                  {GLASS_PRICING_CONFIG.installationPricePerMb} zł/mb
                </strong>
                .
              </p>
            </div>
          </div>

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
                Narzut materiału: +{glassMarkupPct}%
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
                      STANDARD cena (+{glassMarkupPct}%)
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
                      row.standardCostNet *
                        GLASS_PRICING_CONFIG.materialMarkupMultiplier
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
                9 progów szerokości · narzut +52%
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[#475569] text-left">
                    <th className="py-2.5 px-4 font-semibold">Zakres szerokości B</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Koszt materiału netto</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Cena materiału netto (+52%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef2f6]">
                  {DEFAULT_TRIANGLE_PRICING_RANGES.map((range) => (
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
          {/* Summary cards for Roofs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="panel p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0e7490]">
                <Ruler size={14} />
                <span>STANDARD vs NIESTANDARD</span>
              </div>
              <p className="text-xs text-[#475569] leading-relaxed">
                Standard to dokładne trafienie w siatkę szerokości (
                <strong>306–1206 cm</strong>) i głębokości (
                <strong>300–600 cm</strong>). Wymiar niestandardowy zaokrąglany
                jest w górę do najbliższego rozmiaru katalogowego.
              </p>
            </div>

            <div className="panel p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0e7490]">
                <Percent size={14} />
                <span>Poliwęglan vs Szkło i narzut</span>
              </div>
              <p className="text-xs text-[#475569] leading-relaxed">
                Koszt materiału dla szkła = koszt bazy poliwęglanu ×{" "}
                <strong>{ROOF_PRICING_CONFIG.glassMaterialMultiplier}</strong>.
                Cena sprzedaży materiału dla klienta = koszt materiału ×{" "}
                <strong>{ROOF_PRICING_CONFIG.materialMarkupMultiplier}</strong>{" "}
                (+{roofMarkupPct}%).
              </p>
            </div>

            <div className="panel p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0e7490]">
                <Wrench size={14} />
                <span>Serie i montaż w m²</span>
              </div>
              <p className="text-xs text-[#475569] leading-relaxed">
                Głębokość <strong>300–400 cm</strong> → seria{" "}
                <strong>STANDARD</strong>; głębokość{" "}
                <strong>450–600 cm</strong> → seria <strong>PRO+</strong>.
                Montaż liczony od rzeczywistej powierzchni (m²) wg progów poniżej.
              </p>
            </div>
          </div>

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
                    Cena netto (+{roofMarkupPct}%)
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
                              ? Math.round(
                                  rawCost *
                                    ROOF_PRICING_CONFIG.materialMarkupMultiplier
                                )
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
