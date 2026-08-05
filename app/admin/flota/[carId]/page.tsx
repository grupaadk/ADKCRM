"use client"

import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { Button } from "@/components/ui/Button"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import ModalPortal from "@/components/ModalPortal"

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
      alert("Wypełnij wymagane pola")
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
      alert("Zdarzenie dodane")
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
      alert(err.message || "Błąd dodawania zdarzenia")
    }
  }

  const handleDeleteEvent = async (eventId: Id<"carEvents">) => {
    if (confirm("Na pewno chcesz usunąć to zdarzenie?")) {
      try {
        await deleteEvent({ eventId })
        alert("Usunięto zdarzenie")
      } catch (err: any) {
        alert("Błąd usuwania")
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

  const inputClass = "w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
  const labelClass = "block text-sm font-medium text-slate-700 mb-1"

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-4">
        <Link href="/admin/flota">
          <Button variant="outline" className="p-2">
            <ArrowLeft className="h-4 w-4 inline" /> Wróć
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {car.make} {car.model}
          </h1>
          <p className="text-slate-500 flex items-center gap-2">
            <span className="font-mono bg-slate-100 px-1 py-0.5 rounded border">
              {car.registrationNumber}
            </span>
            {car.vin && <span>VIN: {car.vin}</span>}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Info Card */}
        <div className="border rounded-lg p-5 shadow-sm bg-white space-y-4">
          <h2 className="font-semibold text-lg border-b pb-2">Informacje o pojeździe</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Przypisana ekipa:</span>
              <span className="font-medium">{car.teamName || "Brak"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Rocznik:</span>
              <span>{car.year || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Całkowity koszt utrzymania:</span>
              <span className="font-bold text-red-600">{totalCost.toFixed(2)} zł</span>
            </div>
          </div>
        </div>

        {/* Events list */}
        <div className="md:col-span-2 border rounded-lg shadow-sm bg-white overflow-hidden flex flex-col">
          <div className="p-4 border-b flex justify-between items-center bg-slate-50">
            <h2 className="font-semibold text-lg">Historia zdarzeń</h2>
            <Button onClick={() => setIsAddEventOpen(true)}>
              <Plus className="h-4 w-4 mr-2 inline" />
              Dodaj
            </Button>
          </div>

          <div className="p-0 flex-1 overflow-auto">
            {events.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                Brak zarejestrowanych zdarzeń.
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 sticky top-0">
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
                    <tr key={event._id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {new Date(event.date).toLocaleDateString("pl-PL")}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          event.type === 'repair' ? 'bg-red-100 text-red-800' :
                          event.type === 'inspection' ? 'bg-blue-100 text-blue-800' :
                          event.type === 'refueling' ? 'bg-green-100 text-green-800' :
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {typeLabels[event.type]}
                        </span>
                        {event.linkedCalendarEventId && (
                          <span className="ml-2 text-xs text-slate-400" title="Wpisano do kalendarza">📅</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {event.cost.toFixed(2)} zł
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500">
                        {event.mileage ? `${event.mileage.toLocaleString()} km` : "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-500 truncate max-w-[200px]" title={event.description}>
                        {event.description || "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button 
                          className="h-8 w-8 text-slate-400 hover:text-red-600 rounded flex items-center justify-center hover:bg-slate-100 transition-colors"
                          onClick={() => handleDeleteEvent(event._id)}
                        >
                          <Trash2 className="h-4 w-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {isAddEventOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6 overflow-y-auto max-h-[90vh]">
              <h2 className="text-xl font-bold mb-4">Dodaj zdarzenie</h2>
              <form onSubmit={handleAddEvent} className="space-y-4">
                <div>
                  <label className={labelClass}>Typ zdarzenia *</label>
                  <select
                    className={inputClass}
                    value={eventData.type}
                    onChange={(e) => setEventData({ ...eventData, type: e.target.value })}
                  >
                    <option value="refueling">Tankowanie</option>
                    <option value="inspection">Przegląd</option>
                    <option value="repair">Naprawa</option>
                    <option value="other">Inne</option>
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Data *</label>
                    <input
                      type="date"
                      className={inputClass}
                      value={eventData.date}
                      onChange={(e) => setEventData({ ...eventData, date: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Koszt (PLN) *</label>
                    <input
                      type="number"
                      step="0.01"
                      className={inputClass}
                      value={eventData.cost}
                      onChange={(e) => setEventData({ ...eventData, cost: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Przebieg (opcjonalnie)</label>
                  <input
                    type="number"
                    className={inputClass}
                    value={eventData.mileage}
                    onChange={(e) => setEventData({ ...eventData, mileage: e.target.value })}
                    placeholder="Stan licznika w km"
                  />
                </div>

                <div>
                  <label className={labelClass}>Opis (opcjonalnie)</label>
                  <textarea
                    className={inputClass}
                    rows={3}
                    value={eventData.description}
                    onChange={(e) => setEventData({ ...eventData, description: e.target.value })}
                    placeholder="Szczegóły naprawy, typ paliwa, stacja itp."
                  />
                </div>

                {["inspection", "repair"].includes(eventData.type) && (
                  <div className="flex items-center space-x-2 pt-2">
                    <input
                      type="checkbox"
                      id="addToCalendar"
                      checked={eventData.addToCalendar}
                      onChange={(e) => 
                        setEventData({ ...eventData, addToCalendar: e.target.checked })
                      }
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label
                      htmlFor="addToCalendar"
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      Utwórz wpis "Administracja" w Kalendarzu
                    </label>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" type="button" onClick={() => setIsAddEventOpen(false)}>
                    Anuluj
                  </Button>
                  <Button type="submit">Zapisz</Button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  )
}
