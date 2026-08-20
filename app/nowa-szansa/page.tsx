"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  CheckCircle2,
  Loader2,
  Upload,
  X,
  User,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  MessageSquare,
  Paperclip,
  ChevronRight,
  ChevronLeft,
  AppWindow,
  DoorClosed,
  Warehouse,
  Building2,
  Maximize,
  Sun,
  Umbrella,
  Layers,
  AlignJustify,
  Sliders,
  ChevronDown,
  Home,
  Hammer,
  Wrench,
  ShieldCheck,
  Settings
} from "lucide-react";

const IconMap: Record<string, React.ComponentType<any>> = {
  AppWindow,
  DoorClosed,
  Warehouse,
  Building2,
  Maximize,
  Sun,
  Umbrella,
  Layers,
  AlignJustify,
  Sliders,
  ChevronDown,
  Home,
  Hammer,
  Wrench,
  ShieldCheck,
  Settings
};

function ServiceIcon({ name, className = "h-5 w-5" }: { name?: string; className?: string }) {
  const IconComponent = name ? IconMap[name] : null;
  if (!IconComponent) return <Settings className={className} />;
  return <IconComponent className={className} />;
}

const STEPS = [
  { id: "dane", label: "Twoje dane", icon: User },
  { id: "adres", label: "Adres", icon: MapPin },
  { id: "usluga", label: "Usługi", icon: Briefcase },
  { id: "szczegoly", label: "Szczegóły", icon: MessageSquare },
];

type Step = "dane" | "adres" | "usluga" | "szczegoly";

export default function NowaSzansaPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [currentStep, setCurrentStep] = useState<Step>("dane");

  // Dane osobowe
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Adres
  const [street, setStreet] = useState("");
  const [buildingNumber, setBuildingNumber] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [stateRegion, setStateRegion] = useState("");

  // Usługi i szczegóły
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; storageId: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [consent, setConsent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const activeServices = useQuery(api.services.listActive);
  const createOrFindClient = useMutation(api.jotformInternal.createOrFindClient);
  const savePendingSubmission = useMutation(api.jotformInternal.savePendingSubmission);
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);

  const stepOrder: Step[] = ["dane", "adres", "usluga", "szczegoly"];
  const stepIndex = stepOrder.indexOf(currentStep);

  function clearError(field: string) {
    setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  }

  function validateStep(step: Step): boolean {
    const newErrors: Record<string, string> = {};
    if (step === "dane") {
      if (!firstName.trim()) newErrors.firstName = "Imię jest wymagane";
      if (!lastName.trim()) newErrors.lastName = "Nazwisko jest wymagane";
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = "Podaj poprawny adres e-mail";
      if (!phone.trim()) newErrors.phone = "Numer telefonu jest wymagany";
    }
    if (step === "usluga") {
      if (selectedServices.length === 0) newErrors.services = "Wybierz przynajmniej jedną usługę";
    }
    if (step === "szczegoly") {
      if (!consent) newErrors.consent = "Zgoda na przetwarzanie danych jest wymagana";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleNext() {
    if (!validateStep(currentStep)) return;
    const nextIdx = stepIndex + 1;
    if (nextIdx < stepOrder.length) setCurrentStep(stepOrder[nextIdx]);
  }

  function handleBack() {
    const prevIdx = stepIndex - 1;
    if (prevIdx >= 0) { setErrors({}); setCurrentStep(stepOrder[prevIdx]); }
  }

  function handleServiceToggle(name: string) {
    setSelectedServices((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]
    );
    clearError("services");
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const uploadUrl = await generateUploadUrl();
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!response.ok) throw new Error("Upload failed");
        const { storageId } = await response.json();
        if (!storageId) throw new Error("No storageId returned");
        setUploadedFiles((prev) => [...prev, { name: file.name, storageId }]);
      }
    } catch {
      setErrors((prev) => ({ ...prev, upload: "Nie udało się wgrać pliku. Spróbuj ponownie." }));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateStep("szczegoly")) return;

    setSubmitting(true);
    setErrors({});

    try {
      const submissionId = "www-" + Date.now().toString();

      const clientId = await createOrFindClient({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        street: street.trim() || undefined,
        buildingNumber: buildingNumber.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
        city: city.trim() || undefined,
        submissionId,
      });

      const projectFilesString =
        uploadedFiles.length > 0 ? uploadedFiles.map((f) => f.storageId).join(",") : undefined;

      await savePendingSubmission({
        clientId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        street: street.trim() || undefined,
        buildingNumber: buildingNumber.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
        city: city.trim() || undefined,
        services: selectedServices,
        comment: comment.trim() || undefined,
        projectFiles: projectFilesString,
        submissionId,
      });

      setSuccess(true);
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Wystąpił nieoczekiwany błąd. Spróbuj ponownie." });
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = (field: string) =>
    `w-full rounded-lg border px-4 py-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-[#3DAAB3] focus:ring-2 focus:ring-[#3DAAB3]/10 ${
      errors[field] ? "border-red-400 focus:border-red-400 focus:ring-red-50" : "border-gray-200 hover:border-gray-300"
    }`;

  if (!mounted) return null;

  // Success screen
  if (success) {
    return (
      <div className="min-h-screen bg-[#f3f3fe] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-lg w-full p-12 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Dziękujemy za zapytanie!</h2>
          <p className="text-gray-500 leading-relaxed">
            Twoje zgłoszenie zostało pomyślnie przesłane. Skontaktujemy się z Tobą tak szybko jak to możliwe w celu przygotowania bezpłatnej wyceny.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f3fe] py-10 px-4 font-sans">
      <div className="max-w-xl mx-auto">

        {/* Logo + Tytuł */}
        <div className="text-center mb-8">
          <img
            src="/logo.jpg"
            alt="ADKokna"
            width={80}
            className="mx-auto mb-4 object-contain"
          />
          <h1 className="text-2xl font-bold text-gray-900">Formularz bezpłatnej wyceny</h1>
          <p className="text-sm text-gray-500 mt-1">Wypełnij poniższe pola — to zajmie tylko chwilę!</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between mb-8 px-2">
          {STEPS.map((step, idx) => {
            const StepIcon = step.icon;
            const isDone = idx < stepIndex;
            const isActive = step.id === currentStep;
            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isDone
                        ? "bg-[#3DAAB3] text-white shadow-sm"
                        : isActive
                        ? "bg-white text-[#3DAAB3] border-2 border-[#3DAAB3] shadow-sm"
                        : "bg-white text-gray-400 border-2 border-gray-200"
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
                  </div>
                  <span className={`text-[11px] font-medium text-center leading-tight ${isActive ? "text-[#3DAAB3]" : isDone ? "text-[#3DAAB3]/80" : "text-gray-400"}`}>
                    {step.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`w-6 h-px mx-1 mb-4 flex-shrink-0 transition-colors ${idx < stepIndex ? "bg-[#3DAAB3]/40" : "bg-gray-200"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <form onSubmit={handleSubmit}>

            {/* Global error */}
            {errors.form && (
              <div className="mx-6 mt-6 p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
                {errors.form}
              </div>
            )}

            {/* ─── Krok 1: Dane ─── */}
            {currentStep === "dane" && (
              <div className="p-6 sm:p-8 space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Twoje dane kontaktowe</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Podaj swoje dane, abyśmy mogli się z Tobą skontaktować.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Imię <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => { setFirstName(e.target.value); clearError("firstName"); }}
                      placeholder="Jan"
                      className={inputCls("firstName")}
                      autoFocus
                    />
                    {errors.firstName && <p className="mt-1 text-xs text-red-500">{errors.firstName}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Nazwisko <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => { setLastName(e.target.value); clearError("lastName"); }}
                      placeholder="Kowalski"
                      className={inputCls("lastName")}
                    />
                    {errors.lastName && <p className="mt-1 text-xs text-red-500">{errors.lastName}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Adres e-mail <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); clearError("email"); }}
                      placeholder="jan@example.com"
                      className={`${inputCls("email")} pl-10`}
                    />
                  </div>
                  {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Numer telefonu <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value); clearError("phone"); }}
                      placeholder="000 000 000"
                      className={`${inputCls("phone")} pl-10`}
                    />
                  </div>
                  {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
                </div>
              </div>
            )}

            {/* ─── Krok 2: Adres ─── */}
            {currentStep === "adres" && (
              <div className="p-6 sm:p-8 space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Adres</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Opcjonalnie — możesz pominąć ten krok.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Ulica</label>
                  <input
                    type="text"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="np. ul. Lipowa"
                    className={inputCls("")}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nr budynku</label>
                    <input
                      type="text"
                      value={buildingNumber}
                      onChange={(e) => setBuildingNumber(e.target.value)}
                      placeholder="12A"
                      className={inputCls("")}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Kod pocztowy</label>
                    <input
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="00-000"
                      className={inputCls("")}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Miasto</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="np. Warszawa"
                      className={inputCls("")}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Województwo</label>
                    <input
                      type="text"
                      value={stateRegion}
                      onChange={(e) => setStateRegion(e.target.value)}
                      placeholder="np. Mazowieckie"
                      className={inputCls("")}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ─── Krok 3: Usługi ─── */}
            {currentStep === "usluga" && (
              <div className="p-6 sm:p-8 space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Jaką usługę chcesz wycenić?</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Możesz wybrać więcej niż jedną opcję. <span className="text-red-500">*</span></p>
                </div>

                {activeServices === undefined ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" /> Ładowanie usług...
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {activeServices.map((service) => {
                      const selected = selectedServices.includes(service.name);
                      return (
                        <button
                          key={service._id}
                          type="button"
                          onClick={() => handleServiceToggle(service.name)}
                          className={`relative flex flex-col items-center justify-center gap-2.5 px-3 py-5 rounded-2xl border-2 text-center transition-all duration-150 focus:outline-none ${
                            selected
                              ? "border-[#3DAAB3] bg-[#3DAAB3]/8 shadow-md shadow-[#3DAAB3]/15"
                              : "border-gray-200 bg-white hover:border-[#3DAAB3]/40 hover:bg-[#3DAAB3]/3 hover:shadow-sm"
                          }`}
                        >
                          {/* Check badge */}
                          <div className={`absolute top-2.5 right-2.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                            selected ? "border-[#3DAAB3] bg-[#3DAAB3]" : "border-gray-200 bg-white"
                          }`}>
                            {selected && (
                              <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                                <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>

                          {/* Icon */}
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                            selected
                              ? "bg-[#3DAAB3] text-white"
                              : "bg-gray-100 text-gray-500"
                          }`}>
                            <ServiceIcon name={service.icon} className="h-6 w-6" />
                          </div>

                          {/* Name */}
                          <span className={`text-xs font-semibold leading-tight transition-colors ${
                            selected ? "text-[#3DAAB3]" : "text-gray-700"
                          }`}>
                            {service.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {errors.services && <p className="text-xs text-red-500 font-medium">{errors.services}</p>}
              </div>
            )}

            {/* ─── Krok 4: Szczegóły ─── */}
            {currentStep === "szczegoly" && (
              <div className="p-6 sm:p-8 space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Szczegóły i pliki</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Komentarz i pliki są opcjonalne.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Komentarz</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                    placeholder="Opisz czego potrzebujesz, np. rodzaj okien, kolor, wymiary..."
                    className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-[#3DAAB3] focus:ring-2 focus:ring-[#3DAAB3]/10 hover:border-gray-300 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Prześlij pliki z projektem</label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-gray-200 text-sm font-medium text-gray-500 hover:border-[#3DAAB3]/50 hover:bg-[#3DAAB3]/5 hover:text-[#3DAAB3] transition-all disabled:opacity-50 w-full justify-center"
                  >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                    {uploading ? "Wgrywanie..." : "Kliknij, aby dodać pliki"}
                  </button>
                  <input ref={fileInputRef} type="file" multiple onChange={handleFileUpload} disabled={uploading || submitting} className="hidden" />

                  {uploadedFiles.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {uploadedFiles.map((f) => (
                        <div key={f.storageId} className="flex items-center gap-2 bg-[#3DAAB3]/5 rounded-lg px-3 py-2 border border-[#3DAAB3]/10">
                          <Upload className="w-3.5 h-3.5 text-[#3DAAB3] flex-shrink-0" />
                          <span className="text-xs text-[#3DAAB3] truncate flex-1">{f.name}</span>
                          <button type="button" onClick={() => setUploadedFiles(prev => prev.filter(x => x.storageId !== f.storageId))} className="text-[#3DAAB3]/60 hover:text-red-500 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {errors.upload && <p className="mt-1 text-xs text-red-500">{errors.upload}</p>}
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <div
                      onClick={() => { setConsent(!consent); clearError("consent"); }}
                      className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all cursor-pointer ${
                        consent ? "bg-[#3DAAB3] border-[#3DAAB3]" : errors.consent ? "border-red-400" : "border-gray-300"
                      }`}
                    >
                      {consent && (
                        <svg className="w-3 h-3 text-white" viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span className="text-[12.5px] text-gray-500 leading-relaxed">
                      Administratorem Twoich danych jest ADK ARKADIUSZ MARCHEWKA (NIP: 8222266889). 
                      Twoje dane przetwarzamy wyłącznie w celu przygotowania wyceny. Przysługuje Ci prawo 
                      do wglądu, poprawienia lub usunięcia danych.{" "}
                      <span className="text-red-500">*</span>
                    </span>
                  </label>
                  {errors.consent && <p className="mt-1.5 ml-8 text-xs text-red-500 font-medium">{errors.consent}</p>}
                </div>
              </div>
            )}

            {/* ─── Footer nawigacja ─── */}
            <div className="px-6 sm:px-8 py-5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between gap-4">
              {stepIndex > 0 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Wstecz
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-3">
                {/* Dots */}
                <div className="flex gap-1">
                  {STEPS.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === stepIndex ? "w-5 bg-[#3DAAB3]" : idx < stepIndex ? "w-1.5 bg-[#3DAAB3]/50" : "w-1.5 bg-gray-200"
                      }`}
                    />
                  ))}
                </div>

                {stepIndex < stepOrder.length - 1 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex items-center gap-1.5 bg-[#3DAAB3] hover:bg-[#34939a] text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors shadow-sm"
                  >
                    Dalej
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting || uploading}
                    className="flex items-center gap-2 bg-[#3DAAB3] hover:bg-[#34939a] text-white text-sm font-bold px-6 py-2.5 rounded-xl transition-colors disabled:opacity-70 shadow-sm"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Wysyłanie...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Wyślij formularz
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

          </form>
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-6">
          Pola oznaczone <span className="text-red-500">*</span> są wymagane.
        </p>
      </div>
    </div>
  );
}
