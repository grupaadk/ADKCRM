"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import AddressSearch, { type AddressData } from "@/components/AddressSearch";
import { Upload, X, Loader2, Search, ArrowLeft, CheckCircle2, User, Building2, MapPin, Briefcase, FileText, Sparkles } from "lucide-react";

interface NewOpportunityFormProps {
  initialClientId?: Id<"clients">;
  onSuccess?: (opportunityId: string) => void;
  onCancel?: () => void;
}

type Step = "client" | "details";
type ClientMode = "search" | "create";
type ClientType = "individual" | "business";

const STEP_LABELS: Record<Step, string> = {
  client: "1. Klient",
  details: "2. Szczegóły leada",
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

export default function NewOpportunityForm({ initialClientId, onSuccess, onCancel }: NewOpportunityFormProps) {
  const router = useRouter();
  const createOpportunity = useMutation(api.salesOpportunities.createManualOpportunity);
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const createClient = useMutation(api.clients.create);
  const lookupNip = useAction(api.whitelist.lookupNip);

  // Fetch initial client if initialClientId is provided
  const initialClientDoc = useQuery(
    api.clients.getById,
    initialClientId ? { clientId: initialClientId } : "skip"
  );

  // ─── Step & Client state ───────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(initialClientId ? "details" : "client");
  const [clientMode, setClientMode] = useState<ClientMode>("search");
  const [clientForm, setClientForm] = useState(EMPTY_CLIENT_FORM);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [nipLoading, setNipLoading] = useState(false);
  const [nipFetched, setNipFetched] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [resolvedClientId, setResolvedClientId] = useState<Id<"clients"> | undefined>(initialClientId);
  const [resolvedClientName, setResolvedClientName] = useState<string>("");
  const [resolvedContact, setResolvedContact] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  // Populate resolved client when initialClientDoc changes
  useEffect(() => {
    if (initialClientDoc) {
      setResolvedClientId(initialClientDoc._id);
      const name = initialClientDoc.clientType === "business" && initialClientDoc.companyName
        ? initialClientDoc.companyName
        : `${initialClientDoc.firstName} ${initialClientDoc.lastName}`;
      setResolvedClientName(name);
      setResolvedContact({
        firstName: initialClientDoc.firstName,
        lastName: initialClientDoc.lastName || initialClientDoc.companyName || "",
        email: initialClientDoc.email ?? "",
        phone: initialClientDoc.phone ?? "",
      });
      setStep("details");
    }
  }, [initialClientDoc]);

  // ─── Details state ─────────────────────────────────────────────────────────
  const [investmentStreet, setInvestmentStreet] = useState("");
  const [investmentBuildingNumber, setInvestmentBuildingNumber] = useState("");
  const [investmentApartmentNumber, setInvestmentApartmentNumber] = useState("");
  const [investmentPostalCode, setInvestmentPostalCode] = useState("");
  const [investmentCity, setInvestmentCity] = useState("");

  const resolvedClient = useQuery(
    api.clients.getById,
    resolvedClientId ? { clientId: resolvedClientId } : "skip"
  );
  const [services, setServices] = useState<string[]>([]);
  const [customText, setCustomText] = useState("");
  const [leadSource, setLeadSource] = useState("");
  const [comment, setComment] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; storageId: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Queries ───────────────────────────────────────────────────────────────
  const searchResults = useQuery(
    api.clients.search,
    searchQuery.trim().length >= 1 ? { searchTerm: searchQuery.trim() } : "skip"
  );
  const recentClients = useQuery(api.clients.list, searchQuery.trim().length < 1 ? {} : "skip");
  const searchItems = searchQuery.trim().length >= 1 ? searchResults : recentClients?.page;
  const servicesList = useQuery(api.services.list, {}) ?? [];

  // ─── Client Handlers ───────────────────────────────────────────────────────
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
      setClientErrors((prev) => ({ ...prev, nip: err instanceof Error ? err.message : "Błąd pobierania danych z GUS" }));
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
      if (!clientForm.companyName.trim()) newErrors.companyName = "Nazwa firmy jest wymagana";
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

  // ─── Details Handlers ──────────────────────────────────────────────────────
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
      const opportunityId = await createOpportunity({
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
        leadSource: leadSource.trim() || undefined,
        comment: comment.trim() || undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        uploadedFileIds: uploadedFiles.length > 0 ? uploadedFiles.map((f) => f.storageId as any) : undefined,
      });

      if (onSuccess) {
        onSuccess(opportunityId);
      } else {
        router.push(`/admin/szansa/${opportunityId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wystąpił błąd podczas tworzenia szansy.");
      setSubmitting(false);
    }
  }

  const fieldCls = (field: string, forceDisabled = false) =>
    forceDisabled
      ? "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-400 cursor-not-allowed"
      : `w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
          clientErrors[field] ? "border-red-400 focus:ring-red-400 bg-red-50/20" : "border-slate-200"
        }`;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* ── Top Header / Back Navigation ──────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (onCancel) onCancel();
              else if (initialClientId) router.push(`/admin/klient/${initialClientId}`);
              else router.push("/admin/panel");
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 shadow-2xs"
          >
            <ArrowLeft className="h-4 w-4" />
            Powrót
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Nowa szansa sprzedaży</h1>
            {resolvedClientName && (
              <p className="text-xs font-medium text-slate-500 mt-0.5">
                Klient: <span className="text-slate-900 font-semibold">{resolvedClientName}</span>
              </p>
            )}
          </div>
        </div>

        {/* Wizard Stepper Pills */}
        <div className="hidden sm:flex items-center gap-2 rounded-2xl bg-white border border-slate-200 p-1.5 shadow-2xs">
          {(["client", "details"] as Step[]).map((s, idx) => {
            const isActive = step === s;
            const isDone = idx < (step === "details" ? 1 : 0);
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  if (s === "client" && !initialClientId) setStep("client");
                }}
                disabled={s === "client" && !!initialClientId}
                className={`flex items-center gap-2 rounded-xl px-4 py-1.5 text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-slate-900 text-white shadow-xs"
                    : isDone
                      ? "text-blue-700 bg-blue-50 hover:bg-blue-100/70"
                      : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                ) : (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
                    {idx + 1}
                  </span>
                )}
                <span>{STEP_LABELS[s]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main Form Card Container ────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
        {/* ── KROK 1: Wybór lub Tworzenie Klienta ─────────────────────────── */}
        {step === "client" && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Krok 1: Wybierz klienta lub utwórz nowego
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Przypisz tę szansę sprzedaży do istniejącego klienta lub dodaj nowy rekord.
              </p>
            </div>

            <div className="flex rounded-xl bg-slate-100 p-1.5 gap-1.5 max-w-md">
              {([
                { mode: "search" as ClientMode, label: "Wybierz istniejącego", icon: Search },
                { mode: "create" as ClientMode, label: "Dodaj nowego klienta", icon: User },
              ] as const).map(({ mode, label, icon: Icon }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setClientMode(mode)}
                  className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg py-2.5 px-3 text-xs font-semibold transition-all ${
                    clientMode === mode
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* ── Search mode ── */}
            {clientMode === "search" && (
              <div className="space-y-4 max-w-2xl">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    Wyszukaj klienta w bazie
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Wpisz imię, nazwisko, nazwę firmy, miejscowość lub telefon..."
                      autoFocus
                      className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {searchItems === undefined && (
                    <div className="flex items-center gap-2 py-4 text-xs text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      Wyszukiwanie klientów…
                    </div>
                  )}
                  {searchItems?.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                      Nie znaleziono klienta. Możesz przełączyć powyżej na &quot;Dodaj nowego klienta&quot;.
                    </div>
                  )}
                  {searchItems?.map((c) => (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => handleSelectClient(c)}
                      className="group w-full rounded-xl border border-slate-200 p-4 text-left transition-all hover:border-blue-400 hover:bg-blue-50/50 hover:shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-blue-900">
                            {c.companyName ?? `${c.lastName} ${c.firstName}`}
                          </p>
                          {c.companyName && (
                            <p className="truncate text-xs text-slate-500 mt-0.5">
                              {c.firstName} {c.lastName}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                            {c.phone && <span>📞 {c.phone}</span>}
                            {c.email && <span className="truncate">✉️ {c.email}</span>}
                          </div>
                        </div>
                        {c.city && (
                          <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                            📍 {c.city}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                {error && <p className="text-xs font-medium text-red-600 bg-red-50 p-3 rounded-xl border border-red-200">{error}</p>}
              </div>
            )}

            {/* ── Create mode ── */}
            {clientMode === "create" && (
              <div className="space-y-6 max-w-2xl">
                {clientErrors._form && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {clientErrors._form}
                  </div>
                )}

                <div className="flex gap-3">
                  {(["individual", "business"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleClientTypeChange(type)}
                      className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl border py-3 text-xs font-bold transition-all ${
                        clientForm.clientType === type
                          ? "border-slate-900 bg-slate-900 text-white shadow-xs"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {type === "individual" ? <User className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                      {type === "individual" ? "Klient Indywidualny" : "Klient Biznesowy"}
                    </button>
                  ))}
                </div>

                {/* ── Business Form ── */}
                {clientForm.clientType === "business" && (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        NIP <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={clientForm.nip}
                          onChange={(e) => handleClientFormChange("nip", e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleNipLookup())}
                          className={`flex-1 rounded-xl border px-3.5 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${clientErrors.nip ? "border-red-400 bg-red-50/20" : "border-slate-200"}`}
                          placeholder="np. 1234567890"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleNipLookup}
                          disabled={nipLoading}
                          className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
                        >
                          {nipLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                          {nipLoading ? "Pobieranie…" : "Pobierz z GUS"}
                        </button>
                      </div>
                      {clientErrors.nip && <p className="mt-1 text-xs text-red-600">{clientErrors.nip}</p>}
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Nazwa firmy <span className="text-red-500">*</span>
                        {nipFetched && <span className="ml-2 text-xs font-normal text-emerald-600">— pobrano z GUS</span>}
                      </label>
                      <input
                        type="text"
                        value={clientForm.companyName}
                        onChange={(e) => handleClientFormChange("companyName", e.target.value)}
                        className={fieldCls("companyName")}
                        placeholder="Nazwa firmy"
                      />
                      {clientErrors.companyName && <p className="mt-1 text-xs text-red-600">{clientErrors.companyName}</p>}
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                        Adres firmy
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="mb-1 block text-xs text-slate-500">Ulica</label>
                          <input type="text" value={clientForm.street} onChange={(e) => handleClientFormChange("street", e.target.value)} className={fieldCls("street")} placeholder="Ulica" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-500">Nr budynku</label>
                          <input type="text" value={clientForm.buildingNumber} onChange={(e) => handleClientFormChange("buildingNumber", e.target.value)} className={fieldCls("buildingNumber")} placeholder="Nr" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-500">Nr lokalu</label>
                          <input type="text" value={clientForm.apartmentNumber} onChange={(e) => handleClientFormChange("apartmentNumber", e.target.value)} className={fieldCls("apartmentNumber")} placeholder="Opcjonalnie" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-500">Kod pocztowy</label>
                          <input type="text" value={clientForm.postalCode} onChange={(e) => handleClientFormChange("postalCode", e.target.value)} className={fieldCls("postalCode")} placeholder="00-000" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-500">Miejscowość</label>
                          <input type="text" value={clientForm.city} onChange={(e) => handleClientFormChange("city", e.target.value)} className={fieldCls("city")} placeholder="Miejscowość" />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700">Telefon</label>
                        <input type="tel" value={clientForm.phone} onChange={(e) => handleClientFormChange("phone", e.target.value)} className={fieldCls("phone")} placeholder="123 456 789" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700">Email</label>
                        <input type="email" value={clientForm.email} onChange={(e) => handleClientFormChange("email", e.target.value)} className={fieldCls("email")} placeholder="firma@example.com" />
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Osoba kontaktowa / decyzyjna</p>
                      <div className="grid grid-cols-2 gap-3">
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
                  </div>
                )}

                {/* ── Individual Form ── */}
                {clientForm.clientType === "individual" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700">Imię <span className="text-red-500">*</span></label>
                        <input type="text" value={clientForm.firstName} onChange={(e) => handleClientFormChange("firstName", e.target.value)} className={fieldCls("firstName")} placeholder="np. Jan" autoFocus />
                        {clientErrors.firstName && <p className="mt-1 text-xs text-red-600">{clientErrors.firstName}</p>}
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700">Nazwisko <span className="text-red-500">*</span></label>
                        <input type="text" value={clientForm.lastName} onChange={(e) => handleClientFormChange("lastName", e.target.value)} className={fieldCls("lastName")} placeholder="np. Kowalski" />
                        {clientErrors.lastName && <p className="mt-1 text-xs text-red-600">{clientErrors.lastName}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700">Telefon</label>
                        <input type="tel" value={clientForm.phone} onChange={(e) => handleClientFormChange("phone", e.target.value)} className={fieldCls("phone")} placeholder="123 456 789" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700">Email</label>
                        <input type="email" value={clientForm.email} onChange={(e) => handleClientFormChange("email", e.target.value)} className={fieldCls("email")} placeholder="jan@example.com" />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">Wyszukaj adres klienta</label>
                      <AddressSearch onSelect={handleClientAddressSelect} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
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
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCreateAndContinue}
                  disabled={creatingClient}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800 disabled:opacity-60 shadow-xs"
                >
                  {creatingClient && <Loader2 className="h-4 w-4 animate-spin" />}
                  {creatingClient ? "Tworzenie klienta..." : "Utwórz klienta i przejdź do szczegółów →"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── KROK 2: Szczegóły Szansy i Inwestycji ────────────────────────── */}
        {step === "details" && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Krok 2: Szczegóły leada i lokalizacja inwestycji
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Wprowadź szczegóły leada, zamawiane usługi, pliki oraz adres inwestycji.
              </p>
            </div>

            {/* Podsumowanie Klienta */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-sm">
                  {resolvedClientName ? resolvedClientName.charAt(0).toUpperCase() : "K"}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{resolvedClientName || "Wybrany klient"}</h3>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-0.5">
                    {resolvedContact.phone && <span>📞 {resolvedContact.phone}</span>}
                    {resolvedContact.email && <span>✉️ {resolvedContact.email}</span>}
                  </div>
                </div>
              </div>
              {!initialClientId && (
                <button
                  type="button"
                  onClick={() => setStep("client")}
                  className="self-start sm:self-auto text-xs font-semibold text-blue-700 hover:text-blue-900 bg-white px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors"
                >
                  Zmień klienta
                </button>
              )}
            </div>

            {/* Adres klienta z bazy */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Adres rejestrowy klienta
              </label>
              {resolvedClient === undefined ? (
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Ładowanie adresu…
                </div>
              ) : resolvedClient && (resolvedClient.street || resolvedClient.city || resolvedClient.postalCode) ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700 space-y-0.5">
                  {resolvedClient.street && (
                    <p className="font-semibold text-slate-900">
                      {resolvedClient.street}{resolvedClient.buildingNumber ? ` ${resolvedClient.buildingNumber}` : ""}{resolvedClient.apartmentNumber ? `/${resolvedClient.apartmentNumber}` : ""}
                    </p>
                  )}
                  {(resolvedClient.postalCode || resolvedClient.city) && (
                    <p>{[resolvedClient.postalCode, resolvedClient.city].filter(Boolean).join(" ")}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Brak adresu w karcie klienta</p>
              )}
            </div>

            {/* Adres inwestycji */}
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> Adres inwestycji / montażu
                </label>
                <p className="text-xs text-slate-400 mt-0.5">Wypełnij jeśli różni się od adresu klienta powyżej</p>
              </div>

              <AddressSearch onSelect={handleInvestmentAddressSelect} />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Kod pocztowy</label>
                  <input type="text" value={investmentPostalCode} onChange={(e) => setInvestmentPostalCode(e.target.value)} placeholder="00-000" className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Miejscowość</label>
                  <input type="text" value={investmentCity} onChange={(e) => setInvestmentCity(e.target.value)} placeholder="np. Mińsk Mazowiecki" className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Ulica</label>
                  <input type="text" value={investmentStreet} onChange={(e) => setInvestmentStreet(e.target.value)} placeholder="np. ul. Siennicka" className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Nr budynku</label>
                  <input type="text" value={investmentBuildingNumber} onChange={(e) => setInvestmentBuildingNumber(e.target.value)} placeholder="47" className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Nr lokalu</label>
                  <input type="text" value={investmentApartmentNumber} onChange={(e) => setInvestmentApartmentNumber(e.target.value)} placeholder="Opcjonalnie" className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            {/* Usługi */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5" /> Usługi (wybór wielokrotny)
              </label>
              <div className="flex flex-wrap gap-2">
                {servicesList.map((svc) => {
                  const selected = services.includes(svc.name);
                  return (
                    <button
                      key={svc._id}
                      type="button"
                      onClick={() => toggleService(svc.name)}
                      className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all ${
                        selected
                          ? "border-blue-600 bg-blue-600 text-white shadow-2xs"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {selected ? "✓ " : "+ "}{svc.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pliki do wgrania */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Upload className="h-3.5 w-3.5" /> Pliki i załączniki
              </label>
              {uploadedFiles.length > 0 && (
                <div className="space-y-1.5">
                  {uploadedFiles.map((f) => (
                    <div key={f.storageId} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                      <span className="truncate text-xs font-medium text-slate-800">{f.name}</span>
                      <button type="button" onClick={() => removeUploadedFile(f.storageId)} disabled={uploading} className="ml-2 text-slate-400 hover:text-red-600 disabled:opacity-50">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-5 text-slate-600 transition-all hover:border-blue-500 hover:bg-blue-50/40 disabled:opacity-50"
              >
                <Upload className="h-5 w-5 text-slate-400" />
                <span className="text-xs font-semibold">{uploading ? "Wgrywanie plików…" : "Kliknij aby wybrać zdjęcia / dokumenty"}</span>
              </button>
              <input ref={fileInputRef} type="file" multiple onChange={handleFileUpload} disabled={uploading || submitting} className="hidden" />
            </div>

            {/* Dodatkowe pola */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tekst własny / tytul karty</label>
                <input
                  type="text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="np. Kowalski – okna salonu"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Źródło leada (pochodzenie)</label>
                <input
                  type="text"
                  value={leadSource}
                  onChange={(e) => setLeadSource(e.target.value)}
                  placeholder="np. Polecenie, Facebook ADK, Strona WWW..."
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Uwagi / komentarz
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="Opis sprawy, dodatkowe ustalenia lub notatka dla handlowca..."
                className="w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {error && <p className="text-xs font-medium text-red-600 bg-red-50 p-3 rounded-xl border border-red-200">{error}</p>}

            {/* Buttons */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-6">
              {!initialClientId ? (
                <button
                  type="button"
                  onClick={() => { setError(null); setStep("client"); }}
                  disabled={submitting}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  ← Wstecz do wyboru klienta
                </button>
              ) : <div />}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || uploading}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-blue-700 disabled:opacity-60 shadow-md"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {submitting ? "Tworzenie szansy..." : "Utwórz szansę sprzedaży"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
