"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import AddressSearch, { type AddressData } from "@/components/AddressSearch";

export default function NowyKlientPage() {
  const router = useRouter();
  const createClient = useMutation(api.clients.create);

  const [form, setForm] = useState({
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
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!form.firstName.trim()) {
      newErrors.firstName = "Imię jest wymagane";
    }
    if (!form.lastName.trim()) {
      newErrors.lastName = "Nazwisko jest wymagane";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      await createClient({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        nip: form.nip.trim() || undefined,
        postalCode: form.postalCode.trim() || undefined,
        city: form.city.trim() || undefined,
        street: form.street.trim() || undefined,
        buildingNumber: form.buildingNumber.trim() || undefined,
        apartmentNumber: form.apartmentNumber.trim() || undefined,
      });
      router.push("/admin");
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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Nowy klient</h1>
        <p className="text-slate-500 mt-1">
          Dodaj nowego klienta do systemu.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 max-w-2xl">
        {errors._form && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {errors._form}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Imię */}
            <div>
              <label
                htmlFor="firstName"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Imię <span className="text-red-500">*</span>
              </label>
              <input
                id="firstName"
                type="text"
                value={form.firstName}
                onChange={(e) => handleChange("firstName", e.target.value)}
                className={`w-full rounded-md border px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 ${
                  errors.firstName
                    ? "border-red-400 focus:ring-red-400"
                    : "border-slate-300"
                }`}
                placeholder="np. Jan"
              />
              {errors.firstName && (
                <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>
              )}
            </div>

            {/* Nazwisko */}
            <div>
              <label
                htmlFor="lastName"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Nazwisko <span className="text-red-500">*</span>
              </label>
              <input
                id="lastName"
                type="text"
                value={form.lastName}
                onChange={(e) => handleChange("lastName", e.target.value)}
                className={`w-full rounded-md border px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 ${
                  errors.lastName
                    ? "border-red-400 focus:ring-red-400"
                    : "border-slate-300"
                }`}
                placeholder="np. Kowalski"
              />
              {errors.lastName && (
                <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="jan@example.com"
              />
            </div>

            {/* Telefon */}
            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Telefon
              </label>
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

          {/* NIP */}
          <div>
            <label
              htmlFor="nip"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              NIP
            </label>
            <input
              id="nip"
              type="text"
              value={form.nip}
              onChange={(e) => handleChange("nip", e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="np. 1234567890"
            />
          </div>

          {/* Adres — autouzupełnianie */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Wyszukaj adres
            </label>
            <AddressSearch onSelect={handleAddressSelect} />
            <p className="mt-1 text-xs text-slate-400">
              Wybierz adres z podpowiedzi, aby wypełnić pola poniżej.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Kod pocztowy */}
            <div>
              <label
                htmlFor="postalCode"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Kod pocztowy
              </label>
              <input
                id="postalCode"
                type="text"
                value={form.postalCode}
                onChange={(e) => handleChange("postalCode", e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="00-000"
              />
            </div>

            {/* Miejscowość */}
            <div>
              <label
                htmlFor="city"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Miejscowość
              </label>
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

          {/* Ulica */}
          <div>
            <label
              htmlFor="street"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Ulica
            </label>
            <input
              id="street"
              type="text"
              value={form.street}
              onChange={(e) => handleChange("street", e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="np. Przykładowa"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Numer budynku */}
            <div>
              <label
                htmlFor="buildingNumber"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Numer budynku
              </label>
              <input
                id="buildingNumber"
                type="text"
                value={form.buildingNumber}
                onChange={(e) => handleChange("buildingNumber", e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="np. 12"
              />
            </div>

            {/* Numer mieszkania */}
            <div>
              <label
                htmlFor="apartmentNumber"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Numer mieszkania
              </label>
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

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="bg-slate-900 text-white px-5 py-2.5 rounded-md text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Dodawanie..." : "Dodaj klienta"}
            </button>
            <Link
              href="/admin"
              className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Anuluj
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
