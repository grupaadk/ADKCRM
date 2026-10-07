"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import AddressSearch, { type AddressData } from "@/components/AddressSearch";
import ServiceIcon from "@/components/ServiceIcon";
import {
  Upload,
  X,
  Loader2,
  Search,
  ArrowLeft,
  CheckCircle2,
  User,
  MapPin,
  Briefcase,
  FileText,
  Sparkles,
  SlidersHorizontal,
  ChevronRight,
  Check,
  Plus,
  Info,
} from "lucide-react";


interface NewOpportunityFormProps {
  initialClientId?: Id<"clients">;
  onSuccess?: (opportunityId: string) => void;
  onCancel?: () => void;
}

export type WizardStep = 1 | 2 | 3 | 4;
type ClientMode = "search" | "create";
type ClientType = "individual" | "business";

const STEP_DEFINITIONS: { id: WizardStep; title: string; subtitle: string; icon: typeof Briefcase }[] = [
  { id: 1, title: "Wybór usługi", subtitle: "Wskaż interesujące usługi", icon: Briefcase },
  { id: 2, title: "Konfiguracja", subtitle: "Specyfikacja wyceny", icon: SlidersHorizontal },
  { id: 3, title: "Klient", subtitle: "Wybierz lub utwórz", icon: User },
  { id: 4, title: "Adres i szczegóły", subtitle: "Montaż, załączniki i uwagi", icon: MapPin },
];

const POPULAR_LEAD_SOURCES = [
  "Strona WWW (Formularz)",
  "Telefon / Kontakt bezpośredni",
  "Rekomendacja / Polecenie",
  "Facebook / Instagram",
  "Targi / Wydarzenie",
  "Inne",
];

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

  // Initial client query if passed via props/URL
  const initialClientDoc = useQuery(
    api.clients.getById,
    initialClientId ? { clientId: initialClientId } : "skip"
  );

  // ─── Wizard Step State ──────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  // ─── Step 1: Services ───────────────────────────────────────────────────────
  const servicesList = useQuery(api.services.list, {}) ?? [];
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  // ─── Step 3: Client State ───────────────────────────────────────────────────
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
  const [resolvedAddress, setResolvedAddress] = useState({
    street: "",
    buildingNumber: "",
    apartmentNumber: "",
    postalCode: "",
    city: "",
  });

  const resolvedClientDoc = useQuery(
    api.clients.getById,
    resolvedClientId ? { clientId: resolvedClientId } : "skip"
  );

  // Populate resolved client when initialClientDoc or resolvedClientDoc changes
  useEffect(() => {
    const doc = initialClientDoc || resolvedClientDoc;
    if (doc) {
      setResolvedClientId(doc._id);
      const name =
        doc.clientType === "business" && doc.companyName
          ? doc.companyName
          : `${doc.firstName} ${doc.lastName}`;
      setResolvedClientName(name);
      setResolvedContact({
        firstName: doc.firstName,
        lastName: doc.lastName || doc.companyName || "",
        email: doc.email ?? "",
        phone: doc.phone ?? "",
      });
      setResolvedAddress({
        street: doc.street ?? "",
        buildingNumber: doc.buildingNumber ?? "",
        apartmentNumber: doc.apartmentNumber ?? "",
        postalCode: doc.postalCode ?? "",
        city: doc.city ?? "",
      });
    }
  }, [initialClientDoc, resolvedClientDoc]);

  // Client search queries
  const searchResults = useQuery(
    api.clients.search,
    searchQuery.trim().length >= 1 ? { searchTerm: searchQuery.trim() } : "skip"
  );
  const recentClients = useQuery(api.clients.list, searchQuery.trim().length < 1 ? {} : "skip");
  const searchItems = searchQuery.trim().length >= 1 ? searchResults : recentClients?.page;

  // ─── Step 4: Address & Lead Details ────────────────────────────────────────
  const [sameAsClientAddress, setSameAsClientAddress] = useState(true);
  const [investmentStreet, setInvestmentStreet] = useState("");
  const [investmentBuildingNumber, setInvestmentBuildingNumber] = useState("");
  const [investmentApartmentNumber, setInvestmentApartmentNumber] = useState("");
  const [investmentPostalCode, setInvestmentPostalCode] = useState("");
  const [investmentCity, setInvestmentCity] = useState("");

  const [customText, setCustomText] = useState("");
  const [leadSource, setLeadSource] = useState("");
  const [customLeadSource, setCustomLeadSource] = useState("");
  const [comment, setComment] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; storageId: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync investment address when sameAsClientAddress is active
  useEffect(() => {
    if (sameAsClientAddress) {
      const src = resolvedClientDoc || (resolvedAddress.street || resolvedAddress.city ? resolvedAddress : null);
      if (src) {
        setInvestmentStreet(src.street ?? "");
        setInvestmentBuildingNumber(src.buildingNumber ?? "");
        setInvestmentApartmentNumber(src.apartmentNumber ?? "");
        setInvestmentPostalCode(src.postalCode ?? "");
        setInvestmentCity(src.city ?? "");
      } else if (clientForm.street || clientForm.city) {
        setInvestmentStreet(clientForm.street);
        setInvestmentBuildingNumber(clientForm.buildingNumber);
        setInvestmentApartmentNumber(clientForm.apartmentNumber);
        setInvestmentPostalCode(clientForm.postalCode);
        setInvestmentCity(clientForm.city);
      }
    }
  }, [sameAsClientAddress, resolvedClientDoc, resolvedAddress, clientForm.street, clientForm.buildingNumber, clientForm.apartmentNumber, clientForm.postalCode, clientForm.city]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function toggleService(serviceName: string) {
    setSelectedServices((prev) =>
      prev.includes(serviceName) ? prev.filter((s) => s !== serviceName) : [...prev, serviceName]
    );
  }

  function handleSelectClient(c: {
    _id: Id<"clients">;
    firstName: string;
    lastName: string;
    companyName?: string;
    email?: string;
    phone?: string;
    street?: string;
    buildingNumber?: string;
    apartmentNumber?: string;
    postalCode?: string;
    city?: string;
  }) {
    setResolvedClientId(c._id);
    const name = c.companyName ?? `${c.firstName} ${c.lastName}`;
    setResolvedClientName(name);
    const lastName = c.lastName || c.companyName || "";
    setResolvedContact({
      firstName: c.firstName,
      lastName,
      email: c.email ?? "",
      phone: c.phone ?? "",
    });
    setResolvedAddress({
      street: c.street ?? "",
      buildingNumber: c.buildingNumber ?? "",
      apartmentNumber: c.apartmentNumber ?? "",
      postalCode: c.postalCode ?? "",
      city: c.city ?? "",
    });

    if (sameAsClientAddress) {
      setInvestmentStreet(c.street ?? "");
      setInvestmentBuildingNumber(c.buildingNumber ?? "");
      setInvestmentApartmentNumber(c.apartmentNumber ?? "");
      setInvestmentPostalCode(c.postalCode ?? "");
      setInvestmentCity(c.city ?? "");
    }

    setError(null);
  }

  function handleClientFormChange(field: keyof typeof clientForm, value: string) {
    setClientForm((prev) => ({ ...prev, [field]: value }));
    if (clientErrors[field]) {
      setClientErrors((prev) => {
        const n = { ...prev };
        delete n[field];
        return n;
      });
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

  function handleInvestmentAddressSelect(address: AddressData) {
    setInvestmentStreet(address.street ?? investmentStreet);
    setInvestmentBuildingNumber(address.buildingNumber ?? investmentBuildingNumber);
    setInvestmentCity(address.city ?? investmentCity);
    setInvestmentPostalCode(address.postalCode ?? investmentPostalCode);
  }

  async function handleFetchNip() {
    const rawNip = clientForm.nip.replace(/\D/g, "");
    if (rawNip.length !== 10) {
      setClientErrors((prev) => ({ ...prev, nip: "NIP musi składać się z 10 cyfr" }));
      return;
    }
    setNipLoading(true);
    setError(null);
    try {
      const res = await lookupNip({ nip: rawNip });
      if (res && res.companyName) {
        setClientForm((prev) => ({
          ...prev,
          companyName: res.companyName || prev.companyName,
          nip: rawNip,
          street: res.street || prev.street,
          buildingNumber: res.buildingNumber || prev.buildingNumber,
          apartmentNumber: res.apartmentNumber || prev.apartmentNumber,
          postalCode: res.postalCode || prev.postalCode,
          city: res.city || prev.city,
        }));
        setNipFetched(true);
      } else {
        setError("Nie znaleziono firmy o podanym numerze NIP w rejestrze GUS.");
      }
    } catch {
      setError("Błąd podczas pobierania danych z NIP. Wprowadź dane ręcznie.");
    } finally {
      setNipLoading(false);
    }
  }

  async function handleCreateNewClient() {
    const errors: Record<string, string> = {};
    if (clientForm.clientType === "individual") {
      if (!clientForm.firstName.trim()) errors.firstName = "Wymagane";
      if (!clientForm.lastName.trim()) errors.lastName = "Wymagane";
    } else {
      if (!clientForm.companyName.trim()) errors.companyName = "Nazwa firmy wymagana";
      if (!clientForm.nip.trim()) errors.nip = "NIP wymagany";
    }
    if (Object.keys(errors).length > 0) {
      setClientErrors(errors);
      return;
    }
    setCreatingClient(true);
    setError(null);
    try {
      const newId = await createClient({
        clientType: clientForm.clientType,
        firstName: clientForm.firstName.trim() || clientForm.companyName.trim(),
        lastName: clientForm.lastName.trim(),
        email: clientForm.email.trim() || undefined,
        phone: clientForm.phone.trim() || undefined,
        companyName: clientForm.companyName.trim() || undefined,
        nip: clientForm.nip.trim() || undefined,
        postalCode: clientForm.postalCode.trim() || undefined,
        city: clientForm.city.trim() || undefined,
        street: clientForm.street.trim() || undefined,
        buildingNumber: clientForm.buildingNumber.trim() || undefined,
        apartmentNumber: clientForm.apartmentNumber.trim() || undefined,
      });

      setResolvedClientId(newId);
      const name =
        clientForm.clientType === "business" && clientForm.companyName.trim()
          ? clientForm.companyName.trim()
          : `${clientForm.firstName.trim()} ${clientForm.lastName.trim()}`;
      setResolvedClientName(name);
      setResolvedContact({
        firstName: clientForm.firstName.trim() || clientForm.companyName.trim(),
        lastName: clientForm.lastName.trim() || clientForm.companyName.trim(),
        email: clientForm.email.trim(),
        phone: clientForm.phone.trim(),
      });
      setResolvedAddress({
        street: clientForm.street.trim(),
        buildingNumber: clientForm.buildingNumber.trim(),
        apartmentNumber: clientForm.apartmentNumber.trim(),
        postalCode: clientForm.postalCode.trim(),
        city: clientForm.city.trim(),
      });

      if (sameAsClientAddress) {
        setInvestmentStreet(clientForm.street.trim());
        setInvestmentBuildingNumber(clientForm.buildingNumber.trim());
        setInvestmentApartmentNumber(clientForm.apartmentNumber.trim());
        setInvestmentPostalCode(clientForm.postalCode.trim());
        setInvestmentCity(clientForm.city.trim());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się utworzyć klienta");
    } finally {
      setCreatingClient(false);
    }
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
        if (!storageId) throw new Error("Brak zwróconego ID pliku");
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
      setError("Wybierz lub utwórz klienta w kroku 3 przed utworzeniem szansy.");
      setCurrentStep(3);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const finalLeadSource = leadSource === "Inne" ? customLeadSource.trim() : leadSource.trim();

      const clientStreet = resolvedAddress.street.trim() || clientForm.street.trim() || undefined;
      const clientBuildingNumber = resolvedAddress.buildingNumber.trim() || clientForm.buildingNumber.trim() || undefined;
      const clientApartmentNumber = resolvedAddress.apartmentNumber.trim() || clientForm.apartmentNumber.trim() || undefined;
      const clientPostalCode = resolvedAddress.postalCode.trim() || clientForm.postalCode.trim() || undefined;
      const clientCity = resolvedAddress.city.trim() || clientForm.city.trim() || undefined;

      const finalInvestmentStreet = sameAsClientAddress
        ? clientStreet
        : (investmentStreet.trim() || undefined);
      const finalInvestmentBuildingNumber = sameAsClientAddress
        ? clientBuildingNumber
        : (investmentBuildingNumber.trim() || undefined);
      const finalInvestmentApartmentNumber = sameAsClientAddress
        ? clientApartmentNumber
        : (investmentApartmentNumber.trim() || undefined);
      const finalInvestmentPostalCode = sameAsClientAddress
        ? clientPostalCode
        : (investmentPostalCode.trim() || undefined);
      const finalInvestmentCity = sameAsClientAddress
        ? clientCity
        : (investmentCity.trim() || undefined);

      const opportunityId = await createOpportunity({
        clientId: resolvedClientId,
        firstName: resolvedContact.firstName,
        lastName: resolvedContact.lastName,
        email: resolvedContact.email || undefined,
        phone: resolvedContact.phone || undefined,
        street: clientStreet,
        buildingNumber: clientBuildingNumber,
        apartmentNumber: clientApartmentNumber,
        postalCode: clientPostalCode,
        city: clientCity,
        investmentStreet: finalInvestmentStreet,
        investmentBuildingNumber: finalInvestmentBuildingNumber,
        investmentApartmentNumber: finalInvestmentApartmentNumber,
        investmentPostalCode: finalInvestmentPostalCode,
        investmentCity: finalInvestmentCity,
        services: selectedServices.length > 0 ? selectedServices : undefined,
        customText: customText.trim() || undefined,
        leadSource: finalLeadSource || undefined,
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

  // ─── Step Navigation Validation ─────────────────────────────────────────────

  function canGoToStep(targetStep: WizardStep): boolean {
    if (targetStep <= currentStep) return true;
    if (targetStep === 2) return true;
    if (targetStep === 3) return true;
    if (targetStep === 4) return !!resolvedClientId || (!!resolvedContact.firstName && !!resolvedContact.lastName);
    return false;
  }

  function handleNextStep() {
    setError(null);
    if (currentStep === 3) {
      if (!resolvedClientId && (!resolvedContact.firstName || !resolvedContact.lastName)) {
        setError("Wybierz klienta z listy lub utwórz nowego przed przejściem dalej.");
        return;
      }
    }
    if (currentStep < 4) {
      setCurrentStep((prev) => (prev + 1) as WizardStep);
    }
  }

  function handlePrevStep() {
    setError(null);
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as WizardStep);
    }
  }

  const currentClientStreet = resolvedAddress.street || clientForm.street || resolvedClientDoc?.street || "";
  const currentClientBuilding = resolvedAddress.buildingNumber || clientForm.buildingNumber || resolvedClientDoc?.buildingNumber || "";
  const currentClientApartment = resolvedAddress.apartmentNumber || clientForm.apartmentNumber || resolvedClientDoc?.apartmentNumber || "";
  const currentClientPostal = resolvedAddress.postalCode || clientForm.postalCode || resolvedClientDoc?.postalCode || "";
  const currentClientCity = resolvedAddress.city || clientForm.city || resolvedClientDoc?.city || "";

  const formattedClientStreetWithNumber = [
    currentClientStreet,
    [currentClientBuilding, currentClientApartment].filter(Boolean).join("/"),
  ].filter(Boolean).join(" ");

  const formattedClientCityWithPostal = [
    currentClientPostal,
    currentClientCity,
  ].filter(Boolean).join(" ");

  const formattedClientAddress = [
    formattedClientStreetWithNumber,
    formattedClientCityWithPostal,
  ].filter(Boolean).join(", ");

  const fieldCls = (field: string, forceDisabled = false) =>
    forceDisabled
      ? "w-full rounded-xl border border-[var(--line-2)] bg-[var(--panel-2)] px-3.5 py-2.5 text-sm text-[var(--text-mute)] cursor-not-allowed"
      : `w-full rounded-xl border px-3.5 py-2.5 text-sm text-[var(--text-strong)] bg-white outline-none placeholder:text-slate-400 focus:border-brand focus:ring-1 focus:ring-brand transition-colors ${
          clientErrors[field] ? "border-red-400 focus:ring-red-400 bg-red-50/20" : "border-[var(--line-2)]"
        }`;

  return (
    <div className="w-full space-y-6">
      {/* ─── Top Header & Cancel Button ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--panel)] rounded-2xl border border-[var(--line)] p-5 md:p-6 shadow-2xs">
        <div className="flex items-center gap-3">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="p-2 rounded-xl text-[var(--text-dim)] hover:bg-[var(--panel-2)] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.push("/admin/panel")}
              className="p-2 rounded-xl text-[var(--text-dim)] hover:bg-[var(--panel-2)] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-[var(--text-strong)] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand" />
              Nowa Szansa Sprzedaży
            </h1>
            <p className="text-xs text-[var(--text-mute)] mt-0.5">
              Wypełnij formularz w 4 krokach, aby stworzyć nowy lead w CRM.
            </p>
          </div>
        </div>

        {resolvedClientName && (
          <div className="flex items-center gap-2.5 bg-brand/10 border border-brand/20 px-3.5 py-2 rounded-xl text-xs text-slate-800">
            <User className="w-4 h-4 text-brand" />
            <span>Klient: <strong className="font-semibold text-[var(--text-strong)]">{resolvedClientName}</strong></span>
          </div>
        )}
      </div>

      {/* ─── Stepper Progress Bar ─────────────────────────────────────────────── */}
      <div className="bg-[var(--panel)] rounded-2xl border border-[var(--line)] p-4 md:p-5 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {STEP_DEFINITIONS.map((s) => {
            const isActive = currentStep === s.id;
            const isCompleted = currentStep > s.id;
            const isSelectable = canGoToStep(s.id);

            return (
              <button
                key={s.id}
                type="button"
                disabled={!isSelectable}
                onClick={() => {
                  if (isSelectable) {
                    setError(null);
                    setCurrentStep(s.id);
                  }
                }}
                className={`flex items-center gap-3.5 p-3.5 rounded-xl border text-left transition-all ${
                  isActive
                    ? "border-brand bg-brand/10 ring-2 ring-brand/20 shadow-2xs"
                    : isCompleted
                    ? "border-emerald-300 bg-emerald-50/50 text-emerald-950 hover:border-emerald-400"
                    : isSelectable
                    ? "border-[var(--line)] bg-[var(--panel-2)]/60 hover:bg-[var(--panel-2)] text-[var(--text-dim)]"
                    : "border-[var(--line-2)]/50 bg-[var(--panel-2)]/30 text-[var(--text-mute)] cursor-not-allowed opacity-50"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${
                    isActive
                      ? "bg-brand text-white shadow-2xs"
                      : isCompleted
                      ? "bg-emerald-600 text-white"
                      : "bg-[var(--line-2)] text-[var(--text-dim)]"
                  }`}
                >
                  {isCompleted ? <Check className="w-5 h-5 stroke-[2.5]" /> : s.id}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-xs font-bold truncate ${
                        isActive ? "text-[var(--text-strong)]" : isCompleted ? "text-emerald-950" : "text-[var(--text)]"
                      }`}
                    >
                      {s.title}
                    </span>
                    {isActive && <ChevronRight className="w-4 h-4 text-brand shrink-0" />}
                  </div>
                  <p className="text-[11px] text-[var(--text-mute)] truncate mt-0.5">{s.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Global Error Alert ───────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-3 shadow-2xs">
          <Info className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">{error}</div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* ─── KROK 1: WYBÓR USŁUGI ────────────────────────────────────────────── */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {currentStep === 1 && (
        <div className="bg-[var(--panel)] rounded-2xl border border-[var(--line)] p-6 md:p-8 shadow-2xs space-y-6">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-strong)] flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-brand" />
              Krok 1: Wybór usługi
            </h2>
            <p className="text-xs text-[var(--text-mute)] mt-1">
              Wybierz jedną lub więcej usług, których dotyczy szansa sprzedaży.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {servicesList.length === 0 ? (
              <div className="col-span-full p-8 text-center text-xs text-[var(--text-mute)] border border-dashed border-[var(--line-2)] rounded-xl">
                Wczytywanie listy usług…
              </div>
            ) : (
              servicesList.map((service) => {
                const isSelected = selectedServices.includes(service.name);
                return (
                  <button
                    key={service._id}
                    type="button"
                    onClick={() => toggleService(service.name)}
                    className={`group flex items-center justify-between p-5 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? "border-brand bg-brand/10 ring-2 ring-brand/20 shadow-2xs"
                        : "border-[var(--line-2)] bg-white hover:border-brand/60 hover:bg-slate-50/60"
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-semibold transition-colors ${
                          isSelected
                            ? "bg-brand text-white shadow-2xs"
                            : "bg-[var(--panel-2)] text-[var(--text-dim)] group-hover:bg-brand/10 group-hover:text-brand"
                        }`}
                      >
                        <ServiceIcon name={service.name} className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-[var(--text-strong)] truncate">{service.name}</div>
                        {service.description && (
                          <div className="text-xs text-[var(--text-mute)] line-clamp-1 mt-0.5">
                            {service.description}
                          </div>
                        )}
                      </div>
                    </div>

                    <div
                      className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ml-3 transition-colors ${
                        isSelected
                          ? "bg-brand border-brand text-white"
                          : "border-[var(--line-2)] bg-white group-hover:border-brand"
                      }`}
                    >
                      {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {selectedServices.length > 0 && (
            <div className="rounded-xl border border-brand/30 bg-brand/5 p-4 flex items-center justify-between text-xs text-slate-800">
              <span className="font-medium">
                Wybrane usługi ({selectedServices.length}):{" "}
                <strong className="font-bold text-brand">{selectedServices.join(", ")}</strong>
              </span>
              <button
                type="button"
                onClick={() => setSelectedServices([])}
                className="text-brand hover:underline font-semibold"
              >
                Wyczyszczenie
              </button>
            </div>
          )}

          <div className="flex items-center justify-end pt-4 border-t border-[var(--line)]">
            <button
              type="button"
              onClick={handleNextStep}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-hover transition-colors shadow-2xs"
            >
              <span>Dalej: Konfiguracja</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* ─── KROK 2: KONFIGURACJA (PUSTY PLACEHOLDER) ─────────────────────────── */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {currentStep === 2 && (
        <div className="bg-[var(--panel)] rounded-2xl border border-[var(--line)] p-6 md:p-8 shadow-2xs space-y-6">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-strong)] flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-brand" />
              Krok 2: Konfiguracja
            </h2>
            <p className="text-xs text-[var(--text-mute)] mt-1">
              Wycena i specyfikacja szczegółowa szansy sprzedaży.
            </p>
          </div>

          <div className="rounded-2xl border border-dashed border-[var(--line-2)] bg-[var(--panel-2)]/60 p-10 md:p-14 text-center max-w-2xl mx-auto space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-brand/10 text-brand flex items-center justify-center mx-auto shadow-2xs">
              <SlidersHorizontal className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-strong)]">Konfiguracja szansy</h3>
              <p className="text-xs text-[var(--text-dim)] max-w-md mx-auto mt-1 leading-relaxed">
                Ten krok jest obecnie w rozbudowie. Wkrótce w tym miejscu znajdzie się konfigurator parametrów wyceny, wymiarów oraz wariantów produktów.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand/10 text-brand text-xs font-semibold border border-brand/30">
              <Sparkles className="w-3.5 h-3.5 text-brand" />
              <span>Możesz bezpiecznie przejść do następnego kroku</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[var(--line)]">
            <button
              type="button"
              onClick={handlePrevStep}
              className="px-5 py-2.5 rounded-xl border border-[var(--line-2)] text-[var(--text)] text-sm font-medium hover:bg-[var(--panel-2)] transition-colors"
            >
              ← Wstecz
            </button>
            <button
              type="button"
              onClick={handleNextStep}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-hover transition-colors shadow-2xs"
            >
              <span>Dalej: Wybór klienta</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* ─── KROK 3: WYBIERZ KLIENTA LUB UTWÓRZ NOWEGO ───────────────────────── */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {currentStep === 3 && (
        <div className="bg-[var(--panel)] rounded-2xl border border-[var(--line)] p-6 md:p-8 shadow-2xs space-y-6">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-strong)] flex items-center gap-2">
              <User className="w-5 h-5 text-brand" />
              Krok 3: Wybierz klienta lub utwórz nowego
            </h2>
            <p className="text-xs text-[var(--text-mute)] mt-1">
              Wyszukaj istniejącego klienta w bazie CRM lub dodaj nowego.
            </p>
          </div>

          {/* Selected client banner if already resolved */}
          {resolvedClientId && resolvedClientName ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                    Wybrany klient
                  </div>
                  <h3 className="text-base font-bold text-[var(--text-strong)] mt-0.5">{resolvedClientName}</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-dim)] mt-1">
                    {resolvedContact.email && <span>Email: {resolvedContact.email}</span>}
                    {resolvedContact.phone && <span>Tel: {resolvedContact.phone}</span>}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setResolvedClientId(undefined);
                  setResolvedClientName("");
                  setResolvedContact({ firstName: "", lastName: "", email: "", phone: "" });
                }}
                className="px-4 py-2 rounded-xl border border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100 text-xs font-semibold transition-colors self-start md:self-center"
              >
                Zmień klienta
              </button>
            </div>
          ) : (
            <>
              {/* Mode Toggle Pills */}
              <div className="flex rounded-xl bg-[var(--panel-2)] p-1 max-w-md">
                <button
                  type="button"
                  onClick={() => setClientMode("search")}
                  className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                    clientMode === "search"
                      ? "bg-white text-[var(--text-strong)] shadow-2xs"
                      : "text-[var(--text-mute)] hover:text-[var(--text-strong)]"
                  }`}
                >
                  Szukaj klienta w bazie
                </button>
                <button
                  type="button"
                  onClick={() => setClientMode("create")}
                  className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                    clientMode === "create"
                      ? "bg-white text-[var(--text-strong)] shadow-2xs"
                      : "text-[var(--text-mute)] hover:text-[var(--text-strong)]"
                  }`}
                >
                  Dodaj nowego klienta
                </button>
              </div>

              {/* MODE 1: SEARCH EXISTING CLIENT */}
              {clientMode === "search" && (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Szukaj po nazwisku, imieniu, nazwie firmy, emailu lub numerze telefonu..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-xl border border-[var(--line-2)] pl-10 pr-10 py-2.5 text-sm text-[var(--text-strong)] bg-white outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                    {searchItems === undefined && (
                      <div className="col-span-full rounded-xl border border-[var(--line-2)] p-6 text-center text-xs text-[var(--text-mute)]">
                        Wyszukiwanie klientów…
                      </div>
                    )}
                    {searchItems?.length === 0 && (
                      <div className="col-span-full rounded-xl border border-dashed border-[var(--line-2)] p-6 text-center text-xs text-[var(--text-mute)]">
                        Nie znaleziono klienta. Możesz przełączyć powyżej na &quot;Dodaj nowego klienta&quot;.
                      </div>
                    )}
                    {searchItems?.map((c) => (
                      <button
                        key={c._id}
                        type="button"
                        onClick={() => handleSelectClient(c)}
                        className="group w-full rounded-xl border border-[var(--line-2)] p-4 text-left transition-all hover:border-brand hover:bg-brand/5 hover:shadow-2xs"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold text-sm text-[var(--text-strong)] group-hover:text-brand">
                            {c.companyName || `${c.firstName} ${c.lastName}`}
                          </div>
                          <span className="text-[11px] font-medium text-[var(--text-dim)] border border-[var(--line-2)] px-2 py-0.5 rounded-md">
                            {c.clientType === "business" ? "Firma" : "Osoba"}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-[var(--text-dim)] space-y-0.5">
                          {c.email && <div>{c.email}</div>}
                          {c.phone && <div>{c.phone}</div>}
                          {c.city && (
                            <div className="text-[var(--text-mute)] text-[11px]">
                              {[c.street, c.buildingNumber, c.city].filter(Boolean).join(" ")}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* MODE 2: CREATE NEW CLIENT */}
              {clientMode === "create" && (
                <div className="space-y-5 border border-[var(--line)] rounded-2xl p-5 md:p-6 bg-[var(--panel-2)]/40">
                  {/* Client Type selection */}
                  <div className="flex items-center gap-4 border-b border-[var(--line-2)] pb-4">
                    <label className="text-xs font-semibold text-[var(--text)]">Typ klienta:</label>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-xs text-[var(--text-strong)] cursor-pointer">
                        <input
                          type="radio"
                          name="clientType"
                          checked={clientForm.clientType === "individual"}
                          onChange={() => handleClientTypeChange("individual")}
                          className="text-brand focus:ring-brand"
                        />
                        Osoba prywatna
                      </label>
                      <label className="flex items-center gap-2 text-xs text-[var(--text-strong)] cursor-pointer">
                        <input
                          type="radio"
                          name="clientType"
                          checked={clientForm.clientType === "business"}
                          onChange={() => handleClientTypeChange("business")}
                          className="text-brand focus:ring-brand"
                        />
                        Firma / NIP
                      </label>
                    </div>
                  </div>

                  {/* NIP Lookup for Business */}
                  {clientForm.clientType === "business" && (
                    <div className="rounded-xl border border-brand/30 bg-brand/5 p-4 space-y-3">
                      <label className="block text-xs font-semibold text-slate-800">
                        Pobierz dane firmy z rejestru GUS po numerze NIP
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Wpisz NIP np. 5250000000"
                          value={clientForm.nip}
                          onChange={(e) => handleClientFormChange("nip", e.target.value)}
                          className={fieldCls("nip")}
                        />
                        <button
                          type="button"
                          onClick={handleFetchNip}
                          disabled={nipLoading}
                          className="px-4 py-2.5 rounded-xl bg-brand text-white text-xs font-semibold hover:bg-brand-hover disabled:opacity-50 flex items-center gap-2 shrink-0 shadow-2xs"
                        >
                          {nipLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Pobierz dane z GUS"}
                        </button>
                      </div>
                      {nipFetched && (
                        <div className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" /> Dane firmy zostały pomyślnie wczytane!
                        </div>
                      )}
                    </div>
                  )}

                  {/* Client form inputs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {clientForm.clientType === "business" && (
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-[var(--text-dim)] mb-1">Nazwa firmy *</label>
                        <input
                          type="text"
                          value={clientForm.companyName}
                          onChange={(e) => handleClientFormChange("companyName", e.target.value)}
                          className={fieldCls("companyName")}
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-dim)] mb-1">Imię *</label>
                      <input
                        type="text"
                        value={clientForm.firstName}
                        onChange={(e) => handleClientFormChange("firstName", e.target.value)}
                        className={fieldCls("firstName")}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-dim)] mb-1">Nazwisko *</label>
                      <input
                        type="text"
                        value={clientForm.lastName}
                        onChange={(e) => handleClientFormChange("lastName", e.target.value)}
                        className={fieldCls("lastName")}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-dim)] mb-1">Email</label>
                      <input
                        type="email"
                        value={clientForm.email}
                        onChange={(e) => handleClientFormChange("email", e.target.value)}
                        className={fieldCls("email")}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-dim)] mb-1">Telefon</label>
                      <input
                        type="tel"
                        value={clientForm.phone}
                        onChange={(e) => handleClientFormChange("phone", e.target.value)}
                        className={fieldCls("phone")}
                      />
                    </div>
                  </div>

                  {/* Client address inputs */}
                  <div className="space-y-3 pt-2">
                    <label className="block text-xs font-bold text-[var(--text-strong)]">Adres klienta</label>
                    <AddressSearch onSelect={handleClientAddressSelect} />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="col-span-2">
                        <input
                          type="text"
                          placeholder="Ulica"
                          value={clientForm.street}
                          onChange={(e) => handleClientFormChange("street", e.target.value)}
                          className={fieldCls("street")}
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Nr budynku"
                          value={clientForm.buildingNumber}
                          onChange={(e) => handleClientFormChange("buildingNumber", e.target.value)}
                          className={fieldCls("buildingNumber")}
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Nr lokalu"
                          value={clientForm.apartmentNumber}
                          onChange={(e) => handleClientFormChange("apartmentNumber", e.target.value)}
                          className={fieldCls("apartmentNumber")}
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Kod pocztowy"
                          value={clientForm.postalCode}
                          onChange={(e) => handleClientFormChange("postalCode", e.target.value)}
                          className={fieldCls("postalCode")}
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="text"
                          placeholder="Miasto"
                          value={clientForm.city}
                          onChange={(e) => handleClientFormChange("city", e.target.value)}
                          className={fieldCls("city")}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={handleCreateNewClient}
                      disabled={creatingClient}
                      className="px-5 py-2.5 rounded-xl bg-brand text-white text-xs font-semibold hover:bg-brand-hover disabled:opacity-50 flex items-center gap-2 shadow-2xs"
                    >
                      {creatingClient ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Utwórz i wybierz klienta
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-[var(--line)]">
            <button
              type="button"
              onClick={handlePrevStep}
              className="px-5 py-2.5 rounded-xl border border-[var(--line-2)] text-[var(--text)] text-sm font-medium hover:bg-[var(--panel-2)] transition-colors"
            >
              ← Wstecz
            </button>
            <button
              type="button"
              onClick={handleNextStep}
              disabled={!resolvedClientId && (!resolvedContact.firstName || !resolvedContact.lastName)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-hover transition-colors shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Dalej: Adres inwestycji</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* ─── KROK 4: ADRES INWESTYCJII I SZCZEGÓŁY (CTA UTWÓRZ SZANSĘ) ───────── */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {currentStep === 4 && (
        <div className="bg-[var(--panel)] rounded-2xl border border-[var(--line)] p-6 md:p-8 shadow-2xs space-y-8">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-strong)] flex items-center gap-2">
              <MapPin className="w-5 h-5 text-brand" />
              Krok 4: Adres inwestycji, załączniki i szczegóły leada
            </h2>
            <p className="text-xs text-[var(--text-mute)] mt-1">
              Podaj miejsce realizacji, dodaj załączniki oraz ustal pochodzenie i uwagi do leada.
            </p>
          </div>

          {/* ── SECTION 1: ADRES INWESTYCJII / MONTAŻU ────────────────────────── */}
          {sameAsClientAddress ? (
            <div className="border border-brand/25 bg-brand/[0.04] rounded-2xl p-4 md:p-4.5 transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0 text-brand shadow-2xs">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[var(--text-strong)]">Adres inwestycji / montażu</span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-950 bg-emerald-100/90 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                        <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                        Taki sam jak adres klienta
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-dim)] truncate mt-0.5 font-medium">
                      {formattedClientAddress ? (
                        <span className="text-[var(--text-strong)]">{formattedClientAddress}</span>
                      ) : (
                        <span className="text-[var(--text-mute)] italic">Adres zostanie automatycznie pobrany z danych klienta</span>
                      )}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSameAsClientAddress(false);
                    // Pre-fill with current client address as starting point for editing if user wishes
                    if (!investmentStreet && !investmentCity) {
                      setInvestmentStreet(resolvedAddress.street || clientForm.street || "");
                      setInvestmentBuildingNumber(resolvedAddress.buildingNumber || clientForm.buildingNumber || "");
                      setInvestmentApartmentNumber(resolvedAddress.apartmentNumber || clientForm.apartmentNumber || "");
                      setInvestmentPostalCode(resolvedAddress.postalCode || clientForm.postalCode || "");
                      setInvestmentCity(resolvedAddress.city || clientForm.city || "");
                    }
                  }}
                  className="self-start sm:self-center px-3.5 py-1.5 rounded-xl border border-[var(--line-2)] bg-white hover:bg-[var(--panel-2)] hover:border-brand/40 text-xs font-semibold text-[var(--text-strong)] transition-all shrink-0 shadow-2xs"
                >
                  Podaj inny adres montażu
                </button>
              </div>
            </div>
          ) : (
            <div className="border border-[var(--line)] rounded-2xl p-5 md:p-6 bg-[var(--panel-2)]/40 space-y-4 transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--line-2)] pb-3">
                <div className="font-bold text-sm text-[var(--text-strong)] flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-brand" />
                  Adres inwestycji / montażu
                </div>

                <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-strong)] cursor-pointer bg-white px-3.5 py-2 rounded-xl border border-[var(--line-2)] hover:border-brand transition-colors shadow-2xs">
                  <input
                    type="checkbox"
                    checked={sameAsClientAddress}
                    onChange={(e) => setSameAsClientAddress(e.target.checked)}
                    className="rounded border-[var(--line-2)] text-brand focus:ring-brand w-4 h-4"
                  />
                  Taki sam adres jak adres klienta
                </label>
              </div>

              <AddressSearch onSelect={handleInvestmentAddressSelect} />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="col-span-2">
                  <label className="block text-[11px] font-medium text-[var(--text-mute)] mb-1">Ulica</label>
                  <input
                    type="text"
                    placeholder="Ulica"
                    value={investmentStreet}
                    onChange={(e) => setInvestmentStreet(e.target.value)}
                    className={fieldCls("investmentStreet")}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[var(--text-mute)] mb-1">Nr budynku</label>
                  <input
                    type="text"
                    placeholder="Nr budynku"
                    value={investmentBuildingNumber}
                    onChange={(e) => setInvestmentBuildingNumber(e.target.value)}
                    className={fieldCls("investmentBuildingNumber")}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[var(--text-mute)] mb-1">Nr lokalu</label>
                  <input
                    type="text"
                    placeholder="Nr lokalu"
                    value={investmentApartmentNumber}
                    onChange={(e) => setInvestmentApartmentNumber(e.target.value)}
                    className={fieldCls("investmentApartmentNumber")}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[var(--text-mute)] mb-1">Kod pocztowy</label>
                  <input
                    type="text"
                    placeholder="Kod pocztowy"
                    value={investmentPostalCode}
                    onChange={(e) => setInvestmentPostalCode(e.target.value)}
                    className={fieldCls("investmentPostalCode")}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-medium text-[var(--text-mute)] mb-1">Miasto</label>
                  <input
                    type="text"
                    placeholder="Miasto"
                    value={investmentCity}
                    onChange={(e) => setInvestmentCity(e.target.value)}
                    className={fieldCls("investmentCity")}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── SECTION 2: TEKST WŁASNY & ŹRÓDŁO LEADA ─────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tekst własny / Tytuł karty */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--text-strong)] flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand" />
                Tekst własny / Tytuł karty (opcjonalnie)
              </label>
              <input
                type="text"
                placeholder="np. Wycena zadaszenia z roletami - Pan Kowalski"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                className="w-full rounded-xl border border-[var(--line-2)] px-3.5 py-2.5 text-sm text-[var(--text-strong)] bg-white outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
              <p className="text-[11px] text-[var(--text-mute)]">
                Tytuł widoczny na tablicy Kanban w panelu handlowym.
              </p>
            </div>

            {/* Źródło leada (pochodzenie) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--text-strong)] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand" />
                Źródło leada (pochodzenie)
              </label>
              <select
                value={leadSource}
                onChange={(e) => setLeadSource(e.target.value)}
                className="w-full rounded-xl border border-[var(--line-2)] px-3.5 py-2.5 text-sm text-[var(--text-strong)] bg-white outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              >
                <option value="">-- Wybierz źródło pochodzenia leada --</option>
                {POPULAR_LEAD_SOURCES.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>

              {leadSource === "Inne" && (
                <input
                  type="text"
                  placeholder="Wpisz własne źródło leada..."
                  value={customLeadSource}
                  onChange={(e) => setCustomLeadSource(e.target.value)}
                  className="w-full rounded-xl border border-[var(--line-2)] px-3.5 py-2 text-xs text-[var(--text-strong)] bg-white outline-none focus:border-brand focus:ring-1 focus:ring-brand mt-2"
                />
              )}
            </div>
          </div>

          {/* ── SECTION 3: PLIKI I ZAŁĄCZNIKI ──────────────────────────────────── */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-[var(--text-strong)] flex items-center gap-2">
              <Upload className="w-4 h-4 text-brand" />
              Pliki i załączniki (opcjonalnie)
            </label>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[var(--line-2)] hover:border-brand/60 rounded-2xl p-6 text-center cursor-pointer bg-[var(--panel-2)]/50 hover:bg-brand/5 transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center mx-auto mb-2">
                <Upload className="w-5 h-5" />
              </div>
              <div className="text-xs font-semibold text-[var(--text-strong)]">
                Kliknij lub przeciągnij pliki tutaj
              </div>
              <div className="text-[11px] text-[var(--text-mute)] mt-0.5">
                Projekty, zdjęcia z pomiarów, rzuty architektoniczne (PDF, PNG, JPG)
              </div>
            </div>

            {uploading && (
              <div className="text-xs text-brand flex items-center gap-2 font-medium">
                <Loader2 className="w-4 h-4 animate-spin" /> Wgrywanie załączników...
              </div>
            )}

            {uploadedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {uploadedFiles.map((file) => (
                  <div
                    key={file.storageId}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[var(--line-2)] bg-white text-xs text-[var(--text-strong)] shadow-2xs"
                  >
                    <FileText className="w-3.5 h-3.5 text-brand" />
                    <span className="truncate max-w-[200px] font-medium">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeUploadedFile(file.storageId)}
                      className="text-slate-400 hover:text-red-500 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── SECTION 4: UWAGI / KOMENTARZ ──────────────────────────────────── */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[var(--text-strong)] flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand" />
              Uwagi / Komentarz do szansy
            </label>
            <textarea
              rows={3}
              placeholder="Dodatkowe informacje dla handlowca lub ekipy montażowej..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full rounded-xl border border-[var(--line-2)] p-3.5 text-sm text-[var(--text-strong)] bg-white outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </div>

          {/* ── SECTION 5: PODSUMOWANIE WYBORU ────────────────────────────────── */}
          <div className="rounded-2xl border border-[var(--line-2)] bg-[var(--panel-2)]/80 p-5 space-y-2">
            <div className="text-xs font-bold text-[var(--text-strong)] uppercase tracking-wider">
              Podsumowanie tworzonej szansy:
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-[var(--text)] pt-1">
              <div>
                <span className="text-[var(--text-mute)]">Usługi:</span>{" "}
                <strong className="font-semibold text-[var(--text-strong)]">
                  {selectedServices.length > 0 ? selectedServices.join(", ") : "Nie określono (ogólna)"}
                </strong>
              </div>
              <div>
                <span className="text-[var(--text-mute)]">Klient:</span>{" "}
                <strong className="font-semibold text-[var(--text-strong)]">
                  {resolvedClientName || "Brak wybranego klienta"}
                </strong>
              </div>
              <div>
                <span className="text-[var(--text-mute)]">Adres inwestycji:</span>{" "}
                <strong className="font-semibold text-[var(--text-strong)]">
                  {[investmentStreet, investmentBuildingNumber, investmentCity].filter(Boolean).join(" ") ||
                    "Taki sam jak klient"}
                </strong>
              </div>
            </div>
          </div>

          {/* ── CTA BUTTONS ───────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between pt-4 border-t border-[var(--line)]">
            <button
              type="button"
              onClick={handlePrevStep}
              className="px-5 py-2.5 rounded-xl border border-[var(--line-2)] text-[var(--text)] text-sm font-medium hover:bg-[var(--panel-2)] transition-colors"
            >
              ← Wstecz (Klient)
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || uploading}
              className="flex items-center gap-2 px-8 py-3 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand-hover transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Tworzenie szansy…</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 text-white" />
                  <span>Utwórz szansę</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
