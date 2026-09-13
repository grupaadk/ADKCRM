"use client";

import React, { useState, useMemo } from "react";
import {
  calculateTerraceEstimate,
  generateOfferText,
  formatPLN,
  STANDARD_DEPTHS,
} from "@/lib/terraceCalculatorEngine";
import {
  Calculator,
  Copy,
  Check,
  Printer,
  AlertTriangle,
  TrendingUp,
  Sliders,
  Sparkles,
  RefreshCw,
  Layers,
  Percent,
} from "lucide-react";

export default function TerraceCalculatorUI() {
  const [widthCm, setWidthCm] = useState<number>(1106);
  const [depthCm, setDepthCm] = useState<number>(550);
  const [materialMarkupPercent, setMaterialMarkupPercent] = useState<number>(52);
  const [customAssemblyRate, setCustomAssemblyRate] = useState<string>("");
  const [vatRatePercent, setVatRatePercent] = useState<number>(8);
  const [copied, setCopied] = useState<boolean>(false);
  const [selectedTab, setSelectedTab] = useState<"all" | "polycarbonate" | "glassStandard" | "glassNonStandard">("all");

  const calcResult = useMemo(() => {
    const customRate = customAssemblyRate !== "" ? parseFloat(customAssemblyRate) : null;
    return calculateTerraceEstimate({
      widthCm: Math.max(1, widthCm || 0),
      depthCm: Math.max(1, depthCm || 0),
      materialMarkupPercent: Number.isNaN(materialMarkupPercent) ? 52 : materialMarkupPercent,
      customAssemblyRateNetPerSqM: customRate && !Number.isNaN(customRate) ? customRate : null,
      vatRatePercent,
    });
  }, [widthCm, depthCm, materialMarkupPercent, customAssemblyRate, vatRatePercent]);

  const { input, options, warning } = calcResult;

  const handleCopyOffer = () => {
    const text = generateOfferText(calcResult);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleResetDefaults = () => {
    setWidthCm(1106);
    setDepthCm(550);
    setMaterialMarkupPercent(52);
    setCustomAssemblyRate("");
    setVatRatePercent(8);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner - Clean Light CRM Style */}
      <div className="panel p-5 bg-[var(--panel)] border border-[var(--line)] rounded-xl shadow-xs text-[var(--text-strong)] relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-[#4ABBC3] font-semibold text-xs tracking-wider uppercase mb-1">
              <Sparkles className="w-4 h-4" /> System Grupa ADK • Wycena Wstępna
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--text-strong)]">
              Kalkulator Zabudowy Tarasu
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetDefaults}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--text-dim)] bg-[var(--panel-2)] hover:bg-[var(--line)] border border-[var(--line)] rounded-lg transition-colors"
              title="Resetuj do wartości domyślnych"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reset
            </button>
          </div>
        </div>
      </div>

      {/* Warning message if out of bounds */}
      {warning && (
        <div className="bg-[rgba(74,187,195,0.08)] border border-[rgba(74,187,195,0.3)] rounded-xl p-4 flex items-start gap-3 text-[var(--text-strong)]">
          <AlertTriangle className="w-5 h-5 text-[#4ABBC3] shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold text-[#4ABBC3]">{warning}</span>
            <p className="text-[var(--text-dim)] mt-0.5">
              Standardowa matryca produkcyjna obsługuje szerokości do 1206 cm i głębokości do 600 cm. Dla podanych wymiarów wymagana jest wycena indywidualna.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid Layout: Left Controls, Right Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Inputs Form (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="panel p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <h2 className="font-bold text-sm text-[var(--text-strong)] flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#4ABBC3]" /> Parametry Wejściowe
              </h2>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 bg-[rgba(74,187,195,0.1)] text-[#4ABBC3] border border-[rgba(74,187,195,0.3)] rounded-full">
                Seria {input.series}
              </span>
            </div>

            {/* Dimension Inputs */}
            <div className="space-y-4">
              {/* Width Slider & Input */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-[var(--text-strong)]">
                    Szerokość zadaszenia (cm)
                  </label>
                  <span className="text-xs mono font-bold text-[#4ABBC3]">
                    {widthCm} cm ({ (widthCm / 100).toFixed(2) } m)
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={200}
                    max={1300}
                    step={1}
                    value={widthCm}
                    onChange={(e) => setWidthCm(parseInt(e.target.value) || 0)}
                    className="flex-1 accent-[#4ABBC3] h-2 bg-[var(--panel-2)] rounded-lg cursor-pointer"
                  />
                  <input
                    type="number"
                    value={widthCm}
                    onChange={(e) => setWidthCm(parseInt(e.target.value) || 0)}
                    className="w-24 px-3 py-1.5 text-right mono text-xs font-semibold border border-[var(--line)] rounded-lg bg-[var(--panel)] focus:ring-2 focus:ring-[#4ABBC3] focus:outline-none"
                  />
                </div>
                {/* Standard width chips */}
                <div className="flex flex-wrap gap-1 mt-2">
                  <span className="text-[10px] text-[var(--text-mute)] self-center mr-1">Wymiary:</span>
                  {[306, 406, 506, 606, 706, 806, 906, 1106].map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setWidthCm(w)}
                      className={`text-[10px] px-2 py-0.5 rounded border mono transition-colors ${
                        widthCm === w
                          ? "bg-[#4ABBC3] text-white border-[#4ABBC3] font-bold"
                          : "bg-[var(--panel-2)] text-[var(--text-dim)] border-[var(--line)] hover:border-[#4ABBC3]"
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>

              {/* Depth Slider & Input */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-[var(--text-strong)]">
                    Głębokość zadaszenia (cm)
                  </label>
                  <span className="text-xs mono font-bold text-[#4ABBC3]">
                    {depthCm} cm ({ (depthCm / 100).toFixed(2) } m)
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={200}
                    max={650}
                    step={1}
                    value={depthCm}
                    onChange={(e) => setDepthCm(parseInt(e.target.value) || 0)}
                    className="flex-1 accent-[#4ABBC3] h-2 bg-[var(--panel-2)] rounded-lg cursor-pointer"
                  />
                  <input
                    type="number"
                    value={depthCm}
                    onChange={(e) => setDepthCm(parseInt(e.target.value) || 0)}
                    className="w-24 px-3 py-1.5 text-right mono text-xs font-semibold border border-[var(--line)] rounded-lg bg-[var(--panel)] focus:ring-2 focus:ring-[#4ABBC3] focus:outline-none"
                  />
                </div>
                {/* Standard depth chips */}
                <div className="flex flex-wrap gap-1 mt-2">
                  <span className="text-[10px] text-[var(--text-mute)] self-center mr-1">Wymiary:</span>
                  {STANDARD_DEPTHS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDepthCm(d)}
                      className={`text-[10px] px-2 py-0.5 rounded border mono transition-colors ${
                        depthCm === d
                          ? "bg-[#4ABBC3] text-white border-[#4ABBC3] font-bold"
                          : "bg-[var(--panel-2)] text-[var(--text-dim)] border-[var(--line)] hover:border-[#4ABBC3]"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <hr className="border-[var(--line)]" />

            {/* Commercial Parameters */}
            <div className="space-y-4">
              <h3 className="text-[11px] font-bold text-[var(--text-mute)] uppercase tracking-wider">
                Parametry Handlowe i Montażowe
              </h3>

              {/* Material Markup */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-[var(--text-strong)] flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5 text-[var(--text-mute)]" /> Narzut na materiał (%)
                  </label>
                  <span className="text-xs mono font-bold text-[var(--text-strong)]">
                    {materialMarkupPercent}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={150}
                    step={1}
                    value={materialMarkupPercent}
                    onChange={(e) => setMaterialMarkupPercent(parseFloat(e.target.value) || 0)}
                    className="flex-1 accent-[#4ABBC3] h-2 bg-[var(--panel-2)] rounded-lg cursor-pointer"
                  />
                  <input
                    type="number"
                    value={materialMarkupPercent}
                    onChange={(e) => setMaterialMarkupPercent(parseFloat(e.target.value) || 0)}
                    className="w-20 px-2.5 py-1 text-right mono text-xs font-semibold border border-[var(--line)] rounded-lg bg-[var(--panel)] focus:ring-2 focus:ring-[#4ABBC3] focus:outline-none"
                  />
                </div>
              </div>

              {/* Custom Assembly Rate */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-[var(--text-strong)]">
                    Stawka montażu za m² netto
                  </label>
                  <span className="text-[11px] mono text-[var(--text-mute)]">
                    Auto: {input.suggestedAssemblyRateNetPerSqM} zł/m²
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    placeholder={`Automatycznie: ${input.suggestedAssemblyRateNetPerSqM} zł/m²`}
                    value={customAssemblyRate}
                    onChange={(e) => setCustomAssemblyRate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-[var(--line)] rounded-lg bg-[var(--panel)] focus:ring-2 focus:ring-[#4ABBC3] focus:outline-none mono"
                  />
                  {customAssemblyRate !== "" && (
                    <button
                      onClick={() => setCustomAssemblyRate("")}
                      className="absolute right-2 top-2 text-[11px] text-[#4ABBC3] hover:underline"
                    >
                      Reset auto
                    </button>
                  )}
                </div>
              </div>

              {/* VAT Rate Selection */}
              <div>
                <label className="text-xs font-semibold text-[var(--text-strong)] block mb-1.5">
                  Stawka podatku VAT
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVatRatePercent(8)}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold flex flex-col items-center transition-all ${
                      vatRatePercent === 8
                        ? "bg-[#4ABBC3] text-white border-[#4ABBC3] shadow-xs"
                        : "bg-[var(--panel-2)] text-[var(--text-dim)] border-[var(--line)] hover:border-[#4ABBC3]"
                    }`}
                  >
                    <span>VAT 8%</span>
                    <span className="text-[10px] opacity-80 font-normal">Usługa z montażem</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVatRatePercent(23)}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold flex flex-col items-center transition-all ${
                      vatRatePercent === 23
                        ? "bg-[#4ABBC3] text-white border-[#4ABBC3] shadow-xs"
                        : "bg-[var(--panel-2)] text-[var(--text-dim)] border-[var(--line)] hover:border-[#4ABBC3]"
                    }`}
                  >
                    <span>VAT 23%</span>
                    <span className="text-[10px] opacity-80 font-normal">Sprzedaż / B2B</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Matched Calculation Summary Badge */}
            <div className="bg-[var(--panel-2)] rounded-lg p-3.5 border border-[var(--line)] text-xs space-y-1.5 mono">
              <div className="flex justify-between text-[var(--text-dim)]">
                <span>Dopasowana matryca:</span>
                <span className="font-bold text-[var(--text-strong)]">{input.lookupKey}</span>
              </div>
              <div className="flex justify-between text-[var(--text-dim)]">
                <span>Powierzchnia:</span>
                <span className="font-bold text-[var(--text-strong)]">{input.areaSqM.toFixed(2)} m²</span>
              </div>
              <div className="flex justify-between text-[var(--text-dim)]">
                <span>Kwalifikacja wymiaru:</span>
                <span className={`font-bold ${input.isStandardDimension ? "text-[#4ABBC3]" : "text-[var(--text-strong)]"}`}>
                  {input.isStandardDimension ? "STANDARD" : "NIESTANDARD"}
                </span>
              </div>
              <div className="flex justify-between text-[var(--text-dim)]">
                <span>Cena bazowa mat.:</span>
                <span className="font-bold text-[var(--text-strong)]">{formatPLN(input.basePriceNet)} netto</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: 3 Cards Comparison (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Quick tab filter */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--text-strong)] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#4ABBC3]" /> Warianty Pokrycia Dachu
            </h2>
            <div className="flex gap-1 p-1 bg-[var(--panel-2)] border border-[var(--line)] rounded-lg text-xs">
              <button
                onClick={() => setSelectedTab("all")}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  selectedTab === "all"
                    ? "bg-[var(--panel)] text-[#4ABBC3] shadow-xs font-semibold"
                    : "text-[var(--text-dim)] hover:text-[var(--text-strong)]"
                }`}
              >
                Wszystkie 3
              </button>
              <button
                onClick={() => setSelectedTab("polycarbonate")}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  selectedTab === "polycarbonate"
                    ? "bg-[var(--panel)] text-[#4ABBC3] shadow-xs font-semibold"
                    : "text-[var(--text-dim)] hover:text-[var(--text-strong)]"
                }`}
              >
                Poliwęglan
              </button>
              <button
                onClick={() => setSelectedTab("glassStandard")}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  selectedTab === "glassStandard"
                    ? "bg-[var(--panel)] text-[#4ABBC3] shadow-xs font-semibold"
                    : "text-[var(--text-dim)] hover:text-[var(--text-strong)]"
                }`}
              >
                Szkło
              </button>
            </div>
          </div>

          {/* Cards Container */}
          <div
            className={`grid gap-4 ${
              selectedTab === "all"
                ? "grid-cols-1 md:grid-cols-3"
                : "grid-cols-1"
            }`}
          >
            {/* Card 1: Poliwęglan */}
            {(selectedTab === "all" || selectedTab === "polycarbonate") && (
              <RoofOptionCard
                result={options.polycarbonate}
                vatRate={input.vatRatePercent}
              />
            )}

            {/* Card 2: Szkło Standard */}
            {(selectedTab === "all" || selectedTab === "glassStandard") && (
              <RoofOptionCard
                result={options.glassStandard}
                vatRate={input.vatRatePercent}
              />
            )}

            {/* Card 3: Szkło Niestandard */}
            {(selectedTab === "all" || selectedTab === "glassNonStandard") && (
              <RoofOptionCard
                result={options.glassNonStandard}
                vatRate={input.vatRatePercent}
              />
            )}
          </div>

          {/* Całościowe Zestawienie Finansowe (Kc, C, Z, % marża) */}
          <div className="panel p-5 space-y-4 bg-[var(--panel)] border border-[var(--line)] rounded-xl shadow-xs">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <h3 className="font-bold text-sm text-[var(--text-strong)] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#4ABBC3]" /> Całościowe Zestawienie Finansowe (Kc, C, Z, % Marża)
              </h3>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 bg-[rgba(74,187,195,0.1)] text-[#4ABBC3] border border-[rgba(74,187,195,0.3)] rounded-full">
                Wskaźniki Handlowe
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs mono border-collapse">
                <thead>
                  <tr className="border-b border-[var(--line)] text-[var(--text-mute)] font-sans uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3 font-semibold text-left">Wskaźnik Finansowy</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Poliwęglan (netto)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Szkło Standard (netto)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Szkło Niestandard (netto)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)] text-[var(--text)]">
                  {/* Kc */}
                  <tr className="hover:bg-[var(--panel-2)] transition-colors">
                    <td className="py-2.5 px-3 font-sans font-medium text-[var(--text-strong)]">
                      <span className="font-bold text-[#4ABBC3] mr-1.5">Kc</span> Koszt własny (netto)
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium">{formatPLN(options.polycarbonate.costBasisKc)}</td>
                    <td className="py-2.5 px-3 text-right font-medium">{formatPLN(options.glassStandard.costBasisKc)}</td>
                    <td className="py-2.5 px-3 text-right font-medium">{formatPLN(options.glassNonStandard.costBasisKc)}</td>
                  </tr>
                  {/* C */}
                  <tr className="hover:bg-[var(--panel-2)] transition-colors">
                    <td className="py-2.5 px-3 font-sans font-medium text-[var(--text-strong)]">
                      <span className="font-bold text-[#4ABBC3] mr-1.5">C</span> Cena dla klienta (netto)
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-[var(--text-strong)]">{formatPLN(options.polycarbonate.totalNet)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-[var(--text-strong)]">{formatPLN(options.glassStandard.totalNet)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-[var(--text-strong)]">{formatPLN(options.glassNonStandard.totalNet)}</td>
                  </tr>
                  {/* Z */}
                  <tr className="hover:bg-[var(--panel-2)] transition-colors">
                    <td className="py-2.5 px-3 font-sans font-medium text-[var(--text-strong)]">
                      <span className="font-bold text-[#4ABBC3] mr-1.5">Z</span> Zysk kwotowy (netto)
                    </td>
                    <td className="py-2.5 px-3 text-right font-extrabold text-[#4ABBC3]">+{formatPLN(options.polycarbonate.profitZ)}</td>
                    <td className="py-2.5 px-3 text-right font-extrabold text-[#4ABBC3]">+{formatPLN(options.glassStandard.profitZ)}</td>
                    <td className="py-2.5 px-3 text-right font-extrabold text-[#4ABBC3]">+{formatPLN(options.glassNonStandard.profitZ)}</td>
                  </tr>
                  {/* % marża */}
                  <tr className="hover:bg-[var(--panel-2)] transition-colors bg-[rgba(74,187,195,0.04)]">
                    <td className="py-2.5 px-3 font-sans font-bold text-[var(--text-strong)]">
                      <span className="font-bold text-[#4ABBC3] mr-1.5">% marża</span> Marża procentowa
                    </td>
                    <td className="py-2.5 px-3 text-right font-extrabold text-[#4ABBC3] text-sm">
                      {options.polycarbonate.marginPercent.toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-extrabold text-[#4ABBC3] text-sm">
                      {options.glassStandard.marginPercent.toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-extrabold text-[#4ABBC3] text-sm">
                      {options.glassNonStandard.marginPercent.toFixed(2)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoofOptionCard({
  result,
  vatRate,
}: {
  result: ReturnType<typeof calculateTerraceEstimate>["options"]["polycarbonate"];
  vatRate: number;
}) {
  return (
    <div className="rounded-xl p-4 flex flex-col justify-between transition-all duration-200 relative bg-[var(--panel)] border border-[var(--line)] shadow-xs hover:border-[#4ABBC3] text-[var(--text-strong)]">
      <div>
        {/* Title */}
        <h3 className="text-base font-bold text-[var(--text-strong)]">
          {result.title}
        </h3>

        {/* Prices: Both Netto and Brutto */}
        <div className="mt-3 p-3 rounded-lg bg-[var(--panel-2)] border border-[var(--line)] space-y-2">
          <div>
            <div className="text-[10px] uppercase font-bold text-[var(--text-mute)] tracking-wider">Cena Netto</div>
            <div className="text-base font-bold mono text-[var(--text-strong)] flex justify-between items-baseline">
              <span>{formatPLN(result.totalNet)}</span>
              <span className="text-[11px] font-normal text-[var(--text-dim)]">{formatPLN(result.pricePerSqMNet)}/m²</span>
            </div>
          </div>
          <hr className="border-[var(--line)]" />
          <div>
            <div className="text-[10px] uppercase font-bold text-[#4ABBC3] tracking-wider">Cena Brutto (VAT {vatRate}%)</div>
            <div className="text-lg font-extrabold mono text-[#4ABBC3] flex justify-between items-baseline">
              <span>{formatPLN(result.totalGross)}</span>
              <span className="text-[11px] font-semibold text-[#4ABBC3]">{formatPLN(result.pricePerSqMGross)}/m²</span>
            </div>
          </div>
        </div>

        <hr className="my-3 border-[var(--line)]" />

        {/* Breakdown */}
        <div className="space-y-1.5 text-xs mono">
          <div className="flex justify-between">
            <span className="text-[var(--text-dim)]">Suma Netto:</span>
            <span className="font-bold text-[var(--text-strong)]">{formatPLN(result.totalNet)}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-[var(--text-mute)]">Materiał z narzutem:</span>
            <span className="text-[var(--text)]">{formatPLN(result.materialCostNet)}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-[var(--text-mute)]">Montaż netto:</span>
            <span className="text-[var(--text)]">{formatPLN(result.assemblyCostNet)}</span>
          </div>

          {result.extraGlassGrossDelta !== undefined && result.extraGlassGrossDelta > 0 && (
            <div className="pt-2.5 mt-1 border-t border-[var(--line)]">
              <div className="flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg bg-[rgba(74,187,195,0.08)] border border-[rgba(74,187,195,0.3)]">
                <span className="font-bold text-xs font-sans text-[#4ABBC3]">Dopłata do szkła:</span>
                <span className="font-extrabold text-[#4ABBC3] text-xs mono">
                  +{formatPLN(result.extraGlassGrossDelta)} brutto
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
