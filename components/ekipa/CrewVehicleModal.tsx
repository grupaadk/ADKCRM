"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { X, Truck, Fuel, Wrench, ShieldAlert, Plus, Calendar, DollarSign, Gauge, Check } from "lucide-react";

interface CrewVehicleModalProps {
  pin: string | null;
  onClose: () => void;
}

const EVENT_TYPE_LABELS = {
  refueling: { label: "Tankowanie", icon: Fuel, color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  inspection: { label: "Przegląd", icon: Wrench, color: "text-blue-700 bg-blue-50 border-blue-200" },
  repair: { label: "Naprawa", icon: ShieldAlert, color: "text-rose-700 bg-rose-50 border-rose-200" },
  other: { label: "Inne", icon: Truck, color: "text-purple-700 bg-purple-50 border-purple-200" },
};

export function CrewVehicleModal({ pin, onClose }: CrewVehicleModalProps) {
  const data = useQuery(api.cars.getTeamCarAndEventsByPin, pin ? { pin } : "skip");
  const createCarEventByPin = useMutation(api.cars.createCarEventByPin);

  const [showAddForm, setShowAddForm] = useState(false);
  const [type, setType] = useState<"refueling" | "inspection" | "repair" | "other">("refueling");
  const [cost, setCost] = useState("");
  const [mileage, setMileage] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const car = data?.car;
  const events = data?.events ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || !car) return;
    setSubmitting(true);
    setErrorMsg(null);

    const costNum = parseFloat(cost.replace(",", "."));
    if (isNaN(costNum) || costNum < 0) {
      setErrorMsg("Wprowadź prawidłową kwotę.");
      setSubmitting(false);
      return;
    }

    try {
      await createCarEventByPin({
        pin,
        type,
        date: Date.now(),
        cost: costNum,
        mileage: mileage ? parseInt(mileage, 10) : undefined,
        description: description.trim() || undefined,
      });

      setShowAddForm(false);
      setCost("");
      setMileage("");
      setDescription("");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Błąd dodawania wpisu");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="panel rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 w-full max-w-lg max-h-[92dvh] overflow-y-auto space-y-5 shadow-xl animate-in slide-in-from-bottom-6 sm:zoom-in-95 pb-8 sm:pb-6"
        style={{ background: "var(--panel)" }}
      >
        {/* Pull Handle */}
        <div className="w-12 h-1.5 rounded-full mx-auto sm:hidden opacity-40" style={{ background: "var(--line-2)" }} />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3" style={{ borderBottom: "1px solid var(--line)" }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold shadow-xs">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold strong leading-snug">Pojazd ekipy</h2>
              <p className="text-xs dim">Zdarzenia, tankowania i serwis samochodu</p>
            </div>
          </div>
          <button onClick={onClose} className="btn icon ghost">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Vehicle Badge Info */}
        {!data ? (
          <div className="text-center py-6 text-xs dim">Ładowanie danych pojazdu...</div>
        ) : !car ? (
          <div className="panel p-4 text-center space-y-1" style={{ background: "var(--panel-2)" }}>
            <p className="text-sm font-bold text-slate-800">Brak przypisanego pojazdu</p>
            <p className="text-xs dim">Biuro nie przypisało jeszcze aktywnego samochodu do Twojej ekipy monterskiej.</p>
          </div>
        ) : (
          <div className="panel p-4 space-y-2" style={{ background: "var(--panel-2)" }}>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                  Pojazd ekipy
                </span>
                <h3 className="text-lg font-extrabold strong mt-1">
                  {car.make} {car.model}
                </h3>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-bold bg-slate-900 text-white px-2.5 py-1 rounded-lg tracking-wider">
                  {car.registrationNumber}
                </span>
              </div>
            </div>
            {car.vin && (
              <p className="text-[11px] font-mono mute">VIN: {car.vin}</p>
            )}
          </div>
        )}

        {/* Add Event Form / Toggle */}
        {car && (
          <div>
            {!showAddForm ? (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="btn primary w-full py-3 justify-center font-bold text-xs gap-2 shadow-xs"
              >
                <Plus className="w-4 h-4" /> Zgłoś zdarzenie (tankowanie, serwis, koszt)
              </button>
            ) : (
              <form onSubmit={handleSubmit} className="panel p-4 space-y-4 border border-blue-200 bg-blue-50/30">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold strong flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-blue-600" /> Dodaj zdarzenie w pojeździe
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
                  >
                    Anuluj
                  </button>
                </div>

                {errorMsg && <div className="p-2 text-xs pill bad w-full">{errorMsg}</div>}

                {/* Event Type Grid */}
                <div>
                  <label className="text-[11px] font-bold mute uppercase mb-1.5 block">Typ zdarzenia</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.keys(EVENT_TYPE_LABELS) as Array<keyof typeof EVENT_TYPE_LABELS>).map((t) => {
                      const item = EVENT_TYPE_LABELS[t];
                      const Icon = item.icon;
                      const active = type === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setType(t)}
                          className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                            active
                              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                              : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Inputs Grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold mute uppercase mb-1 block">Kwota (zł)</label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={cost}
                        onChange={(e) => setCost(e.target.value)}
                        required
                        className="w-full pl-8 pr-3 py-2 text-xs font-bold rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-blue-600"
                      />
                      <DollarSign className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold mute uppercase mb-1 block">Stan licznika (km)</label>
                    <div className="relative">
                      <input
                        type="number"
                        inputMode="numeric"
                        placeholder="np. 145000"
                        value={mileage}
                        onChange={(e) => setMileage(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 text-xs font-bold rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-blue-600"
                      />
                      <Gauge className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-[11px] font-bold mute uppercase mb-1 block">Opis / Uwagi</label>
                  <input
                    type="text"
                    placeholder="np. Tankowanie Pb95 45L / Wymiana wycieraczek"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-blue-600"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn primary w-full py-2.5 justify-center font-bold text-xs gap-1.5 shadow-xs"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" /> Zapisz wpis w pojeździe
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* History List */}
        {car && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold strong uppercase tracking-wider mute">Ostatnie zdarzenia w pojeździe</h4>
            {events.length === 0 ? (
              <p className="text-xs dim text-center py-4">Brak zarejestrowanych zdarzeń w tym pojeździe.</p>
            ) : (
              <div className="space-y-2">
                {events.map((ev) => {
                  const info = EVENT_TYPE_LABELS[ev.type] ?? EVENT_TYPE_LABELS.other;
                  const Icon = info.icon;
                  const evDate = new Date(ev.date).toLocaleDateString("pl-PL", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <div
                      key={ev._id}
                      className="p-3 rounded-xl border border-slate-200 bg-white space-y-1.5 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${info.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800">{info.label}</span>
                            <span className="text-[10px] dim">{evDate}</span>
                          </div>
                          {ev.description && <p className="text-xs text-slate-600">{ev.description}</p>}
                          {ev.mileage && <p className="text-[11px] mute font-mono">Licznik: {ev.mileage} km</p>}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-extrabold text-slate-900">
                          {ev.cost.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
