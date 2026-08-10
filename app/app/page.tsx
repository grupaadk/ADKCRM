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
} from "lucide-react";

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

import { useAuthActions } from "@convex-dev/auth/react";
import { LogOut, LogIn, ShieldCheck } from "lucide-react";

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

  const statuses = useStatuses();
  const statusMap = useMemo(
    () => Object.fromEntries(statuses.map((s) => [s.key, s.label])),
    [statuses]
  );

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

  return (
    <div className="flex flex-col min-h-[100dvh] w-full bg-slate-50 text-gray-900 select-none relative">
      {/* Top Mobile Bar */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-30 flex items-center justify-between">
        {activeTab === "add-document" ? (
          <div className="flex items-center gap-3 w-full">
            <button
              type="button"
              onClick={() => {
                setActiveTab("home");
                resetForm();
              }}
              className="p-1 rounded-full text-slate-600 hover:bg-slate-100 transition"
            >
              <ArrowLeft className="size-5" />
            </button>
            <span className="font-bold text-slate-800 text-sm">Dodaj dokument / zdjęcie</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-[#4dbdc6] text-white flex items-center justify-center font-bold text-xs">
              ADK
            </div>
            <span className="font-bold text-slate-800 text-sm">Aplikacja Mobilna</span>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-4 pb-24 overflow-y-auto">
        {activeTab === "home" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm space-y-2">
              <h2 className="text-lg font-extrabold text-slate-800">
                {userFirstName ? `Cześć, ${userFirstName}! 👋` : "Cześć! 👋"}
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Użyj dolnego przycisku <span className="font-bold text-[#4dbdc6]">+</span> aby przejść do pełnego widoku dodawania dokumentów lub zdjęć.
              </p>
            </div>
          </div>
        )}

        {activeTab === "search" && (
          <div className="space-y-4">
            <h1 className="text-lg font-bold text-slate-800">Wyszukiwarka</h1>
            <p className="text-xs text-slate-500">Szukaj zleceń i klientów.</p>
          </div>
        )}

        {activeTab === "notifications" && (
          <div className="space-y-4">
            <h1 className="text-lg font-bold text-slate-800">Powiadomienia</h1>
            <p className="text-xs text-slate-500">Brak nowych powiadomień.</p>
          </div>
        )}

        {activeTab === "profile" && (
          <div className="space-y-4">
            <h1 className="text-lg font-bold text-slate-800">Mój Profil</h1>

            {me ? (
              <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-2xl bg-[#4dbdc6] text-white font-extrabold text-lg flex items-center justify-center">
                    {userFirstName ? userFirstName[0].toUpperCase() : "U"}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">{me.displayName ?? "Użytkownik"}</h3>
                    <p className="text-xs text-slate-400">{me.email}</p>
                    <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                      <ShieldCheck className="size-3" />
                      Zalogowany (rola: {me.role ?? "użytkownik"})
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => signOut()}
                  className="w-full py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-bold text-xs hover:bg-rose-100 transition flex items-center justify-center gap-2"
                >
                  <LogOut className="size-4" />
                  Wyloguj się
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-800 text-sm">Zaloguj się danymi z /admin</h3>
                  <p className="text-xs text-slate-400">
                    Zaloguj się swoim e-mailem i hasłem administratora/pracownika.
                  </p>
                </div>

                {loginError && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <form onSubmit={handleLoginSubmit} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">E-mail / Login</label>
                    <input
                      type="email"
                      required
                      placeholder="admin@adkokna.pl"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-xs text-slate-800 focus:border-[#4dbdc6] focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Hasło</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-xs text-slate-800 focus:border-[#4dbdc6] focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loginSubmitting}
                    className="w-full py-3 rounded-xl bg-[#4dbdc6] text-white font-bold text-xs shadow-md hover:bg-[#3caab3] disabled:opacity-50 transition flex items-center justify-center gap-2"
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
            )}
          </div>
        )}

        {/* FULL PAGE: Add Document / Photo View */}
        {activeTab === "add-document" && (
          <div className="space-y-5 bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
            {result && result.ok ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-4">
                <CheckCircle className="size-12 text-emerald-500 mx-auto" />
                <h4 className="font-bold text-emerald-800 text-base">Dokument przesłany pomyślnie!</h4>
                <p className="text-xs text-emerald-600">
                  Plik został przypisany i wyeksportowany na Dysk Google.
                </p>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                    }}
                    className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-sm hover:bg-emerald-700 transition"
                  >
                    Wgraj kolejny dokument
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("home");
                      resetForm();
                    }}
                    className="w-full py-2.5 rounded-xl border border-emerald-300 text-emerald-800 font-semibold text-xs hover:bg-emerald-100/50 transition"
                  >
                    Wróć do ekranu głównego
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {result && !result.ok && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-start gap-2 text-rose-700 text-xs">
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    <span>{result.error}</span>
                  </div>
                )}

                {/* Step 1: Select Client */}
                <div className="space-y-1.5 relative">
                  <label className="text-xs font-bold text-slate-700">1. Wybierz Klienta *</label>
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
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-3 text-xs text-slate-800 focus:border-[#4dbdc6] focus:outline-none"
                    />
                    {clientSearch && (
                      <button
                        type="button"
                        onClick={resetForm}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </div>

                  {showClientDropdown && searchResults && searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto z-50">
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
                            className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-slate-100 flex items-center justify-between border-b border-gray-100 last:border-0"
                          >
                            <span className="font-semibold text-slate-800">{name}</span>
                            {client.city && <span className="text-[10px] text-slate-400">{client.city}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Step 2: Select Order */}
                {selectedClientId && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">2. Wybierz Zlecenie *</label>
                    {orders && orders.length > 0 ? (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {orders.map((o) => {
                          const isSelected = selectedOrderId === o._id;
                          const statusStr = statusMap[o.status] ?? o.status;
                          return (
                            <button
                              key={o._id}
                              type="button"
                              onClick={() => setSelectedOrderId(isSelected ? null : o._id)}
                              className={`w-full text-left p-3 rounded-xl border text-xs transition flex items-center justify-between ${
                                isSelected
                                  ? "border-[#4dbdc6] bg-[#4dbdc6]/10 text-slate-900 font-semibold"
                                  : "border-gray-200 bg-white hover:bg-slate-50 text-slate-700"
                              }`}
                            >
                              <div>
                                <div className="font-bold text-slate-800">{o.name ?? "Zlecenie bez nazwy"}</div>
                                {o.customText && (
                                  <div className="text-[11px] text-[#4dbdc6] font-medium mt-0.5">{o.customText}</div>
                                )}
                              </div>
                              {isSelected && <CheckCircle className="size-4 text-[#4dbdc6]" />}
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
                  <label className="text-xs font-bold text-slate-700">3. Typ Dokumentu *</label>
                  <select
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value as DocumentType)}
                    className="w-full rounded-xl border border-gray-300 px-3.5 py-3 text-xs text-slate-800 focus:border-[#4dbdc6] focus:outline-none bg-white font-medium"
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
                  <label className="text-xs font-bold text-slate-700">4. Wybierz Plik lub Zrób Zdjęcie *</label>
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
                    <div className="flex items-center justify-between p-3.5 bg-slate-100 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <FileText className="size-5 text-[#4dbdc6] shrink-0" />
                        <span className="text-xs font-semibold text-slate-700 truncate">{file.name}</span>
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
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 gap-1.5 transition"
                      >
                        <Camera className="size-6 text-[#4dbdc6]" />
                        <span className="text-xs font-bold">Zrób zdjęcie</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 gap-1.5 transition"
                      >
                        <Upload className="size-6 text-[#4dbdc6]" />
                        <span className="text-xs font-bold">Wybierz plik</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!selectedClientId || !selectedOrderId || !file || uploading}
                  className="w-full py-3.5 rounded-xl bg-[#4dbdc6] text-white font-bold text-xs shadow-md hover:bg-[#3caab3] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 mt-4"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" />
                      Wgrywanie do Dysk Google...
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

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 pb-[env(safe-area-inset-bottom)]">
        <div className="relative flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
          {/* Home */}
          <button
            type="button"
            onClick={() => setActiveTab("home")}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              activeTab === "home" ? "text-[#4dbdc6]" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <Home className="size-6 stroke-[1.75]" />
            <span className="text-[11px] font-medium mt-1">Home</span>
          </button>

          {/* Search */}
          <button
            type="button"
            onClick={() => setActiveTab("search")}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              activeTab === "search" ? "text-[#4dbdc6]" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <Search className="size-6 stroke-[1.75]" />
            <span className="text-[11px] font-medium mt-1">Search</span>
          </button>

          {/* Center Floating (+) Button -> FULL PAGE VIEW */}
          <div className="flex-1 flex items-center justify-center relative -top-5">
            <button
              type="button"
              onClick={() => {
                setActiveTab("add-document");
                resetForm();
              }}
              className={`size-13 rounded-2xl text-white flex items-center justify-center shadow-lg active:scale-95 transition-all ${
                activeTab === "add-document" ? "bg-slate-800" : "bg-[#4dbdc6] hover:bg-[#3caab3]"
              }`}
            >
              <Plus className="size-7 stroke-[2.5]" />
            </button>
          </div>

          {/* Notifications */}
          <button
            type="button"
            onClick={() => setActiveTab("notifications")}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              activeTab === "notifications" ? "text-[#4dbdc6]" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <Bell className="size-6 stroke-[1.75]" />
            <span className="text-[11px] font-medium mt-1">Notifications</span>
          </button>

          {/* Profile */}
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              activeTab === "profile" ? "text-[#4dbdc6]" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <User className="size-6 stroke-[1.75]" />
            <span className="text-[11px] font-medium mt-1">Profile</span>
          </button>
        </div>
      </div>
    </div>
  );
}
