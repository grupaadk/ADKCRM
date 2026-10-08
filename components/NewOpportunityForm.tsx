"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import AddressSearch, { type AddressData } from "@/components/AddressSearch";
import ServiceIcon from "@/components/ServiceIcon";
import { TerraceRoofConfigurator } from "@/components/TerraceRoofConfigurator";
import { GlassEnclosureConfigurator } from "@/components/GlassEnclosureConfigurator";
import { formatPLN } from "@/lib/terraceCalculatorEngine";
import { CustomSelect } from "@/components/ui/CustomSelect";
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
  TrendingUp,
  Copy,
  Eye,
  ExternalLink,
} from "lucide-react";

interface NewOpportunityFormProps {
  initialClientId?: Id<"clients">;
  onSuccess?: (opportunityId: string) => void;
  onCancel?: () => void;
}

export type WizardStep = 1 | 2 | 3 | 4 | 5;
type ClientMode = "search" | "create";
type ClientType = "individual" | "business";

const STEP_DEFINITIONS: { id: WizardStep; title: string; subtitle: string; icon: typeof Briefcase }[] = [
  { id: 1, title: "Wybór usługi", subtitle: "Wskaż interesujące usługi", icon: Briefcase },
  { id: 2, title: "Klient", subtitle: "Wybierz lub utwórz", icon: User },
  { id: 3, title: "Konfiguracja", subtitle: "Specyfikacja wyceny", icon: SlidersHorizontal },
  { id: 4, title: "Adres i szczegóły", subtitle: "Montaż i załączniki", icon: MapPin },
  { id: 5, title: "Podsumowanie", subtitle: "Wykaz pozycji i finanse", icon: CheckCircle2 },
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

  // ─── Current User for Role Check ───────────────────────────────────────────
  const currentUser = useQuery(api.users.me);

  // ─── Step 2: Client State ───────────────────────────────────────────────────
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

  const currentClientType: ClientType =
    (resolvedClientDoc?.clientType || clientForm.clientType || "individual") as ClientType;
  const vatRatePercent = currentClientType === "business" ? 23 : 8;

  // ─── Step 3: Service Configurations State ──────────────────────────────────
  const [activeConfigIndex, setActiveConfigIndex] = useState<number>(0);
  const [serviceConfigurationsMap, setServiceConfigurationsMap] = useState<
    Record<
      string,
      {
        serviceName: string;
        calculatorType: string;
        input: Record<string, unknown> | null;
        result: Record<string, unknown> | null;
        offerText: string;
        isValid: boolean;
      }
    >
  >({});

  const configurableServices = selectedServices.filter(
    (s) => s === "Zadaszenie tarasu" || s.toLowerCase().includes("zadaszen") || s === "Zabudowa tarasu" || s.toLowerCase().includes("zabudow")
  );

  // ─── Step 4: Address & Lead Details State ──────────────────────────────────
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
  const [uploadedFiles, setUploadedFiles] = useState<{
    name: string;
    storageId: string;
    url?: string;
    type?: string;
    size?: number;
  }[]>([]);
  const [previewModalFile, setPreviewModalFile] = useState<{
    name: string;
    url: string;
    type?: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedOfferText, setCopiedOfferText] = useState(false);
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

  // ─── Helper to extract calculation totals from configurator results ─────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function getResultTotals(res: any) {
    if (!res) return { net: 0, gross: 0, kc: 0, profitZ: 0, areaSqM: 0 };
    const poly = res.options?.polycarbonate;
    const net = poly?.totalNet ?? res.finalPriceNet ?? res.totalNet ?? res.totalNetPrice ?? res.totalClientNet ?? 0;
    const gross = poly?.totalGross ?? res.finalPriceGross ?? res.totalGross ?? (net > 0 ? Math.round(net * (1 + vatRatePercent / 100)) : 0);
    const kc = poly?.costBasisKc ?? res.costKc ?? res.costBasisKc ?? res.totalCostNet ?? 0;
    const profitZ = poly?.profitZ ?? res.profitZ ?? res.totalProfitZ ?? (net - kc);
    const areaSqM = res.input?.areaSqM ?? poly?.areaSqM ?? res.areaSqM ?? 0;
    return { net, gross, kc, profitZ, areaSqM };
  }

  // ─── Calculated Totals across Configurations ────────────────────────────────
  const activeConfigs = Object.values(serviceConfigurationsMap);
  let totalNetPrice = 0;
  let totalCostKc = 0;
  let totalProfitZ = 0;
  let totalGrossPrice = 0;

  activeConfigs.forEach((cfg) => {
    if (cfg?.result) {
      const { net, gross, kc, profitZ } = getResultTotals(cfg.result);
      totalNetPrice += net;
      totalGrossPrice += gross;
      totalCostKc += kc;
      totalProfitZ += profitZ;
    }
  });

  if (totalNetPrice > 0 && totalGrossPrice === 0) {
    totalGrossPrice = Math.round(totalNetPrice * (1 + vatRatePercent / 100));
  }
  const totalVatAmount = Math.max(0, totalGrossPrice - totalNetPrice);
  const marginPercent = totalNetPrice > 0 ? (totalProfitZ / totalNetPrice) * 100 : 0;

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

  function formatFileSize(bytes?: number): string {
    if (!bytes || bytes <= 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
        const localUrl = URL.createObjectURL(file);
        setUploadedFiles((prev) => [
          ...prev,
          {
            name: file.name,
            storageId,
            url: localUrl,
            type: file.type || "application/octet-stream",
            size: file.size,
          },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się wgrać pliku");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeUploadedFile(storageId: string) {
    setUploadedFiles((prev) => {
      const removed = prev.find((f) => f.storageId === storageId);
      if (removed?.url) URL.revokeObjectURL(removed.url);
      return prev.filter((f) => f.storageId !== storageId);
    });
  }

  async function handleSubmit() {
    if (!resolvedClientId && (!resolvedContact.firstName || !resolvedContact.lastName)) {
      setError("Wybierz lub utwórz klienta w kroku 2 przed utworzeniem szansy.");
      setCurrentStep(2);
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

      const configurationsArray = Object.values(serviceConfigurationsMap).map((cfg) => ({
        serviceName: cfg.serviceName,
        calculatorType: cfg.calculatorType,
        input: cfg.input,
        result: cfg.result,
        updatedAt: Date.now(),
      }));

      let calculatedPrice: number | undefined = undefined;
      let calculatedCost: number | undefined = undefined;
      let calculatedProfit: number | undefined = undefined;

      if (configurationsArray.length > 0) {
        let totalPrice = 0;
        let totalCost = 0;
        let totalProfit = 0;
        for (const cfg of configurationsArray) {
          if (cfg.result) {
            const { net, kc, profitZ } = getResultTotals(cfg.result);
            totalPrice += net;
            totalCost += kc;
            totalProfit += profitZ;
          }
        }
        if (totalPrice > 0) calculatedPrice = Math.round(totalPrice);
        if (totalCost > 0) calculatedCost = Math.round(totalCost);
        if (totalProfit > 0) calculatedProfit = Math.round(totalProfit);
      }

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
        price: calculatedPrice,
        cost: calculatedCost,
        profit: calculatedProfit,
        serviceConfigurations: configurationsArray.length > 0 ? configurationsArray : undefined,
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
    if (targetStep >= 3 && targetStep <= 5) return !!resolvedClientId || (!!resolvedContact.firstName && !!resolvedContact.lastName);
    return false;
  }

  function handleNextStep() {
    setError(null);
    if (currentStep === 2) {
      if (!resolvedClientId && (!resolvedContact.firstName || !resolvedContact.lastName)) {
        setError("Wybierz klienta z listy lub utwórz nowego w kroku 2 przed przejściem do konfiguracji.");
        return;
      }
    }
    if (currentStep < 5) {
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

  const formattedInvestmentStreetWithNumber = [
    investmentStreet,
    [investmentBuildingNumber, investmentApartmentNumber].filter(Boolean).join("/"),
  ].filter(Boolean).join(" ");

  const formattedInvestmentCityWithPostal = [
    investmentPostalCode,
    investmentCity,
  ].filter(Boolean).join(" ");

  const formattedInvestmentAddress = [
    formattedInvestmentStreetWithNumber,
    formattedInvestmentCityWithPostal,
  ].filter(Boolean).join(", ");

  const finalLeadSourceStr = leadSource === "Inne" ? customLeadSource.trim() : leadSource.trim();

  const fieldCls = (field: string, forceDisabled = false) =>
    forceDisabled
      ? "w-full rounded-xl border border-[var(--line-2)] bg-[var(--panel-2)] px-3.5 py-2.5 text-sm text-[var(--text-mute)] cursor-not-allowed"
      : `w-full rounded-xl border px-3.5 py-2.5 text-sm text-[var(--text-strong)] bg-white outline-none placeholder:text-slate-400 focus:border-brand focus:ring-1 focus:ring-brand transition-colors ${
          clientErrors[field] ? "border-red-400 focus:ring-red-400 bg-red-50/20" : "border-[var(--line-2)]"
        }`;

  const isSidebarActive = currentStep === 3 || currentStep === 4;

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
              Wypełnij formularz w 5 krokach, aby stworzyć nowy lead w CRM.
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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

      {/* ─── MAIN GRID LAYOUT (Wizard Steps + Sticky Right Summary on Steps 3 & 4) ───── */}
      <div className={`grid grid-cols-1 ${isSidebarActive ? "lg:grid-cols-12 gap-6 items-start" : "w-full space-y-6"}`}>
        {/* ─── LEFT COLUMN: ACTIVE STEP CONTENT ──────────────────────────────── */}
        <div className={isSidebarActive ? "lg:col-span-8 space-y-6" : "w-full space-y-6"}>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <span>Dalej: Wybór klienta</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────────── */}
          {/* ─── KROK 2: WYBIERZ KLIENTA LUB UTWÓRZ NOWEGO ───────────────────────── */}
          {/* ─────────────────────────────────────────────────────────────────────── */}
          {currentStep === 2 && (
            <div className="bg-[var(--panel)] rounded-2xl border border-[var(--line)] p-6 md:p-8 shadow-2xs space-y-6">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-strong)] flex items-center gap-2">
                  <User className="w-5 h-5 text-brand" />
                  Krok 2: Wybierz klienta lub utwórz nowego
                </h2>
                <p className="text-xs text-[var(--text-mute)] mt-1">
                  Wyszukaj istniejącego klienta w bazie CRM lub dodaj nowego. Wybór klienta określa stawkę VAT (8% vs 23%).
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
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                          Wybrany klient
                        </span>
                        {currentClientType === "business" ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            Firma (VAT 23%)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            Osoba prywatna (VAT 8%)
                          </span>
                        )}
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
                                {c.clientType === "business" ? "Firma (VAT 23%)" : "Osoba (VAT 8%)"}
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
                          <label className="flex items-center gap-2 text-xs text-[var(--text-strong)] cursor-pointer font-medium">
                            <input
                              type="radio"
                              name="clientType"
                              checked={clientForm.clientType === "individual"}
                              onChange={() => handleClientTypeChange("individual")}
                              className="text-brand focus:ring-brand"
                            />
                            Osoba prywatna (Stawka VAT 8%)
                          </label>
                          <label className="flex items-center gap-2 text-xs text-[var(--text-strong)] cursor-pointer font-medium">
                            <input
                              type="radio"
                              name="clientType"
                              checked={clientForm.clientType === "business"}
                              onChange={() => handleClientTypeChange("business")}
                              className="text-brand focus:ring-brand"
                            />
                            Firma / NIP (Stawka VAT 23%)
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
                  ← Wstecz (Usługi)
                </button>
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={!resolvedClientId && (!resolvedContact.firstName || !resolvedContact.lastName)}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-hover transition-colors shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Dalej: Konfiguracja wyceny</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────────── */}
          {/* ─── KROK 3: KONFIGURACJA ────────────────────────────────────────────── */}
          {/* ─────────────────────────────────────────────────────────────────────── */}
          {currentStep === 3 && (
            <div className="bg-[var(--panel)] rounded-2xl border border-[var(--line)] p-6 md:p-8 shadow-2xs space-y-6">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-strong)] flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-brand" />
                  Krok 3: Konfiguracja parametrów wyceny
                </h2>
                <p className="text-xs text-[var(--text-mute)] mt-1">
                  Podaj wymiary i opcje montażowe wybranej usługi, aby automatycznie przeliczyć cennik i koszty.
                </p>
              </div>

              {configurableServices.length > 0 ? (
                <div className="space-y-6">
                  {/* Service Sub-steps Navigation Tabs if multiple configurable services */}
                  {configurableServices.length > 1 && (
                    <div className="flex flex-wrap gap-2 border-b border-[var(--line-2)] pb-3">
                      {configurableServices.map((srv, idx) => (
                        <button
                          key={srv}
                          type="button"
                          onClick={() => setActiveConfigIndex(idx)}
                          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                            activeConfigIndex === idx
                              ? "bg-brand text-white shadow-2xs"
                              : "bg-[var(--panel-2)] text-[var(--text-dim)] hover:bg-slate-200"
                          }`}
                        >
                          Krok 3{String.fromCharCode(97 + idx)}: {srv}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Render current service configurator */}
                  {(() => {
                    const currentServiceName = configurableServices[activeConfigIndex] || configurableServices[0];
                    const isTerraceRoof =
                      currentServiceName === "Zadaszenie tarasu" ||
                      currentServiceName.toLowerCase().includes("zadaszen");
                    const isGlassEnclosure = 
                      currentServiceName === "Zabudowa tarasu" ||
                      currentServiceName.toLowerCase().includes("zabudow");

                    if (isTerraceRoof) {
                      return (
                        <TerraceRoofConfigurator
                          key={currentServiceName}
                          initialInput={serviceConfigurationsMap[currentServiceName]?.input}
                          clientType={currentClientType}
                          userRole={currentUser?.role}
                          onChange={(data) => {
                            setServiceConfigurationsMap((prev) => {
                              const existing = prev[currentServiceName];
                              if (
                                existing &&
                                existing.serviceName === data.serviceName &&
                                existing.calculatorType === data.calculatorType &&
                                existing.isValid === data.isValid &&
                                existing.offerText === data.offerText &&
                                JSON.stringify(existing.input) === JSON.stringify(data.input) &&
                                JSON.stringify(existing.result) === JSON.stringify(data.result)
                              ) {
                                return prev;
                              }
                              return {
                                ...prev,
                                [currentServiceName]: data,
                              };
                            });
                          }}
                        />
                      );
                    }

                    if (isGlassEnclosure) {
                      return (
                        <GlassEnclosureConfigurator
                          key={currentServiceName}
                          initialInput={serviceConfigurationsMap[currentServiceName]?.input}
                          onChange={(data) => {
                            setServiceConfigurationsMap((prev) => {
                              const existing = prev[currentServiceName];
                              if (
                                existing &&
                                existing.serviceName === data.serviceName &&
                                existing.calculatorType === data.calculatorType &&
                                existing.isValid === data.isValid &&
                                existing.offerText === data.offerText &&
                                JSON.stringify(existing.input) === JSON.stringify(data.input) &&
                                JSON.stringify(existing.result) === JSON.stringify(data.result)
                              ) {
                                return prev;
                              }
                              return {
                                ...prev,
                                [currentServiceName]: data,
                              };
                            });
                          }}
                        />
                      );
                    }

                    return (
                      <div className="p-8 text-center text-xs text-[var(--text-mute)] border border-dashed border-[var(--line-2)] rounded-xl">
                        Konfigurator dla usługi &quot;{currentServiceName}&quot; nie jest jeszcze dostępny.
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[var(--line-2)] bg-[var(--panel-2)]/60 p-10 md:p-14 text-center max-w-2xl mx-auto space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-brand/10 text-brand flex items-center justify-center mx-auto shadow-2xs">
                    <SlidersHorizontal className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[var(--text-strong)]">
                      Brak wyznaczonych parametrów
                    </h3>
                    <p className="text-xs text-[var(--text-dim)] max-w-md mx-auto mt-1 leading-relaxed">
                      Wybrane usługi ({selectedServices.length > 0 ? selectedServices.join(", ") : "ogólna szansa"}) nie wymagają kalkulatora wymiarów. Możesz przejść do kroku z adresem inwestycji.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Możesz przejść do kroku 4</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => {
                    if (activeConfigIndex > 0) {
                      setActiveConfigIndex((prev) => prev - 1);
                    } else {
                      handlePrevStep();
                    }
                  }}
                  className="px-5 py-2.5 rounded-xl border border-[var(--line-2)] text-[var(--text)] text-sm font-medium hover:bg-[var(--panel-2)] transition-colors"
                >
                  ← Wstecz (Klient)
                </button>

                {activeConfigIndex < configurableServices.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setActiveConfigIndex((prev) => prev + 1)}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-hover transition-colors shadow-2xs"
                  >
                    <span>Następna konfiguracja</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-hover transition-colors shadow-2xs cursor-pointer"
                  >
                    <span>Dalej</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────────── */}
          {/* ─── KROK 4: ADRES INWESTYCJI I SZCZEGÓŁY (CTA UTWÓRZ SZANSĘ) ───────── */}
          {/* ─────────────────────────────────────────────────────────────────────── */}
          {currentStep === 4 && (
            <div className="bg-[var(--panel)] rounded-2xl border border-[var(--line)] p-6 md:p-8 shadow-2xs space-y-8">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-strong)] flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-brand" />
                  Krok 4: Adres inwestycji, załączniki i podsumowanie leada
                </h2>
                <p className="text-xs text-[var(--text-mute)] mt-1">
                  Podaj miejsce realizacji, dodaj załączniki oraz sprawdź pełne podsumowanie wyceny przed jej utworzeniem.
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
                  <CustomSelect
                    value={leadSource}
                    options={POPULAR_LEAD_SOURCES.map((src) => ({ value: src, label: src }))}
                    onChange={(val) => setLeadSource(val)}
                    placeholder="-- Wybierz źródło pochodzenia leada --"
                  />

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
                        {file.url && (
                          <button
                            type="button"
                            onClick={() => setPreviewModalFile({ name: file.name, url: file.url!, type: file.type })}
                            className="text-slate-400 hover:text-brand p-0.5 cursor-pointer"
                            title="Podgląd pliku"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeUploadedFile(file.storageId)}
                          className="text-slate-400 hover:text-red-500 p-0.5 cursor-pointer"
                          title="Usuń plik"
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

              {/* ── STEP 4 CTA BUTTONS ─────────────────────────────────────────────── */}
              <div className="flex items-center justify-between pt-4 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="px-5 py-2.5 rounded-xl border border-[var(--line-2)] text-[var(--text)] text-sm font-medium hover:bg-[var(--panel-2)] transition-colors cursor-pointer"
                >
                  ← Wstecz (Konfiguracja)
                </button>

                <button
                  type="button"
                  onClick={handleNextStep}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-hover transition-colors shadow-2xs cursor-pointer"
                >
                  <span>Dalej: Podsumowanie</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────────── */}
          {/* ─── KROK 5: PODSUMOWANIE SZANSY SPRZEDAŻY ──────────────────────────── */}
          {/* ─────────────────────────────────────────────────────────────────────── */}
          {currentStep === 5 && (
            <div className="bg-[var(--panel)] rounded-2xl border border-[var(--line)] p-6 md:p-8 shadow-2xs space-y-7">
              {/* Nagłówek kroku 5 */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--line-2)] pb-4">
                <div>
                  <h2 className="text-xl font-extrabold text-[var(--text-strong)] flex items-center gap-2.5">
                    <CheckCircle2 className="w-6 h-6 text-brand stroke-[2.5]" />
                    <span>Krok 5: Podsumowanie szansy sprzedaży</span>
                  </h2>
                  <p className="text-xs text-[var(--text-mute)] mt-1">
                    Przejrzyj dane klienta, pozycje zamówienia oraz bilans finansowy przed utworzeniem szansy.
                  </p>
                </div>
                <div className="self-start md:self-auto">
                  {currentClientType === "business" ? (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200 shadow-2xs">
                      Stawka VAT 23% (firma)
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200 shadow-2xs">
                      Stawka VAT 8% (klient prywatny)
                    </span>
                  )}
                </div>
              </div>

              {/* ── 1. ANALIZA FINANSOWA (WSKAŹNIKI WEWNĘTRZNE W TOPIE) ── */}
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50/70 via-emerald-50/30 to-white p-5 shadow-2xs space-y-3">
                <div className="flex items-center gap-2 border-b border-emerald-200/60 pb-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-950 uppercase tracking-wider">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <span>Analiza finansowa (wskaźniki wewnętrzne)</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-0.5">
                  <div className="bg-white/95 p-3.5 rounded-xl border border-emerald-200/70 shadow-2xs">
                    <div className="text-[11px] font-medium text-slate-500">Koszt własny (Kc)</div>
                    <div className="text-base font-bold text-slate-900 mt-0.5">{formatPLN(totalCostKc)}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Materiały i montaż netto</div>
                  </div>
                  <div className="bg-white/95 p-3.5 rounded-xl border border-emerald-200/70 shadow-2xs">
                    <div className="text-[11px] font-medium text-slate-500">Szacowany zysk (Z)</div>
                    <div className="text-base font-bold text-emerald-700 mt-0.5">{formatPLN(totalProfitZ)}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Przychód netto minus koszty</div>
                  </div>
                  <div className="bg-white/95 p-3.5 rounded-xl border border-emerald-200/70 shadow-2xs">
                    <div className="text-[11px] font-medium text-slate-500">Marża handlowa</div>
                    <div className="text-base font-bold text-emerald-700 mt-0.5">{marginPercent.toFixed(1)}%</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Rentowność wyceny</div>
                  </div>
                </div>
              </div>

              {/* ── 2. DANE KLIENTA I ADRES INWESTYCJI ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Dane klienta i adres zamieszkania */}
                <div className="bg-white rounded-2xl p-5 border border-[var(--line-2)] space-y-3 shadow-2xs">
                  <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2.5">
                    <User className="w-4 h-4 text-brand" />
                    <span>Dane klienta i adres zamieszkania</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="font-bold text-slate-900 text-sm">{resolvedClientName || "—"}</div>
                    {resolvedContact.phone && (
                      <div className="text-slate-600 flex items-center gap-1.5">
                        <span className="font-medium text-slate-500">Telefon:</span> {resolvedContact.phone}
                      </div>
                    )}
                    {resolvedContact.email && (
                      <div className="text-slate-600 flex items-center gap-1.5">
                        <span className="font-medium text-slate-500">Email:</span> {resolvedContact.email}
                      </div>
                    )}
                    <div className="text-slate-600 pt-1 border-t border-slate-100">
                      <span className="font-medium text-slate-500">Adres główny:</span>{" "}
                      {formattedClientAddress || "Brak podanego adresu"}
                    </div>
                  </div>
                </div>

                {/* Adres inwestycji i pochodzenie leada */}
                <div className="bg-white rounded-2xl p-5 border border-[var(--line-2)] space-y-3 shadow-2xs">
                  <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2.5">
                    <MapPin className="w-4 h-4 text-brand" />
                    <span>Adres inwestycji i pochodzenie leada</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="text-slate-500 font-medium mb-1">Miejsce montażu:</div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-medium text-slate-800">
                        {sameAsClientAddress ? (
                          <span className="flex items-center gap-1.5 text-emerald-800">
                            <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                            Taki sam jak adres klienta ({formattedClientAddress || "zamieszkania"})
                          </span>
                        ) : (
                          formattedInvestmentAddress || "Brak osobnego adresu montażu"
                        )}
                      </div>
                    </div>
                    {finalLeadSourceStr && (
                      <div className="text-slate-600 pt-1 flex items-center gap-1.5">
                        <span className="font-medium text-slate-500">Źródło leada:</span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800 font-semibold text-[11px]">
                          {finalLeadSourceStr}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── 3. WYKAZ POZYCJI I USŁUG (OBSŁUGA JEDNEJ LUB WIELU USŁUG) ── */}
              <div className="bg-white rounded-2xl p-5 md:p-6 border border-[var(--line-2)] space-y-4 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-brand" />
                      <span>Wykaz pozycji i usług ({selectedServices.length})</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Zestawienie wszystkich usług objętych niniejszą szansą sprzedaży
                    </p>
                  </div>
                  <div className="text-xs text-slate-500 font-medium self-start sm:self-auto bg-slate-100 px-2.5 py-1 rounded-lg">
                    Wycenione pozycje: {Object.values(serviceConfigurationsMap).filter((c) => c?.result).length} z {selectedServices.length}
                  </div>
                </div>

                {selectedServices.length === 0 ? (
                  <div className="text-xs text-slate-500 italic p-6 border border-dashed border-[var(--line-2)] rounded-xl text-center">
                    Nie wybrano jeszcze żadnej usługi (Krok 1).
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedServices.map((serviceName, idx) => {
                      const cfg = serviceConfigurationsMap[serviceName];
                      const totals = getResultTotals(cfg?.result);
                      const isConfigured = totals.net > 0;

                      return (
                        <div
                          key={serviceName}
                          className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-white hover:border-slate-300 transition-all space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 pb-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0 border border-brand/20 shadow-2xs">
                                <ServiceIcon name={serviceName} size={18} />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-semibold text-slate-400">#{idx + 1}</span>
                                  <h4 className="font-bold text-slate-900 text-sm truncate">{serviceName}</h4>
                                </div>
                                {cfg?.input ? (
                                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                    {cfg.calculatorType === "GLASS_ENCLOSURE" ? (
                                      <>
                                        Ścianki: <strong className="text-slate-700">{cfg.input.walls?.length ?? 0} szt.</strong>
                                        {(cfg.input.accessories?.length ?? 0) > 0 && (
                                          <>, dodatki: <strong className="text-slate-700">{cfg.input.accessories.length} szt.</strong></>
                                        )}
                                        {totals.areaSqM > 0 && ` (szkło: ${totals.areaSqM.toFixed(2)} m²)`}
                                      </>
                                    ) : (
                                      <>
                                        Wymiary: <strong className="text-slate-700">{cfg.input.widthCm} cm × {cfg.input.depthCm} cm</strong>
                                        {totals.areaSqM > 0 && ` (${totals.areaSqM.toFixed(2)} m²)`}
                                      </>
                                    )}
                                  </p>
                                ) : (
                                  <p className="text-[11px] text-slate-500 mt-0.5">
                                    Wycena indywidualna na etapie oferty
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="text-left sm:text-right self-start sm:self-auto shrink-0">
                              {isConfigured ? (
                                <div>
                                  <div className="text-base font-extrabold text-slate-900">
                                    {formatPLN(totals.net)} <span className="text-xs font-semibold text-slate-500">netto</span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-medium">
                                    Brutto z VAT: {formatPLN(totals.gross)}
                                  </div>
                                </div>
                              ) : (
                                <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200/80">
                                  Do wyceny w ofercie
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Specyfikacja szczegółowa pozycji jeśli skonfigurowana */}
                          {cfg?.input && (
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                              {cfg.calculatorType === "GLASS_ENCLOSURE" ? (
                                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                  <span className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 font-medium">
                                    Ścianki: <strong>{cfg.input.walls?.length ?? 0} szt.</strong>
                                  </span>
                                  {(cfg.input.accessories?.length ?? 0) > 0 && (
                                    <span className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 font-medium">
                                      Dodatki/lamele: <strong>{cfg.input.accessories.length} szt.</strong>
                                    </span>
                                  )}
                                  {totals.areaSqM > 0 && (
                                    <span className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 font-medium">
                                      Łącznie szkło: <strong>{totals.areaSqM.toFixed(2)} m²</strong>
                                    </span>
                                  )}
                                  {cfg.result?.installationNet > 0 && (
                                    <span className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 font-medium">
                                      Montaż: <strong>{formatPLN(cfg.result.installationNet)} netto</strong>
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                  <span className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 font-medium">
                                    Szerokość: <strong>{cfg.input.widthCm} cm</strong>
                                  </span>
                                  <span className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 font-medium">
                                    Głębokość: <strong>{cfg.input.depthCm} cm</strong>
                                  </span>
                                  {totals.areaSqM > 0 && (
                                    <span className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 font-medium">
                                      Powierzchnia: <strong>{totals.areaSqM.toFixed(2)} m²</strong>
                                    </span>
                                  )}
                                  <span className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 font-medium">
                                    Pokrycie: <strong>Poliwęglan</strong>
                                  </span>
                                </div>
                              )}

                              {cfg.offerText && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(cfg.offerText);
                                    setCopiedOfferText(true);
                                    setTimeout(() => setCopiedOfferText(false), 2000);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-brand/30 bg-brand/5 hover:bg-brand/15 text-brand text-[11px] font-semibold transition-colors cursor-pointer"
                                  title="Skopiuj treść oferty dla tej pozycji"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Kopiuj opis pozycji</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── 4. ZAŁĄCZONE PLIKI I DOKUMENTACJA (Z PODGLĄDEM) ── */}
              <div className="bg-white rounded-2xl p-5 border border-[var(--line-2)] space-y-4 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-brand" />
                      <span>Załączone pliki i dokumentacja ({uploadedFiles.length})</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Pliki wgrane do szansy sprzedaży (zdjęcia, projekty, rzuty)
                    </p>
                  </div>

                  {Object.values(serviceConfigurationsMap).some((cfg) => cfg.offerText) && (
                    <button
                      type="button"
                      onClick={() => {
                        const texts = Object.values(serviceConfigurationsMap)
                          .map((cfg) => cfg.offerText)
                          .filter(Boolean)
                          .join("\n\n---\n\n");
                        if (texts) {
                          navigator.clipboard.writeText(texts);
                          setCopiedOfferText(true);
                          setTimeout(() => setCopiedOfferText(false), 2000);
                        }
                      }}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-brand/30 bg-brand/10 hover:bg-brand/20 text-brand text-xs font-semibold transition-colors shadow-2xs cursor-pointer self-start sm:self-auto"
                    >
                      {copiedOfferText ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                          <span>Skopiowano treść oferty!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-brand" />
                          <span>Kopiuj pełną treść oferty</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Grid załączników z podglądem */}
                {uploadedFiles.length === 0 ? (
                  <div className="text-xs text-slate-400 italic p-4 rounded-xl border border-dashed border-slate-200 text-center">
                    Brak wgranych załączników.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {uploadedFiles.map((file) => {
                      const isImage = file.type?.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name);
                      const isPdf = file.type?.includes("pdf") || /\.pdf$/i.test(file.name);

                      return (
                        <div
                          key={file.storageId}
                          className="group relative border border-slate-200 hover:border-brand/40 bg-slate-50/50 hover:bg-white rounded-xl p-3 transition-all flex flex-col justify-between gap-2 shadow-2xs"
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            {/* Miniaturka lub ikona pliku */}
                            {isImage && file.url ? (
                              <div
                                onClick={() => setPreviewModalFile({ name: file.name, url: file.url!, type: file.type })}
                                className="w-12 h-12 rounded-lg bg-slate-200 overflow-hidden shrink-0 cursor-pointer border border-slate-200 relative group-hover:ring-2 group-hover:ring-brand/40 transition-all"
                              >
                                <img
                                  src={file.url}
                                  alt={file.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-brand/10 text-brand flex items-center justify-center shrink-0 border border-brand/20">
                                <FileText className="w-5 h-5" />
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-slate-800 truncate" title={file.name}>
                                {file.name}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                                <span>{formatFileSize(file.size)}</span>
                                {isImage && <span className="text-[10px] bg-slate-200/80 px-1.5 py-0.2 rounded font-medium">Obraz</span>}
                                {isPdf && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.2 rounded font-medium">PDF</span>}
                              </div>
                            </div>
                          </div>

                          {/* Przyciski akcji pliku */}
                          <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-100">
                            {file.url && (
                              <button
                                type="button"
                                onClick={() => setPreviewModalFile({ name: file.name, url: file.url!, type: file.type })}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-brand/10 text-slate-700 hover:text-brand border border-slate-200 hover:border-brand/30 text-[11px] font-semibold transition-all cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Podgląd</span>
                              </button>
                            )}
                            {file.url && (
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded-lg text-slate-400 hover:text-brand hover:bg-slate-100 transition-colors"
                                title="Otwórz w nowej karcie"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Uwagi wstępne jeśli wpisane */}
                {comment.trim() && (
                  <div className="pt-2 border-t border-slate-100 text-xs">
                    <span className="font-semibold text-slate-700">Uwagi wstępne do szansy:</span>
                    <p className="mt-1 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 whitespace-pre-wrap">
                      {comment.trim()}
                    </p>
                  </div>
                )}
              </div>

              {/* ── 5. PODSUMOWANIE FINANSOWE OFERTY (NA SAMYM DOLE) ── */}
              <div className="bg-white rounded-2xl p-6 border border-[var(--line-2)] space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Podsumowanie finansowe oferty</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Zestawienie końcowych kwot dla klienta</p>
                  </div>
                  <span className="self-start sm:self-auto px-3 py-1 rounded-full text-xs font-semibold bg-brand/10 text-brand border border-brand/20">
                    {currentClientType === "business" ? "Stawka VAT 23% (firma)" : "Stawka VAT 8% (klient prywatny)"}
                  </span>
                </div>

                <div className="space-y-2.5 text-sm text-slate-600">
                  <div className="flex items-center justify-between py-1">
                    <span className="font-medium text-slate-600">Wartość netto pozycji:</span>
                    <span className="font-bold text-slate-900 text-base">{formatPLN(totalNetPrice)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-t border-slate-100">
                    <span className="font-medium text-slate-600">Podatek VAT ({vatRatePercent}%):</span>
                    <span className="font-semibold text-slate-700">{formatPLN(totalVatAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-t-2 border-slate-200 bg-slate-50/80 -mx-6 px-6 rounded-b-xl">
                    <div>
                      <span className="text-base font-extrabold text-slate-900">Suma brutto do zapłaty:</span>
                      <p className="text-[11px] text-slate-500 font-normal">Kwota uwzględnia wycenę usług oraz montaż</p>
                    </div>
                    <span className="text-2xl font-black text-brand tracking-tight">{formatPLN(totalGrossPrice)}</span>
                  </div>
                </div>
              </div>

              {/* ── 6. PRZYCISKI AKCJI (CTA) ── */}
              <div className="flex items-center justify-between pt-5 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="px-5 py-2.5 rounded-xl border border-[var(--line-2)] text-[var(--text)] text-sm font-medium hover:bg-[var(--panel-2)] transition-colors cursor-pointer"
                >
                  ← Wstecz (adres i szczegóły)
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || uploading}
                  className="flex items-center gap-2.5 px-8 py-3.5 rounded-xl bg-brand text-white text-base font-bold hover:bg-brand-hover transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Tworzenie szansy…</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-white stroke-[2.5]" />
                      <span>Utwórz szansę sprzedaży</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ─── RIGHT COLUMN: FLOATING STICKY SUMMARY PANEL (lg:col-span-4) ───── */}
        {isSidebarActive && (
          <div className="lg:col-span-4 lg:sticky lg:top-6 space-y-4">
          <div className="bg-[var(--panel)] rounded-2xl border border-[var(--line)] p-5 shadow-2xs space-y-5">
            {/* Panel Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-strong)] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand" />
                  Podsumowanie Wyceny
                </h3>
                <p className="text-[11px] text-[var(--text-mute)] mt-0.5">
                  Wyliczenia w czasie rzeczywistym
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand/10 text-brand border border-brand/20">
                Live
              </span>
            </div>

            {/* Section 1: Klient & Stawka VAT (Widoczne po wyborze klienta) */}
            {resolvedClientName ? (
              <div className="bg-[var(--panel-2)]/60 rounded-xl p-3.5 border border-[var(--line-2)] space-y-2">
                <div className="text-[11px] font-bold text-[var(--text-dim)] uppercase tracking-wider flex items-center justify-between">
                  <span>Klient & Stawka VAT</span>
                  {currentClientType === "business" ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                      VAT 23% (Firma)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                      VAT 8% (Prywatny)
                    </span>
                  )}
                </div>
                <div className="text-xs font-semibold text-[var(--text-strong)] truncate flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-brand shrink-0" />
                  <span className="truncate">{resolvedClientName}</span>
                </div>
              </div>
            ) : (
              <div className="bg-[var(--panel-2)]/40 rounded-xl p-3.5 border border-dashed border-[var(--line-2)] text-xs text-[var(--text-mute)] flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-medium">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  Klient: Nie wybrano (Krok 2)
                </span>
              </div>
            )}

            {/* Section 2: Wybrane Usługi & Specyfikacje (Koszyk Zamówienia) */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-[var(--text-dim)] uppercase tracking-wider flex items-center justify-between">
                <span>Wybrane Usługi ({selectedServices.length})</span>
                <span className="text-[10px] text-slate-400 font-normal normal-case">Koszyk pozycji</span>
              </div>
              {selectedServices.length === 0 ? (
                <div className="text-xs text-[var(--text-mute)] italic p-3 border border-dashed border-[var(--line-2)] rounded-xl text-center">
                  Nie wybrano jeszcze żadnej usługi (Krok 1)
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                  {selectedServices.map((serviceName) => {
                    const cfg = serviceConfigurationsMap[serviceName];
                    const totals = getResultTotals(cfg?.result);
                    return (
                      <div
                        key={serviceName}
                        className="p-3 rounded-xl border border-slate-200 bg-white space-y-2.5 text-xs shadow-2xs hover:border-slate-300 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center shrink-0 border border-brand/20">
                              <ServiceIcon name={serviceName} size={16} />
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 text-xs truncate">
                                {serviceName}
                              </div>
                              {cfg?.input ? (
                                <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                                  Wymiary: {cfg.input.widthCm} cm × {cfg.input.depthCm} cm
                                  {totals.areaSqM > 0 && ` (${totals.areaSqM.toFixed(2)} m²)`}
                                </div>
                              ) : (
                                <div className="text-[11px] text-amber-600 font-medium mt-0.5">
                                  Oczekuje na konfigurację
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {totals.net > 0 && (
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[11px] text-slate-500 font-medium">Wartość netto:</span>
                            <span className="font-bold text-slate-900 text-xs">
                              {formatPLN(totals.net)} netto
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section 3: Wartość Oferty (Zadaszenie Poliwęglan / Usługi) */}
            <div className="bg-white rounded-xl p-4 border border-[var(--line-2)] space-y-3 shadow-2xs">
              <div className="text-xs font-bold text-[var(--text-strong)] uppercase tracking-wider flex items-center justify-between border-b border-[var(--line-2)] pb-2">
                <span>Wycena Usług</span>
                <span className="text-[11px] font-semibold text-brand">
                  {resolvedClientName ? `Stawka VAT ${vatRatePercent}%` : "Stawka VAT (Krok 2)"}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-[var(--text-dim)] border-b border-[var(--line-2)] pb-2.5">
                <div className="flex items-center justify-between">
                  <span>Suma Netto:</span>
                  <span className="font-semibold text-[var(--text-strong)]">{formatPLN(totalNetPrice)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Kwota VAT ({resolvedClientName ? `${vatRatePercent}%` : "8%*"}):</span>
                  <span className="font-medium text-[var(--text-mute)]">{formatPLN(totalVatAmount)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <span className="text-xs font-bold text-[var(--text-strong)]">Suma Brutto:</span>
                <span className="text-lg font-extrabold text-brand">{formatPLN(totalGrossPrice)}</span>
              </div>
            </div>

            {/* Section 4: Analiza finansowa */}
            <div className="border border-emerald-200 bg-emerald-50/50 rounded-xl p-4 space-y-2.5">
              <div className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Analiza finansowa</span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-200/60 shadow-2xs">
                  <div className="text-[10px] font-medium text-slate-700">Koszt (Kc)</div>
                  <div className="text-xs font-bold text-slate-800 mt-0.5">{formatPLN(totalCostKc)}</div>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-200/60 shadow-2xs">
                  <div className="text-[10px] font-medium text-slate-700">Zysk (Z)</div>
                  <div className="text-xs font-bold text-emerald-700 mt-0.5">{formatPLN(totalProfitZ)}</div>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-200/60 shadow-2xs">
                  <div className="text-[10px] font-medium text-slate-700">Marża</div>
                  <div className="text-xs font-bold text-emerald-700 mt-0.5">{marginPercent.toFixed(1)}%</div>
                </div>
              </div>
            </div>

            {/* Przycisk Kopiowania Treści Oferty */}
            {Object.values(serviceConfigurationsMap).some((cfg) => cfg.offerText) && (
              <button
                type="button"
                onClick={() => {
                  const texts = Object.values(serviceConfigurationsMap)
                    .map((cfg) => cfg.offerText)
                    .filter(Boolean)
                    .join("\n\n---\n\n");
                  if (texts) {
                    navigator.clipboard.writeText(texts);
                    setCopiedOfferText(true);
                    setTimeout(() => setCopiedOfferText(false), 2000);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-brand/30 bg-brand/10 hover:bg-brand/20 text-brand text-xs font-bold transition-all shadow-2xs cursor-pointer"
              >
                {copiedOfferText ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                    <span>Skopiowano treść oferty!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-brand" />
                    <span>Kopiuj treść oferty</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>

    {/* Modal podglądu pliku */}
    {previewModalFile && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
        onClick={() => setPreviewModalFile(null)}
      >
        <div
          className="relative max-w-4xl w-full max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-slate-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Nagłówek modala */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/80">
            <div className="flex items-center gap-2 min-w-0 pr-4">
              <Eye className="w-4 h-4 text-brand shrink-0" />
              <span className="font-semibold text-sm text-slate-800 truncate">
                {previewModalFile.name}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={previewModalFile.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-slate-500 hover:text-brand hover:bg-slate-100 transition-colors"
                title="Otwórz w nowej karcie"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={() => setPreviewModalFile(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Ciało podglądu */}
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-100/60 min-h-[300px]">
            {previewModalFile.type?.startsWith("image/") ||
            previewModalFile.url.match(/\.(png|jpe?g|webp|gif|svg)$/i) ||
            previewModalFile.name.match(/\.(png|jpe?g|webp|gif|svg)$/i) ? (
              <img
                src={previewModalFile.url}
                alt={previewModalFile.name}
                className="max-h-[75vh] w-auto max-w-full rounded-lg object-contain shadow-sm"
              />
            ) : previewModalFile.type === "application/pdf" ||
              previewModalFile.name.toLowerCase().endsWith(".pdf") ? (
              <iframe
                src={previewModalFile.url}
                title={previewModalFile.name}
                className="w-full h-[75vh] rounded-lg border border-slate-200 bg-white"
              />
            ) : (
              <div className="text-center p-8 space-y-3">
                <FileText className="w-12 h-12 text-slate-400 mx-auto" />
                <p className="text-sm text-slate-600 font-medium">
                  Podgląd tego typu pliku nie jest bezpośrednio osadzony.
                </p>
                <a
                  href={previewModalFile.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white text-xs font-semibold hover:bg-brand-hover shadow-xs transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Otwórz plik w nowej karcie</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
  </div>
);
}
