"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CrmPageHeader } from "@/components/crm-ui";
import { Car, Plus, ChevronRight, Users, X, Hash, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

export function FlotaView() {
  const cars = useQuery(api.cars.getCars);
  const teams = useQuery(api.installationTeams.listActive);
  const createCar = useMutation(api.cars.createCar);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    make: "",
    model: "",
    registrationNumber: "",
    vin: "",
    year: "",
    assignedInstallationTeamId: "none",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.make || !formData.model || !formData.registrationNumber) {
      toast.error("Wypełnij wymagane pola");
      return;
    }
    setSaving(true);
    try {
      await createCar({
        make: formData.make,
        model: formData.model,
        registrationNumber: formData.registrationNumber,
        vin: formData.vin || undefined,
        year: formData.year ? parseInt(formData.year) : undefined,
        assignedInstallationTeamId:
          formData.assignedInstallationTeamId !== "none"
            ? (formData.assignedInstallationTeamId as Id<"installationTeams">)
            : undefined,
      });
      toast.success("Samochód dodany do floty");
      setIsAddOpen(false);
      setFormData({
        make: "",
        model: "",
        registrationNumber: "",
        vin: "",
        year: "",
        assignedInstallationTeamId: "none",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Wystąpił błąd";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const totalCars = cars?.length ?? 0;
  const assignedCars = cars?.filter((c) => c.teamName).length ?? 0;
  const unassignedCars = totalCars - assignedCars;

  return (
    <div className="space-y-6">
      {/* Pasek Wyszukiwania i Akcji (Styl zgodny z HR / Ekipy) */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-gray-50 p-4 border border-gray-200">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Car className="size-5 text-brand" />
            Flota Pojazdów Firmowych ({totalCars})
          </h2>
          <p className="text-xs text-gray-500">
            Śledź samochody firmowe, ich przypisanie do ekip, numery rejestracyjne i przeglądy.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-brand/90"
          >
            <Plus className="size-4" />
            Dodaj pojazd
          </button>
        </div>
      </div>

      {/* Karty KPI Statystyk (Styl zgodny z HR / Ekipy) */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Wszystkie Pojazdy
            </span>
            <div className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-brand">
              <Car className="size-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">{totalCars}</span>
            <span className="text-sm font-medium text-gray-500">samochodów</span>
          </div>
          <p className="mt-2 text-xs text-blue-600 font-medium">Flota Grupa ADK</p>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Przypisane do Ekip
            </span>
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Users className="size-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">{assignedCars}</span>
            <span className="text-sm font-medium text-gray-500">pojazdów</span>
          </div>
          <p className="mt-2 text-xs text-emerald-600 font-medium">W stałym użytkowaniu ekip</p>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Wolne Pojazdy
            </span>
            <div className="flex size-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <CheckCircle2 className="size-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">{unassignedCars}</span>
            <span className="text-sm font-medium text-gray-500">samochodów</span>
          </div>
          <p className="mt-2 text-xs text-purple-600 font-medium">Rezerwowe / Ogólne</p>
        </div>
      </div>

      {/* Siatka Kart Pojazdów */}
      {cars === undefined ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
          Ładowanie pojazdów...
        </div>
      ) : cars.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
          <Car className="mx-auto size-12 text-gray-300 mb-3" />
          <h3 className="text-base font-bold text-gray-900">Brak pojazdów we flocie</h3>
          <p className="text-xs text-gray-500 mt-1">Dodaj pierwszy pojazd klikając przycisk powyżej.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {cars.map((car) => (
            <Link key={car._id} href={`/admin/flota/${car._id}`} className="block group">
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md hover:border-brand">
                {/* Nagłówek Karty */}
                <div className="border-b border-gray-100 p-5 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 group-hover:text-brand transition flex items-center gap-2">
                      <Car className="size-4 text-brand" />
                      {car.make} {car.model}
                    </h3>
                    {car.year && (
                      <span className="text-xs text-gray-400 font-medium mt-0.5 block">
                        Rocznik: {car.year}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="size-5 text-gray-400 group-hover:text-brand group-hover:translate-x-0.5 transition" />
                </div>

                {/* Szegóły Pojazdu */}
                <div className="p-5 space-y-3 text-xs text-gray-600">
                  <div className="rounded-lg bg-gray-50 p-3 border border-gray-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 font-medium flex items-center gap-1.5">
                        <Hash className="size-3.5 text-gray-400" />
                        Nr rejestracyjny:
                      </span>
                      <span className="font-mono font-bold text-sm text-gray-900 tracking-wider">
                        {car.registrationNumber}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-200/60 pt-2">
                      <span className="text-gray-500 font-medium flex items-center gap-1.5">
                        <Users className="size-3.5 text-gray-400" />
                        Przypisana ekipa:
                      </span>
                      {car.teamName ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                          {car.teamName}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                          Brak
                        </span>
                      )}
                    </div>
                  </div>

                  {car.vin && (
                    <div className="text-[11px] text-gray-400 font-mono truncate">
                      VIN: {car.vin}
                    </div>
                  )}
                </div>

                {/* Stopka Karty */}
                <div className="bg-gray-50/50 border-t border-gray-100 px-5 py-3 flex items-center justify-between text-xs text-brand font-semibold">
                  <span className="text-[11px] text-gray-400 font-normal">Koszty & Przeglądy</span>
                  <span className="flex items-center gap-1">
                    Karta pojazdu <ChevronRight className="size-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Modal Dodawania Pojazdu */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h2 className="text-lg font-bold text-gray-900">Nowy pojazd we flocie</h2>
              <button
                onClick={() => setIsAddOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Marka *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.make}
                    onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                    placeholder="np. Ford"
                    className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-brand focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Model *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="np. Transit"
                    className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Numer rejestracyjny *
                </label>
                <input
                  type="text"
                  required
                  value={formData.registrationNumber}
                  onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                  placeholder="np. WZY 1234"
                  className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm font-mono tracking-wider text-gray-900 focus:border-brand focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Rocznik
                  </label>
                  <input
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    placeholder="np. 2022"
                    className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-brand focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Numer VIN
                  </label>
                  <input
                    type="text"
                    value={formData.vin}
                    onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
                    placeholder="17 znaków"
                    className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-brand focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Przypisz do ekipy montażowej
                </label>
                <select
                  value={formData.assignedInstallationTeamId}
                  onChange={(e) => setFormData({ ...formData, assignedInstallationTeamId: e.target.value })}
                  className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-brand focus:outline-none"
                >
                  <option value="none">Brak (pojazd bez przypisania)</option>
                  {teams?.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-50"
                >
                  {saving ? "Dodawanie..." : "Dodaj pojazd"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FlotaPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <CrmPageHeader
        title="Flota Pojazdów"
        sub="Śledź samochody firmowe, ich przypisanie do ekip, historię przeglądów, napraw i kosztów."
        backHref="/admin/hr?tab=flota"
        backLabel="Powrót do Centrum HR"
      />
      <FlotaView />
    </div>
  );
}
