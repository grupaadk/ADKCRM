"use client";

import { useState, useRef } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { SERVICES } from "@/convex/schema";
import AddressSearch, { type AddressData } from "@/components/AddressSearch";
import { Upload, X, Loader2, Search } from "lucide-react";

interface NewOpportunityModalProps {
  onClose: () => void;
  onSuccess: (opportunityId: string) => void;
}

type Step = "client" | "details";
type ClientMode = "search" | "create";
type ClientType = "individual" | "business";

const STEP_LABELS: Record<Step, string> = {
  client: "Klient",
  details: "Szczegóły",
};

const EMPTY_CLIENT_FORM = {
  clientType: "individual" as ClientType,
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  nip: "",
  postalCode: "",
  city: "",
  street: "",
  buildingNumber: "",
  apartmentNumber: "",
  companyName: "",
};

export default function NewOpportunityModal({ onClose, onSuccess }: NewOpportunityModalProps) {
  const create = useMutation(api.salesOpportunities.createManualOpportunity);
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const createClient = useMutation(api.clients.create);
  const lookupNip = useAction(api.whitelist.lookupNip);

  // ─── Step & client state ───────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("client");
  const [clientMode, setClientMode] = useState<ClientMode>("search");
  const [clientForm, setClientForm] = useState(EMPTY_CLIENT_FORM);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [nipLoading, setNipLoading] = useState(false);
  const [nipFetched, setNipFetched] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [resolvedClientId, setResolvedClientId] = useState<Id<"clients"> | undefined>();
  const [resolvedClientName, setResolvedClientName] = useState<string>("");
  const [resolvedContact, setResolvedContact] = useState({ firstName: "", lastName: "", email: "", phone: "" });

  // ─── Details state ─────────────────────────────────────────────────────────
  const [investmentStreet, setInvestmentStreet] = useState("");
  const [investmentBuildingNumber, setInvestmentBuildingNumber] = useState("");
  const [investmentApartmentNumber, setInvestmentApartmentNumber] = useState("");
  const [investmentPostalCode, setInvestmentPostalCode] = useState("");
  const [investmentCity, setInvestmentCity] = useState("");

  const resolvedClient = useQuery(
    api.clients.getById,
    resolvedClientId ? { clientId: resolvedClientId } : "skip",
  );
  const [services, setServices] = useState<string[]>([]);
  const [customText, setCustomText] = useState("");
  const [comment, setComment] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; storageId: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Queries ───────────────────────────────────────────────────────────────
  const searchResults = useQuery(
    api.clients.search,
    searchQuery.trim().length >= 1 ? { searchTerm: searchQuery.trim() } : "skip",
  );
  const recentClients = useQuery(api.clients.list, searchQuery.trim().length < 1 ? {} : "skip");
  const searchItems = searchQuery.trim().length >= 1 ? searchResults : recentClients?.page;

  const allSteps: Step[] = ["client", "details"];
  const stepIndex = allSteps.indexOf(step);
  const isBusy = submitting || creatingClient || nipLoading || uploading;

  // ─── Client handlers ───────────────────────────────────────────────────────
  function handleSelectClient(c: { _id: Id<"clients">; firstName: string; lastName: string; companyName?: string; email?: string; phone?: string }) {
    setResolvedClientId(c._id);
    const name = c.companyName ?? `${c.firstName} ${c.lastName}`;
    setResolvedClientName(name);
    const lastName = c.lastName || c.companyName || "";
    setResolvedContact({ firstName: c.firstName, lastName, email: c.email ?? "", phone: c.phone ?? "" });
    setError(null);
    setStep("details");
  }

  function handleClientFormChange(field: keyof typeof clientForm, value: string) {
    setClientForm((prev) => ({ ...prev, [field]: value }));
    if (clientErrors[field]) {
      setClientErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
    }
  }

  function handleClientTypeChange(type: ClientType) {
    setClientForm({ ...EMPTY_CLIENT_FORM, clientType: type });
    setClientErrors({});
    setNipFetched(false);
  }

  function handleClientAddressSelect(address: AddressData) {
    setClientForm((prev) => ({
      ...prev,
      street: address.street ?? prev.street,
      buildingNumber: address.buildingNumber ?? prev.buildingNumber,
      city: address.city ?? prev.city,
      postalCode: address.postalCode ?? prev.postalCode,
    }));
  }

  async function handleNipLookup() {
    const nip = clientForm.nip.trim();
    if (!nip) { setClientErrors((prev) => ({ ...prev, nip: "Podaj NIP" })); return; }
    setNipLoading(true);
    setClientErrors((prev) => { const n = { ...prev }; delete n.nip; return n; });
    try {
      const data = await lookupNip({ nip });
      setClientForm((prev) => ({
        ...prev,
        companyName: data.companyName,
        street: data.street,
        buildingNumber: data.buildingNumber,
        apartmentNumber: data.apartmentNumber ?? "",
        postalCode: data.postalCode,
        city: data.city,
      }));
      setNipFetched(true);
    } catch (err) {
      setClientErrors((prev) => ({ ...prev, nip: err instanceof Error ? err.message : "Błąd pobierania danych" }));
    } finally {
      setNipLoading(false);
    }
  }

  function validateClientForm(): boolean {
    const newErrors: Record<string, string> = {};
    if (clientForm.clientType === "individual") {
      if (!clientForm.firstName.trim()) newErrors.firstName = "Imię jest wymagane";
      if (!clientForm.lastName.trim()) newErrors.lastName = "Nazwisko jest wymagane";
    } else {
      if (!clientForm.companyName.trim()) newErrors.companyName = "Pobierz dane firmy lub wpisz nazwę";
      if (!clientForm.firstName.trim()) newErrors.firstName = "Imię osoby kontaktowej jest wymagane";
      if (!clientForm.lastName.trim()) newErrors.lastName = "Nazwisko osoby kontaktowej jest wymagane";
    }
    setClientErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleCreateAndContinue() {
    if (!validateClientForm()) return;
    setCreatingClient(true);
    try {
      const clientId = await createClient({
        clientType: clientForm.clientType,
        firstName: clientForm.firstName.trim(),
        lastName: clientForm.lastName.trim(),
        email: clientForm.email.trim() || undefined,
        phone: clientForm.phone.trim() || undefined,
        nip: clientForm.nip.trim() || undefined,
        companyName: clientForm.clientType === "business" ? clientForm.companyName.trim() || undefined : undefined,
        postalCode: clientForm.postalCode.trim() || undefined,
        city: clientForm.city.trim() || undefined,
        street: clientForm.street.trim() || undefined,
        buildingNumber: clientForm.buildingNumber.trim() || undefined,
        apartmentNumber: clientForm.apartmentNumber.trim() || undefined,
      });
      const name =
        clientForm.clientType === "business" && clientForm.companyName
          ? clientForm.companyName
          : `${clientForm.firstName} ${clientForm.lastName}`;
      setResolvedClientId(clientId);
      setResolvedClientName(name);
      setResolvedContact({
        firstName: clientForm.firstName.trim(),
        lastName: clientForm.lastName.trim(),
        email: clientForm.email.trim(),
        phone: clientForm.phone.trim(),
      });
      setStep("details");
    } catch {
      setClientErrors({ _form: "Wystąpił błąd podczas dodawania klienta." });
    } finally {
      setCreatingClient(false);
    }
  }

  // ─── Details handlers ──────────────────────────────────────────────────────
  function toggleService(s: string) {
    setServices((prev) => prev.includes(s) ? prev.filter((v) => v !== s) : [...prev, s]);
  }

  function handleInvestmentAddressSelect(a: AddressData) {
    if (a.street) setInvestmentStreet(a.street);
    if (a.buildingNumber) setInvestmentBuildingNumber(a.buildingNumber);
    if (a.postalCode) setInvestmentPostalCode(a.postalCode);
    if (a.city) setInvestmentCity(a.city);
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of files) {
        const uploadUrl = await generateUploadUrl();
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`);
        const { storageId } = await response.json();
        if (!storageId) throw new Error("No storageId returned");
        setUploadedFiles((prev) => [...prev, { name: file.name, storageId }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się wgrać pliku");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeUploadedFile(storageId: string) {
    setUploadedFiles((prev) => prev.filter((f) => f.storageId !== storageId));
  }

  async function handleSubmit() {
    if (!resolvedContact.firstName && !resolvedContact.lastName) {
      setError("Brak danych klienta.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const id = await create({
        clientId: resolvedClientId,
        firstName: resolvedContact.firstName,
        lastName: resolvedContact.lastName,
        email: resolvedContact.email || undefined,
        phone: resolvedContact.phone || undefined,
        investmentStreet: investmentStreet.trim() || undefined,
        investmentBuildingNumber: investmentBuildingNumber.trim() || undefined,
        investmentApartmentNumber: investmentApartmentNumber.trim() || undefined,
        investmentPostalCode: investmentPostalCode.trim() || undefined,
        investmentCity: investmentCity.trim() || undefined,
        services: services.length > 0 ? services : undefined,
        customText: customText.trim() || undefined,
        comment: comment.trim() || undefined,
        uploadedFileIds: uploadedFiles.length > 0 ? uploadedFiles.map((f) => f.storageId as any) : undefined,
      });
      onSuccess(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wystąpił błąd.");
      setSubmitting(false);
    }
  }

  const fieldCls = (field: string, forceDisabled = false) =>
    forceDisabled
      ? "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
      : `w-full rounded-lg border px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 ${
          clientErrors[field] ? "border-red-400 focus:ring-red-400" : "border-slate-200"
        }`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        onClick={() => { if (!isBusy) onClose(); }}
      />

      <div
        className="relative flex w-full flex-col bg-white shadow-2xl sm:mx-4 sm:max-w-2xl lg:max-w-3xl rounded-t-2xl sm:rounded-2xl"
        style={{ maxHeight: "95dvh" }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-slate-100 px-5 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-slate-900">Nowa szansa sprzedaży</h2>
              {resolvedClientName && step !== "client" && (
                <p className="truncate text-xs text-slate-400 mt-0.5">{resolvedClientName}</p>
              )}
            </div>

            {/* Step progress dots */}
            <div className="flex shrink-0 items-center gap-1">
              {allSteps.map((s, i) => (
                <div key={s} className="flex items-center gap-1">
                  <div
                    title={STEP_LABELS[s]}
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                      i < stepIndex
                        ? "bg-blue-600 text-white"
                        : i === stepIndex
                          ? "bg-blue-50 text-blue-700 ring-2 ring-blue-500 ring-offset-1"
                          : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {i < stepIndex ? (
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  {i < allSteps.length - 1 && (
                    <div className={`h-px w-4 rounded-full transition-colors ${i < stepIndex ? "bg-blue-500" : "bg-slate-200"}`} />
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => { if (!isBusy) onClose(); }}
              disabled={isBusy}
              className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            {STEP_LABELS[step]}
          </p>

          {/* ── Krok: Klient ─────────────────────────────────────────────── */}
          {step === "client" && (
            <div className="space-y-4">
              <div className="flex rounded-xl bg-slate-100 p-1 gap-1">
                {([
                  { mode: "search" as ClientMode, label: "Wybierz istniejącego" },
                  { mode: "create" as ClientMode, label: "Dodaj nowego klienta" },
                ] as const).map(({ mode, label }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setClientMode(mode)}
                    className={`flex-1 rounded-lg py-2 px-3 text-sm font-medium transition-all ${
                      clientMode === mode
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* ── Search mode ── */}
              {clientMode === "search" && (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Wpisz nazwisko lub nazwę firmy..."
                    autoFocus
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  />
                  <div className="max-h-72 space-y-1.5 overflow-y-auto">
                    {searchItems === undefined && (
                      <p className="py-2 text-xs text-slate-400">Ładowanie...</p>
                    )}
                    {searchItems?.length === 0 && (
                      <p className="py-2 text-xs text-slate-400">Brak wyników. Spróbuj dodać nowego klienta.</p>
                    )}
                    {searchItems?.map((c) => (
                      <button
                        key={c._id}
                        type="button"
                        onClick={() => handleSelectClient(c)}
                        className="group w-full rounded-xl border border-slate-200 px-4 py-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800 group-hover:text-blue-800">
                              {c.companyName ?? `${c.lastName} ${c.firstName}`}
                            </p>
                            {c.companyName && (
                              <p className="truncate text-xs text-slate-400">
                                {c.lastName} {c.firstName}
                              </p>
                            )}
                          </div>
                          {c.city && (
                            <span className="shrink-0 text-xs text-slate-400">{c.city}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                  {error && <p className="text-xs font-medium text-red-600">{error}</p>}
                </div>
              )}

              {/* ── Create mode ── */}
              {clientMode === "create" && (
                <div className="space-y-5">
                  {clientErrors._form && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {clientErrors._form}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {(["individual", "business"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleClientTypeChange(type)}
                        className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                          clientForm.clientType === type
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {type === "individual" ? "Indywidualny" : "Biznesowy"}
                      </button>
                    ))}
                  </div>

                  {/* ── Business form ── */}
                  {clientForm.clientType === "business" && (
                    <>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                          NIP <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={clientForm.nip}
                            onChange={(e) => handleClientFormChange("nip", e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleNipLookup())}
                            className={`flex-1 rounded-lg border px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 ${clientErrors.nip ? "border-red-400" : "border-slate-200"}`}
                            placeholder="np. 1234567890"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={handleNipLookup}
                            disabled={nipLoading}
                            className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
                          >
                            {nipLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                            {nipLoading ? "Pobieranie…" : "Pobierz z GUS"}
                          </button>
                        </div>
                        {clientErrors.nip && <p className="mt-1 text-xs text-red-600">{clientErrors.nip}</p>}
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                          Nazwa firmy <span className="text-red-500">*</span>
                          {nipFetched && <span className="ml-2 text-xs font-normal text-emerald-600">— pobrano z GUS</span>}
                        </label>
                        <input
                          type="text"
                          value={clientForm.companyName}
                          onChange={(e) => handleClientFormChange("companyName", e.target.value)}
                          className={nipFetched ? fieldCls("companyName") : fieldCls("companyName", true)}
                          readOnly={!nipFetched}
                          placeholder={nipFetched ? "Nazwa firmy" : "Pobierz dane NIP aby wypełnić"}
                        />
                        {clientErrors.companyName && <p className="mt-1 text-xs text-red-600">{clientErrors.companyName}</p>}
                      </div>

                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Adres firmy
                          {!nipFetched && <span className="ml-1 font-normal normal-case text-slate-400">(wypełni się po pobraniu danych)</span>}
                        </p>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="col-span-2">
                            <label className="mb-1 block text-xs text-slate-500">Ulica</label>
                            <input type="text" value={clientForm.street} onChange={(e) => handleClientFormChange("street", e.target.value)} className={nipFetched ? fieldCls("street") : fieldCls("street", true)} readOnly={!nipFetched} placeholder="Ulica" />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-slate-500">Nr budynku</label>
                            <input type="text" value={clientForm.buildingNumber} onChange={(e) => handleClientFormChange("buildingNumber", e.target.value)} className={nipFetched ? fieldCls("buildingNumber") : fieldCls("buildingNumber", true)} readOnly={!nipFetched} placeholder="Nr" />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-slate-500">Nr lokalu</label>
                            <input type="text" value={clientForm.apartmentNumber} onChange={(e) => handleClientFormChange("apartmentNumber", e.target.value)} className={nipFetched ? fieldCls("apartmentNumber") : fieldCls("apartmentNumber", true)} readOnly={!nipFetched} placeholder="Opcjonalnie" />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-slate-500">Kod pocztowy</label>
                            <input type="text" value={clientForm.postalCode} onChange={(e) => handleClientFormChange("postalCode", e.target.value)} className={nipFetched ? fieldCls("postalCode") : fieldCls("postalCode", true)} readOnly={!nipFetched} placeholder="00-000" />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-slate-500">Miejscowość</label>
                            <input type="text" value={clientForm.city} onChange={(e) => handleClientFormChange("city", e.target.value)} className={nipFetched ? fieldCls("city") : fieldCls("city", true)} readOnly={!nipFetched} placeholder="Miejscowość" />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">Telefon</label>
                          <input type="tel" value={clientForm.phone} onChange={(e) => handleClientFormChange("phone", e.target.value)} className={fieldCls("phone")} placeholder="123 456 789" />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
                          <input type="email" value={clientForm.email} onChange={(e) => handleClientFormChange("email", e.target.value)} className={fieldCls("email")} placeholder="firma@example.com" />
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Osoba kontaktowa / decyzyjna</p>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="mb-1 block text-xs text-slate-500">Imię <span className="text-red-500">*</span></label>
                            <input type="text" value={clientForm.firstName} onChange={(e) => handleClientFormChange("firstName", e.target.value)} className={fieldCls("firstName")} placeholder="np. Anna" />
                            {clientErrors.firstName && <p className="mt-1 text-xs text-red-600">{clientErrors.firstName}</p>}
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-slate-500">Nazwisko <span className="text-red-500">*</span></label>
                            <input type="text" value={clientForm.lastName} onChange={(e) => handleClientFormChange("lastName", e.target.value)} className={fieldCls("lastName")} placeholder="np. Kowalska" />
                            {clientErrors.lastName && <p className="mt-1 text-xs text-red-600">{clientErrors.lastName}</p>}
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── Individual form ── */}
                  {clientForm.clientType === "individual" && (
                    <>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">Imię <span className="text-red-500">*</span></label>
                          <input type="text" value={clientForm.firstName} onChange={(e) => handleClientFormChange("firstName", e.target.value)} className={fieldCls("firstName")} placeholder="np. Jan" autoFocus />
                          {clientErrors.firstName && <p className="mt-1 text-xs text-red-600">{clientErrors.firstName}</p>}
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">Nazwisko <span className="text-red-500">*</span></label>
                          <input type="text" value={clientForm.lastName} onChange={(e) => handleClientFormChange("lastName", e.target.value)} className={fieldCls("lastName")} placeholder="np. Kowalski" />
                          {clientErrors.lastName && <p className="mt-1 text-xs text-red-600">{clientErrors.lastName}</p>}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">Telefon</label>
                          <input type="tel" value={clientForm.phone} onChange={(e) => handleClientFormChange("phone", e.target.value)} className={fieldCls("phone")} placeholder="123 456 789" />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
                          <input type="email" value={clientForm.email} onChange={(e) => handleClientFormChange("email", e.target.value)} className={fieldCls("email")} placeholder="jan@example.com" />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Wyszukaj adres</label>
                        <AddressSearch onSelect={handleClientAddressSelect} />
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="mb-1 block text-xs text-slate-500">Kod pocztowy</label>
                          <input type="text" value={clientForm.postalCode} onChange={(e) => handleClientFormChange("postalCode", e.target.value)} className={fieldCls("postalCode")} placeholder="00-000" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-500">Miejscowość</label>
                          <input type="text" value={clientForm.city} onChange={(e) => handleClientFormChange("city", e.target.value)} className={fieldCls("city")} placeholder="np. Kraków" />
                        </div>
                        <div className="col-span-2">
                          <label className="mb-1 block text-xs text-slate-500">Ulica</label>
                          <input type="text" value={clientForm.street} onChange={(e) => handleClientFormChange("street", e.target.value)} className={fieldCls("street")} placeholder="np. ul. Lipowa" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-500">Nr budynku</label>
                          <input type="text" value={clientForm.buildingNumber} onChange={(e) => handleClientFormChange("buildingNumber", e.target.value)} className={fieldCls("buildingNumber")} placeholder="12" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-500">Nr mieszkania</label>
                          <input type="text" value={clientForm.apartmentNumber} onChange={(e) => handleClientFormChange("apartmentNumber", e.target.value)} className={fieldCls("apartmentNumber")} placeholder="4 (opcjonalnie)" />
                        </div>
                      </div>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={handleCreateAndContinue}
                    disabled={creatingClient}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
                  >
                    {creatingClient && <Loader2 size={14} className="animate-spin" />}
                    {creatingClient ? "Tworzenie klienta..." : "Utwórz klienta i przejdź dalej →"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Krok: Szczegóły ───────────────────────────────────────────── */}
          {step === "details" && (
            <div className="space-y-5">
              {/* Adres klienta — read-only */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Adres klienta</p>
                {resolvedClient === undefined ? (
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                    <Loader2 size={14} className="animate-spin text-slate-400" />
                    <span className="text-sm text-slate-400">Ładowanie…</span>
                  </div>
                ) : resolvedClient && (resolvedClient.street || resolvedClient.city || resolvedClient.postalCode) ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 space-y-0.5">
                    {resolvedClient.street && (
                      <p>{resolvedClient.street}{resolvedClient.buildingNumber ? ` ${resolvedClient.buildingNumber}` : ""}{resolvedClient.apartmentNumber ? `/${resolvedClient.apartmentNumber}` : ""}</p>
                    )}
                    {(resolvedClient.postalCode || resolvedClient.city) && (
                      <p>{[resolvedClient.postalCode, resolvedClient.city].filter(Boolean).join(" ")}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">Brak adresu klienta</p>
                )}
              </div>

              {/* Adres inwestycji */}
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Adres inwestycji</p>
                  <p className="mt-0.5 text-xs text-slate-400">Lokalizacja montażu (opcjonalnie, jeśli różni się od adresu klienta)</p>
                </div>
                <AddressSearch onSelect={handleInvestmentAddressSelect} />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Kod pocztowy</label>
                    <input type="text" value={investmentPostalCode} onChange={(e) => setInvestmentPostalCode(e.target.value)} placeholder="00-000" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Miejscowość</label>
                    <input type="text" value={investmentCity} onChange={(e) => setInvestmentCity(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Ulica</label>
                    <input type="text" value={investmentStreet} onChange={(e) => setInvestmentStreet(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Nr budynku</label>
                      <input type="text" value={investmentBuildingNumber} onChange={(e) => setInvestmentBuildingNumber(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Nr mieszkania</label>
                      <input type="text" value={investmentApartmentNumber} onChange={(e) => setInvestmentApartmentNumber(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Usługi (opcjonalnie)</p>
                <div className="flex flex-wrap gap-1.5">
                  {SERVICES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleService(s)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        services.includes(s)
                          ? "border-blue-500 bg-blue-600 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Pliki do wgrania</label>
                {uploadedFiles.length > 0 && (
                  <div className="space-y-1.5">
                    {uploadedFiles.map((f) => (
                      <div key={f.storageId} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <span className="truncate text-sm text-slate-700">{f.name}</span>
                        <button type="button" onClick={() => removeUploadedFile(f.storageId)} disabled={uploading} className="ml-2 shrink-0 text-slate-400 hover:text-slate-600 disabled:opacity-50">
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 px-3 py-4 text-slate-600 transition-colors hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50"
                >
                  <Upload size={16} />
                  <span className="text-sm font-medium">{uploading ? "Wgrywanie..." : "Kliknij aby dodać pliki"}</span>
                </button>
                <input ref={fileInputRef} type="file" multiple onChange={handleFileUpload} disabled={uploading || submitting} className="hidden" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">Tekst własny</label>
                <input
                  type="text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="np. Kowalski – okna salonu"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                />
                <p className="text-xs text-slate-400">Dodatkowy identyfikator widoczny na karcie kanban</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Komentarz</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="Dodatkowe informacje..."
                  className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                />
              </div>

              {error && <p className="text-xs font-medium text-red-600">{error}</p>}
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        {step !== "client" && (
          <div className="shrink-0 border-t border-slate-100 px-5 sm:px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => { setError(null); setStep("client"); }}
                disabled={submitting}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                ← Wstecz
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || uploading}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {submitting ? "Tworzenie..." : "Utwórz szansę"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
