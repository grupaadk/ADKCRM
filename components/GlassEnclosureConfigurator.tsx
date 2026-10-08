"use client";

import { useState, useEffect } from "react";
import {
  calculateGlassEnclosure,
  type WallType,
  type WallInput,
  type EnclosureInput,
  type EnclosureResult,
} from "@/lib/glassEnclosureCalculatorEngine";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Box,
  AlignEndVertical,
  CheckCircle2,
} from "lucide-react";
import { CustomSelect } from "@/components/ui/CustomSelect";

interface Props {
  initialInput?: EnclosureInput;
  onChange: (data: {
    serviceName: string;
    calculatorType: string;
    input: any;
    result: any;
    offerText: string;
    isValid: boolean;
  }) => void;
}

export function GlassEnclosureConfigurator({ initialInput, onChange }: Props) {
  const [walls, setWalls] = useState<WallInput[]>(
    initialInput?.walls || [
      {
        id: crypto.randomUUID(),
        type: "FRONT",
        widthCm: 386,
        heightCm: 250,
        hasTriangle: false,
        hasFoundation: false,
        isExpanded: true,
      },
    ]
  );

  const marginPercent = 52;
  const glassPricePerSqm = 225;
  const installFrontCost = 250;
  const installFrontClient = 300;
  const installSideCost = 500;
  const installSideClient = 650;

  const enclosureInput: EnclosureInput = {
    walls,
    marginPercent,
    glassPricePerSqm,
    installFrontCost,
    installFrontClient,
    installSideCost,
    installSideClient,
  };

  const result = calculateGlassEnclosure(enclosureInput);

  const isValid = walls.length > 0 && result.items.every((i) => !i.error && i.widthCm > 0);

  useEffect(() => {
    // Generate Offer Text
    const lines = ["**ZABUDOWA SZKLANA TARASU**\n"];
    result.items.forEach((item, idx) => {
      const w = walls.find((w) => w.id === item.id);
      if (!w) return;
      if (item.type === "FRONT") {
        lines.push(`${idx + 1}. Ścianka frontowa: szer. ${item.widthCm} cm x wys. ${item.heightCm} cm`);
      } else if (item.type === "SIDE") {
        let details = [];
        if (w.hasTriangle) details.push("zabudowa trójkąta");
        if (w.hasFoundation) details.push("fundament");
        const extra = details.length > 0 ? ` (${details.join(", ")})` : "";
        lines.push(`${idx + 1}. Ścianka boczna: szer. ${item.widthCm} cm x wys. ${item.heightCm} cm${extra}`);
      } else if (item.type === "LAMELLA") {
        lines.push(`${idx + 1}. Lamele: szer. ${item.widthCm} cm x wys. ${item.heightCm} cm`);
      } else if (item.type === "CUSTOM") {
        lines.push(`${idx + 1}. Element niestandardowy: ${w.customDescription || ""}`);
      }
    });

    lines.push(`\nŁączna wartość materiału: ${(result.materialsClientNet * 1.08).toLocaleString("pl-PL", { maximumFractionDigits: 0 })} zł brutto (VAT 8%)`);
    lines.push(`Montaż: ${(result.installationClientNet * 1.08).toLocaleString("pl-PL", { maximumFractionDigits: 0 })} zł brutto`);

    // Output mapped properly to standard fields expected by NewOpportunityForm
    onChange({
      serviceName: "Zabudowa tarasu",
      calculatorType: "GLASS_ENCLOSURE",
      input: enclosureInput,
      result: {
        totalNetPrice: result.totalClientNet, // Ten wynik używa NewOpportunityForm jako sumę całego kroku
        installationNet: result.installationClientNet, 
        areaSqM: result.items.reduce((sum, item) => sum + item.areaSqm, 0),
        items: result.items,
        materialsCostNet: result.materialsCostNet,
        materialsClientNet: result.materialsClientNet,
        installationCostNet: result.installationCostNet,
        totalCostNet: result.totalCostNet,
      },
      offerText: lines.join("\n"),
      isValid,
    });
  }, [walls, isValid]);

  function addWall(type: WallType) {
    setWalls((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type,
        widthCm: 290,
        heightCm: 250,
        hasTriangle: type === "SIDE",
        hasFoundation: false,
        isExpanded: true,
      },
    ]);
  }

  function updateWall(id: string, updates: Partial<WallInput>) {
    setWalls((prev) => prev.map((w) => (w.id === id ? { ...w, ...updates } : w)));
  }

  function removeWall(id: string) {
    setWalls((prev) => prev.filter((w) => w.id !== id));
  }

  function toggleExpand(id: string) {
    updateWall(id, { isExpanded: !walls.find((w) => w.id === id)?.isExpanded });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-[var(--line-2)] pb-3">
        <h3 className="font-bold text-sm text-[var(--text-strong)] flex items-center gap-2">
          <Box className="w-5 h-5 text-brand" />
          Konfigurator Zabudowy Szklanej
        </h3>
        <span className="text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold">
          Niestandard (Wymiar rzeczywisty)
        </span>
      </div>

      <div className="space-y-3">
        {walls.map((wall, index) => {
          const itemResult = result.items.find((i) => i.id === wall.id);

          return (
            <div key={wall.id} className="border border-[var(--line-2)] rounded-xl bg-white shadow-2xs overflow-hidden transition-all">
              <div
                className="flex items-center justify-between p-3 bg-slate-50 border-b border-[var(--line-2)] cursor-pointer"
                onClick={() => toggleExpand(wall.id)}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-md bg-white border border-[var(--line-2)] flex items-center justify-center text-xs font-bold text-slate-500 shadow-2xs">
                    {index + 1}
                  </div>
                  <span className="text-xs font-bold text-slate-800 uppercase">
                    {wall.type === "FRONT" && "Ścianka Frontowa"}
                    {wall.type === "SIDE" && "Ścianka Boczna"}
                    {wall.type === "LAMELLA" && "Lamele"}
                    {wall.type === "CUSTOM" && "Dodatek Niestandardowy"}
                  </span>
                  {!wall.isExpanded && itemResult && !itemResult.error && (
                    <span className="text-[11px] text-brand font-bold bg-brand/10 px-2 rounded-full">
                      {Math.round(itemResult.totalClientNet).toLocaleString("pl-PL")} zł netto
                    </span>
                  )}
                  {itemResult?.error && (
                    <span className="text-[10px] bg-red-100 text-red-700 px-2 rounded-full font-bold">Błąd wymiaru</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeWall(wall.id);
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="p-1.5 text-slate-400">
                    {wall.isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              {wall.isExpanded && (
                <div className="p-4 space-y-4">
                  {(wall.type === "FRONT" || wall.type === "SIDE" || wall.type === "LAMELLA") && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                          Szerokość rzeczywista (cm)
                        </label>
                        <input
                          type="number"
                          value={wall.widthCm || ""}
                          onChange={(e) => updateWall(wall.id, { widthCm: parseInt(e.target.value) || 0 })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                          Wysokość najwyższa (cm)
                        </label>
                        <input
                          type="number"
                          value={wall.heightCm || ""}
                          onChange={(e) => updateWall(wall.id, { heightCm: parseInt(e.target.value) || 0 })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                        />
                      </div>
                    </div>
                  )}

                  {wall.type === "SIDE" && (
                    <div className="flex gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={wall.hasTriangle}
                          onChange={(e) => updateWall(wall.id, { hasTriangle: e.target.checked })}
                          className="w-4 h-4 text-brand rounded border-slate-300 focus:ring-brand"
                        />
                        <span className="text-xs font-semibold text-slate-700">Zabudowa trójkąta</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={wall.hasFoundation}
                          onChange={(e) => updateWall(wall.id, { hasFoundation: e.target.checked })}
                          className="w-4 h-4 text-brand rounded border-slate-300 focus:ring-brand"
                        />
                        <span className="text-xs font-semibold text-slate-700">Fundament spadkowy</span>
                      </label>
                    </div>
                  )}

                  {wall.type === "CUSTOM" && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                          Opis dodatku
                        </label>
                        <input
                          type="text"
                          value={wall.customDescription || ""}
                          onChange={(e) => updateWall(wall.id, { customDescription: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                            Koszt materiału (netto)
                          </label>
                          <input
                            type="number"
                            value={wall.customPriceNet || ""}
                            onChange={(e) => updateWall(wall.id, { customPriceNet: parseInt(e.target.value) || 0 })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                            Koszt montażu (netto)
                          </label>
                          <input
                            type="number"
                            value={wall.customInstallNet || ""}
                            onChange={(e) => updateWall(wall.id, { customInstallNet: parseInt(e.target.value) || 0 })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Szczegóły wyliczeń ścianki */}
                  {itemResult && (
                    <div className="mt-3 pt-3 border-t border-dashed border-slate-200">
                      {itemResult.error ? (
                        <div className="text-xs text-red-600 font-medium bg-red-50 p-2 rounded-lg border border-red-100">
                          {itemResult.error}
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]">
                          {(wall.type === "FRONT" || wall.type === "SIDE") && (
                            <>
                              <div className="flex items-center gap-1.5 text-slate-600">
                                <span className="font-semibold">Szkło:</span>
                                <span>{itemResult.areaSqm.toFixed(2)} m²</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-slate-600">
                                <span className="font-semibold">Profil std:</span>
                                <span>{itemResult.standardWidthCm} cm</span>
                              </div>
                            </>
                          )}
                          <div className="flex items-center gap-1.5 text-slate-600 ml-auto">
                            <span className="font-semibold text-slate-500">Materiały:</span>
                            <span className="font-bold text-slate-800">{Math.round(itemResult.wallClientNet).toLocaleString("pl-PL")} zł</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <span className="font-semibold text-slate-500">Montaż:</span>
                            <span className="font-bold text-slate-800">{Math.round(itemResult.installClientNet).toLocaleString("pl-PL")} zł</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <button
          type="button"
          onClick={() => addWall("FRONT")}
          className="px-3 py-2 rounded-xl border border-brand/30 bg-brand/5 hover:bg-brand/10 text-brand text-[11px] font-bold flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" /> Ścianka Frontowa
        </button>
        <button
          type="button"
          onClick={() => addWall("SIDE")}
          className="px-3 py-2 rounded-xl border border-brand/30 bg-brand/5 hover:bg-brand/10 text-brand text-[11px] font-bold flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" /> Ścianka Boczna
        </button>
        <button
          type="button"
          onClick={() => addWall("LAMELLA")}
          className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold flex items-center gap-1.5 transition-colors"
        >
          <AlignEndVertical className="w-3.5 h-3.5" /> Lamele
        </button>
        <button
          type="button"
          onClick={() => addWall("CUSTOM")}
          className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold flex items-center gap-1.5 transition-colors ml-auto"
        >
          Dodatek niestandardowy
        </button>
      </div>

      <div className="mt-6 bg-slate-50 rounded-2xl p-4 border border-slate-200 flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Razem Zabudowa Netto</div>
          <div className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            {Math.round(result.totalClientNet).toLocaleString("pl-PL")} <span className="text-base font-bold text-slate-500">zł</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold text-slate-500">W tym montaż</div>
          <div className="text-sm font-bold text-slate-700">{Math.round(result.installationClientNet).toLocaleString("pl-PL")} zł</div>
        </div>
      </div>
    </div>
  );
}
