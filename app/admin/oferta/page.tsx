"use client";

import React, { Suspense, useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { CadWorkspace } from "@/components/cad-configurator/CadWorkspace";
import { fmtDate, fmtPLN } from "@/components/crm-ui";
import ServiceIcon from "@/components/ServiceIcon";
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
  X,
  Phone,
  Mail,
  Calendar,
  Check,
  UserPlus,
  Building2,
  Briefcase,
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

  // Tryb modalu: 'select' (istniejąca szansa) | 'create' (nowa szansa)
  const [modalMode, setModalMode] = useState<"select" | "create">("select");
  const [clientType, setClientType] = useState<"individual" | "business">("individual");
  const [newOppFirstName, setNewOppFirstName] = useState("");
  const [newOppLastName, setNewOppLastName] = useState("");
  const [newOppCompanyName, setNewOppCompanyName] = useState("");
  const [newOppNip, setNewOppNip] = useState("");
  const [nipLoading, setNipLoading] = useState(false);
  const [nipFetched, setNipFetched] = useState(false);
  const [nipError, setNipError] = useState<string | null>(null);
  const [newOppPhone, setNewOppPhone] = useState("");
  const [newOppEmail, setNewOppEmail] = useState("");
  const [newOppCity, setNewOppCity] = useState("");
  const [newOppStreet, setNewOppStreet] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [newOppComment, setNewOppComment] = useState("");
  const [newOppError, setNewOppError] = useState("");

  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  // Queries & Actions
  const offers = useQuery(api.offers.list, {
    search: search.trim() || undefined,
  });

  const opportunities = useQuery(api.salesOpportunities.listForPicker, {});
  const servicesList = useQuery(api.services.list, {}) ?? [];
  const getOrCreateForOpportunity = useMutation(api.offers.getOrCreateForOpportunity);
  const createOfferForOpportunity = useMutation(api.offers.createOfferForOpportunity);
  const createManualOpportunity = useMutation(api.salesOpportunities.createManualOpportunity);
  const lookupNip = useAction(api.whitelist.lookupNip);

  const handleNipLookup = async () => {
    const cleanNip = newOppNip.trim().replace(/[\s-]/g, "");
    if (!cleanNip) {
      setNipError("Podaj numer NIP");
      return;
    }
    if (!/^\d{10}$/.test(cleanNip)) {
      setNipError("NIP musi składać się z 10 cyfr");
      return;
    }
    setNipLoading(true);
    setNipError(null);
    try {
      const data = await lookupNip({ nip: cleanNip });
      if (data) {
        if (data.companyName) setNewOppCompanyName(data.companyName);
        if (data.street) setNewOppStreet(data.street);
        if (data.city) setNewOppCity(data.city);
        setNipFetched(true);
      }
    } catch (err: unknown) {
      setNipError(err instanceof Error ? err.message : "Błąd pobierania danych z GUS");
    } finally {
      setNipLoading(false);
    }
  };

  const toggleService = (serviceName: string) => {
    setSelectedServices((prev) =>
      prev.includes(serviceName) ? prev.filter((s) => s !== serviceName) : [...prev, serviceName]
    );
  };

  const handleSwitchToCreate = (prefill?: string) => {
    setModalMode("create");
    setNewOppError("");
    const searchVal = (prefill !== undefined ? prefill : oppSearch).trim();
    if (searchVal) {
      const parts = searchVal.split(/\s+/);
      if (parts.length === 1) {
        setNewOppFirstName(parts[0]);
      } else {
        setNewOppFirstName(parts[0]);
        setNewOppLastName(parts.slice(1).join(" "));
      }
      setNewOppCompanyName(searchVal);
    }
  };

  // Mapa istniejących ofert po opportunityId (tablica ofert dla każdej szansy)
  const offersByOppId = useMemo(() => {
    const map = new Map<string, NonNullable<typeof offers>>();
    if (!offers) return map;
    for (const o of offers) {
      const list = map.get(o.opportunityId) || [];
      list.push(o);
      map.set(o.opportunityId, list);
    }
    return map;
  }, [offers]);

  // Filtrowanie szans w modalu
  const filteredOpportunities = useMemo(() => {
    if (!opportunities) return [];
    const q = oppSearch.trim().toLowerCase();
    return opportunities.filter((opp) => {
      const existingOffers = offersByOppId.get(opp._id) || [];
      if (oppFilter === "no_offer" && existingOffers.length > 0) return false;
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
      const matchOfferNum = existingOffers.some((o) =>
        o.offerNumber.toLowerCase().includes(q)
      );

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
  }, [opportunities, oppSearch, oppFilter, offersByOppId]);

  const oppCounts = useMemo(() => {
    if (!opportunities) return { all: 0, no_offer: 0, lead: 0, inquiry: 0 };
    let noOffer = 0;
    let lead = 0;
    let inquiry = 0;
    for (const opp of opportunities) {
      const oppOffers = offersByOppId.get(opp._id);
      if (!oppOffers || oppOffers.length === 0) noOffer++;
      if (opp.stage === "inquiry") inquiry++;
      else lead++;
    }
    return {
      all: opportunities.length,
      no_offer: noOffer,
      lead,
      inquiry,
    };
  }, [opportunities, offersByOppId]);

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
  const handleCreateOfferForOpp = async (overrideOppId?: string, forceNew = false) => {
    const targetOppId = overrideOppId || selectedOppId;
    if (!targetOppId) return;
    setCreating(true);
    try {
      const id = forceNew
        ? await createOfferForOpportunity({
            opportunityId: targetOppId as Id<"pendingJotformSubmissions">,
          })
        : await getOrCreateForOpportunity({
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

  // Utworzenie nowej szansy sprzedaży i natychmiastowe utworzenie dla niej oferty CAD
  const handleCreateNewOpportunityAndOffer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (clientType === "business") {
      if (!newOppCompanyName.trim()) {
        setNewOppError("Podaj pełną nazwę firmy");
        return;
      }
    } else {
      if (!newOppFirstName.trim() && !newOppLastName.trim()) {
        setNewOppError("Podaj imię lub nazwisko klienta");
        return;
      }
    }

    if (selectedServices.length === 0) {
      setNewOppError("Wybierz przynajmniej jedną usługę dla nowej szansy sprzedaży");
      return;
    }

    setNewOppError("");
    setCreating(true);
    try {
      const firstName =
        clientType === "business"
          ? newOppFirstName.trim() || ""
          : newOppFirstName.trim() || "Klient";

      const lastName =
        clientType === "business"
          ? newOppLastName.trim() || newOppCompanyName.trim()
          : newOppLastName.trim() || "-";

      const customText = undefined;

      const fullComment = [
        clientType === "business" && newOppNip.trim() ? `NIP: ${newOppNip.trim()}` : "",
        newOppComment.trim(),
      ]
        .filter(Boolean)
        .join("\n");

      const oppId = await createManualOpportunity({
        firstName,
        lastName,
        customText,
        phone: newOppPhone.trim() || undefined,
        email: newOppEmail.trim() || undefined,
        city: newOppCity.trim() || undefined,
        street: newOppStreet.trim() || undefined,
        services: selectedServices.length > 0 ? selectedServices : undefined,
        comment: fullComment || undefined,
      });

      const offerId = await createOfferForOpportunity({
        opportunityId: oppId,
      });

      setShowNewOfferModal(false);
      setModalMode("select");
      setClientType("individual");
      setNewOppFirstName("");
      setNewOppLastName("");
      setNewOppCompanyName("");
      setNewOppNip("");
      setNipFetched(false);
      setNipError(null);
      setNewOppPhone("");
      setNewOppEmail("");
      setNewOppCity("");
      setNewOppStreet("");
      setSelectedServices([]);
      setNewOppComment("");
      setOppSearch("");

      setActiveOfferId(offerId);
      router.push(`/admin/oferta?offerId=${offerId}`);
    } catch (err: unknown) {
      console.error("Błąd tworzenia szansy i oferty:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setNewOppError(msg);
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
      ) : (
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
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-[#e3e7ee] overflow-hidden flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-3.5 border-b border-[#e3e7ee] flex items-center justify-between bg-[#f8fafc] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[rgba(74,187,195,0.12)] text-[#0e7490] flex items-center justify-center border border-[rgba(74,187,195,0.3)]">
                  <Layers size={17} className="text-[#4ABBC3]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0b1220] leading-none">
                    Nowa oferta dla szansy sprzedaży
                  </h3>
                  <span className="text-[11px] text-[#64748b] mt-0.5 block">
                    Konfigurator CAD ADK CRM
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowNewOfferModal(false)}
                className="p-1.5 text-[#7c8597] hover:text-[#0b1220] rounded-md hover:bg-[#e8ecf2] transition-colors cursor-pointer"
                title="Zamknij"
              >
                <X size={16} />
              </button>
            </div>

            {/* Segmented Switcher & Hint Bar */}
            <div className="px-6 pt-3 pb-2.5 bg-white border-b border-[#e3e7ee] shrink-0">
              <div className="flex items-center gap-1 bg-[#f1f5f9] p-1 rounded-xl border border-[#e2e8f0]">
                <button
                  type="button"
                  onClick={() => {
                    setModalMode("select");
                    setNewOppError("");
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    modalMode === "select"
                      ? "bg-white text-[#0e7490] shadow-2xs border border-[#cbd5e1]/40"
                      : "text-[#64748b] hover:text-[#0b1220] hover:bg-white/60"
                  }`}
                >
                  <Search size={14} className={modalMode === "select" ? "text-[#0e7490]" : "text-[#94a3b8]"} />
                  <span>Wybierz z bazy</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleSwitchToCreate();
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    modalMode === "create"
                      ? "bg-[#0e7490] text-white shadow-2xs"
                      : "text-[#64748b] hover:text-[#0b1220] hover:bg-white/60"
                  }`}
                >
                  <UserPlus size={14} />
                  <span>Nowa szansa</span>
                </button>
              </div>

              <p className="mt-2 text-[11px] text-[#64748b] leading-relaxed">
                {modalMode === "select"
                  ? "Wyszukaj i wybierz istniejącą szansę sprzedaży lub klienta w CRM, aby otworzyć lub utworzyć ofertę CAD."
                  : "Wypełnij dane klienta, aby utworzyć nową szansę sprzedaży w CRM i przejść od razu do konfiguratora oferty CAD."}
              </p>
            </div>

            {modalMode === "create" ? (
              <form
                onSubmit={handleCreateNewOpportunityAndOffer}
                className="flex-1 flex flex-col min-h-0"
              >
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {newOppError && (
                    <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg">
                      {newOppError}
                    </div>
                  )}

                  {/* Wybór typu klienta: Osoba prywatna / Firma (B2B) */}
                  <div className="flex items-center gap-6 pb-2 border-b border-[#e2e8f0]">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#0b1220]">
                      <input
                        type="radio"
                        name="clientType"
                        checked={clientType === "individual"}
                        onChange={() => setClientType("individual")}
                        className="text-[#0e7490] focus:ring-[#0e7490] cursor-pointer"
                      />
                      <User size={14} className={clientType === "individual" ? "text-[#0e7490]" : "text-[#7c8597]"} />
                      <span>Osoba prywatna</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#0b1220]">
                      <input
                        type="radio"
                        name="clientType"
                        checked={clientType === "business"}
                        onChange={() => setClientType("business")}
                        className="text-[#0e7490] focus:ring-[#0e7490] cursor-pointer"
                      />
                      <Building2 size={14} className={clientType === "business" ? "text-[#0e7490]" : "text-[#7c8597]"} />
                      <span>Firma (B2B)</span>
                    </label>
                  </div>

                  {/* Pola dla Firmy (B2B) */}
                  {clientType === "business" && (
                    <div className="space-y-3 p-3 bg-[#f8fafc] rounded-xl border border-[#e2e8f0]">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-[#0b1220]">
                            NIP firmy
                          </label>
                          {nipFetched && (
                            <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                              ✓ Pobrano z GUS (Biała Lista)
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newOppNip}
                            onChange={(e) => {
                              setNewOppNip(e.target.value);
                              setNipFetched(false);
                              setNipError(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void handleNipLookup();
                              }
                            }}
                            placeholder="np. 1234567890"
                            className="flex-1 bg-white border border-[#d4dae3] focus:border-[#4ABBC3] rounded-lg px-3 py-1.5 text-xs text-[#0b1220] focus:ring-2 focus:ring-[#4ABBC3]/20 focus:outline-none placeholder:text-[#94a3b8]"
                          />
                          <button
                            type="button"
                            onClick={() => void handleNipLookup()}
                            disabled={nipLoading}
                            className="btn ghost border border-[#d4dae3] hover:border-[#4ABBC3] bg-white flex items-center gap-1.5 shrink-0 cursor-pointer"
                            style={{ padding: "6px 12px", fontSize: 11 }}
                          >
                            {nipLoading ? <Loader2 size={12} className="animate-spin text-[#0e7490]" /> : <Search size={12} />}
                            <span>Pobierz z GUS</span>
                          </button>
                        </div>
                        {nipError && (
                          <p className="text-[11px] text-red-600 mt-1">{nipError}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#0b1220] mb-1">
                          Pełna nazwa firmy <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={newOppCompanyName}
                          onChange={(e) => setNewOppCompanyName(e.target.value)}
                          placeholder="np. ABC Sp. z o.o."
                          className="w-full bg-white border border-[#d4dae3] focus:border-[#4ABBC3] rounded-lg px-3 py-1.5 text-xs text-[#0b1220] focus:ring-2 focus:ring-[#4ABBC3]/20 focus:outline-none placeholder:text-[#94a3b8]"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-[#475569] mb-1">
                            Imię osoby kontaktowej
                          </label>
                          <input
                            type="text"
                            value={newOppFirstName}
                            onChange={(e) => setNewOppFirstName(e.target.value)}
                            placeholder="np. Jan"
                            className="w-full bg-white border border-[#d4dae3] focus:border-[#4ABBC3] rounded-lg px-3 py-1.5 text-xs text-[#0b1220] focus:ring-2 focus:ring-[#4ABBC3]/20 focus:outline-none placeholder:text-[#94a3b8]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#475569] mb-1">
                            Nazwisko osoby kontaktowej
                          </label>
                          <input
                            type="text"
                            value={newOppLastName}
                            onChange={(e) => setNewOppLastName(e.target.value)}
                            placeholder="np. Kowalski"
                            className="w-full bg-white border border-[#d4dae3] focus:border-[#4ABBC3] rounded-lg px-3 py-1.5 text-xs text-[#0b1220] focus:ring-2 focus:ring-[#4ABBC3]/20 focus:outline-none placeholder:text-[#94a3b8]"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pola dla Osoby prywatnej */}
                  {clientType === "individual" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#0b1220] mb-1">
                          Imię klienta <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <User size={14} className="absolute left-3 top-2.5 text-[#7c8597]" />
                          <input
                            type="text"
                            autoFocus
                            required
                            value={newOppFirstName}
                            onChange={(e) => setNewOppFirstName(e.target.value)}
                            placeholder="np. Jan"
                            className="w-full bg-[#f8fafc] hover:bg-white focus:bg-white border border-[#d4dae3] focus:border-[#4ABBC3] rounded-lg pl-9 pr-3 py-2 text-xs text-[#0b1220] focus:ring-2 focus:ring-[#4ABBC3]/20 focus:outline-none transition-all placeholder:text-[#94a3b8]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#0b1220] mb-1">
                          Nazwisko klienta <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={newOppLastName}
                          onChange={(e) => setNewOppLastName(e.target.value)}
                          placeholder="np. Kowalski"
                          className="w-full bg-[#f8fafc] hover:bg-white focus:bg-white border border-[#d4dae3] focus:border-[#4ABBC3] rounded-lg px-3 py-2 text-xs text-[#0b1220] focus:ring-2 focus:ring-[#4ABBC3]/20 focus:outline-none transition-all placeholder:text-[#94a3b8]"
                        />
                      </div>
                    </div>
                  )}

                  {/* Telefon i Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#0b1220] mb-1">
                        Telefon {clientType === "business" ? "kontaktowy" : ""}
                      </label>
                      <div className="relative">
                        <Phone size={14} className="absolute left-3 top-2.5 text-[#7c8597]" />
                        <input
                          type="tel"
                          value={newOppPhone}
                          onChange={(e) => setNewOppPhone(e.target.value)}
                          placeholder="np. +48 500 600 700"
                          className="w-full bg-[#f8fafc] hover:bg-white focus:bg-white border border-[#d4dae3] focus:border-[#4ABBC3] rounded-lg pl-9 pr-3 py-2 text-xs text-[#0b1220] focus:ring-2 focus:ring-[#4ABBC3]/20 focus:outline-none transition-all placeholder:text-[#94a3b8]"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#0b1220] mb-1">
                        Adres e-mail
                      </label>
                      <div className="relative">
                        <Mail size={14} className="absolute left-3 top-2.5 text-[#7c8597]" />
                        <input
                          type="email"
                          value={newOppEmail}
                          onChange={(e) => setNewOppEmail(e.target.value)}
                          placeholder={clientType === "business" ? "biuro@firma.pl" : "klient@domena.pl"}
                          className="w-full bg-[#f8fafc] hover:bg-white focus:bg-white border border-[#d4dae3] focus:border-[#4ABBC3] rounded-lg pl-9 pr-3 py-2 text-xs text-[#0b1220] focus:ring-2 focus:ring-[#4ABBC3]/20 focus:outline-none transition-all placeholder:text-[#94a3b8]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Miejscowość i Adres */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#0b1220] mb-1">
                        Miejscowość
                      </label>
                      <div className="relative">
                        <MapPin size={14} className="absolute left-3 top-2.5 text-[#7c8597]" />
                        <input
                          type="text"
                          value={newOppCity}
                          onChange={(e) => setNewOppCity(e.target.value)}
                          placeholder="np. Warszawa"
                          className="w-full bg-[#f8fafc] hover:bg-white focus:bg-white border border-[#d4dae3] focus:border-[#4ABBC3] rounded-lg pl-9 pr-3 py-2 text-xs text-[#0b1220] focus:ring-2 focus:ring-[#4ABBC3]/20 focus:outline-none transition-all placeholder:text-[#94a3b8]"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#0b1220] mb-1">
                        Ulica / Adres inwestycji
                      </label>
                      <input
                        type="text"
                        value={newOppStreet}
                        onChange={(e) => setNewOppStreet(e.target.value)}
                        placeholder="np. ul. Polna 12"
                        className="w-full bg-[#f8fafc] hover:bg-white focus:bg-white border border-[#d4dae3] focus:border-[#4ABBC3] rounded-lg px-3 py-2 text-xs text-[#0b1220] focus:ring-2 focus:ring-[#4ABBC3]/20 focus:outline-none transition-all placeholder:text-[#94a3b8]"
                      />
                    </div>
                  </div>

                  {/* Sekcja: Wybór usług z kafelkami i ikonami (jak w /admin/szansa/nowa) */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-xs font-semibold text-[#0b1220] flex items-center gap-1.5">
                          <Briefcase size={13} className="text-[#0e7490]" />
                          <span>Wybór usług *</span>
                        </label>
                        <span className="text-[10.5px] text-[#7c8597]">Możesz wybrać jedną lub kilka usług</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {selectedServices.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedServices([])}
                            className="text-[10px] text-[#7c8597] hover:text-[#0b1220] font-medium transition cursor-pointer"
                          >
                            Wyczyść
                          </button>
                        )}
                        {selectedServices.length > 0 ? (
                          <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-[#ecfeff] text-[#0e7490] border border-[#a5f3fc]">
                            Wybrano: {selectedServices.length}
                          </span>
                        ) : (
                          <span className="text-[10.5px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            Wybierz usługi
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1 bg-[#f8fafc] rounded-xl border border-[#e2e8f0]">
                      {servicesList.length === 0 ? (
                        <div className="col-span-2 py-6 text-center text-xs text-[#7c8597]">
                          Wczytywanie listy usług...
                        </div>
                      ) : (
                        servicesList.map((svc) => {
                          const isSelected = selectedServices.includes(svc.name);

                          return (
                            <button
                              key={svc._id}
                              type="button"
                              onClick={() => toggleService(svc.name)}
                              className={`group px-2.5 py-2 rounded-lg border text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                                isSelected
                                  ? "border-[#0e7490] bg-[#ecfeff] text-[#0e7490] shadow-2xs font-semibold ring-1 ring-[#0e7490]/30"
                                  : "border-[#e2e8f0] bg-white hover:border-[#cbd5e1] hover:bg-slate-50 text-[#334155]"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div
                                  className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition ${
                                    isSelected
                                      ? "bg-[#0e7490] text-white"
                                      : "bg-[#f1f5f9] text-[#64748b] group-hover:bg-[#e2e8f0]"
                                  }`}
                                >
                                  <ServiceIcon name={svc.name} className="w-3.5 h-3.5" />
                                </div>
                                <span className="text-xs truncate font-medium">
                                  {svc.name}
                                </span>
                              </div>

                              <div
                                className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition ${
                                  isSelected
                                    ? "bg-[#0e7490] text-white shadow-2xs"
                                    : "border border-[#cbd5e1] bg-white group-hover:border-[#94a3b8]"
                                }`}
                              >
                                {isSelected && <Check size={10} strokeWidth={3} />}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Uwagi / Opis zapytania */}
                  <div>
                    <label className="block text-xs font-semibold text-[#0b1220] mb-1">
                      Uwagi / Opis zapytania
                    </label>
                    <textarea
                      rows={2}
                      value={newOppComment}
                      onChange={(e) => setNewOppComment(e.target.value)}
                      placeholder="Dodatkowe informacje o kliencie lub zapytaniu..."
                      className="w-full bg-[#f8fafc] hover:bg-white focus:bg-white border border-[#d4dae3] focus:border-[#4ABBC3] rounded-lg p-2 text-xs text-[#0b1220] focus:ring-2 focus:ring-[#4ABBC3]/20 focus:outline-none transition-all placeholder:text-[#94a3b8] resize-none"
                    />
                  </div>
                </div>

                {/* Footer formularza tworzenia */}
                <div className="px-6 py-3.5 border-t border-[#e3e7ee] bg-[#f8fafc] flex items-center justify-between gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setModalMode("select");
                      setNewOppError("");
                    }}
                    className="btn ghost cursor-pointer"
                    style={{ padding: "6px 12px", fontSize: 12 }}
                  >
                    Wróć do listy szans
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowNewOfferModal(false)}
                      className="btn ghost cursor-pointer"
                      style={{ padding: "6px 12px", fontSize: 12 }}
                    >
                      Anuluj
                    </button>
                    <button
                      type="submit"
                      disabled={
                        creating ||
                        (clientType === "business"
                          ? !newOppCompanyName.trim()
                          : !newOppFirstName.trim() && !newOppLastName.trim()) ||
                        selectedServices.length === 0
                      }
                      className="btn primary flex items-center gap-1.5 cursor-pointer"
                      style={{ padding: "6px 14px", fontSize: 12 }}
                    >
                      {creating ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Plus size={13} />
                      )}
                      <span>Utwórz szansę i przejdź do oferty</span>
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <>
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
                <div className="panel p-8 text-center text-xs text-[#7c8597] space-y-3 bg-white">
                  <p className="font-semibold text-[#0b1220]">Brak otwartych szans sprzedaży w systemie</p>
                  <button
                    type="button"
                    onClick={() => {
                      handleSwitchToCreate();
                    }}
                    className="btn primary flex items-center gap-1.5 mx-auto cursor-pointer"
                    style={{ padding: "6px 14px", fontSize: 12 }}
                  >
                    <Plus size={13} />
                    <span>Utwórz nową szansę sprzedaży</span>
                  </button>
                </div>
              ) : filteredOpportunities.length === 0 ? (
                <div className="panel p-8 text-center text-xs text-[#7c8597] space-y-3 bg-white">
                  <p className="font-semibold text-[#0b1220]">
                    Brak szans spełniających kryteria {oppSearch ? `dla „${oppSearch}”` : ""}
                  </p>
                  <p className="text-[11px] max-w-md mx-auto">
                    Nie znaleziono pasującej szansy w bazie. Możesz od razu założyć nową szansę sprzedaży dla tego klienta i przejść do oferty CAD.
                  </p>
                  <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        handleSwitchToCreate(oppSearch);
                      }}
                      className="btn primary flex items-center gap-1.5 cursor-pointer"
                      style={{ padding: "6px 14px", fontSize: 12 }}
                    >
                      <Plus size={13} />
                      <span>
                        Utwórz nową szansę {oppSearch ? `dla „${oppSearch}”` : ""}
                      </span>
                    </button>
                    {(oppSearch || oppFilter !== "all") && (
                      <button
                        type="button"
                        onClick={() => {
                          setOppSearch("");
                          setOppFilter("all");
                        }}
                        className="btn ghost text-xs cursor-pointer"
                        style={{ padding: "6px 10px", fontSize: 11 }}
                      >
                        Wyczyść filtry
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                filteredOpportunities.map((opp) => {
                  const isSelected = selectedOppId === opp._id;
                  const existingOffers = offersByOppId.get(opp._id) || [];
                  const latestOffer = existingOffers[0] || null;
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
                        void handleCreateOfferForOpp(opp._id, false);
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

                            {existingOffers.map((ex) => (
                              <span
                                key={ex._id}
                                className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-[#f1f5f9] text-[#334155] border border-[#cbd5e1]"
                                title={ex.title}
                              >
                                {ex.offerNumber} ({ex.itemsCount} poz.)
                              </span>
                            ))}
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

                      {/* Right: Direct Actions */}
                      <div className="shrink-0 flex items-center gap-1.5">
                        {latestOffer && (
                          <button
                            type="button"
                            disabled={creating}
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowNewOfferModal(false);
                              setActiveOfferId(latestOffer._id);
                              router.push(`/admin/oferta?offerId=${latestOffer._id}`);
                            }}
                            className="btn ghost border border-[#d4dae3] hover:border-[#4ABBC3]"
                            style={{ padding: "5px 9px", fontSize: 11 }}
                            title="Otwórz ostatnią ofertę"
                          >
                            <span>Otwórz ({latestOffer.offerNumber})</span>
                            <ArrowRight size={12} />
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={creating}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOppId(opp._id);
                            void handleCreateOfferForOpp(opp._id, existingOffers.length > 0);
                          }}
                          className="btn primary flex items-center gap-1"
                          style={{ padding: "5px 10px", fontSize: 11 }}
                          title={existingOffers.length > 0 ? "Utwórz kolejny wariant oferty dla tej szansy" : "Utwórz pierwszą ofertę"}
                        >
                          <Plus size={12} />
                          <span>{existingOffers.length > 0 ? "Nowy wariant" : "Utwórz ofertę"}</span>
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
                    const existingList = offersByOppId.get(selectedOppId) || [];
                    if (!sel) return null;
                    return (
                      <span>
                        Wybrano: <strong className="text-[#0b1220]">{sel.clientName}</strong>
                        {existingList.length > 0
                          ? ` (istnieje ${existingList.length} ${existingList.length === 1 ? "oferta" : "ofert"})`
                          : " — zostanie utworzona pierwsza oferta"}
                      </span>
                    );
                  })()
                ) : (
                  <span>Wybierz szansę z listy powyżej</span>
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
                {selectedOppId && (offersByOppId.get(selectedOppId) || []).length > 0 && (
                  <button
                    type="button"
                    disabled={creating}
                    onClick={() => void handleCreateOfferForOpp(selectedOppId, false)}
                    className="btn ghost border border-[#d4dae3]"
                    style={{ padding: "6px 12px", fontSize: 12 }}
                  >
                    <span>Otwórz ostatnią ofertę</span>
                  </button>
                )}
                <button
                  type="button"
                  disabled={!selectedOppId || creating}
                  onClick={() => void handleCreateOfferForOpp(selectedOppId, (offersByOppId.get(selectedOppId || "") || []).length > 0)}
                  className="btn primary flex items-center gap-1.5"
                  style={{ padding: "6px 14px", fontSize: 12 }}
                >
                  {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  <span>
                    {(offersByOppId.get(selectedOppId || "") || []).length > 0
                      ? "Utwórz kolejny wariant"
                      : "Utwórz ofertę"}
                  </span>
                </button>
                </div>
              </div>
            </>
          )}
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
