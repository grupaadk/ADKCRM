"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CadConstructionItem } from "./CadCanvas";

const PRESET_DISCOUNTS = [0, 3, 5, 7, 10, 15, 20];
import {
  FileText,
  Percent,
  User,
  MapPin,
  Phone,
  Mail,
  Printer,
  ExternalLink,
  Edit,
  Trash2,
  Copy,
  Plus,
} from "lucide-react";

export interface OfferData {
  _id: string;
  opportunityId: string;
  offerNumber: string;
  title: string;
  status: "draft" | "sent" | "accepted" | "rejected";
  totalPriceNet: number;
  totalPriceGross: number;
  totalCostNet: number;
  discountPercent?: number;
  notes?: string;
  terms?: string;
  createdAt: number;
  updatedAt: number;
}

export interface OpportunityData {
  _id: string;
  firstName?: string;
  lastName?: string;
  clientName?: string;
  phone?: string;
  email?: string;
  street?: string;
  buildingNumber?: string;
  city?: string;
  postalCode?: string;
  investmentStreet?: string;
  investmentBuildingNumber?: string;
  investmentCity?: string;
  investmentPostalCode?: string;
  submissionId?: string;
}

interface OfferSummaryTabProps {
  offer: OfferData;
  items: CadConstructionItem[];
  opportunity?: OpportunityData | null;
  onUpdateOffer: (patch: Partial<OfferData>) => void;
  onOpenPositionInCad: (itemId: string) => void;
  onDuplicatePosition: (itemId: string) => void;
  onDeletePosition: (itemId: string) => void;
  onAddNewPosition: () => void;
  readOnly?: boolean;
}

export function OfferSummaryTab({
  offer,
  items,
  opportunity,
  onUpdateOffer,
  onOpenPositionInCad,
  onDuplicatePosition,
  onDeletePosition,
  onAddNewPosition,
  readOnly = false,
}: OfferSummaryTabProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(offer.title);

  // Financial calculations
  const rawSumNet = items.reduce((acc, it) => acc + (it.priceNet || 0) * (it.quantity || 1), 0);
  const rawCostNet = items.reduce((acc, it) => acc + (it.costNet || 0) * (it.quantity || 1), 0);

  const discountPct = offer.discountPercent || 0;
  const [prevDiscountPct, setPrevDiscountPct] = useState(discountPct);
  const [customDiscount, setCustomDiscount] = useState<string>(String(discountPct));

  if (discountPct !== prevDiscountPct) {
    setPrevDiscountPct(discountPct);
    setCustomDiscount(String(discountPct));
  }

  const discountedNet = Math.round(rawSumNet * (1 - discountPct / 100));
  const vatAmount = Math.round(discountedNet * 0.23);
  const totalGross = discountedNet + vatAmount;
  const profitNet = discountedNet - rawCostNet;
  const marginPct = discountedNet > 0 ? Math.round((profitNet / discountedNet) * 100) : 0;

  const clientName =
    [opportunity?.firstName, opportunity?.lastName].filter(Boolean).join(" ") ||
    opportunity?.clientName ||
    "Klient";

  const clientAddress = [
    opportunity?.street,
    opportunity?.buildingNumber,
    opportunity?.postalCode,
    opportunity?.city,
  ]
    .filter(Boolean)
    .join(", ");

  const investAddress = [
    opportunity?.investmentStreet || opportunity?.street,
    opportunity?.investmentBuildingNumber || opportunity?.buildingNumber,
    opportunity?.investmentPostalCode || opportunity?.postalCode,
    opportunity?.investmentCity || opportunity?.city,
  ]
    .filter(Boolean)
    .join(", ");

  const statusColors = {
    draft: "bg-[#f3f5f8] text-[#4b5563] border-[#d4dae3]",
    sent: "bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd]",
    accepted: "bg-[#dcfce7] text-[#15803d] border-[#bbf7d0]",
    rejected: "bg-[#fee2e2] text-[#b91c1c] border-[#fecaca]",
  };

  const statusLabels = {
    draft: "Szkic roboczy",
    sent: "Wysłana do klienta",
    accepted: "Zaakceptowana przez klienta",
    rejected: "Odrzucona",
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#f6f7f9] text-[#1f2937] p-6 space-y-6">
      {/* Top Commercial Header Card */}
      <div className="panel p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#e3e7ee] pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-[rgba(74,187,195,0.12)] text-[#0e7490] border border-[rgba(74,187,195,0.3)]">
                {offer.offerNumber}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  statusColors[offer.status]
                }`}
              >
                {statusLabels[offer.status]}
              </span>
            </div>

            {editingTitle && !readOnly ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  className="bg-white border border-[#4ABBC3] rounded px-3 py-1 text-[#0b1220] font-bold text-lg focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    onUpdateOffer({ title: tempTitle });
                    setEditingTitle(false);
                  }}
                  className="btn primary"
                  style={{ padding: "4px 10px", fontSize: 12 }}
                >
                  Zapisz
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTitle(false)}
                  className="btn ghost"
                  style={{ padding: "4px 8px", fontSize: 12 }}
                >
                  Anuluj
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-[#0b1220] tracking-tight">
                  {offer.title}
                </h1>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => {
                      setTempTitle(offer.title);
                      setEditingTitle(true);
                    }}
                    className="p-1 text-[#7c8597] hover:text-[#4ABBC3] transition-colors"
                    title="Edytuj tytuł oferty"
                  >
                    <Edit size={14} />
                  </button>
                )}
              </div>
            )}

            <p className="text-xs text-[#7c8597] mt-1 flex items-center gap-2">
              <span>
                Utworzono:{" "}
                <span className="text-[#4b5563] font-mono">
                  {new Date(offer.createdAt).toLocaleDateString("pl-PL")}
                </span>
              </span>
              <span>·</span>
              <span>
                Ostatnia zmiana:{" "}
                <span className="text-[#4b5563] font-mono">
                  {new Date(offer.updatedAt).toLocaleTimeString("pl-PL", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </span>
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              disabled={readOnly}
              value={offer.status}
              onChange={(e) =>
                onUpdateOffer({
                  status: e.target.value as "draft" | "sent" | "accepted" | "rejected",
                })
              }
              className="bg-white border border-[#d4dae3] text-[#1f2937] text-xs rounded-md px-3 py-2 font-medium focus:outline-none focus:border-[#4ABBC3]"
            >
              <option value="draft">Szkic roboczy</option>
              <option value="sent">Wysłana do klienta</option>
              <option value="accepted">Zaakceptowana</option>
              <option value="rejected">Odrzucona</option>
            </select>

            <button
              type="button"
              onClick={() => window.print()}
              className="btn"
              style={{ padding: "6px 12px", fontSize: 12 }}
            >
              <Printer size={14} />
              <span>Drukuj / PDF</span>
            </button>

            {opportunity?._id && (
              <Link
                href={`/admin/szansa/${opportunity._id}`}
                className="btn primary"
                style={{ padding: "6px 12px", fontSize: 12, textDecoration: "none" }}
              >
                <span>Szansa sprzedaży</span>
                <ExternalLink size={13} />
              </Link>
            )}
          </div>
        </div>

        {/* Financial KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          <div className="bg-[#f8fafc] border border-[#e3e7ee] rounded-lg p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#7c8597] block mb-1">
              Wartość netto
            </span>
            <div className="text-lg md:text-xl font-bold font-mono text-[#0e7490]">
              {discountedNet.toLocaleString("pl-PL")} zł
            </div>
            {discountPct > 0 && (
              <span className="text-[10px] text-[#d97706] font-mono">
                Po rabacie -{discountPct}%
              </span>
            )}
          </div>

          <div className="bg-[#f8fafc] border border-[#e3e7ee] rounded-lg p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#7c8597] block mb-1">
              Wartość brutto (z VAT 23%)
            </span>
            <div className="text-lg md:text-xl font-bold font-mono text-[#0b1220]">
              {totalGross.toLocaleString("pl-PL")} zł
            </div>
            <span className="text-[10px] text-[#7c8597] font-mono">
              VAT: {vatAmount.toLocaleString("pl-PL")} zł
            </span>
          </div>

          <div className="bg-[#f8fafc] border border-[#e3e7ee] rounded-lg p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#7c8597] block mb-1">
              Koszty własne netto
            </span>
            <div className="text-lg md:text-xl font-bold font-mono text-[#4b5563]">
              {rawCostNet.toLocaleString("pl-PL")} zł
            </div>
            <span className="text-[10px] text-[#7c8597]">Materiały + produkcja</span>
          </div>

          <div className="bg-[#f8fafc] border border-[#e3e7ee] rounded-lg p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#7c8597] block mb-1">
              Szacowany zysk i marża
            </span>
            <div
              className={`text-lg md:text-xl font-bold font-mono ${
                profitNet >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"
              }`}
            >
              {profitNet.toLocaleString("pl-PL")} zł
            </div>
            <span
              className={`text-[10px] font-mono font-bold ${
                marginPct >= 20 ? "text-[#16a34a]" : "text-[#d97706]"
              }`}
            >
              Marża handlowa: {marginPct}%
            </span>
          </div>
        </div>
      </div>

      {/* Client & Opportunity Information */}
      {opportunity && (
        <div className="panel p-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#7c8597] block mb-1.5 flex items-center gap-1">
              <User size={13} className="text-[#4ABBC3]" /> Dane klienta
            </span>
            <p className="font-bold text-[#0b1220] text-sm">{clientName}</p>
            {opportunity.phone && (
              <p className="text-[#4b5563] flex items-center gap-1.5 mt-1 font-mono">
                <Phone size={11} className="text-[#7c8597]" /> {opportunity.phone}
              </p>
            )}
            {opportunity.email && (
              <p className="text-[#4b5563] flex items-center gap-1.5 mt-0.5">
                <Mail size={11} className="text-[#7c8597]" /> {opportunity.email}
              </p>
            )}
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#7c8597] block mb-1.5 flex items-center gap-1">
              <MapPin size={13} className="text-[#4ABBC3]" /> Adres inwestycji
            </span>
            <p className="text-[#1f2937] font-medium">
              {investAddress || "Nie określono adresu inwestycji"}
            </p>
            {clientAddress && clientAddress !== investAddress && (
              <p className="text-[#7c8597] text-[11px] mt-1">
                Adres korespondencyjny: {clientAddress}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#7c8597] flex items-center gap-1">
                <Percent size={13} className="text-[#4ABBC3]" /> Rabat handlowy
              </span>
              {discountPct > 0 && (
                <span className="text-[11px] font-bold text-[#d97706] font-mono">
                  -{(rawSumNet - discountedNet).toLocaleString("pl-PL")} zł
                </span>
              )}
            </div>

            {/* Szybki wybór predefiniowanych rabatów (One-click) */}
            <div className="flex flex-wrap items-center gap-1 mb-2">
              {PRESET_DISCOUNTS.map((preset) => {
                const isActive = discountPct === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    disabled={readOnly}
                    onClick={() => {
                      setCustomDiscount(String(preset));
                      onUpdateOffer({ discountPercent: preset });
                    }}
                    className={`px-2 py-0.5 text-xs font-mono font-semibold rounded border transition-all ${
                      isActive
                        ? "bg-[#0e7490] text-white border-[#0e7490] shadow-xs"
                        : "bg-white text-[#4b5563] border-[#d4dae3] hover:border-[#4ABBC3] hover:text-[#0e7490]"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title={preset === 0 ? "Brak rabatu (0%)" : `Ustaw rabat ${preset}%`}
                  >
                    {preset}%
                  </button>
                );
              })}
            </div>

            {/* Wpisanie własnego rabatu */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#7c8597] font-medium">Własny:</span>
              <div className="relative inline-flex items-center">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  disabled={readOnly}
                  value={customDiscount}
                  onChange={(e) => {
                    const text = e.target.value;
                    setCustomDiscount(text);
                    if (text.trim() === "") {
                      onUpdateOffer({ discountPercent: 0 });
                      return;
                    }
                    const val = parseFloat(text);
                    if (!isNaN(val) && val >= 0 && val <= 100) {
                      onUpdateOffer({
                        discountPercent: Math.round(val * 10) / 10,
                      });
                    }
                  }}
                  className={`w-20 bg-white border rounded px-2.5 py-1 text-[#0b1220] font-mono font-bold text-xs focus:outline-none transition-colors ${
                    !PRESET_DISCOUNTS.includes(discountPct)
                      ? "border-[#0e7490] ring-1 ring-[#0e7490]/30"
                      : "border-[#d4dae3] focus:border-[#4ABBC3]"
                  }`}
                  placeholder="0"
                />
                <span className="text-[#7c8597] font-bold text-xs ml-1">%</span>
              </div>
            </div>

            <p className="text-[11px] text-[#7c8597] mt-1.5">
              Kwota rabatu: <strong className="text-[#0b1220] font-mono">{(rawSumNet - discountedNet).toLocaleString("pl-PL")} zł</strong>
              {rawSumNet > 0 && discountPct > 0 && (
                <span className="text-[#7c8597] ml-1">(z {rawSumNet.toLocaleString("pl-PL")} zł netto)</span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Itemized Table of Constructions */}
      <div className="panel overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-[#e3e7ee] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-[#4ABBC3]" />
            <h2 className="font-bold text-sm text-[#0b1220] uppercase tracking-wide">
              Wykaz konstrukcji w ofercie ({items.length})
            </h2>
          </div>

          {!readOnly && (
            <button
              type="button"
              onClick={onAddNewPosition}
              className="btn primary"
              style={{ padding: "5px 12px", fontSize: 12 }}
            >
              <Plus size={13} strokeWidth={2.5} />
              <span>Dodaj konstrukcję</span>
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="py-12 text-center text-[#7c8597] text-xs space-y-3">
            <p>Brak dodanych konstrukcji w ofercie.</p>
            {!readOnly && (
              <button
                type="button"
                onClick={onAddNewPosition}
                className="btn primary"
                style={{ padding: "6px 14px", fontSize: 12 }}
              >
                <Plus size={14} />
                <span>Wybierz konstrukcję z bazy</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="py-3 px-4 w-12 text-center">Poz.</th>
                  <th className="py-3 px-4 w-28 text-center">Podgląd CAD</th>
                  <th className="py-3 px-4">Nazwa & System</th>
                  <th className="py-3 px-4 text-center">Wymiary (mm)</th>
                  <th className="py-3 px-4 text-center">Ilość</th>
                  <th className="py-3 px-4 text-right">Cena jedn. netto</th>
                  <th className="py-3 px-4 text-right">Wartość netto</th>
                  <th className="py-3 px-4 text-center w-32">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const unitPrice = it.priceNet || 0;
                  const totalLinePrice = unitPrice * (it.quantity || 1);
                  const panes = Math.max(1, it.panesCount || 3);

                  return (
                    <tr key={it._id}>
                      <td className="py-3 px-4 text-center font-mono font-bold text-[#0e7490]">
                        {it.positionIndex}
                      </td>

                      {/* CAD Miniature */}
                      <td className="py-3 px-4 text-center">
                        <div
                          onClick={() => onOpenPositionInCad(it._id)}
                          className="w-24 h-14 mx-auto bg-[#f8fafc] rounded border border-[#e3e7ee] p-1 cursor-pointer hover:border-[#4ABBC3] transition-colors"
                          title="Kliknij, aby otworzyć w CAD"
                        >
                          <svg viewBox="0 0 100 60" className="w-full h-full">
                            <rect
                              x="2"
                              y="2"
                              width="96"
                              height="56"
                              fill="#e2e8f0"
                              stroke="#64748b"
                              strokeWidth="1.5"
                            />
                            {Array.from({ length: panes }).map((_, i) => {
                              const pw = (96 - 6) / panes;
                              return (
                                <rect
                                  key={i}
                                  x={5 + i * pw}
                                  y="5"
                                  width={pw - 2}
                                  height="50"
                                  fill="rgba(74, 187, 195, 0.25)"
                                  stroke="#0e7490"
                                  strokeWidth="1"
                                />
                              );
                            })}
                          </svg>
                        </div>
                      </td>

                      {/* Name, System, Glass */}
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => onOpenPositionInCad(it._id)}
                          className="font-bold text-[#0b1220] hover:text-[#0e7490] text-left transition-colors text-sm block"
                        >
                          {it.name}
                        </button>
                        <div className="text-[11px] text-[#7c8597] mt-0.5 space-x-2">
                          {it.systemName ? (
                            <>
                              <span>
                                System:{" "}
                                <span className="text-[#1f2937] font-semibold">
                                  {it.systemName}
                                </span>
                              </span>
                              <span>·</span>
                            </>
                          ) : null}
                          <span>
                            Kolor:{" "}
                            <span className="text-[#1f2937] font-mono">
                              {it.color || "RAL 7016MAT"}
                            </span>
                          </span>
                          <span>·</span>
                          <span>
                            Szkło:{" "}
                            <span className="text-[#0e7490] font-mono font-medium">
                              {it.fillType || "HART 10"}
                            </span>
                          </span>
                        </div>
                      </td>

                      {/* Dimensions */}
                      <td className="py-3 px-4 text-center font-mono text-[#0b1220]">
                        {it.widthMm} × {it.heightMm}
                        <div className="text-[10px] text-[#7c8597]">{panes} skrzydła</div>
                      </td>

                      {/* Quantity */}
                      <td className="py-3 px-4 text-center font-mono font-bold text-[#0b1220]">
                        {it.quantity} szt.
                      </td>

                      {/* Unit Price */}
                      <td className="py-3 px-4 text-right font-mono text-[#4b5563]">
                        {unitPrice.toLocaleString("pl-PL")} zł
                      </td>

                      {/* Total Net */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#0e7490] text-sm">
                        {totalLinePrice.toLocaleString("pl-PL")} zł
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenPositionInCad(it._id)}
                            title="Otwórz w edytorze CAD"
                            className="btn icon"
                            style={{ padding: "3px 8px", fontSize: 11, color: "#0e7490", borderColor: "#4ABBC3" }}
                          >
                            CAD
                          </button>
                          {!readOnly && (
                            <>
                              <button
                                type="button"
                                onClick={() => onDuplicatePosition(it._id)}
                                title="Duplikuj pozycję"
                                className="btn icon"
                                style={{ padding: "3px 6px" }}
                              >
                                <Copy size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeletePosition(it._id)}
                                title="Usuń pozycję"
                                className="btn icon"
                                style={{ padding: "3px 6px", color: "#dc2626", borderColor: "#fca5a5" }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
