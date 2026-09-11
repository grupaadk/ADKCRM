"use client";

import { useState } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import AddressSearch, { type AddressData } from "@/components/AddressSearch";
import ModalPortal from "@/components/ModalPortal";
import { Loader2, Search } from "lucide-react";

interface NewOrderModalProps {
  clientId?: Id<"clients">;
  onClose: () => void;
  onSuccess: (orderId: Id<"orders">, clientId: Id<"clients">) => void;
}

type Step = "client" | "services" | "location";
type ClientMode = "search" | "create";
type ClientType = "individual" | "business";

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

const STEP_LABELS: Record<Step, string> = {
  client: "Klient",
  services: "Usługi",
  location: "Lokalizacja",
};

export default function NewOrderModal({ clientId: initialClientId, onClose, onSuccess }: NewOrderModalProps) {
  // ─── Order state ───────────────────────────────────────────────────────────
  const [resolvedClientId, setResolvedClientId] = useState<Id<"clients"> | undefined>(initialClientId);
  const [resolvedClientName, setResolvedClientName] = useState<string>("");
  const [step, setStep] = useState<Step>(initialClientId ? "services" : "client");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [investment, setInvestment] = useState({ street: "", buildingNumber: "", apartmentNumber: "", postalCode: "", city: "" });
  const [comment, setComment] = useState("");
  const [customText, setCustomText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Client step state ─────────────────────────────────────────────────────
  const [clientMode, setClientMode] = useState<ClientMode>("search");
  const [clientForm, setClientForm] = useState(EMPTY_CLIENT_FORM);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [nipLoading, setNipLoading] = useState(false);
  const [nipFetched, setNipFetched] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sameAsClient, setSameAsClient] = useState(false);

  // ─── Convex queries/mutations ──────────────────────────────────────────────
  const searchResults = useQuery(
    api.clients.search,
    searchQuery.trim().length >= 2 ? { searchTerm: searchQuery.trim() } : "skip",
  );
  const recentClients = useQuery(api.clients.list, searchQuery.trim().length < 2 ? {} : "skip");
  const searchItems = searchQuery.trim().length >= 2 ? searchResults : recentClients?.page;
  const servicesList = useQuery(api.services.listActive) ?? [];
  const selectedClient = useQuery(api.clients.getById, resolvedClientId ? { clientId: resolvedClientId } : "skip");
  const createOrder = useMutation(api.orders.create);
  const createClient = useMutation(api.clients.create);
  const lookupNip = useAction(api.whitelist.lookupNip);

  // ─── Step logic ────────────────────────────────────────────────────────────
  const baseSteps: Step[] = ["services", "location"];
  const allSteps: Step[] = initialClientId ? baseSteps : ["client", ...baseSteps];
  const stepIndex = allSteps.indexOf(step);

  // ─── Client handlers ───────────────────────────────────────────────────────
  function handleSelectClient(id: Id<"clients">, name: string) {
    setResolvedClientId(id);
    setResolvedClientName(name);
    setError(null);
    setStep("services");
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
      setStep("services");
    } catch {
      setClientErrors({ _form: "Wystąpił błąd podczas dodawania klienta." });
    } finally {
      setCreatingClient(false);
    }
  }

  // ─── Order handlers ────────────────────────────────────────────────────────
  function toggleService(service: string) {
    setSelectedServices((prev) =>
      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service],
    );
  }

  function handleInvestmentAddressSelect(address: AddressData) {
    setInvestment((prev) => ({
      ...prev,
      street: address.street ?? prev.street,
      buildingNumber: address.buildingNumber ?? prev.buildingNumber,
      city: address.city ?? prev.city,
      postalCode: address.postalCode ?? prev.postalCode,
    }));
  }

  function handleNext() {
    if (step === "services") {
      if (selectedServices.length === 0) { setError("Wybierz co najmniej jedną usługę."); return; }
      setError(null);
      setStep("location");
    }
  }

  function handleBack() {
    setError(null);
    if (step === "location") setStep("services");
    else if (step === "services" && !initialClientId) setStep("client");
  }

  async function handleSubmit() {
    if (!resolvedClientId) { setError("Brak klienta."); return; }
    setSubmitting(true);
    setError(null);
    try {
      const orderId = await createOrder({
        clientId: resolvedClientId,
        services: selectedServices.length > 0 ? selectedServices : undefined,
        investmentStreet: investment.street.trim() || undefined,
        investmentBuildingNumber: investment.buildingNumber.trim() || undefined,
        investmentApartmentNumber: investment.apartmentNumber.trim() || undefined,
        investmentPostalCode: investment.postalCode.trim() || undefined,
        investmentCity: investment.city.trim() || undefined,
        comment: comment.trim() || undefined,
        customText: customText.trim() || undefined,
      });
      onSuccess(orderId, resolvedClientId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wystąpił błąd podczas tworzenia zlecenia.");
      setSubmitting(false);
    }
  }

  const isBusy = submitting || creatingClient || nipLoading;

  // Field class helpers for client form
  const fieldCls = (field: string, forceDisabled = false) =>
    forceDisabled
      ? "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
      : `w-full rounded-lg border px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 ${
          clientErrors[field] ? "border-red-400 focus:ring-red-400" : "border-slate-200"
        }`;

  const orderFieldCls =
    "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400";

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        onClick={() => { if (!isBusy) onClose(); }}
      />

      {/* Modal */}
      <div
        className="relative flex w-full flex-col bg-white shadow-2xl sm:mx-4 sm:max-w-2xl lg:max-w-3xl rounded-t-2xl sm:rounded-2xl"
        style={{ maxHeight: "95dvh" }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-slate-100 px-5 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            {/* Title + client name */}
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-slate-900">Nowe zlecenie</h2>
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
                    <div
                      className={`h-px w-4 rounded-full transition-colors ${
                        i < stepIndex ? "bg-blue-500" : "bg-slate-200"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Close button */}
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

          {/* Step label */}
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            {STEP_LABELS[step]}
          </p>

          {/* ── Krok: Klient ─────────────────────────────────────────────── */}
          {step === "client" && (
            <div className="space-y-4">
              {/* Mode toggle */}
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
                        onClick={() =>
                          handleSelectClient(
                            c._id,
                            c.companyName ?? `${c.firstName} ${c.lastName}`,
                          )
                        }
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

                  {/* Client type toggle */}
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
                      {/* NIP */}
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                          NIP <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={clientForm.nip}
                            onChange={(e) => handleClientFormChange("nip", e.target.value)}
                            onKeyDown={(e) =>
                              e.key === "Enter" && (e.preventDefault(), handleNipLookup())
                            }
                            className={`flex-1 rounded-lg border px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 ${
                              clientErrors.nip ? "border-red-400" : "border-slate-200"
                            }`}
                            placeholder="np. 1234567890"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={handleNipLookup}
                            disabled={nipLoading}
                            className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
                          >
                            {nipLoading ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Search size={14} />
                            )}
                            {nipLoading ? "Pobieranie…" : "Pobierz z GUS"}
                          </button>
                        </div>
                        {clientErrors.nip && (
                          <p className="mt-1 text-xs text-red-600">{clientErrors.nip}</p>
                        )}
                      </div>

                      {/* Company name */}
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                          Nazwa firmy <span className="text-red-500">*</span>
                          {nipFetched && (
                            <span className="ml-2 text-xs font-normal text-emerald-600">
                              — pobrano z GUS
                            </span>
                          )}
                        </label>
                        <input
                          type="text"
                          value={clientForm.companyName}
                          onChange={(e) => handleClientFormChange("companyName", e.target.value)}
                          className={fieldCls("companyName")}
                          placeholder="Nazwa firmy"
                        />
                        {clientErrors.companyName && (
                          <p className="mt-1 text-xs text-red-600">{clientErrors.companyName}</p>
                        )}
                      </div>

                      {/* Business address */}
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Adres firmy
                        </p>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="col-span-2">
                            <label className="mb-1 block text-xs text-slate-500">Ulica</label>
                            <input
                              type="text"
                              value={clientForm.street}
                              onChange={(e) => handleClientFormChange("street", e.target.value)}
                              className={fieldCls("street")}
                              placeholder="Ulica"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-slate-500">Nr budynku</label>
                            <input
                              type="text"
                              value={clientForm.buildingNumber}
                              onChange={(e) => handleClientFormChange("buildingNumber", e.target.value)}
                              className={fieldCls("buildingNumber")}
                              placeholder="Nr"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-slate-500">Nr lokalu</label>
                            <input
                              type="text"
                              value={clientForm.apartmentNumber}
                              onChange={(e) => handleClientFormChange("apartmentNumber", e.target.value)}
                              className={fieldCls("apartmentNumber")}
                              placeholder="Opcjonalnie"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-slate-500">Kod pocztowy</label>
                            <input
                              type="text"
                              value={clientForm.postalCode}
                              onChange={(e) => handleClientFormChange("postalCode", e.target.value)}
                              className={fieldCls("postalCode")}
                              placeholder="00-000"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-slate-500">Miejscowość</label>
                            <input
                              type="text"
                              value={clientForm.city}
                              onChange={(e) => handleClientFormChange("city", e.target.value)}
                              className={fieldCls("city")}
                              placeholder="Miejscowość"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Business contact */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">Telefon</label>
                          <input
                            type="tel"
                            value={clientForm.phone}
                            onChange={(e) => handleClientFormChange("phone", e.target.value)}
                            className={fieldCls("phone")}
                            placeholder="123 456 789"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
                          <input
                            type="email"
                            value={clientForm.email}
                            onChange={(e) => handleClientFormChange("email", e.target.value)}
                            className={fieldCls("email")}
                            placeholder="firma@example.com"
                          />
                        </div>
                      </div>

                      {/* Contact person */}
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Osoba kontaktowa / decyzyjna
                        </p>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="mb-1 block text-xs text-slate-500">
                              Imię <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={clientForm.firstName}
                              onChange={(e) => handleClientFormChange("firstName", e.target.value)}
                              className={fieldCls("firstName")}
                              placeholder="np. Anna"
                            />
                            {clientErrors.firstName && (
                              <p className="mt-1 text-xs text-red-600">{clientErrors.firstName}</p>
                            )}
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-slate-500">
                              Nazwisko <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={clientForm.lastName}
                              onChange={(e) => handleClientFormChange("lastName", e.target.value)}
                              className={fieldCls("lastName")}
                              placeholder="np. Kowalska"
                            />
                            {clientErrors.lastName && (
                              <p className="mt-1 text-xs text-red-600">{clientErrors.lastName}</p>
                            )}
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
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">
                            Imię <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={clientForm.firstName}
                            onChange={(e) => handleClientFormChange("firstName", e.target.value)}
                            className={fieldCls("firstName")}
                            placeholder="np. Jan"
                            autoFocus
                          />
                          {clientErrors.firstName && (
                            <p className="mt-1 text-xs text-red-600">{clientErrors.firstName}</p>
                          )}
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">
                            Nazwisko <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={clientForm.lastName}
                            onChange={(e) => handleClientFormChange("lastName", e.target.value)}
                            className={fieldCls("lastName")}
                            placeholder="np. Kowalski"
                          />
                          {clientErrors.lastName && (
                            <p className="mt-1 text-xs text-red-600">{clientErrors.lastName}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">Telefon</label>
                          <input
                            type="tel"
                            value={clientForm.phone}
                            onChange={(e) => handleClientFormChange("phone", e.target.value)}
                            className={fieldCls("phone")}
                            placeholder="123 456 789"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
                          <input
                            type="email"
                            value={clientForm.email}
                            onChange={(e) => handleClientFormChange("email", e.target.value)}
                            className={fieldCls("email")}
                            placeholder="jan@example.com"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                          Wyszukaj adres
                        </label>
                        <AddressSearch onSelect={handleClientAddressSelect} />
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="mb-1 block text-xs text-slate-500">Kod pocztowy</label>
                          <input
                            type="text"
                            value={clientForm.postalCode}
                            onChange={(e) => handleClientFormChange("postalCode", e.target.value)}
                            className={fieldCls("postalCode")}
                            placeholder="00-000"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-500">Miejscowość</label>
                          <input
                            type="text"
                            value={clientForm.city}
                            onChange={(e) => handleClientFormChange("city", e.target.value)}
                            className={fieldCls("city")}
                            placeholder="np. Kraków"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="mb-1 block text-xs text-slate-500">Ulica</label>
                          <input
                            type="text"
                            value={clientForm.street}
                            onChange={(e) => handleClientFormChange("street", e.target.value)}
                            className={fieldCls("street")}
                            placeholder="np. ul. Lipowa"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-500">Nr budynku</label>
                          <input
                            type="text"
                            value={clientForm.buildingNumber}
                            onChange={(e) => handleClientFormChange("buildingNumber", e.target.value)}
                            className={fieldCls("buildingNumber")}
                            placeholder="12"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-500">Nr mieszkania</label>
                          <input
                            type="text"
                            value={clientForm.apartmentNumber}
                            onChange={(e) => handleClientFormChange("apartmentNumber", e.target.value)}
                            className={fieldCls("apartmentNumber")}
                            placeholder="4 (opcjonalnie)"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Create & continue button */}
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

          {/* ── Krok: Usługi ─────────────────────────────────────────────── */}
          {step === "services" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">Wybierz usługi dla tego zlecenia.</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {servicesList.map((svc) => (
                  <button
                    key={svc._id}
                    type="button"
                    onClick={() => toggleService(svc.name)}
                    className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                      selectedServices.includes(svc.name)
                        ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {svc.name}
                  </button>
                ))}
              </div>
              {error && <p className="text-xs font-medium text-red-600">{error}</p>}
            </div>
          )}

          {/* ── Krok: Lokalizacja ─────────────────────────────────────────── */}
          {step === "location" && (
            <div className="space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Lokalizacja inwestycji
                  </p>
                  {selectedClient && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sameAsClient}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSameAsClient(checked);
                          if (checked) {
                            setInvestment({
                              street: selectedClient.street ?? "",
                              buildingNumber: selectedClient.buildingNumber ?? "",
                              apartmentNumber: selectedClient.apartmentNumber ?? "",
                              postalCode: selectedClient.postalCode ?? "",
                              city: selectedClient.city ?? "",
                            });
                          }
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs font-medium text-slate-600">
                        Taki sam jak adres klienta
                      </span>
                    </label>
                  )}
                </div>
                {!sameAsClient && <AddressSearch onSelect={handleInvestmentAddressSelect} />}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Kod pocztowy</label>
                    <input
                      type="text"
                      value={investment.postalCode}
                      onChange={(e) => setInvestment((prev) => ({ ...prev, postalCode: e.target.value }))}
                      placeholder="00-000"
                      className={orderFieldCls}
                      disabled={sameAsClient}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Miejscowość</label>
                    <input
                      type="text"
                      value={investment.city}
                      onChange={(e) => setInvestment((prev) => ({ ...prev, city: e.target.value }))}
                      placeholder="np. Kraków"
                      className={orderFieldCls}
                      disabled={sameAsClient}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Ulica</label>
                    <input
                      type="text"
                      value={investment.street}
                      onChange={(e) => setInvestment((prev) => ({ ...prev, street: e.target.value }))}
                      placeholder="np. ul. Lipowa"
                      className={orderFieldCls}
                      disabled={sameAsClient}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Nr budynku</label>
                      <input
                        type="text"
                        value={investment.buildingNumber}
                        onChange={(e) =>
                          setInvestment((prev) => ({ ...prev, buildingNumber: e.target.value }))
                        }
                        placeholder="12"
                        className={orderFieldCls}
                        disabled={sameAsClient}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Nr mieszkania</label>
                      <input
                        type="text"
                        value={investment.apartmentNumber}
                        onChange={(e) =>
                          setInvestment((prev) => ({ ...prev, apartmentNumber: e.target.value }))
                        }
                        placeholder="4"
                        className={orderFieldCls}
                        disabled={sameAsClient}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Tekst własny
                </label>
                <input
                  type="text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="np. Kowalski – okna salonu"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                />
                <p className="text-xs text-slate-400">Dodatkowy identyfikator widoczny obok numeru zlecenia</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Komentarz
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="Dodatkowe uwagi do zlecenia..."
                  className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                />
              </div>

              {error && <p className="text-xs font-medium text-red-600">{error}</p>}
            </div>
          )}
        </div>

        {/* ── Footer — for steps after client selection ───────────────────── */}
        {step !== "client" && (
          <div className="shrink-0 border-t border-slate-100 px-5 sm:px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              {stepIndex > 0 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={submitting}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  ← Wstecz
                </button>
              ) : (
                <div />
              )}

              {step !== "location" ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                >
                  Dalej →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  {submitting ? "Tworzenie..." : "Utwórz zlecenie"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
    </ModalPortal>
  );
}
