"use client";

import { X, Phone, MapPin, Calendar, Clock, CheckCircle2, Wrench, ShieldAlert } from "lucide-react";

interface ScheduleItem {
  id: string;
  type: "montaz" | "serwis";
  title: string;
  customText?: string;
  services?: string[];
  description?: string;
  date: number;
  startDate?: number;
  endDate?: number;
  timeStr?: string;
  serviceDateEnd?: number;
  status: string;
  clientName: string;
  phone?: string;
  email?: string;
  address: string;
  comment?: string;
  todos?: Array<{ id: string; text: string; completed: boolean }>;
}

interface CrewJobDetailModalProps {
  item: ScheduleItem | null;
  onClose: () => void;
  onToggleStatus: (item: ScheduleItem) => Promise<void>;
  updating?: boolean;
}

export function CrewJobDetailModal({
  item,
  onClose,
  onToggleStatus,
  updating,
}: CrewJobDetailModalProps) {
  if (!item) return null;

  const isMontaz = item.type === "montaz";
  const isDone = isMontaz
    ? item.status === "completed"
    : item.status === "rozwiazana" || item.status === "zamknieta" || item.status === "zakonczona";

  const dateStr = new Date(item.date).toLocaleDateString("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address)}`;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-6 animate-in slide-in-from-bottom-4 sm:zoom-in-95">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-white shadow-md ${
                isMontaz ? "bg-blue-600" : "bg-amber-600"
              }`}
            >
              {isMontaz ? <Wrench className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {isMontaz ? "Montaż" : "Serwis"}
                </span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    isDone
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                  }`}
                >
                  {isDone ? "Zrealizowano" : "W trakcie"}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white mt-1">{item.title}</h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Date & Time Badge */}
        <div className="bg-slate-800/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-300 font-medium capitalize">
            <Calendar className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            {dateStr}
          </div>
          {item.timeStr && (
            <div className="flex items-center gap-1.5 font-bold text-white bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              {item.timeStr}
            </div>
          )}
        </div>

        {/* Client & Address Info */}
        <div className="space-y-3">
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Klient & Kontakt
            </div>
            <div className="text-base font-bold text-white">{item.clientName}</div>

            {item.phone ? (
              <a
                href={`tel:${item.phone}`}
                className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold text-sm hover:bg-emerald-500/20 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  {item.phone}
                </div>
                <span className="text-xs uppercase tracking-wider font-bold bg-emerald-500/20 px-2.5 py-1 rounded-lg">
                  Zadzwoń
                </span>
              </a>
            ) : (
              <div className="text-xs text-slate-500">Brak numeru telefonu</div>
            )}
          </div>

          {/* Address & Navigation */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Adres Inwestycji / Montażu
            </div>
            <div className="text-sm font-medium text-slate-200">{item.address}</div>

            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 font-semibold text-sm hover:bg-blue-500/20 transition-colors"
            >
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Nawiguj w Google Maps
              </div>
              <span className="text-xs uppercase tracking-wider font-bold bg-blue-500/20 px-2.5 py-1 rounded-lg">
                Nawigacja
              </span>
            </a>
          </div>
        </div>

        {/* Services / Details */}
        {(item.services && item.services.length > 0) || item.customText || item.description ? (
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4 space-y-3 text-xs">
            <div className="font-semibold text-slate-400 uppercase tracking-wider">
              Zakres prac / Opis
            </div>

            {item.customText && (
              <p className="text-sm font-semibold text-white">{item.customText}</p>
            )}

            {item.services && item.services.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {item.services.map((s, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 font-medium"
                  >
                    ✓ {s}
                  </span>
                ))}
              </div>
            )}

            {item.description && (
              <p className="text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                {item.description}
              </p>
            )}
          </div>
        ) : null}

        {/* Action Button */}
        <button
          onClick={() => onToggleStatus(item)}
          disabled={updating}
          className={`w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98 cursor-pointer disabled:opacity-50 ${
            isDone
              ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black shadow-emerald-500/20"
          }`}
        >
          {updating ? (
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              {isDone ? "Cofnij realizację" : "Oznacz jako Zrealizowane"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
