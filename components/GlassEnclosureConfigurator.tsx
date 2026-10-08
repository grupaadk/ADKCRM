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
  Link2,
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
        const dimLabel = acc.effectiveWidthCm ? ` [szer. ${acc.effectiveWidthCm} cm]` : "";
        const linkLabel = acc.linkedWallLabel ? ` [powiązane: ${acc.linkedWallLabel}]` : "";
        lines.push(`${idx + 1}. ${acc.name}${dimLabel}${linkLabel}${qtyLabel}`);
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
    // Usuń ściankę i odepnij ewentualne powiązane dodatki
    setWalls((prev) => prev.filter((w) => w.id !== id));
    setAccessories((prev) =>
      prev.map((acc) => (acc.linkedWallId === id ? { ...acc, linkedWallId: undefined } : acc))
    );
  }

  // Accessory Actions
  function addAccessory(type: AccessoryType, preferredLinkedWallId?: string) {
    let defaultWidth: number | undefined = undefined;
    let defaultPrice: number | undefined = undefined;
    let customDescription: string | undefined = undefined;

    // Automatycznie powiąż z odpowiednią ścianką jeśli istnieje
    let linkedWallId = preferredLinkedWallId;
    if (!linkedWallId) {
      if (type === "ADDON_TRIANGLE" || type === "LAMELLA_SIDE") {
        const sideWall = walls.find((w) => w.type === "SIDE");
        if (sideWall) linkedWallId = sideWall.id;
      } else if (type === "LAMELLA_FRONT") {
        const frontWall = walls.find((w) => w.type === "FRONT");
        if (frontWall) linkedWallId = frontWall.id;
      } else if (type === "ADDON_FOUNDATION") {
        const anyWall = walls[0];
        if (anyWall) linkedWallId = anyWall.id;
      }
    }

    if (!linkedWallId) {
      if (type === "ADDON_TRIANGLE" || type === "ADDON_FOUNDATION") defaultWidth = 290;
      else if (type === "LAMELLA_FRONT" || type === "LAMELLA_SIDE") defaultWidth = 300;
    }

    if (type === "LAMELLA_FRONT" || type === "LAMELLA_SIDE") defaultPrice = 850;
    else if (type === "ADDON_PROFILE") {
      defaultPrice = 500;
      customDescription = "Profil aluminiowy";
    }

    setAccessories((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type,
        linkedWallId,
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
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center">
              <Box className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <span>Ścianki szklane</span>
                <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2 py-0.5 rounded-md border border-slate-200">
                  {walls.length} {walls.length === 1 ? "pozycja" : walls.length > 4 ? "pozycji" : "pozycje"}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">Główne ściany przesuwne ze szkła hartowanego</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => addWall("FRONT")}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> + Dodaj ściankę frontową
            </button>
            <button
              type="button"
              onClick={() => addWall("SIDE")}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> + Dodaj ściankę boczną
            </button>
          </div>
        </div>

        {walls.length === 0 ? (
          <div className="text-xs text-slate-500 italic p-6 border-2 border-dashed border-slate-200 rounded-2xl text-center bg-slate-50/50">
            Brak dodanych ścianek. Kliknij przycisk powyżej, aby dodać pierwszą ściankę.
          </div>
        ) : (
          <div className="space-y-3.5">
            {walls.map((wall, index) => {
              const itemResult = result.walls.find((w) => w.id === wall.id);
              const linkedAccessories = accessories.filter((a) => a.linkedWallId === wall.id);

              return (
                <div
                  key={wall.id}
                  className="border border-slate-200 rounded-xl bg-white shadow-2xs overflow-hidden transition-all hover:border-slate-300"
                >
                  <div
                    className="flex items-center justify-between p-3.5 bg-slate-50/80 border-b border-slate-200 cursor-pointer"
                    onClick={() => updateWall(wall.id, { isExpanded: !wall.isExpanded })}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                      <span className="w-6 h-6 rounded-md bg-slate-800 text-white flex items-center justify-center text-xs font-semibold shrink-0">
                        {index + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-tight">
                        {wall.type === "FRONT" ? "Ścianka frontowa" : "Ścianka boczna"}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs">
                        {wall.widthCm} × {wall.heightCm} cm
                      </span>
                      {wall.quantity > 1 && (
                        <span className="text-[10px] font-semibold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md">
                          x{wall.quantity} szt.
                        </span>
                      )}
                      {linkedAccessories.length > 0 && (
                        <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Link2 className="w-3 h-3 text-slate-400" />
                          {linkedAccessories.length} powiązane
                        </span>
                      )}
                      {itemResult && !itemResult.error && (
                        <span className="text-xs font-bold text-slate-900 bg-white border border-slate-200 px-2.5 py-0.5 rounded-md ml-auto sm:ml-2 shadow-2xs">
                          {Math.round(itemResult.totalClientNet).toLocaleString("pl-PL")} zł netto
                        </span>
                      )}
                      {itemResult?.error && (
                        <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold border border-red-200">
                          Błąd wymiaru
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeWall(wall.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Usuń pozycję"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="p-1 text-slate-500">
                        {wall.isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {wall.isExpanded && (
                    <div className="p-4 bg-slate-50/40 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            Szerokość (cm)
                          </label>
                          <input
                            type="number"
                            value={wall.widthCm || ""}
                            onChange={(e) => updateWall(wall.id, { widthCm: parseInt(e.target.value) || 0 })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand focus:bg-white"
                            placeholder="np. 386"
                          />
                          <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                            {(wall.type === "FRONT" ? [306, 386, 406, 506] : [290, 300, 350, 400]).map((wPreset) => (
                              <button
                                key={wPreset}
                                type="button"
                                onClick={() => updateWall(wall.id, { widthCm: wPreset })}
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                                  wall.widthCm === wPreset
                                    ? "bg-brand text-white border-brand shadow-2xs"
                                    : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                                }`}
                              >
                                {wPreset} cm
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            Wysokość (cm)
                          </label>
                          <input
                            type="number"
                            value={wall.heightCm || ""}
                            onChange={(e) => updateWall(wall.id, { heightCm: parseInt(e.target.value) || 0 })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand focus:bg-white"
                            placeholder="np. 250"
                          />
                          <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                            {[230, 240, 250, 260].map((hPreset) => (
                              <button
                                key={hPreset}
                                type="button"
                                onClick={() => updateWall(wall.id, { heightCm: hPreset })}
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                                  wall.heightCm === hPreset
                                    ? "bg-brand text-white border-brand shadow-2xs"
                                    : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                                }`}
                              >
                                {hPreset} cm
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            Ilość sztuk
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={wall.quantity || 1}
                            onChange={(e) => updateWall(wall.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand focus:bg-white"
                          />
                          <div className="flex items-center gap-1.5 pt-1">
                            {[1, 2].map((qPreset) => (
                              <button
                                key={qPreset}
                                type="button"
                                onClick={() => updateWall(wall.id, { quantity: qPreset })}
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                                  wall.quantity === qPreset
                                    ? "bg-brand text-white border-brand shadow-2xs"
                                    : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                                }`}
                              >
                                x{qPreset}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Szybkie dodanie dodatku bezpośrednio powiązanego z tą ścianą */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                        <div className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                          <Link2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>Szybkie powiązanie dodatku z tą ścianką (dziedziczy szer. {wall.widthCm} cm):</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {wall.type === "SIDE" ? (
                            <>
                              <button
                                type="button"
                                onClick={() => addAccessory("ADDON_TRIANGLE", wall.id)}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                              >
                                + Trójkąt ({wall.widthCm} cm)
                              </button>
                              <button
                                type="button"
                                onClick={() => addAccessory("ADDON_FOUNDATION", wall.id)}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                              >
                                + Fundament ({wall.widthCm} cm)
                              </button>
                              <button
                                type="button"
                                onClick={() => addAccessory("LAMELLA_SIDE", wall.id)}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                              >
                                + Lamela boczna ({wall.widthCm} cm)
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => addAccessory("LAMELLA_FRONT", wall.id)}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                              >
                                + Lamela frontowa ({wall.widthCm} cm)
                              </button>
                              <button
                                type="button"
                                onClick={() => addAccessory("ADDON_FOUNDATION", wall.id)}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                              >
                                + Fundament ({wall.widthCm} cm)
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {itemResult && (
                        <div className="pt-2">
                          {itemResult.error ? (
                            <div className="text-xs text-rose-700 font-semibold bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                              {itemResult.error}
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs bg-slate-50 border border-slate-200 p-3 rounded-xl">
                              <div className="flex items-center gap-2">
                                <span className="bg-white border border-slate-200 text-slate-700 px-2.5 py-1 rounded-md font-semibold text-[11px]">
                                  Powierzchnia szkła: <strong className="text-slate-900">{itemResult.areaSqm.toFixed(2)} m²</strong>
                                </span>
                                <span className="bg-white border border-slate-200 text-slate-700 px-2.5 py-1 rounded-md font-semibold text-[11px]">
                                  Profil standard: <strong className="text-slate-900">{itemResult.standardWidthCm} cm</strong>
                                </span>
                              </div>
                              <div className="flex items-center gap-2.5">
                                <span className="text-[11px] text-slate-600">
                                  Materiały: <strong className="text-slate-900">{Math.round(itemResult.unitClientNet * itemResult.quantity).toLocaleString("pl-PL")} zł</strong>
                                </span>
                                <span className="text-[11px] text-slate-600">
                                  Montaż: <strong className="text-slate-900">{Math.round(itemResult.unitInstallClientNet * itemResult.quantity).toLocaleString("pl-PL")} zł</strong>
                                </span>
                                <span className="text-slate-900 font-bold bg-white border border-slate-200 px-3 py-1 rounded-lg text-xs shadow-2xs">
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
      <div className="space-y-4 pt-3">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <span>Lamele i dodatki</span>
                <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2 py-0.5 rounded-md border border-slate-200">
                  {accessories.length} {accessories.length === 1 ? "pozycja" : accessories.length > 4 ? "pozycji" : "pozycje"}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">Elementy uzupełniające: lamele, profile, trójkąty, fundamenty</p>
            </div>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Wyposażenie
          </span>
        </div>

        {/* Przyciski szybkiego dodawania dodatków */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
          <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            Dodaj nową pozycję wyposażenia:
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => addAccessory("LAMELLA_FRONT")}
              className="p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-left text-xs font-semibold text-slate-700 flex items-center justify-between transition-colors shadow-2xs cursor-pointer"
            >
              <span>+ Lamela frontowa</span>
              <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-md">850 zł</span>
            </button>
            <button
              type="button"
              onClick={() => addAccessory("LAMELLA_SIDE")}
              className="p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-left text-xs font-semibold text-slate-700 flex items-center justify-between transition-colors shadow-2xs cursor-pointer"
            >
              <span>+ Lamela boczna kpl</span>
              <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-md">850 zł</span>
            </button>
            <button
              type="button"
              onClick={() => addAccessory("ADDON_TRIANGLE")}
              className="p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-left text-xs font-semibold text-slate-700 flex items-center justify-between transition-colors shadow-2xs cursor-pointer"
            >
              <span>+ Dodatek - trójkąt</span>
              <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-md">wg szer.</span>
            </button>
            <button
              type="button"
              onClick={() => addAccessory("ADDON_FOUNDATION")}
              className="p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-left text-xs font-semibold text-slate-700 flex items-center justify-between transition-colors shadow-2xs cursor-pointer"
            >
              <span>+ Dodatek - fundament</span>
              <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-md">wg szer.</span>
            </button>
            <button
              type="button"
              onClick={() => addAccessory("ADDON_PROFILE")}
              className="p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-left text-xs font-semibold text-slate-700 flex items-center justify-between transition-colors shadow-2xs cursor-pointer"
            >
              <span>+ Dodatek - profil</span>
              <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-md">500 zł</span>
            </button>
            <button
              type="button"
              onClick={() => addAccessory("ADDON_OTHER")}
              className="p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-left text-xs font-semibold text-slate-700 flex items-center justify-between transition-colors shadow-2xs cursor-pointer"
            >
              <span>+ Dodatek - inne</span>
              <span className="text-[10px] text-slate-700 font-semibold bg-slate-100 px-2 py-0.5 rounded-md">własna kwota</span>
            </button>
          </div>
        </div>

        {/* Lista dodanych akcesoriów */}
        {accessories.length > 0 && (
          <div className="space-y-3.5">
            {accessories.map((acc, index) => {
              const accResult = result.accessories.find((a) => a.id === acc.id);
              const isLinked = !!acc.linkedWallId;

              return (
                <div
                  key={acc.id}
                  className="border border-slate-200 rounded-xl bg-white shadow-2xs overflow-hidden transition-all hover:border-slate-300"
                >
                  <div
                    className="flex items-center justify-between p-3.5 bg-slate-50/80 border-b border-slate-200 cursor-pointer"
                    onClick={() => updateAccessory(acc.id, { isExpanded: !acc.isExpanded })}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                      <span className="w-6 h-6 rounded-md bg-slate-800 text-white flex items-center justify-center text-xs font-semibold shrink-0">
                        {index + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        {accResult?.name || "Dodatek"}
                      </span>
                      {accResult?.linkedWallLabel && (
                        <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Link2 className="w-3 h-3 text-slate-400" />
                          {accResult.linkedWallLabel}
                        </span>
                      )}
                      {accResult?.effectiveWidthCm && (
                        <span className="text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs">
                          szer. {accResult.effectiveWidthCm} cm
                        </span>
                      )}
                      {acc.quantity > 1 && (
                        <span className="text-[10px] font-semibold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md">
                          x{acc.quantity} szt.
                        </span>
                      )}
                      {accResult && (
                        <span className="text-xs font-bold text-slate-900 bg-white border border-slate-200 px-2.5 py-0.5 rounded-md ml-auto sm:ml-2 shadow-2xs">
                          {Math.round(accResult.totalClientNet).toLocaleString("pl-PL")} zł netto
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeAccessory(acc.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Usuń pozycję"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="p-1 text-slate-500">
                        {acc.isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {acc.isExpanded && (
                    <div className="p-4 bg-slate-50/40 space-y-4">
                      {/* Opcja powiązania ze ścianą */}
                      {walls.length > 0 && (
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                            <Link2 className="w-4 h-4 text-slate-400" />
                            Powiązanie ze ścianką (dziedziczy szerokość):
                          </label>
                          <select
                            value={acc.linkedWallId || ""}
                            onChange={(e) =>
                              updateAccessory(acc.id, {
                                linkedWallId: e.target.value || undefined,
                              })
                            }
                            className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand cursor-pointer"
                          >
                            <option value="">Brak powiązania (własna szerokość)</option>
                            {walls.map((w, wIdx) => (
                              <option key={w.id} value={w.id}>
                                #{wIdx + 1} {w.type === "FRONT" ? "Ścianka frontowa" : "Ścianka boczna"} (szer. {w.widthCm} cm)
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {(acc.type === "ADDON_TRIANGLE" || acc.type === "ADDON_FOUNDATION") && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                              Szerokość elementu (cm)
                              {isLinked && <span className="text-slate-500 lowercase ml-1">(ze ściany)</span>}
                            </label>
                            <input
                              type="number"
                              disabled={isLinked}
                              value={accResult?.effectiveWidthCm || acc.widthCm || ""}
                              onChange={(e) =>
                                updateAccessory(acc.id, { widthCm: parseInt(e.target.value) || 0 })
                              }
                              className={`w-full border rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none ${
                                isLinked
                                  ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
                                  : "bg-slate-50 border-slate-200 focus:border-brand focus:ring-1 focus:ring-brand focus:bg-white"
                              }`}
                              placeholder="np. 290"
                            />
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
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
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand focus:bg-white"
                            />
                          </div>
                        </div>
                      )}

                      {(acc.type === "LAMELLA_FRONT" || acc.type === "LAMELLA_SIDE") && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                              Szerokość (cm)
                              {isLinked && <span className="text-slate-500 lowercase ml-1">(ze ściany)</span>}
                            </label>
                            <input
                              type="number"
                              disabled={isLinked}
                              value={accResult?.effectiveWidthCm || acc.widthCm || ""}
                              onChange={(e) =>
                                updateAccessory(acc.id, { widthCm: parseInt(e.target.value) || 0 })
                              }
                              className={`w-full border rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none ${
                                isLinked
                                  ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
                                  : "bg-slate-50 border-slate-200 focus:border-brand focus:ring-1 focus:ring-brand focus:bg-white"
                              }`}
                              placeholder="np. 300"
                            />
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
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
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand focus:bg-white"
                            />
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
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
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand focus:bg-white"
                            />
                          </div>
                        </div>
                      )}

                      {(acc.type === "ADDON_PROFILE" || acc.type === "ADDON_OTHER") && (
                        <div className="space-y-3.5">
                          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                              Opis elementu
                            </label>
                            <input
                              type="text"
                              value={acc.customDescription || ""}
                              onChange={(e) =>
                                updateAccessory(acc.id, { customDescription: e.target.value })
                              }
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand focus:bg-white"
                              placeholder={acc.type === "ADDON_PROFILE" ? "Profil" : "Wpisz nazwę dodatku..."}
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
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
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand focus:bg-white"
                              />
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
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
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand focus:bg-white"
                              />
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
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
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand focus:bg-white"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {accResult && (
                        <div className="pt-2">
                          <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs bg-slate-50 border border-slate-200 p-3 rounded-xl">
                            <div className="text-[11px] text-slate-600">
                              Cena jedn. z narzutem: <strong className="text-slate-900">{Math.round(accResult.unitClientNet).toLocaleString("pl-PL")} zł</strong>
                              {accResult.unitInstallClientNet > 0 && (
                                <> + montaż: <strong className="text-slate-900">{Math.round(accResult.unitInstallClientNet).toLocaleString("pl-PL")} zł</strong></>
                              )}
                            </div>
                            <div className="text-slate-900 font-bold bg-white border border-slate-200 px-3 py-1 rounded-lg text-xs shadow-2xs">
                              Razem pozycja: {Math.round(accResult.totalClientNet).toLocaleString("pl-PL")} zł netto
                            </div>
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
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Razem Zabudowa Szklana (Netto)
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight mt-1 flex items-baseline gap-1.5">
            <span>{Math.round(result.totalClientNet).toLocaleString("pl-PL")}</span>
            <span className="text-sm font-semibold text-slate-500">zł netto</span>
          </div>
          <div className="text-xs text-slate-500 font-medium mt-1">
            Brutto (VAT 8%): <strong className="text-slate-800">{Math.round(result.totalClientNet * 1.08).toLocaleString("pl-PL")} zł</strong>
          </div>
        </div>
        <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-200 text-right gap-2">
          <div className="bg-white px-3.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
            <span className="text-xs text-slate-500 font-medium">Materiały z narzutem: </span>
            <strong className="text-sm font-semibold text-slate-800">
              {Math.round(result.materialsClientNet).toLocaleString("pl-PL")} zł
            </strong>
          </div>
          <div className="bg-white px-3.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
            <span className="text-xs text-slate-500 font-medium">Montaż: </span>
            <strong className="text-sm font-semibold text-slate-800">
              {Math.round(result.installationClientNet).toLocaleString("pl-PL")} zł
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
}
