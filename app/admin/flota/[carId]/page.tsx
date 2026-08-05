"use client"

import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, Plus, Trash2, Edit } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { format } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"

export default function CarDetailsPage({ params }: { params: { carId: Id<"cars"> } }) {
  const car = useQuery(api.cars.getCarById, { carId: params.carId })
  const events = useQuery(api.cars.getCarEvents, { carId: params.carId })
  const createEvent = useMutation(api.cars.createCarEvent)
  const deleteEvent = useMutation(api.cars.deleteCarEvent)

  const [isAddEventOpen, setIsAddEventOpen] = useState(false)
  const [eventData, setEventData] = useState({
    type: "refueling",
    date: new Date().toISOString().split('T')[0],
    cost: "",
    mileage: "",
    description: "",
    addToCalendar: false,
  })

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!eventData.date || !eventData.cost) {
      toast.error("Wypełnij wymagane pola")
      return
    }

    try {
      await createEvent({
        carId: params.carId,
        type: eventData.type as any,
        date: new Date(eventData.date).getTime(),
        cost: parseFloat(eventData.cost),
        mileage: eventData.mileage ? parseFloat(eventData.mileage) : undefined,
        description: eventData.description || undefined,
        addToCalendar: eventData.addToCalendar,
      })
      toast.success("Zdarzenie dodane")
      setIsAddEventOpen(false)
      setEventData({
        type: "refueling",
        date: new Date().toISOString().split('T')[0],
        cost: "",
        mileage: "",
        description: "",
        addToCalendar: false,
      })
    } catch (err: any) {
      toast.error(err.message || "Błąd dodawania zdarzenia")
    }
  }

  const handleDeleteEvent = async (eventId: Id<"carEvents">) => {
    if (confirm("Na pewno chcesz usunąć to zdarzenie?")) {
      try {
        await deleteEvent({ eventId })
        toast.success("Usunięto zdarzenie")
      } catch (err: any) {
        toast.error("Błąd usuwania")
      }
    }
  }

  if (car === undefined || events === undefined) {
    return <div className="p-6">Ładowanie...</div>
  }

  const totalCost = events.reduce((sum, e) => sum + e.cost, 0)
  
  const typeLabels: Record<string, string> = {
    refueling: "Tankowanie",
    inspection: "Przegląd",
    repair: "Naprawa",
    other: "Inne"
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-4">
        <Link href="/admin/flota">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {car.make} {car.model}
          </h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded border">
              {car.registrationNumber}
            </span>
            {car.vin && <span>VIN: {car.vin}</span>}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Info Card */}
        <div className="border rounded-lg p-5 shadow-sm bg-card space-y-4">
          <h2 className="font-semibold text-lg border-b pb-2">Informacje o pojeździe</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Przypisana ekipa:</span>
              <span className="font-medium">{car.teamName || "Brak"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rocznik:</span>
              <span>{car.year || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Całkowity koszt utrzymania:</span>
              <span className="font-bold text-red-600">{totalCost.toFixed(2)} zł</span>
            </div>
          </div>
        </div>

        {/* Events list */}
        <div className="md:col-span-2 border rounded-lg shadow-sm bg-card overflow-hidden flex flex-col">
          <div className="p-4 border-b flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
            <h2 className="font-semibold text-lg">Historia zdarzeń</h2>
            <Dialog open={isAddEventOpen} onOpenChange={setIsAddEventOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Dodaj
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Dodaj zdarzenie</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddEvent} className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Typ zdarzenia *</Label>
                    <Select
                      value={eventData.type}
                      onValueChange={(val) => setEventData({ ...eventData, type: val })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="refueling">Tankowanie</SelectItem>
                        <SelectItem value="inspection">Przegląd</SelectItem>
                        <SelectItem value="repair">Naprawa</SelectItem>
                        <SelectItem value="other">Inne</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Data *</Label>
                      <Input
                        type="date"
                        value={eventData.date}
                        onChange={(e) => setEventData({ ...eventData, date: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Koszt (PLN) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={eventData.cost}
                        onChange={(e) => setEventData({ ...eventData, cost: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Przebieg (opcjonalnie)</Label>
                    <Input
                      type="number"
                      value={eventData.mileage}
                      onChange={(e) => setEventData({ ...eventData, mileage: e.target.value })}
                      placeholder="Stan licznika w km"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Opis (opcjonalnie)</Label>
                    <Textarea
                      value={eventData.description}
                      onChange={(e) => setEventData({ ...eventData, description: e.target.value })}
                      placeholder="Szczegóły naprawy, typ paliwa, stacja itp."
                    />
                  </div>

                  {["inspection", "repair"].includes(eventData.type) && (
                    <div className="flex items-center space-x-2 pt-2">
                      <Checkbox
                        id="addToCalendar"
                        checked={eventData.addToCalendar}
                        onCheckedChange={(checked) => 
                          setEventData({ ...eventData, addToCalendar: checked === true })
                        }
                      />
                      <label
                        htmlFor="addToCalendar"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Utwórz wpis "Administracja" w Kalendarzu
                      </label>
                    </div>
                  )}

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsAddEventOpen(false)}>
                      Anuluj
                    </Button>
                    <Button type="submit">Zapisz</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="p-0 flex-1 overflow-auto">
            {events.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Brak zarejestrowanych zdarzeń.
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                  <tr>
                    <th className="px-4 py-3 font-medium">Data</th>
                    <th className="px-4 py-3 font-medium">Typ</th>
                    <th className="px-4 py-3 font-medium text-right">Koszt</th>
                    <th className="px-4 py-3 font-medium text-right">Przebieg</th>
                    <th className="px-4 py-3 font-medium">Opis</th>
                    <th className="px-4 py-3 font-medium w-[60px]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {events.map((event) => (
                    <tr key={event._id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {format(new Date(event.date), "dd.MM.yyyy")}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          event.type === 'repair' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                          event.type === 'inspection' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                          event.type === 'refueling' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                        }`}>
                          {typeLabels[event.type]}
                        </span>
                        {event.linkedCalendarEventId && (
                          <span className="ml-2 text-xs text-muted-foreground" title="Wpisano do kalendarza">📅</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {event.cost.toFixed(2)} zł
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {event.mileage ? `${event.mileage.toLocaleString()} km` : "-"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]" title={event.description}>
                        {event.description || "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-red-600"
                          onClick={() => handleDeleteEvent(event._id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
