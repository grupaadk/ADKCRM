"use client";

import React, { useState } from "react";
import type { WallInput, AccessoryInput } from "@/lib/glassEnclosureCalculatorEngine";
import {
  Ruler,
  CheckCircle2,
  PlusCircle,
  Eye,
  Info,
  Palette,
  ArrowLeftRight,
  TrendingDown,
  Edit2,
  X,
  Check,
} from "lucide-react";

export const STANDARD_RAL_COLORS = [
  { code: "RAL 7016", name: "Antracyt struktura", hex: "#374151", textColor: "#ffffff", border: "#1f2937" },
  { code: "RAL 9005", name: "Czarny mat", hex: "#18181b", textColor: "#ffffff", border: "#09090b" },
  { code: "RAL 9016", name: "Biały alpejski", hex: "#f8fafc", textColor: "#0f172a", border: "#cbd5e1" },
  { code: "RAL 9006", name: "Srebrny aluminium", hex: "#94a3b8", textColor: "#0f172a", border: "#64748b" },
  { code: "RAL 8017", name: "Brąz czekoladowy", hex: "#451a03", textColor: "#ffffff", border: "#291002" },
];

interface TerraceWallVisualizerProps {
  wall: WallInput;
  linkedTriangle?: AccessoryInput;
  linkedFoundation?: AccessoryInput;
  linkedLamella?: AccessoryInput;
  onAddAccessory?: (type: "ADDON_TRIANGLE" | "ADDON_FOUNDATION" | "LAMELLA_SIDE" | "LAMELLA_FRONT") => void;
  onRemoveAccessory?: (accessoryId: string) => void;
  onUpdateWall?: (updates: Partial<WallInput>) => void;
  className?: string;
}

export function TerraceWallVisualizer({
  wall,
  linkedTriangle,
  linkedFoundation,
  linkedLamella,
  onAddAccessory,
  onRemoveAccessory,
  onUpdateWall,
  className = "",
}: TerraceWallVisualizerProps) {
  const [activeTab, setActiveTab] = useState<"cad" | "ral">("cad");
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(true);
  const [isEditingDimension, setIsEditingDimension] = useState<"width" | "height" | "slope" | null>(null);
  const [editValue, setEditValue] = useState<number>(0);

  // Strona ścianki bocznej: lewa vs prawa (domyślnie lewa)
  const isRight = wall.sidePlacement === "RIGHT";
  const selectedRal = wall.colorRal || "RAL 7016";
  const currentRalObj = STANDARD_RAL_COLORS.find((c) => c.code === selectedRal) || {
    code: selectedRal,
    name: selectedRal,
    hex: "#374151",
    textColor: "#ffffff",
    border: "#1f2937",
  };

  const slopeCm = wall.slopeCm !== undefined ? wall.slopeCm : 3;

  // Obliczenie liczby skrzydeł (paneli szklanych) na podstawie szerokości
  const getPanelCount = (wCm: number): number => {
    if (wCm <= 200) return 2;
    if (wCm <= 320) return 3;
    if (wCm <= 450) return 4;
    return 5;
  };

  const panelCount = getPanelCount(wall.widthCm || 290);
  const widthVal = wall.widthCm || (wall.type === "FRONT" ? 386 : 290);
  const heightVal = wall.heightCm || 250;

  const hasTriangle = Boolean(linkedTriangle);
  const hasFoundation = Boolean(linkedFoundation);

  // Szacowany spadek / wysokość trójkąta (ok. 16% szerokości)
  const triangleHeightCm = Math.round(widthVal * 0.16);
  const totalHeightCm = heightVal + (hasTriangle ? triangleHeightCm : 0);

  const handleToggleTriangle = () => {
    if (hasTriangle && linkedTriangle && onRemoveAccessory) {
      onRemoveAccessory(linkedTriangle.id);
    } else if (onAddAccessory) {
      onAddAccessory("ADDON_TRIANGLE");
    }
  };

  const handleToggleFoundation = () => {
    if (hasFoundation && linkedFoundation && onRemoveAccessory) {
      onRemoveAccessory(linkedFoundation.id);
    } else if (onAddAccessory) {
      onAddAccessory("ADDON_FOUNDATION");
    }
  };

  const handleToggleSide = () => {
    if (onUpdateWall) {
      onUpdateWall({ sidePlacement: isRight ? "LEFT" : "RIGHT" });
    }
  };

  const handleSelectRal = (ralCode: string) => {
    if (onUpdateWall) {
      onUpdateWall({ colorRal: ralCode });
    }
  };

  const handleStartEdit = (type: "width" | "height" | "slope") => {
    setIsEditingDimension(type);
    if (type === "width") setEditValue(widthVal);
    else if (type === "height") setEditValue(heightVal);
    else if (type === "slope") setEditValue(slopeCm);
  };

  const handleSaveEdit = () => {
    if (onUpdateWall && isEditingDimension) {
      if (isEditingDimension === "width") onUpdateWall({ widthCm: Math.max(50, editValue) });
      else if (isEditingDimension === "height") onUpdateWall({ heightCm: Math.max(100, editValue) });
      else if (isEditingDimension === "slope") onUpdateWall({ slopeCm: Math.max(0, editValue) });
    }
    setIsEditingDimension(null);
  };

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs transition-all ${className}`}
    >
      {/* ─── Belka nagłówkowa wizualizacji ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50/90 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-700 flex items-center justify-center">
            <Ruler className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-tight">
                {wall.type === "SIDE"
                  ? isRight
                    ? "Rzut boczny: Ścianka prawa (dom po prawej)"
                    : "Rzut boczny: Ścianka lewa (dom po lewej)"
                  : "Widok frontowy ścianki tarasu"}
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Wizualizacja wektorowa
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Przekrój: {widthVal} × {heightVal} cm ({panelCount} skrzydła przesuwne) | Spadek: {slopeCm} cm
            </p>
          </div>
        </div>

        {/* Przyciski kontrolne: Strona, Styl RAL/CAD, Detale */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Przełącznik strony ścianki bocznej */}
          {wall.type === "SIDE" && (
            <button
              type="button"
              onClick={handleToggleSide}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
              title="Przełącz stronę montażu (odbicie lustrzane)"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-slate-500" />
              <span>{isRight ? "Ścianka Prawa ➡️" : "⬅️ Ścianka Lewa"}</span>
            </button>
          )}

          {/* Przełącznik trybu CAD vs Kolorystyka RAL */}
          <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab("cad")}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                activeTab === "cad"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              Schemat CAD
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ral")}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "ral"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full border border-white/50"
                style={{ backgroundColor: currentRalObj.hex }}
              />
              <span>{selectedRal}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowTechnicalDetails((v) => !v)}
            title="Pokaż/ukryj wymiary i oznaczenia techniczne"
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              showTechnicalDetails
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-white border-slate-200 text-slate-400 hover:text-slate-700"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ─── Wybór koloru RAL i Spadku podłoża ────────────────────────────────── */}
      <div className="px-4 py-2.5 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Próbnik kolorów RAL */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
            <Palette className="w-3.5 h-3.5 text-slate-400" /> Kolor profili:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {STANDARD_RAL_COLORS.map((ral) => {
              const isSelected = selectedRal === ral.code;
              return (
                <button
                  key={ral.code}
                  type="button"
                  onClick={() => handleSelectRal(ral.code)}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-white border-slate-900 text-slate-900 font-bold shadow-2xs ring-1 ring-slate-900"
                      : "bg-white/80 border-slate-200 text-slate-600 hover:bg-white"
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-slate-300"
                    style={{ backgroundColor: ral.hex }}
                  />
                  <span>{ral.code}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Wartość spadku posadzki */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
            <TrendingDown className="w-3.5 h-3.5 text-slate-400" /> Spadek posadzki:
          </span>
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-0.5 shadow-2xs">
            <input
              type="number"
              min="0"
              max="20"
              value={slopeCm}
              onChange={(e) => onUpdateWall?.({ slopeCm: Math.max(0, parseInt(e.target.value) || 0) })}
              className="w-10 text-right text-xs font-bold text-slate-900 focus:outline-none"
            />
            <span className="text-[11px] font-medium text-slate-500">cm</span>
          </div>
          <div className="flex items-center gap-1">
            {[0, 2, 3, 5].map((sVal) => (
              <button
                key={sVal}
                type="button"
                onClick={() => onUpdateWall?.({ slopeCm: sVal })}
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                  slopeCm === sVal
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {sVal}cm
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Status powiązanych elementów (Interaktywne odznaki) ─────────────── */}
      <div className="px-4 py-2 bg-slate-50/40 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Trójkąt (poliwęglan) badge */}
          {hasTriangle ? (
            <button
              type="button"
              onClick={handleToggleTriangle}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-300 text-emerald-800 text-[11px] font-semibold hover:bg-emerald-100 transition-colors cursor-pointer shadow-2xs"
              title="Kliknij, aby odpiąć trójkąt z wyceny"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Trójkąt z poliwęglanu (w wycenie ✓)
            </button>
          ) : (
            <button
              type="button"
              onClick={handleToggleTriangle}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-amber-300 hover:bg-amber-50 text-amber-800 text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs"
              title="Kliknij, aby dodać trójkąt z poliwęglanu do wyceny"
            >
              <PlusCircle className="w-3.5 h-3.5 text-amber-500" />
              + Dodaj trójkąt (poliwęglan: +{triangleHeightCm} cm)
            </button>
          )}

          {/* Fundament badge */}
          {hasFoundation ? (
            <button
              type="button"
              onClick={handleToggleFoundation}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-300 text-emerald-800 text-[11px] font-semibold hover:bg-emerald-100 transition-colors cursor-pointer shadow-2xs"
              title="Kliknij, aby odpiąć fundament z wyceny"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Podwalina / fundament ({slopeCm} cm spadku ✓)
            </button>
          ) : (
            <button
              type="button"
              onClick={handleToggleFoundation}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-blue-300 hover:bg-blue-50 text-blue-800 text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs"
              title="Kliknij, aby dodać fundament do wyceny"
            >
              <PlusCircle className="w-3.5 h-3.5 text-blue-500" />
              + Dodaj fundament ze spadkiem
            </button>
          )}

          {linkedLamella && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-800 text-[11px] font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
              Lamela boczna
            </span>
          )}
        </div>

        {/* Wskaźnik wysokości z możliwością kliknięcia do edycji */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 font-medium">
            Wys. całkowita z trójkątem: <strong className="text-slate-800">{totalHeightCm} cm</strong>
          </span>
          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
            Wypełnienie: Poliwęglan
          </span>
        </div>
      </div>

      {/* ─── Modal / Pasek szybkiej edycji wymiaru bezpośrednio z rysunku ────── */}
      {isEditingDimension && (
        <div className="bg-amber-50 px-4 py-2 border-b border-amber-200 flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <Edit2 className="w-3.5 h-3.5 text-amber-600" />
            <span className="font-semibold text-amber-900">
              Szybka edycja wymiaru ({isEditingDimension === "width" ? "Szerokość" : isEditingDimension === "height" ? "Wysokość" : "Spadek"}):
            </span>
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(parseInt(e.target.value) || 0)}
              className="w-20 px-2 py-1 bg-white border border-amber-300 rounded font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
              autoFocus
            />
            <span className="font-semibold text-amber-800">cm</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSaveEdit}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold flex items-center gap-1 text-[11px] cursor-pointer shadow-2xs"
            >
              <Check className="w-3 h-3" /> Zapisz
            </button>
            <button
              type="button"
              onClick={() => setIsEditingDimension(null)}
              className="p-1 text-amber-700 hover:bg-amber-100 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ─── Obszar Grafiki Wektorowej SVG ────────────────────────────────────── */}
      <div className="p-3 sm:p-5 bg-white flex items-center justify-center overflow-x-auto relative">
        <div className="w-full max-w-[940px] aspect-[1000/540] min-w-[620px]">
          {wall.type === "SIDE" ? (
            <SideWallSvg
              widthVal={widthVal}
              heightVal={heightVal}
              triangleHeightCm={triangleHeightCm}
              totalHeightCm={totalHeightCm}
              slopeCm={slopeCm}
              panelCount={panelCount}
              hasTriangle={hasTriangle}
              hasFoundation={hasFoundation}
              isRight={isRight}
              ralColor={currentRalObj}
              mode={activeTab}
              showTechnicalDetails={showTechnicalDetails}
              onToggleTriangle={handleToggleTriangle}
              onToggleFoundation={handleToggleFoundation}
              onEditDimension={handleStartEdit}
            />
          ) : (
            <FrontWallSvg
              widthVal={widthVal}
              heightVal={heightVal}
              panelCount={panelCount}
              hasFoundation={hasFoundation}
              ralColor={currentRalObj}
              mode={activeTab}
              showTechnicalDetails={showTechnicalDetails}
              onEditDimension={handleStartEdit}
            />
          )}
        </div>
      </div>

      {/* ─── Legenda / Podpis pod rysunkiem ───────────────────────────────────── */}
      <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-600">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-xs inline-block border"
              style={{
                backgroundColor: activeTab === "cad" ? "#8cc63f" : currentRalObj.hex,
                borderColor: activeTab === "cad" ? "#65a30d" : currentRalObj.border,
              }}
            />
            <span>Profile ({activeTab === "cad" ? "Krokiew i Słup" : selectedRal})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#e0f2fe] border border-[#0284c7] inline-block" />
            <span>Trójkąt: Poliwęglan komorowy</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#bae6fd]/60 border border-[#0284c7] inline-block" />
            <span>Szkło hartowane (przesuwne)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block ring-2 ring-white" />
            <span>Punkty pomiarowe</span>
          </div>
        </div>
        <div className="text-slate-500 italic flex items-center gap-1">
          <Info className="w-3 h-3 text-slate-400" />
          Kliknij trójkąt, fundament lub wymiar na rysunku, aby szybko zmienić konfigurację
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RZUT BOCZNY (SIDE WALL) - Z obsługą strony LEWA / PRAWA oraz POLIWĘGLANU
// ─────────────────────────────────────────────────────────────────────────────
interface SideWallSvgProps {
  widthVal: number;
  heightVal: number;
  triangleHeightCm: number;
  totalHeightCm: number;
  slopeCm: number;
  panelCount: number;
  hasTriangle: boolean;
  hasFoundation: boolean;
  isRight: boolean;
  ralColor: { code: string; name: string; hex: string; textColor: string; border: string };
  mode: "cad" | "ral";
  showTechnicalDetails: boolean;
  onToggleTriangle: () => void;
  onToggleFoundation: () => void;
  onEditDimension: (type: "width" | "height" | "slope") => void;
}

function SideWallSvg({
  widthVal,
  heightVal,
  triangleHeightCm,
  totalHeightCm,
  slopeCm,
  panelCount,
  hasTriangle,
  hasFoundation,
  isRight,
  ralColor,
  mode,
  showTechnicalDetails,
  onToggleTriangle,
  onToggleFoundation,
  onEditDimension,
}: SideWallSvgProps) {
  // Koordynaty geometryczne:
  // Dla isRight === false (LEWA ŚCIANKA): dom po lewej (X=220), słup po prawej (X=680-705)
  // Dla isRight === true (PRAWA ŚCIANKA): dom po prawej (X=780), słup po lewej (X=295-320)

  const wallFaceX = isRight ? 780 : 220;
  const postLeftX = isRight ? 295 : 680;
  const postRightX = isRight ? 320 : 705;

  const widthSpan = Math.abs(postLeftX - wallFaceX);
  const leftEdgeX = Math.min(wallFaceX, postRightX);
  const rightEdgeX = Math.max(wallFaceX, postLeftX);

  // Poziomy wysokości Y:
  const baselineY = 440;
  const slopeDeltaPx = Math.min(20, Math.round(slopeCm * 3.5)); // spadek w pikselach
  const foundationBottomY = 445;
  const foundationTopY = 432;
  const profilHBottomY = 225;
  const profilHTopY = 212;

  // Wysokość krokwi:
  // Przy ścianie budynku krokiew jest wyżej (125-145), przy słupie niżej (200-216)
  const rafterTopWallY = 125;
  const rafterBottomWallY = 145;
  const rafterTopPostY = 200;
  const rafterBottomPostY = 216;

  // Kolory profilu: tryb CAD (zielony/żółty ze szkicu) vs tryb RAL (kolor wybrany)
  const isCad = mode === "cad";
  const greenFill = isCad ? "#8cc63f" : ralColor.hex;
  const greenStroke = isCad ? "#4d7c0f" : ralColor.border;
  const profilHFill = isCad ? "#fef08a" : ralColor.hex;
  const profilHStroke = isCad ? "#ca8a04" : ralColor.border;
  const profilHTextColor = isCad ? "#78350f" : ralColor.textColor;
  const krokiewTextColor = isCad ? "#14532d" : ralColor.textColor;

  // Obliczenie szerokości paneli
  const panelWidth = widthSpan / panelCount;

  return (
    <svg
      viewBox="0 0 1000 540"
      className="w-full h-full select-none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Szkło dla kwater przesuwnych */}
        <linearGradient id="glassGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.75" />
          <stop offset="40%" stopColor="#bae6fd" stopOpacity="0.45" />
          <stop offset="70%" stopColor="#f0f9ff" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#e0f2fe" stopOpacity="0.8" />
        </linearGradient>

        {/* Wzór kanalików komorowych poliwęglanu dla trójkąta */}
        <pattern id="polycarbHatch" width="7" height="7" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="7" stroke="#0284c7" strokeWidth="1" opacity="0.35" />
        </pattern>

        {/* Wzór ściany budynku */}
        <pattern id="wallHatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="8" stroke="#cbd5e1" strokeWidth="1.5" />
        </pattern>

        {/* Wzór podłoża pod fundamentem (///) */}
        <pattern id="groundHatch" width="16" height="16" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="16" stroke="#475569" strokeWidth="2" />
        </pattern>
      </defs>

      {/* ─── 1. ŚCIANA BUDYNKU I OKAP DACHU ───────────────────────────────────── */}
      <g id="building-wall">
        {isRight ? (
          // Dom po PRAWEJ stronie
          <>
            <rect x={wallFaceX} y="80" width="80" height={baselineY - 70} fill="url(#wallHatch)" stroke="#94a3b8" strokeWidth="1" />
            <line x1={wallFaceX} y1="80" x2={wallFaceX} y2={baselineY + 10} stroke="#0f172a" strokeWidth="3.5" />
            {/* Okap dachu po prawej */}
            <path
              d={`M ${wallFaceX} 50 L ${wallFaceX + 40} 50 L ${wallFaceX + 40} 80 L ${wallFaceX - 75} 105 L ${wallFaceX - 75} 130 L ${wallFaceX} 130 Z`}
              fill="#f1f5f9"
              stroke="#0f172a"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <line x1={wallFaceX + 40} y1="90" x2={wallFaceX} y2="50" stroke="#0f172a" strokeWidth="2" />
            <line x1={wallFaceX + 20} y1="105" x2={wallFaceX - 25} y2="60" stroke="#0f172a" strokeWidth="2" />
            <line x1={wallFaceX - 5} y1="115" x2={wallFaceX - 50} y2="70" stroke="#0f172a" strokeWidth="2" />
            <line x1={wallFaceX - 35} y1="125" x2={wallFaceX - 75} y2="85" stroke="#0f172a" strokeWidth="2" />
            <text x={wallFaceX + 15} y="110" fontSize="10" fontWeight="bold" fill="#64748b" letterSpacing="1">
              ŚCIANA
            </text>
          </>
        ) : (
          // Dom po LEWEJ stronie
          <>
            <rect x="140" y="80" width={wallFaceX - 140} height={baselineY - 70} fill="url(#wallHatch)" stroke="#94a3b8" strokeWidth="1" />
            <line x1={wallFaceX} y1="80" x2={wallFaceX} y2={baselineY + 10} stroke="#0f172a" strokeWidth="3.5" />
            {/* Okap dachu po lewej */}
            <path
              d="M 180 50 L 220 50 L 220 80 L 295 105 L 295 130 L 220 130 Z"
              fill="#f1f5f9"
              stroke="#0f172a"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <line x1="180" y1="90" x2="220" y2="50" stroke="#0f172a" strokeWidth="2" />
            <line x1="200" y1="105" x2="245" y2="60" stroke="#0f172a" strokeWidth="2" />
            <line x1="225" y1="115" x2="270" y2="70" stroke="#0f172a" strokeWidth="2" />
            <line x1="255" y1="125" x2="295" y2="85" stroke="#0f172a" strokeWidth="2" />
            <text x="145" y="110" fontSize="10" fontWeight="bold" fill="#64748b" letterSpacing="1">
              ŚCIANA
            </text>
          </>
        )}
      </g>

      {/* ─── 2. KROKIEW ZADASZENIA (SKOŚNA BELKA) ────────────────────────────── */}
      <g id="krokiew">
        {isRight ? (
          // Krokiew opadająca w lewo (do słupa po lewej)
          <polygon
            points={`
              ${postRightX},${rafterTopPostY}
              ${wallFaceX},${rafterTopWallY}
              ${wallFaceX},${rafterBottomWallY}
              ${postRightX},${rafterBottomPostY}
            `}
            fill={greenFill}
            stroke={greenStroke}
            strokeWidth="2"
          />
        ) : (
          // Krokiew opadająca w prawo (do słupa po prawej)
          <polygon
            points={`
              ${wallFaceX},${rafterTopWallY}
              ${postLeftX},${rafterTopPostY}
              ${postLeftX},${rafterBottomPostY}
              ${wallFaceX},${rafterBottomWallY}
            `}
            fill={greenFill}
            stroke={greenStroke}
            strokeWidth="2"
          />
        )}

        {/* Napis "K R O K I E W" wzdłuż krokwi */}
        {(() => {
          const midX = (wallFaceX + (isRight ? postRightX : postLeftX)) / 2;
          const midY = (rafterTopWallY + rafterBottomPostY) / 2;
          const deltaY = isRight ? rafterTopWallY - rafterTopPostY : rafterTopPostY - rafterTopWallY;
          const deltaX = isRight ? wallFaceX - postRightX : postLeftX - wallFaceX;
          const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
          return (
            <text
              x={midX}
              y={midY + 4}
              fontSize="12"
              fontWeight="900"
              fill={krokiewTextColor}
              letterSpacing="6"
              textAnchor="middle"
              transform={`rotate(${angle}, ${midX}, ${midY})`}
            >
              K R O K I E W
            </text>
          );
        })()}
      </g>

      {/* ─── 3. TRÓJKĄT NADPROŻOWY (ZAWSZE POLIWĘGLAN) ────────────────────────── */}
      <g
        id="triangle-wedge"
        className="cursor-pointer group"
        onClick={onToggleTriangle}
      >
        {isRight ? (
          // Trójkąt przy ścianie po prawej stronie
          <polygon
            points={`
              ${postRightX},${profilHTopY}
              ${wallFaceX},${rafterBottomWallY}
              ${wallFaceX},${profilHTopY}
            `}
            fill={hasTriangle ? "#e0f2fe" : "rgba(241, 245, 249, 0.4)"}
            stroke={hasTriangle ? "#0284c7" : "#94a3b8"}
            strokeWidth={hasTriangle ? "2" : "1.5"}
            strokeDasharray={hasTriangle ? "none" : "4 4"}
          />
        ) : (
          // Trójkąt przy ścianie po lewej stronie
          <polygon
            points={`
              ${wallFaceX},${rafterBottomWallY}
              ${postLeftX},${profilHTopY}
              ${wallFaceX},${profilHTopY}
            `}
            fill={hasTriangle ? "#e0f2fe" : "rgba(241, 245, 249, 0.4)"}
            stroke={hasTriangle ? "#0284c7" : "#94a3b8"}
            strokeWidth={hasTriangle ? "2" : "1.5"}
            strokeDasharray={hasTriangle ? "none" : "4 4"}
          />
        )}

        {/* Wypełnienie deseniem kanalików poliwęglanu komorowego */}
        {hasTriangle && (
          <polygon
            points={
              isRight
                ? `${postRightX},${profilHTopY} ${wallFaceX},${rafterBottomWallY} ${wallFaceX},${profilHTopY}`
                : `${wallFaceX},${rafterBottomWallY} ${postLeftX},${profilHTopY} ${wallFaceX},${profilHTopY}`
            }
            fill="url(#polycarbHatch)"
          />
        )}

        {/* Etykieta trójkąta z poliwęglanu */}
        <text
          x={isRight ? wallFaceX - 105 : wallFaceX + 60}
          y={profilHTopY - 18}
          fontSize="10"
          fontWeight="800"
          fill={hasTriangle ? "#0369a1" : "#94a3b8"}
        >
          {hasTriangle ? "TRÓJKĄT (POLIWĘGLAN)" : "+ Kliknij: Poliwęglan"}
        </text>
      </g>

      {/* ─── 4. PROFIL H (POZIOMA BELKA ROZDZIELAJĄCA) ────────────────────────── */}
      <g id="profil-h">
        <rect
          x={isRight ? postRightX : wallFaceX}
          y={profilHTopY}
          width={widthSpan}
          height={profilHBottomY - profilHTopY}
          fill={profilHFill}
          stroke={profilHStroke}
          strokeWidth="1.5"
        />
        <text
          x={(leftEdgeX + rightEdgeX) / 2}
          y={(profilHTopY + profilHBottomY) / 2 + 3.5}
          fontSize="10"
          fontWeight="800"
          fill={profilHTextColor}
          letterSpacing="2"
          textAnchor="middle"
        >
          PROFIL H
        </text>
      </g>

      {/* ─── 5. ŚCIANKA PRZESUWNA (PANELE SZKLANE) ────────────────────────────── */}
      <g id="sliding-panels">
        {Array.from({ length: panelCount }).map((_, i) => {
          const pLeft = (isRight ? postRightX : wallFaceX) + i * panelWidth;
          const pRight = pLeft + panelWidth;
          const pTop = profilHBottomY;
          const pBottom = foundationTopY;

          return (
            <g key={i} className="panel">
              {/* Szkło bezpieczne */}
              <rect
                x={pLeft}
                y={pTop}
                width={panelWidth}
                height={pBottom - pTop}
                fill="url(#glassGrad)"
                stroke="#38bdf8"
                strokeWidth="1"
              />

              {/* Ramy pionowe skrzydeł */}
              <line x1={pLeft} y1={pTop} x2={pLeft} y2={pBottom} stroke="#64748b" strokeWidth="2" />
              <line x1={pRight} y1={pTop} x2={pRight} y2={pBottom} stroke="#64748b" strokeWidth="2" />

              {/* Odblask światła na szybie */}
              <line
                x1={pLeft + 15}
                y1={pBottom - 20}
                x2={pLeft + panelWidth - 25}
                y2={pTop + 30}
                stroke="rgba(255, 255, 255, 0.45)"
                strokeWidth="2"
                strokeLinecap="round"
              />

              {/* Numer kwatery */}
              <text
                x={pLeft + panelWidth / 2}
                y={(pTop + pBottom) / 2}
                fontSize="12"
                fontWeight="700"
                fill="rgba(15, 23, 42, 0.35)"
                textAnchor="middle"
              >
                {i + 1}
              </text>
            </g>
          );
        })}
      </g>

      {/* ─── 6. SŁUP PRZEDNI (ZIELONY LUB RAL) ────────────────────────────────── */}
      <g id="slup">
        <rect
          x={postLeftX}
          y={rafterTopPostY}
          width={postRightX - postLeftX}
          height={baselineY + 12 - rafterTopPostY}
          fill={greenFill}
          stroke={greenStroke}
          strokeWidth="2"
        />
        <text
          x={(postLeftX + postRightX) / 2}
          y={profilHBottomY + 50}
          fontSize="11"
          fontWeight="900"
          fill={krokiewTextColor}
          letterSpacing="4"
          textAnchor="middle"
          style={{ writingMode: "vertical-rl" }}
        >
          S Ł U P
        </text>
        {/* Głowica rynnowa u góry słupa */}
        <rect
          x={postLeftX - 2}
          y={rafterTopPostY - 10}
          width={postRightX - postLeftX + 4}
          height="12"
          fill={isCad ? "#65a30d" : ralColor.border}
          stroke="#365314"
          strokeWidth="1"
        />
      </g>

      {/* ─── 7. FUNDAMENT I SPADEK TARASU (INTERAKTYWNY) ──────────────────────── */}
      <g
        id="fundament-spadek"
        className="cursor-pointer"
        onClick={onToggleFoundation}
      >
        {/* Belka podwalinowa uwzględniająca spadek w cm */}
        {isRight ? (
          // Spadek w lewo (w stronę słupa)
          <polygon
            points={`
              ${postRightX},${foundationTopY + slopeDeltaPx}
              ${wallFaceX},${foundationTopY}
              ${wallFaceX},${foundationBottomY}
              ${postRightX},${foundationBottomY + slopeDeltaPx}
            `}
            fill={hasFoundation ? (isCad ? "#fef08a" : "#fed7aa") : "#f8fafc"}
            stroke={hasFoundation ? (isCad ? "#ca8a04" : "#f97316") : "#94a3b8"}
            strokeWidth="1.5"
          />
        ) : (
          // Spadek w prawo (w stronę słupa)
          <polygon
            points={`
              ${wallFaceX},${foundationTopY}
              ${postLeftX},${foundationTopY + slopeDeltaPx}
              ${postRightX},${foundationBottomY + slopeDeltaPx}
              ${wallFaceX},${foundationBottomY}
            `}
            fill={hasFoundation ? (isCad ? "#fef08a" : "#fed7aa") : "#f8fafc"}
            stroke={hasFoundation ? (isCad ? "#ca8a04" : "#f97316") : "#94a3b8"}
            strokeWidth="1.5"
          />
        )}

        <text
          x={isRight ? postRightX + 25 : postLeftX - 80}
          y={foundationBottomY - 1}
          fontSize="9"
          fontWeight="800"
          fill={hasFoundation ? "#78350f" : "#64748b"}
          letterSpacing="1"
        >
          {hasFoundation ? "FUNDAMENT" : "+ PODWALINA"}
        </text>

        {/* Kreskowanie podłoża ze spadkiem */}
        <polygon
          points={
            isRight
              ? `${postLeftX - 25},${baselineY + slopeDeltaPx} ${wallFaceX + 25},${baselineY} ${wallFaceX + 25},${baselineY + 40} ${postLeftX - 25},${baselineY + 40}`
              : `${wallFaceX - 30},${baselineY} ${postRightX + 25},${baselineY + slopeDeltaPx} ${postRightX + 25},${baselineY + 40} ${wallFaceX - 30},${baselineY + 40}`
          }
          fill="url(#groundHatch)"
          opacity="0.75"
        />
        {/* Linia gruntu */}
        <line
          x1={isRight ? postLeftX - 25 : wallFaceX - 30}
          y1={isRight ? baselineY + slopeDeltaPx : baselineY}
          x2={isRight ? wallFaceX + 25 : postRightX + 25}
          y2={isRight ? baselineY : baselineY + slopeDeltaPx}
          stroke="#0f172a"
          strokeWidth="2.5"
        />

        {/* Znaczniki poziomu: "0" i "0" SPADEK */}
        <text
          x={isRight ? wallFaceX + 10 : 175}
          y={baselineY + 3}
          fontSize="11"
          fontWeight="bold"
          fill="#0f172a"
        >
          &quot;0&quot;
        </text>
        <text
          x={isRight ? postLeftX - 70 : postRightX + 8}
          y={baselineY + slopeDeltaPx + 11}
          fontSize="10"
          fontWeight="bold"
          fill="#0f172a"
        >
          &quot;0&quot; SPADEK {slopeCm} cm
        </text>
      </g>

      {/* ─── 8. CZERWONE PUNKTY POMIAROWE ──────────────────────────────────────── */}
      <g id="red-control-points">
        <circle cx={wallFaceX} cy={baselineY} r="4.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
        <circle cx={wallFaceX} cy={profilHTopY} r="4.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
        <circle cx={wallFaceX} cy={rafterTopWallY} r="4.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
        <circle cx={isRight ? postRightX : postLeftX} cy={rafterTopPostY} r="4.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
        <circle cx={isRight ? postRightX : postLeftX} cy={profilHTopY} r="4.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
        <circle cx={isRight ? postRightX : postLeftX} cy={baselineY + slopeDeltaPx} r="4.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
      </g>

      {/* ─── 9. LINIE WYMIAROWE I INTERAKTYWNA EDYCJA WYMIARÓW ───────────────── */}
      {showTechnicalDetails && (
        <g id="dimensions">
          {/* Linia wymiarowa dolna: SZEROKOŚĆ ŚCIANKI */}
          <line x1={leftEdgeX} y1={baselineY + 46} x2={rightEdgeX} y2={baselineY + 46} stroke="#0f172a" strokeWidth="1.5" />
          <line x1={leftEdgeX} y1={baselineY + 38} x2={leftEdgeX} y2={baselineY + 54} stroke="#0f172a" strokeWidth="1.5" />
          <line x1={rightEdgeX} y1={baselineY + 38} x2={rightEdgeX} y2={baselineY + 54} stroke="#0f172a" strokeWidth="1.5" />

          {/* Klikalna etykieta szerokości */}
          <g className="cursor-pointer" onClick={() => onEditDimension("width")}>
            <rect
              x={(leftEdgeX + rightEdgeX) / 2 - 45}
              y={baselineY + 35}
              width="90"
              height="22"
              fill="#ffffff"
              rx="4"
              stroke="#e2e8f0"
              className="hover:stroke-amber-400 hover:fill-amber-50"
            />
            <text
              x={(leftEdgeX + rightEdgeX) / 2}
              y={baselineY + 50}
              fontSize="12"
              fontWeight="bold"
              fill="#0f172a"
              textAnchor="middle"
            >
              {widthVal} cm
            </text>
          </g>

          {/* Linia wymiarowa pionowa: WYSOKOŚĆ ŚCIANKI I TRÓJKĄTA */}
          {(() => {
            const dimLineX = isRight ? 880 : 120;
            const textAnchor = isRight ? "start" : "end";
            const textOffset = isRight ? 15 : -15;

            return (
              <>
                <line x1={dimLineX} y1={rafterTopWallY} x2={dimLineX} y2={baselineY} stroke="#0f172a" strokeWidth="1.5" />
                <line x1={dimLineX - 8} y1={baselineY} x2={dimLineX + 8} y2={baselineY} stroke="#0f172a" strokeWidth="1.5" />
                <line x1={dimLineX - 8} y1={profilHTopY} x2={dimLineX + 8} y2={profilHTopY} stroke="#0f172a" strokeWidth="1.5" />
                <line x1={dimLineX - 8} y1={rafterTopWallY} x2={dimLineX + 8} y2={rafterTopWallY} stroke="#0f172a" strokeWidth="1.5" />

                {/* Przedłużenia od ściany */}
                <line x1={Math.min(dimLineX, wallFaceX)} y1={rafterTopWallY} x2={Math.max(dimLineX, wallFaceX)} y2={rafterTopWallY} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" />
                <line x1={Math.min(dimLineX, wallFaceX)} y1={profilHTopY} x2={Math.max(dimLineX, wallFaceX)} y2={profilHTopY} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" />
                <line x1={Math.min(dimLineX, wallFaceX)} y1={baselineY} x2={Math.max(dimLineX, wallFaceX)} y2={baselineY} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" />

                {/* Klikalna etykieta wysokości drzwi */}
                <g className="cursor-pointer" onClick={() => onEditDimension("height")}>
                  <text
                    x={dimLineX + textOffset}
                    y={(baselineY + profilHTopY) / 2 + 4}
                    fontSize="11"
                    fontWeight="bold"
                    fill="#0f172a"
                    textAnchor={textAnchor}
                  >
                    {heightVal} cm
                  </text>
                </g>

                {/* Wymiar wysokości trójkąta (poliwęglan) */}
                <text
                  x={dimLineX + textOffset}
                  y={(profilHTopY + rafterTopWallY) / 2 + 4}
                  fontSize="10"
                  fontWeight="bold"
                  fill="#0284c7"
                  textAnchor={textAnchor}
                >
                  +{triangleHeightCm} cm
                </text>

                {/* Wysokość łączna */}
                <text
                  x={dimLineX + textOffset + (isRight ? 15 : -15)}
                  y={rafterTopWallY + 4}
                  fontSize="10"
                  fontWeight="bold"
                  fill="#64748b"
                  textAnchor={textAnchor}
                >
                  H={totalHeightCm}
                </text>
              </>
            );
          })()}
        </g>
      )}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WIDOK FRONTOWY (FRONT WALL)
// ─────────────────────────────────────────────────────────────────────────────
interface FrontWallSvgProps {
  widthVal: number;
  heightVal: number;
  panelCount: number;
  hasFoundation: boolean;
  ralColor: { code: string; name: string; hex: string; textColor: string; border: string };
  mode: "cad" | "ral";
  showTechnicalDetails: boolean;
  onEditDimension: (type: "width" | "height" | "slope") => void;
}

function FrontWallSvg({
  widthVal,
  heightVal,
  panelCount,
  hasFoundation,
  ralColor,
  mode,
  showTechnicalDetails,
  onEditDimension,
}: FrontWallSvgProps) {
  const leftPostX = 200;
  const rightPostX = 760;
  const postWidth = 24;
  const openingWidth = rightPostX - (leftPostX + postWidth);
  const panelWidth = openingWidth / panelCount;

  const topBeamY = 160;
  const doorTopY = 184;
  const groundY = 440;
  const foundationTopY = 430;

  const isCad = mode === "cad";
  const profileFill = isCad ? "#8cc63f" : ralColor.hex;
  const profileStroke = isCad ? "#4d7c0f" : ralColor.border;
  const textFill = isCad ? "#14532d" : ralColor.textColor;

  return (
    <svg
      viewBox="0 0 1000 540"
      className="w-full h-full select-none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="frontGlass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.7" />
          <stop offset="50%" stopColor="#bae6fd" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#e0f2fe" stopOpacity="0.7" />
        </linearGradient>
      </defs>

      {/* Rynna / belka górna frontowa */}
      <rect
        x={leftPostX - 10}
        y={topBeamY}
        width={rightPostX - leftPostX + postWidth + 20}
        height="24"
        fill={profileFill}
        stroke={profileStroke}
        strokeWidth="2"
      />
      <text
        x={(leftPostX + rightPostX + postWidth) / 2}
        y={topBeamY + 16}
        fontSize="11"
        fontWeight="bold"
        fill={textFill}
        letterSpacing="3"
        textAnchor="middle"
      >
        RYNNA / BELKA FRONTOWA
      </text>

      {/* Słupy frontowe */}
      <rect x={leftPostX} y={topBeamY + 24} width={postWidth} height={groundY - (topBeamY + 24)} fill={profileFill} stroke={profileStroke} strokeWidth="2" />
      <rect x={rightPostX} y={topBeamY + 24} width={postWidth} height={groundY - (topBeamY + 24)} fill={profileFill} stroke={profileStroke} strokeWidth="2" />

      {/* Prowadnica górna */}
      <rect x={leftPostX + postWidth} y={doorTopY} width={openingWidth} height="10" fill="#e2e8f0" stroke="#64748b" strokeWidth="1" />

      {/* Panele szklane przesuwne */}
      {Array.from({ length: panelCount }).map((_, i) => {
        const pLeft = leftPostX + postWidth + i * panelWidth;
        return (
          <g key={i}>
            <rect
              x={pLeft}
              y={doorTopY + 10}
              width={panelWidth}
              height={foundationTopY - (doorTopY + 10)}
              fill="url(#frontGlass)"
              stroke="#38bdf8"
              strokeWidth="1"
            />
            <line x1={pLeft} y1={doorTopY + 10} x2={pLeft} y2={foundationTopY} stroke="#64748b" strokeWidth="2" />
            <line x1={pLeft + panelWidth} y1={doorTopY + 10} x2={pLeft + panelWidth} y2={foundationTopY} stroke="#64748b" strokeWidth="2" />
            <text
              x={pLeft + panelWidth / 2}
              y={(doorTopY + foundationTopY) / 2}
              fontSize="12"
              fontWeight="bold"
              fill="rgba(15, 23, 42, 0.4)"
              textAnchor="middle"
            >
              Kwatera {i + 1}
            </text>
          </g>
        );
      })}

      {/* Podwalina frontowa */}
      <rect
        x={leftPostX}
        y={foundationTopY}
        width={rightPostX - leftPostX + postWidth}
        height="12"
        fill={hasFoundation ? (isCad ? "#fef08a" : "#fed7aa") : "#f8fafc"}
        stroke={hasFoundation ? (isCad ? "#ca8a04" : "#f97316") : "#94a3b8"}
        strokeWidth="1.5"
      />

      <line x1={leftPostX - 40} y1={groundY} x2={rightPostX + postWidth + 40} y2={groundY} stroke="#0f172a" strokeWidth="2.5" />

      {/* Wymiary: dolny i boczny */}
      {showTechnicalDetails && (
        <>
          <line x1={leftPostX} y1={groundY + 36} x2={rightPostX + postWidth} y2={groundY + 36} stroke="#0f172a" strokeWidth="1.5" />
          <line x1={leftPostX} y1={groundY + 28} x2={leftPostX} y2={groundY + 44} stroke="#0f172a" strokeWidth="1.5" />
          <line x1={rightPostX + postWidth} y1={groundY + 28} x2={rightPostX + postWidth} y2={groundY + 44} stroke="#0f172a" strokeWidth="1.5" />
          
          <g className="cursor-pointer" onClick={() => onEditDimension("width")}>
            <rect x={(leftPostX + rightPostX + postWidth) / 2 - 45} y={groundY + 25} width="90" height="22" fill="#ffffff" rx="4" stroke="#e2e8f0" />
            <text
              x={(leftPostX + rightPostX + postWidth) / 2}
              y={groundY + 40}
              fontSize="12"
              fontWeight="bold"
              fill="#0f172a"
              textAnchor="middle"
            >
              {widthVal} cm
            </text>
          </g>

          <line x1={leftPostX - 25} y1={topBeamY} x2={leftPostX - 25} y2={groundY} stroke="#0f172a" strokeWidth="1.5" />
          <line x1={leftPostX - 32} y1={topBeamY} x2={leftPostX - 18} y2={topBeamY} stroke="#0f172a" strokeWidth="1.5" />
          <line x1={leftPostX - 32} y1={groundY} x2={leftPostX - 18} y2={groundY} stroke="#0f172a" strokeWidth="1.5" />
          <g className="cursor-pointer" onClick={() => onEditDimension("height")}>
            <text
              x={leftPostX - 36}
              y={(topBeamY + groundY) / 2 + 4}
              fontSize="12"
              fontWeight="bold"
              fill="#0f172a"
              textAnchor="end"
            >
              {heightVal} cm
            </text>
          </g>
        </>
      )}
    </svg>
  );
}
