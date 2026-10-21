"use client";

import React, { Suspense, useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { CadWorkspace } from "@/components/cad-configurator/CadWorkspace";
import { fmtDate, fmtPLN } from "@/components/crm-ui";
import {
  Layers,
  Plus,
  Search,
  Filter,
  FileText,
  Loader2,
  User,
  MapPin,
  ArrowRight,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  List,
  LayoutGrid,
} from "lucide-react";

type SortField =
  | "createdAt"
  | "offerNumber"
  | "clientName"
  | "city"
  | "itemsCount"
  | "totalPriceNet"
  | "status";
type SortDirection = "asc" | "desc";

function SortIcon({
  field,
  sortField,
  sortDir,
}: {
  field: SortField;
  sortField: SortField;
  sortDir: SortDirection;
}) {
  const cls = "ml-1 inline size-3";
  if (sortField !== field) {
    return (
      <ChevronsUpDown
        className={cls}
        style={{ color: "var(--text-mute)", opacity: 0.5 }}
      />
    );
  }
  return sortDir === "asc" ? (
    <ChevronUp className={cls} style={{ color: "var(--text-strong)" }} />
  ) : (
    <ChevronDown className={cls} style={{ color: "var(--text-strong)" }} />
  );
}

function OfertaPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const oppIdParam = searchParams.get("opportunityId");
  const offerIdParam = searchParams.get("offerId");

  const [activeOfferId, setActiveOfferId] = useState<Id<"offers"> | null>(
    offerIdParam ? (offerIdParam as Id<"offers">) : null
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showNewOfferModal, setShowNewOfferModal] = useState(false);
  const [selectedOppId, setSelectedOppId] = useState<string>("");
  const [creating, setCreating] = useState(false);

  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  // Queries
  const offers = useQuery(api.offers.list, {
    search: search.trim() || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const opportunities = useQuery(api.salesOpportunities.listForPicker, {});
  const getOrCreateForOpportunity = useMutation(api.offers.getOrCreateForOpportunity);

  // Auto-otwórz lub utwórz ofertę, jeśli podano opportunityId w URL
  useEffect(() => {
    if (oppIdParam && !activeOfferId) {
      void (async () => {
        try {
          const id = await getOrCreateForOpportunity({
            opportunityId: oppIdParam as Id<"pendingJotformSubmissions">,
          });
          setActiveOfferId(id);
        } catch (err) {
          console.error("Błąd tworzenia/otwierania oferty:", err);
        }
      })();
    }
  }, [oppIdParam, activeOfferId, getOrCreateForOpportunity]);

  // Synchronizacja offerIdParam z activeOfferId
  useEffect(() => {
    if (offerIdParam && offerIdParam !== activeOfferId) {
      setActiveOfferId(offerIdParam as Id<"offers">);
    }
  }, [offerIdParam, activeOfferId]);

  // Sortowanie
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(
        field === "createdAt" || field === "totalPriceNet" || field === "itemsCount"
          ? "desc"
          : "asc"
      );
    }
  };

  const statusBadgeColors: Record<string, string> = {
    draft: "bg-[#f3f5f8] text-[#4b5563] border-[#d4dae3]",
    sent: "bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd]",
    accepted: "bg-[#dcfce7] text-[#15803d] border-[#bbf7d0]",
    rejected: "bg-[#fee2e2] text-[#b91c1c] border-[#fecaca]",
  };

  const statusBadgeLabels: Record<string, string> = {
    draft: "Szkic",
    sent: "Wysłana",
    accepted: "Zaakceptowana",
    rejected: "Odrzucona",
  };

  const sortedOffers = useMemo(() => {
    if (!offers) return [];
    return [...offers].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      const strA = String(aVal || "");
      const strB = String(bVal || "");
      const res = strA.localeCompare(strB, "pl", { numeric: true });
      return sortDir === "asc" ? res : -res;
    });
  }, [offers, sortField, sortDir]);

  // Tworzenie nowej oferty z modalnego wyboru szansy
  const handleCreateOfferForOpp = async () => {
    if (!selectedOppId) return;
    setCreating(true);
    try {
      const id = await getOrCreateForOpportunity({
        opportunityId: selectedOppId as Id<"pendingJotformSubmissions">,
      });
      setShowNewOfferModal(false);
      setActiveOfferId(id);
      router.push(`/admin/oferta?offerId=${id}`);
    } catch (err) {
      console.error("Błąd tworzenia oferty:", err);
    } finally {
      setCreating(false);
    }
  };

  // Jeśli aktywna jest konkretna oferta, renderuj CAD Workspace
  if (activeOfferId) {
    return (
      <div className="h-[calc(100vh-64px)] -m-6 flex flex-col overflow-hidden">
        <CadWorkspace offerId={activeOfferId} />
      </div>
    );
  }

  // W przeciwnym razie renderuj widok listy ofert
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[rgba(74,187,195,0.12)] text-[#0e7490] rounded-lg border border-[rgba(74,187,195,0.3)]">
              <Layers size={22} className="text-[#4ABBC3]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#0b1220]">
                Oferty & Konfigurator CAD
              </h1>
              <p className="text-xs text-[#7c8597] mt-0.5">
                Wizualny konfigurator CAD konstrukcji i wycen powiązanych z szansami sprzedaży
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowNewOfferModal(true)}
          className="btn primary"
          style={{ padding: "8px 16px", fontSize: 13 }}
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>Nowa oferta dla szansy</span>
        </button>
      </div>

      {/* Filter, Search Bar & View Mode Toggle */}
      <div className="panel p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
          <div className="relative flex-1 w-full max-w-md">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7c8597]"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj po numerze oferty, nazwie klienta..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#f8fafc] border border-[#d4dae3] rounded-md focus:outline-none focus:border-[#4ABBC3] focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Filter size={14} className="text-[#7c8597]" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-[#f8fafc] border border-[#d4dae3] rounded-md px-3 py-1.5 focus:outline-none focus:border-[#4ABBC3]"
            >
              <option value="all">Wszystkie statusy</option>
              <option value="draft">Szkic</option>
              <option value="sent">Wysłana</option>
              <option value="accepted">Zaakceptowana</option>
              <option value="rejected">Odrzucona</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {offers && (
            <span className="text-xs font-medium text-[#7c8597]">
              Łącznie: <strong className="text-[#0b1220]">{sortedOffers.length}</strong>
            </span>
          )}

          <div className="flex items-center rounded-md border border-[#d4dae3] p-0.5 bg-[#f8fafc]">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded transition-all flex items-center gap-1 text-xs ${
                viewMode === "list"
                  ? "bg-white text-[#0e7490] font-semibold shadow-2xs"
                  : "text-[#7c8597] hover:text-[#0b1220]"
              }`}
              title="Widok listy"
            >
              <List size={14} />
              <span className="hidden md:inline">Lista</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded transition-all flex items-center gap-1 text-xs ${
                viewMode === "grid"
                  ? "bg-white text-[#0e7490] font-semibold shadow-2xs"
                  : "text-[#7c8597] hover:text-[#0b1220]"
              }`}
              title="Widok kafelków"
            >
              <LayoutGrid size={14} />
              <span className="hidden md:inline">Kafelki</span>
            </button>
          </div>
        </div>
      </div>

      {/* Offers Content */}
      {offers === undefined ? (
        <div className="py-20 flex flex-col items-center justify-center text-[#7c8597] gap-2">
          <Loader2 className="animate-spin text-[#4ABBC3]" size={28} />
          <span className="text-xs">Ładowanie ofert...</span>
        </div>
      ) : sortedOffers.length === 0 ? (
        <div className="panel p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#f3f5f8] flex items-center justify-center mx-auto text-[#7c8597]">
            <FileText size={24} />
          </div>
          <h3 className="font-bold text-[#0b1220] text-sm">Brak ofert</h3>
          <p className="text-xs text-[#7c8597] max-w-sm mx-auto">
            Nie znaleziono ofert spełniających kryteria. Możesz utworzyć nową ofertę dla dowolnej szansy sprzedaży.
          </p>
          <button
            type="button"
            onClick={() => setShowNewOfferModal(true)}
            className="btn primary"
            style={{ padding: "6px 14px", fontSize: 12 }}
          >
            <Plus size={14} />
            <span>Utwórz ofertę</span>
          </button>
        </div>
      ) : viewMode === "list" ? (
        /* WIDOK LISTY (TABELA) */
        <div className="panel overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th
                    style={{ width: 140, cursor: "pointer" }}
                    onClick={() => handleSort("offerNumber")}
                  >
                    Numer oferty{" "}
                    <SortIcon
                      field="offerNumber"
                      sortField={sortField}
                      sortDir={sortDir}
                    />
                  </th>
                  <th
                    style={{ minWidth: 220, cursor: "pointer" }}
                    onClick={() => handleSort("clientName")}
                  >
                    Klient & Temat{" "}
                    <SortIcon
                      field="clientName"
                      sortField={sortField}
                      sortDir={sortDir}
                    />
                  </th>
                  <th
                    style={{ width: 140, cursor: "pointer" }}
                    onClick={() => handleSort("city")}
                  >
                    Lokalizacja{" "}
                    <SortIcon
                      field="city"
                      sortField={sortField}
                      sortDir={sortDir}
                    />
                  </th>
                  <th
                    style={{ width: 110, cursor: "pointer", textAlign: "center" }}
                    onClick={() => handleSort("itemsCount")}
                  >
                    Poz. CAD{" "}
                    <SortIcon
                      field="itemsCount"
                      sortField={sortField}
                      sortDir={sortDir}
                    />
                  </th>
                  <th
                    style={{ width: 140, cursor: "pointer", textAlign: "right" }}
                    onClick={() => handleSort("totalPriceNet")}
                  >
                    Wartość netto{" "}
                    <SortIcon
                      field="totalPriceNet"
                      sortField={sortField}
                      sortDir={sortDir}
                    />
                  </th>
                  <th
                    style={{ width: 120, cursor: "pointer" }}
                    onClick={() => handleSort("status")}
                  >
                    Status{" "}
                    <SortIcon
                      field="status"
                      sortField={sortField}
                      sortDir={sortDir}
                    />
                  </th>
                  <th
                    style={{ width: 110, cursor: "pointer" }}
                    onClick={() => handleSort("createdAt")}
                  >
                    Data{" "}
                    <SortIcon
                      field="createdAt"
                      sortField={sortField}
                      sortDir={sortDir}
                    />
                  </th>
                  <th style={{ width: 130, textAlign: "right" }}>Akcja</th>
                </tr>
              </thead>
              <tbody>
                {sortedOffers.map((o) => (
                  <tr
                    key={o._id}
                    onClick={() => {
                      setActiveOfferId(o._id);
                      router.push(`/admin/oferta?offerId=${o._id}`);
                    }}
                    className="cursor-pointer hover:bg-[#f8fafc] transition-colors group"
                  >
                    <td className="mono">
                      <span className="font-bold text-xs text-[#0e7490] bg-[rgba(74,187,195,0.12)] border border-[rgba(74,187,195,0.3)] px-2 py-0.5 rounded inline-block">
                        {o.offerNumber}
                      </span>
                    </td>
                    <td>
                      <div className="font-semibold text-[#0b1220] group-hover:text-[#0e7490] transition-colors flex items-center gap-1.5">
                        <User size={13} className="text-[#7c8597] shrink-0" />
                        <span>{o.clientName}</span>
                      </div>
                      <div className="text-[11px] text-[#7c8597] truncate max-w-sm pl-4.5">
                        {o.title}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5 text-xs text-[#4b5563]">
                        {o.city && o.city !== "—" ? (
                          <>
                            <MapPin size={12} className="text-[#7c8597] shrink-0" />
                            <span>{o.city}</span>
                          </>
                        ) : (
                          <span className="text-[#7c8597]">—</span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0]">
                        {o.itemsCount} {o.itemsCount === 1 ? "poz." : "poz."}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="font-mono font-bold text-xs text-[#0b1220]">
                        {fmtPLN(o.totalPriceNet)} zł
                      </div>
                      {o.totalPriceGross > 0 && (
                        <div className="text-[10px] text-[#7c8597]">
                          brutto: {fmtPLN(o.totalPriceGross)} zł
                        </div>
                      )}
                    </td>
                    <td>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border inline-block ${
                          statusBadgeColors[o.status] || "bg-[#f3f5f8]"
                        }`}
                      >
                        {statusBadgeLabels[o.status] || o.status}
                      </span>
                    </td>
                    <td className="text-xs text-[#7c8597] whitespace-nowrap">
                      {fmtDate(o.createdAt)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div
                        className="flex items-center justify-end gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Link
                          href={`/admin/szansa/${o.opportunityId}`}
                          title="Przejdź do szansy sprzedaży"
                          className="btn ghost icon"
                          style={{ padding: "4px 6px" }}
                        >
                          <ExternalLink size={13} className="text-[#7c8597]" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveOfferId(o._id);
                            router.push(`/admin/oferta?offerId=${o._id}`);
                          }}
                          className="btn primary"
                          style={{ padding: "4px 9px", fontSize: 11 }}
                        >
                          <span>CAD</span>
                          <ArrowRight size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* WIDOK KAFELKÓW (GRID) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedOffers.map((o) => (
            <div
              key={o._id}
              onClick={() => {
                setActiveOfferId(o._id);
                router.push(`/admin/oferta?offerId=${o._id}`);
              }}
              className="panel p-5 flex flex-col justify-between cursor-pointer hover:border-[#4ABBC3] hover:shadow-sm transition-all group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono font-bold text-xs text-[#0e7490] bg-[rgba(74,187,195,0.12)] border border-[rgba(74,187,195,0.3)] px-2 py-0.5 rounded">
                    {o.offerNumber}
                  </span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      statusBadgeColors[o.status] || "bg-[#f3f5f8]"
                    }`}
                  >
                    {statusBadgeLabels[o.status] || o.status}
                  </span>
                </div>

                <h3 className="font-bold text-[#0b1220] group-hover:text-[#0e7490] transition-colors text-sm line-clamp-1">
                  {o.title}
                </h3>

                <div className="mt-3 space-y-1.5 text-xs text-[#4b5563]">
                  <div className="flex items-center gap-1.5">
                    <User size={13} className="text-[#7c8597] shrink-0" />
                    <span className="font-medium text-[#1f2937] truncate">
                      {o.clientName}
                    </span>
                  </div>
                  {o.city && o.city !== "—" && (
                    <div className="flex items-center gap-1.5">
                      <MapPin size={13} className="text-[#7c8597] shrink-0" />
                      <span className="truncate">{o.city}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-[#e3e7ee] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[#7c8597] block uppercase font-bold">
                    Wartość netto ({o.itemsCount} poz.)
                  </span>
                  <span className="font-mono font-bold text-sm text-[#0b1220]">
                    {fmtPLN(o.totalPriceNet)} zł
                  </span>
                </div>

                <div className="flex items-center gap-1 text-[#0e7490] font-bold text-xs group-hover:translate-x-0.5 transition-transform">
                  <span>Otwórz CAD</span>
                  <ArrowRight size={14} className="text-[#4ABBC3]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Utwórz nową ofertę dla szansy */}
      {showNewOfferModal && (
        <div className="fixed inset-0 bg-[#0b1220]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-[#e3e7ee] space-y-4">
            <div>
              <h3 className="text-base font-bold text-[#0b1220]">
                Nowa oferta dla szansy sprzedaży
              </h3>
              <p className="text-xs text-[#7c8597] mt-1">
                Wybierz szansę sprzedaży, dla której chcesz otworzyć ofertę i konfigurator CAD.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1f2937] mb-1.5">
                Szansa sprzedaży:
              </label>
              {opportunities === undefined ? (
                <div className="p-3 text-center text-xs text-[#7c8597]">
                  Ładowanie szans...
                </div>
              ) : opportunities.length === 0 ? (
                <div className="p-3 text-center text-xs text-[#7c8597] bg-[#f8fafc] rounded border border-[#e3e7ee]">
                  Brak otwartych szans sprzedaży.
                </div>
              ) : (
                <select
                  value={selectedOppId}
                  onChange={(e) => setSelectedOppId(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white border border-[#d4dae3] rounded-md focus:outline-none focus:border-[#4ABBC3]"
                >
                  <option value="">-- Wybierz klienta / szansę --</option>
                  {opportunities.map((opp) => (
                    <option key={opp._id} value={opp._id}>
                      {opp.clientName} {opp.customText ? `(${opp.customText})` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e3e7ee]">
              <button
                type="button"
                onClick={() => setShowNewOfferModal(false)}
                className="btn ghost"
                style={{ padding: "6px 12px", fontSize: 12 }}
              >
                Anuluj
              </button>
              <button
                type="button"
                disabled={!selectedOppId || creating}
                onClick={handleCreateOfferForOpp}
                className="btn primary"
                style={{ padding: "6px 14px", fontSize: 12 }}
              >
                {creating && <Loader2 size={13} className="animate-spin" />}
                <span>Przejdź do konfiguratora</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OfertaPage() {
  return (
    <Suspense
      fallback={
        <div className="h-64 flex items-center justify-center text-[#7c8597]">
          <Loader2 className="animate-spin text-[#4ABBC3] mr-2" size={24} />
          <span className="text-xs">Ładowanie konfiguratora ofert...</span>
        </div>
      }
    >
      <OfertaPageContent />
    </Suspense>
  );
}
