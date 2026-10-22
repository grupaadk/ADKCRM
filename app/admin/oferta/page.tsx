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
  X,
  Phone,
  Calendar,
  Check,
} from "lucide-react";

type SortField =
  | "createdAt"
  | "offerNumber"
  | "clientName"
  | "city"
  | "itemsCount"
  | "totalPriceNet";
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
  const [showNewOfferModal, setShowNewOfferModal] = useState(false);
  const [selectedOppId, setSelectedOppId] = useState<string>("");
  const [oppSearch, setOppSearch] = useState("");
  const [oppFilter, setOppFilter] = useState<"all" | "no_offer" | "lead" | "inquiry">("all");
  const [creating, setCreating] = useState(false);

  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  // Queries
  const offers = useQuery(api.offers.list, {
    search: search.trim() || undefined,
  });

  const opportunities = useQuery(api.salesOpportunities.listForPicker, {});
  const getOrCreateForOpportunity = useMutation(api.offers.getOrCreateForOpportunity);

  // Mapa istniejących ofert po opportunityId
  const offerByOppId = useMemo(() => {
    const map = new Map<string, NonNullable<typeof offers>[number]>();
    if (!offers) return map;
    for (const o of offers) {
      map.set(o.opportunityId, o);
    }
    return map;
  }, [offers]);

  // Filtrowanie szans w modalu
  const filteredOpportunities = useMemo(() => {
    if (!opportunities) return [];
    const q = oppSearch.trim().toLowerCase();
    return opportunities.filter((opp) => {
      const existingOffer = offerByOppId.get(opp._id);
      if (oppFilter === "no_offer" && existingOffer) return false;
      if (oppFilter === "lead" && opp.stage !== "lead") return false;
      if (oppFilter === "inquiry" && opp.stage !== "inquiry") return false;

      if (!q) return true;

      const extOpp = opp as typeof opp & {
        city?: string | null;
        phone?: string | null;
        email?: string | null;
        services?: string[];
      };

      const matchName = opp.clientName.toLowerCase().includes(q);
      const matchCustom = opp.customText?.toLowerCase().includes(q) ?? false;
      const matchCity = extOpp.city?.toLowerCase().includes(q) ?? false;
      const matchPhone = extOpp.phone?.toLowerCase().includes(q) ?? false;
      const matchEmail = extOpp.email?.toLowerCase().includes(q) ?? false;
      const matchServices =
        extOpp.services?.some((s) => s.toLowerCase().includes(q)) ?? false;
      const matchOfferNum =
        existingOffer?.offerNumber.toLowerCase().includes(q) ?? false;

      return (
        matchName ||
        matchCustom ||
        matchCity ||
        matchPhone ||
        matchEmail ||
        matchServices ||
        matchOfferNum
      );
    });
  }, [opportunities, oppSearch, oppFilter, offerByOppId]);

  const oppCounts = useMemo(() => {
    if (!opportunities) return { all: 0, no_offer: 0, lead: 0, inquiry: 0 };
    let noOffer = 0;
    let lead = 0;
    let inquiry = 0;
    for (const opp of opportunities) {
      if (!offerByOppId.get(opp._id)) noOffer++;
      if (opp.stage === "inquiry") inquiry++;
      else lead++;
    }
    return {
      all: opportunities.length,
      no_offer: noOffer,
      lead,
      inquiry,
    };
  }, [opportunities, offerByOppId]);

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
    if (offerIdParam) {
      if (offerIdParam !== activeOfferId) {
        setActiveOfferId(offerIdParam as Id<"offers">);
      }
    } else if (!oppIdParam && activeOfferId) {
      setActiveOfferId(null);
    }
  }, [offerIdParam, oppIdParam, activeOfferId]);

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
  const handleCreateOfferForOpp = async (overrideOppId?: string) => {
    const targetOppId = overrideOppId || selectedOppId;
    if (!targetOppId) return;
    setCreating(true);
    try {
      const id = await getOrCreateForOpportunity({
        opportunityId: targetOppId as Id<"pendingJotformSubmissions">,
      });
      setShowNewOfferModal(false);
      setOppSearch("");
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
        <CadWorkspace
          offerId={activeOfferId}
          onBack={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              router.back();
            } else {
              setActiveOfferId(null);
              router.push("/admin/oferta");
            }
          }}
        />
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

      {/* Search Bar & View Mode Toggle */}
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
                  <th style={{ width: 150, textAlign: "right" }}>Akcja</th>
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
                        {o.lastPdfUrl && (
                          <a
                            href={o.lastPdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Otwórz wygenerowaną ofertę PDF w Google Drive"
                            className="btn icon border border-[#4ABBC3]/40 bg-[#4ABBC3]/10 text-[#0e7490] hover:bg-[#4ABBC3]/20 transition-colors"
                            style={{ padding: "4px 7px", fontSize: 11 }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <FileText size={12} className="text-[#0e7490]" />
                            <span className="font-semibold text-[11px]">PDF</span>
                          </a>
                        )}
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
                  <span className="text-[11px] text-[#7c8597]">
                    {fmtDate(o.createdAt)}
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

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {o.lastPdfUrl && (
                    <a
                      href={o.lastPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Otwórz wygenerowaną ofertę PDF w Google Drive"
                      className="flex items-center gap-1 px-2 py-1 rounded bg-[#4ABBC3]/10 border border-[#4ABBC3]/30 text-[#0e7490] font-bold text-xs hover:bg-[#4ABBC3]/20 transition-colors"
                    >
                      <FileText size={13} className="text-[#0e7490]" />
                      <span>PDF</span>
                    </a>
                  )}
                  <div className="flex items-center gap-1 text-[#0e7490] font-bold text-xs group-hover:translate-x-0.5 transition-transform">
                    <span>Otwórz CAD</span>
                    <ArrowRight size={14} className="text-[#4ABBC3]" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Utwórz nową ofertę dla szansy */}
      {showNewOfferModal && (
        <div
          className="fixed inset-0 bg-[#0b1220]/50 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => {
            if (!creating) {
              setShowNewOfferModal(false);
            }
          }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-[#e3e7ee] overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#e3e7ee] flex items-center justify-between bg-[#f8fafc] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-[rgba(74,187,195,0.12)] text-[#0e7490] rounded-md border border-[rgba(74,187,195,0.3)]">
                  <Layers size={18} className="text-[#4ABBC3]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0b1220]">
                    Nowa oferta dla szansy sprzedaży
                  </h3>
                  <p className="text-[11px] text-[#7c8597]">
                    Wyszukaj i wybierz szansę sprzedaży, aby otworzyć lub utworzyć dla niej ofertę CAD
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowNewOfferModal(false)}
                className="p-1.5 text-[#7c8597] hover:text-[#0b1220] rounded-md hover:bg-[#e8ecf2] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Wyszukiwarka + Szybkie filtry */}
            <div className="px-6 py-3.5 border-b border-[#e3e7ee] bg-white shrink-0 space-y-2.5">
              <div className="relative flex items-center">
                <Search
                  size={15}
                  className="absolute left-3 text-[#7c8597] pointer-events-none"
                />
                <input
                  type="text"
                  autoFocus
                  value={oppSearch}
                  onChange={(e) => setOppSearch(e.target.value)}
                  placeholder="Szukaj po nazwisku klienta, mieście, telefonie, temacie lub usłudze..."
                  className="w-full bg-[#f8fafc] hover:bg-white focus:bg-white border border-[#d4dae3] focus:border-[#4ABBC3] rounded-lg pl-9 pr-8 py-2 text-xs text-[#0b1220] focus:ring-2 focus:ring-[#4ABBC3]/20 focus:outline-none transition-all placeholder:text-[#94a3b8]"
                />
                {oppSearch && (
                  <button
                    type="button"
                    onClick={() => setOppSearch("")}
                    className="absolute right-2.5 text-[#94a3b8] hover:text-[#0b1220] p-0.5 rounded transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Filter Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1">
                  {(
                    [
                      { key: "all", label: "Wszystkie", count: oppCounts.all },
                      { key: "no_offer", label: "Bez oferty CAD", count: oppCounts.no_offer },
                      { key: "lead", label: "Oferty / Lead", count: oppCounts.lead },
                      { key: "inquiry", label: "Oferta wysłana", count: oppCounts.inquiry },
                    ] as const
                  ).map((tab) => {
                    const active = oppFilter === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setOppFilter(tab.key)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                          active
                            ? "bg-[#0e7490] text-white shadow-2xs"
                            : "bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0] hover:text-[#0b1220]"
                        }`}
                      >
                        <span>{tab.label}</span>
                        <span
                          className={`text-[10px] font-mono px-1 rounded ${
                            active
                              ? "bg-white/20 text-white"
                              : "bg-white text-[#64748b]"
                          }`}
                        >
                          {tab.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <span className="text-[10px] font-mono text-[#7c8597]">
                  Wyników: <strong className="text-[#0b1220]">{filteredOpportunities.length}</strong>
                </span>
              </div>
            </div>

            {/* Lista szans sprzedaży */}
            <div className="flex-1 overflow-y-auto p-4 md:px-6 md:py-4 space-y-2 bg-[#f8fafc]/50">
              {opportunities === undefined ? (
                <div className="py-12 flex flex-col items-center justify-center text-[#7c8597] gap-2">
                  <Loader2 className="animate-spin text-[#4ABBC3]" size={24} />
                  <span className="text-xs">Ładowanie szans sprzedaży...</span>
                </div>
              ) : opportunities.length === 0 ? (
                <div className="panel p-8 text-center text-xs text-[#7c8597]">
                  Brak otwartych szans sprzedaży.
                </div>
              ) : filteredOpportunities.length === 0 ? (
                <div className="panel p-8 text-center text-xs text-[#7c8597] space-y-2 bg-white">
                  <p className="font-semibold text-[#0b1220]">
                    Brak szans spełniających kryteria wyszukiwania
                  </p>
                  <p className="text-[11px]">
                    Spróbuj zmienić frazę wyszukiwania lub przełącz filtr kategorii powyżej.
                  </p>
                  {(oppSearch || oppFilter !== "all") && (
                    <button
                      type="button"
                      onClick={() => {
                        setOppSearch("");
                        setOppFilter("all");
                      }}
                      className="btn ghost text-xs mt-1"
                      style={{ padding: "4px 10px", fontSize: 11 }}
                    >
                      Wyczyść filtry
                    </button>
                  )}
                </div>
              ) : (
                filteredOpportunities.map((opp) => {
                  const isSelected = selectedOppId === opp._id;
                  const existingOffer = offerByOppId.get(opp._id);
                  const extOpp = opp as typeof opp & {
                    city?: string | null;
                    phone?: string | null;
                    email?: string | null;
                    services?: string[];
                    createdAt?: number;
                  };

                  return (
                    <div
                      key={opp._id}
                      onClick={() => setSelectedOppId(opp._id)}
                      onDoubleClick={() => {
                        setSelectedOppId(opp._id);
                        void handleCreateOfferForOpp(opp._id);
                      }}
                      className={`group rounded-lg p-3 transition-all cursor-pointer flex items-center justify-between gap-3 border ${
                        isSelected
                          ? "bg-[#f0fdff] border-[#4ABBC3] ring-2 ring-[#4ABBC3]/20 shadow-xs"
                          : "bg-white hover:bg-[#fafbfd] border-[#e3e7ee] hover:border-[#cbd5e1] shadow-2xs"
                      }`}
                    >
                      {/* Left & Center: Client info & metadata */}
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border transition-colors ${
                            isSelected
                              ? "bg-[#0e7490] text-white border-[#0e7490]"
                              : "bg-[#f1f5f9] text-[#64748b] border-[#e2e8f0] group-hover:text-[#0e7490]"
                          }`}
                        >
                          {isSelected ? <Check size={15} strokeWidth={2.5} /> : <User size={15} />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-xs text-[#0b1220] group-hover:text-[#0e7490] transition-colors truncate">
                              {opp.clientName}
                            </span>

                            {opp.customText && (
                              <span className="text-[11px] font-medium text-[#0e7490] bg-[rgba(74,187,195,0.12)] border border-[rgba(74,187,195,0.25)] px-1.5 py-0.2 rounded truncate max-w-[220px]">
                                {opp.customText}
                              </span>
                            )}

                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${
                                opp.stage === "inquiry"
                                  ? "bg-[#dbeafe] text-[#1d4ed8] border-[#bfdbfe]"
                                  : "bg-[#fef3c7] text-[#b45309] border-[#fde68a]"
                              }`}
                            >
                              {opp.stage === "inquiry" ? "Oferta wysłana" : "Oferty / Lead"}
                            </span>

                            {existingOffer && (
                              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-[#f1f5f9] text-[#334155] border border-[#cbd5e1]">
                                {existingOffer.offerNumber} ({existingOffer.itemsCount} poz.)
                              </span>
                            )}
                          </div>

                          {/* Second row: City, Phone, Services, Date */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-[#64748b]">
                            {extOpp.city && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin size={11} className="text-[#94a3b8] shrink-0" />
                                <span className="truncate max-w-[140px]">{extOpp.city}</span>
                              </span>
                            )}
                            {extOpp.phone && (
                              <span className="inline-flex items-center gap-1 font-mono text-[10px]">
                                <Phone size={11} className="text-[#94a3b8] shrink-0" />
                                <span>{extOpp.phone}</span>
                              </span>
                            )}
                            {extOpp.createdAt && (
                              <span className="inline-flex items-center gap-1 text-[10px]">
                                <Calendar size={11} className="text-[#94a3b8] shrink-0" />
                                <span>{fmtDate(extOpp.createdAt)}</span>
                              </span>
                            )}
                            {extOpp.services && extOpp.services.length > 0 && (
                              <span className="text-[10px] text-[#475569] truncate max-w-[240px]">
                                • {extOpp.services.slice(0, 2).join(", ")}
                                {extOpp.services.length > 2 ? ` +${extOpp.services.length - 2}` : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Direct Open Action */}
                      <div className="shrink-0 flex items-center gap-2">
                        <button
                          type="button"
                          disabled={creating}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOppId(opp._id);
                            void handleCreateOfferForOpp(opp._id);
                          }}
                          className={`btn flex items-center gap-1 transition-all ${
                            isSelected ? "primary" : "ghost border border-[#d4dae3] hover:border-[#4ABBC3]"
                          }`}
                          style={{ padding: "5px 10px", fontSize: 11 }}
                        >
                          <span>{existingOffer ? "Otwórz CAD" : "Utwórz ofertę"}</span>
                          <ArrowRight size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-[#e3e7ee] bg-[#f8fafc] flex items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-[#64748b] truncate">
                {selectedOppId ? (
                  (() => {
                    const sel = opportunities?.find((o) => o._id === selectedOppId);
                    const ex = offerByOppId.get(selectedOppId);
                    if (!sel) return null;
                    return (
                      <span>
                        Wybrano: <strong className="text-[#0b1220]">{sel.clientName}</strong>
                        {ex ? ` (${ex.offerNumber})` : " — zostanie utworzona nowa oferta"}
                      </span>
                    );
                  })()
                ) : (
                  <span>Kliknij szansę na liście (lub kliknij dwukrotnie, aby od razu otworzyć)</span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
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
                  onClick={() => void handleCreateOfferForOpp()}
                  className="btn primary"
                  style={{ padding: "6px 14px", fontSize: 12 }}
                >
                  {creating && <Loader2 size={13} className="animate-spin" />}
                  <span>Przejdź do konfiguratora</span>
                </button>
              </div>
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
