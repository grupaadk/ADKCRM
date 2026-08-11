"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Home,
  Search,
  Bell,
  User,
  Plus,
  Camera,
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  FileText,
  ArrowLeft,
  RefreshCw,
  LogOut,
  LogIn,
  ShieldCheck,
  Mic,
  Calendar,
  Sparkles,
  ClipboardList,
} from "lucide-react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useStatuses } from "@/components/StatusLabelsContext";

type Tab = "home" | "search" | "notifications" | "profile" | "add-document";

const DOCUMENT_TYPES = [
  { id: "pomiar", label: "Pomiar" },
  { id: "umowa", label: "Umowa" },
  { id: "gwarancja_alco", label: "Gwarancja ALCO" },
  { id: "odbior_inwestor", label: "Odbiór inwestorski" },
  { id: "faktura", label: "Faktura" },
  { id: "reklamacja", label: "Reklamacja" },
] as const;

type DocumentType = (typeof DOCUMENT_TYPES)[number]["id"];

export default function AppPwaPage() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const { signIn, signOut } = useAuthActions();

  // Auth User Query
  const me = useQuery(api.users.me);

  // Login Form state for PWA
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  useStatuses();


  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setLoginSubmitting(true);
    try {
      await signIn("password", {
        flow: "signIn",
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
      });
      setLoginEmail("");
      setLoginPassword("");
    } catch {
      setLoginError("Nieprawidłowy login lub hasło.");
    } finally {
      setLoginSubmitting(false);
    }
  }

  // Get user's first name for greeting
  const userFirstName = me?.displayName
    ? me.displayName.split(" ")[0]
    : me?.email
    ? me.email.split("@")[0]
    : null;

  const todayFormatted = useMemo(() => {
    return new Date().toLocaleDateString("pl-PL", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, []);

  // Form State
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<Id<"clients"> | null>(null);
  const [selectedClientName, setSelectedClientName] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<Id<"orders"> | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType>("pomiar");
  const [file, setFile] = useState<File | null>(null);
  const [signatureStatus, setSignatureStatus] = useState<"signed" | "not_applicable" | null>("not_applicable");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ ok: true; url: string } | { ok: false; error: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Convex Hooks
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const uploadUserDocument = useAction(api.googleDrive.uploadUserDocumentPublic);

  const searchResults = useQuery(
    api.clients.search,
    clientSearch.trim().length >= 1 ? { searchTerm: clientSearch.trim() } : "skip"
  );

  const orders = useQuery(
    api.orders.listByClient,
    selectedClientId ? { clientId: selectedClientId } : "skip"
  );

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW registration failed silently
      });
    }
  }, []);

  function resetForm() {
    setSelectedClientId(null);
    setSelectedClientName("");
    setClientSearch("");
    setShowClientDropdown(false);
    setSelectedOrderId(null);
    setDocumentType("pomiar");
    setFile(null);
    setSignatureStatus("not_applicable");
    setResult(null);
  }

  function selectClient(id: Id<"clients">, name: string) {
    setSelectedClientId(id);
    setSelectedClientName(name);
    setClientSearch(name);
    setShowClientDropdown(false);
    setSelectedOrderId(null);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClientId || !selectedOrderId || !file || !signatureStatus) return;

    setUploading(true);
    setResult(null);

    try {
      const uploadUrl = await generateUploadUrl();

      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("Błąd podczas przesyłania pliku do pamięci tymczasowej.");
      }

      const { storageId } = await uploadResponse.json();

      const driveUrl = await uploadUserDocument({
        storageId,
        fileName: file.name,
        orderId: selectedOrderId,
        documentType,
        signatureStatus,
      });

      setResult({ ok: true, url: driveUrl });
    } catch (err) {
      setResult({
        ok: false,
        error: err instanceof Error ? err.message : "Wystąpił nieoczekiwany błąd.",
      });
    } finally {
      setUploading(false);
    }
  }

  // If loading user state
  if (me === undefined) {
    return (
      <div className="flex min-h-[100dvh] w-full items-center justify-center bg-slate-50">
        <RefreshCw className="size-6 text-[#9B62EC] animate-spin" />
      </div>
    );
  }

  // If NOT logged in -> Show immediate mobile Login Screen
  if (me === null) {
    return (
      <div className="flex flex-col min-h-[100dvh] w-full bg-[#F5F4FA] justify-center items-center p-6 max-w-md mx-auto select-none">
        <div className="w-full bg-white rounded-3xl p-6 border border-gray-100 shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="size-16 rounded-3xl bg-gradient-to-br from-[#9B62EC] to-[#703BE4] text-white flex items-center justify-center font-extrabold text-2xl mx-auto shadow-lg shadow-purple-200">
              ADK
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">ADK Okna</h1>
            <p className="text-xs font-medium text-slate-400">Zaloguj się swoimi danymi z panelu</p>
          </div>

          {loginError && (
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-3.5 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Login / E-mail</label>
              <input
                type="text"
                required
                placeholder="Wpisz login..."
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-slate-50/50 px-4 py-3.5 text-xs text-slate-800 focus:border-[#9B62EC] focus:bg-white focus:outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Hasło</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-slate-50/50 px-4 py-3.5 text-xs text-slate-800 focus:border-[#9B62EC] focus:bg-white focus:outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loginSubmitting}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#9B62EC] to-[#703BE4] text-white font-bold text-sm shadow-lg shadow-purple-200 hover:opacity-95 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loginSubmitting ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <LogIn className="size-4" />
              )}
              Zaloguj się
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] max-w-md mx-auto bg-[#F7F7FD] text-slate-900 select-none relative font-sans">
      {/* Top Header - Stylized like Reference */}
      <header className="px-5 pt-5 pb-3 bg-[#F7F7FD] sticky top-0 z-30 flex items-center justify-between">
        {activeTab === "add-document" ? (
          <div className="flex items-center gap-3 w-full">
            <button
              type="button"
              onClick={() => {
                setActiveTab("home");
                resetForm();
              }}
              className="size-10 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-50 transition"
            >
              <ArrowLeft className="size-5" />
            </button>
            <h1 className="font-extrabold text-slate-900 text-lg">Dodaj dokument</h1>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-full bg-slate-200 border-2 border-white shadow-sm flex items-center justify-center text-slate-700 font-extrabold text-base overflow-hidden bg-cover bg-center" style={{ backgroundImage: "linear-gradient(135deg, #A886EF 0%, #764BA2 100%)" }}>
                <span className="text-white text-sm">
                  {userFirstName ? userFirstName[0].toUpperCase() : "A"}
                </span>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  Cześć, {userFirstName ?? "Użytkowniku"} <span className="text-sm">👋</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("search")}
                className="size-10 rounded-full bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-600 hover:bg-slate-50 transition"
              >
                <Search className="size-4 stroke-[2.2]" />
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("notifications")}
                className="size-10 rounded-full bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-600 hover:bg-slate-50 transition"
              >
                <Bell className="size-4 stroke-[2.2]" />
              </button>
            </div>
          </>
        )}
      </header>

      {/* Main Scrollable Content */}
      <div className="flex-1 flex flex-col px-5 pt-2 pb-28 space-y-6 overflow-y-auto">
        {activeTab === "home" && (
          <>
            {/* Title Section */}
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">ADK Okna</h1>
              <p className="text-xs font-medium text-slate-400 capitalize mt-0.5">{todayFormatted}</p>
            </div>

            {/* Featured Action Cards Grid */}
            <div className="grid grid-cols-2 gap-3.5">
              {/* Card 1: Purple Create New Note / Document */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab("add-document");
                  setDocumentType("pomiar");
                }}
                className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#AA7CFF] via-[#915BFF] to-[#7839F6] p-5 text-white shadow-xl shadow-purple-200/60 active:scale-[0.98] transition-all flex flex-col justify-between min-h-[170px] text-left group"
              >
                <div className="size-9 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                  <Plus className="size-5 text-white stroke-[2.5]" />
                </div>
                <div className="mt-6">
                  <span className="text-[11px] font-semibold text-white/80 block">Dodaj Nowy</span>
                  <span className="text-lg font-black text-white leading-tight block">Pomiar / Umowę</span>
                </div>
                <Sparkles className="absolute -right-3 -bottom-3 size-24 text-white/10 pointer-events-none group-hover:scale-110 transition-transform" />
              </button>

              {/* Card 2: Golden / Yellow Create Task */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab("add-document");
                  setDocumentType("odbior_inwestor");
                }}
                className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#FFC843] via-[#FBB03B] to-[#F1931B] p-5 text-white shadow-xl shadow-amber-200/60 active:scale-[0.98] transition-all flex flex-col justify-between min-h-[170px] text-left group"
              >
                <div className="size-9 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                  <Plus className="size-5 text-white stroke-[2.5]" />
                </div>
                <div className="mt-6">
                  <span className="text-[11px] font-semibold text-white/90 block">Szybki Odbiór</span>
                  <span className="text-lg font-black text-white leading-tight block">Inwestorski</span>
                </div>
                <ClipboardList className="absolute -right-2 -bottom-2 size-24 text-white/10 pointer-events-none group-hover:scale-110 transition-transform" />
              </button>
            </div>

            {/* Profile Setup / Status Banner */}
            <div className="bg-white rounded-3xl p-4.5 border border-slate-100 shadow-sm flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-slate-800">Status Dokumentacji</h3>
                <p className="text-xs font-medium text-slate-400">Synchronizacja z Google Drive</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="w-24 h-3 bg-slate-100 rounded-full overflow-hidden p-0.5">
                  <div className="h-full bg-gradient-to-r from-purple-400 via-pink-400 to-amber-300 rounded-full w-4/5" />
                </div>
                <span className="text-[11px] font-extrabold text-slate-700">80% Gotowe</span>
              </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="space-y-3">
              <h2 className="text-sm font-black text-slate-900 tracking-tight">Kategorie & Akcje</h2>
              <div className="grid grid-cols-4 gap-2.5">
                {/* Notebook */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("add-document");
                    setDocumentType("pomiar");
                  }}
                  className="bg-white rounded-3xl p-3 flex flex-col items-center justify-center border border-slate-100 shadow-sm hover:shadow-md transition active:scale-95 text-center gap-1.5"
                >
                  <div className="size-11 rounded-2xl bg-pink-50 text-pink-500 flex items-center justify-center">
                    <FileText className="size-5" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-700">Pomiary</span>
                </button>

                {/* Camera */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("add-document");
                    setTimeout(() => cameraInputRef.current?.click(), 100);
                  }}
                  className="bg-white rounded-3xl p-3 flex flex-col items-center justify-center border border-slate-100 shadow-sm hover:shadow-md transition active:scale-95 text-center gap-1.5"
                >
                  <div className="size-11 rounded-2xl bg-purple-50 text-purple-500 flex items-center justify-center">
                    <Camera className="size-5" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-700">Aparat</span>
                </button>

                {/* Audio */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("add-document");
                    setDocumentType("reklamacja");
                  }}
                  className="bg-white rounded-3xl p-3 flex flex-col items-center justify-center border border-slate-100 shadow-sm hover:shadow-md transition active:scale-95 text-center gap-1.5"
                >
                  <div className="size-11 rounded-2xl bg-sky-50 text-sky-500 flex items-center justify-center">
                    <Mic className="size-5" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-700">Reklamacja</span>
                </button>

                {/* Events */}
                <button
                  type="button"
                  onClick={() => setActiveTab("search")}
                  className="bg-white rounded-3xl p-3 flex flex-col items-center justify-center border border-slate-100 shadow-sm hover:shadow-md transition active:scale-95 text-center gap-1.5"
                >
                  <div className="size-11 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center">
                    <Calendar className="size-5" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-700">Zlecenia</span>
                </button>
              </div>
            </div>
          </>
        )}

        {activeTab === "search" && (
          <div className="space-y-4">
            <h1 className="text-xl font-extrabold text-slate-900">Wyszukiwarka Zleceń</h1>
            <div className="relative">
              <input
                type="text"
                placeholder="Szukaj po nazwisku lub firmie..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-xs text-slate-800 focus:border-[#9B62EC] focus:outline-none shadow-sm"
              />
              <Search className="absolute right-4 top-3.5 size-4 text-slate-400" />
            </div>

            {searchResults && searchResults.length > 0 ? (
              <div className="space-y-2">
                {searchResults.map((c) => (
                  <div key={c._id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-800 text-xs">
                        {c.clientType === "business" && c.companyName ? c.companyName : `${c.lastName} ${c.firstName}`}
                      </div>
                      <div className="text-[10px] text-slate-400">{c.city ?? "Brak adresu"}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        selectClient(c._id, c.lastName);
                        setActiveTab("add-document");
                      }}
                      className="px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 font-bold text-[10px]"
                    >
                      Wybierz
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-6">Wpisz frazę wyszukiwania powyżej.</p>
            )}
          </div>
        )}

        {activeTab === "notifications" && (
          <div className="space-y-4">
            <h1 className="text-xl font-extrabold text-slate-900">Powiadomienia</h1>
            <div className="bg-white rounded-3xl p-6 text-center border border-slate-100 shadow-sm space-y-2">
              <Bell className="size-8 text-purple-300 mx-auto" />
              <p className="text-xs font-semibold text-slate-500">Wszystkie dokumenty zostały zsynchronizowane.</p>
            </div>
          </div>
        )}

        {activeTab === "profile" && (
          <div className="space-y-4">
            <h1 className="text-xl font-extrabold text-slate-900">Mój Profil</h1>

            {me && (
              <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center gap-3.5">
                  <div className="size-14 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-500 text-white font-extrabold text-xl flex items-center justify-center shadow-md shadow-purple-200">
                    {userFirstName ? userFirstName[0].toUpperCase() : "U"}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-sm">{me.displayName ?? "Użytkownik"}</h3>
                    <p className="text-xs text-slate-400">{me.email}</p>
                    <div className="mt-1 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold">
                      <ShieldCheck className="size-3" />
                      Zalogowany ({me.role ?? "ekipa"})
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => signOut()}
                  className="w-full py-3 rounded-2xl border border-rose-100 bg-rose-50 text-rose-700 font-bold text-xs hover:bg-rose-100 transition flex items-center justify-center gap-2"
                >
                  <LogOut className="size-4" />
                  Wyloguj się
                </button>
              </div>
            )}
          </div>
        )}

        {/* FULL PAGE: Add Document / Photo View */}
        {activeTab === "add-document" && (
          <div className="space-y-5 bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
            {result && result.ok ? (
              <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-6 text-center space-y-4">
                <CheckCircle className="size-12 text-emerald-500 mx-auto" />
                <h4 className="font-extrabold text-emerald-900 text-base">Dokument wysłany!</h4>
                <p className="text-xs text-emerald-700 font-medium">
                  Plik został bezpiecznie umieszczony na Dysku Google.
                </p>
                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() => resetForm()}
                    className="w-full py-3.5 rounded-2xl bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-200 transition"
                  >
                    Wgraj kolejny dokument
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("home");
                      resetForm();
                    }}
                    className="w-full py-2.5 rounded-2xl text-emerald-800 font-bold text-xs"
                  >
                    Wróć do ekranu głównego
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {result && !result.ok && (
                  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 flex items-start gap-2 text-rose-700 text-xs">
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    <span>{result.error}</span>
                  </div>
                )}

                {/* Step 1: Select Client */}
                <div className="space-y-1.5 relative">
                  <label className="text-xs font-extrabold text-slate-800">1. Wybierz Klienta *</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Wpisz nazwisko lub firmę..."
                      value={clientSearch}
                      onChange={(e) => {
                        setClientSearch(e.target.value);
                        setShowClientDropdown(true);
                        if (selectedClientId) setSelectedClientId(null);
                      }}
                      onFocus={() => setShowClientDropdown(true)}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 text-xs text-slate-800 focus:border-[#9B62EC] focus:outline-none bg-slate-50/50"
                    />
                    {clientSearch && (
                      <button
                        type="button"
                        onClick={resetForm}
                        className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600"
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </div>

                  {showClientDropdown && searchResults && searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-48 overflow-y-auto z-50">
                      {searchResults.map((client) => {
                        const name =
                          client.clientType === "business" && client.companyName
                            ? client.companyName
                            : `${client.lastName} ${client.firstName}`.trim();
                        return (
                          <button
                            key={client._id}
                            type="button"
                            onClick={() => selectClient(client._id, name)}
                            className="w-full text-left px-4 py-3 text-xs hover:bg-purple-50/50 flex items-center justify-between border-b border-slate-100 last:border-0"
                          >
                            <span className="font-bold text-slate-800">{name}</span>
                            {client.city && <span className="text-[10px] font-medium text-slate-400">{client.city}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Step 2: Select Order */}
                {selectedClientId && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-800">2. Wybierz Zlecenie *</label>
                    {orders && orders.length > 0 ? (
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {orders.map((o) => {
                          const isSelected = selectedOrderId === o._id;
                          return (
                            <button
                              key={o._id}
                              type="button"
                              onClick={() => setSelectedOrderId(isSelected ? null : o._id)}
                              className={`w-full text-left p-3.5 rounded-2xl border text-xs transition flex items-center justify-between ${
                                isSelected
                                  ? "border-[#9B62EC] bg-purple-50/60 text-slate-900 font-bold shadow-sm"
                                  : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                              }`}
                            >
                              <div>
                                <div className="font-extrabold text-slate-900">{o.name ?? "Zlecenie bez nazwy"}</div>
                                {o.customText && (
                                  <div className="text-[11px] text-[#9B62EC] font-semibold mt-0.5">{o.customText}</div>
                                )}
                              </div>
                              {isSelected && <CheckCircle className="size-5 text-[#9B62EC]" />}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">Brak otwartych zleceń dla tego klienta.</p>
                    )}
                  </div>
                )}

                {/* Step 3: Document Type */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-800">3. Typ Dokumentu *</label>
                  <select
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value as DocumentType)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 text-xs text-slate-800 focus:border-[#9B62EC] focus:outline-none bg-slate-50/50 font-bold"
                  >
                    {DOCUMENT_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Step 4: Photo / File Input buttons */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-800">4. Zdjęcie lub Plik *</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  {file ? (
                    <div className="flex items-center justify-between p-4 bg-purple-50/60 rounded-2xl border border-purple-100">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileText className="size-5 text-[#9B62EC] shrink-0" />
                        <span className="text-xs font-bold text-slate-800 truncate">{file.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFile(null)}
                        className="text-slate-400 hover:text-slate-600 p-1"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 hover:bg-purple-50/30 text-slate-700 gap-2 transition"
                      >
                        <Camera className="size-6 text-[#9B62EC]" />
                        <span className="text-xs font-extrabold">Zrób zdjęcie</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 hover:bg-purple-50/30 text-slate-700 gap-2 transition"
                      >
                        <Upload className="size-6 text-[#9B62EC]" />
                        <span className="text-xs font-extrabold">Wybierz plik</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!selectedClientId || !selectedOrderId || !file || uploading}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#9B62EC] to-[#703BE4] text-white font-extrabold text-xs shadow-lg shadow-purple-200 hover:opacity-95 disabled:opacity-50 transition flex items-center justify-center gap-2 mt-4"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" />
                      Wgrywanie na Dysk Google...
                    </>
                  ) : (
                    <>
                      <Upload className="size-4" />
                      Wyślij dokument
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Floating Dark Bottom Navigation Capsule (Inverted styling like Evernote reference) */}
      <div className="fixed bottom-4 left-4 right-4 max-w-sm mx-auto z-40">
        <div className="bg-[#1A0938] backdrop-blur-md text-white rounded-full p-2 shadow-2xl border border-white/10 flex items-center justify-between">
          {/* Main Action Pill Button ("Create") */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("add-document");
              resetForm();
            }}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-full transition-all duration-300 font-extrabold text-xs ${
              activeTab === "add-document"
                ? "bg-white text-[#1A0938] shadow-md"
                : "bg-gradient-to-r from-[#FFB3C6] via-[#FF8FB1] to-[#E26EE5] text-slate-950 shadow-lg shadow-pink-500/20 active:scale-95"
            }`}
          >
            <div className="size-6 rounded-full bg-white/30 flex items-center justify-center">
              <Plus className="size-4 stroke-[3]" />
            </div>
            <span>Dodaj</span>
          </button>

          {/* Icon Tabs */}
          <div className="flex items-center gap-1 pr-2">
            {/* Home */}
            <button
              type="button"
              onClick={() => setActiveTab("home")}
              className={`p-2.5 rounded-full transition ${
                activeTab === "home" ? "bg-white/20 text-white" : "text-white/60 hover:text-white"
              }`}
            >
              <Home className="size-5 stroke-[2]" />
            </button>

            {/* Search */}
            <button
              type="button"
              onClick={() => setActiveTab("search")}
              className={`p-2.5 rounded-full transition ${
                activeTab === "search" ? "bg-white/20 text-white" : "text-white/60 hover:text-white"
              }`}
            >
              <Search className="size-5 stroke-[2]" />
            </button>

            {/* Notifications */}
            <button
              type="button"
              onClick={() => setActiveTab("notifications")}
              className={`p-2.5 rounded-full transition ${
                activeTab === "notifications" ? "bg-white/20 text-white" : "text-white/60 hover:text-white"
              }`}
            >
              <Bell className="size-5 stroke-[2]" />
            </button>

            {/* Profile */}
            <button
              type="button"
              onClick={() => setActiveTab("profile")}
              className={`p-2.5 rounded-full transition ${
                activeTab === "profile" ? "bg-white/20 text-white" : "text-white/60 hover:text-white"
              }`}
            >
              <User className="size-5 stroke-[2]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
