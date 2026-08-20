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

  // ─── Success screen ───────────────────────────────
  if (success) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse 80% 60% at 20% 30%, rgba(30,80,200,0.35) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 70%, rgba(100,30,180,0.25) 0%, transparent 55%), #0a0a1a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}>
        <div style={{
          background: "rgba(15,20,40,0.7)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "24px",
          padding: "48px 40px",
          maxWidth: "480px",
          width: "100%",
          textAlign: "center",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}>
          <div style={{
            width: 80, height: 80,
            background: "rgba(16,185,129,0.15)",
            border: "2px solid rgba(16,185,129,0.4)",
            borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 24px",
            boxShadow: "0 0 40px rgba(16,185,129,0.25)",
          }}>
            <CheckCircle2 style={{ width: 40, height: 40, color: "#34d399" }} />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "#fff", margin: "0 0 12px" }}>
            Dziękujemy za zapytanie!
          </h2>
          <p style={{ color: "rgba(255,255,255,0.5)", lineHeight: 1.7, margin: 0, fontSize: 15 }}>
            Twoje zgłoszenie zostało pomyślnie przesłane. Skontaktujemy się z Tobą tak szybko jak to możliwe w celu przygotowania bezpłatnej wyceny.
          </p>
        </div>
      </div>
    );
  }

  // ─── Hero styles (inline, no external CSS needed) ─
  const heroStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: "radial-gradient(ellipse 80% 60% at 20% 30%, rgba(30,80,200,0.35) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 70%, rgba(100,30,180,0.25) 0%, transparent 55%), #0a0a1a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 16px 64px",
    fontFamily: "'Inter', system-ui, sans-serif",
    position: "relative",
    overflow: "hidden",
  };

  const cardStyle: React.CSSProperties = {
    background: "rgba(15,20,40,0.72)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "24px",
    overflow: "hidden",
    boxShadow: "0 0 0 1px rgba(99,179,237,0.06), 0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.45)",
    marginBottom: 6,
  };

  const inputStyle = (field: string): React.CSSProperties => ({
    width: "100%",
    background: "rgba(255,255,255,0.05)",
    border: `1.5px solid ${errors[field] ? "#f87171" : "rgba(255,255,255,0.10)"}`,
    borderRadius: 12,
    padding: "12px 16px",
    color: "#fff",
    fontSize: 15,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s, box-shadow 0.2s",
  });

  const inputWithIconStyle = (field: string): React.CSSProperties => ({
    ...inputStyle(field),
    paddingLeft: 42,
  });

  const iconWrapStyle: React.CSSProperties = {
    position: "absolute",
    left: 14,
    top: "50%",
    transform: "translateY(-50%)",
    color: "rgba(255,255,255,0.3)",
    pointerEvents: "none",
  };

  return (
    <div style={heroStyle}>
      {/* Animated grid overlay */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }} />
      {/* Orbs */}
      <div style={{ position:"absolute", width:500, height:500, borderRadius:"50%", background:"rgba(37,99,235,0.15)", filter:"blur(80px)", top:-100, left:-100, zIndex:0, pointerEvents:"none" }} />
      <div style={{ position:"absolute", width:400, height:400, borderRadius:"50%", background:"rgba(124,58,237,0.12)", filter:"blur(80px)", bottom:-80, right:-80, zIndex:0, pointerEvents:"none" }} />

      <div style={{ position:"relative", zIndex:10, width:"100%", maxWidth:600, margin:"0 auto", display:"flex", flexDirection:"column", gap:32, alignItems:"center" }}>

        {/* Badge */}
        <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"6px 16px", borderRadius:100, border:"1px solid rgba(99,179,237,0.3)", background:"rgba(99,179,237,0.08)", color:"#93c5fd", fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" }}>
          <span style={{ width:6, height:6, borderRadius:"50%", background:"#60a5fa", boxShadow:"0 0 8px #60a5fa" }} />
          Bezpłatna wycena · Odpowiedź w 24h
        </div>

        {/* Headline */}
        <div style={{ textAlign:"center" }}>
          <h1 style={{ margin:"0 0 12px", fontSize:"clamp(28px, 5vw, 48px)", fontWeight:800, lineHeight:1.1, color:"#fff", letterSpacing:"-0.02em" }}>
            Ty wybierasz,{" "}
            <span style={{ background:"linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #34d399 100%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>
              my robimy resztę.
            </span>
          </h1>
          <p style={{ margin:0, fontSize:16, color:"rgba(255,255,255,0.5)", lineHeight:1.6 }}>
            Wypełnij formularz — oddzwonimy i przygotujemy bezpłatną wycenę.
          </p>
        </div>

        {/* ─── FORM CARD ─── */}
        <div style={{ ...cardStyle, width:"100%" }}>

          {/* Stepper */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"28px 32px 0", gap:0 }}>
            {STEPS.map((step, idx) => {
              const StepIcon = step.icon;
              const isDone = idx < stepIndex;
              const isActive = step.id === currentStep;
              return (
                <div key={step.id} style={{ display:"flex", alignItems:"center", flex:1, position:"relative" }}>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, flex:1 }}>
                    <div style={{
                      width:34, height:34, borderRadius:"50%",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:12, fontWeight:700,
                      background: isDone ? "#3b82f6" : isActive ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.05)",
                      border: `2px solid ${isDone ? "#3b82f6" : isActive ? "#3b82f6" : "rgba(255,255,255,0.12)"}`,
                      color: isDone ? "#fff" : isActive ? "#60a5fa" : "rgba(255,255,255,0.3)",
                      boxShadow: isActive ? "0 0 16px rgba(59,130,246,0.4)" : "none",
                      transition: "all 0.3s",
                      position: "relative", zIndex: 2, flexShrink: 0,
                    }}>
                      {isDone ? <CheckCircle2 style={{ width:14, height:14 }} /> : <StepIcon style={{ width:14, height:14 }} />}
                    </div>
                    <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", color: isActive ? "#93c5fd" : isDone ? "#6ee7b7" : "rgba(255,255,255,0.25)", whiteSpace:"nowrap" }}>
                      {step.label}
                    </span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div style={{ height:2, flex:1, maxWidth:40, background: isDone ? "linear-gradient(90deg, #3b82f6, #8b5cf6)" : "rgba(255,255,255,0.08)", marginBottom:20, flexShrink:0 }} />
                  )}
                </div>
              );
            })}
          </div>

          <form onSubmit={handleSubmit}>
            {/* Global error */}
            {errors.form && (
              <div style={{ margin:"16px 24px 0", padding:"12px 16px", borderRadius:10, background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.3)", fontSize:13, color:"#f87171", fontWeight:600 }}>
                {errors.form}
              </div>
            )}

            {/* ─── Krok 1: Dane ─── */}
            {currentStep === "dane" && (
              <div style={{ padding:"28px 32px", display:"flex", flexDirection:"column", gap:20 }}>
                <div>
                  <div style={{ fontSize:18, fontWeight:800, color:"#fff", marginBottom:4 }}>Twoje dane kontaktowe</div>
                  <div style={{ fontSize:13, color:"rgba(255,255,255,0.4)" }}>Podaj swoje dane, abyśmy mogli się z Tobą skontaktować.</div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                  <div>
                    <label style={labelStyle}>Imię <span style={{ color:"#f87171" }}>*</span></label>
                    <input type="text" value={firstName} onChange={(e) => { setFirstName(e.target.value); clearError("firstName"); }} placeholder="Jan" style={inputStyle("firstName")} autoFocus />
                    {errors.firstName && <p style={{ margin:"4px 0 0", fontSize:11, color:"#f87171" }}>{errors.firstName}</p>}
                  </div>
                  <div>
                    <label style={labelStyle}>Nazwisko <span style={{ color:"#f87171" }}>*</span></label>
                    <input type="text" value={lastName} onChange={(e) => { setLastName(e.target.value); clearError("lastName"); }} placeholder="Kowalski" style={inputStyle("lastName")} />
                    {errors.lastName && <p style={{ margin:"4px 0 0", fontSize:11, color:"#f87171" }}>{errors.lastName}</p>}
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Adres e-mail <span style={{ color:"#f87171" }}>*</span></label>
                  <div style={{ position:"relative" }}>
                    <span style={iconWrapStyle}><Mail style={{ width:16, height:16 }} /></span>
                    <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); clearError("email"); }} placeholder="jan@example.com" style={inputWithIconStyle("email")} />
                  </div>
                  {errors.email && <p style={{ margin:"4px 0 0", fontSize:11, color:"#f87171" }}>{errors.email}</p>}
                </div>
                <div>
                  <label style={labelStyle}>Numer telefonu <span style={{ color:"#f87171" }}>*</span></label>
                  <div style={{ position:"relative" }}>
                    <span style={iconWrapStyle}><Phone style={{ width:16, height:16 }} /></span>
                    <input type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); clearError("phone"); }} placeholder="000 000 000" style={inputWithIconStyle("phone")} />
                  </div>
                  {errors.phone && <p style={{ margin:"4px 0 0", fontSize:11, color:"#f87171" }}>{errors.phone}</p>}
                </div>
              </div>
            )}

            {/* ─── Krok 2: Adres ─── */}
            {currentStep === "adres" && (
              <div style={{ padding:"28px 32px", display:"flex", flexDirection:"column", gap:20 }}>
                <div>
                  <div style={{ fontSize:18, fontWeight:800, color:"#fff", marginBottom:4 }}>Adres</div>
                  <div style={{ fontSize:13, color:"rgba(255,255,255,0.4)" }}>Opcjonalnie — możesz pominąć ten krok.</div>
                </div>
                <div>
                  <label style={labelStyle}>Ulica</label>
                  <input type="text" value={street} onChange={(e) => setStreet(e.target.value)} placeholder="np. ul. Lipowa" style={inputStyle("")} />
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                  <div>
                    <label style={labelStyle}>Nr budynku</label>
                    <input type="text" value={buildingNumber} onChange={(e) => setBuildingNumber(e.target.value)} placeholder="12A" style={inputStyle("")} />
                  </div>
                  <div>
                    <label style={labelStyle}>Kod pocztowy</label>
                    <input type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="00-000" style={inputStyle("")} />
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                  <div>
                    <label style={labelStyle}>Miasto</label>
                    <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="np. Warszawa" style={inputStyle("")} />
                  </div>
                  <div>
                    <label style={labelStyle}>Województwo</label>
                    <input type="text" value={stateRegion} onChange={(e) => setStateRegion(e.target.value)} placeholder="np. Mazowieckie" style={inputStyle("")} />
                  </div>
                </div>
              </div>
            )}

            {/* ─── Krok 3: Usługi ─── */}
            {currentStep === "usluga" && (
              <div style={{ padding:"28px 32px", display:"flex", flexDirection:"column", gap:20 }}>
                <div>
                  <div style={{ fontSize:18, fontWeight:800, color:"#fff", marginBottom:4 }}>Jaką usługę chcesz wycenić?</div>
                  <div style={{ fontSize:13, color:"rgba(255,255,255,0.4)" }}>Możesz wybrać więcej niż jedną opcję. <span style={{ color:"#f87171" }}>*</span></div>
                </div>
                {activeServices === undefined ? (
                  <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:"rgba(255,255,255,0.4)" }}>
                    <Loader2 style={{ width:16, height:16, animation:"spin 0.7s linear infinite" }} /> Ładowanie usług...
                  </div>
                ) : (
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(140px,1fr))", gap:12 }}>
                    {activeServices.map((service) => {
                      const selected = selectedServices.includes(service.name);
                      return (
                        <button
                          key={service._id}
                          type="button"
                          onClick={() => handleServiceToggle(service.name)}
                          style={{
                            position:"relative",
                            display:"flex", flexDirection:"column", alignItems:"center", gap:10,
                            padding:"16px 12px 14px",
                            borderRadius:14,
                            border: `1.5px solid ${selected ? "#3b82f6" : "rgba(255,255,255,0.08)"}`,
                            background: selected ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.03)",
                            cursor:"pointer",
                            transition:"all 0.2s",
                            boxShadow: selected ? "0 0 0 3px rgba(59,130,246,0.15), 0 8px 20px rgba(59,130,246,0.12)" : "none",
                          }}
                        >
                          <div style={{
                            position:"absolute", top:8, right:8,
                            width:18, height:18, borderRadius:"50%",
                            background: selected ? "#3b82f6" : "transparent",
                            border: `2px solid ${selected ? "#3b82f6" : "rgba(255,255,255,0.15)"}`,
                            display:"flex", alignItems:"center", justifyContent:"center",
                          }}>
                            {selected && <svg style={{ width:10, height:10 }} viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                          </div>
                          <div style={{
                            width:44, height:44, borderRadius:12,
                            background: selected ? "#3b82f6" : "rgba(255,255,255,0.07)",
                            display:"flex", alignItems:"center", justifyContent:"center",
                            color: selected ? "#fff" : "rgba(255,255,255,0.5)",
                          }}>
                            <ServiceIcon name={service.icon} className="h-5 w-5" />
                          </div>
                          <span style={{ fontSize:11, fontWeight:700, color: selected ? "#93c5fd" : "rgba(255,255,255,0.6)", textAlign:"center", lineHeight:1.3 }}>
                            {service.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {errors.services && <p style={{ margin:0, fontSize:11, color:"#f87171", fontWeight:600 }}>{errors.services}</p>}
              </div>
            )}

            {/* ─── Krok 4: Szczegóły ─── */}
            {currentStep === "szczegoly" && (
              <div style={{ padding:"28px 32px", display:"flex", flexDirection:"column", gap:20 }}>
                <div>
                  <div style={{ fontSize:18, fontWeight:800, color:"#fff", marginBottom:4 }}>Szczegóły i pliki</div>
                  <div style={{ fontSize:13, color:"rgba(255,255,255,0.4)" }}>Komentarz i pliki są opcjonalne.</div>
                </div>
                <div>
                  <label style={labelStyle}>Komentarz</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                    placeholder="Opisz czego potrzebujesz, np. rodzaj okien, kolor, wymiary..."
                    style={{ ...inputStyle(""), resize:"vertical", minHeight:80 } as React.CSSProperties}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Prześlij pliki z projektem</label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    style={{
                      display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                      width:"100%", padding:"12px 16px",
                      borderRadius:12, border:"1.5px dashed rgba(255,255,255,0.12)",
                      background:"rgba(255,255,255,0.03)",
                      color:"rgba(255,255,255,0.4)", fontSize:13, fontWeight:600,
                      cursor:"pointer", fontFamily:"inherit", transition:"all 0.2s",
                    }}
                  >
                    {uploading ? <Loader2 style={{ width:16, height:16 }} /> : <Paperclip style={{ width:16, height:16 }} />}
                    {uploading ? "Wgrywanie..." : "Kliknij, aby dodać pliki"}
                  </button>
                  <input ref={fileInputRef} type="file" multiple onChange={handleFileUpload} disabled={uploading || submitting} className="hidden" />
                  {uploadedFiles.length > 0 && (
                    <div style={{ marginTop:8, display:"flex", flexDirection:"column", gap:6 }}>
                      {uploadedFiles.map((f) => (
                        <div key={f.storageId} style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(59,130,246,0.08)", border:"1px solid rgba(59,130,246,0.15)", borderRadius:8, padding:"8px 12px" }}>
                          <Upload style={{ width:13, height:13, color:"#60a5fa", flexShrink:0 }} />
                          <span style={{ fontSize:12, color:"#93c5fd", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{f.name}</span>
                          <button type="button" onClick={() => setUploadedFiles(prev => prev.filter(x => x.storageId !== f.storageId))} style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(99,179,237,0.5)", padding:0 }}>
                            <X style={{ width:13, height:13 }} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {errors.upload && <p style={{ margin:"4px 0 0", fontSize:11, color:"#f87171" }}>{errors.upload}</p>}
                </div>
                <div style={{ paddingTop:16, borderTop:"1px solid rgba(255,255,255,0.06)" }}>
                  <label style={{ display:"flex", alignItems:"flex-start", gap:12, cursor:"pointer" }}>
                    <div
                      onClick={() => { setConsent(!consent); clearError("consent"); }}
                      style={{
                        width:20, height:20, borderRadius:5, flexShrink:0, marginTop:2,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        background: consent ? "#3b82f6" : "transparent",
                        border: `2px solid ${consent ? "#3b82f6" : errors.consent ? "#f87171" : "rgba(255,255,255,0.2)"}`,
                        cursor:"pointer", transition:"all 0.2s",
                      }}
                    >
                      {consent && <svg style={{ width:11, height:11 }} viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </div>
                    <span style={{ fontSize:12, color:"rgba(255,255,255,0.4)", lineHeight:1.6 }}>
                      Administratorem Twoich danych jest ADK ARKADIUSZ MARCHEWKA (NIP: 8222266889). Twoje dane przetwarzamy wyłącznie w celu przygotowania wyceny.{" "}
                      <span style={{ color:"#f87171" }}>*</span>
                    </span>
                  </label>
                  {errors.consent && <p style={{ margin:"6px 0 0 32px", fontSize:11, color:"#f87171", fontWeight:600 }}>{errors.consent}</p>}
                </div>
              </div>
            )}

            {/* ─── Footer nawigacja ─── */}
            <div style={{ padding:"20px 32px", borderTop:"1px solid rgba(255,255,255,0.06)", background:"rgba(0,0,0,0.2)", display:"flex", alignItems:"center", justifyContent:"space-between", gap:16 }}>
              {stepIndex > 0 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:"1.5px solid rgba(255,255,255,0.12)", borderRadius:12, padding:"10px 18px", color:"rgba(255,255,255,0.5)", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", transition:"all 0.2s" }}
                >
                  <ChevronLeft style={{ width:16, height:16 }} />
                  Wstecz
                </button>
              ) : <div />}

              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                {/* Dots */}
                <div style={{ display:"flex", gap:4 }}>
                  {STEPS.map((_, idx) => (
                    <div
                      key={idx}
                      style={{
                        height:5, borderRadius:99,
                        width: idx === stepIndex ? 20 : 6,
                        background: idx === stepIndex ? "#3b82f6" : idx < stepIndex ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.12)",
                        transition: "all 0.3s",
                      }}
                    />
                  ))}
                </div>

                {stepIndex < stepOrder.length - 1 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    style={{ display:"flex", alignItems:"center", gap:6, background:"linear-gradient(135deg, #2563eb, #7c3aed)", border:"none", borderRadius:12, padding:"12px 22px", color:"#fff", fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 8px 24px rgba(37,99,235,0.35)", transition:"all 0.2s" }}
                  >
                    Dalej
                    <ChevronRight style={{ width:16, height:16 }} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting || uploading}
                    style={{ display:"flex", alignItems:"center", gap:8, background:"linear-gradient(135deg, #2563eb, #7c3aed)", border:"none", borderRadius:12, padding:"12px 24px", color:"#fff", fontSize:14, fontWeight:800, cursor: submitting || uploading ? "not-allowed" : "pointer", fontFamily:"inherit", opacity: submitting || uploading ? 0.6 : 1, boxShadow:"0 8px 24px rgba(37,99,235,0.35)", transition:"all 0.2s" }}
                  >
                    {submitting ? (
                      <><Loader2 style={{ width:16, height:16 }} /> Wysyłanie...</>
                    ) : (
                      <><CheckCircle2 style={{ width:16, height:16 }} /> Wyślij formularz</>
                    )}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Trust bar */}
        <div style={{ display:"flex", gap:24, flexWrap:"wrap", justifyContent:"center" }}>
          {[["⏱️","Odpowiedź w 24h"],["🆓","Bezpłatna wycena"],["📍","Mińsk Mazowiecki"],["🔒","Dane bezpieczne"]].map(([icon, text]) => (
            <div key={text} style={{ display:"flex", alignItems:"center", gap:8, color:"rgba(255,255,255,0.4)", fontSize:12, fontWeight:600 }}>
              <span style={{ fontSize:15 }}>{icon}</span> {text}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
