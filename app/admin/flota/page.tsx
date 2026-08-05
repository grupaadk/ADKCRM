"use client"

import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { CrmPageHeader } from "@/components/crm-ui"
import { Car, Plus, ChevronRight, Users, X, Hash, Calendar } from "lucide-react"
import Link from "next/link"
import toast from "react-hot-toast"

export default function FlotaPage() {
  const cars = useQuery(api.cars.getCars)
  const teams = useQuery(api.installationTeams.listActive)
  const createCar = useMutation(api.cars.createCar)

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)
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
    setSaving(true)
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
      setFormData({ make: "", model: "", registrationNumber: "", vin: "", year: "", assignedInstallationTeamId: "none" })
    } catch (err: any) {
      toast.error(err.message || "Wystąpił błąd")
    } finally {
      setSaving(false)
    }
  }

  const totalCars = cars?.length ?? 0
  const assignedCars = cars?.filter((c) => c.teamName).length ?? 0

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <CrmPageHeader
        title="Zarządzanie flotą"
        sub="Śledź pojazdy, ich przypisanie do ekip, historię przeglądów, napraw i kosztów."
        actions={
          <button
            onClick={() => setIsAddOpen(true)}
            className="btn primary"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 8, cursor: "pointer",
            }}
          >
            <Plus style={{ width: 15, height: 15 }} />
            Dodaj pojazd
          </button>
        }
      />

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <div style={{
          background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: "16px 20px",
          display: "flex", alignItems: "center", gap: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10, background: "#eff6ff", color: "#3b82f6",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Car style={{ width: 22, height: 22 }} />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-strong)", lineHeight: 1.1 }}>{totalCars}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 4 }}>
              Wszystkie pojazdy
            </div>
          </div>
        </div>

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
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-strong)", lineHeight: 1.1 }}>{assignedCars}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 4 }}>
              Przypisane do ekip
            </div>
          </div>
        </div>
      </div>

      {/* Modal dodawania */}
      {isAddOpen && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(2px)",
          zIndex: 99, display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div style={{
            background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: 24,
            width: "100%", maxWidth: 520, boxShadow: "0 12px 36px rgba(0,0,0,0.18)",
            display: "flex", flexDirection: "column", gap: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
                Nowy pojazd we flocie
              </h3>
              <button onClick={() => setIsAddOpen(false)} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-mute)", padding: 4 }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>
                    Marka <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.make}
                    onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                    placeholder="np. Ford"
                    required
                    style={{ width: "100%", padding: "8px 12px", fontSize: 12.5, borderRadius: 8, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text-strong)", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>
                    Model <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="np. Transit"
                    required
                    style={{ width: "100%", padding: "8px 12px", fontSize: 12.5, borderRadius: 8, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text-strong)", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>
                    Numer rejestracyjny <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.registrationNumber}
                    onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                    placeholder="np. WZY 1234"
                    required
                    style={{ width: "100%", padding: "8px 12px", fontSize: 12.5, borderRadius: 8, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text-strong)", outline: "none", fontFamily: "monospace", letterSpacing: "0.05em", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>
                    Rocznik
                  </label>
                  <input
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    placeholder="np. 2021"
                    style={{ width: "100%", padding: "8px 12px", fontSize: 12.5, borderRadius: 8, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text-strong)", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>
                    VIN
                  </label>
                  <input
                    type="text"
                    value={formData.vin}
                    onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
                    placeholder="17 znaków"
                    style={{ width: "100%", padding: "8px 12px", fontSize: 12.5, borderRadius: 8, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text-strong)", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>
                    Przypisz do ekipy
                  </label>
                  <select
                    value={formData.assignedInstallationTeamId}
                    onChange={(e) => setFormData({ ...formData, assignedInstallationTeamId: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", fontSize: 12.5, borderRadius: 8, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text-strong)", outline: "none", boxSizing: "border-box" }}
                  >
                    <option value="none">Brak (pojazd bez ekipy)</option>
                    {teams?.map((t) => (
                      <option key={t._id} value={t._id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
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
                  {saving ? "Dodawanie..." : "Dodaj pojazd"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lista pojazdów */}
      {cars === undefined ? (
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: "48px 24px", textAlign: "center", color: "var(--text-mute)" }}>
          Ładowanie...
        </div>
      ) : cars.length === 0 ? (
        <div style={{
          background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: "48px 24px",
          textAlign: "center", color: "var(--text-mute)",
        }}>
          <Car style={{ width: 44, height: 44, margin: "0 auto 12px", opacity: 0.4 }} />
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>Brak pojazdów we flocie</p>
          <p style={{ fontSize: 12.5, color: "var(--text-mute)", marginTop: 4 }}>Dodaj pierwszy pojazd klikając przycisk powyżej.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {cars.map((car) => (
            <Link key={car._id} href={`/admin/flota/${car._id}`} style={{ textDecoration: "none" }}>
              <div style={{
                background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: 20,
                boxShadow: "0 1px 4px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", gap: 14,
                transition: "box-shadow 0.15s, border-color 0.15s", cursor: "pointer",
              }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"; (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 4px rgba(0,0,0,0.03)"; (e.currentTarget as HTMLDivElement).style.borderColor = "var(--line)"; }}
              >
                {/* Header */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
                      {car.make} {car.model}
                    </h3>
                    {car.year && (
                      <span style={{ fontSize: 12, color: "var(--text-mute)" }}>{car.year}</span>
                    )}
                  </div>
                  <ChevronRight style={{ width: 16, height: 16, color: "var(--text-mute)", flexShrink: 0, marginTop: 2 }} />
                </div>

                {/* Rejestracja + VIN */}
                <div style={{
                  fontSize: 12, background: "var(--panel)", padding: 10, borderRadius: 8,
                  border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 6,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Hash style={{ width: 13, height: 13, color: "var(--text-mute)", flexShrink: 0 }} />
                    <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: "var(--text-strong)", letterSpacing: "0.08em" }}>
                      {car.registrationNumber}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Users style={{ width: 13, height: 13, color: "var(--text-mute)", flexShrink: 0 }} />
                    <span style={{ color: "var(--text-mute)" }}>Ekipa:</span>
                    <span style={{ fontWeight: 600, color: car.teamName ? "var(--text-strong)" : "var(--text-mute)" }}>
                      {car.teamName || "Nie przypisana"}
                    </span>
                  </div>
                </div>

                {/* Footer */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", display: "flex", alignItems: "center", gap: 4 }}>
                    <Calendar style={{ width: 12, height: 12 }} />
                    Historia zdarzeń i koszty
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
