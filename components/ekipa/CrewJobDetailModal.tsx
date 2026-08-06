"use client";

import { X, Phone, MapPin, Calendar, Clock, CheckCircle2, Wrench, ShieldAlert, Navigation, FileText, CheckSquare } from "lucide-react";

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
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="panel rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 w-full max-w-lg max-h-[92dvh] overflow-y-auto space-y-5 shadow-xl animate-in slide-in-from-bottom-6 sm:zoom-in-95 pb-8 sm:pb-6"
        style={{ background: "var(--panel)" }}
      >
        
        {/* Mobile Pull Handle Indicator */}
        <div className="w-12 h-1.5 rounded-full mx-auto sm:hidden opacity-40" style={{ background: "var(--line-2)" }} />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 pb-4" style={{ borderBottom: "1px solid var(--line)" }}>
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-white shadow-xs ${
                isMontaz ? "bg-blue-600" : "bg-amber-600"
              }`}
            >
              {isMontaz ? <Wrench className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="pill acc">
                  {isMontaz ? "Montaż" : "Serwis"}
                </span>
                <span className={`pill ${isDone ? "ok" : "warn"}`}>
                  <span className="dot" />
                  {isDone ? "Zrealizowano" : "W trakcie"}
                </span>
              </div>
              <h2 className="text-lg font-bold strong mt-1 leading-snug">{item.title}</h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn icon ghost"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Date & Time Badge */}
        <div className="panel p-3 flex items-center justify-between text-xs" style={{ background: "var(--panel-2)" }}>
          <div className="flex items-center gap-2 dim font-medium capitalize">
            <Calendar className="w-4 h-4 flex-shrink-0" style={{ color: "var(--accent)" }} />
            {dateStr}
          </div>
          {item.timeStr && (
            <div className="flex items-center gap-1.5 font-bold strong bg-white px-3 py-1.5 rounded-lg border shadow-xs" style={{ borderColor: "var(--line)" }}>
              <Clock className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
              {item.timeStr}
            </div>
          )}
        </div>

        {/* Action Buttons: Phone & Navigation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {item.phone ? (
            <a
              href={`tel:${item.phone}`}
              className="flex items-center justify-between p-3 rounded-xl border font-bold text-xs transition-all active:scale-98"
              style={{
                background: "var(--ok-soft)",
                borderColor: "oklch(0.78 0.14 155 / 0.35)",
                color: "var(--ok)",
              }}
            >
              <div className="flex items-center gap-2.5 truncate">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.78 0.14 155 / 0.2)" }}>
                  <Phone className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <div className="text-[10px] uppercase tracking-wider font-bold">Telefon</div>
                  <div className="text-sm font-bold truncate">{item.phone}</div>
                </div>
              </div>
            </a>
          ) : (
            <div className="p-3 rounded-xl panel mute flex items-center justify-center text-xs font-medium">
              Brak telefonu
            </div>
          )}

          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-xl border font-bold text-xs transition-all active:scale-98"
            style={{
              background: "var(--accent-soft)",
              borderColor: "var(--accent-line)",
              color: "var(--accent)",
            }}
          >
            <div className="flex items-center gap-2.5 truncate">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-soft)" }}>
                <Navigation className="w-4 h-4" />
              </div>
              <div className="truncate">
                <div className="text-[10px] uppercase tracking-wider font-bold">Nawiguj</div>
                <div className="text-xs font-bold truncate">Google Maps</div>
              </div>
            </div>
          </a>
        </div>

        {/* Client & Address Info */}
        <div className="space-y-3">
          <div className="panel p-3.5 space-y-1.5" style={{ background: "var(--panel-2)" }}>
            <div className="text-[10px] font-bold mute uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} /> Klient
            </div>
            <div className="text-base font-bold strong">{item.clientName}</div>
          </div>

          <div className="panel p-3.5 space-y-1.5" style={{ background: "var(--panel-2)" }}>
            <div className="text-[10px] font-bold mute uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} /> Adres Montażu / Inwestycji
            </div>
            <div className="text-sm font-medium text-slate-800 leading-relaxed">{item.address}</div>
          </div>
        </div>

        {/* Services / Details */}
        {(item.services && item.services.length > 0) || item.customText || item.description ? (
          <div className="panel p-3.5 space-y-3 text-xs" style={{ background: "var(--panel-2)" }}>
            <div className="text-[10px] font-bold mute uppercase tracking-wider flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} /> Zakres prac i uwagi
            </div>

            {item.customText && (
              <p className="chip-custom lg font-semibold">{item.customText}</p>
            )}

            {item.services && item.services.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {item.services.map((s, idx) => (
                  <span key={idx} className="chip font-medium">
                    ✓ {s}
                  </span>
                ))}
              </div>
            )}

            {item.description && (
              <p className="p-3 rounded-lg border leading-relaxed bg-white" style={{ borderColor: "var(--line)" }}>
                {item.description}
              </p>
            )}
          </div>
        ) : null}

        {/* Status Toggle Action Button */}
        <button
          onClick={() => onToggleStatus(item)}
          disabled={updating}
          className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 shadow-xs transition-all active:scale-98 cursor-pointer disabled:opacity-50 ${
            isDone ? "btn" : "btn primary"
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
