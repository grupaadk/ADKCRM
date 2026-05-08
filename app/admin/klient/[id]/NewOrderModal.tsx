"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { SERVICES } from "@/convex/schema";
import AddressSearch, { type AddressData } from "@/components/AddressSearch";

interface NewOrderModalProps {
  clientId?: Id<"clients">;
  onClose: () => void;
  onSuccess: (orderId: Id<"orders">, clientId: Id<"clients">) => void;
}

type Step = "client" | "services" | "colors" | "location";

function ClientSearch({ onSelect }: { onSelect: (id: Id<"clients">, name: string) => void }) {
  const [query, setQuery] = useState("");
  const results = useQuery(api.clients.search, query.trim().length >= 2 ? { searchTerm: query.trim() } : "skip");
  const recentClients = useQuery(api.clients.list, query.trim().length < 2 ? {} : "skip");

  const items = query.trim().length >= 2 ? results : recentClients?.page;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p className="text-sm text-slate-500">Wyszukaj klienta po nazwisku.</p>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Wpisz nazwisko..."
        autoFocus
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 280, overflowY: "auto" }}>
        {items === undefined && <p className="text-xs text-slate-400">Ładowanie...</p>}
        {items?.length === 0 && <p className="text-xs text-slate-400">Brak wyników.</p>}
        {items?.map((c) => (
          <button
            key={c._id}
            type="button"
            onClick={() => onSelect(c._id, `${c.firstName} ${c.lastName}`)}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-left text-sm hover:border-slate-300 hover:bg-slate-50"
          >
            <span className="font-medium text-slate-800">{c.lastName} {c.firstName}</span>
            {c.city && <span className="ml-2 text-xs text-slate-400">{c.city}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

const WINDOW_COLORS = ["Złoty dąb", "Orzech", "Winchester", "Antracyt", "Biały", "Woodec Oak", "Niestandardowy"];
const TERRACE_COLORS = ["Antracyt", "Brąz jasny", "Niestandardowy"];
const CONSTRUCTION_COLORS = ["Biały", "Antracyt", "Brązowy", "Niestandardowy"];
const SUN_TYPES = ["Rolety", "Żaluzje"];

const COLOR_SERVICES = new Set(["Okna", "Drzwi", "Brama", "Zabudowa tarasu", "Konstrukcja aluminiowa", "System przeciwsłoneczny"]);

function ColorSection({
  title,
  options,
  selected,
  onChange,
}: {
  title: string;
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
}) {
  function toggle(opt: string) {
    onChange(selected.includes(opt) ? selected.filter((v) => v !== opt) : [...selected, opt]);
  }
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              selected.includes(opt)
                ? "border-blue-500 bg-blue-600 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function NewOrderModal({ clientId: initialClientId, onClose, onSuccess }: NewOrderModalProps) {
  const [resolvedClientId, setResolvedClientId] = useState<Id<"clients"> | undefined>(initialClientId);
  const [step, setStep] = useState<Step>(initialClientId ? "services" : "client");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [windowColor, setWindowColor] = useState<string[]>([]);
  const [doorColor, setDoorColor] = useState<string[]>([]);
  const [gateColor, setGateColor] = useState<string[]>([]);
  const [terraceColor, setTerraceColor] = useState<string[]>([]);
  const [constructionColor, setConstructionColor] = useState<string[]>([]);
  const [sunProtectionType, setSunProtectionType] = useState<string[]>([]);
  const [investment, setInvestment] = useState({
    street: "",
    buildingNumber: "",
    apartmentNumber: "",
    postalCode: "",
    city: "",
  });
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createOrder = useMutation(api.orders.create);

  const hasColorStep = selectedServices.some((s) => COLOR_SERVICES.has(s));
  const baseSteps: Step[] = hasColorStep ? ["services", "colors", "location"] : ["services", "location"];
  const allSteps: Step[] = initialClientId ? baseSteps : ["client", ...baseSteps];
  const stepIndex = allSteps.indexOf(step);

  function toggleService(service: string) {
    setSelectedServices((prev) =>
      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service],
    );
  }

  function handleAddressSelect(address: AddressData) {
    setInvestment((prev) => ({
      ...prev,
      street: address.street ?? prev.street,
      buildingNumber: address.buildingNumber ?? prev.buildingNumber,
      city: address.city ?? prev.city,
      postalCode: address.postalCode ?? prev.postalCode,
    }));
  }

  function handleNext() {
    if (step === "client") {
      if (!resolvedClientId) {
        setError("Wybierz klienta.");
        return;
      }
      setError(null);
      setStep("services");
    } else if (step === "services") {
      if (selectedServices.length === 0) {
        setError("Wybierz co najmniej jedną usługę.");
        return;
      }
      setError(null);
      setStep(hasColorStep ? "colors" : "location");
    } else if (step === "colors") {
      setError(null);
      setStep("location");
    }
  }

  function handleBack() {
    setError(null);
    if (step === "location") setStep(hasColorStep ? "colors" : "services");
    else if (step === "colors") setStep("services");
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
        windowColor: windowColor.length > 0 ? windowColor : undefined,
        doorColor: doorColor.length > 0 ? doorColor : undefined,
        gateColor: gateColor.length > 0 ? gateColor : undefined,
        terraceColor: terraceColor.length > 0 ? terraceColor : undefined,
        constructionColor: constructionColor.length > 0 ? constructionColor : undefined,
        sunProtectionType: sunProtectionType.length > 0 ? sunProtectionType : undefined,
        investmentStreet: investment.street.trim() || undefined,
        investmentBuildingNumber: investment.buildingNumber.trim() || undefined,
        investmentApartmentNumber: investment.apartmentNumber.trim() || undefined,
        investmentPostalCode: investment.postalCode.trim() || undefined,
        investmentCity: investment.city.trim() || undefined,
        comment: comment.trim() || undefined,
      });
      onSuccess(orderId, resolvedClientId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wystąpił błąd podczas tworzenia zlecenia.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
        onClick={() => { if (!submitting) onClose(); }}
      />
      <div className="relative flex w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl" style={{ maxHeight: "90vh" }}>
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-slate-900">Nowe zlecenie</h2>
            <div className="flex items-center gap-1">
              {allSteps.map((s, i) => (
                <div key={s} className="flex items-center gap-1">
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                      i < stepIndex
                        ? "bg-blue-600 text-white"
                        : i === stepIndex
                          ? "bg-blue-100 text-blue-700 ring-2 ring-blue-600 ring-offset-1"
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
                      className={`h-0.5 w-4 rounded-full transition-colors ${
                        i < stepIndex ? "bg-blue-500" : "bg-slate-200"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={() => { if (!submitting) onClose(); }}
            disabled={submitting}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Krok 0: Wybór klienta */}
          {step === "client" && (
            <ClientSearch onSelect={(id) => { setResolvedClientId(id); setError(null); setStep("services"); }} />
          )}

          {/* Krok 1: Usługi */}
          {step === "services" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">Wybierz usługi dla tego zlecenia.</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {SERVICES.map((service) => (
                  <button
                    key={service}
                    type="button"
                    onClick={() => toggleService(service)}
                    className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                      selectedServices.includes(service)
                        ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {service}
                  </button>
                ))}
              </div>
              {error && <p className="text-xs font-medium text-red-600">{error}</p>}
            </div>
          )}

          {/* Krok 2: Kolory */}
          {step === "colors" && (
            <div className="space-y-5">
              <p className="text-sm text-slate-500">Wybierz kolory dla wybranych usług. Możesz wybrać kilka.</p>
              {selectedServices.includes("Okna") && (
                <ColorSection title="Kolor okien" options={WINDOW_COLORS} selected={windowColor} onChange={setWindowColor} />
              )}
              {selectedServices.includes("Drzwi") && (
                <ColorSection title="Kolor drzwi" options={WINDOW_COLORS} selected={doorColor} onChange={setDoorColor} />
              )}
              {selectedServices.includes("Brama") && (
                <ColorSection title="Kolor bramy" options={WINDOW_COLORS} selected={gateColor} onChange={setGateColor} />
              )}
              {selectedServices.includes("Zabudowa tarasu") && (
                <ColorSection title="Kolor tarasu" options={TERRACE_COLORS} selected={terraceColor} onChange={setTerraceColor} />
              )}
              {selectedServices.includes("Konstrukcja aluminiowa") && (
                <ColorSection title="Kolor konstrukcji" options={CONSTRUCTION_COLORS} selected={constructionColor} onChange={setConstructionColor} />
              )}
              {selectedServices.includes("System przeciwsłoneczny") && (
                <ColorSection title="Typ systemu" options={SUN_TYPES} selected={sunProtectionType} onChange={setSunProtectionType} />
              )}
            </div>
          )}

          {/* Krok 3: Lokalizacja + komentarz */}
          {step === "location" && (
            <div className="space-y-5">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Lokalizacja inwestycji
                </p>
                <AddressSearch onSelect={handleAddressSelect} />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Kod pocztowy</label>
                    <input
                      type="text"
                      value={investment.postalCode}
                      onChange={(e) => setInvestment((prev) => ({ ...prev, postalCode: e.target.value }))}
                      placeholder="00-000"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Miejscowość</label>
                    <input
                      type="text"
                      value={investment.city}
                      onChange={(e) => setInvestment((prev) => ({ ...prev, city: e.target.value }))}
                      placeholder="np. Kraków"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Ulica</label>
                    <input
                      type="text"
                      value={investment.street}
                      onChange={(e) => setInvestment((prev) => ({ ...prev, street: e.target.value }))}
                      placeholder="np. ul. Lipowa"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Nr budynku</label>
                      <input
                        type="text"
                        value={investment.buildingNumber}
                        onChange={(e) => setInvestment((prev) => ({ ...prev, buildingNumber: e.target.value }))}
                        placeholder="12"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Nr mieszkania</label>
                      <input
                        type="text"
                        value={investment.apartmentNumber}
                        onChange={(e) => setInvestment((prev) => ({ ...prev, apartmentNumber: e.target.value }))}
                        placeholder="4"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
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
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-100 px-6 py-4">
          {error && step === "location" && (
            <p className="mb-3 text-xs font-medium text-red-600">{error}</p>
          )}
          <div className="flex items-center justify-between">
            {step !== "services" && step !== "client" ? (
              <button
                type="button"
                onClick={handleBack}
                disabled={submitting}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Wstecz
              </button>
            ) : step === "services" && !initialClientId ? (
              <button
                type="button"
                onClick={handleBack}
                disabled={submitting}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Wstecz
              </button>
            ) : (
              <div />
            )}

            {step !== "location" && step !== "client" ? (
              <button
                type="button"
                onClick={handleNext}
                className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
              >
                Dalej
              </button>
            ) : step === "client" ? (
              <div />
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting && (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                )}
                {submitting ? "Tworzenie..." : "Utwórz zlecenie"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
