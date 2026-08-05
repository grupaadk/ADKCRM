"use client"

import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Car, FileText } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"

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
      toast.error("Wypełnij wymagane pola")
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
      toast.success("Samochód dodany")
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
      toast.error(err.message || "Wystąpił błąd")
    }
  }

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

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Dodaj samochód
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nowy samochód we flocie</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Marka *</Label>
                <Input
                  value={formData.make}
                  onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                  placeholder="np. Ford"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Model *</Label>
                <Input
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="np. Transit"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Numer rejestracyjny *</Label>
                <Input
                  value={formData.registrationNumber}
                  onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                  placeholder="np. WZY 1234"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Numer VIN (opcjonalnie)</Label>
                <Input
                  value={formData.vin}
                  onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Rocznik (opcjonalnie)</Label>
                <Input
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Przypisz do ekipy (opcjonalnie)</Label>
                <Select
                  value={formData.assignedInstallationTeamId}
                  onValueChange={(val) => setFormData({ ...formData, assignedInstallationTeamId: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz ekipę" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Brak (w bazie)</SelectItem>
                    {teams?.map((t) => (
                      <SelectItem key={t._id} value={t._id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                  Anuluj
                </Button>
                <Button type="submit">Dodaj</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cars === undefined ? (
          <div>Ładowanie...</div>
        ) : cars.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground border border-dashed rounded-lg">
            Brak samochodów we flocie.
          </div>
        ) : (
          cars.map((car) => (
            <div key={car._id} className="border rounded-lg p-5 shadow-sm bg-card flex flex-col justify-between">
              <div>
                <h3 className="font-semibold text-lg">{car.make} {car.model}</h3>
                <div className="inline-block mt-2 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono border">
                  {car.registrationNumber}
                </div>
                
                <div className="mt-4 text-sm space-y-1 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Ekipa:</span>
                    <span className="font-medium text-foreground">{car.teamName || "Brak"}</span>
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
                  <Button variant="secondary" size="sm" className="w-full">
                    <FileText className="h-4 w-4 mr-2" />
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
