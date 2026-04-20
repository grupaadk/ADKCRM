"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import ClientList from "./klienci/ClientList";
import AddressSearch, { type AddressData } from "@/components/AddressSearch";

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  postalCode: "",
  city: "",
  street: "",
  buildingNumber: "",
  apartmentNumber: "",
};

export default function KlienciPage() {
  const router = useRouter();
  const viewConfig = useQuery(api.viewConfig.getForUser, {});
  const createClient = useMutation(api.clients.create);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!form.firstName.trim()) newErrors.firstName = "Imię jest wymagane";
    if (!form.lastName.trim()) newErrors.lastName = "Nazwisko jest wymagane";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const clientId = await createClient({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        postalCode: form.postalCode.trim() || undefined,
        city: form.city.trim() || undefined,
        street: form.street.trim() || undefined,
        buildingNumber: form.buildingNumber.trim() || undefined,
        apartmentNumber: form.apartmentNumber.trim() || undefined,
      });
      setShowModal(false);
      setForm(EMPTY_FORM);
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

  function handleAddressSelect(address: AddressData) {
    setForm((prev) => ({
      ...prev,
      street: address.street ?? prev.street,
      buildingNumber: address.buildingNumber ?? prev.buildingNumber,
      city: address.city ?? prev.city,
      postalCode: address.postalCode ?? prev.postalCode,
    }));
  }

  function handleClose() {
    setShowModal(false);
    setForm(EMPTY_FORM);
    setErrors({});
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Klienci</h1>
          <p className="mt-1 text-sm text-gray-500">
            Lista wszystkich klientów w systemie.
          </p>
        </div>
        <a
          href="https://form.jotform.com/260517926002047"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Dodaj klienta
        </a>
      </div>

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
      />

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={handleClose}
          />
          <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                Nowy klient
              </h2>
              <button
                onClick={handleClose}
                className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              >
                Zamknij
              </button>
            </div>

            {errors._form && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {errors._form}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
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
                    className={`w-full rounded-md border px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 ${errors.firstName ? "border-red-400 focus:ring-red-400" : "border-slate-300"}`}
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
                    className={`w-full rounded-md border px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 ${errors.lastName ? "border-red-400 focus:ring-red-400" : "border-slate-300"}`}
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
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
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
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                    placeholder="123 456 789"
                  />
                </div>
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
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
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
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
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
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
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
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
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
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                    placeholder="np. 5 (opcjonalnie)"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
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
                  className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {submitting ? "Dodawanie..." : "Dodaj klienta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
