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
  Hammer,
  Pencil,
  RotateCcw,
  Building2,
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
        input: any;
        result: any;
        offerText: string;
        isValid: boolean;
      }
    >
  >({});
  const [customInstallationOverrides, setCustomInstallationOverrides] = useState<Record<string, number>>({});
  const [editingInstallationService, setEditingInstallationService] = useState<string | null>(null);
  const [inlineInstallationInput, setInlineInstallationInput] = useState<string>("");

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
  function getResultTotals(res: any, serviceName?: string) {
    if (!res) return { net: 0, gross: 0, kc: 0, profitZ: 0, areaSqM: 0, installationNet: 0, materialNet: 0, isInstallationOverridden: false };
    const poly = res.options?.polycarbonate;
    const baseInstallation = poly?.assemblyCostNet ?? res.installationNet ?? res.installationClientNet ?? 0;
    const isOverridden = serviceName ? serviceName in customInstallationOverrides : false;
    const installationNet = isOverridden && serviceName ? customInstallationOverrides[serviceName] : baseInstallation;

    const rawNet = poly?.totalNet ?? res.finalPriceNet ?? res.totalNet ?? res.totalNetPrice ?? res.totalClientNet ?? 0;
    const materialNet = poly?.materialCostNet ?? res.materialsClientNet ?? (rawNet > baseInstallation ? rawNet - baseInstallation : rawNet);
    
    // Netto końcowe to materiał z narzutem + montaż (z uwzględnieniem edycji inline)
    const net = materialNet + installationNet;
    const gross = net > 0 ? Math.round(net * (1 + vatRatePercent / 100)) : 0;
    
    // Koszt własny Kc
    const baseKc = poly?.costBasisKc ?? res.costKc ?? res.costBasisKc ?? res.totalCostNet ?? 0;
    // Różnica w montażu przenosi się proporcjonalnie na zysk Z
    const installDelta = installationNet - baseInstallation;
    const kc = baseKc;
    const profitZ = (poly?.profitZ ?? res.profitZ ?? res.totalProfitZ ?? (rawNet - baseKc)) + installDelta;
    const areaSqM = res.input?.areaSqM ?? poly?.areaSqM ?? res.areaSqM ?? 0;

    return { net, gross, kc, profitZ, areaSqM, installationNet, materialNet, isInstallationOverridden: isOverridden };
  }

  // ─── Calculated Totals across Configurations ────────────────────────────────
  const activeConfigs = Object.values(serviceConfigurationsMap);
  let totalNetPrice = 0;
  let totalCostKc = 0;
  let totalProfitZ = 0;
  let totalGrossPrice = 0;

  activeConfigs.forEach((cfg) => {
    if (cfg?.result) {
      const { net, gross, kc, profitZ } = getResultTotals(cfg.result, cfg.serviceName);
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
            const { net, kc, profitZ } = getResultTotals(cfg.result, cfg.serviceName);
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
      setActiveConfigIndex(0);
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
              className="p-2 rounded-xl text-[var(--text-dim)] hover:bg-[var(--panel-2)] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.push("/admin/panel")}
              className="p-2 rounded-xl text-[var(--text-dim)] hover:bg-[var(--panel-2)] transition-colors cursor-pointer"
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

        <div className="flex items-center gap-2.5 flex-wrap">
          {resolvedClientName && (
            <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 px-3.5 py-1.5 rounded-xl text-xs text-slate-800 font-semibold shadow-2xs">
              <User className="w-4 h-4 text-slate-500" />
              <span>Klient: <strong className="font-bold text-slate-900">{resolvedClientName}</strong></span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white text-slate-700 font-bold border border-slate-200">
                {currentClientType === "business" ? "23% VAT" : "8% VAT"}
              </span>
            </div>
          )}
          {totalNetPrice > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full text-xs text-slate-700 font-semibold shadow-2xs">
              <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
              <span>Wycena:</span>
              <span className="text-slate-900 font-bold">{formatPLN(totalNetPrice)} netto</span>
            </div>
          )}
        </div>
      </div>

      {/* ─── Stepper Progress Bar ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-5 shadow-2xs">
        {/* Desktop Stepper */}
        <div className="hidden md:flex items-center justify-between relative">
          {STEP_DEFINITIONS.map((s, idx) => {
            const isActive = currentStep === s.id;
            const isCompleted = currentStep > s.id;
            const isSelectable = canGoToStep(s.id);
            const isLast = idx === STEP_DEFINITIONS.length - 1;

            return (
              <div key={s.id} className="flex-1 flex items-center">
                <button
                  type="button"
                  disabled={!isSelectable}
                  onClick={() => {
                    if (isSelectable) {
                      setError(null);
                      setCurrentStep(s.id);
                    }
                  }}
                  className={`group flex items-center gap-3 text-left transition-all p-1.5 rounded-xl ${
                    isSelectable ? "cursor-pointer hover:bg-slate-50" : "cursor-not-allowed opacity-50"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition-all ${
                      isActive
                        ? "bg-brand text-white shadow-2xs"
                        : isCompleted
                        ? "bg-slate-100 border border-slate-200 text-brand"
                        : isSelectable
                        ? "bg-white border border-slate-200 text-slate-700 group-hover:border-slate-400"
                        : "bg-slate-50 border border-slate-200/60 text-slate-300"
                    }`}
                  >
                    {isCompleted ? <Check className="w-4 h-4 stroke-[2.5]" /> : s.id}
                  </div>
                  <div className="min-w-0">
                    <span
                      className={`text-xs font-semibold truncate block ${
                        isActive
                          ? "text-slate-900"
                          : isCompleted
                          ? "text-slate-700"
                          : "text-slate-400"
                      }`}
                    >
                      {s.title}
                    </span>
                    <p className="text-[11px] text-slate-400 truncate hidden xl:block">{s.subtitle}</p>
                  </div>
                </button>

                {!isLast && (
                  <div className="flex-1 mx-2 h-0.5 relative">
                    <div className="absolute inset-0 bg-slate-200" />
                    <div
                      className={`absolute inset-0 transition-all duration-300 ${
                        currentStep > s.id ? "bg-brand" : "bg-transparent"
                      }`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Mobile Stepper */}
        <div className="md:hidden space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-900 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-md bg-brand text-white flex items-center justify-center text-[10px] font-bold">
                {currentStep}
              </span>
              <span>{STEP_DEFINITIONS[currentStep - 1].title}</span>
            </span>
            <span className="text-[11px] text-slate-400">
              Krok {currentStep} z 5
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
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
                  className={`h-1.5 rounded-full transition-all ${
                    isActive
                      ? "bg-brand"
                      : isCompleted
                      ? "bg-brand/30"
                      : "bg-slate-100"
                  } ${isSelectable ? "cursor-pointer" : "cursor-not-allowed"}`}
                  title={`${s.id}. ${s.title}`}
                />
              );
            })}
          </div>
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
      <div className={`grid grid-cols-1 ${isSidebarActive ? "lg:grid-cols-12 gap-6" : "w-full space-y-6"}`}>
        {/* ─── LEFT COLUMN: ACTIVE STEP CONTENT ──────────────────────────────── */}
        <div className={isSidebarActive ? "lg:col-span-8 space-y-6" : "w-full space-y-6"}>
          {/* ─────────────────────────────────────────────────────────────────────── */}
          {/* ─── KROK 1: WYBÓR USŁUGI ────────────────────────────────────────────── */}
          {/* ─────────────────────────────────────────────────────────────────────── */}
          {currentStep === 1 && (
            <div className="bg-[var(--panel)] rounded-2xl border border-[var(--line)] p-6 md:p-8 shadow-2xs space-y-6">
              {/* Nagłówek kroku 1 */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-200">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-brand" />
                    <span>Krok 1: Wybór usługi</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Wybierz jedną lub więcej usług, których dotyczy szansa sprzedaży.
                  </p>
                </div>
                {selectedServices.length > 0 && (
                  <span className="self-start sm:self-auto inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    Wybrano: {selectedServices.length} {selectedServices.length === 1 ? "usługę" : "usługi"}
                  </span>
                )}
              </div>

              {/* Siatka usług */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {servicesList.length === 0 ? (
                  <div className="col-span-full p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    Wczytywanie listy usług…
                  </div>
                ) : (
                  servicesList.map((service) => {
                    const isSelected = selectedServices.includes(service.name);
                    const isConfigurable =
                      service.name === "Zadaszenie tarasu" ||
                      service.name.toLowerCase().includes("zadaszen") ||
                      service.name === "Zabudowa tarasu" ||
                      service.name.toLowerCase().includes("zabudow");

                    return (
                      <button
                        key={service._id}
                        type="button"
                        onClick={() => toggleService(service.name)}
                        className={`group flex items-start justify-between p-4 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? "border-brand bg-brand/5 shadow-2xs"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/40"
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-semibold shrink-0 transition-colors ${
                              isSelected
                                ? "bg-brand text-white shadow-2xs"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            <ServiceIcon name={service.name} className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-slate-900 truncate">{service.name}</span>
                              {isConfigurable ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200/80">
                                  Kalkulator
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100/70 text-slate-500">
                                  Wycena indyw.
                                </span>
                              )}
                            </div>
                            {service.description && (
                              <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 font-normal">
                                {service.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ml-3 transition-colors ${
                            isSelected
                              ? "bg-brand border-brand text-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Pasek podsumowania wybranych usług */}
              {selectedServices.length > 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 flex-wrap text-slate-700">
                    <span className="font-medium text-slate-500">Wybrane ({selectedServices.length}):</span>
                    <span className="font-semibold text-slate-900">{selectedServices.join(", ")}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedServices([]);
                      setActiveConfigIndex(0);
                    }}
                    className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                  >
                    Wyczyść wybór
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-3.5 text-xs text-slate-400 flex items-center gap-2">
                  <Info className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Możesz wybrać jedną lub kilka usług, które chcesz zaoferować klientowi.</span>
                </div>
              )}

              {/* Przyciski nawigacji */}
              <div className="flex items-center justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={selectedServices.length === 0}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-hover transition-colors shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
              {/* Nagłówek kroku 2 */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-200">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <User className="w-5 h-5 text-brand" />
                    <span>Krok 2: Wybierz klienta lub utwórz nowego</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Wyszukaj istniejącego klienta w bazie CRM lub dodaj nowego.
                  </p>
                </div>
                {resolvedClientId && (
                  <span className="self-start sm:self-auto inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    {currentClientType === "business" ? "Firma (VAT 23%)" : "Klient prywatny (VAT 8%)"}
                  </span>
                )}
              </div>

              {/* Wybrany klient (jeśli wybrany) */}
              {resolvedClientId && resolvedClientName ? (
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3.5">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-slate-900">{resolvedClientName}</h3>
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            {currentClientType === "business" ? "Firma • VAT 23%" : "Osoba prywatna • VAT 8%"}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 mt-1">
                          {resolvedContact.phone && (
                            <span>tel. <strong className="text-slate-800 font-medium">{resolvedContact.phone}</strong></span>
                          )}
                          {resolvedContact.email && (
                            <span>email: <strong className="text-slate-800 font-medium">{resolvedContact.email}</strong></span>
                          )}
                          {formattedClientAddress && (
                            <span className="text-slate-500">{formattedClientAddress}</span>
                          )}
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
                      className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors self-start sm:self-center cursor-pointer"
                    >
                      Zmień klienta
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Przełącznik trybu (Szukaj vs Dodaj) */}
                  <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200/60 max-w-sm">
                    <button
                      type="button"
                      onClick={() => setClientMode("search")}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        clientMode === "search"
                          ? "bg-white text-slate-900 shadow-2xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Szukaj w bazie
                    </button>
                    <button
                      type="button"
                      onClick={() => setClientMode("create")}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        clientMode === "create"
                          ? "bg-white text-slate-900 shadow-2xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Dodaj nowego klienta
                    </button>
                  </div>

                  {/* TRYB 1: WYSZUKIWANIE ISTNIEJĄCEGO KLIENTA */}
                  {clientMode === "search" && (
                    <div className="space-y-3.5">
                      <div className="relative">
                        <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Szukaj po nazwisku, imieniu, firmie, emailu lub telefonie..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 pl-10 pr-10 py-2.5 text-xs text-slate-900 bg-white outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
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

                      {/* Lista klientów do wyboru */}
                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                        {searchItems === undefined && (
                          <div className="p-8 text-center text-xs text-slate-400">
                            Wyszukiwanie klientów…
                          </div>
                        )}
                        {searchItems?.length === 0 && (
                          <div className="p-8 text-center text-xs text-slate-400">
                            Nie znaleziono klienta. Możesz przełączyć powyżej na &quot;Dodaj nowego klienta&quot;.
                          </div>
                        )}
                        {searchItems && searchItems.length > 0 && (
                          <div className="max-h-[440px] overflow-y-auto divide-y divide-slate-100">
                            {/* Nagłówek listy widoczny na desktopie */}
                            <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 sticky top-0 z-10">
                              <div className="col-span-4">Klient / Firma</div>
                              <div className="col-span-3">Kontakt</div>
                              <div className="col-span-3">Adres</div>
                              <div className="col-span-2 text-right">Akcja</div>
                            </div>

                            {searchItems.map((c) => {
                              const isBusiness = c.clientType === "business";
                              const displayName = c.companyName || `${c.firstName} ${c.lastName}`;
                              const fullAddress = [c.street, c.buildingNumber, c.city].filter(Boolean).join(" ");

                              return (
                                <div
                                  key={c._id}
                                  onClick={() => handleSelectClient(c)}
                                  className="group flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-3 items-start md:items-center px-4 py-3 text-xs hover:bg-slate-50/80 transition-colors cursor-pointer"
                                >
                                  {/* Kolumna 1: Klient / Firma */}
                                  <div className="md:col-span-4 min-w-0 flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-600 group-hover:text-brand group-hover:border-brand/40 transition-colors">
                                      {isBusiness ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-semibold text-slate-900 group-hover:text-brand truncate">
                                        {displayName}
                                      </div>
                                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                        <span className="text-[10px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded">
                                          {isBusiness ? "Firma (23%)" : "Osoba (8%)"}
                                        </span>
                                        {c.nip && (
                                          <span className="text-[10px] text-slate-400">
                                            NIP: {c.nip}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Kolumna 2: Kontakt */}
                                  <div className="md:col-span-3 min-w-0 text-slate-600 space-y-0.5">
                                    {c.phone ? (
                                      <div className="font-medium text-slate-800 truncate">{c.phone}</div>
                                    ) : null}
                                    {c.email ? (
                                      <div className="text-[11px] text-slate-500 truncate">{c.email}</div>
                                    ) : null}
                                    {!c.phone && !c.email && (
                                      <span className="text-slate-400 text-[11px]">—</span>
                                    )}
                                  </div>

                                  {/* Kolumna 3: Adres */}
                                  <div className="md:col-span-3 min-w-0 text-slate-600">
                                    {fullAddress ? (
                                      <div className="truncate text-slate-700">{fullAddress}</div>
                                    ) : (
                                      <span className="text-slate-400 text-[11px]">—</span>
                                    )}
                                  </div>

                                  {/* Kolumna 4: Przycisk wyboru */}
                                  <div className="md:col-span-2 w-full md:w-auto flex md:justify-end mt-1 md:mt-0">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelectClient(c);
                                      }}
                                      className="w-full md:w-auto px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white group-hover:bg-brand group-hover:text-white group-hover:border-brand text-xs font-semibold text-slate-700 transition-all shadow-2xs cursor-pointer"
                                    >
                                      Wybierz →
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TRYB 2: DODAWANIE NOWEGO KLIENTA */}
                  {clientMode === "create" && (
                    <div className="space-y-5 border border-slate-200 rounded-xl p-5 bg-white shadow-2xs">
                      {/* Wybór typu klienta */}
                      <div className="flex items-center gap-4 border-b border-slate-100 pb-3.5">
                        <label className="text-xs font-semibold text-slate-700">Typ klienta:</label>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer font-medium">
                            <input
                              type="radio"
                              name="clientType"
                              checked={clientForm.clientType === "individual"}
                              onChange={() => handleClientTypeChange("individual")}
                              className="text-brand focus:ring-brand"
                            />
                            Osoba prywatna (VAT 8%)
                          </label>
                          <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer font-medium">
                            <input
                              type="radio"
                              name="clientType"
                              checked={clientForm.clientType === "business"}
                              onChange={() => handleClientTypeChange("business")}
                              className="text-brand focus:ring-brand"
                            />
                            Firma / NIP (VAT 23%)
                          </label>
                        </div>
                      </div>

                      {/* NIP GUS dla firm */}
                      {clientForm.clientType === "business" && (
                        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
                          <label className="block text-xs font-medium text-slate-700">
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
                              className="px-4 py-2 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand-hover disabled:opacity-50 flex items-center gap-2 shrink-0 cursor-pointer shadow-2xs"
                            >
                              {nipLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Pobierz z GUS"}
                            </button>
                          </div>
                          {nipFetched && (
                            <div className="text-xs text-slate-700 font-medium flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-brand" /> Dane firmy zostały pomyślnie wczytane!
                            </div>
                          )}
                        </div>
                      )}

                      {/* Pola formularza klienta */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {clientForm.clientType === "business" && (
                          <div className="md:col-span-2">
                            <label className="block text-[11px] font-medium text-slate-500 mb-1">Nazwa firmy *</label>
                            <input
                              type="text"
                              value={clientForm.companyName}
                              onChange={(e) => handleClientFormChange("companyName", e.target.value)}
                              className={fieldCls("companyName")}
                            />
                          </div>
                        )}
                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-1">Imię *</label>
                          <input
                            type="text"
                            value={clientForm.firstName}
                            onChange={(e) => handleClientFormChange("firstName", e.target.value)}
                            className={fieldCls("firstName")}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-1">Nazwisko *</label>
                          <input
                            type="text"
                            value={clientForm.lastName}
                            onChange={(e) => handleClientFormChange("lastName", e.target.value)}
                            className={fieldCls("lastName")}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-1">Email</label>
                          <input
                            type="email"
                            value={clientForm.email}
                            onChange={(e) => handleClientFormChange("email", e.target.value)}
                            className={fieldCls("email")}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-1">Telefon</label>
                          <input
                            type="tel"
                            value={clientForm.phone}
                            onChange={(e) => handleClientFormChange("phone", e.target.value)}
                            className={fieldCls("phone")}
                          />
                        </div>
                      </div>

                      {/* Adres klienta */}
                      <div className="space-y-3 pt-2 border-t border-slate-100">
                        <label className="block text-xs font-semibold text-slate-800">Adres klienta</label>
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

                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={handleCreateNewClient}
                          disabled={creatingClient}
                          className="px-5 py-2.5 rounded-xl bg-brand text-white text-xs font-semibold hover:bg-brand-hover disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-2xs"
                        >
                          {creatingClient ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                          Utwórz i wybierz klienta
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Przyciski nawigacji */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  ← Wstecz (Usługi)
                </button>
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={!resolvedClientId && (!resolvedContact.firstName || !resolvedContact.lastName)}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-hover transition-colors shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
              {/* Nagłówek kroku 3 */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-200">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <SlidersHorizontal className="w-5 h-5 text-brand" />
                    <span>Krok 3: Konfiguracja parametrów wyceny</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Wprowadź wymiary i opcje montażowe wybranej usługi, aby automatycznie przeliczyć cennik i koszty.
                  </p>
                </div>
              </div>

              {configurableServices.length > 0 ? (
                <div className="space-y-6">
                  {/* Zakładki usług w kroku 3 */}
                  {configurableServices.length > 1 && (
                    <div className="inline-flex flex-wrap p-1 rounded-xl bg-slate-100 border border-slate-200/60 gap-1">
                      {configurableServices.map((srv, idx) => {
                        const isActive = activeConfigIndex === idx;
                        const cfgData = serviceConfigurationsMap[srv];
                        const isConfigured = !!cfgData?.isValid;

                        return (
                          <button
                            key={srv}
                            type="button"
                            onClick={() => setActiveConfigIndex(idx)}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              isActive
                                ? "bg-white text-slate-900 shadow-2xs"
                                : "text-slate-600 hover:text-slate-900"
                            }`}
                          >
                            <ServiceIcon name={srv} className="w-3.5 h-3.5 text-slate-500" />
                            <span>{srv}</span>
                            <span
                              className={`w-2 h-2 rounded-full ${isConfigured ? "bg-brand" : "bg-slate-300"}`}
                              title={isConfigured ? "Skonfigurowano" : "Oczekuje na konfigurację"}
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Renderowanie aktywnego kalkulatora */}
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
                          initialInput={serviceConfigurationsMap[currentServiceName]?.input as any}
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
                          initialInput={serviceConfigurationsMap[currentServiceName]?.input as any}
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
                      <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                        Konfigurator dla usługi &quot;{currentServiceName}&quot; nie jest jeszcze dostępny.
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center max-w-lg mx-auto space-y-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                    <SlidersHorizontal className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Brak parametrów do kalkulacji
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Wybrane usługi ({selectedServices.length > 0 ? selectedServices.join(", ") : "ogólna szansa"}) nie wymagają kalkulatora wymiarów. Możesz od razu przejść do adresu inwestycji.
                    </p>
                  </div>
                </div>
              )}

              {/* Przyciski nawigacji */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    if (activeConfigIndex > 0) {
                      setActiveConfigIndex((prev) => prev - 1);
                    } else {
                      handlePrevStep();
                    }
                  }}
                  className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  ← Wstecz (Klient)
                </button>

                {activeConfigIndex < configurableServices.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setActiveConfigIndex((prev) => prev + 1)}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-hover transition-colors shadow-2xs cursor-pointer"
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
                    <span>Dalej: Adres i szczegóły</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────────── */}
          {/* ─── KROK 4: ADRES INWESTYCJI I SZCZEGÓŁY (CTA UTWÓRZ SZANSĘ) ───────── */}
          {/* ─────────────────────────────────────────────────────────────────────── */}
          {/* ─────────────────────────────────────────────────────────────────────── */}
          {/* ─── KROK 4: ADRES INWESTYCJI I SZCZEGÓŁY ───────────────────────────── */}
          {/* ─────────────────────────────────────────────────────────────────────── */}
          {currentStep === 4 && (
            <div className="bg-[var(--panel)] rounded-2xl border border-[var(--line)] p-6 md:p-8 shadow-2xs space-y-6">
              {/* Nagłówek kroku 4 */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-200">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-brand" />
                    <span>Krok 4: Adres montażu i szczegóły zlecenia</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Wskaż miejsce montażu, źródło pozyskania klienta oraz dołącz opcjonalne pliki i uwagi.
                  </p>
                </div>
              </div>

              {/* ── SECTION 1: ADRES INWESTYCJI / MONTAŻU ── */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-500" />
                    <span>Adres montażu</span>
                  </div>

                  <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={sameAsClientAddress}
                      onChange={(e) => setSameAsClientAddress(e.target.checked)}
                      className="rounded border-slate-300 text-brand focus:ring-brand w-4 h-4"
                    />
                    Taki sam jak adres klienta
                  </label>
                </div>

                {sameAsClientAddress ? (
                  <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                    <span className="text-slate-800 font-medium">
                      {formattedClientAddress ? (
                        <>Montaż pod adresem klienta: <strong>{formattedClientAddress}</strong></>
                      ) : (
                        <span className="text-slate-500 italic">Adres zostanie pobrany z danych klienta</span>
                      )}
                    </span>
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
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline cursor-pointer"
                    >
                      Podaj inny adres
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    <AddressSearch onSelect={handleInvestmentAddressSelect} />

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="col-span-2">
                        <label className="block text-[11px] font-medium text-slate-500 mb-1">Ulica</label>
                        <input
                          type="text"
                          placeholder="Ulica"
                          value={investmentStreet}
                          onChange={(e) => setInvestmentStreet(e.target.value)}
                          className={fieldCls("investmentStreet")}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1">Nr budynku</label>
                        <input
                          type="text"
                          placeholder="Nr budynku"
                          value={investmentBuildingNumber}
                          onChange={(e) => setInvestmentBuildingNumber(e.target.value)}
                          className={fieldCls("investmentBuildingNumber")}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1">Nr lokalu</label>
                        <input
                          type="text"
                          placeholder="Nr lokalu"
                          value={investmentApartmentNumber}
                          onChange={(e) => setInvestmentApartmentNumber(e.target.value)}
                          className={fieldCls("investmentApartmentNumber")}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1">Kod pocztowy</label>
                        <input
                          type="text"
                          placeholder="Kod pocztowy"
                          value={investmentPostalCode}
                          onChange={(e) => setInvestmentPostalCode(e.target.value)}
                          className={fieldCls("investmentPostalCode")}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[11px] font-medium text-slate-500 mb-1">Miasto</label>
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
              </div>

              {/* ── SECTION 2: TEKST WŁASNY & ŹRÓDŁO LEADA ── */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-700">
                      Tytuł karty / Tekst własny (opcjonalnie)
                    </label>
                    <input
                      type="text"
                      placeholder="np. Wycena zadaszenia - Pan Kowalski"
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 bg-white outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
                    />
                    <p className="text-[11px] text-slate-400">
                      Tytuł widoczny na tablicy Kanban w panelu handlowym.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-700">
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
                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 bg-white outline-none focus:border-brand focus:ring-1 focus:ring-brand mt-2"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* ── SECTION 3: PLIKI I ZAŁĄCZNIKI ── */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Upload className="w-4 h-4 text-slate-500" />
                  <span>Pliki i załączniki (opcjonalnie)</span>
                </div>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border border-dashed border-slate-300 hover:border-slate-400 rounded-xl p-5 text-center cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-colors"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center mx-auto mb-1.5">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-semibold text-slate-800">
                    Kliknij lub przeciągnij pliki tutaj
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Projekty, zdjęcia z pomiarów, rzuty (PDF, PNG, JPG)
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
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 shadow-2xs"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                        <span className="truncate max-w-[200px] font-medium">{file.name}</span>
                        {file.url && (
                          <button
                            type="button"
                            onClick={() => setPreviewModalFile({ name: file.name, url: file.url!, type: file.type })}
                            className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
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

              {/* ── SECTION 4: UWAGI / KOMENTARZ ── */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-2">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span>Uwagi / Komentarz do szansy</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Dodatkowe informacje dla handlowca lub ekipy montażowej..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-900 bg-white outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
                />
              </div>

              {/* Przyciski nawigacji */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
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
            <div className="bg-[var(--panel)] rounded-2xl border border-[var(--line)] p-6 md:p-8 shadow-2xs space-y-6">
              {/* Nagłówek kroku 5 */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-200">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-brand" />
                    <span>Krok 5: Podsumowanie szansy sprzedaży</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Sprawdź dane klienta, pozycje zamówienia oraz końcowe kwoty wyceny przed utworzeniem szansy.
                  </p>
                </div>
                <div className="self-start sm:self-auto">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    {currentClientType === "business" ? "Stawka VAT 23% (Firma)" : "Stawka VAT 8% (Klient prywatny)"}
                  </span>
                </div>
              </div>

              {/* ── 1. DANE ZLECENIA (KLIENT I MIEJSCE MONTAŻU) ── */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                  {/* Klient */}
                  <div className="space-y-3">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>Klient</span>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">{resolvedClientName || "—"}</div>
                      <div className="mt-1 space-y-1 text-xs text-slate-600">
                        {(resolvedContact.phone || resolvedContact.email) && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                            {resolvedContact.phone && (
                              <span>tel. <strong className="text-slate-800 font-medium">{resolvedContact.phone}</strong></span>
                            )}
                            {resolvedContact.email && (
                              <span>email: <strong className="text-slate-800 font-medium">{resolvedContact.email}</strong></span>
                            )}
                          </div>
                        )}
                        <div className="text-slate-500">
                          {formattedClientAddress || "Brak podanego adresu zamieszkania"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Inwestycja / Montaż */}
                  <div className="space-y-3 pt-4 md:pt-0 md:pl-6">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>Miejsce montażu i lead</span>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs text-slate-800 font-medium">
                        {sameAsClientAddress ? (
                          <span className="flex items-center gap-1.5 text-slate-700">
                            <Check className="w-3.5 h-3.5 text-brand stroke-[2.5]" />
                            Zgodny z adresem klienta ({formattedClientAddress || "podany adres"})
                          </span>
                        ) : (
                          formattedInvestmentAddress || "Brak wskazanego adresu montażu"
                        )}
                      </div>
                      {finalLeadSourceStr && (
                        <div className="text-xs text-slate-500 flex items-center gap-2 pt-1">
                          <span>Źródło leada:</span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                            {finalLeadSourceStr}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── 2. WYKAZ POZYCJI I FINANSE (CZYSTA TABELA + FINANSE) ── */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                {/* Nagłówek tabeli */}
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Briefcase className="w-4 h-4 text-slate-500" />
                    <h3 className="text-sm font-bold text-slate-900">Wykaz pozycji wyceny</h3>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {selectedServices.length} {selectedServices.length === 1 ? "pozycja" : selectedServices.length > 4 ? "pozycji" : "pozycje"}
                    </span>
                  </div>
                </div>

                {/* Tabela pozycji */}
                {selectedServices.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 italic">
                    Nie wybrano żadnych pozycji do wyceny (Krok 1).
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="py-3 px-5 font-semibold">Usługa / Pozycja</th>
                          <th className="py-3 px-4 font-semibold">Specyfikacja</th>
                          <th className="py-3 px-4 text-right font-semibold">Materiał netto</th>
                          <th className="py-3 px-4 text-right font-semibold">Montaż netto</th>
                          <th className="py-3 px-5 text-right font-semibold">Razem netto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedServices.map((serviceName, idx) => {
                          const cfg = serviceConfigurationsMap[serviceName];
                          const totals = getResultTotals(cfg?.result, serviceName);
                          const isConfigured = totals.net > 0;
                          const isEditingInstall = editingInstallationService === serviceName;
                          const isGlass = serviceName === "Zabudowa tarasu" || serviceName.toLowerCase().includes("zabudow");

                          return (
                            <tr key={serviceName} className="hover:bg-slate-50/40 transition-colors">
                              {/* 1. Usługa */}
                              <td className="py-4 px-5 align-top">
                                <div className="flex items-center gap-2.5">
                                  <span className="text-xs font-bold text-slate-400 w-4">{idx + 1}.</span>
                                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                                    <ServiceIcon name={serviceName} className="w-3.5 h-3.5" />
                                  </div>
                                  <span className="font-semibold text-slate-900 text-xs">
                                    {serviceName}
                                  </span>
                                </div>
                              </td>

                              {/* 2. Specyfikacja */}
                              <td className="py-4 px-4 align-top">
                                {(() => {
                                  const input = cfg?.input as Record<string, any> | null;
                                  if (!input) {
                                    return <span className="text-slate-400 italic">Wycena indywidualna</span>;
                                  }
                                  if (isGlass) {
                                    const wallsCount = Array.isArray(input.walls) ? input.walls.length : 0;
                                    const accCount = Array.isArray(input.accessories) ? input.accessories.length : 0;
                                    return (
                                      <div className="text-slate-600 space-y-0.5">
                                        <div className="font-medium text-slate-800">
                                          {wallsCount} {wallsCount === 1 ? "ścianka szklana" : wallsCount > 4 ? "ścianek szklanych" : "ścianki szklane"}
                                          {totals.areaSqM > 0 && <span className="text-slate-400 font-normal"> ({totals.areaSqM.toFixed(2)} m²)</span>}
                                        </div>
                                        {accCount > 0 && (
                                          <div className="text-[11px] text-slate-500">
                                            + {accCount} {accCount === 1 ? "dodatek / lamela" : "dodatki / lamele"}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  }
                                  return (
                                    <div className="text-slate-600">
                                      <div className="font-medium text-slate-800">
                                        {String(input.widthCm ?? "—")} cm × {String(input.depthCm ?? "—")} cm
                                        {totals.areaSqM > 0 && <span className="text-slate-400 font-normal"> ({totals.areaSqM.toFixed(2)} m²)</span>}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </td>

                              {/* 3. Materiał netto */}
                              <td className="py-4 px-4 text-right align-top font-medium text-slate-700">
                                {isConfigured ? formatPLN(totals.materialNet) : "—"}
                              </td>

                              {/* 4. Montaż netto z edycją inline */}
                              <td className="py-4 px-4 text-right align-top">
                                {isConfigured ? (
                                  isEditingInstall ? (
                                    <div className="inline-flex items-center gap-1.5 justify-end">
                                      <div className="relative">
                                        <input
                                          type="number"
                                          min={0}
                                          autoFocus
                                          value={inlineInstallationInput}
                                          onChange={(e) => setInlineInstallationInput(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              const val = parseFloat(inlineInstallationInput);
                                              if (!isNaN(val) && val >= 0) {
                                                setCustomInstallationOverrides((prev) => ({
                                                  ...prev,
                                                  [serviceName]: Math.round(val),
                                                }));
                                              }
                                              setEditingInstallationService(null);
                                            } else if (e.key === "Escape") {
                                              setEditingInstallationService(null);
                                            }
                                          }}
                                          className="w-24 px-2 py-1 bg-white border border-brand rounded text-xs font-semibold text-slate-900 text-right outline-none shadow-2xs"
                                          placeholder="Kwota"
                                        />
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const val = parseFloat(inlineInstallationInput);
                                          if (!isNaN(val) && val >= 0) {
                                            setCustomInstallationOverrides((prev) => ({
                                              ...prev,
                                              [serviceName]: Math.round(val),
                                            }));
                                          }
                                          setEditingInstallationService(null);
                                        }}
                                        className="px-2 py-1 bg-brand text-white rounded text-xs font-semibold hover:bg-brand-hover transition-colors cursor-pointer"
                                      >
                                        OK
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingInstallationService(null)}
                                        className="px-1.5 py-1 text-slate-400 hover:text-slate-700 text-xs cursor-pointer"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="inline-flex items-center justify-end gap-1.5 group">
                                      <span className="font-medium text-slate-700">
                                        {formatPLN(totals.installationNet)}
                                      </span>
                                      {totals.isInstallationOverridden && (
                                        <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1 rounded" title="Wartość zmieniona ręcznie">
                                          edycja
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingInstallationService(serviceName);
                                          setInlineInstallationInput(String(Math.round(totals.installationNet)));
                                        }}
                                        className="p-1 rounded text-slate-300 hover:text-brand hover:bg-slate-100 transition-colors cursor-pointer"
                                        title="Zmień kwotę montażu"
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </button>
                                      {totals.isInstallationOverridden && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setCustomInstallationOverrides((prev) => {
                                              const next = { ...prev };
                                              delete next[serviceName];
                                              return next;
                                            });
                                          }}
                                          className="p-1 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                          title="Przywróć kwotę z kalkulatora"
                                        >
                                          <RotateCcw className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  )
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>

                              {/* 5. Razem netto */}
                              <td className="py-4 px-5 text-right align-top font-bold text-slate-900">
                                {isConfigured ? (
                                  <div>
                                    <span>{formatPLN(totals.net)}</span>
                                    <div className="text-[10px] font-normal text-slate-400">
                                      brutto: {formatPLN(totals.gross)}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-amber-700 font-medium">Do wyceny</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Podsumowanie finansowe (czyste, wyrównane do prawej) */}
                <div className="border-t border-slate-200 bg-slate-50/40 p-5">
                  <div className="max-w-xs ml-auto space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Suma netto:</span>
                      <span className="font-semibold text-slate-900">{formatPLN(totalNetPrice)}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>VAT ({vatRatePercent}%):</span>
                      <span className="font-medium text-slate-700">{formatPLN(totalVatAmount)}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex items-baseline justify-between">
                      <span className="text-sm font-bold text-slate-900">Łącznie brutto:</span>
                      <span className="text-xl font-bold text-slate-900 tracking-tight">{formatPLN(totalGrossPrice)}</span>
                    </div>
                  </div>
                </div>

                {/* Rentowność (wskaźniki wewnętrzne) – dyskretny pasek */}
                <div className="border-t border-slate-200 bg-slate-50/90 px-5 py-3 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 font-medium text-slate-600">
                    <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                    <span>Rentowność (dane wewnętrzne):</span>
                  </div>
                  <div className="flex items-center gap-5 text-xs">
                    <div>
                      <span className="text-slate-400 mr-1.5">Koszt własny (Kc):</span>
                      <span className="font-semibold text-slate-800">{formatPLN(totalCostKc)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 mr-1.5">Zysk szacowany (Z):</span>
                      <span className="font-bold text-slate-900">{formatPLN(totalProfitZ)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 mr-1.5">Marża:</span>
                      <span className="font-bold text-slate-900">{marginPercent.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── 3. ZAŁĄCZNIKI I UWAGI (TYLKO JEŚLI ISTNIEJĄ) ── */}
              {(uploadedFiles.length > 0 || comment.trim()) && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
                  {uploadedFiles.length > 0 && (
                    <div>
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span>Załączone pliki ({uploadedFiles.length})</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {uploadedFiles.map((file) => {
                          const isImage = file.type?.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name);
                          const isPdf = file.type?.includes("pdf") || /\.pdf$/i.test(file.name);

                          return (
                            <div
                              key={file.storageId}
                              className="border border-slate-200 bg-white rounded-lg p-2.5 flex items-center justify-between gap-2.5 text-xs hover:border-slate-300 transition-colors"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                {isImage && file.url ? (
                                  <div
                                    onClick={() => setPreviewModalFile({ name: file.name, url: file.url!, type: file.type })}
                                    className="w-9 h-9 rounded bg-slate-100 overflow-hidden shrink-0 cursor-pointer border border-slate-200 hover:opacity-80 transition-opacity"
                                  >
                                    <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                                  </div>
                                ) : (
                                  <div className="w-9 h-9 rounded bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                                    <FileText className="w-4 h-4" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-slate-900 truncate" title={file.name}>
                                    {file.name}
                                  </p>
                                  <span className="text-[10px] text-slate-400">{formatFileSize(file.size)}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {file.url && (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewModalFile({ name: file.name, url: file.url!, type: file.type })}
                                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                                    title="Podgląd"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {file.url && (
                                  <a
                                    href={file.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition-colors"
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
                    </div>
                  )}

                  {comment.trim() && (
                    <div className={uploadedFiles.length > 0 ? "pt-3 border-t border-slate-100" : ""}>
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Uwagi wstępne do szansy
                      </div>
                      <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap">
                        {comment.trim()}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── 4. PRZYCISKI AKCJI (CTA) ── */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  ← Wstecz (adres i szczegóły)
                </button>

                <div className="flex items-center gap-3">
                  {Object.values(serviceConfigurationsMap).some((cfg) => cfg?.offerText) && (
                    <button
                      type="button"
                      onClick={() => {
                        const texts = selectedServices
                          .map((srv) => serviceConfigurationsMap[srv]?.offerText)
                          .filter(Boolean)
                          .join("\n\n---\n\n");
                        if (texts) {
                          navigator.clipboard.writeText(texts);
                          setCopiedOfferText(true);
                          setTimeout(() => setCopiedOfferText(false), 2500);
                        }
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-brand/30 bg-brand/5 hover:bg-brand/10 text-brand text-sm font-semibold transition-all shadow-2xs cursor-pointer"
                      title="Kopiuj pełną treść oferty ze wszystkimi pozycjami"
                    >
                      {copiedOfferText ? (
                        <>
                          <Check className="w-4 h-4 text-brand stroke-[3]" />
                          <span className="text-brand font-semibold">Skopiowano treść!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-brand" />
                          <span>Kopiuj treść oferty</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting || uploading}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-hover transition-colors shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Tworzenie…</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-white stroke-[2.5]" />
                        <span>Utwórz szansę sprzedaży</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── RIGHT COLUMN: FLOATING STICKY SUMMARY PANEL (lg:col-span-4) ───── */}
        {isSidebarActive && (
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-20 z-10 space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4 max-h-[calc(100vh-6.5rem)] overflow-y-auto">
                {/* Nagłówek panelu */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-brand" />
                      <span>Bieżąca wycena</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Aktualizowane na bieżąco
                    </p>
                  </div>
                </div>

                {/* Klient */}
                {resolvedClientName ? (
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                    <div className="min-w-0 pr-2">
                      <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Klient</div>
                      <div className="font-semibold text-slate-900 truncate mt-0.5">{resolvedClientName}</div>
                    </div>
                    <span className="text-[10px] font-medium text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded shrink-0">
                      VAT {vatRatePercent}%
                    </span>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-slate-50/50 border border-dashed border-slate-200 text-xs text-slate-400">
                    Klient: do wyboru w Kroku 2
                  </div>
                )}

                {/* Pozycje wyceny */}
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Pozycje ({selectedServices.length})
                  </div>
                  {selectedServices.length === 0 ? (
                    <div className="text-xs text-slate-400 italic p-3 border border-dashed border-slate-200 rounded-lg text-center">
                      Brak wybranych usług
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {selectedServices.map((serviceName) => {
                        const cfg = serviceConfigurationsMap[serviceName];
                        const totals = getResultTotals(cfg?.result, serviceName);
                        const isConfigured = totals.net > 0;
                        const input = cfg?.input as { widthCm?: number; depthCm?: number; walls?: unknown[] } | undefined;
                        return (
                          <div
                            key={serviceName}
                            className="p-2.5 rounded-lg border border-slate-200 bg-white text-xs space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-slate-900 truncate">{serviceName}</span>
                              {isConfigured ? (
                                <span className="font-bold text-slate-900 shrink-0">{formatPLN(totals.net)}</span>
                              ) : (
                                <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                                  Wycena
                                </span>
                              )}
                            </div>
                            {input && (
                              <div className="text-[11px] text-slate-500 truncate">
                                {input.widthCm && input.depthCm
                                  ? `${input.widthCm} × ${input.depthCm} cm`
                                  : input.walls
                                  ? `${input.walls.length} ścianki`
                                  : "Skonfigurowano"}
                                {totals.areaSqM > 0 && ` • ${totals.areaSqM.toFixed(2)} m²`}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Finanse podsumowanie */}
                <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Netto:</span>
                    <span className="font-semibold text-slate-900">{formatPLN(totalNetPrice)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>VAT ({resolvedClientName ? `${vatRatePercent}%` : "8%"}):</span>
                    <span className="font-medium text-slate-700">{formatPLN(totalVatAmount)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex items-baseline justify-between">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Brutto:</span>
                    <span className="text-lg font-bold text-slate-900">{formatPLN(totalGrossPrice)}</span>
                  </div>
                </div>

                {/* Rentowność */}
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Dane wewnętrzne
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center pt-0.5">
                    <div>
                      <div className="text-[10px] text-slate-500">Koszt (Kc)</div>
                      <div className="font-semibold text-slate-800 text-[11px] mt-0.5">{formatPLN(totalCostKc)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">Zysk (Z)</div>
                      <div className="font-bold text-slate-900 text-[11px] mt-0.5">{formatPLN(totalProfitZ)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">Marża</div>
                      <div className="font-bold text-slate-900 text-[11px] mt-0.5">{marginPercent.toFixed(1)}%</div>
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
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {copiedOfferText ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-brand stroke-[3]" />
                        <span className="text-brand font-semibold">Skopiowano treść!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>Kopiuj treść oferty</span>
                      </>
                    )}
                  </button>
                )}
              </div>
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
