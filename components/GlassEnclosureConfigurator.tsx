"use client";

import { useState, useEffect } from "react";
import {
  calculateGlassEnclosure,
  type WallType,
  type AccessoryType,
  type WallInput,
  type AccessoryInput,
  type EnclosureInput,
  type EnclosureResult,
} from "@/lib/glassEnclosureCalculatorEngine";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Box,
  Layers,
  Sparkles,
} from "lucide-react";

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
        quantity: 1,
        isExpanded: true,
      },
    ]
  );

  const [accessories, setAccessories] = useState<AccessoryInput[]>(
    initialInput?.accessories || []
  );

  const marginPercent = 52;
  const glassPricePerSqm = 225;
  const installFrontCost = 250;
  const installFrontClient = 300;
  const installSideCost = 500;
  const installSideClient = 650;
  const installTriangleCostPerMb = 200;
  const installTriangleClientPerMb = 250;
  const installFoundationCostPerMb = 50;
  const installFoundationClientPerMb = 100;

  const enclosureInput: EnclosureInput = {
    walls,
    accessories,
    marginPercent,
    glassPricePerSqm,
    installFrontCost,
    installFrontClient,
    installSideCost,
    installSideClient,
    installTriangleCostPerMb,
    installTriangleClientPerMb,
    installFoundationCostPerMb,
    installFoundationClientPerMb,
  };

  const result = calculateGlassEnclosure(enclosureInput);

  const isValid =
    (walls.length > 0 || accessories.length > 0) &&
    walls.every((w) => w.widthCm > 0 && w.heightCm > 0) &&
    result.walls.every((w) => !w.error);

  useEffect(() => {
    const lines = ["**ZABUDOWA SZKLANA TARASU**\n"];

    if (result.walls.length > 0) {
      lines.push("Ścianki szklane:");
      result.walls.forEach((item, idx) => {
        const typeLabel = item.type === "FRONT" ? "Ścianka frontowa" : "Ścianka boczna";
        const qtyLabel = item.quantity > 1 ? ` (x${item.quantity} szt.)` : "";
        lines.push(
          `${idx + 1}. ${typeLabel}: szer. ${item.widthCm} cm × wys. ${item.heightCm} cm${qtyLabel} [szkło: ${item.areaSqm.toFixed(2)} m²]`
        );
      });
      lines.push("");
    }

    if (result.accessories.length > 0) {
      lines.push("Dodatki i elementy uzupełniające:");
      result.accessories.forEach((acc, idx) => {
        const qtyLabel = acc.quantity > 1 ? ` (x${acc.quantity} szt.)` : "";
        const dimLabel = acc.widthCm ? ` [szer. ${acc.widthCm} cm]` : "";
        lines.push(`${idx + 1}. ${acc.name}${dimLabel}${qtyLabel}`);
      });
      lines.push("");
    }

    lines.push(
      `Łączna wartość materiału: ${(result.materialsClientNet * 1.08).toLocaleString("pl-PL", { maximumFractionDigits: 0 })} zł brutto (VAT 8%)`
    );
    lines.push(
      `Montaż: ${(result.installationClientNet * 1.08).toLocaleString("pl-PL", { maximumFractionDigits: 0 })} zł brutto`
    );

    onChange({
      serviceName: "Zabudowa tarasu",
      calculatorType: "GLASS_ENCLOSURE",
      input: enclosureInput,
      result: {
        totalNetPrice: result.totalClientNet,
        installationNet: result.installationClientNet,
        areaSqM: result.walls.reduce((sum, item) => sum + item.areaSqm * item.quantity, 0),
        walls: result.walls,
        accessories: result.accessories,
        materialsCostNet: result.materialsCostNet,
        materialsClientNet: result.materialsClientNet,
        installationCostNet: result.installationCostNet,
        totalCostNet: result.totalCostNet,
      },
      offerText: lines.join("\n"),
      isValid,
    });
  }, [walls, accessories, isValid]);

  // Wall Actions
  function addWall(type: WallType) {
    setWalls((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type,
        widthCm: type === "FRONT" ? 386 : 290,
        heightCm: 250,
        quantity: 1,
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

  // Accessory Actions
  function addAccessory(type: AccessoryType) {
    let defaultWidth: number | undefined = undefined;
    let defaultPrice: number | undefined = undefined;
    let customDescription: string | undefined = undefined;

    if (type === "ADDON_TRIANGLE" || type === "ADDON_FOUNDATION") {
      defaultWidth = 290;
    } else if (type === "LAMELLA_FRONT" || type === "LAMELLA_SIDE") {
      defaultPrice = 850;
      defaultWidth = 300;
    } else if (type === "ADDON_PROFILE") {
      defaultPrice = 500;
      customDescription = "Profil aluminiowy";
    }

    setAccessories((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type,
        quantity: 1,
        widthCm: defaultWidth,
        heightCm: 250,
        priceNetCost: defaultPrice,
        customDescription,
        isExpanded: true,
      },
    ]);
  }

  function updateAccessory(id: string, updates: Partial<AccessoryInput>) {
    setAccessories((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
  }

  function removeAccessory(id: string) {
    setAccessories((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="space-y-6">
      {/* ─── SEKCJA 1: ŚCIANKI SZKLANE ────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-[var(--line-2)] pb-2.5">
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4 text-brand" />
            <h3 className="font-bold text-sm text-[var(--text-strong)]">
              Ścianki szklane ({walls.length})
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => addWall("FRONT")}
              className="px-2.5 py-1.5 rounded-lg border border-brand/30 bg-brand/5 hover:bg-brand/10 text-brand text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Dodaj front
            </button>
            <button
              type="button"
              onClick={() => addWall("SIDE")}
              className="px-2.5 py-1.5 rounded-lg border border-brand/30 bg-brand/5 hover:bg-brand/10 text-brand text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Dodaj bok
            </button>
          </div>
        </div>

        {walls.length === 0 ? (
          <div className="text-xs text-slate-500 italic p-4 border border-dashed border-slate-200 rounded-xl text-center">
            Brak dodanych ścianek. Kliknij przycisk powyżej, aby dodać ściankę.
          </div>
        ) : (
          <div className="space-y-2.5">
            {walls.map((wall, index) => {
              const itemResult = result.walls.find((w) => w.id === wall.id);
              return (
                <div
                  key={wall.id}
                  className="border border-slate-200 rounded-xl bg-white shadow-2xs overflow-hidden transition-all"
                >
                  <div
                    className="flex items-center justify-between p-3 bg-slate-50/80 hover:bg-slate-50 border-b border-slate-200/60 cursor-pointer"
                    onClick={() => updateWall(wall.id, { isExpanded: !wall.isExpanded })}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-white border border-slate-200 flex items-center justify-center text-[11px] font-bold text-slate-500 shadow-2xs">
                        {index + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-800 uppercase">
                        {wall.type === "FRONT" ? "Ścianka frontowa" : "Ścianka boczna"}
                      </span>
                      {wall.quantity > 1 && (
                        <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                          x{wall.quantity}
                        </span>
                      )}
                      {!wall.isExpanded && itemResult && !itemResult.error && (
                        <span className="text-xs text-brand font-bold bg-brand/10 px-2 py-0.5 rounded-full ml-1">
                          {Math.round(itemResult.totalClientNet).toLocaleString("pl-PL")} zł netto
                        </span>
                      )}
                      {itemResult?.error && (
                        <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">
                          Błąd wymiaru
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeWall(wall.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Usuń ściankę"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="p-1 text-slate-400">
                        {wall.isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {wall.isExpanded && (
                    <div className="p-3.5 space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Szerokość (cm)
                          </label>
                          <input
                            type="number"
                            value={wall.widthCm || ""}
                            onChange={(e) => updateWall(wall.id, { widthCm: parseInt(e.target.value) || 0 })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                            placeholder="np. 386"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Wysokość (cm)
                          </label>
                          <input
                            type="number"
                            value={wall.heightCm || ""}
                            onChange={(e) => updateWall(wall.id, { heightCm: parseInt(e.target.value) || 0 })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                            placeholder="np. 250"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Ilość sztuk
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={wall.quantity || 1}
                            onChange={(e) => updateWall(wall.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                          />
                        </div>
                      </div>

                      {itemResult && (
                        <div className="pt-2 border-t border-dashed border-slate-200">
                          {itemResult.error ? (
                            <div className="text-xs text-red-600 font-medium bg-red-50 p-2 rounded-lg border border-red-100">
                              {itemResult.error}
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
                              <div className="flex items-center gap-3">
                                <span>
                                  Szkło: <strong>{itemResult.areaSqm.toFixed(2)} m²</strong>
                                </span>
                                <span>
                                  Profil std: <strong>{itemResult.standardWidthCm} cm</strong>
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span>
                                  Materiały: <strong>{Math.round(itemResult.unitClientNet * itemResult.quantity).toLocaleString("pl-PL")} zł</strong>
                                </span>
                                <span>
                                  Montaż: <strong>{Math.round(itemResult.unitInstallClientNet * itemResult.quantity).toLocaleString("pl-PL")} zł</strong>
                                </span>
                                <span className="text-slate-900 font-bold bg-slate-100 px-2 py-0.5 rounded">
                                  Razem: {Math.round(itemResult.totalClientNet).toLocaleString("pl-PL")} zł netto
                                </span>
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
        )}
      </div>

      {/* ─── SEKCJA 2: NIEZALEŻNE ELEMENTY I DODATKI ─────────────────────────────── */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between border-b border-[var(--line-2)] pb-2.5">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-sm text-[var(--text-strong)]">
              Lamele i dodatki ({accessories.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">Niezależne od ścianek</span>
        </div>

        {/* Przyciski szybkiego dodawania dodatków */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => addAccessory("LAMELLA_FRONT")}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-left text-xs font-semibold text-slate-800 flex items-center justify-between transition-colors shadow-2xs cursor-pointer"
          >
            <span>+ Lamela frontowa</span>
            <span className="text-[10px] text-slate-400 font-normal">850 zł</span>
          </button>
          <button
            type="button"
            onClick={() => addAccessory("LAMELLA_SIDE")}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-left text-xs font-semibold text-slate-800 flex items-center justify-between transition-colors shadow-2xs cursor-pointer"
          >
            <span>+ Lamela boczna kpl</span>
            <span className="text-[10px] text-slate-400 font-normal">850 zł</span>
          </button>
          <button
            type="button"
            onClick={() => addAccessory("ADDON_TRIANGLE")}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-left text-xs font-semibold text-slate-800 flex items-center justify-between transition-colors shadow-2xs cursor-pointer"
          >
            <span>+ Dodatek - trójkąt</span>
            <span className="text-[10px] text-slate-400 font-normal">wg cennika</span>
          </button>
          <button
            type="button"
            onClick={() => addAccessory("ADDON_FOUNDATION")}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-left text-xs font-semibold text-slate-800 flex items-center justify-between transition-colors shadow-2xs cursor-pointer"
          >
            <span>+ Dodatek - fundament</span>
            <span className="text-[10px] text-slate-400 font-normal">wg cennika</span>
          </button>
          <button
            type="button"
            onClick={() => addAccessory("ADDON_PROFILE")}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-left text-xs font-semibold text-slate-800 flex items-center justify-between transition-colors shadow-2xs cursor-pointer"
          >
            <span>+ Dodatek - profil</span>
            <span className="text-[10px] text-slate-400 font-normal">500 zł</span>
          </button>
          <button
            type="button"
            onClick={() => addAccessory("ADDON_OTHER")}
            className="p-2 rounded-xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 hover:border-indigo-300 text-left text-xs font-semibold text-indigo-900 flex items-center justify-between transition-colors shadow-2xs cursor-pointer"
          >
            <span>+ Dodatek - inne</span>
            <span className="text-[10px] text-indigo-600 font-normal">własna kwota</span>
          </button>
        </div>

        {/* Lista dodanych akcesoriów */}
        {accessories.length > 0 && (
          <div className="space-y-2 mt-3">
            {accessories.map((acc, index) => {
              const accResult = result.accessories.find((a) => a.id === acc.id);
              return (
                <div
                  key={acc.id}
                  className="border border-slate-200 rounded-xl bg-white shadow-2xs overflow-hidden transition-all"
                >
                  <div
                    className="flex items-center justify-between p-3 bg-slate-50/60 hover:bg-slate-50 border-b border-slate-200/60 cursor-pointer"
                    onClick={() => updateAccessory(acc.id, { isExpanded: !acc.isExpanded })}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-white border border-slate-200 flex items-center justify-center text-[11px] font-bold text-slate-500 shadow-2xs">
                        {index + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        {accResult?.name || "Dodatek"}
                      </span>
                      {acc.quantity > 1 && (
                        <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                          x{acc.quantity}
                        </span>
                      )}
                      {!acc.isExpanded && accResult && (
                        <span className="text-xs text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full ml-1">
                          {Math.round(accResult.totalClientNet).toLocaleString("pl-PL")} zł netto
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeAccessory(acc.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Usuń pozycję"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="p-1 text-slate-400">
                        {acc.isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {acc.isExpanded && (
                    <div className="p-3.5 space-y-3">
                      {(acc.type === "ADDON_TRIANGLE" || acc.type === "ADDON_FOUNDATION") && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Szerokość elementu (cm)
                            </label>
                            <input
                              type="number"
                              value={acc.widthCm || ""}
                              onChange={(e) =>
                                updateAccessory(acc.id, { widthCm: parseInt(e.target.value) || 0 })
                              }
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                              placeholder="np. 290"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Ilość (szt.)
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={acc.quantity || 1}
                              onChange={(e) =>
                                updateAccessory(acc.id, {
                                  quantity: Math.max(1, parseInt(e.target.value) || 1),
                                })
                              }
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                            />
                          </div>
                        </div>
                      )}

                      {(acc.type === "LAMELLA_FRONT" || acc.type === "LAMELLA_SIDE") && (
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Szerokość (cm)
                            </label>
                            <input
                              type="number"
                              value={acc.widthCm || ""}
                              onChange={(e) =>
                                updateAccessory(acc.id, { widthCm: parseInt(e.target.value) || 0 })
                              }
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                              placeholder="np. 300"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Koszt zakupu netto (zł)
                            </label>
                            <input
                              type="number"
                              value={acc.priceNetCost !== undefined ? acc.priceNetCost : 850}
                              onChange={(e) =>
                                updateAccessory(acc.id, {
                                  priceNetCost: parseInt(e.target.value) || 0,
                                })
                              }
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Ilość (szt.)
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={acc.quantity || 1}
                              onChange={(e) =>
                                updateAccessory(acc.id, {
                                  quantity: Math.max(1, parseInt(e.target.value) || 1),
                                })
                              }
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                            />
                          </div>
                        </div>
                      )}

                      {(acc.type === "ADDON_PROFILE" || acc.type === "ADDON_OTHER") && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Opis elementu
                            </label>
                            <input
                              type="text"
                              value={acc.customDescription || ""}
                              onChange={(e) =>
                                updateAccessory(acc.id, { customDescription: e.target.value })
                              }
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                              placeholder={acc.type === "ADDON_PROFILE" ? "Profil" : "Wpisz nazwę dodatku..."}
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                Koszt zakupu netto (zł)
                              </label>
                              <input
                                type="number"
                                value={acc.priceNetCost || 0}
                                onChange={(e) =>
                                  updateAccessory(acc.id, {
                                    priceNetCost: parseInt(e.target.value) || 0,
                                  })
                                }
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                Montaż netto (zł)
                              </label>
                              <input
                                type="number"
                                value={acc.installNetCost || 0}
                                onChange={(e) =>
                                  updateAccessory(acc.id, {
                                    installNetCost: parseInt(e.target.value) || 0,
                                    installNetClient: parseInt(e.target.value) || 0,
                                  })
                                }
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                Ilość (szt.)
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={acc.quantity || 1}
                                onChange={(e) =>
                                  updateAccessory(acc.id, {
                                    quantity: Math.max(1, parseInt(e.target.value) || 1),
                                  })
                                }
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {accResult && (
                        <div className="pt-2 border-t border-dashed border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
                          <div>
                            Cena jedn. z narzutem: <strong>{Math.round(accResult.unitClientNet).toLocaleString("pl-PL")} zł</strong>
                            {accResult.unitInstallClientNet > 0 && ` + montaż: ${Math.round(accResult.unitInstallClientNet).toLocaleString("pl-PL")} zł`}
                          </div>
                          <div className="text-slate-900 font-bold bg-slate-100 px-2 py-0.5 rounded">
                            Razem: {Math.round(accResult.totalClientNet).toLocaleString("pl-PL")} zł netto
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── PODSUMOWANIE FINANSOWE KONFIGURATORA ─────────────────────────────────── */}
      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Razem Zabudowa Netto
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            {Math.round(result.totalClientNet).toLocaleString("pl-PL")}{" "}
            <span className="text-base font-bold text-slate-500">zł</span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Brutto (VAT 8%): {Math.round(result.totalClientNet * 1.08).toLocaleString("pl-PL")} zł
          </div>
        </div>
        <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200 text-right">
          <div>
            <span className="text-[11px] text-slate-500 font-medium">W tym materiały: </span>
            <span className="text-xs font-bold text-slate-800">
              {Math.round(result.materialsClientNet).toLocaleString("pl-PL")} zł
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 font-medium">W tym montaż: </span>
            <span className="text-xs font-bold text-brand">
              {Math.round(result.installationClientNet).toLocaleString("pl-PL")} zł
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
