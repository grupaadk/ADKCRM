"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import ServiceIcon from "@/components/ServiceIcon";
import {
  ArrowLeft,
  Search,
  User,
  Check,
  Loader2,
  MapPin,
  Briefcase,
  FileText,
  Phone,
  Mail,
  ChevronRight,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

interface NewOpportunityFormProps {
  initialClientId?: Id<"clients">;
  onSuccess?: (opportunityId: string) => void;
  onCancel?: () => void;
}

const LEAD_SOURCE_OPTIONS = [
  "Telefon / Kontakt bezpośredni",
  "Strona WWW (Formularz)",
  "Rekomendacja / Polecenie",
  "Facebook / Instagram",
  "Targi / Wydarzenie",
  "Inne",
];

export default function NewOpportunityForm({
  initialClientId,
  onSuccess,
  onCancel,
}: NewOpportunityFormProps) {
  const router = useRouter();

  // Convex mutations & queries
  const createOpportunity = useMutation(api.salesOpportunities.createManualOpportunity);
  const createClient = useMutation(api.clients.create);
  const lookupNip = useAction(api.whitelist.lookupNip);
  const servicesList = useQuery(api.services.list, {}) ?? [];
  const currentUser = useQuery(api.users.me);

  // Client mode state
  const [clientMode, setClientMode] = useState<"search" | "create">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<Id<"clients"> | undefined>(initialClientId);

  // Queries for clients
  const searchResults = useQuery(
    api.clients.search,
    searchQuery.trim().length >= 2 ? { searchTerm: searchQuery.trim() } : "skip"
  );
  const popularClients = useQuery(api.clients.getPopularClients, { limit: 6 });
  const selectedClientDoc = useQuery(
    api.clients.getById,
    selectedClientId ? { clientId: selectedClientId } : "skip"
  );

  // New Client Form Fields
  const [clientType, setClientType] = useState<"individual" | "business">("individual");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newStreet, setNewStreet] = useState("");
  const [newBuildingNumber, setNewBuildingNumber] = useState("");
  const [newApartmentNumber, setNewApartmentNumber] = useState("");
  const [newPostalCode, setNewPostalCode] = useState("");
  const [newNip, setNewNip] = useState("");
  const [nipLoading, setNipLoading] = useState(false);
  const [nipFetched, setNipFetched] = useState(false);
  const [nipError, setNipError] = useState<string | null>(null);

  // Pobieranie danych z GUS / Biała Lista MF
  const handleNipLookup = async (nipToLookup?: string) => {
    const raw = (nipToLookup ?? newNip).trim();
    const cleanNip = raw.replace(/[\s-]/g, "");
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
        if (data.companyName) setNewCompanyName(data.companyName);
        if (data.street) setNewStreet(data.street);
        if (data.buildingNumber) setNewBuildingNumber(data.buildingNumber);
        if (data.apartmentNumber) setNewApartmentNumber(data.apartmentNumber);
        if (data.postalCode) setNewPostalCode(data.postalCode);
        if (data.city) setNewCity(data.city);
        setNipFetched(true);
      }
    } catch (err: unknown) {
      setNipError(err instanceof Error ? err.message : "Błąd pobierania danych z GUS");
    } finally {
      setNipLoading(false);
    }
  };

  // Opportunity Details Fields
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [leadSource, setLeadSource] = useState<string>("Telefon / Kontakt bezpośredni");
  const [notes, setNotes] = useState("");

  // Investment Address Fields
  const [hasSeparateAddress, setHasSeparateAddress] = useState(false);
  const [investmentStreet, setInvestmentStreet] = useState("");
  const [investmentBuildingNumber, setInvestmentBuildingNumber] = useState("");
  const [investmentApartmentNumber, setInvestmentApartmentNumber] = useState("");
  const [investmentPostalCode, setInvestmentPostalCode] = useState("");
  const [investmentCity, setInvestmentCity] = useState("");

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync initialClientId if it changed
  const [prevInitialClientId, setPrevInitialClientId] = useState(initialClientId);
  if (initialClientId !== prevInitialClientId) {
    setPrevInitialClientId(initialClientId);
    if (initialClientId) {
      setSelectedClientId(initialClientId);
      setClientMode("search");
    }
  }

  // Toggle service selection
  const toggleService = (serviceName: string) => {
    setSelectedServices((prev) =>
      prev.includes(serviceName) ? prev.filter((s) => s !== serviceName) : [...prev, serviceName]
    );
  };

  // Form submission
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    // Validation: Services
    if (selectedServices.length === 0) {
      setError("Wybierz przynajmniej jedną usługę dla tej szansy sprzedaży.");
      return;
    }

    // Validation: Client
    let finalClientId = selectedClientId;
    let finalFirstName = "";
    let finalLastName = "";
    let finalPhone: string | undefined = undefined;
    let finalEmail: string | undefined = undefined;
    let finalCity: string | undefined = undefined;

    if (clientMode === "search") {
      if (!selectedClientDoc) {
        setError("Wybierz klienta z listy lub przełącz na 'Nowy klient'.");
        return;
      }
      finalClientId = selectedClientDoc._id;
      finalFirstName = selectedClientDoc.firstName;
      finalLastName = selectedClientDoc.lastName || selectedClientDoc.companyName || "";
      finalPhone = selectedClientDoc.phone;
      finalEmail = selectedClientDoc.email;
      finalCity = selectedClientDoc.city;
    } else {
      // Create mode
      if (clientType === "individual") {
        if (!newFirstName.trim() || !newLastName.trim()) {
          setError("Podaj imię i nazwisko klienta.");
          return;
        }
        finalFirstName = newFirstName.trim();
        finalLastName = newLastName.trim();
      } else {
        if (!newCompanyName.trim()) {
          setError("Podaj nazwę firmy.");
          return;
        }
        finalFirstName = newFirstName.trim() || newCompanyName.trim();
        finalLastName = newLastName.trim() || "Firma";
      }

      finalPhone = newPhone.trim() || undefined;
      finalEmail = newEmail.trim() || undefined;
      finalCity = newCity.trim() || undefined;
    }

    setIsSubmitting(true);

    try {
      // 1. If in create mode, insert client first
      if (clientMode === "create") {
        const createdId = await createClient({
          clientType,
          firstName: finalFirstName,
          lastName: finalLastName,
          companyName: clientType === "business" ? newCompanyName.trim() : undefined,
          phone: finalPhone,
          email: finalEmail,
          city: finalCity,
          street: newStreet.trim() || undefined,
          buildingNumber: newBuildingNumber.trim() || undefined,
          apartmentNumber: newApartmentNumber.trim() || undefined,
          postalCode: newPostalCode.trim() || undefined,
          nip: clientType === "business" && newNip.trim() ? newNip.trim().replace(/[\s-]/g, "") : undefined,
        });
        finalClientId = createdId;
      }

      // 2. Create the Sales Opportunity
      const oppId = await createOpportunity({
        clientId: finalClientId,
        firstName: finalFirstName,
        lastName: finalLastName,
        phone: finalPhone,
        email: finalEmail,
        city: finalCity,
        services: selectedServices,
        leadSource: leadSource.trim() || undefined,
        comment: notes.trim() || undefined,
        price: 0,
        cost: 0,
        profit: 0,
        serviceConfigurations: [],
        investmentStreet: hasSeparateAddress && investmentStreet.trim() ? investmentStreet.trim() : (newStreet.trim() || undefined),
        investmentBuildingNumber: hasSeparateAddress && investmentBuildingNumber.trim() ? investmentBuildingNumber.trim() : (newBuildingNumber.trim() || undefined),
        investmentApartmentNumber: hasSeparateAddress && investmentApartmentNumber.trim() ? investmentApartmentNumber.trim() : (newApartmentNumber.trim() || undefined),
        investmentPostalCode: hasSeparateAddress && investmentPostalCode.trim() ? investmentPostalCode.trim() : (newPostalCode.trim() || undefined),
        investmentCity: hasSeparateAddress && investmentCity.trim() ? investmentCity.trim() : finalCity,
      });

      if (onSuccess) {
        onSuccess(oppId);
      } else {
        // Redirect directly to the created opportunity page on the wyceny tab
        router.push(`/admin/szansa/${oppId}?tab=wyceny`);
      }
    } catch (err: unknown) {
      console.error("Failed to create opportunity:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setError("Wystąpił błąd podczas tworzenia szansy sprzedaży: " + msg);
      setIsSubmitting(false);
    }
  };

  // Preview client display name
  const clientDisplayName =
    clientMode === "search"
      ? selectedClientDoc
        ? selectedClientDoc.clientType === "business" && selectedClientDoc.companyName
          ? selectedClientDoc.companyName
          : `${selectedClientDoc.firstName} ${selectedClientDoc.lastName}`
        : null
      : clientType === "business"
      ? newCompanyName || (newFirstName ? `${newFirstName} ${newLastName}` : null)
      : newFirstName || newLastName
      ? `${newFirstName} ${newLastName}`.trim()
      : null;

  return (
    <div className="w-full pb-8">
      {/* ── Górna belka nawigacyjna i akcji (pełna szerokość) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
            >
              <ArrowLeft size={18} />
            </button>
          ) : (
            <Link
              href="/admin/szanse"
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition shadow-2xs inline-flex"
            >
              <ArrowLeft size={18} />
            </Link>
          )}
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Nowa szansa sprzedaży
              </h1>
              <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                Nowy lead
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Wprowadź klienta, wybierz usługi i utwórz szansę. Wycenę techniczną wykonasz od razu po utworzeniu.
            </p>
          </div>
        </div>

        {/* Akcje w prawym górnym rogu */}
        <div className="flex items-center gap-3">
          {currentUser && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs border border-slate-200">
              <User size={13} className="text-slate-500" />
              <span>Opiekun: <strong>{currentUser.displayName || currentUser.login}</strong></span>
            </div>
          )}

          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition bg-white cursor-pointer"
            >
              Anuluj
            </button>
          ) : (
            <Link
              href="/admin/szanse"
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition bg-white inline-block"
            >
              Anuluj
            </Link>
          )}
        </div>
      </div>

      {/* Komunikat o błędzie */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between shadow-2xs">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700 font-bold ml-4 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── 3-KOLUMNOWY PANEL ROBOCZY (BEZ SCROLLOWANIA NA DESKTOPIE) ── */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        {/* ───────────────────────────────────────────────────────────── */}
        {/* KOLUMNA 1: KTO? (DANE KLIENTA)                                */}
        {/* ───────────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between h-full">
          <div className="space-y-4">
            {/* Nagłówek kolumny 1 */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
                  1
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-teal-700" />
                    Klient
                  </h2>
                  <p className="text-[11px] text-slate-500">Kto składa zapytanie</p>
                </div>
              </div>

              {/* Przełącznik trybu */}
              <div className="flex p-0.5 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setClientMode("search")}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition cursor-pointer ${
                    clientMode === "search"
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Szukaj
                </button>
                <button
                  type="button"
                  onClick={() => setClientMode("create")}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition cursor-pointer ${
                    clientMode === "create"
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  + Nowy
                </button>
              </div>
            </div>

            {/* Tryb 1: Wyszukiwanie */}
            {clientMode === "search" && (
              <div className="space-y-3">
                {selectedClientDoc ? (
                  /* Karta wybranego klienta */
                  <div className="p-3.5 rounded-xl border border-teal-200 bg-teal-50/50 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-slate-900">
                          {selectedClientDoc.clientType === "business" && selectedClientDoc.companyName
                            ? selectedClientDoc.companyName
                            : `${selectedClientDoc.firstName} ${selectedClientDoc.lastName}`}
                        </div>
                        <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold bg-teal-100 text-teal-800 mt-0.5">
                          {selectedClientDoc.clientType === "business" ? "Firma (B2B)" : "Osoba prywatna"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClientId(undefined);
                          setSearchQuery("");
                        }}
                        className="text-[11px] font-semibold text-teal-700 hover:text-teal-900 px-2 py-1 rounded-md border border-teal-200 bg-white hover:bg-teal-50 transition cursor-pointer"
                      >
                        Zmień
                      </button>
                    </div>

                    <div className="space-y-1 text-[11px] text-slate-600 pt-1 border-t border-teal-100/60">
                      {selectedClientDoc.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{selectedClientDoc.phone}</span>
                        </div>
                      )}
                      {selectedClientDoc.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{selectedClientDoc.email}</span>
                        </div>
                      )}
                      {selectedClientDoc.city && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{selectedClientDoc.city}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Wyszukiwarka */
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Wpisz nazwisko, firmę, NIP lub telefon..."
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition"
                        autoFocus
                      />
                    </div>

                    {/* Wyniki wyszukiwania */}
                    {searchQuery.trim().length >= 2 && (
                      <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-64 overflow-y-auto bg-white shadow-xs">
                        {searchResults === undefined ? (
                          <div className="p-3 text-[11px] text-slate-400 text-center">Wyszukiwanie...</div>
                        ) : searchResults.length === 0 ? (
                          <div className="p-3.5 text-[11px] text-slate-500 text-center space-y-2">
                            <div>Brak wyników w bazie.</div>
                            {/^\d{10}$/.test(searchQuery.trim().replace(/[\s-]/g, "")) ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const nipVal = searchQuery.trim().replace(/[\s-]/g, "");
                                  setClientMode("create");
                                  setClientType("business");
                                  setNewNip(nipVal);
                                  handleNipLookup(nipVal);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 text-white font-medium text-xs hover:bg-teal-700 transition cursor-pointer shadow-xs"
                              >
                                <Search className="w-3.5 h-3.5" />
                                <span>Pobierz z GUS dla NIP: {searchQuery.trim().replace(/[\s-]/g, "")}</span>
                              </button>
                            ) : (
                              <div className="text-slate-400 text-[10.5px]">
                                Przełącz na &bdquo;+ Nowy&rdquo; powyżej, aby dodać klienta.
                              </div>
                            )}
                          </div>
                        ) : (
                          searchResults.map((c) => (
                            <button
                              key={c._id}
                              type="button"
                              onClick={() => {
                                setSelectedClientId(c._id);
                                setSearchQuery("");
                              }}
                              className="w-full text-left p-2.5 hover:bg-slate-50 flex items-center justify-between text-xs transition cursor-pointer"
                            >
                              <div className="min-w-0 pr-2">
                                <div className="font-semibold text-slate-900 truncate">
                                  {c.clientType === "business" && c.companyName
                                    ? `${c.companyName} (${c.firstName} ${c.lastName})`
                                    : `${c.firstName} ${c.lastName}`}
                                </div>
                                <div className="text-slate-500 text-[10.5px]">
                                  {[c.nip ? `NIP: ${c.nip}` : null, c.phone, c.city].filter(Boolean).join(" • ")}
                                </div>
                              </div>
                              <span className="text-teal-700 font-semibold text-xs shrink-0">Wybierz →</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}

                    {/* Domyślna lista: Najczęściej wybierani */}
                    {searchQuery.trim().length < 2 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 px-0.5">
                          <span className="flex items-center gap-1.5 text-slate-700">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            Najczęściej wybierani
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">Szybki wybór</span>
                        </div>

                        {popularClients === undefined ? (
                          <div className="p-3 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                            <span>Ładowanie klientów...</span>
                          </div>
                        ) : popularClients.length === 0 ? (
                          <div className="p-3 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            Brak klientów w bazie. Wpisz dane lub kliknij &bdquo;+ Nowy&rdquo;.
                          </div>
                        ) : (
                          <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-72 overflow-y-auto bg-white shadow-xs">
                            {popularClients.map((c) => (
                              <button
                                key={c._id}
                                type="button"
                                onClick={() => {
                                  setSelectedClientId(c._id);
                                  setSearchQuery("");
                                }}
                                className="w-full text-left p-2.5 hover:bg-teal-50/50 flex items-center justify-between text-xs transition cursor-pointer group"
                              >
                                <div className="min-w-0 pr-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-slate-900 group-hover:text-teal-700 truncate">
                                      {c.clientType === "business" && c.companyName
                                        ? `${c.companyName} (${c.firstName} ${c.lastName})`
                                        : `${c.firstName} ${c.lastName}`}
                                    </span>
                                    {c.clientType === "business" && (
                                      <span className="px-1.5 py-0.2 rounded-sm bg-purple-50 text-purple-700 font-medium text-[9.5px] border border-purple-200 shrink-0">
                                        Firma
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-slate-500 text-[10.5px] truncate">
                                    {[c.phone, c.city].filter(Boolean).join(" • ") || "Brak danych kontaktowych"}
                                  </div>
                                </div>
                                <span className="text-teal-600 font-semibold text-xs shrink-0 group-hover:translate-x-0.5 transition-transform">
                                  Wybierz →
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tryb 2: Szybkie dodanie nowego klienta */}
            {clientMode === "create" && (
              <div className="space-y-3 pt-0.5">
                {/* Radio Osoba / Firma */}
                <div className="flex gap-4 text-xs font-semibold pb-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="clientType"
                      checked={clientType === "individual"}
                      onChange={() => setClientType("individual")}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <span>Osoba prywatna</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="clientType"
                      checked={clientType === "business"}
                      onChange={() => setClientType("business")}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <span>Firma (B2B)</span>
                  </label>
                </div>

                {/* Pola dla Firmy */}
                {clientType === "business" && (
                  <div className="space-y-2.5">
                    {/* Wyszukiwanie NIP w GUS */}
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="block text-[11px] font-semibold text-slate-700">
                          NIP firmy
                        </label>
                        {nipFetched && (
                          <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                            ✓ Pobrano z GUS (Biała Lista)
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={newNip}
                          onChange={(e) => {
                            setNewNip(e.target.value);
                            setNipFetched(false);
                            setNipError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleNipLookup();
                            }
                          }}
                          placeholder="np. 1234567890"
                          className={`flex-1 px-2.5 py-1.5 rounded-lg border text-xs focus:outline-hidden transition ${
                            nipError
                              ? "border-red-400 focus:border-red-500"
                              : "border-slate-300 focus:border-teal-600"
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => handleNipLookup()}
                          disabled={nipLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-600 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold disabled:opacity-60 transition cursor-pointer shrink-0 shadow-xs"
                        >
                          {nipLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Search className="w-3.5 h-3.5" />
                          )}
                          <span>{nipLoading ? "Pobieranie..." : "Pobierz z GUS"}</span>
                        </button>
                      </div>
                      {nipError && (
                        <p className="mt-1 text-[10.5px] text-red-600 leading-tight">{nipError}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                        Nazwa firmy *
                      </label>
                      <input
                        type="text"
                        value={newCompanyName}
                        onChange={(e) => setNewCompanyName(e.target.value)}
                        placeholder="np. ADK Budownictwo Sp. z o.o."
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-hidden focus:border-teal-600"
                        required
                      />
                    </div>

                    {/* Adres rejestrowy firmy (z GUS lub ręczny) */}
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                        Adres siedziby firmy
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <label className="block text-[10.5px] text-slate-600 mb-0.5">Ulica</label>
                          <input
                            type="text"
                            value={newStreet}
                            onChange={(e) => setNewStreet(e.target.value)}
                            placeholder="np. Główna"
                            className="w-full px-2 py-1 rounded-md border border-slate-300 bg-white text-xs focus:outline-hidden focus:border-teal-600"
                          />
                        </div>
                        <div>
                          <label className="block text-[10.5px] text-slate-600 mb-0.5">Nr budynku/lok.</label>
                          <input
                            type="text"
                            value={
                              newApartmentNumber
                                ? `${newBuildingNumber}/${newApartmentNumber}`
                                : newBuildingNumber
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val.includes("/")) {
                                const [b, a] = val.split("/");
                                setNewBuildingNumber(b);
                                setNewApartmentNumber(a ?? "");
                              } else {
                                setNewBuildingNumber(val);
                                setNewApartmentNumber("");
                              }
                            }}
                            placeholder="np. 10/2"
                            className="w-full px-2 py-1 rounded-md border border-slate-300 bg-white text-xs focus:outline-hidden focus:border-teal-600"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10.5px] text-slate-600 mb-0.5">Kod pocztowy</label>
                          <input
                            type="text"
                            value={newPostalCode}
                            onChange={(e) => setNewPostalCode(e.target.value)}
                            placeholder="np. 00-001"
                            className="w-full px-2 py-1 rounded-md border border-slate-300 bg-white text-xs focus:outline-hidden focus:border-teal-600"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[10.5px] text-slate-600 mb-0.5">Miejscowość</label>
                          <input
                            type="text"
                            value={newCity}
                            onChange={(e) => setNewCity(e.target.value)}
                            placeholder="np. Warszawa"
                            className="w-full px-2 py-1 rounded-md border border-slate-300 bg-white text-xs focus:outline-hidden focus:border-teal-600"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Imię i Nazwisko */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                      {clientType === "business" ? "Imię kontaktu" : "Imię *"}
                    </label>
                    <input
                      type="text"
                      value={newFirstName}
                      onChange={(e) => setNewFirstName(e.target.value)}
                      placeholder="np. Jan"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-hidden focus:border-teal-600"
                      required={clientType === "individual"}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                      {clientType === "business" ? "Nazwisko" : "Nazwisko *"}
                    </label>
                    <input
                      type="text"
                      value={newLastName}
                      onChange={(e) => setNewLastName(e.target.value)}
                      placeholder="np. Kowalski"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-hidden focus:border-teal-600"
                      required={clientType === "individual"}
                    />
                  </div>
                </div>

                {/* Telefon i Email */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                      Telefon {clientType === "business" ? "kontaktowy" : ""}
                    </label>
                    <input
                      type="tel"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="+48 600..."
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-hidden focus:border-teal-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                      Adres e-mail
                    </label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder={clientType === "business" ? "biuro@firma.pl" : "klient@domena.pl"}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-hidden focus:border-teal-600"
                    />
                  </div>
                </div>

                {/* Miejscowość dla osoby prywatnej */}
                {clientType === "individual" && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                      Miejscowość
                    </label>
                    <input
                      type="text"
                      value={newCity}
                      onChange={(e) => setNewCity(e.target.value)}
                      placeholder="np. Poznań"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-hidden focus:border-teal-600"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* KOLUMNA 2: CO? (WYBÓR USŁUG / KAFELKI)                       */}
        {/* ───────────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between h-full">
          <div className="space-y-3.5">
            {/* Nagłówek kolumny 2 */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
                  2
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-teal-700" />
                    Wybór usług *
                  </h2>
                  <p className="text-[11px] text-slate-500">Zaznacz interesujące usługi</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {selectedServices.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedServices([])}
                    className="text-[10px] text-slate-400 hover:text-slate-600 font-medium transition cursor-pointer"
                  >
                    Wyczyść
                  </button>
                )}
                {selectedServices.length > 0 ? (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                    Wybrano: {selectedServices.length}
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    Wymagane
                  </span>
                )}
              </div>
            </div>

            {/* Kompaktowa siatka kafelków usług (bez scrollowania) */}
            <div className="grid grid-cols-2 gap-2">
              {servicesList.length === 0 ? (
                <div className="col-span-2 py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  Wczytywanie listy usług...
                </div>
              ) : (
                servicesList.map((svc) => {
                  const isSelected = selectedServices.includes(svc.name);
                  const hasConfigurator =
                    svc.name.toLowerCase().includes("zadaszen") ||
                    svc.name.toLowerCase().includes("zabudow");

                  return (
                    <button
                      key={svc._id}
                      type="button"
                      onClick={() => toggleService(svc.name)}
                      className={`group px-2.5 py-2 rounded-xl border text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                        isSelected
                          ? "border-teal-600 bg-teal-50/80 text-teal-950 shadow-2xs font-semibold ring-1 ring-teal-500/30"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div
                          className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition ${
                            isSelected
                              ? "bg-teal-700 text-white"
                              : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                          }`}
                        >
                          <ServiceIcon name={svc.name} className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs truncate font-medium">
                          {svc.name}
                        </span>
                        {hasConfigurator && (
                          <span
                            title="Kalkulator wyceny"
                            className="inline-flex items-center text-teal-600 opacity-75 shrink-0"
                          >
                            <SlidersHorizontal size={10} />
                          </span>
                        )}
                      </div>

                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition ${
                          isSelected
                            ? "bg-teal-700 text-white shadow-2xs"
                            : "border border-slate-300 bg-white group-hover:border-slate-400"
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
        </div>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* KOLUMNA 3: GDZIE I JAK? (SZCZEGÓŁY + AKCJA UTWORZENIA)       */}
        {/* ───────────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between h-full space-y-5">
          <div className="space-y-4">
            {/* Nagłówek kolumny 3 */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
                  3
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-teal-700" />
                    Szczegóły zapytania
                  </h2>
                  <p className="text-[11px] text-slate-500">Źródło, montaż i notatki</p>
                </div>
              </div>
            </div>

            {/* Źródło pozyskania */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Źródło pozyskania leada
              </label>
              <select
                value={leadSource}
                onChange={(e) => setLeadSource(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-hidden focus:border-teal-600 transition"
              >
                {LEAD_SOURCE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Checkbox dedykowany adres */}
            <div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasSeparateAddress}
                  onChange={(e) => setHasSeparateAddress(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-teal-600 focus:ring-teal-500"
                />
                <span>Inny adres inwestycji (montażu)</span>
              </label>

              {/* Pola adresu inwestycji */}
              {hasSeparateAddress && (
                <div className="mt-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-teal-700" />
                    Lokalizacja montażu
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="col-span-2">
                      <input
                        type="text"
                        value={investmentStreet}
                        onChange={(e) => setInvestmentStreet(e.target.value)}
                        placeholder="Ulica"
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-[11px] bg-white focus:outline-hidden focus:border-teal-600"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={investmentBuildingNumber}
                        onChange={(e) => setInvestmentBuildingNumber(e.target.value)}
                        placeholder="Nr bud."
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-[11px] bg-white focus:outline-hidden focus:border-teal-600"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={investmentApartmentNumber}
                        onChange={(e) => setInvestmentApartmentNumber(e.target.value)}
                        placeholder="Nr lok."
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-[11px] bg-white focus:outline-hidden focus:border-teal-600"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <input
                        type="text"
                        value={investmentPostalCode}
                        onChange={(e) => setInvestmentPostalCode(e.target.value)}
                        placeholder="Kod (np. 60-001)"
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-[11px] bg-white focus:outline-hidden focus:border-teal-600"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="text"
                        value={investmentCity}
                        onChange={(e) => setInvestmentCity(e.target.value)}
                        placeholder="Miejscowość"
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-[11px] bg-white focus:outline-hidden focus:border-teal-600"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Notatki */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Notatki / Wytyczne klienta
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Preferowany termin, wymiary tarasu, uwagi z rozmowy..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:border-teal-600 transition"
              />
            </div>
          </div>

          {/* Dolny blok podsumowania i zatwierdzenia */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            {/* Pigułka podsumowania */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Klient:</span>
                <span className="font-bold text-slate-900 truncate max-w-[65%]">
                  {clientDisplayName || "Brak (uzupełnij)"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Usługi:</span>
                <span className="font-bold text-teal-700">
                  {selectedServices.length > 0 ? `${selectedServices.length} wybrane` : "0 (wybierz)"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Wycena początkowa:</span>
                <span className="font-semibold text-slate-700">0,00 zł (do wyliczenia)</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-bold text-xs shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Tworzenie szansy...</span>
                </>
              ) : (
                <>
                  <span>Utwórz szansę i przejdź do wyceny</span>
                  <ChevronRight size={15} />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
