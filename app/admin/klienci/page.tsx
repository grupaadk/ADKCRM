"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Plus, Search, Loader2, X } from "lucide-react";
import ClientList from "./ClientList";
import AddressSearch, { type AddressData } from "@/components/AddressSearch";
import { CrmPageHeader } from "@/components/crm-ui";
import ModalPortal from "@/components/ModalPortal";

type ClientType = "individual" | "business";

const EMPTY_FORM = {
  clientType: "individual" as ClientType,
  // Individual / contact person
  firstName: "",
  lastName: "",
  // Shared
  email: "",
  phone: "",
  // Address
  nip: "",
  postalCode: "",
  city: "",
  street: "",
  buildingNumber: "",
  apartmentNumber: "",
  // Business-specific
  companyName: "",
};

export default function KlienciPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromTab = searchParams.get("fromTab");
  const backHref = fromTab ? `/admin/panel?tab=${fromTab}` : "/admin/panel";

  const viewConfig = useQuery(api.viewConfig.getForUser, {});
  const createClient = useMutation(api.clients.create);
  const lookupNip = useAction(api.whitelist.lookupNip);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [nipLoading, setNipLoading] = useState(false);
  const [nipFetched, setNipFetched] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (form.clientType === "individual") {
      if (!form.firstName.trim()) newErrors.firstName = "Imię jest wymagane";
      if (!form.lastName.trim()) newErrors.lastName = "Nazwisko jest wymagane";
    } else {
      if (!form.companyName.trim()) newErrors.companyName = "Nazwa firmy jest wymagana";
      if (!form.firstName.trim()) newErrors.firstName = "Imię osoby kontaktowej jest wymagane";
      if (!form.lastName.trim()) newErrors.lastName = "Nazwisko osoby kontaktowej jest wymagane";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const clientId = await createClient({
        clientType: form.clientType,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        nip: form.nip.trim() || undefined,
        companyName: form.clientType === "business" ? form.companyName.trim() || undefined : undefined,
        postalCode: form.postalCode.trim() || undefined,
        city: form.city.trim() || undefined,
        street: form.street.trim() || undefined,
        buildingNumber: form.buildingNumber.trim() || undefined,
        apartmentNumber: form.apartmentNumber.trim() || undefined,
      });
      setShowModal(false);
      setForm(EMPTY_FORM);
      setNipFetched(false);
      router.push(`/admin/klient/${clientId}`);
    } catch {
      setErrors({ _form: "Wystąpił błąd podczas dodawania klienta." });
    } finally {
      setSubmitting(false);
    }
  }

  function handleChange(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function handleTypeChange(type: ClientType) {
    setForm({ ...EMPTY_FORM, clientType: type });
    setErrors({});
    setNipFetched(false);
  }

  function handleAddressSelect(address: AddressData) {
    setForm((prev) => ({
      ...prev,
      street: address.street ?? prev.street,
      buildingNumber: address.buildingNumber ?? prev.buildingNumber,
      city: address.city ?? prev.city,
      postalCode: address.postalCode ?? prev.postalCode,
    }));
  }

  async function handleNipLookup() {
    const nip = form.nip.trim();
    if (!nip) {
      setErrors((prev) => ({ ...prev, nip: "Podaj NIP" }));
      return;
    }
    setNipLoading(true);
    setErrors((prev) => { const n = { ...prev }; delete n.nip; return n; });
    try {
      const data = await lookupNip({ nip });
      setForm((prev) => ({
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
      setErrors((prev) => ({
        ...prev,
        nip: err instanceof Error ? err.message : "Błąd pobierania danych",
      }));
    } finally {
      setNipLoading(false);
    }
  }

  function handleClose() {
    setShowModal(false);
    setForm(EMPTY_FORM);
    setErrors({});
    setNipFetched(false);
  }

  const inputClass = (field: string) =>
    `w-full rounded-md border px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 ${errors[field] ? "border-red-400 focus:ring-red-400" : "border-slate-300"}`;

  return (
    <div>
      <CrmPageHeader
        title="Klienci"
        sub="Lista wszystkich klientów w systemie."
        backHref={backHref}
        backLabel="Powrót do Panelu zleceń"
        center={
          <div style={{ position: "relative", width: "100%", maxWidth: 420 }}>
            <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--text-mute)" }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj po nazwie, firmie, mieście…"
              style={{
                width: "100%",
                padding: "8px 30px 8px 34px",
                borderRadius: 999,
                border: "1px solid var(--line)",
                background: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                fontSize: 13,
                fontWeight: 500,
                fontFamily: "inherit",
                color: "var(--text-strong)",
                outline: "none",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--accent)";
                e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-soft)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--line)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  background: "var(--panel-3)", border: "none", borderRadius: "50%",
                  cursor: "pointer", color: "var(--text-mute)", width: 20, height: 20,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <X style={{ width: 12, height: 12 }} />
              </button>
            )}
          </div>
        }
        actions={
          <button onClick={() => setShowModal(true)} className="btn primary">
            <Plus size={13} /> Dodaj klienta
          </button>
        }
      />

      <ClientList
        viewConfig={
          viewConfig
            ? {
                viewType: viewConfig.viewType,
                columns: viewConfig.columns,
                sortBy: viewConfig.sortBy,
                filters: viewConfig.filters,
                groupBy: viewConfig.groupBy,
              }
            : undefined
        }
        searchQuery={searchQuery}
      />

      {showModal && (
        <ModalPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={handleClose}
          />
          <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 z-10 bg-white px-6 pt-6 pb-4 border-b border-slate-100">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">Nowy klient</h2>
                <button
                  onClick={handleClose}
                  className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                >
                  Zamknij
                </button>
              </div>

              {/* Type toggle */}
              <div className="mt-4 flex gap-2">
                {(["individual", "business"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleTypeChange(type)}
                    className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                      form.clientType === type
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                    }`}
                  >
                    {type === "individual" ? "Klient Indywidualny" : "Klient Biznesowy"}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-6 py-5">
              {errors._form && (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {errors._form}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">

                {/* ── BUSINESS FORM ── */}
                {form.clientType === "business" && (
                  <>
                    {/* NIP lookup */}
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        NIP <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={form.nip}
                          onChange={(e) => handleChange("nip", e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleNipLookup())}
                          className={`flex-1 rounded-md border px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 ${errors.nip ? "border-red-400 focus:ring-red-400" : "border-slate-300"}`}
                          placeholder="np. 1234567890"
                        />
                        <button
                          type="button"
                          onClick={handleNipLookup}
                          disabled={nipLoading}
                          className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50 disabled:opacity-60 transition-colors whitespace-nowrap"
                        >
                          {nipLoading ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Search size={14} />
                          )}
                          {nipLoading ? "Pobieranie…" : "Pobierz dane"}
                        </button>
                      </div>
                      {errors.nip && <p className="mt-1 text-xs text-red-600">{errors.nip}</p>}
                    </div>

                    {/* Company name */}
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Nazwa firmy <span className="text-red-500">*</span>
                        {nipFetched && <span className="ml-2 text-xs font-normal text-emerald-600">— pobrano z GUS</span>}
                      </label>
                      <input
                        type="text"
                        value={form.companyName}
                        onChange={(e) => handleChange("companyName", e.target.value)}
                        className={inputClass("companyName")}
                        placeholder="Nazwa firmy"
                      />
                      {errors.companyName && <p className="mt-1 text-xs text-red-600">{errors.companyName}</p>}
                    </div>

                    {/* Address */}
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Adres firmy
                      </p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className="mb-1 block text-xs text-slate-500">Ulica</label>
                          <input
                            type="text"
                            value={form.street}
                            onChange={(e) => handleChange("street", e.target.value)}
                            className={inputClass("street")}
                            placeholder="Ulica"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-500">Numer budynku</label>
                          <input
                            type="text"
                            value={form.buildingNumber}
                            onChange={(e) => handleChange("buildingNumber", e.target.value)}
                            className={inputClass("buildingNumber")}
                            placeholder="Nr budynku"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-500">Nr lokalu</label>
                          <input
                            type="text"
                            value={form.apartmentNumber}
                            onChange={(e) => handleChange("apartmentNumber", e.target.value)}
                            className={inputClass("apartmentNumber")}
                            placeholder="Nr lokalu (opcjonalnie)"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-500">Kod pocztowy</label>
                          <input
                            type="text"
                            value={form.postalCode}
                            onChange={(e) => handleChange("postalCode", e.target.value)}
                            className={inputClass("postalCode")}
                            placeholder="00-000"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-500">Miejscowość</label>
                          <input
                            type="text"
                            value={form.city}
                            onChange={(e) => handleChange("city", e.target.value)}
                            className={inputClass("city")}
                            placeholder="Miejscowość"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Contact */}
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                          Telefon
                        </label>
                        <input
                          type="tel"
                          value={form.phone}
                          onChange={(e) => handleChange("phone", e.target.value)}
                          className={inputClass("phone")}
                          placeholder="123 456 789"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                          Email
                        </label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => handleChange("email", e.target.value)}
                          className={inputClass("email")}
                          placeholder="firma@example.com"
                        />
                      </div>
                    </div>

                    {/* Contact person */}
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Osoba kontaktowa / decyzyjna
                      </p>
                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">
                            Imię <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={form.firstName}
                            onChange={(e) => handleChange("firstName", e.target.value)}
                            className={inputClass("firstName")}
                            placeholder="np. Anna"
                          />
                          {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>}
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">
                            Nazwisko <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={form.lastName}
                            onChange={(e) => handleChange("lastName", e.target.value)}
                            className={inputClass("lastName")}
                            placeholder="np. Kowalska"
                          />
                          {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* ── INDIVIDUAL FORM ── */}
                {form.clientType === "individual" && (
                  <>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <div>
                        <label htmlFor="firstName" className="mb-1 block text-sm font-medium text-slate-700">
                          Imię <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="firstName"
                          type="text"
                          value={form.firstName}
                          onChange={(e) => handleChange("firstName", e.target.value)}
                          className={inputClass("firstName")}
                          placeholder="np. Jan"
                        />
                        {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>}
                      </div>
                      <div>
                        <label htmlFor="lastName" className="mb-1 block text-sm font-medium text-slate-700">
                          Nazwisko <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="lastName"
                          type="text"
                          value={form.lastName}
                          onChange={(e) => handleChange("lastName", e.target.value)}
                          className={inputClass("lastName")}
                          placeholder="np. Kowalski"
                        />
                        {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <div>
                        <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                        <input
                          id="email"
                          type="email"
                          value={form.email}
                          onChange={(e) => handleChange("email", e.target.value)}
                          className={inputClass("email")}
                          placeholder="jan@example.com"
                        />
                      </div>
                      <div>
                        <label htmlFor="phone" className="mb-1 block text-sm font-medium text-slate-700">Telefon</label>
                        <input
                          id="phone"
                          type="tel"
                          value={form.phone}
                          onChange={(e) => handleChange("phone", e.target.value)}
                          className={inputClass("phone")}
                          placeholder="123 456 789"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="nip" className="mb-1 block text-sm font-medium text-slate-700">NIP</label>
                      <input
                        id="nip"
                        type="text"
                        value={form.nip}
                        onChange={(e) => handleChange("nip", e.target.value)}
                        className={inputClass("nip")}
                        placeholder="np. 1234567890 (opcjonalnie)"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Wyszukaj adres
                      </label>
                      <AddressSearch onSelect={handleAddressSelect} />
                      <p className="mt-1 text-xs text-slate-400">
                        Wybierz adres z podpowiedzi, aby wypełnić pola poniżej.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <div>
                        <label htmlFor="postalCode" className="mb-1 block text-sm font-medium text-slate-700">Kod pocztowy</label>
                        <input
                          id="postalCode"
                          type="text"
                          value={form.postalCode}
                          onChange={(e) => handleChange("postalCode", e.target.value)}
                          className={inputClass("postalCode")}
                          placeholder="00-000"
                        />
                      </div>
                      <div>
                        <label htmlFor="city" className="mb-1 block text-sm font-medium text-slate-700">Miejscowość</label>
                        <input
                          id="city"
                          type="text"
                          value={form.city}
                          onChange={(e) => handleChange("city", e.target.value)}
                          className={inputClass("city")}
                          placeholder="np. Warszawa"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="street" className="mb-1 block text-sm font-medium text-slate-700">Ulica</label>
                      <input
                        id="street"
                        type="text"
                        value={form.street}
                        onChange={(e) => handleChange("street", e.target.value)}
                        className={inputClass("street")}
                        placeholder="np. Przykładowa"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <div>
                        <label htmlFor="buildingNumber" className="mb-1 block text-sm font-medium text-slate-700">Numer budynku</label>
                        <input
                          id="buildingNumber"
                          type="text"
                          value={form.buildingNumber}
                          onChange={(e) => handleChange("buildingNumber", e.target.value)}
                          className={inputClass("buildingNumber")}
                          placeholder="np. 12"
                        />
                      </div>
                      <div>
                        <label htmlFor="apartmentNumber" className="mb-1 block text-sm font-medium text-slate-700">Numer mieszkania</label>
                        <input
                          id="apartmentNumber"
                          type="text"
                          value={form.apartmentNumber}
                          onChange={(e) => handleChange("apartmentNumber", e.target.value)}
                          className={inputClass("apartmentNumber")}
                          placeholder="np. 5 (opcjonalnie)"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50 transition-colors"
                  >
                    {submitting ? "Dodawanie..." : "Dodaj klienta"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}
