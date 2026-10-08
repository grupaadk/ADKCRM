"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  calculateTerraceEstimate,
  isStandardDimension,
  findMatchedDepth,
  findMatchedWidth,
  type TerraceInput,
  type TerraceCalculationResult,
} from "@/lib/terraceCalculatorEngine";
import {
  Ruler,
  Percent,
  Hammer,
  AlertTriangle,
  FileText,
  Info,
} from "lucide-react";
import { CustomSelect } from "@/components/ui/CustomSelect";

const DEPTH_OPTIONS = [
  { value: 300, label: "300 cm (3,0 m - STANDARD)" },
  { value: 350, label: "350 cm (3,5 m - STANDARD)" },
  { value: 400, label: "400 cm (4,0 m - STANDARD)" },
  { value: 450, label: "450 cm (4,5 m - PRO+)" },
  { value: 500, label: "500 cm (5,0 m - PRO+)" },
  { value: 550, label: "550 cm (5,5 m - PRO+)" },
  { value: 600, label: "600 cm (6,0 m - PRO+)" },
];

const WIDTH_OPTIONS = [
  { value: 306, label: "306 cm (3,06 m)" },
  { value: 406, label: "406 cm (4,06 m)" },
  { value: 506, label: "506 cm (5,06 m)" },
  { value: 606, label: "606 cm (6,06 m)" },
  { value: 706, label: "706 cm (7,06 m)" },
  { value: 806, label: "806 cm (8,06 m)" },
  { value: 906, label: "906 cm (9,06 m)" },
  { value: 1006, label: "1006 cm (10,06 m)" },
  { value: 1106, label: "1106 cm (11,06 m)" },
  { value: 1206, label: "1206 cm (12,06 m)" },
];

interface TerraceRoofConfiguratorProps {
  initialInput?: Partial<TerraceInput>;
  clientType?: "individual" | "business";
  userRole?: string; // "admin" | "manager" | "employee" | etc.
  onChange: (data: {
    serviceName: string;
    calculatorType: string;
    input: TerraceInput;
    result: TerraceCalculationResult;
    offerText: string;
    isValid: boolean;
  }) => void;
}

export function TerraceRoofConfigurator({
  initialInput,
  clientType,
  userRole,
  onChange,
}: TerraceRoofConfiguratorProps) {
  // DB Assembly Params & Price Matrix
  const assemblyParams = useQuery(api.terraceAssemblyParams.getParams);
  const polyPriceList = useQuery(api.terracePricing.getPriceList, {
    key: "polycarbonate_roofs",
  });

  const isAdminOrManager = userRole === "admin" || userRole === "manager";

  // Form State
  const [depthCm, setDepthCm] = useState<number>(initialInput?.depthCm ?? 350);
  const [widthCm, setWidthCm] = useState<number>(initialInput?.widthCm ?? 506);
  const [isCustomDepth, setIsCustomDepth] = useState<boolean>(
    initialInput?.depthCm ? !DEPTH_OPTIONS.some((o) => o.value === initialInput.depthCm) : false
  );
  const [isCustomWidth, setIsCustomWidth] = useState<boolean>(
    initialInput?.widthCm ? !WIDTH_OPTIONS.some((o) => o.value === initialInput.widthCm) : false
  );

  const [userMarkupPercent, setUserMarkupPercent] = useState<number | null>(
    initialInput?.materialMarkupPercent ?? null
  );
  const materialMarkupPercent =
    userMarkupPercent ?? assemblyParams?.defaultMarkupPercent ?? 52;

  const [customAssemblyRate, setCustomAssemblyRate] = useState<string>(
    initialInput?.customAssemblyRateNetPerSqM ? String(initialInput.customAssemblyRateNetPerSqM) : ""
  );

  // Build custom price matrix map from DB if available
  const customPriceMatrixMap = useMemo(() => {
    if (!polyPriceList?.matrix) return undefined;
    const map: Record<string, number> = {};
    for (const row of polyPriceList.matrix) {
      for (const [wStr, price] of Object.entries(row.prices)) {
        const key = `${row.series}_${row.depth}x${wStr}`;
        map[key] = price;
      }
    }
    return map;
  }, [polyPriceList]);

  // Determine VAT rate from clientType
  const effectiveVatPercent = clientType === "business" ? 23 : 8;

  // Calculation Result
  const calcResult = useMemo(() => {
    const parsedCustomRate = customAssemblyRate !== "" ? parseFloat(customAssemblyRate) : null;
    const input: TerraceInput = {
      depthCm: depthCm || 0,
      widthCm: widthCm || 0,
      materialMarkupPercent,
      customAssemblyRateNetPerSqM: parsedCustomRate && !isNaN(parsedCustomRate) ? parsedCustomRate : null,
      vatRatePercent: effectiveVatPercent,
      clientType,
    };

    const dynamicParams = {
      defaultMarkupPercent: assemblyParams?.defaultMarkupPercent ?? 52,
      assemblyRatesStandard: assemblyParams?.assemblyRatesStandard,
      assemblyRatesNonStandard: assemblyParams?.assemblyRatesNonStandard,
      customPriceMatrix: customPriceMatrixMap,
    };

    return calculateTerraceEstimate(input, dynamicParams);
  }, [
    depthCm,
    widthCm,
    materialMarkupPercent,
    customAssemblyRate,
    effectiveVatPercent,
    clientType,
    assemblyParams,
    customPriceMatrixMap,
  ]);

  const isValid = depthCm > 0 && widthCm > 0 && !calcResult.input.isOutOfRange;

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Trigger parent onChange
  useEffect(() => {
    onChangeRef.current({
      serviceName: "Zadaszenie tarasu",
      calculatorType: "terrace_roof",
      input: {
        depthCm,
        widthCm,
        materialMarkupPercent,
        customAssemblyRateNetPerSqM: customAssemblyRate !== "" ? parseFloat(customAssemblyRate) : null,
        vatRatePercent: effectiveVatPercent,
        clientType,
      },
      result: calcResult,
      offerText: calcResult.offerText,
      isValid,
    });
  }, [depthCm, widthCm, materialMarkupPercent, customAssemblyRate, effectiveVatPercent, clientType, calcResult, isValid]);

  const matchedDepth = findMatchedDepth(depthCm);
  const matchedWidth = findMatchedWidth(widthCm);
  const isStd = isStandardDimension(depthCm, widthCm);

  return (
    <div className="space-y-6">
      {/* ─── Input Fields Panel ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 md:p-6 shadow-2xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
              <Ruler className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[var(--text-strong)]">
                Wymiary otworu zadaszenia
              </h3>
              <p className="text-xs text-[var(--text-mute)]">
                Wprowadź wymiary budowlane w centymetrach.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-md border ${
                isStd
                  ? "bg-slate-100 text-slate-700 border-slate-200"
                  : "bg-amber-50 text-amber-800 border-amber-200"
              }`}
            >
              {isStd ? "Wymiar standardowy" : "Wymiar niestandardowy"}
            </span>
          </div>
        </div>

        {/* Wymiary: Głębokość i Szerokość (Natywne Dropdowny z Excela) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Głębokość / Wysięg */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[var(--text-strong)] flex items-center gap-1.5">
                <span>Głębokość / Wysięg (B2)</span>
                <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-[var(--text-mute)] font-medium">
                Cennik: <strong className="text-slate-800">{matchedDepth} cm</strong>
              </span>
            </div>

            {!isCustomDepth ? (
              <CustomSelect
                value={depthCm}
                options={DEPTH_OPTIONS}
                onChange={(val) => setDepthCm(val)}
                customOptionLabel="✏️ Inny wymiar (wpisz własne cm)..."
                onSelectCustom={() => setIsCustomDepth(true)}
              />
            ) : (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    min={200}
                    max={600}
                    value={depthCm || ""}
                    onChange={(e) => setDepthCm(parseInt(e.target.value, 10) || 0)}
                    placeholder="Wpisz głębokość w cm..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-brand bg-white text-sm font-semibold text-[var(--text-strong)] focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-[var(--text-mute)] font-medium">cm</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomDepth(false);
                    setDepthCm(350);
                  }}
                  className="px-3 py-2.5 rounded-xl border border-[var(--line-2)] bg-[var(--panel-2)] hover:bg-slate-200 text-xs font-semibold text-[var(--text-dim)] shrink-0 cursor-pointer"
                >
                  Lista ▾
                </button>
              </div>
            )}
            {/* Quick preset chips */}
            <div className="flex items-center gap-1.5 pt-1 flex-wrap">
              {[300, 350, 400].map((dPreset) => (
                <button
                  key={dPreset}
                  type="button"
                  onClick={() => {
                    setIsCustomDepth(false);
                    setDepthCm(dPreset);
                  }}
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-lg border transition-colors cursor-pointer ${
                    depthCm === dPreset && !isCustomDepth
                      ? "bg-brand text-white border-brand shadow-2xs"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {dPreset} cm ({(dPreset / 100).toFixed(1)} m)
                </button>
              ))}
            </div>
          </div>

          {/* Szerokość */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[var(--text-strong)] flex items-center gap-1.5">
                <span>Szerokość (B3)</span>
                <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-[var(--text-mute)] font-medium">
                Cennik: <strong className="text-slate-800">{matchedWidth} cm</strong> ({calcResult.input.series})
              </span>
            </div>

            {!isCustomWidth ? (
              <CustomSelect
                value={widthCm}
                options={WIDTH_OPTIONS}
                onChange={(val) => setWidthCm(val)}
                customOptionLabel="✏️ Inny wymiar (wpisz własne cm)..."
                onSelectCustom={() => setIsCustomWidth(true)}
              />
            ) : (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    min={200}
                    max={1206}
                    value={widthCm || ""}
                    onChange={(e) => setWidthCm(parseInt(e.target.value, 10) || 0)}
                    placeholder="Wpisz szerokość w cm..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-brand bg-white text-sm font-semibold text-[var(--text-strong)] focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-[var(--text-mute)] font-medium">cm</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomWidth(false);
                    setWidthCm(506);
                  }}
                  className="px-3 py-2.5 rounded-xl border border-[var(--line-2)] bg-[var(--panel-2)] hover:bg-slate-200 text-xs font-semibold text-[var(--text-dim)] shrink-0 cursor-pointer"
                >
                  Lista ▾
                </button>
              </div>
            )}
            {/* Quick preset chips */}
            <div className="flex items-center gap-1.5 pt-1 flex-wrap">
              {[306, 406, 506, 606, 706].map((wPreset) => (
                <button
                  key={wPreset}
                  type="button"
                  onClick={() => {
                    setIsCustomWidth(false);
                    setWidthCm(wPreset);
                  }}
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-lg border transition-colors cursor-pointer ${
                    widthCm === wPreset && !isCustomWidth
                      ? "bg-brand text-white border-brand shadow-2xs"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {wPreset} cm
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dynamic Admin/Manager Controls: Narzut & Własna Stawka Montażu */}
        <div className="pt-3 border-t border-[var(--line-2)]/60 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-strong)] flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-brand" />
              <span>Narzut na materiał (%)</span>
            </label>
            <input
              type="number"
              min={0}
              max={200}
              disabled={!isAdminOrManager}
              value={materialMarkupPercent}
              onChange={(e) => setUserMarkupPercent(parseFloat(e.target.value) || 0)}
              className={`w-full px-3 py-2 rounded-xl border border-[var(--line-2)] text-xs font-bold ${
                isAdminOrManager
                  ? "bg-[var(--panel-2)] text-[var(--text-strong)] focus:border-brand"
                  : "bg-slate-100 text-slate-500 cursor-not-allowed"
              }`}
            />
            {!isAdminOrManager && (
              <span className="text-[10px] text-[var(--text-mute)] block">Domyślnie 52% (zmiana: Admin/Kierownik)</span>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-strong)] flex items-center gap-1.5">
              <Hammer className="w-3.5 h-3.5 text-brand" />
              <span>Własna stawka montażu (zł/m²)</span>
            </label>
            <input
              type="number"
              min={0}
              placeholder={`Sugerowana: ${calcResult.input.suggestedAssemblyRateNetPerSqM} zł`}
              disabled={!isAdminOrManager}
              value={customAssemblyRate}
              onChange={(e) => setCustomAssemblyRate(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl border border-[var(--line-2)] text-xs font-bold ${
                isAdminOrManager
                  ? "bg-[var(--panel-2)] text-[var(--text-strong)] focus:border-brand"
                  : "bg-slate-100 text-slate-500 cursor-not-allowed"
              }`}
            />
            {!isAdminOrManager && (
              <span className="text-[10px] text-[var(--text-mute)] block">Sugerowana z tabeli: {calcResult.input.suggestedAssemblyRateNetPerSqM} zł/m²</span>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-strong)] flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-brand" />
              <span>Stawka VAT dla klienta</span>
            </label>
            <div className="px-3 py-2 rounded-xl border border-[var(--line-2)] bg-[var(--panel-2)] text-xs font-bold text-[var(--text-strong)] flex items-center justify-between">
              <span>{effectiveVatPercent}% VAT</span>
              <span className="text-[10px] font-normal text-[var(--text-mute)]">
                {clientType === "business" ? "Firma (23%)" : "Prywatny (8%)"}
              </span>
            </div>
          </div>
        </div>

        {/* Ostrzeżenie o wymiarach poza zakresem */}
        {calcResult.warning && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{calcResult.warning}</span>
          </div>
        )}
      </div>

      {/* ─── Podsumowanie finansowe zadaszenia ──────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Razem Zadaszenie Tarasu (Netto)
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight mt-1 flex items-baseline gap-1.5">
            <span>{Math.round(calcResult.options.polycarbonate.totalNet).toLocaleString("pl-PL")}</span>
            <span className="text-sm font-semibold text-slate-500">zł netto</span>
          </div>
          <div className="text-xs text-slate-500 font-medium mt-1">
            Brutto (VAT {effectiveVatPercent}%): <strong className="text-slate-800">{Math.round(calcResult.options.polycarbonate.totalGross).toLocaleString("pl-PL")} zł</strong>
          </div>
        </div>
        <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-200 text-right gap-2">
          <div className="bg-white px-3.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
            <span className="text-xs text-slate-500 font-medium">Wymiar: </span>
            <strong className="text-sm font-semibold text-slate-800">
              {calcResult.input.widthCm} × {calcResult.input.depthCm} cm ({calcResult.input.areaSqM.toFixed(2)} m²)
            </strong>
          </div>
          <div className="bg-white px-3.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
            <span className="text-xs text-slate-500 font-medium">Materiały z narzutem: </span>
            <strong className="text-sm font-semibold text-slate-800">
              {Math.round(calcResult.options.polycarbonate.materialCostNet).toLocaleString("pl-PL")} zł
            </strong>
          </div>
          <div className="bg-white px-3.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
            <span className="text-xs text-slate-500 font-medium">Montaż: </span>
            <strong className="text-sm font-semibold text-slate-800">
              {Math.round(calcResult.options.polycarbonate.assemblyCostNet).toLocaleString("pl-PL")} zł
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
}
