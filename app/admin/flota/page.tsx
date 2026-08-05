"use client"

import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Button } from "@/components/ui/Button"
import { Plus, Car, FileText } from "lucide-react"
import Link from "next/link"
import ModalPortal from "@/components/ModalPortal"

export default function FlotaPage() {
  const cars = useQuery(api.cars.getCars)
  const teams = useQuery(api.installationTeams.getTeamsForSelect)
  const createCar = useMutation(api.cars.createCar)

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [formData, setFormData] = useState({
    make: "",
    model: "",
    registrationNumber: "",
    vin: "",
    year: "",
    assignedInstallationTeamId: "none",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.make || !formData.model || !formData.registrationNumber) {
      alert("Wypełnij wymagane pola")
      return
    }

    try {
      await createCar({
        make: formData.make,
        model: formData.model,
        registrationNumber: formData.registrationNumber,
        vin: formData.vin || undefined,
        year: formData.year ? parseInt(formData.year) : undefined,
        assignedInstallationTeamId:
          formData.assignedInstallationTeamId !== "none"
            ? (formData.assignedInstallationTeamId as any)
            : undefined,
      })
      alert("Samochód dodany")
      setIsAddOpen(false)
      setFormData({
        make: "",
        model: "",
        registrationNumber: "",
        vin: "",
        year: "",
        assignedInstallationTeamId: "none",
      })
    } catch (err: any) {
      alert(err.message || "Wystąpił błąd")
    }
  }

  const inputClass = "w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
  const labelClass = "block text-sm font-medium text-slate-700 mb-1"

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Car className="h-8 w-8 text-blue-600" />
            Zarządzanie flotą
          </h1>
          <p className="text-muted-foreground mt-1">
            Zarządzaj samochodami, ich przypisaniem do ekip oraz historią zdarzeń i kosztów.
          </p>
        </div>

        <Button onClick={() => setIsAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2 inline" />
          Dodaj samochód
        </Button>
      </div>

      {isAddOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 overflow-y-auto max-h-[90vh]">
              <h2 className="text-xl font-bold mb-4">Nowy samochód we flocie</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={labelClass}>Marka *</label>
                  <input
                    type="text"
                    className={inputClass}
                    value={formData.make}
                    onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                    placeholder="np. Ford"
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Model *</label>
                  <input
                    type="text"
                    className={inputClass}
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="np. Transit"
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Numer rejestracyjny *</label>
                  <input
                    type="text"
                    className={inputClass}
                    value={formData.registrationNumber}
                    onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                    placeholder="np. WZY 1234"
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Numer VIN (opcjonalnie)</label>
                  <input
                    type="text"
                    className={inputClass}
                    value={formData.vin}
                    onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass}>Rocznik (opcjonalnie)</label>
                  <input
                    type="number"
                    className={inputClass}
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass}>Przypisz do ekipy (opcjonalnie)</label>
                  <select
                    className={inputClass}
                    value={formData.assignedInstallationTeamId}
                    onChange={(e) => setFormData({ ...formData, assignedInstallationTeamId: e.target.value })}
                  >
                    <option value="none">Brak (w bazie)</option>
                    {teams?.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" type="button" onClick={() => setIsAddOpen(false)}>
                    Anuluj
                  </Button>
                  <Button type="submit">Dodaj</Button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cars === undefined ? (
          <div>Ładowanie...</div>
        ) : cars.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground border border-dashed rounded-lg">
            Brak samochodów we flocie.
          </div>
        ) : (
          cars.map((car) => (
            <div key={car._id} className="border rounded-lg p-5 shadow-sm bg-white flex flex-col justify-between">
              <div>
                <h3 className="font-semibold text-lg">{car.make} {car.model}</h3>
                <div className="inline-block mt-2 px-2 py-1 bg-slate-100 rounded text-sm font-mono border">
                  {car.registrationNumber}
                </div>
                
                <div className="mt-4 text-sm space-y-1 text-slate-500">
                  <div className="flex justify-between">
                    <span>Ekipa:</span>
                    <span className="font-medium text-slate-900">{car.teamName || "Brak"}</span>
                  </div>
                  {car.year && (
                    <div className="flex justify-between">
                      <span>Rocznik:</span>
                      <span>{car.year}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t flex justify-end">
                <Link href={`/admin/flota/${car._id}`}>
                  <Button variant="outline" className="w-full">
                    <FileText className="h-4 w-4 mr-2 inline" />
                    Szczegóły i Koszty
                  </Button>
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
