"use client"

import { useState, use } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { CrmPageHeader } from "@/components/crm-ui"
import {
  Car,
  ArrowLeft,
  Plus,
  Trash2,
  Calendar,
  Wrench,
  Fuel,
  AlertTriangle,
  FileText,
  X,
  Hash,
  Users,
  DollarSign
} from "lucide-react"
import Link from "next/link"
import toast from "react-hot-toast"

export default function CarDetailsPage({ params }: { params: Promise<{ carId: Id<"cars"> }> }) {
  const resolvedParams = use(params)
  
  const car = useQuery(api.cars.getCarById, { carId: resolvedParams.carId })
  const events = useQuery(api.cars.getCarEvents, { carId: resolvedParams.carId })
  const createEvent = useMutation(api.cars.createCarEvent)
  const deleteEvent = useMutation(api.cars.deleteCarEvent)

  const [isAddEventOpen, setIsAddEventOpen] = useState(false)
  const [saving, setSaving] = useState(false)
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

    setSaving(true)
    try {
      await createEvent({
        carId: resolvedParams.carId,
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
    } finally {
      setSaving(false)
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
    return (
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: "48px 24px", textAlign: "center", color: "var(--text-mute)" }}>
        Ładowanie...
      </div>
    )
  }

  if (car === null) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <CrmPageHeader
          title="Nie znaleziono pojazdu"
          sub="Ten samochód nie istnieje lub został usunięty z bazy danych."
          actions={
            <Link href="/admin/flota" style={{ textDecoration: "none" }}>
              <button className="btn" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text-strong)", cursor: "pointer" }}>
                <ArrowLeft style={{ width: 15, height: 15 }} />
                Wróć do listy
              </button>
            </Link>
          }
        />
      </div>
    )
  }

  const totalCost = events.reduce((sum, e) => sum + e.cost, 0)
  
  const typeLabels: Record<string, { label: string; bg: string; color: string; border: string }> = {
    refueling: { label: "Tankowanie", bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" },
    inspection: { label: "Przegląd", bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
    repair: { label: "Naprawa", bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" },
    other: { label: "Inne", bg: "var(--panel-2)", color: "var(--text-mute)", border: "var(--line)" },
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Page Header */}
      <CrmPageHeader
        title={`${car.make} ${car.model}`}
        sub={`Pojazd ${car.registrationNumber} ${car.vin ? `• VIN: ${car.vin}` : ""}`}
        actions={
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/admin/flota" style={{ textDecoration: "none" }}>
              <button
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 8,
                  border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text-strong)", cursor: "pointer",
                }}
              >
                <ArrowLeft style={{ width: 15, height: 15 }} />
                Wróć
              </button>
            </Link>
            <button
              onClick={() => setIsAddEventOpen(true)}
              className="btn primary"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 8, cursor: "pointer",
              }}
            >
              <Plus style={{ width: 15, height: 15 }} />
              Dodaj zdarzenie
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <div style={{
          background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: "16px 20px",
          display: "flex", alignItems: "center", gap: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10, background: "#ecfdf5", color: "#10b981",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Users style={{ width: 22, height: 22 }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-strong)", lineHeight: 1.2 }}>
              {car.teamName || "Nie przypisano"}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 4 }}>
              Przypisana ekipa
            </div>
          </div>
        </div>

        <div style={{
          background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: "16px 20px",
          display: "flex", alignItems: "center", gap: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10, background: "#eff6ff", color: "#3b82f6",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Calendar style={{ width: 22, height: 22 }} />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-strong)", lineHeight: 1.1 }}>
              {events.length}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 4 }}>
              Zarejestrowane zdarzenia
            </div>
          </div>
        </div>

        <div style={{
          background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: "16px 20px",
          display: "flex", alignItems: "center", gap: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10, background: "#fef2f2", color: "#ef4444",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <DollarSign style={{ width: 22, height: 22 }} />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#b91c1c", lineHeight: 1.1 }}>
              {totalCost.toFixed(2)} zł
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 4 }}>
              Suma kosztów
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
        {/* Events Table */}
        <div style={{
          background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden",
          boxShadow: "0 1px 4px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column",
        }}>
          <div style={{
            padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex",
            alignItems: "center", justifyContent: "space-between", background: "var(--panel)",
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
              Historia wpisów i zdarzeń
            </h3>
          </div>

          {events.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-mute)" }}>
              <FileText style={{ width: 40, height: 40, margin: "0 auto 12px", opacity: 0.4 }} />
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>Brak zdarzeń</p>
              <p style={{ fontSize: 12.5, color: "var(--text-mute)", marginTop: 4 }}>Brak dodanych serwisów, tankowań lub napraw dla tego samochodu.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--panel-2)", borderBottom: "1px solid var(--line)" }}>
                    <th style={{ padding: "10px 16px", fontWeight: 600, color: "var(--text-mute)", fontSize: 12 }}>Data</th>
                    <th style={{ padding: "10px 16px", fontWeight: 600, color: "var(--text-mute)", fontSize: 12 }}>Typ zdarzenia</th>
                    <th style={{ padding: "10px 16px", fontWeight: 600, color: "var(--text-mute)", fontSize: 12, textAlign: "right" }}>Koszt (PLN)</th>
                    <th style={{ padding: "10px 16px", fontWeight: 600, color: "var(--text-mute)", fontSize: 12, textAlign: "right" }}>Przebieg</th>
                    <th style={{ padding: "10px 16px", fontWeight: 600, color: "var(--text-mute)", fontSize: 12 }}>Opis</th>
                    <th style={{ padding: "10px 16px", fontWeight: 600, color: "var(--text-mute)", fontSize: 12, width: 50 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => {
                    const badge = typeLabels[event.type] || typeLabels.other
                    return (
                      <tr key={event._id} style={{ borderBottom: "1px solid var(--line)" }}>
                        <td style={{ padding: "12px 16px", whiteSpace: "nowrap", fontWeight: 500, color: "var(--text-strong)" }}>
                          {new Date(event.date).toLocaleDateString("pl-PL")}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                            background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
                            textTransform: "uppercase", letterSpacing: "0.04em", display: "inline-flex", alignItems: "center", gap: 4
                          }}>
                            {badge.label}
                          </span>
                          {event.linkedCalendarEventId && (
                            <span style={{ marginLeft: 6, fontSize: 12 }} title="Wpisano do kalendarza w kategorii Administracja">📅</span>
                          )}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: "var(--text-strong)" }}>
                          {event.cost.toFixed(2)} zł
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", color: "var(--text-mute)" }}>
                          {event.mileage ? `${event.mileage.toLocaleString()} km` : "-"}
                        </td>
                        <td style={{ padding: "12px 16px", color: "var(--text-mute)", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={event.description}>
                          {event.description || "-"}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right" }}>
                          <button
                            onClick={() => handleDeleteEvent(event._id)}
                            style={{
                              border: "none", background: "none", cursor: "pointer", color: "var(--text-mute)",
                              padding: 4, borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-mute)")}
                          >
                            <Trash2 style={{ width: 15, height: 15 }} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal dodawania zdarzenia */}
      {isAddEventOpen && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(2px)",
          zIndex: 99, display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div style={{
            background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: 24,
            width: "100%", maxWidth: 500, boxShadow: "0 12px 36px rgba(0,0,0,0.18)",
            display: "flex", flexDirection: "column", gap: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
                Dodaj nowe zdarzenie
              </h3>
              <button onClick={() => setIsAddEventOpen(false)} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-mute)", padding: 4 }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <form onSubmit={handleAddEvent} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>
                  Typ zdarzenia <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  value={eventData.type}
                  onChange={(e) => setEventData({ ...eventData, type: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", fontSize: 12.5, borderRadius: 8, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text-strong)", outline: "none", boxSizing: "border-box" }}
                >
                  <option value="refueling">Tankowanie</option>
                  <option value="inspection">Przegląd</option>
                  <option value="repair">Naprawa</option>
                  <option value="other">Inne</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>
                    Data <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={eventData.date}
                    onChange={(e) => setEventData({ ...eventData, date: e.target.value })}
                    required
                    style={{ width: "100%", padding: "8px 12px", fontSize: 12.5, borderRadius: 8, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text-strong)", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>
                    Koszt (PLN) <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={eventData.cost}
                    onChange={(e) => setEventData({ ...eventData, cost: e.target.value })}
                    placeholder="0.00"
                    required
                    style={{ width: "100%", padding: "8px 12px", fontSize: 12.5, borderRadius: 8, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text-strong)", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>
                  Przebieg (km)
                </label>
                <input
                  type="number"
                  value={eventData.mileage}
                  onChange={(e) => setEventData({ ...eventData, mileage: e.target.value })}
                  placeholder="np. 154000"
                  style={{ width: "100%", padding: "8px 12px", fontSize: 12.5, borderRadius: 8, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text-strong)", outline: "none", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>
                  Opis / uwagi
                </label>
                <textarea
                  rows={3}
                  value={eventData.description}
                  onChange={(e) => setEventData({ ...eventData, description: e.target.value })}
                  placeholder="Szczegóły naprawy, typ paliwa, stacja itp."
                  style={{ width: "100%", padding: "8px 12px", fontSize: 12.5, borderRadius: 8, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text-strong)", outline: "none", boxSizing: "border-box", resize: "vertical" }}
                />
              </div>

              {["inspection", "repair"].includes(eventData.type) && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 4 }}>
                  <input
                    type="checkbox"
                    id="addToCalendar"
                    checked={eventData.addToCalendar}
                    onChange={(e) => setEventData({ ...eventData, addToCalendar: e.target.checked })}
                    style={{ borderRadius: 4, cursor: "pointer" }}
                  />
                  <label htmlFor="addToCalendar" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-strong)", cursor: "pointer" }}>
                    Dodaj zdarzenie w Kalendarzu (kategoria "Administracja")
                  </label>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                <button
                  type="button"
                  onClick={() => setIsAddEventOpen(false)}
                  style={{ padding: "8px 16px", fontSize: 12.5, fontWeight: 600, borderRadius: 8, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text-strong)", cursor: "pointer" }}
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn primary"
                  style={{ padding: "8px 20px", fontSize: 12.5, fontWeight: 600, borderRadius: 8, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? "Zapisywanie..." : "Dodaj zdarzenie"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
